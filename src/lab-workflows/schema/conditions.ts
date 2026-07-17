import { z } from "zod";

import { EQUIPMENT_CAPABILITY_IDS } from "../capabilities";
import {
  LAB_WORKFLOW_SCHEMA_LIMITS,
  registryIdSchema,
  semanticVersionSchema,
  workflowLocalIdSchema
} from "../schema";

/**
 * Structural bounds for v2 constraint data. Registry resolution and semantic
 * compatibility are deliberately left to the v2 validator.
 */
export const WORKFLOW_CONSTRAINT_SCHEMA_LIMITS = Object.freeze({
  ruleCount: 64,
  instructionCount: LAB_WORKFLOW_SCHEMA_LIMITS.stepCount,
  rubricCriterionCount: LAB_WORKFLOW_SCHEMA_LIMITS.rubricCriterionCount,
  referenceCount: LAB_WORKFLOW_SCHEMA_LIMITS.listItemCount,
  targetInstanceCount: LAB_WORKFLOW_SCHEMA_LIMITS.componentCount,
  evidenceMappingCount: LAB_WORKFLOW_SCHEMA_LIMITS.listItemCount,
  diagnosisCount: LAB_WORKFLOW_SCHEMA_LIMITS.validationIssueCount,
  diagnosisEvidenceCount: LAB_WORKFLOW_SCHEMA_LIMITS.validationIssueCount,
  actionCountMaximum: 1_000,
  observableMagnitudeMaximum: 1_000_000,
  pointsMaximum: 1_000
});

const LIMITS = WORKFLOW_CONSTRAINT_SCHEMA_LIMITS;

const shortTextSchema = z
  .string()
  .min(1)
  .max(LAB_WORKFLOW_SCHEMA_LIMITS.shortTextLength)
  .refine((value) => value.trim().length > 0, "Text cannot be blank");

const longTextSchema = z
  .string()
  .min(1)
  .max(LAB_WORKFLOW_SCHEMA_LIMITS.longTextLength)
  .refine((value) => value.trim().length > 0, "Text cannot be blank");
const evidenceTextSchema = z
  .string()
  .max(LAB_WORKFLOW_SCHEMA_LIMITS.longTextLength);

const referenceListSchema = z
  .array(registryIdSchema)
  .max(LIMITS.referenceCount);
const requiredReferenceListSchema = referenceListSchema.min(1);
const finiteObservableNumberSchema = z
  .number()
  .finite()
  .min(-LIMITS.observableMagnitudeMaximum)
  .max(LIMITS.observableMagnitudeMaximum);

export const WORKFLOW_CONDITION_KINDS = Object.freeze([
  "equipment_state_equals",
  "equipment_capability_present",
  "material_bound_to_container",
  "action_observed",
  "action_count_within_range",
  "semantic_event_observed",
  "observation_recorded",
  "registered_completion_policy_satisfied",
  "observable_within_tolerance",
  "event_flag",
  "rule_satisfied_before",
  "forbidden_state_never_reached",
  "student_response_submitted"
] as const);

/**
 * A deliberately closed JSON-safe value vocabulary. New state/evidence shapes
 * require an explicit reviewed variant instead of arbitrary recursive objects.
 */
export const structuredEvidenceValueSchema = z.discriminatedUnion("valueType", [
  z.strictObject({ valueType: z.literal("null"), value: z.null() }),
  z.strictObject({ valueType: z.literal("boolean"), value: z.boolean() }),
  z.strictObject({
    valueType: z.literal("number"),
    value: finiteObservableNumberSchema,
    unitId: registryIdSchema.optional()
  }),
  z.strictObject({ valueType: z.literal("text"), value: evidenceTextSchema }),
  z.strictObject({
    valueType: z.literal("text_list"),
    value: z.array(evidenceTextSchema).max(LIMITS.referenceCount)
  }),
  z.strictObject({
    valueType: z.literal("identifier"),
    value: registryIdSchema
  }),
  z.strictObject({
    valueType: z.literal("identifier_list"),
    value: referenceListSchema
  })
]);

