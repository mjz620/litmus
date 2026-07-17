import { z } from "zod";

export const LAB_WORKFLOW_SCHEMA_VERSION = "1.0.0" as const;

/**
 * Structural limits keep authored payloads predictable for server validation and
 * Chromebook-class clients. Registry and engine compatibility remain validator
 * concerns; these limits only bound the versioned data contract.
 */
export const LAB_WORKFLOW_SCHEMA_LIMITS = Object.freeze({
  identifierLength: 160,
  shortTextLength: 240,
  longTextLength: 2_000,
  listItemCount: 64,
  componentCount: 32,
  reagentCount: 32,
  stepCount: 32,
  actionsPerStep: 16,
  observationsPerStep: 32,
  coachTriggerCount: 32,
  rubricCriterionCount: 32,
  retryCount: 16,
  safetyConstraintCount: 64,
  validationIssueCount: 256,
  authoredLimitCount: 16
});

const LIMITS = LAB_WORKFLOW_SCHEMA_LIMITS;
const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const semanticVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function boundedText(maximum: number) {
  return z
    .string()
    .min(1)
    .max(maximum)
    .refine((value) => value.trim().length > 0, "Text cannot be blank");
}

export const registryIdSchema = z
  .string()
  .min(1)
  .max(LIMITS.identifierLength)
  .regex(identifierPattern, "Expected a registry identifier");

export const workflowLocalIdSchema = registryIdSchema;

export const semanticVersionSchema = z
  .string()
  .max(64)
  .regex(semanticVersionPattern, "Expected a semantic version");

export const sha256HashSchema = z
  .string()
  .regex(/^sha256:[0-9a-f]{64}$/, "Expected a lowercase SHA-256 hash");

const identifierListSchema = z
  .array(registryIdSchema)
  .max(LIMITS.listItemCount);
const shortTextSchema = boundedText(LIMITS.shortTextLength);
const longTextSchema = boundedText(LIMITS.longTextLength);
const shortTextListSchema = z.array(shortTextSchema).max(LIMITS.listItemCount);

export const workflowSupportStatusSchema = z.enum([
  "draft_unvalidated",
  "runnable",
  "partially_supported",
  "unsupported",
  "rejected_for_safety"
]);

export const validatedWorkflowSupportStatusSchema = z.enum([
  "runnable",
  "partially_supported",
  "unsupported",
  "rejected_for_safety"
]);

export const labMetadataSchema = z.strictObject({
  title: shortTextSchema,
  learningObjective: longTextSchema,
  studentSummary: longTextSchema,
  gradeBand: z.enum(["9-10", "11-12", "mixed_high_school"]),
  estimatedMinutes: z.number().finite().int().min(1).max(480),
  difficulty: z.enum(["intro", "intermediate", "advanced"]),
  tags: shortTextListSchema,
  accessibilityNotes: shortTextListSchema,
  deviceProfileId: registryIdSchema
});

export const labComponentInstanceSchema = z.strictObject({
  instanceId: workflowLocalIdSchema,
  componentId: registryIdSchema,
  configurationPresetId: registryIdSchema,
  role: registryIdSchema,
  placementSlotId: registryIdSchema,
  label: shortTextSchema,
  required: z.boolean()
});

export const labReagentSpecSchema = z.strictObject({
  instanceId: workflowLocalIdSchema,
  reagentId: registryIdSchema,
  containerInstanceId: workflowLocalIdSchema,
  role: registryIdSchema,
  requestedAmount: z.number().finite().positive().max(1_000_000),
  amountUnitId: registryIdSchema,
  displayLabel: shortTextSchema
});

const authoredLimitsSchema = z
  .record(
    z.string().min(1).max(LIMITS.identifierLength).regex(identifierPattern),
    z.number().finite()
  )
  .refine(
    (limits) => Object.keys(limits).length <= LIMITS.authoredLimitCount,
    `At most ${LIMITS.authoredLimitCount} authored limits are allowed`
  );

export const allowedActionSpecSchema = z.strictObject({
  actionId: registryIdSchema,
  actorComponentInstanceId: workflowLocalIdSchema,
  targetComponentInstanceIds: z
    .array(workflowLocalIdSchema)
    .max(LIMITS.componentCount),
  parameterPresetId: registryIdSchema,
  authoredLimits: authoredLimitsSchema.optional(),
  maxAttempts: z.number().finite().int().min(1).max(1_000).optional()
});

