import type { ZodError } from "zod";

import { hashLabWorkflowSpec } from "../hash";
import {
  BoundedConcentrationError,
  canonicalizeBoundedConcentrationDecimal
} from "../material-initialization";
import { materialSupportsContainerCapabilities } from "../registries/reagents";
import type { ComponentRegistryEntry } from "../registries/components";
import {
  labWorkflowDraftV2Schema,
  labWorkflowSpecV2Schema,
  type LabWorkflowDraftV2,
  type LabWorkflowSpecV2
} from "../schema/v2";
import type { WorkflowCondition, WorkflowRule } from "../schema/conditions";
import { migrateLabWorkflowV2_0ToV2_1 } from "../schema/migration";
import { deepFreeze } from "../runtime/generic/utils";
import {
  PRODUCTION_LAB_WORKFLOW_V2_REGISTRIES,
  type LabWorkflowV2RegistryContext
} from "../validation";
import {
  labDraftCommandSchema,
  type LabDraftCommand,
  type LabDraftCommandType
} from "./commands";
import {
  labDraftRemovalTargetSchema,
  type CompatibilityEffect,
  type LabDraftRemovalImpact,
  type LabDraftRemovalResolution,
  type LabDraftRemovalTarget,
  type RemovalReference,
  type RemovalResolutionKind
} from "./removal";

export const LAB_DRAFT_COMMAND_ERROR_CODES = Object.freeze({
  commandInvalid: "authoring.command_invalid.v1",
  draftInvalid: "authoring.draft_invalid.v1",
  registryUnknown: "authoring.registry_unknown.v1",
  registryUnavailable: "authoring.registry_unavailable.v1",
  duplicateId: "authoring.duplicate_id.v1",
  referenceMissing: "authoring.reference_missing.v1",
  incompatible: "authoring.incompatible.v1",
  dependencyExists: "authoring.dependency_exists.v1",
  boundsExceeded: "authoring.bounds_exceeded.v1",
  orderingCycle: "authoring.ordering_cycle.v1",
  commandNotApplicable: "authoring.command_not_applicable.v1",
  revisionConflict: "authoring.revision_conflict.v1",
  removalPlanStale: "authoring.removal_plan_stale.v1",
  removalResolutionNotAllowed: "authoring.removal_resolution_not_allowed.v1",
  removalConfirmationRequired: "authoring.removal_confirmation_required.v1"
} as const);

export type LabDraftCommandErrorCode =
  (typeof LAB_DRAFT_COMMAND_ERROR_CODES)[keyof typeof LAB_DRAFT_COMMAND_ERROR_CODES];

export interface LabDraftCommandErrorResult {
  readonly code: LabDraftCommandErrorCode;
  readonly path: string;
  readonly message: string;
  readonly dependencyPaths: readonly string[];
}

export interface LabDraftEditMetadata {
  readonly commandType: LabDraftCommandType;
  readonly revisionBefore: number;
  readonly revisionAfter: number;
  readonly validationInvalidated: true;
  readonly judgeCritiqueInvalidated: true;
}

export interface LabDraftTransactionEditMetadata {
  readonly commandTypes: readonly LabDraftCommandType[];
  readonly commandCount: number;
  readonly revisionBefore: number;
  readonly revisionAfter: number;
  readonly validationInvalidated: true;
  readonly judgeCritiqueInvalidated: true;
}

export type LabDraftCommandResult =
  | {
      readonly ok: true;
      readonly draft: Readonly<LabWorkflowDraftV2>;
      readonly edit: Readonly<LabDraftEditMetadata>;
    }
  | {
      readonly ok: false;
      readonly error: Readonly<LabDraftCommandErrorResult>;
    };

export type LabDraftTransactionResult =
  | {
      readonly ok: true;
      readonly draft: Readonly<LabWorkflowDraftV2>;
      readonly edit: Readonly<LabDraftTransactionEditMetadata>;
    }
  | {
      readonly ok: false;
      readonly failingCommandIndex: number | null;
      readonly error: Readonly<LabDraftCommandErrorResult>;
    };

export type LabDraftRemovalInspectionResult =
  | {
      readonly ok: true;
      readonly impact: Readonly<LabDraftRemovalImpact>;
    }
  | {
      readonly ok: false;
      readonly error: Readonly<LabDraftCommandErrorResult>;
    };

class CommandFailure extends Error {
  constructor(
    readonly code: LabDraftCommandErrorCode,
    readonly path: string,
    message: string,
    readonly dependencyPaths: readonly string[] = []
  ) {
    super(message);
    this.name = "LabDraftCommandError";
  }
}

function fail(
  code: LabDraftCommandErrorCode,
  path: string,
  message: string,
  dependencyPaths: readonly string[] = []
): never {
  throw new CommandFailure(code, path, message, dependencyPaths);
}

function firstZodPath(error: ZodError): string {
  const path = error.issues[0]?.path ?? [];
  return path.length === 0 ? "$" : `$.${path.join(".")}`;
}

function exactEntry<T extends { readonly id: string }>(
  registry: {
    has(id: string): boolean;
    get(id: string): T;
  },
  id: string,
  path: string
): T {
  if (!registry.has(id)) {
    fail(
      LAB_DRAFT_COMMAND_ERROR_CODES.registryUnknown,
      path,
      `Unknown registry ID: ${id}`
    );
  }
  return registry.get(id);
}

function equipmentAt(
  draft: LabWorkflowDraftV2,
  instanceId: string,
  path: string,
  registries: LabWorkflowV2RegistryContext
): { index: number; definition: ComponentRegistryEntry } {
  const index = draft.equipment.findIndex(
    (equipment) => equipment.instanceId === instanceId
  );
  if (index < 0) {
    fail(
      LAB_DRAFT_COMMAND_ERROR_CODES.referenceMissing,
      path,
      `Unknown equipment instance: ${instanceId}`
    );
  }
  return {
    index,
    definition: exactEntry(
      registries.components,
      draft.equipment[index]!.equipmentDefinitionId,
      `equipment[${index}].equipmentDefinitionId`
    )
  };
}

function requireObjective(
  draft: LabWorkflowDraftV2,
  objectiveId: string,
  path: string,
  registries: LabWorkflowV2RegistryContext
): void {
  const resolution = registries.skills.resolve(objectiveId);
  if (resolution.status !== "resolved" || resolution.source !== "canonical") {
    fail(
      LAB_DRAFT_COMMAND_ERROR_CODES.registryUnknown,
      path,
      `Unknown canonical objective ID: ${objectiveId}`
    );
  }
  if (resolution.entry.availability !== "verified") {
    fail(
      LAB_DRAFT_COMMAND_ERROR_CODES.registryUnavailable,
      path,
      `Objective is not verified: ${objectiveId}`
    );
  }
}

function requireSelectedObjectives(
  draft: LabWorkflowDraftV2,
  objectiveIds: readonly string[],
  path: string,
  registries: LabWorkflowV2RegistryContext
): void {
  objectiveIds.forEach((objectiveId, index) => {
    requireObjective(draft, objectiveId, `${path}[${index}]`, registries);
    if (!draft.objectiveIds.includes(objectiveId)) {
      fail(
        LAB_DRAFT_COMMAND_ERROR_CODES.referenceMissing,
        `${path}[${index}]`,
        `Objective is not selected by this draft: ${objectiveId}`
      );
    }
  });
}

function requireEquipmentConfiguration(
  configurationPresetId: string,
  definition: ComponentRegistryEntry,
  path: string,
  registries: LabWorkflowV2RegistryContext
): void {
  const preset = exactEntry(
    registries.configurations,
    configurationPresetId,
    path
  );
  if (
    preset.category !== "component_configuration" ||
    preset.availability !== "verified" ||
    !preset.compatibleComponentIds.includes(definition.id)
  ) {
    fail(
      preset.availability === "restricted"
        ? LAB_DRAFT_COMMAND_ERROR_CODES.registryUnavailable
        : LAB_DRAFT_COMMAND_ERROR_CODES.incompatible,
      path,
      `Configuration ${configurationPresetId} is not compatible with ${definition.id}.`
    );
  }
}

function requireRuleReference(
  draft: LabWorkflowDraftV2,
  ruleId: string,
  path: string
): WorkflowRule {
  const rule = draft.rules.find((candidate) => candidate.id === ruleId);
  if (!rule) {
    fail(
      LAB_DRAFT_COMMAND_ERROR_CODES.referenceMissing,
      path,
      `Unknown workflow rule: ${ruleId}`
    );
  }
  return rule;
}

function validateActionConnection(
  draft: LabWorkflowDraftV2,
  actionId: string,
  sourceEquipmentInstanceId: string | undefined,
  targetEquipmentInstanceIds: readonly string[],
  path: string,
  registries: LabWorkflowV2RegistryContext
): void {
  const action = exactEntry(registries.actions, actionId, `${path}.actionId`);
  if (!sourceEquipmentInstanceId) {
    if (action.requiredSourceCapabilityIds.length > 0) {
      fail(
        LAB_DRAFT_COMMAND_ERROR_CODES.incompatible,
        `${path}.sourceEquipmentInstanceId`,
        `Action ${actionId} requires a source equipment instance.`
      );
    }
  } else {
    const source = equipmentAt(
      draft,
      sourceEquipmentInstanceId,
      `${path}.sourceEquipmentInstanceId`,
      registries
    ).definition;
    /*
     * Empty component allowlist means capability-gated only, matching the
     * runtime validator. Authoring and validation must agree, or a draft a
     * teacher can build would fail validation (or the reverse).
     */
    if (
      (action.actorComponentIds.length > 0 &&
        !action.actorComponentIds.includes(source.id)) ||
      action.requiredSourceCapabilityIds.some(
        (capabilityId) => !source.capabilityIds.includes(capabilityId)
      )
    ) {
      fail(
        LAB_DRAFT_COMMAND_ERROR_CODES.incompatible,
        `${path}.sourceEquipmentInstanceId`,
        `${sourceEquipmentInstanceId} cannot perform ${actionId}.`
      );
    }
  }
  targetEquipmentInstanceIds.forEach((instanceId, index) => {
    const target = equipmentAt(
      draft,
      instanceId,
      `${path}.targetEquipmentInstanceIds[${index}]`,
      registries
    ).definition;
    if (
      (action.targetComponentIds.length > 0 &&
        !action.targetComponentIds.includes(target.id)) ||
      action.requiredTargetCapabilityIds.some(
        (capabilityId) => !target.capabilityIds.includes(capabilityId)
      )
    ) {
      fail(
        LAB_DRAFT_COMMAND_ERROR_CODES.incompatible,
        `${path}.targetEquipmentInstanceIds[${index}]`,
        `${instanceId} cannot receive ${actionId}.`
      );
    }
  });
}