export const equipmentStateEqualsConditionSchema = z.strictObject({
  kind: z.literal("equipment_state_equals"),
  equipmentInstanceId: workflowLocalIdSchema,
  stateFieldKey: workflowLocalIdSchema,
  expectedValue: structuredEvidenceValueSchema
});

export const equipmentCapabilityPresentConditionSchema = z.strictObject({
  kind: z.literal("equipment_capability_present"),
  equipmentInstanceId: workflowLocalIdSchema,
  capabilityId: z.enum(EQUIPMENT_CAPABILITY_IDS)
});

export const materialBoundToContainerConditionSchema = z.strictObject({
  kind: z.literal("material_bound_to_container"),
  materialInstanceId: workflowLocalIdSchema,
  containerEquipmentInstanceId: workflowLocalIdSchema
});

const actionReferenceShape = {
  actionId: registryIdSchema,
  sourceEquipmentInstanceId: workflowLocalIdSchema.optional(),
  targetEquipmentInstanceIds: z
    .array(workflowLocalIdSchema)
    .max(LIMITS.targetInstanceCount)
} as const;

export const actionObservedConditionSchema = z.strictObject({
  kind: z.literal("action_observed"),
  ...actionReferenceShape
});

export const actionCountWithinRangeConditionSchema = z
  .strictObject({
    kind: z.literal("action_count_within_range"),
    ...actionReferenceShape,
    minimumCount: z
      .number()
      .finite()
      .int()
      .min(0)
      .max(LIMITS.actionCountMaximum),
    maximumCount: z
      .number()
      .finite()
      .int()
      .min(0)
      .max(LIMITS.actionCountMaximum)
  })
  .refine((condition) => condition.minimumCount <= condition.maximumCount, {
    message: "minimumCount cannot exceed maximumCount",
    path: ["maximumCount"]
  });

export const semanticEventObservedConditionSchema = z.strictObject({
  kind: z.literal("semantic_event_observed"),
  eventTypeId: registryIdSchema
});

export const observationRecordedConditionSchema = z.strictObject({
  kind: z.literal("observation_recorded"),
  observationKeyId: registryIdSchema,
  eventTypeId: registryIdSchema.optional(),
  expectedValueSourceId: registryIdSchema.optional()
});

export const registeredCompletionPolicySatisfiedConditionSchema =
  z.strictObject({
    kind: z.literal("registered_completion_policy_satisfied"),
    completionPolicyId: registryIdSchema,
    evidenceRuleIds: requiredReferenceListSchema
  });

export const observableWithinToleranceConditionSchema = z
  .strictObject({
    kind: z.literal("observable_within_tolerance"),
    observableId: registryIdSchema,
    minimum: finiteObservableNumberSchema,
    maximum: finiteObservableNumberSchema,
    minimumInclusive: z.boolean(),
    maximumInclusive: z.boolean(),
    unitId: registryIdSchema
  })
  .superRefine((condition, context) => {
    if (condition.minimum > condition.maximum) {
      context.addIssue({
        code: "custom",
        message: "minimum cannot exceed maximum",
        path: ["maximum"]
      });
    }
    if (
      condition.minimum === condition.maximum &&
      (!condition.minimumInclusive || !condition.maximumInclusive)
    ) {
      context.addIssue({
        code: "custom",
        message: "Equal bounds must both be inclusive",
        path: ["maximumInclusive"]
      });
    }
  });

export const eventFlagConditionSchema = z.strictObject({
  kind: z.literal("event_flag"),
  flagId: registryIdSchema,
  presence: z.enum(["present", "absent"]),
  eventTypeId: registryIdSchema.optional()
});

export const ruleSatisfiedBeforeConditionSchema = z.strictObject({
  kind: z.literal("rule_satisfied_before"),
  predecessorRuleId: workflowLocalIdSchema,
  successorRuleId: workflowLocalIdSchema
});

