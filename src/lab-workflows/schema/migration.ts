import { hashLabWorkflowSpec } from "../hash";
import { actionRegistry } from "../registries/actions";
import { componentRegistry } from "../registries/components";
import { configurationRegistry } from "../registries/configurations";
import { engineRegistry } from "../registries/engines";
import {
  eventFlagRegistry,
  eventTypeRegistry
} from "../registries/event-flags";
import { materialRegistry } from "../registries/reagents";
import { safetyRegistry } from "../registries/safety";
import { skillRegistry } from "../registries/skills";
import { labWorkflowSpecV1Schema, type LabWorkflowSpecV1 } from "../schema";
import { labWorkflowDraftV2Schema, type LabWorkflowDraftV2 } from "./v2";
import type {
  RubricEvidenceMapping,
  WorkflowCondition,
  WorkflowRule
} from "./conditions";

export const LAB_WORKFLOW_V1_TO_V2_MIGRATION_VERSION = "1.0.0" as const;

export const LAB_WORKFLOW_MIGRATION_ERROR_CODES = Object.freeze([
  "migration.invalid_v1",
  "migration.mapping_missing",
  "migration.mapping_ambiguous",
  "migration.unsupported_semantic",
  "migration.output_invalid"
] as const);

export type LabWorkflowMigrationErrorCode =
  (typeof LAB_WORKFLOW_MIGRATION_ERROR_CODES)[number];

export class LabWorkflowMigrationError extends Error {
  readonly code: LabWorkflowMigrationErrorCode;
  readonly path: string;
  readonly registryId?: string;

  constructor(
    code: LabWorkflowMigrationErrorCode,
    path: string,
    message: string,
    registryId?: string
  ) {
    super(`${message} (${path})`);
    this.name = "LabWorkflowMigrationError";
    this.code = code;
    this.path = path;
    this.registryId = registryId;
  }
}

const LEGACY_ENGINE_MAPPINGS = Object.freeze({
  "engine.titration.v1": Object.freeze({
    familyId: "family.acid_base_titration.v1",
    runtimeAdapterId: "runtime-adapter.titration.v1",
    runtimeAdapterVersion: "1.0.0",
    layoutConfigurationSchemaId:
      "schema.layout_configuration.titration_bench.v1",
    requiredChemistryCapabilityIds: Object.freeze([
      "chemistry.material_ledger.v1",
      "chemistry.volume_conservation.v1",
      "chemistry.solution_mixing.v1",
      "chemistry.acid_base_equilibrium.v1",
      "chemistry.indicator_response.v1",
      "chemistry.instrument_observables.v1"
    ] as const)
  })
});

const SOURCE_REGISTRY_SNAPSHOT_IDS = Object.freeze({
  capabilities: "capabilities.1.1.0",
  actions: "actions.2.0.0",
  chemistryModels: "chemistry-models.1.1.0",
  components: "components.2.1.0",
  configurations: "configurations.2.3.0",
  engines: "engines.1.1.0",
  eventFlags: "event-flags.1.0.0",
  eventTypes: "event-types.1.0.0",
  reagents: "reagents.2.2.0",
  safety: "safety.1.0.0",
  skills: "skills.1.0.0"
});

function fail(
  code: LabWorkflowMigrationErrorCode,
  path: string,
  message: string,
  registryId?: string
): never {
  throw new LabWorkflowMigrationError(code, path, message, registryId);
}

function requireRegistryEntry<
  T extends { has(id: string): boolean; get(id: string): unknown }
>(registry: T, id: string, path: string): ReturnType<T["get"]> {
  if (!registry.has(id)) {
    fail(
      "migration.mapping_missing",
      path,
      `No exact registered migration mapping exists for ${id}`,
      id
    );
  }
  return registry.get(id) as ReturnType<T["get"]>;
}

function requireConfiguration(id: string, category: string, path: string) {
  const entry = requireRegistryEntry(configurationRegistry, id, path);
  if (entry.category !== category) {
    fail(
      "migration.mapping_missing",
      path,
      `Expected ${id} to resolve as ${category}, received ${entry.category}`,
      id
    );
  }
  return entry;
}

