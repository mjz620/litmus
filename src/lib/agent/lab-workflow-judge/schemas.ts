import { z } from "zod";

import {
  registryIdSchema,
  sha256HashSchema
} from "../../../lab-workflows/schema";
import {
  workflowDiagnosisStatusSchema,
  workflowRuleSeveritySchema
} from "../../../lab-workflows/schema/conditions";
import {
  resolvedAdapterV2Schema,
  resolvedChemistryModelV2Schema,
  validatedLabWorkflowSpecV2Schema,
  validationResultV2Schema
} from "../../../lab-workflows/schema/v2";

export const WORKFLOW_JUDGE_CONTRACT_VERSION = "2.0.0" as const;
export const WORKFLOW_JUDGE_OUTPUT_VERSION = "2.0.0" as const;
export const WORKFLOW_JUDGE_LIMITS = Object.freeze({
  requestBytes: 512_000,
  teacherRequestCharacters: 2_000,
  maxTraces: 5,
  maxTraceEvidence: 128,
  maxIssues: 32,
  maxStrengths: 24,
  maxOutputTokens: 4_000,
  timeoutMs: 15_000,
  rateLimitRequests: 5,
  rateLimitWindowMs: 60_000
});

const boundedText = (maximum = 1_200) => z.string().trim().min(1).max(maximum);
const id = z.string().min(1).max(256);
const uniqueIds = (maximum = 128) =>
  z
    .array(id)
    .max(maximum)
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "IDs must be unique"
    });

export const workflowJudgeTraceKindSchema = z.enum([
  "valid",
  "alternate_valid",
  "recoverable_mistake",
  "terminal_mistake",
  "tolerance_boundary"
]);

export const workflowJudgeTraceDiagnosisSchema = z.strictObject({
  ruleId: id,
  status: workflowDiagnosisStatusSchema,
  severity: workflowRuleSeveritySchema,
  recoverable: z.boolean(),
  evidenceEventIds: uniqueIds(WORKFLOW_JUDGE_LIMITS.maxTraceEvidence)
});

export const workflowJudgeTraceEvidenceSchema = z.strictObject({
  source: z.literal("executed_generic_replay_v1"),
  workflowId: registryIdSchema,
  workflowRevision: z.number().int().positive(),
  workflowHash: sha256HashSchema,
  kind: workflowJudgeTraceKindSchema,
  traceId: id,
  passed: z.boolean(),
  actionCount: z.number().int().nonnegative().max(64),
  workflowStatus: z.enum(["in_progress", "completed", "failed"]),
  eventIds: uniqueIds(WORKFLOW_JUDGE_LIMITS.maxTraceEvidence),
  evidenceEventIds: uniqueIds(WORKFLOW_JUDGE_LIMITS.maxTraceEvidence),
  diagnoses: z
    .array(workflowJudgeTraceDiagnosisSchema)
    .max(WORKFLOW_JUDGE_LIMITS.maxTraceEvidence),
  observables: z
    .array(
      z.strictObject({
        observableId: registryIdSchema,
        value: z.union([z.boolean(), z.number().finite(), z.string().max(400)]),
        unitId: registryIdSchema.nullable()
      })
    )
    .max(WORKFLOW_JUDGE_LIMITS.maxTraceEvidence),
  error: z.null()
});

export const workflowJudgeCapabilitySummarySchema = z.strictObject({
  schemaVersion: z.literal("1.0.0"),
  workflowHash: sha256HashSchema,
  supportMode: z.enum(["native_capability", "legacy_adapter"]),
  objectiveIds: uniqueIds(64),
  equipmentDefinitionIds: uniqueIds(64),
  actionIds: uniqueIds(128),
  requiredChemistryCapabilityIds: uniqueIds(64),
  availableEventTypeIds: uniqueIds(128),
  availableFlagIds: uniqueIds(128),
  deviceProfileId: registryIdSchema,
  rubricId: registryIdSchema,
  rubricVersion: z.string().min(1).max(64),
  resolvedAdapters: z.array(resolvedAdapterV2Schema).max(256),
  resolvedChemistryModels: z.array(resolvedChemistryModelV2Schema).max(64),
  runtimeAdapterId: registryIdSchema.nullable()
});

export const workflowJudgeRequestSchema = z.strictObject({
  contractVersion: z.literal(WORKFLOW_JUDGE_CONTRACT_VERSION),
  teacherRequest: boundedText(WORKFLOW_JUDGE_LIMITS.teacherRequestCharacters),
  workflow: validatedLabWorkflowSpecV2Schema,
  validation: validationResultV2Schema,
  capabilitySummary: workflowJudgeCapabilitySummarySchema,
  traces: z
    .array(workflowJudgeTraceEvidenceSchema)
    .length(WORKFLOW_JUDGE_LIMITS.maxTraces)
});

export const workflowJudgeDimensionSchema = z.enum([
  "objective_alignment",
  "pedagogy",
  "flexibility",
  "rubric_fairness",
  "failure_cases",
  "clarity",
  "teacher_usability",
  "duration_feasibility",
  "student_level",
  "under_resourced_suitability"
]);

export const WORKFLOW_JUDGE_DIMENSIONS = Object.freeze([
  ...workflowJudgeDimensionSchema.options
]);