function validateCondition(
  draft: LabWorkflowDraftV2,
  condition: WorkflowCondition,
  path: string,
  registries: LabWorkflowV2RegistryContext
): void {
  switch (condition.kind) {
    case "equipment_state_equals":
    case "forbidden_state_never_reached":
      equipmentAt(
        draft,
        condition.equipmentInstanceId,
        `${path}.equipmentInstanceId`,
        registries
      );
      return;
    case "equipment_capability_present": {
      const equipment = equipmentAt(
        draft,
        condition.equipmentInstanceId,
        `${path}.equipmentInstanceId`,
        registries
      ).definition;
      exactEntry(
        registries.capabilities,
        condition.capabilityId,
        `${path}.capabilityId`
      );
      if (!equipment.capabilityIds.includes(condition.capabilityId)) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.incompatible,
          `${path}.capabilityId`,
          `${condition.equipmentInstanceId} does not provide ${condition.capabilityId}.`
        );
      }
      return;
    }
    case "material_bound_to_container":
      if (
        !draft.materials.some(
          (material) => material.instanceId === condition.materialInstanceId
        )
      ) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.referenceMissing,
          `${path}.materialInstanceId`,
          `Unknown material instance: ${condition.materialInstanceId}`
        );
      }
      equipmentAt(
        draft,
        condition.containerEquipmentInstanceId,
        `${path}.containerEquipmentInstanceId`,
        registries
      );
      return;
    case "action_observed":
    case "action_count_within_range":
      validateActionConnection(
        draft,
        condition.actionId,
        condition.sourceEquipmentInstanceId,
        condition.targetEquipmentInstanceIds,
        path,
        registries
      );
      return;
    case "semantic_event_observed":
      exactEntry(
        registries.eventTypes,
        condition.eventTypeId,
        `${path}.eventTypeId`
      );
      return;
    case "observation_recorded":
      exactEntry(
        registries.configurations,
        condition.observationKeyId,
        `${path}.observationKeyId`
      );
      if (condition.eventTypeId) {
        exactEntry(
          registries.eventTypes,
          condition.eventTypeId,
          `${path}.eventTypeId`
        );
      }
      if (condition.expectedValueSourceId) {
        exactEntry(
          registries.configurations,
          condition.expectedValueSourceId,
          `${path}.expectedValueSourceId`
        );
      }
      return;
    case "registered_completion_policy_satisfied":
      exactEntry(
        registries.configurations,
        condition.completionPolicyId,
        `${path}.completionPolicyId`
      );
      condition.evidenceRuleIds.forEach((ruleId, index) =>
        requireRuleReference(draft, ruleId, `${path}.evidenceRuleIds[${index}]`)
      );
      return;
    case "observable_within_tolerance":
      exactEntry(
        registries.configurations,
        condition.observableId,
        `${path}.observableId`
      );
      exactEntry(registries.configurations, condition.unitId, `${path}.unitId`);
      return;
    case "event_flag":
      exactEntry(registries.eventFlags, condition.flagId, `${path}.flagId`);
      if (condition.eventTypeId) {
        exactEntry(
          registries.eventTypes,
          condition.eventTypeId,
          `${path}.eventTypeId`
        );
      }
      return;
    case "rule_satisfied_before":
      requireRuleReference(
        draft,
        condition.predecessorRuleId,
        `${path}.predecessorRuleId`
      );
      requireRuleReference(
        draft,
        condition.successorRuleId,
        `${path}.successorRuleId`
      );
      return;
    case "student_response_submitted":
      exactEntry(
        registries.configurations,
        condition.submissionFieldId,
        `${path}.submissionFieldId`
      );
      return;
    default: {
      const exhaustive: never = condition;
      return exhaustive;
    }
  }
}

function dependencyPathsForEquipment(
  draft: LabWorkflowDraftV2,
  instanceId: string
): string[] {
  const paths: string[] = [];
  draft.materials.forEach((material, index) => {
    if (material.containerInstanceId === instanceId)
      paths.push(`materials[${index}].containerInstanceId`);
  });
  draft.layout.placements.forEach((placement, index) => {
    if (placement.equipmentInstanceId === instanceId)
      paths.push(`layout.placements[${index}].equipmentInstanceId`);
  });
  draft.permittedActions.forEach((action, index) => {
    if (action.sourceEquipmentInstanceId === instanceId)
      paths.push(`permittedActions[${index}].sourceEquipmentInstanceId`);
    action.targetEquipmentInstanceIds.forEach((targetId, targetIndex) => {
      if (targetId === instanceId)
        paths.push(
          `permittedActions[${index}].targetEquipmentInstanceIds[${targetIndex}]`
        );
    });
  });
  draft.rules.forEach((rule, index) => {
    const serialized = JSON.stringify(rule.condition);
    if (serialized.includes(`"${instanceId}"`))
      paths.push(`rules[${index}].condition`);
  });
  draft.safetyBindings.forEach((binding, index) => {
    binding.equipmentInstanceIds.forEach((candidate, candidateIndex) => {
      if (candidate === instanceId)
        paths.push(
          `safetyBindings[${index}].equipmentInstanceIds[${candidateIndex}]`
        );
    });
  });
  draft.presentation.instructionGuidance.forEach((guidance, index) => {
    guidance.equipmentInstanceIds.forEach((candidate, candidateIndex) => {
      if (candidate === instanceId)
        paths.push(
          `presentation.instructionGuidance[${index}].equipmentInstanceIds[${candidateIndex}]`
        );
    });
  });
  draft.compatibility?.equipmentRoleBindings.forEach((binding, index) => {
    if (binding.equipmentInstanceId === instanceId)
      paths.push(
        `compatibility.equipmentRoleBindings[${index}].equipmentInstanceId`
      );
  });
  return paths.sort();
}

function dependencyPathsForRule(
  draft: LabWorkflowDraftV2,
  ruleId: string
): string[] {
  const paths: string[] = [];
  draft.rules.forEach((rule, index) => {
    if (rule.id === ruleId) return;
    if (JSON.stringify(rule.condition).includes(`"${ruleId}"`))
      paths.push(`rules[${index}].condition`);
  });
  draft.permittedActions.forEach((action, index) => {
    action.availability.allSatisfiedRuleIds.forEach(
      (candidate, candidateIndex) => {
        if (candidate === ruleId)
          paths.push(
            `permittedActions[${index}].availability.allSatisfiedRuleIds[${candidateIndex}]`
          );
      }
    );
    action.availability.allUnsatisfiedRuleIds.forEach(
      (candidate, candidateIndex) => {
        if (candidate === ruleId)
          paths.push(
            `permittedActions[${index}].availability.allUnsatisfiedRuleIds[${candidateIndex}]`
          );
      }
    );
  });
  draft.instructions.forEach((instruction, index) => {
    instruction.relatedRuleIds.forEach((candidate, candidateIndex) => {
      if (candidate === ruleId)
        paths.push(`instructions[${index}].relatedRuleIds[${candidateIndex}]`);
    });
  });
  draft.rubric.criteria.forEach((criterion, index) => {
    criterion.ruleIds.forEach((candidate, candidateIndex) => {
      if (candidate === ruleId)
        paths.push(`rubric.criteria[${index}].ruleIds[${candidateIndex}]`);
    });
  });
  draft.presentation.rulePrompts.forEach((prompt, index) => {
    if (prompt.ruleId === ruleId)
      paths.push(`presentation.rulePrompts[${index}].ruleId`);
  });
  return paths.sort();
}

function dependencyPathsForObjective(
  draft: LabWorkflowDraftV2,
  objectiveId: string
): string[] {
  const paths: string[] = [];
  draft.rules.forEach((rule, index) => {
    rule.objectiveIds.forEach((candidate, candidateIndex) => {
      if (candidate === objectiveId)
        paths.push(`rules[${index}].objectiveIds[${candidateIndex}]`);
    });
  });
  draft.rubric.criteria.forEach((criterion, index) => {
    criterion.objectiveIds.forEach((candidate, candidateIndex) => {
      if (candidate === objectiveId)
        paths.push(`rubric.criteria[${index}].objectiveIds[${candidateIndex}]`);
    });
  });
  draft.coachPolicy.triggers.forEach((trigger, index) => {
    trigger.objectiveIds.forEach((candidate, candidateIndex) => {
      if (candidate === objectiveId)
        paths.push(
          `coachPolicy.triggers[${index}].objectiveIds[${candidateIndex}]`
        );
    });
  });
  draft.coachPolicy.adaptiveRetries.forEach((retry, index) => {
    retry.targetObjectiveIds.forEach((candidate, candidateIndex) => {
      if (candidate === objectiveId)
        paths.push(
          `coachPolicy.adaptiveRetries[${index}].targetObjectiveIds[${candidateIndex}]`
        );
    });
  });
  return paths.sort();
}

function compareRemovalEntries(
  left: { readonly path: string; readonly kind: string; readonly id: string },
  right: { readonly path: string; readonly kind: string; readonly id: string }
): number {
  return (
    left.path.localeCompare(right.path) ||
    left.kind.localeCompare(right.kind) ||
    left.id.localeCompare(right.id)
  );
}

function conditionReferencesEquipment(
  condition: WorkflowCondition,
  instanceId: string
): boolean {
  switch (condition.kind) {
    case "equipment_state_equals":
    case "equipment_capability_present":
    case "forbidden_state_never_reached":
      return condition.equipmentInstanceId === instanceId;
    case "material_bound_to_container":
      return condition.containerEquipmentInstanceId === instanceId;
    case "action_observed":
    case "action_count_within_range":
      return (
        condition.sourceEquipmentInstanceId === instanceId ||
        condition.targetEquipmentInstanceIds.includes(instanceId)
      );
    default:
      return false;
  }
}

