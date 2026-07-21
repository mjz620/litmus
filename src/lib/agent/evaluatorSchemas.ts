import { z } from "zod";

import { labWorkflowConsumerContextSchema } from "../../lab-workflows/consumers";
import {
  genericLabStateSchema,
  genericObservableSchema
} from "../../lab-workflows/runtime/generic/schemas";
import { workflowDiagnosisSchema } from "../../lab-workflows/schema/conditions";
import { validatedLabWorkflowSpecV2Schema } from "../../lab-workflows/schema/v2";

import { semanticEventSchema, studentModelSchema } from "./schemas";

export const reportTextSchema = z.object({
  procedureSummary: z.string().trim().min(1).max(4000),
  dataAnalysis: z.string().trim().min(1).max(4000),
  conceptExplanation: z.string().trim().min(1).max(4000),
  sourcesOfError: z.string().trim().min(1).max(4000)
});

export const evaluateRequestSchema = z.object({
  sessionId: z.string().min(1).max(160),
  experimentId: z.string().min(1).max(128),
  finalState: z.unknown(),
  events: z.array(semanticEventSchema).max(1000),
  studentModel: studentModelSchema,
  labWorkflowContext: labWorkflowConsumerContextSchema.optional(),
  studentText: reportTextSchema
});

export const rubricCriterionSchema = z.object({
  score: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  feedback: z.string().min(1).max(1200),
  evidenceEventTypes: z.array(z.string().min(1).max(128)).max(64)
});

export const rubricResponseSchema = z.object({
  concept_understanding: rubricCriterionSchema,
  procedure: rubricCriterionSchema,
  data_analysis: rubricCriterionSchema,
  sig_figs: rubricCriterionSchema,
  overall_summary: z.string().min(1).max(1600),
  /*
   * OpenAI structured outputs require every field, so `.optional()` alone
   * makes the API reject the schema outright and every live evaluation
   * 503ed. `.nullable()` keeps the schema API-legal; the model returns null
   * when no retry is recommended, and consumers already check truthiness.
   */
  recommended_retry: z
    .object({
      skillId: z.enum(["endpoint_control", "burette_conditioning"]),
      reason: z.string().min(1).max(600)
    })
    .nullable()
    .optional()
});

export type EvaluateRequest = z.infer<typeof evaluateRequestSchema>;
export type RubricResponse = z.infer<typeof rubricResponseSchema>;
export type ReportText = z.infer<typeof reportTextSchema>;

export const AUTHORED_EVALUATOR_CONTRACT_VERSION = "2.0.0" as const;
export const AUTHORED_EVALUATOR_OUTPUT_VERSION = "2.0.0" as const;

const evidenceIdSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const boundedFeedbackSchema = z.string().trim().min(1).max(1_600);
const evidenceIdsSchema = z
  .array(evidenceIdSchema)
  .min(1)
  .max(128)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "Evidence IDs must be unique"
  });

export const authoredReportSectionSchema = z.strictObject({
  evidenceId: evidenceIdSchema,
  text: z.string().trim().min(1).max(4_000)
});

export const authoredReportTextSchema = z.strictObject({
  procedureSummary: authoredReportSectionSchema,
  dataAnalysis: authoredReportSectionSchema,
  conceptExplanation: authoredReportSectionSchema,
  sourcesOfError: authoredReportSectionSchema
});

export const authoredWorkflowStudentResponseSchema = z.strictObject({
  evidenceId: evidenceIdSchema,
  submissionFieldId: z.string().min(1).max(256),
  value: z.union([
    z.boolean(),
    z.number().finite(),
    z.string().trim().min(1).max(4_000)
  ])
});

export const authoredDiagnosisEvidenceSchema = z.strictObject({
  evidenceId: evidenceIdSchema,
  diagnosis: workflowDiagnosisSchema
});

export const authoredObservableEvidenceSchema = genericObservableSchema.extend({
  evidenceId: evidenceIdSchema
});

export const authoredEvaluateRequestSchema = z.strictObject({
  contractVersion: z.literal(AUTHORED_EVALUATOR_CONTRACT_VERSION),
  sessionId: z.string().min(1).max(160),
  experimentId: z.string().min(1).max(128),
  assignedDefinition: validatedLabWorkflowSpecV2Schema,
  runtimeState: genericLabStateSchema,
  diagnosisEvidence: z.array(authoredDiagnosisEvidenceSchema).max(256),
  observableEvidence: z.array(authoredObservableEvidenceSchema).max(256),
  workflowResponses: z.array(authoredWorkflowStudentResponseSchema).max(128),
  report: authoredReportTextSchema
});