export const forbiddenStateNeverReachedConditionSchema = z.strictObject({
  kind: z.literal("forbidden_state_never_reached"),
  equipmentInstanceId: workflowLocalIdSchema,
  stateFieldKey: workflowLocalIdSchema,
  forbiddenValue: structuredEvidenceValueSchema
});

export const studentResponseSubmittedConditionSchema = z.strictObject({
  kind: z.literal("student_response_submitted"),
  submissionFieldId: registryIdSchema
});

export const workflowConditionSchema = z.discriminatedUnion("kind", [
  equipmentStateEqualsConditionSchema,
  equipmentCapabilityPresentConditionSchema,
  materialBoundToContainerConditionSchema,
  actionObservedConditionSchema,
  actionCountWithinRangeConditionSchema,
  semanticEventObservedConditionSchema,
  observationRecordedConditionSchema,
  registeredCompletionPolicySatisfiedConditionSchema,
  observableWithinToleranceConditionSchema,
  eventFlagConditionSchema,
  ruleSatisfiedBeforeConditionSchema,
  forbiddenStateNeverReachedConditionSchema,
  studentResponseSubmittedConditionSchema
]);

export const workflowRuleKindSchema = z.enum([
  "required",
  "success",
  "failure",
  "forbidden",
  "ordering",
  "best_practice",
  "scoring"
]);

export const workflowRuleSeveritySchema = z.enum([
  "info",
  "best-practice",
  "procedural",
  "conceptual",
  "safety"
]);

export const workflowRuleSchema = z
  .strictObject({
    id: workflowLocalIdSchema,
    kind: workflowRuleKindSchema,
    condition: workflowConditionSchema,
    severity: workflowRuleSeveritySchema,
    recoverable: z.boolean(),
    terminal: z.boolean(),
    objectiveIds: requiredReferenceListSchema,
    points: z.number().finite().min(0).max(LIMITS.pointsMaximum).optional()
  })
  .refine((rule) => !(rule.recoverable && rule.terminal), {
    message: "A terminal rule cannot be recoverable",
    path: ["terminal"]
  });

export const workflowRulesSchema = z
  .array(workflowRuleSchema)
  .max(LIMITS.ruleCount);

export const instructionSectionSchema = z.strictObject({
  id: workflowLocalIdSchema,
  title: shortTextSchema,
  guidance: longTextSchema,
  relatedRuleIds: requiredReferenceListSchema
});

export const instructionSectionsSchema = z
  .array(instructionSectionSchema)
  .max(LIMITS.instructionCount);

export const rubricEvidenceMappingSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("rule_diagnosis"),
    ruleId: workflowLocalIdSchema,
    required: z.boolean()
  }),
  z.strictObject({
    kind: z.literal("semantic_event"),
    eventTypeId: registryIdSchema,
    required: z.boolean()
  }),
  z.strictObject({
    kind: z.literal("semantic_event_observation"),
    observationKeyId: registryIdSchema,
    eventTypeId: registryIdSchema.optional(),
    required: z.boolean()
  }),
  z.strictObject({
    kind: z.literal("observable"),
    observableId: registryIdSchema,
    required: z.boolean()
  }),
  z.strictObject({
    kind: z.literal("student_response"),
    submissionFieldId: registryIdSchema,
    required: z.boolean()
  })
]);

export const rubricCriterionSpecV2Schema = z.strictObject({
  id: workflowLocalIdSchema,
  objectiveIds: requiredReferenceListSchema,
  ruleIds: requiredReferenceListSchema,
  description: longTextSchema,
  maxPoints: z.number().finite().min(0).max(LIMITS.pointsMaximum),
  assessmentModeId: registryIdSchema,
  evidenceMappings: z
    .array(rubricEvidenceMappingSchema)
    .min(1)
    .max(LIMITS.evidenceMappingCount),
  scoringGuide: z.array(shortTextSchema).max(LIMITS.referenceCount)
});