function conditionReferencesMaterial(
  condition: WorkflowCondition,
  instanceId: string
): boolean {
  return (
    condition.kind === "material_bound_to_container" &&
    condition.materialInstanceId === instanceId
  );
}

function conditionReferencesRule(
  condition: WorkflowCondition,
  ruleId: string
): boolean {
  if (condition.kind === "rule_satisfied_before") {
    return (
      condition.predecessorRuleId === ruleId ||
      condition.successorRuleId === ruleId
    );
  }
  return (
    condition.kind === "registered_completion_policy_satisfied" &&
    condition.evidenceRuleIds.includes(ruleId)
  );
}

function permissionMatchesCondition(
  permission: LabWorkflowDraftV2["permittedActions"][number],
  condition: WorkflowCondition
): boolean {
  if (
    condition.kind !== "action_observed" &&
    condition.kind !== "action_count_within_range"
  ) {
    return false;
  }
  return (
    permission.actionId === condition.actionId &&
    permission.sourceEquipmentInstanceId ===
      condition.sourceEquipmentInstanceId &&
    permission.targetEquipmentInstanceIds.length ===
      condition.targetEquipmentInstanceIds.length &&
    permission.targetEquipmentInstanceIds.every(
      (instanceId, index) =>
        condition.targetEquipmentInstanceIds[index] === instanceId
    )
  );
}

function requireRemovalTarget(
  draft: LabWorkflowDraftV2,
  target: LabDraftRemovalTarget,
  registries: LabWorkflowV2RegistryContext
): void {
  switch (target.kind) {
    case "objective":
      requireObjective(
        draft,
        target.objectiveId,
        "target.objectiveId",
        registries
      );
      if (!draft.objectiveIds.includes(target.objectiveId)) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.referenceMissing,
          "target.objectiveId",
          `Objective is not selected: ${target.objectiveId}`
        );
      }
      return;
    case "equipment":
      equipmentAt(draft, target.instanceId, "target.instanceId", registries);
      return;
    case "rule":
      requireRuleReference(draft, target.ruleId, "target.ruleId");
      return;
    case "material":
      if (
        !draft.materials.some(
          ({ instanceId }) => instanceId === target.instanceId
        )
      ) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.referenceMissing,
          "target.instanceId",
          `Unknown material binding: ${target.instanceId}`
        );
      }
      return;
    case "permitted_action":
      if (
        !draft.permittedActions.some(({ id }) => id === target.permissionId)
      ) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.referenceMissing,
          "target.permissionId",
          `Unknown permitted action: ${target.permissionId}`
        );
      }
      return;
    case "instruction":
      if (!draft.instructions.some(({ id }) => id === target.instructionId)) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.referenceMissing,
          "target.instructionId",
          `Unknown instruction: ${target.instructionId}`
        );
      }
      return;
    case "rubric_criterion":
      if (!draft.rubric.criteria.some(({ id }) => id === target.criterionId)) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.referenceMissing,
          "target.criterionId",
          `Unknown rubric criterion: ${target.criterionId}`
        );
      }
      return;
  }
}

function referencesForRemoval(
  draft: LabWorkflowDraftV2,
  target: LabDraftRemovalTarget
): RemovalReference[] {
  const references: RemovalReference[] = [];
  const add = (kind: RemovalReference["kind"], id: string, path: string) =>
    references.push({ kind, id, path });

  switch (target.kind) {
    case "objective":
      draft.rules.forEach((rule, index) => {
        if (rule.objectiveIds.includes(target.objectiveId))
          add("workflow_rule", rule.id, `rules[${index}].objectiveIds`);
      });
      draft.rubric.criteria.forEach((criterion, index) => {
        if (criterion.objectiveIds.includes(target.objectiveId))
          add(
            "rubric_criterion",
            criterion.id,
            `rubric.criteria[${index}].objectiveIds`
          );
      });
      draft.coachPolicy.triggers.forEach((trigger, index) => {
        if (trigger.objectiveIds.includes(target.objectiveId))
          add(
            "coach_trigger",
            trigger.id,
            `coachPolicy.triggers[${index}].objectiveIds`
          );
      });
      draft.coachPolicy.adaptiveRetries.forEach((retry, index) => {
        if (retry.targetObjectiveIds.includes(target.objectiveId))
          add(
            "adaptive_retry",
            retry.id,
            `coachPolicy.adaptiveRetries[${index}].targetObjectiveIds`
          );
      });
      break;
    case "equipment": {
      const materialIds = draft.materials
        .filter(
          ({ containerInstanceId }) => containerInstanceId === target.instanceId
        )
        .map(({ instanceId }) => instanceId);
      draft.materials.forEach((material, index) => {
        if (material.containerInstanceId === target.instanceId)
          add(
            "material_binding",
            material.instanceId,
            `materials[${index}].containerInstanceId`
          );
      });
      draft.layout.placements.forEach((placement, index) => {
        if (placement.equipmentInstanceId === target.instanceId)
          add(
            "layout_placement",
            placement.equipmentInstanceId,
            `layout.placements[${index}]`
          );
      });
      draft.permittedActions.forEach((permission, index) => {
        if (
          permission.sourceEquipmentInstanceId === target.instanceId ||
          permission.targetEquipmentInstanceIds.includes(target.instanceId)
        )
          add("permitted_action", permission.id, `permittedActions[${index}]`);
      });
      draft.rules.forEach((rule, index) => {
        if (
          conditionReferencesEquipment(rule.condition, target.instanceId) ||
          materialIds.some((id) =>
            conditionReferencesMaterial(rule.condition, id)
          )
        )
          add("workflow_rule", rule.id, `rules[${index}].condition`);
      });
      draft.safetyBindings.forEach((binding, index) => {
        if (
          binding.equipmentInstanceIds.includes(target.instanceId) ||
          binding.materialInstanceIds.some((id) => materialIds.includes(id))
        )
          add(
            "safety_binding",
            binding.safetyPolicyId,
            `safetyBindings[${index}]`
          );
      });
      draft.presentation.instructionGuidance.forEach((guidance, index) => {
        if (guidance.equipmentInstanceIds.includes(target.instanceId))
          add(
            "instruction_guidance",
            guidance.instructionId,
            `presentation.instructionGuidance[${index}].equipmentInstanceIds`
          );
      });
      break;
    }
    case "rule":
      draft.rules.forEach((rule, index) => {
        if (
          rule.id !== target.ruleId &&
          conditionReferencesRule(rule.condition, target.ruleId)
        )
          add("workflow_rule", rule.id, `rules[${index}].condition`);
      });
      draft.permittedActions.forEach((permission, index) => {
        if (
          permission.availability.allSatisfiedRuleIds.includes(target.ruleId) ||
          permission.availability.allUnsatisfiedRuleIds.includes(target.ruleId)
        )
          add(
            "permitted_action",
            permission.id,
            `permittedActions[${index}].availability`
          );
      });
      draft.instructions.forEach((instruction, index) => {
        if (instruction.relatedRuleIds.includes(target.ruleId))
          add(
            "instruction",
            instruction.id,
            `instructions[${index}].relatedRuleIds`
          );
      });
      draft.rubric.criteria.forEach((criterion, index) => {
        if (
          criterion.ruleIds.includes(target.ruleId) ||
          criterion.evidenceMappings.some(
            (mapping) =>
              mapping.kind === "rule_diagnosis" &&
              mapping.ruleId === target.ruleId
          )
        )
          add("rubric_criterion", criterion.id, `rubric.criteria[${index}]`);
      });
      draft.presentation.rulePrompts.forEach((prompt, index) => {
        if (prompt.ruleId === target.ruleId)
          add(
            "rule_prompt",
            prompt.ruleId,
            `presentation.rulePrompts[${index}]`
          );
      });
      break;
    case "material":
      draft.rules.forEach((rule, index) => {
        if (conditionReferencesMaterial(rule.condition, target.instanceId))
          add("workflow_rule", rule.id, `rules[${index}].condition`);
      });
      draft.safetyBindings.forEach((binding, index) => {
        if (binding.materialInstanceIds.includes(target.instanceId))
          add(
            "safety_binding",
            binding.safetyPolicyId,
            `safetyBindings[${index}].materialInstanceIds`
          );
      });
      draft.presentation.materialLabels.forEach((label, index) => {
        if (label.materialInstanceId === target.instanceId)
          add(
            "material_label",
            label.materialInstanceId,
            `presentation.materialLabels[${index}]`
          );
      });
      break;
    case "permitted_action": {
      const permission = draft.permittedActions.find(
        ({ id }) => id === target.permissionId
      )!;
      draft.rules.forEach((rule, index) => {
        if (permissionMatchesCondition(permission, rule.condition))
          add("workflow_rule", rule.id, `rules[${index}].condition`);
      });
      break;
    }
    case "instruction":
      draft.presentation.instructionGuidance.forEach((guidance, index) => {
        if (guidance.instructionId === target.instructionId)
          add(
            "instruction_guidance",
            guidance.instructionId,
            `presentation.instructionGuidance[${index}]`
          );
      });
      break;
    case "rubric_criterion":
      break;
  }

  return references.sort(compareRemovalEntries);
}

function compatibilityEffectsForRemoval(
  draft: LabWorkflowDraftV2,
  target: LabDraftRemovalTarget
): CompatibilityEffect[] {
  const effects: CompatibilityEffect[] = [];
  if (!draft.compatibility) return effects;
  if (target.kind === "equipment") {
    draft.compatibility.equipmentRoleBindings.forEach((binding, index) => {
      if (binding.equipmentInstanceId !== target.instanceId) return;
      effects.push({
        kind: "equipment_role_removed",
        id: binding.legacyRoleId,
        path: `compatibility.equipmentRoleBindings[${index}]`,
        message: `Removing ${target.instanceId} leaves compatibility role ${binding.legacyRoleId} unbound.`
      });
    });
  }
  if (target.kind === "material") {
    draft.compatibility.materialRoleBindings.forEach((binding, index) => {
      if (binding.materialInstanceId !== target.instanceId) return;
      effects.push({
        kind: "material_role_removed",
        id: binding.legacyRoleId,
        path: `compatibility.materialRoleBindings[${index}]`,
        message: `Removing ${target.instanceId} leaves compatibility role ${binding.legacyRoleId} unbound.`
      });
    });
  }
  if (
    effects.length > 0 &&
    (target.kind === "equipment" || target.kind === "material")
  ) {
    effects.push({
      kind: "runtime_compatibility_incomplete",
      id: draft.compatibility.runtimeAdapterId,
      path: "compatibility",
      message:
        "The legacy runtime adapter will remain unavailable until compatible role bindings are restored and revalidated."
    });
  }
  return effects.sort(compareRemovalEntries);
}