export const authoredCriterionModelResultSchema = z.strictObject({
  criterionId: z.string().min(1).max(256),
  score: z.number().finite().nonnegative(),
  feedback: boundedFeedbackSchema,
  evidenceIds: evidenceIdsSchema
});

export const authoredEvaluationClaimSchema = z.strictObject({
  kind: z.enum(["strength", "growth_area", "misconception"]),
  statement: boundedFeedbackSchema,
  evidenceIds: evidenceIdsSchema
});

export const authoredEvaluationUncertaintySchema = z.strictObject({
  level: z.enum(["low", "medium", "high"]),
  explanation: boundedFeedbackSchema,
  evidenceIds: evidenceIdsSchema
});

export const authoredEvaluatorModelOutputSchema = z.strictObject({
  criteria: z.array(authoredCriterionModelResultSchema).max(64),
  claims: z.array(authoredEvaluationClaimSchema).max(32),
  overallSummary: z.string().trim().min(1).max(2_000),
  overallEvidenceIds: evidenceIdsSchema,
  uncertainty: authoredEvaluationUncertaintySchema
});

export const authoredCriterionResultSchema =
  authoredCriterionModelResultSchema.extend({
    objectiveIds: z.array(z.string().min(1).max(256)).min(1).max(64),
    maxPoints: z.number().finite().nonnegative(),
    performance: z.enum(["mastered", "developing", "not_demonstrated"])
  });

export const authoredEvaluationResponseSchema = z.strictObject({
  ok: z.literal(true),
  contractVersion: z.literal(AUTHORED_EVALUATOR_CONTRACT_VERSION),
  metadata: z.strictObject({
    outputVersion: z.literal(AUTHORED_EVALUATOR_OUTPUT_VERSION),
    evaluatorVersion: z.string().min(1).max(128),
    promptVersion: z.string().min(1).max(128),
    model: z.string().min(1).max(160),
    mode: z.enum(["live", "deterministic_fallback"]),
    fallbackReason: z
      .enum([
        "deterministic_configured",
        "model_unavailable",
        "model_output_invalid"
      ])
      .nullable(),
    evaluatedAt: z.string().datetime({ offset: true }),
    definitionId: z.string().min(1).max(256),
    definitionRevision: z.number().int().positive(),
    definitionHash: z.string().min(1).max(160),
    validatorVersion: z.string().min(1).max(128),
    rubricId: z.string().min(1).max(256),
    rubricVersion: z.string().min(1).max(128)
  }),
  result: z.strictObject({
    criteria: z.array(authoredCriterionResultSchema).max(64),
    earnedPoints: z.number().finite().nonnegative(),
    possiblePoints: z.number().finite().nonnegative(),
    claims: z.array(authoredEvaluationClaimSchema).max(32),
    overallSummary: z.string().trim().min(1).max(2_000),
    overallEvidenceIds: evidenceIdsSchema,
    uncertainty: authoredEvaluationUncertaintySchema
  })
});

export const authoredEvaluationErrorCodeSchema = z.enum([
  "evaluator.invalid_request.v2",
  "evaluator.stale_definition.v2",
  "evaluator.runtime_provenance_mismatch.v2",
  "evaluator.unsupported_evidence.v2"
]);

export const authoredEvaluationErrorResponseSchema = z.strictObject({
  ok: z.literal(false),
  contractVersion: z.literal(AUTHORED_EVALUATOR_CONTRACT_VERSION),
  error: z.strictObject({
    code: authoredEvaluationErrorCodeSchema,
    message: z.string().min(1).max(500),
    fieldPaths: z.array(z.string().min(1).max(256)).max(64)
  })
});

export type AuthoredEvaluateRequest = z.infer<
  typeof authoredEvaluateRequestSchema
>;
export type AuthoredEvaluatorModelOutput = z.infer<
  typeof authoredEvaluatorModelOutputSchema
>;
export type AuthoredEvaluationResponse = z.infer<
  typeof authoredEvaluationResponseSchema
>;
export type AuthoredEvaluationErrorCode = z.infer<
  typeof authoredEvaluationErrorCodeSchema
>;
export type AuthoredWorkflowStudentResponse = z.infer<
  typeof authoredWorkflowStudentResponseSchema
>;
