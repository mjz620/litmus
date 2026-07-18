import type { ZodError } from "zod";

import { materialSupportsContainerCapabilities } from "../registries/reagents";
import type { ComponentRegistryEntry } from "../registries/components";
import {
  labWorkflowDraftV2Schema,
  labWorkflowSpecV2Schema,
  type LabWorkflowDraftV2,
  type LabWorkflowSpecV2
} from "../schema/v2";
import type { WorkflowCondition, WorkflowRule } from "../schema/conditions";
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
  commandNotApplicable: "authoring.command_not_applicable.v1"
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
    if (
      !action.actorComponentIds.includes(source.id) ||
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
      !action.targetComponentIds.includes(target.id) ||
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

function mutateDraft(
  draft: LabWorkflowDraftV2,
  command: LabDraftCommand,
  registries: LabWorkflowV2RegistryContext
): void {
  switch (command.type) {
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
    case "add_rule":
      addRule(draft, command.rule, "command.rule", registries);
      return;
    case "remove_rule":
      removeRule(draft, command.ruleId, "command.ruleId");
      return;
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
      draft.instructions = draft.instructions.filter(
        (instruction) => instruction.id !== command.instructionId
      );
      // Presentation guidance is a subordinate 1:1 record and is explicitly
      // cascaded by this command; workflow rules are never cascaded.
      draft.presentation = {
        ...draft.presentation,
        instructionGuidance: draft.presentation.instructionGuidance.filter(
          (guidance) => guidance.instructionId !== command.instructionId
        )
      };
      return;
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
    default: {
      const exhaustive: never = command;
      return exhaustive;
    }
  }
}

function invalidate(
  input: LabWorkflowSpecV2,
  command: LabDraftCommand,
  registries: LabWorkflowV2RegistryContext
): Readonly<LabWorkflowDraftV2> {
  if (input.revision >= 1_000_000) {
    fail(
      LAB_DRAFT_COMMAND_ERROR_CODES.boundsExceeded,
      "draft.revision",
      "Draft revision cannot be incremented beyond 1000000."
    );
  }
  const { supportStatus, validation, judgeCritique, ...authored } =
    structuredClone(input);
  void supportStatus;
  void validation;
  void judgeCritique;
  const draft = labWorkflowDraftV2Schema.parse({
    ...authored,
    revision: input.revision + 1,
    supportStatus: "draft_unvalidated",
    validation: null,
    judgeCritique: null
  });
  mutateDraft(draft, command, registries);
  return deepFreeze(labWorkflowDraftV2Schema.parse(draft));
}

export function applyLabDraftCommand(
  input: unknown,
  commandInput: unknown,
  registries: LabWorkflowV2RegistryContext = PRODUCTION_LAB_WORKFLOW_V2_REGISTRIES
): Readonly<LabDraftCommandResult> {
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
  const parsedCommand = labDraftCommandSchema.safeParse(commandInput);
  if (!parsedCommand.success) {
    return deepFreeze({
      ok: false as const,
      error: {
        code: LAB_DRAFT_COMMAND_ERROR_CODES.commandInvalid,
        path: firstZodPath(parsedCommand.error),
        message:
          parsedCommand.error.issues[0]?.message ?? "Command is invalid.",
        dependencyPaths: []
      }
    });
  }
  try {
    const draft = invalidate(parsedDraft.data, parsedCommand.data, registries);
    return deepFreeze({
      ok: true as const,
      draft,
      edit: {
        commandType: parsedCommand.data.type,
        revisionBefore: parsedDraft.data.revision,
        revisionAfter: draft.revision,
        validationInvalidated: true as const,
        judgeCritiqueInvalidated: true as const
      }
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