function canDetachObjective(
  draft: LabWorkflowDraftV2,
  objectiveId: string
): boolean {
  return (
    draft.objectiveIds.some((candidate) => candidate !== objectiveId) &&
    draft.rules.every(
      (rule) =>
        !rule.objectiveIds.includes(objectiveId) || rule.objectiveIds.length > 1
    ) &&
    draft.rubric.criteria.every(
      (criterion) =>
        !criterion.objectiveIds.includes(objectiveId) ||
        criterion.objectiveIds.length > 1
    )
  );
}

function inspectRemovalOrFail(
  draft: LabWorkflowDraftV2,
  target: LabDraftRemovalTarget,
  registries: LabWorkflowV2RegistryContext
): Readonly<LabDraftRemovalImpact> {
  requireRemovalTarget(draft, target, registries);
  const references = referencesForRemoval(draft, target);
  const compatibilityEffects = compatibilityEffectsForRemoval(draft, target);
  const allowed: RemovalResolutionKind[] = [];
  if (references.length === 0 && compatibilityEffects.length === 0)
    allowed.push("remove_only");
  if (target.kind === "objective") {
    if (draft.objectiveIds.some((id) => id !== target.objectiveId))
      allowed.push("reassign");
    if (canDetachObjective(draft, target.objectiveId)) allowed.push("detach");
    allowed.push("remove_dependents");
  } else {
    allowed.push("cascade");
  }
  return deepFreeze({
    sourceRevision: draft.revision,
    sourceDraftHash: hashLabWorkflowSpec(draft),
    target,
    references,
    compatibilityEffects,
    allowedResolutions: [...new Set(allowed)]
  });
}