export const expectedObservationSchema = z.strictObject({
  id: workflowLocalIdSchema,
  eventTypeId: registryIdSchema,
  observationKeyId: registryIdSchema.optional(),
  flagId: registryIdSchema.optional(),
  expectation: z.enum([
    "event_present",
    "flag_present",
    "flag_absent",
    "value_recorded"
  ]),
  expectedValueSourceId: registryIdSchema.optional(),
  studentPrompt: longTextSchema,
  requiredForCompletion: z.boolean()
});

export const labWorkflowStepSchema = z.strictObject({
  id: workflowLocalIdSchema,
  order: z.number().finite().int().min(1).max(LIMITS.stepCount),
  title: shortTextSchema,
  studentInstruction: longTextSchema,
  rationaleForTeacher: longTextSchema,
  skillIds: identifierListSchema,
  componentInstanceIds: z
    .array(workflowLocalIdSchema)
    .max(LIMITS.componentCount),
  allowedActions: z.array(allowedActionSpecSchema).max(LIMITS.actionsPerStep),
  expectedObservations: z
    .array(expectedObservationSchema)
    .max(LIMITS.observationsPerStep),
  completionPolicyId: registryIdSchema,
  optional: z.boolean()
});

export const coachTriggerSpecSchema = z.strictObject({
  id: workflowLocalIdSchema,
  skillId: registryIdSchema,
  eventTypeIds: identifierListSchema,
  flagIds: identifierListSchema,
  triggerTypeId: registryIdSchema,
  hintStrategyId: registryIdSchema,
  maxHintLevel: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3)
  ]),
  cooldownEventCount: z.number().finite().int().min(0).max(1_000),
  staySilentOnEventReasonIds: identifierListSchema
});

export const rubricCriterionSpecSchema = z.strictObject({
  id: workflowLocalIdSchema,
  skillIds: identifierListSchema,
  description: longTextSchema,
  maxPoints: z.number().finite().min(0).max(1_000),
  assessmentModeId: registryIdSchema,
  requiredEventTypeIds: identifierListSchema,
  requiredObservationKeyIds: identifierListSchema,
  studentSubmissionFieldIds: identifierListSchema,
  scoringGuide: shortTextListSchema
});

export const rubricSpecSchema = z.strictObject({
  id: registryIdSchema,
  version: semanticVersionSchema,
  title: shortTextSchema,
  criteria: z.array(rubricCriterionSpecSchema).max(LIMITS.rubricCriterionCount),
  totalPoints: z
    .number()
    .finite()
    .min(0)
    .max(LIMITS.rubricCriterionCount * 1_000),
  passingPolicyId: registryIdSchema
});

export const adaptiveRetryTemplateSchema = z.strictObject({
  id: workflowLocalIdSchema,
  templateId: registryIdSchema,
  targetSkillIds: identifierListSchema,
  eligibleFlagIds: identifierListSchema,
  seedTemplateId: registryIdSchema,
  maxMinutes: z.number().finite().int().min(1).max(120),
  studentGoal: longTextSchema,
  successEvidenceReasonIds: identifierListSchema
});

export const safetyConstraintSchema = z.strictObject({
  id: registryIdSchema,
  appliesToInstanceIds: z
    .array(workflowLocalIdSchema)
    .max(LIMITS.componentCount),
  severity: z.enum(["required", "restricted", "prohibited"]),
  studentFacingText: longTextSchema,
  teacherFacingText: longTextSchema
});

export const validationIssueSchema = z.strictObject({
  code: registryIdSchema,
  severity: z.enum(["error", "warning", "info"]),
  path: z.string().min(1).max(512),
  message: longTextSchema,
  registryId: registryIdSchema.optional(),
  suggestedSupportedIds: identifierListSchema,
  safetyRelated: z.boolean()
});

const registrySnapshotIdsSchema = z
  .record(registryIdSchema, boundedText(LIMITS.identifierLength))
  .refine(
    (snapshots) => Object.keys(snapshots).length <= LIMITS.listItemCount,
    `At most ${LIMITS.listItemCount} registry snapshots are allowed`
  );

export const validationResultSchema = z.strictObject({
  validatorVersion: semanticVersionSchema,
  checkedAt: z.string().datetime({ offset: true }),
  canonicalSpecHash: sha256HashSchema,
  registrySnapshotIds: registrySnapshotIdsSchema,
  status: validatedWorkflowSupportStatusSchema,
  runnable: z.boolean(),
  previewEligible: z.boolean(),
  assignmentEligible: z.boolean(),
  issues: z.array(validationIssueSchema).max(LIMITS.validationIssueCount),
  passedCheckIds: identifierListSchema
});

export const judgeDimensionSchema = z.enum([
  "skill_alignment",
  "pedagogical_quality",
  "student_clarity",
  "rubric_alignment",
  "coach_trigger_relevance",
  "safety_appropriateness",
  "teacher_usability",
  "under_resourced_school_suitability"
]);

