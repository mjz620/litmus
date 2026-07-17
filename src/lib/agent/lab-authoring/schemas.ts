import { z } from "zod";

import {
  LAB_WORKFLOW_SCHEMA_LIMITS,
  allowedActionSpecSchema,
  expectedObservationSchema,
  labWorkflowStepSchema,
  labWorkflowDraftSchema,
  registryIdSchema
} from "../../../lab-workflows/schema";

export const LAB_AUTHORING_LIMITS = Object.freeze({
  requestBytes: 12_000,
  teacherRequestCharacters: 2_000,
  classContextCharacters: 1_000,
  maxToolCalls: 8,
  maxModelRounds: 3,
  maxOutputTokensPerRound: 8_000,
  timeoutMs: 25_000,
  rateLimitRequests: 5,
  rateLimitWindowMs: 60_000
});

export const labAuthoringRequestSchema = z.strictObject({
  teacherRequest: z
    .string()
    .trim()
    .min(3)
    .max(LAB_AUTHORING_LIMITS.teacherRequestCharacters),
  gradeBand: z.enum(["9-10", "11-12", "mixed_high_school"]).optional(),
  targetMinutes: z.number().finite().int().min(1).max(120).optional(),
  classContext: z
    .string()
    .trim()
    .min(1)
    .max(LAB_AUTHORING_LIMITS.classContextCharacters)
    .optional(),
  deviceProfileId: registryIdSchema
});

export const labAuthoringClaimedSupportSchema = z.enum([
  "candidate_runnable",
  "partially_supported",
  "unsupported",
  "rejected_for_safety"
]);

export const labAuthoringRequestSummarySchema = z.strictObject({
  objective: z.string().trim().min(1).max(1_000),
  extractedSkillIds: z.array(registryIdSchema).max(16),
  constraints: z.array(z.string().trim().min(1).max(400)).max(32),
  ambiguities: z.array(z.string().trim().min(1).max(400)).max(32)
});

export const labAuthoringAlternativeSchema = z.strictObject({
  familyId: registryIdSchema,
  skillIds: z.array(registryIdSchema).min(1).max(16),
  explanation: z.string().trim().min(1).max(1_000)
});

/*
 * OpenAI strict Structured Outputs require every object property to be present.
 * The application schema uses optional action/observation fields, so the model
 * contract represents those fields as required nullable values. The server
 * converts nulls back to omitted optional fields before returning a draft.
 */
const labAuthoringModelAllowedActionSchema = allowedActionSpecSchema.extend({
  authoredLimits: allowedActionSpecSchema.shape.authoredLimits
    .unwrap()
    .nullable(),
  maxAttempts: allowedActionSpecSchema.shape.maxAttempts.unwrap().nullable()
});

const labAuthoringModelExpectedObservationSchema =
  expectedObservationSchema.extend({
    observationKeyId: expectedObservationSchema.shape.observationKeyId
      .unwrap()
      .nullable(),
    flagId: expectedObservationSchema.shape.flagId.unwrap().nullable(),
    expectedValueSourceId: expectedObservationSchema.shape.expectedValueSourceId
      .unwrap()
      .nullable()
  });

const labAuthoringModelWorkflowStepSchema = labWorkflowStepSchema.extend({
  allowedActions: z
    .array(labAuthoringModelAllowedActionSchema)
    .max(LAB_WORKFLOW_SCHEMA_LIMITS.actionsPerStep),
  expectedObservations: z
    .array(labAuthoringModelExpectedObservationSchema)
    .max(LAB_WORKFLOW_SCHEMA_LIMITS.observationsPerStep)
});

export const labAuthoringModelWorkflowDraftSchema =
  labWorkflowDraftSchema.extend({
    steps: z
      .array(labAuthoringModelWorkflowStepSchema)
      .min(1)
      .max(LAB_WORKFLOW_SCHEMA_LIMITS.stepCount)
  });