function introducesOrderingCycle(rules: readonly WorkflowRule[]): boolean {
  const edges = new Map<string, string[]>();
  for (const rule of rules) {
    if (rule.condition.kind !== "rule_satisfied_before") continue;
    const from = rule.condition.predecessorRuleId;
    const to = rule.condition.successorRuleId;
    edges.set(from, [...(edges.get(from) ?? []), to]);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const target of edges.get(id) ?? []) {
      if (visit(target)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return [...edges.keys()].some(visit);
}

function addRule(
  draft: LabWorkflowDraftV2,
  rule: WorkflowRule,
  path: string,
  registries: LabWorkflowV2RegistryContext
): void {
  if (draft.rules.some((candidate) => candidate.id === rule.id)) {
    fail(
      LAB_DRAFT_COMMAND_ERROR_CODES.duplicateId,
      `${path}.id`,
      `Duplicate workflow rule: ${rule.id}`
    );
  }
  requireSelectedObjectives(
    draft,
    rule.objectiveIds,
    `${path}.objectiveIds`,
    registries
  );
  validateCondition(draft, rule.condition, `${path}.condition`, registries);
  const next = [...draft.rules, rule];
  if (introducesOrderingCycle(next)) {
    fail(
      LAB_DRAFT_COMMAND_ERROR_CODES.orderingCycle,
      `${path}.condition`,
      "Ordering dependency would create a cycle."
    );
  }
  draft.rules = next;
}

function removeRule(
  draft: LabWorkflowDraftV2,
  ruleId: string,
  path: string
): void {
  const index = draft.rules.findIndex((rule) => rule.id === ruleId);
  if (index < 0) {
    fail(
      LAB_DRAFT_COMMAND_ERROR_CODES.referenceMissing,
      path,
      `Unknown workflow rule: ${ruleId}`
    );
  }
  const dependencies = dependencyPathsForRule(draft, ruleId);
  if (dependencies.length > 0) {
    fail(
      LAB_DRAFT_COMMAND_ERROR_CODES.dependencyExists,
      path,
      `Rule ${ruleId} is still referenced.`,
      dependencies
    );
  }
  draft.rules = draft.rules.filter((rule) => rule.id !== ruleId);
}

function recalculateRubricTotal(draft: LabWorkflowDraftV2): void {
  draft.rubric = {
    ...draft.rubric,
    totalPoints: draft.rubric.criteria.reduce(
      (total, criterion) => total + criterion.maxPoints,
      0
    )
  };
}

function removeRulesCascade(
  draft: LabWorkflowDraftV2,
  initialRuleIds: ReadonlySet<string>
): void {
  const removed = new Set(initialRuleIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const rule of draft.rules) {
      if (removed.has(rule.id)) continue;
      if (
        [...removed].some((id) => conditionReferencesRule(rule.condition, id))
      ) {
        removed.add(rule.id);
        changed = true;
      }
    }
  }
  draft.rules = draft.rules.filter((rule) => !removed.has(rule.id));
  draft.permittedActions = draft.permittedActions.map((permission) => ({
    ...permission,
    availability: {
      allSatisfiedRuleIds: permission.availability.allSatisfiedRuleIds.filter(
        (id) => !removed.has(id)
      ),
      allUnsatisfiedRuleIds:
        permission.availability.allUnsatisfiedRuleIds.filter(
          (id) => !removed.has(id)
        )
    }
  }));

  const removedInstructionIds = new Set<string>();
  draft.instructions = draft.instructions.flatMap((instruction) => {
    const relatedRuleIds = instruction.relatedRuleIds.filter(
      (id) => !removed.has(id)
    );
    if (relatedRuleIds.length === 0) {
      removedInstructionIds.add(instruction.id);
      return [];
    }
    return [{ ...instruction, relatedRuleIds }];
  });

  draft.rubric = {
    ...draft.rubric,
    criteria: draft.rubric.criteria.flatMap((criterion) => {
      const ruleIds = criterion.ruleIds.filter((id) => !removed.has(id));
      const evidenceMappings = criterion.evidenceMappings.filter(
        (mapping) =>
          mapping.kind !== "rule_diagnosis" || !removed.has(mapping.ruleId)
      );
      if (ruleIds.length === 0 || evidenceMappings.length === 0) return [];
      return [{ ...criterion, ruleIds, evidenceMappings }];
    })
  };
  recalculateRubricTotal(draft);
  draft.presentation = {
    ...draft.presentation,
    instructionGuidance: draft.presentation.instructionGuidance.filter(
      ({ instructionId }) => !removedInstructionIds.has(instructionId)
    ),
    rulePrompts: draft.presentation.rulePrompts.filter(
      ({ ruleId }) => !removed.has(ruleId)
    )
  };
}

function removeMaterialsCascade(
  draft: LabWorkflowDraftV2,
  materialIds: ReadonlySet<string>
): void {
  const ruleIds = new Set(
    draft.rules
      .filter((rule) =>
        [...materialIds].some((id) =>
          conditionReferencesMaterial(rule.condition, id)
        )
      )
      .map(({ id }) => id)
  );
  draft.materials = draft.materials.filter(
    ({ instanceId }) => !materialIds.has(instanceId)
  );
  draft.safetyBindings = draft.safetyBindings
    .map((binding) => ({
      ...binding,
      materialInstanceIds: binding.materialInstanceIds.filter(
        (id) => !materialIds.has(id)
      )
    }))
    .filter(
      (binding) =>
        binding.equipmentInstanceIds.length > 0 ||
        binding.materialInstanceIds.length > 0
    );
  draft.presentation = {
    ...draft.presentation,
    materialLabels: draft.presentation.materialLabels.filter(
      ({ materialInstanceId }) => !materialIds.has(materialInstanceId)
    )
  };
  if (draft.compatibility) {
    draft.compatibility = {
      ...draft.compatibility,
      materialRoleBindings: draft.compatibility.materialRoleBindings.filter(
        ({ materialInstanceId }) => !materialIds.has(materialInstanceId)
      )
    };
  }
  removeRulesCascade(draft, ruleIds);
}

function removePermissionsCascade(
  draft: LabWorkflowDraftV2,
  permissionIds: ReadonlySet<string>
): void {
  const permissions = draft.permittedActions.filter(({ id }) =>
    permissionIds.has(id)
  );
  const ruleIds = new Set(
    draft.rules
      .filter((rule) =>
        permissions.some((permission) =>
          permissionMatchesCondition(permission, rule.condition)
        )
      )
      .map(({ id }) => id)
  );
  draft.permittedActions = draft.permittedActions.filter(
    ({ id }) => !permissionIds.has(id)
  );
  removeRulesCascade(draft, ruleIds);
}

function removeEquipmentCascade(
  draft: LabWorkflowDraftV2,
  instanceId: string
): void {
  const materialIds = new Set(
    draft.materials
      .filter(({ containerInstanceId }) => containerInstanceId === instanceId)
      .map(({ instanceId: materialInstanceId }) => materialInstanceId)
  );
  const permissionIds = new Set(
    draft.permittedActions
      .filter(
        (permission) =>
          permission.sourceEquipmentInstanceId === instanceId ||
          permission.targetEquipmentInstanceIds.includes(instanceId)
      )
      .map(({ id }) => id)
  );
  const ruleIds = new Set(
    draft.rules
      .filter(
        (rule) =>
          conditionReferencesEquipment(rule.condition, instanceId) ||
          [...materialIds].some((id) =>
            conditionReferencesMaterial(rule.condition, id)
          ) ||
          draft.permittedActions
            .filter(({ id }) => permissionIds.has(id))
            .some((permission) =>
              permissionMatchesCondition(permission, rule.condition)
            )
      )
      .map(({ id }) => id)
  );

  draft.equipment = draft.equipment.filter(
    ({ instanceId: candidate }) => candidate !== instanceId
  );
  draft.layout = {
    ...draft.layout,
    placements: draft.layout.placements.filter(
      ({ equipmentInstanceId }) => equipmentInstanceId !== instanceId
    )
  };
  draft.permittedActions = draft.permittedActions.filter(
    ({ id }) => !permissionIds.has(id)
  );
  draft.safetyBindings = draft.safetyBindings
    .map((binding) => ({
      ...binding,
      equipmentInstanceIds: binding.equipmentInstanceIds.filter(
        (id) => id !== instanceId
      )
    }))
    .filter(
      (binding) =>
        binding.equipmentInstanceIds.length > 0 ||
        binding.materialInstanceIds.length > 0
    );
  draft.presentation = {
    ...draft.presentation,
    instructionGuidance: draft.presentation.instructionGuidance.map(
      (guidance) => ({
        ...guidance,
        equipmentInstanceIds: guidance.equipmentInstanceIds.filter(
          (id) => id !== instanceId
        )
      })
    )
  };
  if (draft.compatibility) {
    draft.compatibility = {
      ...draft.compatibility,
      equipmentRoleBindings: draft.compatibility.equipmentRoleBindings.filter(
        ({ equipmentInstanceId }) => equipmentInstanceId !== instanceId
      )
    };
  }
  removeMaterialsCascade(draft, materialIds);
  removeRulesCascade(draft, ruleIds);
}

function replaceObjectiveReference(
  ids: readonly string[],
  removedId: string,
  replacementId: string
): string[] {
  return [...new Set(ids.map((id) => (id === removedId ? replacementId : id)))];
}

function reassignObjective(
  draft: LabWorkflowDraftV2,
  objectiveId: string,
  replacementObjectiveId: string,
  registries: LabWorkflowV2RegistryContext
): void {
  if (
    replacementObjectiveId === objectiveId ||
    !draft.objectiveIds.includes(replacementObjectiveId)
  ) {
    fail(
      LAB_DRAFT_COMMAND_ERROR_CODES.referenceMissing,
      "command.resolution.replacementObjectiveId",
      "The replacement objective must be another selected objective."
    );
  }
  requireObjective(
    draft,
    replacementObjectiveId,
    "command.resolution.replacementObjectiveId",
    registries
  );
  draft.rules = draft.rules.map((rule) => ({
    ...rule,
    objectiveIds: replaceObjectiveReference(
      rule.objectiveIds,
      objectiveId,
      replacementObjectiveId
    )
  }));
  draft.rubric = {
    ...draft.rubric,
    criteria: draft.rubric.criteria.map((criterion) => ({
      ...criterion,
      objectiveIds: replaceObjectiveReference(
        criterion.objectiveIds,
        objectiveId,
        replacementObjectiveId
      )
    }))
  };
  draft.coachPolicy = {
    triggers: draft.coachPolicy.triggers.map((trigger) => ({
      ...trigger,
      objectiveIds: replaceObjectiveReference(
        trigger.objectiveIds,
        objectiveId,
        replacementObjectiveId
      )
    })),
    adaptiveRetries: draft.coachPolicy.adaptiveRetries.map((retry) => ({
      ...retry,
      targetObjectiveIds: replaceObjectiveReference(
        retry.targetObjectiveIds,
        objectiveId,
        replacementObjectiveId
      )
    }))
  };
  draft.objectiveIds = draft.objectiveIds.filter((id) => id !== objectiveId);
}

function detachObjective(draft: LabWorkflowDraftV2, objectiveId: string): void {
  if (!canDetachObjective(draft, objectiveId)) {
    fail(
      LAB_DRAFT_COMMAND_ERROR_CODES.removalResolutionNotAllowed,
      "command.resolution.kind",
      "This objective cannot be detached without leaving an empty required objective reference."
    );
  }
  draft.rules = draft.rules.map((rule) => ({
    ...rule,
    objectiveIds: rule.objectiveIds.filter((id) => id !== objectiveId)
  }));
  draft.rubric = {
    ...draft.rubric,
    criteria: draft.rubric.criteria.map((criterion) => ({
      ...criterion,
      objectiveIds: criterion.objectiveIds.filter((id) => id !== objectiveId)
    }))
  };
  draft.coachPolicy = {
    triggers: draft.coachPolicy.triggers.map((trigger) => ({
      ...trigger,
      objectiveIds: trigger.objectiveIds.filter((id) => id !== objectiveId)
    })),
    adaptiveRetries: draft.coachPolicy.adaptiveRetries.map((retry) => ({
      ...retry,
      targetObjectiveIds: retry.targetObjectiveIds.filter(
        (id) => id !== objectiveId
      )
    }))
  };
  draft.objectiveIds = draft.objectiveIds.filter((id) => id !== objectiveId);
}

function removeObjectiveDependents(
  draft: LabWorkflowDraftV2,
  objectiveId: string
): void {
  const ruleIds = new Set(
    draft.rules
      .filter((rule) => rule.objectiveIds.includes(objectiveId))
      .map(({ id }) => id)
  );
  draft.rubric = {
    ...draft.rubric,
    criteria: draft.rubric.criteria.filter(
      (criterion) => !criterion.objectiveIds.includes(objectiveId)
    )
  };
  recalculateRubricTotal(draft);
  draft.coachPolicy = {
    triggers: draft.coachPolicy.triggers.filter(
      (trigger) => !trigger.objectiveIds.includes(objectiveId)
    ),
    adaptiveRetries: draft.coachPolicy.adaptiveRetries.filter(
      (retry) => !retry.targetObjectiveIds.includes(objectiveId)
    )
  };
  draft.objectiveIds = draft.objectiveIds.filter((id) => id !== objectiveId);
  removeRulesCascade(draft, ruleIds);
}

function removeInstructionCascade(
  draft: LabWorkflowDraftV2,
  instructionId: string
): void {
  draft.instructions = draft.instructions.filter(
    ({ id }) => id !== instructionId
  );
  draft.presentation = {
    ...draft.presentation,
    instructionGuidance: draft.presentation.instructionGuidance.filter(
      (guidance) => guidance.instructionId !== instructionId
    )
  };
}

function removeCriterionCascade(
  draft: LabWorkflowDraftV2,
  criterionId: string
): void {
  draft.rubric = {
    ...draft.rubric,
    criteria: draft.rubric.criteria.filter(({ id }) => id !== criterionId)
  };
  recalculateRubricTotal(draft);
}

function applyRemovalResolution(
  draft: LabWorkflowDraftV2,
  target: LabDraftRemovalTarget,
  resolution: LabDraftRemovalResolution,
  impact: Readonly<LabDraftRemovalImpact>,
  registries: LabWorkflowV2RegistryContext
): void {
  if (!impact.allowedResolutions.includes(resolution.kind)) {
    fail(
      LAB_DRAFT_COMMAND_ERROR_CODES.removalResolutionNotAllowed,
      "command.resolution.kind",
      `Resolution ${resolution.kind} is not allowed for this removal plan.`
    );
  }
  if (resolution.kind === "remove_only") {
    switch (target.kind) {
      case "objective":
        draft.objectiveIds = draft.objectiveIds.filter(
          (id) => id !== target.objectiveId
        );
        return;
      case "equipment":
        draft.equipment = draft.equipment.filter(
          ({ instanceId }) => instanceId !== target.instanceId
        );
        return;
      case "rule":
        draft.rules = draft.rules.filter(({ id }) => id !== target.ruleId);
        return;
      case "material":
        draft.materials = draft.materials.filter(
          ({ instanceId }) => instanceId !== target.instanceId
        );
        return;
      case "permitted_action":
        draft.permittedActions = draft.permittedActions.filter(
          ({ id }) => id !== target.permissionId
        );
        return;
      case "instruction":
        draft.instructions = draft.instructions.filter(
          ({ id }) => id !== target.instructionId
        );
        return;
      case "rubric_criterion":
        removeCriterionCascade(draft, target.criterionId);
        return;
    }
  }
  if (target.kind === "objective") {
    switch (resolution.kind) {
      case "reassign":
        reassignObjective(
          draft,
          target.objectiveId,
          resolution.replacementObjectiveId,
          registries
        );
        return;
      case "detach":
        detachObjective(draft, target.objectiveId);
        return;
      case "remove_dependents":
        removeObjectiveDependents(draft, target.objectiveId);
        return;
      default:
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.removalResolutionNotAllowed,
          "command.resolution.kind",
          "Objective removal requires an objective resolution."
        );
    }
  }
  if (resolution.kind !== "cascade") {
    fail(
      LAB_DRAFT_COMMAND_ERROR_CODES.removalResolutionNotAllowed,
      "command.resolution.kind",
      "This target requires cascade resolution."
    );
  }
  switch (target.kind) {
    case "equipment":
      removeEquipmentCascade(draft, target.instanceId);
      return;
    case "rule":
      removeRulesCascade(draft, new Set([target.ruleId]));
      return;
    case "material":
      removeMaterialsCascade(draft, new Set([target.instanceId]));
      return;
    case "permitted_action":
      removePermissionsCascade(draft, new Set([target.permissionId]));
      return;
    case "instruction":
      removeInstructionCascade(draft, target.instructionId);
      return;
    case "rubric_criterion":
      removeCriterionCascade(draft, target.criterionId);
      return;
  }
}