function migrateObjectiveId(id: string, path: string): string {
  const resolution = skillRegistry.resolve(id);
  if (resolution.status !== "resolved") {
    fail(
      "migration.mapping_missing",
      path,
      `No exact learning-objective mapping exists for ${id}`,
      id
    );
  }
  return resolution.canonicalId;
}

function migrateObjectiveIds(ids: readonly string[], path: string): string[] {
  return ids.map((id, index) => migrateObjectiveId(id, `${path}[${index}]`));
}

function requireRuleObjectives(ids: readonly string[], path: string): string[] {
  const objectiveIds = migrateObjectiveIds(ids, path);
  if (objectiveIds.length === 0) {
    fail(
      "migration.unsupported_semantic",
      path,
      "Executable migrated rules require at least one objective"
    );
  }
  return objectiveIds;
}

function quantityPresetFor(
  reagent: LabWorkflowSpecV1["reagents"][number],
  path: string
): string {
  const material = requireRegistryEntry(
    materialRegistry,
    reagent.reagentId,
    `${path}.reagentId`
  );
  const matches = material.quantityPresetIds.filter((presetId) => {
    const preset = requireRegistryEntry(
      configurationRegistry,
      presetId,
      `${path}.requestedAmount`
    );
    return (
      preset.category === "quantity_preset" &&
      preset.amount === reagent.requestedAmount &&
      preset.unitId === reagent.amountUnitId
    );
  });
  if (matches.length === 0) {
    fail(
      "migration.mapping_missing",
      `${path}.requestedAmount`,
      `No exact quantity preset maps ${reagent.requestedAmount} ${reagent.amountUnitId} for ${reagent.reagentId}`,
      reagent.reagentId
    );
  }
  if (matches.length > 1) {
    fail(
      "migration.mapping_ambiguous",
      `${path}.requestedAmount`,
      `Multiple exact quantity presets map ${reagent.reagentId}`,
      reagent.reagentId
    );
  }
  return matches[0]!;
}

function observationCondition(
  observation: LabWorkflowSpecV1["steps"][number]["expectedObservations"][number],
  path: string
): WorkflowCondition {
  requireRegistryEntry(
    eventTypeRegistry,
    observation.eventTypeId,
    `${path}.eventTypeId`
  );
  switch (observation.expectation) {
    case "event_present":
      if (
        observation.flagId !== undefined ||
        observation.observationKeyId !== undefined ||
        observation.expectedValueSourceId !== undefined
      ) {
        fail(
          "migration.unsupported_semantic",
          path,
          "event_present cannot carry flag, observation-key, or expected-value fields"
        );
      }
      return {
        kind: "semantic_event_observed",
        eventTypeId: observation.eventTypeId
      };
    case "flag_present":
    case "flag_absent":
      if (
        observation.flagId === undefined ||
        observation.observationKeyId !== undefined ||
        observation.expectedValueSourceId !== undefined
      ) {
        fail(
          "migration.unsupported_semantic",
          path,
          `${observation.expectation} requires only an exact flag reference`
        );
      }
      requireRegistryEntry(
        eventFlagRegistry,
        observation.flagId,
        `${path}.flagId`
      );
      return {
        kind: "event_flag",
        flagId: observation.flagId,
        presence:
          observation.expectation === "flag_present" ? "present" : "absent",
        eventTypeId: observation.eventTypeId
      };
    case "value_recorded":
      if (
        observation.observationKeyId === undefined ||
        observation.flagId !== undefined
      ) {
        fail(
          "migration.unsupported_semantic",
          path,
          "value_recorded requires an observation key and cannot carry a flag"
        );
      }
      requireConfiguration(
        observation.observationKeyId,
        "observation_key",
        `${path}.observationKeyId`
      );
      if (observation.expectedValueSourceId) {
        requireConfiguration(
          observation.expectedValueSourceId,
          "observable",
          `${path}.expectedValueSourceId`
        );
      }
      return {
        kind: "observation_recorded",
        observationKeyId: observation.observationKeyId,
        eventTypeId: observation.eventTypeId,
        ...(observation.expectedValueSourceId === undefined
          ? {}
          : { expectedValueSourceId: observation.expectedValueSourceId })
      };
  }
}