/** Schema supplied to Structured Outputs; server metadata is attached later. */
export const labAuthoringModelResultSchema = z.strictObject({
  requestSummary: labAuthoringRequestSummarySchema,
  proposedWorkflow: labAuthoringModelWorkflowDraftSchema.nullable(),
  claimedSupport: labAuthoringClaimedSupportSchema,
  missingCapabilityIds: z.array(registryIdSchema).max(64),
  suggestedAlternatives: z.array(labAuthoringAlternativeSchema).max(8),
  revisionSummary: z.string().trim().min(1).max(1_000).nullable()
});

/** Public server response uses the canonical application draft schema. */
export const labAuthoringResultSchema = z.strictObject({
  requestSummary: labAuthoringRequestSummarySchema,
  proposedWorkflow: labWorkflowDraftSchema.nullable(),
  claimedSupport: labAuthoringClaimedSupportSchema,
  missingCapabilityIds: z.array(registryIdSchema).max(64),
  suggestedAlternatives: z.array(labAuthoringAlternativeSchema).max(8),
  revisionSummary: z.string().trim().min(1).max(1_000).nullable()
});

export const labAuthoringToolNameSchema = z.enum([
  "searchSkillRegistry",
  "listSupportedLabFamilies",
  "getComponentRegistry",
  "getReagentRegistry",
  "getEngineCapabilities"
]);

export const labAuthoringMetadataSchema = z.strictObject({
  promptVersion: z.string().min(1).max(80),
  toolContractVersion: z.string().min(1).max(80),
  outputSchemaVersion: z.literal("1.0.0"),
  model: z.string().min(1).max(160),
  mode: z.enum(["live", "mock"]),
  registrySnapshotIds: z.record(registryIdSchema, z.string().min(1).max(160)),
  toolCalls: z
    .array(labAuthoringToolNameSchema)
    .max(LAB_AUTHORING_LIMITS.maxToolCalls),
  limits: z.strictObject({
    maxToolCalls: z.literal(LAB_AUTHORING_LIMITS.maxToolCalls),
    maxModelRounds: z.literal(LAB_AUTHORING_LIMITS.maxModelRounds),
    maxOutputTokensPerRound: z.literal(
      LAB_AUTHORING_LIMITS.maxOutputTokensPerRound
    ),
    timeoutMs: z.literal(LAB_AUTHORING_LIMITS.timeoutMs)
  })
});

export const labAuthoringSuccessResponseSchema = z.strictObject({
  ok: z.literal(true),
  metadata: labAuthoringMetadataSchema,
  result: labAuthoringResultSchema
});

export const labAuthoringErrorCodeSchema = z.enum([
  "authoring.invalid_json.v1",
  "authoring.invalid_request.v1",
  "authoring.request_too_large.v1",
  "authoring.rate_limited.v1",
  "authoring.model_refused.v1",
  "authoring.model_unavailable.v1",
  "authoring.tool_limit.v1",
  "authoring.tool_call_invalid.v1",
  "authoring.timeout.v1",
  "authoring.output_invalid.v1"
]);

export const labAuthoringErrorResponseSchema = z.strictObject({
  ok: z.literal(false),
  metadata: z.strictObject({
    promptVersion: z.string().min(1).max(80),
    toolContractVersion: z.string().min(1).max(80)
  }),
  error: z.strictObject({
    code: labAuthoringErrorCodeSchema,
    message: z.string().min(1).max(500),
    retryable: z.boolean(),
    fieldPaths: z.array(z.string().min(1).max(256)).max(64)
  })
});

export type LabAuthoringRequest = z.infer<typeof labAuthoringRequestSchema>;
export type LabAuthoringModelResult = z.infer<
  typeof labAuthoringModelResultSchema
>;
export type LabAuthoringResult = z.infer<typeof labAuthoringResultSchema>;
export type LabAuthoringToolName = z.infer<typeof labAuthoringToolNameSchema>;
export type LabAuthoringSuccessResponse = z.infer<
  typeof labAuthoringSuccessResponseSchema
>;
export type LabAuthoringErrorCode = z.infer<typeof labAuthoringErrorCodeSchema>;
export type LabAuthoringErrorResponse = z.infer<
  typeof labAuthoringErrorResponseSchema
>;