function mutateDraft(
  draft: LabWorkflowDraftV2,
  command: LabDraftCommand,
  registries: LabWorkflowV2RegistryContext
): void {
  switch (command.type) {
    case "update_metadata":
      draft.metadata = command.metadata;
      return;
    case "add_equipment": {
      if (
        draft.equipment.some(
          (equipment) => equipment.instanceId === command.equipment.instanceId
        )
      ) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.duplicateId,
          "command.equipment.instanceId",
          `Duplicate equipment instance: ${command.equipment.instanceId}`
        );
      }
      const definition = exactEntry(
        registries.components,
        command.equipment.equipmentDefinitionId,
        "command.equipment.equipmentDefinitionId"
      );
      if (
        definition.performanceTier === "restricted" ||
        definition.visualAdapterDefinitionAvailability !== "verified" ||
        definition.mechanicalAdapterAvailability !== "verified"
      ) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.registryUnavailable,
          "command.equipment.equipmentDefinitionId",
          `Equipment is not available for authoring: ${definition.id}`
        );
      }
      requireEquipmentConfiguration(
        command.equipment.configurationPresetId,
        definition,
        "command.equipment.configurationPresetId",
        registries
      );
      draft.equipment = [...draft.equipment, command.equipment];
      return;
    }
    case "remove_equipment": {
      equipmentAt(draft, command.instanceId, "command.instanceId", registries);
      const dependencies = dependencyPathsForEquipment(
        draft,
        command.instanceId
      );
      if (dependencies.length > 0) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.dependencyExists,
          "command.instanceId",
          `Equipment ${command.instanceId} is still referenced.`,
          dependencies
        );
      }
      draft.equipment = draft.equipment.filter(
        (equipment) => equipment.instanceId !== command.instanceId
      );
      return;
    }
    case "configure_equipment": {
      const { index, definition } = equipmentAt(
        draft,
        command.instanceId,
        "command.instanceId",
        registries
      );
      requireEquipmentConfiguration(
        command.configurationPresetId,
        definition,
        "command.configurationPresetId",
        registries
      );
      draft.equipment = draft.equipment.map((equipment, equipmentIndex) =>
        equipmentIndex === index
          ? {
              ...equipment,
              configurationPresetId: command.configurationPresetId
            }
          : equipment
      );
      return;
    }
    case "bind_material": {
      if (
        draft.materials.some(
          (material) => material.instanceId === command.binding.instanceId
        )
      ) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.duplicateId,
          "command.binding.instanceId",
          `Duplicate material instance: ${command.binding.instanceId}`
        );
      }
      const material = exactEntry(
        registries.materials,
        command.binding.materialProfileId,
        "command.binding.materialProfileId"
      );
      if (
        material.availability !== "verified" ||
        !material.usageModes.includes("material_binding")
      ) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.registryUnavailable,
          "command.binding.materialProfileId",
          `Material is not verified for binding: ${material.id}`
        );
      }
      const container = equipmentAt(
        draft,
        command.binding.containerInstanceId,
        "command.binding.containerInstanceId",
        registries
      ).definition;
      if (
        !materialSupportsContainerCapabilities(
          material,
          container.capabilityIds
        )
      ) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.incompatible,
          "command.binding.containerInstanceId",
          `${material.id} is not compatible with ${container.id}.`
        );
      }
      // A container holds at most one reagent: reject binding a second, different
      // reagent into a container that already holds one. This prevents chemically
      // contradictory setups such as an acid placed into the base's burette.
      if (
        draft.materials.some(
          (existing) =>
            existing.containerInstanceId ===
              command.binding.containerInstanceId &&
            existing.materialProfileId !== command.binding.materialProfileId
        )
      ) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.incompatible,
          "command.binding.containerInstanceId",
          `${command.binding.containerInstanceId} already holds a different reagent.`
        );
      }
      // A reagent lives in at most one container: reject binding the same reagent
      // profile into a second container.
      if (
        draft.materials.some(
          (existing) =>
            existing.materialProfileId === command.binding.materialProfileId &&
            existing.containerInstanceId !== command.binding.containerInstanceId
        )
      ) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.incompatible,
          "command.binding.materialProfileId",
          `${material.id} is already placed in another container.`
        );
      }
      const quantity = exactEntry(
        registries.configurations,
        command.binding.quantityPresetId,
        "command.binding.quantityPresetId"
      );
      if (
        quantity.category !== "quantity_preset" ||
        quantity.availability !== "verified" ||
        !quantity.compatibleMaterialProfileIds.includes(material.id)
      ) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.incompatible,
          "command.binding.quantityPresetId",
          `${command.binding.quantityPresetId} is not compatible with ${material.id}.`
        );
      }
      draft.materials = [...draft.materials, command.binding];
      return;
    }
    case "remove_material_binding": {
      const target = {
        kind: "material" as const,
        instanceId: command.instanceId
      };
      requireRemovalTarget(draft, target, registries);
      const references = referencesForRemoval(draft, target);
      const compatibilityEffects = compatibilityEffectsForRemoval(
        draft,
        target
      );
      if (references.length > 0 || compatibilityEffects.length > 0) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.dependencyExists,
          "command.instanceId",
          `Material ${command.instanceId} is still referenced.`,
          [
            ...references.map(({ path }) => path),
            ...compatibilityEffects.map(({ path }) => path)
          ].sort()
        );
      }
      draft.materials = draft.materials.filter(
        ({ instanceId }) => instanceId !== command.instanceId
      );
      return;
    }
    case "set_material_concentration": {
      if (draft.schemaVersion !== "2.1.0") {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.commandNotApplicable,
          "draft.schemaVersion",
          "Concentration authoring requires the v2.1 draft contract."
        );
      }
      const index = draft.materials.findIndex(
        ({ instanceId }) => instanceId === command.instanceId
      );
      if (index < 0) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.referenceMissing,
          "command.instanceId",
          `Unknown material instance: ${command.instanceId}`
        );
      }
      const binding = draft.materials[index]!;
      const profile = exactEntry(
        registries.materials,
        binding.materialProfileId,
        `materials[${index}].materialProfileId`
      );
      const contract = profile.concentrationAuthoring;
      if (!contract) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.commandNotApplicable,
          "command.instanceId",
          `${profile.id} does not support teacher-authored concentration.`
        );
      }
      const configuration = exactEntry(
        registries.configurations,
        command.initialization.configurationSchemaId,
        "command.initialization.configurationSchemaId"
      );
      if (
        configuration.id !== contract.configurationSchemaId ||
        configuration.category !== "configuration_schema" ||
        configuration.scope !== "material_initialization" ||
        configuration.availability !== "verified" ||
        command.initialization.concentration.unitId !== contract.unitId
      ) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.incompatible,
          "command.initialization",
          "The concentration schema or unit is not supported by this material."
        );
      }
      let canonicalDecimalValue: string;
      try {
        canonicalDecimalValue = canonicalizeBoundedConcentrationDecimal(
          command.initialization.concentration.decimalValue,
          contract
        ).canonicalDecimalValue;
      } catch (error) {
        if (!(error instanceof BoundedConcentrationError)) throw error;
        fail(
          error.code === "bounded_concentration.range" ||
            error.code === "bounded_concentration.precision"
            ? LAB_DRAFT_COMMAND_ERROR_CODES.boundsExceeded
            : LAB_DRAFT_COMMAND_ERROR_CODES.commandInvalid,
          "command.initialization.concentration.decimalValue",
          error.message
        );
      }
      draft.materials = draft.materials.map((material, materialIndex) =>
        materialIndex === index
          ? {
              ...material,
              initialization: {
                kind: "bounded_concentration" as const,
                configurationSchemaId: contract.configurationSchemaId,
                concentration: {
                  decimalValue: canonicalDecimalValue,
                  unitId: contract.unitId
                }
              }
            }
          : material
      );
      if (
        !draft.requiredChemistryCapabilityIds.includes(
          contract.requiredChemistryCapabilityId
        )
      ) {
        draft.requiredChemistryCapabilityIds = [
          ...draft.requiredChemistryCapabilityIds,
          contract.requiredChemistryCapabilityId
        ];
      }
      for (const policyId of contract.safetyPolicyIds) {
        if (!draft.safetyPolicyIds.includes(policyId))
          draft.safetyPolicyIds = [...draft.safetyPolicyIds, policyId];
        const requiredEquipmentIds = draft.equipment
          .filter((equipment) =>
            registries.components
              .get(equipment.equipmentDefinitionId)
              .safetyConstraintIds.includes(policyId)
          )
          .map(({ instanceId }) => instanceId);
        const bindingIndex = draft.safetyBindings.findIndex(
          (safetyBinding) => safetyBinding.safetyPolicyId === policyId
        );
        if (bindingIndex >= 0) {
          draft.safetyBindings = draft.safetyBindings.map(
            (safetyBinding, safetyIndex) =>
              safetyIndex === bindingIndex
                ? {
                    ...safetyBinding,
                    equipmentInstanceIds: [
                      ...new Set([
                        ...safetyBinding.equipmentInstanceIds,
                        ...requiredEquipmentIds
                      ])
                    ],
                    materialInstanceIds: [
                      ...new Set([
                        ...safetyBinding.materialInstanceIds,
                        command.instanceId
                      ])
                    ]
                  }
                : safetyBinding
          );
        } else {
          draft.safetyBindings = [
            ...draft.safetyBindings,
            {
              safetyPolicyId: policyId,
              equipmentInstanceIds: requiredEquipmentIds,
              materialInstanceIds: [command.instanceId]
            }
          ];
        }
      }
      return;
    }
    case "clear_material_concentration": {
      if (draft.schemaVersion !== "2.1.0") {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.commandNotApplicable,
          "draft.schemaVersion",
          "This draft has no authored concentration to clear."
        );
      }
      const index = draft.materials.findIndex(
        ({ instanceId }) => instanceId === command.instanceId
      );
      if (index < 0) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.referenceMissing,
          "command.instanceId",
          `Unknown material instance: ${command.instanceId}`
        );
      }
      const binding = draft.materials[index]!;
      if (!binding.initialization) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.commandNotApplicable,
          "command.instanceId",
          "This material has no authored concentration to clear."
        );
      }
      draft.materials = draft.materials.map((material, materialIndex) => {
        if (materialIndex !== index) return material;
        const { initialization, ...withoutInitialization } = material;
        void initialization;
        return withoutInitialization;
      });
      return;
    }
    case "set_layout": {
      const schema = exactEntry(
        registries.configurations,
        command.layout.configurationSchemaId,
        "command.layout.configurationSchemaId"
      );
      if (
        schema.category !== "configuration_schema" ||
        schema.scope !== "layout" ||
        schema.availability === "restricted"
      ) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.incompatible,
          "command.layout.configurationSchemaId",
          "Layout schema is not available for physical layout authoring."
        );
      }
      const seen = new Set<string>();
      command.layout.placements.forEach((placement, index) => {
        if (seen.has(placement.equipmentInstanceId)) {
          fail(
            LAB_DRAFT_COMMAND_ERROR_CODES.duplicateId,
            `command.layout.placements[${index}].equipmentInstanceId`,
            `Duplicate placement for ${placement.equipmentInstanceId}.`
          );
        }
        seen.add(placement.equipmentInstanceId);
        const equipment = equipmentAt(
          draft,
          placement.equipmentInstanceId,
          `command.layout.placements[${index}].equipmentInstanceId`,
          registries
        ).definition;
        const slot = exactEntry(
          registries.configurations,
          placement.placementSlotId,
          `command.layout.placements[${index}].placementSlotId`
        );
        if (
          slot.category !== "placement" ||
          slot.availability !== "verified" ||
          !slot.compatibleComponentIds.includes(equipment.id)
        ) {
          fail(
            LAB_DRAFT_COMMAND_ERROR_CODES.incompatible,
            `command.layout.placements[${index}].placementSlotId`,
            `${placement.placementSlotId} is not compatible with ${equipment.id}.`
          );
        }
      });
      draft.layout = command.layout;
      return;
    }
    case "permit_action": {
      if (
        draft.permittedActions.some((action) => action.id === command.action.id)
      ) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.duplicateId,
          "command.action.id",
          `Duplicate permitted action: ${command.action.id}`
        );
      }
      validateActionConnection(
        draft,
        command.action.actionId,
        command.action.sourceEquipmentInstanceId,
        command.action.targetEquipmentInstanceIds,
        "command.action",
        registries
      );
      for (const [key, ruleIds] of Object.entries(
        command.action.availability
      )) {
        ruleIds.forEach((ruleId, index) =>
          requireRuleReference(
            draft,
            ruleId,
            `command.action.availability.${key}[${index}]`
          )
        );
      }
      if (command.action.parameterPresetId) {
        const preset = exactEntry(
          registries.configurations,
          command.action.parameterPresetId,
          "command.action.parameterPresetId"
        );
        if (
          preset.category !== "action_parameters" ||
          preset.availability !== "verified" ||
          !preset.compatibleActionIds.includes(command.action.actionId)
        ) {
          fail(
            LAB_DRAFT_COMMAND_ERROR_CODES.incompatible,
            "command.action.parameterPresetId",
            `Parameter preset is not compatible with ${command.action.actionId}.`
          );
        }
      }
      draft.permittedActions = [...draft.permittedActions, command.action];
      return;
    }
    case "remove_permitted_action": {
      const target = {
        kind: "permitted_action" as const,
        permissionId: command.permissionId
      };
      requireRemovalTarget(draft, target, registries);
      const references = referencesForRemoval(draft, target);
      if (references.length > 0) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.dependencyExists,
          "command.permissionId",
          `Permitted action ${command.permissionId} is still referenced.`,
          references.map(({ path }) => path)
        );
      }
      draft.permittedActions = draft.permittedActions.filter(
        ({ id }) => id !== command.permissionId
      );
      return;
    }
    case "add_rule":
      addRule(draft, command.rule, "command.rule", registries);
      return;
    case "remove_rule":
      removeRule(draft, command.ruleId, "command.ruleId");
      return;
    case "replace_rule": {
      const index = draft.rules.findIndex(({ id }) => id === command.ruleId);
      if (index < 0) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.referenceMissing,
          "command.ruleId",
          `Unknown workflow rule: ${command.ruleId}`
        );
      }
      if (command.rule.id !== command.ruleId) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.commandNotApplicable,
          "command.rule.id",
          "Replacing a rule cannot change its ID."
        );
      }
      requireSelectedObjectives(
        draft,
        command.rule.objectiveIds,
        "command.rule.objectiveIds",
        registries
      );
      validateCondition(
        draft,
        command.rule.condition,
        "command.rule.condition",
        registries
      );
      const rules = draft.rules.map((rule, ruleIndex) =>
        ruleIndex === index ? command.rule : rule
      );
      if (introducesOrderingCycle(rules)) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.orderingCycle,
          "command.rule.condition",
          "Replacement would create an ordering cycle."
        );
      }
      draft.rules = rules;
      return;
    }
    case "add_condition": {
      const index = draft.rules.findIndex((rule) => rule.id === command.ruleId);
      if (index < 0) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.referenceMissing,
          "command.ruleId",
          `Unknown workflow rule: ${command.ruleId}`
        );
      }
      validateCondition(
        draft,
        command.condition,
        "command.condition",
        registries
      );
      const nextRules = draft.rules.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, condition: command.condition } : rule
      );
      if (introducesOrderingCycle(nextRules)) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.orderingCycle,
          "command.condition",
          "Condition would create an ordering cycle."
        );
      }
      draft.rules = nextRules;
      return;
    }
    case "remove_condition": {
      const rule = requireRuleReference(
        draft,
        command.ruleId,
        "command.ruleId"
      );
      if (rule.kind === "ordering") {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.commandNotApplicable,
          "command.ruleId",
          "Use remove_ordering_dependency for an ordering rule."
        );
      }
      removeRule(draft, command.ruleId, "command.ruleId");
      return;
    }
    case "add_ordering_dependency":
      if (command.predecessorRuleId === command.successorRuleId) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.orderingCycle,
          "command.successorRuleId",
          "A rule cannot depend on itself."
        );
      }
      if (
        draft.rules.some(
          (rule) =>
            rule.condition.kind === "rule_satisfied_before" &&
            rule.condition.predecessorRuleId === command.predecessorRuleId &&
            rule.condition.successorRuleId === command.successorRuleId
        )
      ) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.dependencyExists,
          "command.successorRuleId",
          "That ordering dependency already exists."
        );
      }
      addRule(
        draft,
        {
          id: command.ruleId,
          kind: "ordering",
          condition: {
            kind: "rule_satisfied_before",
            predecessorRuleId: command.predecessorRuleId,
            successorRuleId: command.successorRuleId
          },
          severity: command.severity,
          recoverable: command.recoverable,
          terminal: false,
          objectiveIds: command.objectiveIds
        },
        "command",
        registries
      );
      return;
    case "remove_ordering_dependency": {
      const rule = requireRuleReference(
        draft,
        command.ruleId,
        "command.ruleId"
      );
      if (rule.kind !== "ordering") {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.commandNotApplicable,
          "command.ruleId",
          `${command.ruleId} is not an ordering dependency.`
        );
      }
      removeRule(draft, command.ruleId, "command.ruleId");
      return;
    }
    case "add_instruction":
      if (
        draft.instructions.some(
          (instruction) => instruction.id === command.instruction.id
        )
      ) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.duplicateId,
          "command.instruction.id",
          `Duplicate instruction: ${command.instruction.id}`
        );
      }
      command.instruction.relatedRuleIds.forEach((ruleId, index) =>
        requireRuleReference(
          draft,
          ruleId,
          `command.instruction.relatedRuleIds[${index}]`
        )
      );
      draft.instructions = [...draft.instructions, command.instruction];
      return;
    case "remove_instruction":
      if (
        !draft.instructions.some(
          (instruction) => instruction.id === command.instructionId
        )
      ) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.referenceMissing,
          "command.instructionId",
          `Unknown instruction: ${command.instructionId}`
        );
      }
      {
        const target = {
          kind: "instruction" as const,
          instructionId: command.instructionId
        };
        const references = referencesForRemoval(draft, target);
        if (references.length > 0) {
          fail(
            LAB_DRAFT_COMMAND_ERROR_CODES.dependencyExists,
            "command.instructionId",
            `Instruction ${command.instructionId} is still referenced.`,
            references.map(({ path }) => path)
          );
        }
      }
      draft.instructions = draft.instructions.filter(
        (instruction) => instruction.id !== command.instructionId
      );
      return;
    case "replace_instruction": {
      const index = draft.instructions.findIndex(
        ({ id }) => id === command.instructionId
      );
      if (index < 0) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.referenceMissing,
          "command.instructionId",
          `Unknown instruction: ${command.instructionId}`
        );
      }
      if (command.instruction.id !== command.instructionId) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.commandNotApplicable,
          "command.instruction.id",
          "Replacing an instruction cannot change its ID."
        );
      }
      command.instruction.relatedRuleIds.forEach((ruleId, ruleIndex) =>
        requireRuleReference(
          draft,
          ruleId,
          `command.instruction.relatedRuleIds[${ruleIndex}]`
        )
      );
      draft.instructions = draft.instructions.map(
        (instruction, instructionIndex) =>
          instructionIndex === index ? command.instruction : instruction
      );
      return;
    }
    case "add_objective":
      requireObjective(
        draft,
        command.objectiveId,
        "command.objectiveId",
        registries
      );
      if (draft.objectiveIds.includes(command.objectiveId)) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.duplicateId,
          "command.objectiveId",
          `Objective is already selected: ${command.objectiveId}`
        );
      }
      draft.objectiveIds = [...draft.objectiveIds, command.objectiveId];
      return;
    case "remove_objective": {
      if (!draft.objectiveIds.includes(command.objectiveId)) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.referenceMissing,
          "command.objectiveId",
          `Objective is not selected: ${command.objectiveId}`
        );
      }
      const dependencies = dependencyPathsForObjective(
        draft,
        command.objectiveId
      );
      if (dependencies.length > 0) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.dependencyExists,
          "command.objectiveId",
          `Objective ${command.objectiveId} is still referenced.`,
          dependencies
        );
      }
      draft.objectiveIds = draft.objectiveIds.filter(
        (objectiveId) => objectiveId !== command.objectiveId
      );
      return;
    }
    case "add_rubric_criterion":
      if (
        draft.rubric.criteria.some(
          (criterion) => criterion.id === command.criterion.id
        )
      ) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.duplicateId,
          "command.criterion.id",
          `Duplicate rubric criterion: ${command.criterion.id}`
        );
      }
      requireSelectedObjectives(
        draft,
        command.criterion.objectiveIds,
        "command.criterion.objectiveIds",
        registries
      );
      command.criterion.ruleIds.forEach((ruleId, index) =>
        requireRuleReference(
          draft,
          ruleId,
          `command.criterion.ruleIds[${index}]`
        )
      );
      draft.rubric = {
        ...draft.rubric,
        criteria: [...draft.rubric.criteria, command.criterion],
        totalPoints: draft.rubric.totalPoints + command.criterion.maxPoints
      };
      return;
    case "remove_rubric_criterion": {
      const criterion = draft.rubric.criteria.find(
        (candidate) => candidate.id === command.criterionId
      );
      if (!criterion) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.referenceMissing,
          "command.criterionId",
          `Unknown rubric criterion: ${command.criterionId}`
        );
      }
      draft.rubric = {
        ...draft.rubric,
        criteria: draft.rubric.criteria.filter(
          (candidate) => candidate.id !== command.criterionId
        ),
        totalPoints: draft.rubric.totalPoints - criterion.maxPoints
      };
      return;
    }
    case "replace_rubric_criterion": {
      const index = draft.rubric.criteria.findIndex(
        ({ id }) => id === command.criterionId
      );
      if (index < 0) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.referenceMissing,
          "command.criterionId",
          `Unknown rubric criterion: ${command.criterionId}`
        );
      }
      if (command.criterion.id !== command.criterionId) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.commandNotApplicable,
          "command.criterion.id",
          "Replacing a rubric criterion cannot change its ID."
        );
      }
      requireSelectedObjectives(
        draft,
        command.criterion.objectiveIds,
        "command.criterion.objectiveIds",
        registries
      );
      command.criterion.ruleIds.forEach((ruleId, ruleIndex) =>
        requireRuleReference(
          draft,
          ruleId,
          `command.criterion.ruleIds[${ruleIndex}]`
        )
      );
      draft.rubric = {
        ...draft.rubric,
        criteria: draft.rubric.criteria.map((criterion, criterionIndex) =>
          criterionIndex === index ? command.criterion : criterion
        )
      };
      recalculateRubricTotal(draft);
      return;
    }
    case "apply_removal": {
      const currentHash = hashLabWorkflowSpec(draft);
      if (
        command.plan.sourceRevision !== draft.revision ||
        command.plan.sourceDraftHash !== currentHash
      ) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.removalPlanStale,
          "command.plan",
          "Removal plan does not match the current draft revision and hash."
        );
      }
      const impact = inspectRemovalOrFail(
        draft,
        command.plan.target,
        registries
      );
      if (
        impact.compatibilityEffects.length > 0 &&
        !command.confirmCompatibilityEffects
      ) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.removalConfirmationRequired,
          "command.confirmCompatibilityEffects",
          "Compatibility effects require explicit confirmation.",
          impact.compatibilityEffects.map(({ path }) => path)
        );
      }
      if (
        impact.references.length > 0 &&
        (command.resolution.kind === "cascade" ||
          command.resolution.kind === "remove_dependents") &&
        !command.confirmDependentContentRemoval
      ) {
        fail(
          LAB_DRAFT_COMMAND_ERROR_CODES.removalConfirmationRequired,
          "command.confirmDependentContentRemoval",
          "Dependent-content removal requires explicit confirmation.",
          impact.references.map(({ path }) => path)
        );
      }
      applyRemovalResolution(
        draft,
        command.plan.target,
        command.resolution,
        impact,
        registries
      );
      return;
    }
    default: {
      const exhaustive: never = command;
      return exhaustive;
    }
  }
}