export const rubricSpecV2Schema = z.strictObject({
  id: registryIdSchema,
  version: semanticVersionSchema,
  title: shortTextSchema,
  criteria: z
    .array(rubricCriterionSpecV2Schema)
    .max(LIMITS.rubricCriterionCount),
  totalPoints: z
    .number()
    .finite()
    .min(0)
    .max(LIMITS.rubricCriterionCount * LIMITS.pointsMaximum),
  passingPolicyId: registryIdSchema
});

export const workflowDiagnosisStatusSchema = z.enum([
  "satisfied",
  "violated",
  "pending"
]);

export const workflowDiagnosisSchema = z.strictObject({
  ruleId: workflowLocalIdSchema,
  status: workflowDiagnosisStatusSchema,
  severity: workflowRuleSeveritySchema,
  recoverable: z.boolean(),
  objectiveIds: referenceListSchema,
  evidenceEventIds: z
    .array(workflowLocalIdSchema)
    .max(LIMITS.diagnosisEvidenceCount),
  expected: structuredEvidenceValueSchema.optional(),
  observed: structuredEvidenceValueSchema.optional()
});

export const workflowDiagnosesSchema = z
  .array(workflowDiagnosisSchema)
  .max(LIMITS.diagnosisCount);

export type StructuredEvidenceValue = z.infer<
  typeof structuredEvidenceValueSchema
>;
export type EquipmentStateEqualsCondition = z.infer<
  typeof equipmentStateEqualsConditionSchema
>;
export type EquipmentCapabilityPresentCondition = z.infer<
  typeof equipmentCapabilityPresentConditionSchema
>;
export type MaterialBoundToContainerCondition = z.infer<
  typeof materialBoundToContainerConditionSchema
>;
export type ActionObservedCondition = z.infer<
  typeof actionObservedConditionSchema
>;
export type ActionCountWithinRangeCondition = z.infer<
  typeof actionCountWithinRangeConditionSchema
>;
export type SemanticEventObservedCondition = z.infer<
  typeof semanticEventObservedConditionSchema
>;
export type ObservationRecordedCondition = z.infer<
  typeof observationRecordedConditionSchema
>;
export type RegisteredCompletionPolicySatisfiedCondition = z.infer<
  typeof registeredCompletionPolicySatisfiedConditionSchema
>;
export type ObservableWithinToleranceCondition = z.infer<
  typeof observableWithinToleranceConditionSchema
>;
export type EventFlagCondition = z.infer<typeof eventFlagConditionSchema>;
export type RuleSatisfiedBeforeCondition = z.infer<
  typeof ruleSatisfiedBeforeConditionSchema
>;
export type ForbiddenStateNeverReachedCondition = z.infer<
  typeof forbiddenStateNeverReachedConditionSchema
>;
export type StudentResponseSubmittedCondition = z.infer<
  typeof studentResponseSubmittedConditionSchema
>;
export type WorkflowCondition = z.infer<typeof workflowConditionSchema>;
export type WorkflowRuleKind = z.infer<typeof workflowRuleKindSchema>;
export type WorkflowRuleSeverity = z.infer<typeof workflowRuleSeveritySchema>;
export type WorkflowRule = z.infer<typeof workflowRuleSchema>;
export type InstructionSection = z.infer<typeof instructionSectionSchema>;
export type RubricEvidenceMapping = z.infer<typeof rubricEvidenceMappingSchema>;
export type RubricCriterionSpecV2 = z.infer<typeof rubricCriterionSpecV2Schema>;
export type RubricSpecV2 = z.infer<typeof rubricSpecV2Schema>;
export type WorkflowDiagnosisStatus = z.infer<
  typeof workflowDiagnosisStatusSchema
>;
export type WorkflowDiagnosis = z.infer<typeof workflowDiagnosisSchema>;