export const judgeDimensionScoreSchema = z.strictObject({
  score: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5)
  ]),
  rationale: longTextSchema
});

export const judgeIssueSchema = z.strictObject({
  severity: z.enum(["blocker", "medium", "low"]),
  dimension: judgeDimensionSchema,
  path: z.string().min(1).max(512),
  critique: longTextSchema,
  suggestedRevision: longTextSchema
});

export const judgeCritiqueSchema = z.strictObject({
  critiqueVersion: semanticVersionSchema,
  specHash: sha256HashSchema,
  scores: z.record(judgeDimensionSchema, judgeDimensionScoreSchema),
  issues: z.array(judgeIssueSchema).max(LIMITS.validationIssueCount),
  strengths: shortTextListSchema,
  summary: longTextSchema,
  recommendation: z.enum([
    "approve",
    "revise",
    "mark_partially_supported",
    "reject"
  ])
});

const labWorkflowBaseShape = {
  schemaVersion: z.literal(LAB_WORKFLOW_SCHEMA_VERSION),
  id: registryIdSchema,
  revision: z.number().finite().int().min(1).max(1_000_000),
  sourceRequest: longTextSchema,
  metadata: labMetadataSchema,
  familyId: registryIdSchema,
  engineId: registryIdSchema,
  engineConfigId: registryIdSchema,
  initializationPresetId: registryIdSchema,
  skillIds: identifierListSchema,
  components: z.array(labComponentInstanceSchema).max(LIMITS.componentCount),
  reagents: z.array(labReagentSpecSchema).max(LIMITS.reagentCount),
  steps: z.array(labWorkflowStepSchema).min(1).max(LIMITS.stepCount),
  coachTriggers: z.array(coachTriggerSpecSchema).max(LIMITS.coachTriggerCount),
  rubric: rubricSpecSchema,
  adaptiveRetries: z.array(adaptiveRetryTemplateSchema).max(LIMITS.retryCount),
  safetyConstraints: z
    .array(safetyConstraintSchema)
    .max(LIMITS.safetyConstraintCount)
};

export const labWorkflowDraftSchema = z.strictObject({
  ...labWorkflowBaseShape,
  supportStatus: z.literal("draft_unvalidated"),
  validation: z.null(),
  judgeCritique: z.null()
});

export const validatedLabWorkflowSpecSchema = z.strictObject({
  ...labWorkflowBaseShape,
  supportStatus: validatedWorkflowSupportStatusSchema,
  validation: validationResultSchema,
  judgeCritique: judgeCritiqueSchema.nullable()
});

export const labWorkflowSpecSchema = z.discriminatedUnion("supportStatus", [
  labWorkflowDraftSchema,
  validatedLabWorkflowSpecSchema
]);

export type RegistryId = z.infer<typeof registryIdSchema>;
export type WorkflowSupportStatus = z.infer<typeof workflowSupportStatusSchema>;
export type LabMetadata = z.infer<typeof labMetadataSchema>;
export type LabComponentInstance = z.infer<typeof labComponentInstanceSchema>;
export type LabReagentSpec = z.infer<typeof labReagentSpecSchema>;
export type AllowedActionSpec = z.infer<typeof allowedActionSpecSchema>;
export type ExpectedObservation = z.infer<typeof expectedObservationSchema>;
export type LabWorkflowStep = z.infer<typeof labWorkflowStepSchema>;
export type CoachTriggerSpec = z.infer<typeof coachTriggerSpecSchema>;
export type RubricCriterionSpec = z.infer<typeof rubricCriterionSpecSchema>;
export type RubricSpec = z.infer<typeof rubricSpecSchema>;
export type AdaptiveRetryTemplate = z.infer<typeof adaptiveRetryTemplateSchema>;
export type SafetyConstraint = z.infer<typeof safetyConstraintSchema>;
export type ValidationIssue = z.infer<typeof validationIssueSchema>;
export type ValidationResult = z.infer<typeof validationResultSchema>;
export type JudgeDimension = z.infer<typeof judgeDimensionSchema>;
export type JudgeDimensionScore = z.infer<typeof judgeDimensionScoreSchema>;
export type JudgeIssue = z.infer<typeof judgeIssueSchema>;
export type JudgeCritique = z.infer<typeof judgeCritiqueSchema>;
export type LabWorkflowDraft = z.infer<typeof labWorkflowDraftSchema>;
export type ValidatedLabWorkflowSpec = z.infer<
  typeof validatedLabWorkflowSpecSchema
>;
export type LabWorkflowSpec = z.infer<typeof labWorkflowSpecSchema>;