function prepareTransactionDraft(input: LabWorkflowSpecV2): LabWorkflowDraftV2 {
  const { supportStatus, validation, judgeCritique, ...authored } =
    structuredClone(input);
  void supportStatus;
  void validation;
  void judgeCritique;
  return labWorkflowDraftV2Schema.parse({
    ...authored,
    revision: input.revision,
    supportStatus: "draft_unvalidated",
    validation: null,
    judgeCritique: null
  });
}

function transactionFailure(
  failingCommandIndex: number | null,
  code: LabDraftCommandErrorCode,
  path: string,
  message: string,
  dependencyPaths: readonly string[] = []
): Readonly<LabDraftTransactionResult> {
  return deepFreeze({
    ok: false as const,
    failingCommandIndex,
    error: { code, path, message, dependencyPaths: [...dependencyPaths] }
  });
}

export function applyLabDraftTransaction(
  input: unknown,
  commandInputs: readonly unknown[],
  expectedRevision: number,
  registries: LabWorkflowV2RegistryContext = PRODUCTION_LAB_WORKFLOW_V2_REGISTRIES
): Readonly<LabDraftTransactionResult> {
  const parsedDraft = labWorkflowSpecV2Schema.safeParse(input);
  if (!parsedDraft.success) {
    return transactionFailure(
      null,
      LAB_DRAFT_COMMAND_ERROR_CODES.draftInvalid,
      firstZodPath(parsedDraft.error),
      parsedDraft.error.issues[0]?.message ?? "Draft is invalid."
    );
  }
  if (parsedDraft.data.revision !== expectedRevision) {
    return transactionFailure(
      null,
      LAB_DRAFT_COMMAND_ERROR_CODES.revisionConflict,
      "expectedRevision",
      `Expected revision ${expectedRevision}, but the current revision is ${parsedDraft.data.revision}.`
    );
  }
  if (
    !Array.isArray(commandInputs) ||
    commandInputs.length === 0 ||
    commandInputs.length > 64
  ) {
    return transactionFailure(
      null,
      LAB_DRAFT_COMMAND_ERROR_CODES.commandInvalid,
      "commands",
      "A transaction requires between 1 and 64 commands."
    );
  }
  if (parsedDraft.data.revision >= 1_000_000) {
    return transactionFailure(
      null,
      LAB_DRAFT_COMMAND_ERROR_CODES.boundsExceeded,
      "draft.revision",
      "Draft revision cannot be incremented beyond 1000000."
    );
  }
  const commands: LabDraftCommand[] = [];
  for (let index = 0; index < commandInputs.length; index += 1) {
    const parsedCommand = labDraftCommandSchema.safeParse(commandInputs[index]);
    if (!parsedCommand.success) {
      return transactionFailure(
        index,
        LAB_DRAFT_COMMAND_ERROR_CODES.commandInvalid,
        firstZodPath(parsedCommand.error),
        parsedCommand.error.issues[0]?.message ?? "Command is invalid."
      );
    }
    commands.push(parsedCommand.data);
  }

  let draft = prepareTransactionDraft(parsedDraft.data);
  for (let index = 0; index < commands.length; index += 1) {
    try {
      if (
        commands[index]!.type === "set_material_concentration" &&
        draft.schemaVersion === "2.0.0"
      ) {
        draft = migrateLabWorkflowV2_0ToV2_1(draft);
      }
      mutateDraft(draft, commands[index]!, registries);
    } catch (error) {
      if (error instanceof CommandFailure) {
        return transactionFailure(
          index,
          error.code,
          error.path,
          error.message,
          error.dependencyPaths
        );
      }
      throw error;
    }
  }
  draft.revision = parsedDraft.data.revision + 1;
  const finalDraft = labWorkflowDraftV2Schema.safeParse(draft);
  if (!finalDraft.success) {
    return transactionFailure(
      commands.length - 1,
      LAB_DRAFT_COMMAND_ERROR_CODES.draftInvalid,
      firstZodPath(finalDraft.error),
      finalDraft.error.issues[0]?.message ??
        "Transaction did not produce a strict draft."
    );
  }
  const frozenDraft = deepFreeze(finalDraft.data);
  return deepFreeze({
    ok: true as const,
    draft: frozenDraft,
    edit: {
      commandTypes: commands.map(({ type }) => type),
      commandCount: commands.length,
      revisionBefore: parsedDraft.data.revision,
      revisionAfter: frozenDraft.revision,
      validationInvalidated: true as const,
      judgeCritiqueInvalidated: true as const
    }
  });
}