function observationRuleId(
  stepOrder: number,
  observationIndex: number
): string {
  return `migration.rule.s${stepOrder}.o${observationIndex + 1}`;
}

function completionRuleId(stepOrder: number): string {
  return `migration.rule.s${stepOrder}.completion`;
}

function permissionId(stepOrder: number, actionIndex: number): string {
  return `migration.permission.s${stepOrder}.a${actionIndex + 1}`;
}

function rubricEvidenceCondition(
  mapping: RubricEvidenceMapping
): WorkflowCondition {
  switch (mapping.kind) {
    case "semantic_event":
      return {
        kind: "semantic_event_observed",
        eventTypeId: mapping.eventTypeId
      };
    case "semantic_event_observation":
      return {
        kind: "observation_recorded",
        observationKeyId: mapping.observationKeyId,
        ...(mapping.eventTypeId === undefined
          ? {}
          : { eventTypeId: mapping.eventTypeId })
      };
    case "student_response":
      return {
        kind: "student_response_submitted",
        submissionFieldId: mapping.submissionFieldId
      };
    case "observable":
      fail(
        "migration.unsupported_semantic",
        "rubric",
        `V1 rubric evidence cannot invent a numeric tolerance for ${mapping.observableId}`,
        mapping.observableId
      );
    case "rule_diagnosis":
      fail(
        "migration.unsupported_semantic",
        "rubric",
        `V1 rubric evidence cannot invent a diagnosis mapping for ${mapping.ruleId}`,
        mapping.ruleId
      );
  }
}

function parseV1(input: unknown): LabWorkflowSpecV1 {
  const parsed = labWorkflowSpecV1Schema.safeParse(input);
  if (parsed.success) return parsed.data;
  const first = parsed.error.issues[0];
  fail(
    "migration.invalid_v1",
    first ? first.path.join(".") || "$" : "$",
    first?.message ?? "Input is not a strict LabWorkflowSpec v1"
  );
}

/**
 * Pure deterministic migration. It resolves only exact code-owned mappings and
 * always returns an unvalidated v2 draft with no trusted artifacts.
 */