const specPathSchema = z
  .string()
  .min(1)
  .max(320)
  .regex(/^\$(?:\.[A-Za-z][A-Za-z0-9_]*|\[\d+\])*$/);
const evidenceReferencesSchema = z
  .array(id)
  .min(1)
  .max(64)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "Evidence references must be unique"
  });
const pathReferencesSchema = z
  .array(specPathSchema)
  .min(1)
  .max(32)
  .refine((paths) => new Set(paths).size === paths.length, {
    message: "Path references must be unique"
  });

export const workflowJudgeScoreSchema = z.strictObject({
  dimension: workflowJudgeDimensionSchema,
  score: z.union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5)
  ]),
  rationale: boundedText(),
  pathReferences: pathReferencesSchema,
  evidenceReferences: evidenceReferencesSchema,
  uncertainty: z.enum(["low", "medium", "high"])
});

export const workflowJudgeIssueSchema = z.strictObject({
  id,
  severity: z.enum(["blocker", "medium", "low"]),
  dimension: workflowJudgeDimensionSchema,
  path: specPathSchema,
  critique: boundedText(),
  suggestedRevision: boundedText(),
  evidenceReferences: evidenceReferencesSchema
});

export const workflowJudgeStrengthSchema = z.strictObject({
  statement: boundedText(),
  pathReferences: pathReferencesSchema,
  evidenceReferences: evidenceReferencesSchema
});

export const workflowJudgeModelOutputSchema = z.strictObject({
  scores: z
    .array(workflowJudgeScoreSchema)
    .length(WORKFLOW_JUDGE_DIMENSIONS.length),
  issues: z
    .array(workflowJudgeIssueSchema)
    .max(WORKFLOW_JUDGE_LIMITS.maxIssues),
  strengths: z
    .array(workflowJudgeStrengthSchema)
    .max(WORKFLOW_JUDGE_LIMITS.maxStrengths),
  summary: z.string().trim().min(1).max(2_000),
  recommendation: z.enum([
    "approve",
    "revise",
    "mark_partially_supported",
    "reject"
  ]),
  uncertainty: z.strictObject({
    level: z.enum(["low", "medium", "high"]),
    explanation: boundedText(),
    evidenceReferences: evidenceReferencesSchema
  })
});

export const workflowJudgeResponseSchema = z.strictObject({
  ok: z.literal(true),
  contractVersion: z.literal(WORKFLOW_JUDGE_CONTRACT_VERSION),
  authority: z.literal("advisory_only"),
  metadata: z.strictObject({
    outputVersion: z.literal(WORKFLOW_JUDGE_OUTPUT_VERSION),
    judgeVersion: z.string().min(1).max(128),
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
    judgedAt: z.string().datetime({ offset: true }),
    workflowId: registryIdSchema,
    workflowRevision: z.number().int().positive(),
    workflowHash: sha256HashSchema,
    validatorVersion: z.string().min(1).max(128),
    promptTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    estimatedCost: z.strictObject({
      currency: z.literal("USD"),
      amount: z.number().finite().nonnegative().nullable(),
      source: z.enum(["deterministic_fallback", "provider_not_priced"])
    })
  }),
  critique: workflowJudgeModelOutputSchema
});

export const workflowJudgeErrorCodeSchema = z.enum([
  "judge.invalid_json.v2",
  "judge.invalid_request.v2",
  "judge.request_too_large.v2",
  "judge.rate_limited.v2",
  "judge.stale_hash.v2",
  "judge.not_eligible.v2",
  "judge.capability_mismatch.v2",
  "judge.trace_evidence_invalid.v2",
  "judge.internal_failure.v2"
]);

export const workflowJudgeErrorResponseSchema = z.strictObject({
  ok: z.literal(false),
  contractVersion: z.literal(WORKFLOW_JUDGE_CONTRACT_VERSION),
  error: z.strictObject({
    code: workflowJudgeErrorCodeSchema,
    message: z.string().min(1).max(500),
    retryable: z.boolean(),
    fieldPaths: z.array(z.string().min(1).max(320)).max(64)
  })
});

export type WorkflowJudgeRequest = z.infer<typeof workflowJudgeRequestSchema>;
export type WorkflowJudgeTraceEvidence = z.infer<
  typeof workflowJudgeTraceEvidenceSchema
>;
export type WorkflowJudgeCapabilitySummary = z.infer<
  typeof workflowJudgeCapabilitySummarySchema
>;
export type WorkflowJudgeDimension = z.infer<
  typeof workflowJudgeDimensionSchema
>;
export type WorkflowJudgeModelOutput = z.infer<
  typeof workflowJudgeModelOutputSchema
>;
export type WorkflowJudgeIssue = z.infer<typeof workflowJudgeIssueSchema>;
export type WorkflowJudgeStrength = z.infer<typeof workflowJudgeStrengthSchema>;
export type WorkflowJudgeResponse = z.infer<typeof workflowJudgeResponseSchema>;
export type WorkflowJudgeErrorResponse = z.infer<
  typeof workflowJudgeErrorResponseSchema
>;
export type WorkflowJudgeErrorCode = z.infer<
  typeof workflowJudgeErrorCodeSchema
>;