export function applyLabDraftCommand(
  input: unknown,
  commandInput: unknown,
  registries: LabWorkflowV2RegistryContext = PRODUCTION_LAB_WORKFLOW_V2_REGISTRIES
): Readonly<LabDraftCommandResult> {
  const revision =
    typeof input === "object" &&
    input !== null &&
    "revision" in input &&
    typeof input.revision === "number"
      ? input.revision
      : 0;
  const transaction = applyLabDraftTransaction(
    input,
    [commandInput],
    revision,
    registries
  );
  if (!transaction.ok) {
    return deepFreeze({ ok: false as const, error: transaction.error });
  }
  const commandType = transaction.edit.commandTypes[0]!;
  return deepFreeze({
    ok: true as const,
    draft: transaction.draft,
    edit: {
      commandType,
      revisionBefore: transaction.edit.revisionBefore,
      revisionAfter: transaction.edit.revisionAfter,
      validationInvalidated: true as const,
      judgeCritiqueInvalidated: true as const
    }
  });
}

export function inspectLabDraftRemoval(
  input: unknown,
  targetInput: unknown,
  registries: LabWorkflowV2RegistryContext = PRODUCTION_LAB_WORKFLOW_V2_REGISTRIES
): Readonly<LabDraftRemovalInspectionResult> {
  const parsedDraft = labWorkflowSpecV2Schema.safeParse(input);
  if (!parsedDraft.success) {
    return deepFreeze({
      ok: false as const,
      error: {
        code: LAB_DRAFT_COMMAND_ERROR_CODES.draftInvalid,
        path: firstZodPath(parsedDraft.error),
        message: parsedDraft.error.issues[0]?.message ?? "Draft is invalid.",
        dependencyPaths: []
      }
    });
  }
  const parsedTarget = labDraftRemovalTargetSchema.safeParse(targetInput);
  if (!parsedTarget.success) {
    return deepFreeze({
      ok: false as const,
      error: {
        code: LAB_DRAFT_COMMAND_ERROR_CODES.commandInvalid,
        path: firstZodPath(parsedTarget.error),
        message:
          parsedTarget.error.issues[0]?.message ?? "Removal target is invalid.",
        dependencyPaths: []
      }
    });
  }
  try {
    const draft = prepareTransactionDraft(parsedDraft.data);
    return deepFreeze({
      ok: true as const,
      impact: inspectRemovalOrFail(draft, parsedTarget.data, registries)
    });
  } catch (error) {
    if (error instanceof CommandFailure) {
      return deepFreeze({
        ok: false as const,
        error: {
          code: error.code,
          path: error.path,
          message: error.message,
          dependencyPaths: [...error.dependencyPaths]
        }
      });
    }
    throw error;
  }
}