export function migrateLabWorkflowV1ToV2(input: unknown): LabWorkflowDraftV2 {
  const source = parseV1(input);
  const engine = requireRegistryEntry(
    engineRegistry,
    source.engineId,
    "engineId"
  );
  const engineMapping =
    LEGACY_ENGINE_MAPPINGS[
      source.engineId as keyof typeof LEGACY_ENGINE_MAPPINGS
    ];
  if (!engineMapping || engine.familyId !== source.familyId) {
    fail(
      "migration.mapping_missing",
      "engineId",
      `No exact legacy engine/family mapping exists for ${source.engineId}`,
      source.engineId
    );
  }
  requireConfiguration(
    source.engineConfigId,
    "engine_configuration",
    "engineConfigId"
  );
  requireConfiguration(
    source.initializationPresetId,
    "seed_template",
    "initializationPresetId"
  );

  const sortedSteps = [...source.steps].sort(
    (left, right) => left.order - right.order
  );
  for (let index = 0; index < sortedSteps.length; index += 1) {
    const step = sortedSteps[index]!;
    if (step.optional) {
      fail(
        "migration.unsupported_semantic",
        `steps[${source.steps.indexOf(step)}].optional`,
        "The v1 runtime has no characterized optional-step skip behavior"
      );
    }
    if (index > 0 && sortedSteps[index - 1]!.order === step.order) {
      fail(
        "migration.unsupported_semantic",
        `steps[${source.steps.indexOf(step)}].order`,
        `Duplicate ordered step value ${step.order}`
      );
    }
  }

  const rules: WorkflowRule[] = [];
  const completionRuleIds = new Map<string, string>();
  const observationRuleIds = new Map<string, string[]>();
  const stepObjectiveIds = new Map<string, string[]>();

  for (const step of sortedSteps) {
    const sourceStepIndex = source.steps.indexOf(step);
    const path = `steps[${sourceStepIndex}]`;
    const objectiveIds = requireRuleObjectives(
      step.skillIds,
      `${path}.skillIds`
    );
    stepObjectiveIds.set(step.id, objectiveIds);
    const expectedRuleIds: string[] = [];
    const requiredEvidenceRuleIds: string[] = [];

    step.expectedObservations.forEach((observation, observationIndex) => {
      const ruleId = observationRuleId(step.order, observationIndex);
      expectedRuleIds.push(ruleId);
      if (observation.requiredForCompletion)
        requiredEvidenceRuleIds.push(ruleId);
      rules.push({
        id: ruleId,
        kind: observation.requiredForCompletion ? "required" : "best_practice",
        condition: observationCondition(
          observation,
          `${path}.expectedObservations[${observationIndex}]`
        ),
        severity: observation.requiredForCompletion
          ? "procedural"
          : "best-practice",
        recoverable: true,
        terminal: false,
        objectiveIds
      });
    });
    observationRuleIds.set(step.id, expectedRuleIds);

    requireConfiguration(
      step.completionPolicyId,
      "completion_policy",
      `${path}.completionPolicyId`
    );
    if (requiredEvidenceRuleIds.length === 0) {
      fail(
        "migration.unsupported_semantic",
        `${path}.expectedObservations`,
        "A migrated completion policy requires at least one required evidence rule"
      );
    }
    const stepCompletionRuleId = completionRuleId(step.order);
    completionRuleIds.set(step.id, stepCompletionRuleId);
    rules.push({
      id: stepCompletionRuleId,
      kind: step === sortedSteps.at(-1) ? "success" : "required",
      condition: {
        kind: "registered_completion_policy_satisfied",
        completionPolicyId: step.completionPolicyId,
        evidenceRuleIds: requiredEvidenceRuleIds
      },
      severity: "procedural",
      recoverable: true,
      terminal: false,
      objectiveIds
    });
  }

  for (let index = 1; index < sortedSteps.length; index += 1) {
    const previous = sortedSteps[index - 1]!;
    const current = sortedSteps[index]!;
    rules.push({
      id: `migration.rule.s${previous.order}.before.s${current.order}`,
      kind: "ordering",
      condition: {
        kind: "rule_satisfied_before",
        predecessorRuleId: completionRuleIds.get(previous.id)!,
        successorRuleId: completionRuleIds.get(current.id)!
      },
      severity: "procedural",
      recoverable: true,
      terminal: false,
      objectiveIds: stepObjectiveIds.get(current.id)!
    });
  }

  const permittedActions = sortedSteps.flatMap((step, stepIndex) => {
    const sourceStepIndex = source.steps.indexOf(step);
    return step.allowedActions.map((action, actionIndex) => {
      requireRegistryEntry(
        actionRegistry,
        action.actionId,
        `steps[${sourceStepIndex}].allowedActions[${actionIndex}].actionId`
      );
      requireConfiguration(
        action.parameterPresetId,
        "action_parameters",
        `steps[${sourceStepIndex}].allowedActions[${actionIndex}].parameterPresetId`
      );
      return {
        id: permissionId(step.order, actionIndex),
        actionId: action.actionId,
        sourceEquipmentInstanceId: action.actorComponentInstanceId,
        targetEquipmentInstanceIds: [...action.targetComponentInstanceIds],
        parameterPresetId: action.parameterPresetId,
        ...(action.authoredLimits === undefined
          ? {}
          : { authoredLimits: action.authoredLimits }),
        ...(action.maxAttempts === undefined
          ? {}
          : { maxAttempts: action.maxAttempts }),
        availability: {
          allSatisfiedRuleIds:
            stepIndex === 0
              ? []
              : [completionRuleIds.get(sortedSteps[stepIndex - 1]!.id)!],
          allUnsatisfiedRuleIds: [completionRuleIds.get(step.id)!]
        }
      };
    });
  });

  const rubricCriteria = source.rubric.criteria.map((criterion, index) => {
    const objectiveIds = requireRuleObjectives(
      criterion.skillIds,
      `rubric.criteria[${index}].skillIds`
    );
    requireConfiguration(
      criterion.assessmentModeId,
      "assessment_mode",
      `rubric.criteria[${index}].assessmentModeId`
    );
    const evidenceMappings: RubricEvidenceMapping[] = [];
    criterion.requiredEventTypeIds.forEach((eventTypeId, evidenceIndex) => {
      requireRegistryEntry(
        eventTypeRegistry,
        eventTypeId,
        `rubric.criteria[${index}].requiredEventTypeIds[${evidenceIndex}]`
      );
      evidenceMappings.push({
        kind: "semantic_event",
        eventTypeId,
        required: true
      });
    });
    criterion.requiredObservationKeyIds.forEach(
      (observationKeyId, evidenceIndex) => {
        requireConfiguration(
          observationKeyId,
          "observation_key",
          `rubric.criteria[${index}].requiredObservationKeyIds[${evidenceIndex}]`
        );
        evidenceMappings.push({
          kind: "semantic_event_observation",
          observationKeyId,
          required: true
        });
      }
    );
    criterion.studentSubmissionFieldIds.forEach(
      (submissionFieldId, evidenceIndex) => {
        requireConfiguration(
          submissionFieldId,
          "submission_field",
          `rubric.criteria[${index}].studentSubmissionFieldIds[${evidenceIndex}]`
        );
        evidenceMappings.push({
          kind: "student_response",
          submissionFieldId,
          required: true
        });
      }
    );
    if (evidenceMappings.length === 0) {
      fail(
        "migration.unsupported_semantic",
        `rubric.criteria[${index}]`,
        "A migrated rubric criterion requires typed evidence"
      );
    }
    const ruleIds = evidenceMappings.map((mapping, evidenceIndex) => {
      const ruleId = `migration.rule.c${index + 1}.e${evidenceIndex + 1}`;
      rules.push({
        id: ruleId,
        kind: "scoring",
        condition: rubricEvidenceCondition(mapping),
        severity: "info",
        recoverable: true,
        terminal: false,
        objectiveIds
      });
      return ruleId;
    });
    return {
      id: criterion.id,
      objectiveIds,
      ruleIds,
      description: criterion.description,
      maxPoints: criterion.maxPoints,
      assessmentModeId: criterion.assessmentModeId,
      evidenceMappings,
      scoringGuide: [...criterion.scoringGuide]
    };
  });
  requireConfiguration(
    source.rubric.passingPolicyId,
    "passing_policy",
    "rubric.passingPolicyId"
  );

  const equipmentIds = new Set(
    source.components.map(({ instanceId }) => instanceId)
  );
  const materialIds = new Set(
    source.reagents.map(({ instanceId }) => instanceId)
  );

  const draft: LabWorkflowDraftV2 = {
    schemaVersion: "2.0.0",
    id: source.id,
    revision: source.revision,
    sourceRequest: source.sourceRequest,
    metadata: source.metadata,
    catalog: { familyId: source.familyId },
    objectiveIds: migrateObjectiveIds(source.skillIds, "skillIds"),
    equipment: source.components.map((component, index) => {
      requireRegistryEntry(
        componentRegistry,
        component.componentId,
        `components[${index}].componentId`
      );
      requireConfiguration(
        component.configurationPresetId,
        "component_configuration",
        `components[${index}].configurationPresetId`
      );
      const placement = requireConfiguration(
        component.placementSlotId,
        "placement",
        `components[${index}].placementSlotId`
      );
      if (placement.schemaId !== engineMapping.layoutConfigurationSchemaId) {
        fail(
          "migration.mapping_missing",
          `components[${index}].placementSlotId`,
          `${component.placementSlotId} does not map to ${engineMapping.layoutConfigurationSchemaId}`,
          component.placementSlotId
        );
      }
      return {
        instanceId: component.instanceId,
        equipmentDefinitionId: component.componentId,
        configurationPresetId: component.configurationPresetId,
        label: component.label,
        required: component.required
      };
    }),
    materials: source.reagents.map((reagent, index) => ({
      instanceId: reagent.instanceId,
      materialProfileId: reagent.reagentId,
      containerInstanceId: reagent.containerInstanceId,
      quantityPresetId: quantityPresetFor(reagent, `reagents[${index}]`)
    })),
    layout: {
      configurationSchemaId: engineMapping.layoutConfigurationSchemaId,
      placements: source.components.map((component) => ({
        equipmentInstanceId: component.instanceId,
        placementSlotId: component.placementSlotId
      }))
    },
    requiredChemistryCapabilityIds: [
      ...engineMapping.requiredChemistryCapabilityIds
    ],
    permittedActions,
    rules,
    instructions: sortedSteps.map((step) => ({
      id: step.id,
      title: step.title,
      guidance: step.studentInstruction,
      relatedRuleIds: [
        ...(observationRuleIds.get(step.id) ?? []),
        completionRuleIds.get(step.id)!
      ]
    })),
    coachPolicy: {
      triggers: source.coachTriggers.map((trigger, index) => {
        requireConfiguration(
          trigger.triggerTypeId,
          "coach_trigger",
          `coachTriggers[${index}].triggerTypeId`
        );
        requireConfiguration(
          trigger.hintStrategyId,
          "hint_strategy",
          `coachTriggers[${index}].hintStrategyId`
        );
        trigger.eventTypeIds.forEach((id, eventIndex) =>
          requireRegistryEntry(
            eventTypeRegistry,
            id,
            `coachTriggers[${index}].eventTypeIds[${eventIndex}]`
          )
        );
        trigger.flagIds.forEach((id, flagIndex) =>
          requireRegistryEntry(
            eventFlagRegistry,
            id,
            `coachTriggers[${index}].flagIds[${flagIndex}]`
          )
        );
        trigger.staySilentOnEventReasonIds.forEach((id, reasonIndex) =>
          requireConfiguration(
            id,
            "evidence_reason",
            `coachTriggers[${index}].staySilentOnEventReasonIds[${reasonIndex}]`
          )
        );
        return {
          id: trigger.id,
          objectiveIds: [
            migrateObjectiveId(
              trigger.skillId,
              `coachTriggers[${index}].skillId`
            )
          ],
          eventTypeIds: [...trigger.eventTypeIds],
          flagIds: [...trigger.flagIds],
          triggerTypeId: trigger.triggerTypeId,
          hintStrategyId: trigger.hintStrategyId,
          maxHintLevel: trigger.maxHintLevel,
          cooldownEventCount: trigger.cooldownEventCount,
          staySilentOnEventReasonIds: [...trigger.staySilentOnEventReasonIds]
        };
      }),
      adaptiveRetries: source.adaptiveRetries.map((retry, index) => {
        requireConfiguration(
          retry.templateId,
          "retry_template",
          `adaptiveRetries[${index}].templateId`
        );
        requireConfiguration(
          retry.seedTemplateId,
          "seed_template",
          `adaptiveRetries[${index}].seedTemplateId`
        );
        retry.eligibleFlagIds.forEach((id, flagIndex) =>
          requireRegistryEntry(
            eventFlagRegistry,
            id,
            `adaptiveRetries[${index}].eligibleFlagIds[${flagIndex}]`
          )
        );
        retry.successEvidenceReasonIds.forEach((id, reasonIndex) =>
          requireConfiguration(
            id,
            "evidence_reason",
            `adaptiveRetries[${index}].successEvidenceReasonIds[${reasonIndex}]`
          )
        );
        return {
          id: retry.id,
          templateId: retry.templateId,
          targetObjectiveIds: migrateObjectiveIds(
            retry.targetSkillIds,
            `adaptiveRetries[${index}].targetSkillIds`
          ),
          eligibleFlagIds: [...retry.eligibleFlagIds],
          initializationPresetId: retry.seedTemplateId,
          maxMinutes: retry.maxMinutes,
          studentGoal: retry.studentGoal,
          successEvidenceReasonIds: [...retry.successEvidenceReasonIds]
        };
      })
    },
    rubric: {
      id: source.rubric.id,
      version: source.rubric.version,
      title: source.rubric.title,
      criteria: rubricCriteria,
      totalPoints: source.rubric.totalPoints,
      passingPolicyId: source.rubric.passingPolicyId
    },
    safetyPolicyIds: source.safetyConstraints.map(({ id }) => id),
    safetyBindings: source.safetyConstraints.map((constraint, index) => {
      const registered = requireRegistryEntry(
        safetyRegistry,
        constraint.id,
        `safetyConstraints[${index}].id`
      );
      if (
        registered.severity !== constraint.severity ||
        registered.studentFacingText !== constraint.studentFacingText ||
        registered.teacherFacingText !== constraint.teacherFacingText
      ) {
        fail(
          "migration.mapping_missing",
          `safetyConstraints[${index}]`,
          `Authored safety text/severity does not exactly match ${constraint.id}`,
          constraint.id
        );
      }
      const unknownIds = constraint.appliesToInstanceIds.filter(
        (id) => !equipmentIds.has(id) && !materialIds.has(id)
      );
      if (unknownIds.length > 0) {
        fail(
          "migration.mapping_missing",
          `safetyConstraints[${index}].appliesToInstanceIds`,
          `Unknown safety-bound instance ${unknownIds[0]}`,
          unknownIds[0]
        );
      }
      return {
        safetyPolicyId: constraint.id,
        equipmentInstanceIds: constraint.appliesToInstanceIds.filter((id) =>
          equipmentIds.has(id)
        ),
        materialInstanceIds: constraint.appliesToInstanceIds.filter((id) =>
          materialIds.has(id)
        )
      };
    }),
    presentation: {
      instructionGuidance: sortedSteps.map((step) => ({
        instructionId: step.id,
        teacherRationale: step.rationaleForTeacher,
        equipmentInstanceIds: [...step.componentInstanceIds]
      })),
      materialLabels: source.reagents.map((reagent) => ({
        materialInstanceId: reagent.instanceId,
        displayLabel: reagent.displayLabel
      })),
      rulePrompts: sortedSteps.flatMap((step) =>
        step.expectedObservations.map((observation, observationIndex) => ({
          ruleId: observationRuleId(step.order, observationIndex),
          studentPrompt: observation.studentPrompt
        }))
      )
    },
    compatibility: {
      kind: "legacy_v1",
      runtimeAdapterId: engineMapping.runtimeAdapterId,
      runtimeAdapterVersion: engineMapping.runtimeAdapterVersion,
      engineId: source.engineId,
      engineConfigurationPresetId: source.engineConfigId,
      initializationPresetId: source.initializationPresetId,
      equipmentRoleBindings: source.components.map((component) => ({
        equipmentInstanceId: component.instanceId,
        legacyRoleId: component.role
      })),
      materialRoleBindings: source.reagents.map((reagent) => ({
        materialInstanceId: reagent.instanceId,
        legacyRoleId: reagent.role
      }))
    },
    provenance: {
      kind: "migrated_v1",
      sourceSchemaVersion: "1.0.0",
      sourceSpecHash: hashLabWorkflowSpec(source),
      migrationVersion: LAB_WORKFLOW_V1_TO_V2_MIGRATION_VERSION,
      sourceRegistrySnapshotIds: SOURCE_REGISTRY_SNAPSHOT_IDS
    },
    supportStatus: "draft_unvalidated",
    validation: null,
    judgeCritique: null
  };

  const parsed = labWorkflowDraftV2Schema.safeParse(draft);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    fail(
      "migration.output_invalid",
      first ? first.path.join(".") || "$" : "$",
      first?.message ?? "Migrated v2 draft failed structural parsing"
    );
  }
  return parsed.data;
}

export function isLabWorkflowMigrationError(
  error: unknown
): error is LabWorkflowMigrationError {
  return error instanceof LabWorkflowMigrationError;
}
