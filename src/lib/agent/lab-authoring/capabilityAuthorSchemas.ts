import { z } from "zod";

import { registryIdSchema } from "../../../lab-workflows/schema";
import { labWorkflowSpecV2Schema } from "../../../lab-workflows/schema/v2";
import { normalizedLabActionSchema } from "../../../lab-workflows/runtime/generic/schemas";
import { CAPABILITY_AUTHOR_TOOL_LIMITS } from "./capabilitySchemas";

export const CAPABILITY_AUTHOR_LIMITS = Object.freeze({
  requestBytes: 16_000,
  teacherRequestCharacters: 2_000,
  classContextCharacters: 1_000,
  maxRevisionAttempts: 3,
  maxModelCalls: 9,
  // Five trace cases can each contain up to 32 typed actions. Keep enough
  // room for the complete structured plan rather than treating truncation as
  // malformed model output.
  maxOutputTokensPerCall: 12_000,
  timeoutMs: 55_000,
  rateLimitRequests: 5,
  rateLimitWindowMs: 60_000,
  maxAssumptions: 16,
  maxQuestions: 12,
  maxLimitations: 16,
  maxDiagnostics: 32,
  maxTraceActions: 32,
  maxTraceEvidence: 128
});

const boundedText = (maximum = 800) => z.string().trim().min(1).max(maximum);

export const capabilityAuthorRequestSchema = z.strictObject({
  contractVersion: z.literal("2.0.0"),
  teacherRequest: boundedText(
    CAPABILITY_AUTHOR_LIMITS.teacherRequestCharacters
  ),
  gradeBand: z.enum(["9-10", "11-12", "mixed_high_school"]).optional(),
  targetMinutes: z.number().finite().int().min(1).max(120).optional(),
  classContext: boundedText(
    CAPABILITY_AUTHOR_LIMITS.classContextCharacters
  ).optional(),
  deviceProfileId: registryIdSchema
});

export const capabilityAuthorTraceKindSchema = z.enum([
  "valid",
  "alternate_valid",
  "recoverable_mistake",
  "terminal_mistake",
  "tolerance_boundary"
]);

/* Structured Output requires the optional runtime source field as nullable. */
export const capabilityAuthorModelActionSchema =
  normalizedLabActionSchema.extend({
    sourceEquipmentInstanceId:
      normalizedLabActionSchema.shape.sourceEquipmentInstanceId
        .unwrap()
        .nullable()
  });

export const capabilityAuthorPlanTraceCaseSchema = z.strictObject({
  kind: capabilityAuthorTraceKindSchema,
  actions: z
    .array(capabilityAuthorModelActionSchema)
    .max(CAPABILITY_AUTHOR_LIMITS.maxTraceActions)
});

export const capabilityAuthorPlanSchema = z
  .strictObject({
    disposition: z.enum([
      "candidate",
      "needs_clarification",
      "unsupported",
      "rejected_for_safety"
    ]),
    objective: boundedText(1_000),
    assumptions: z
      .array(boundedText())
      .max(CAPABILITY_AUTHOR_LIMITS.maxAssumptions),
    questions: z
      .array(boundedText())
      .max(CAPABILITY_AUTHOR_LIMITS.maxQuestions),
    limitations: z
      .array(boundedText())
      .max(CAPABILITY_AUTHOR_LIMITS.maxLimitations),
    traceCases: z.array(capabilityAuthorPlanTraceCaseSchema).max(5)
  })
  .superRefine((plan, context) => {
    if (plan.disposition === "candidate") {
      const expected = new Set(capabilityAuthorTraceKindSchema.options);
      const actual = new Set(plan.traceCases.map(({ kind }) => kind));
      if (
        plan.traceCases.length !== expected.size ||
        actual.size !== expected.size ||
        [...expected].some((kind) => !actual.has(kind))
      ) {
        context.addIssue({
          code: "custom",
          path: ["traceCases"],
          message:
            "Candidate plans require exactly one case of every trace kind"
        });
      }
    } else if (plan.traceCases.length > 0) {
      context.addIssue({
        code: "custom",
        path: ["traceCases"],
        message: "Non-candidate plans cannot claim executable traces"
      });
    }
  });

const STRICT_OUTPUT_FORBIDDEN_SCHEMA_KEYS = new Set([
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "pattern",
  "format",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "$schema",
  "default"
]);

/**
 * OpenAI strict JSON Schema accepts the object/union structure produced by
 * Zod, but rejects validation bounds such as `maxItems` and `minLength`.
 * Those bounds remain mandatory when the returned plan is parsed below; this
 * projection is only the provider's output-shape contract.
 */
export function strictifyCapabilityAuthorOutputSchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(strictifyCapabilityAuthorOutputSchema);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const entries = Object.entries(value)
    .filter(([key]) => !STRICT_OUTPUT_FORBIDDEN_SCHEMA_KEYS.has(key))
    .map(([key, nested]) => [
      key === "oneOf" ? "anyOf" : key,
      strictifyCapabilityAuthorOutputSchema(nested)
    ] as const);
  const anyOfEntries = entries.filter(([key]) => key === "anyOf");
  if (anyOfEntries.length < 2) return Object.fromEntries(entries);
  return Object.fromEntries([
    ...entries.filter(([key]) => key !== "anyOf"),
    [
      "anyOf",
      anyOfEntries.flatMap(([, nested]) =>
        Array.isArray(nested) ? nested : [nested]
      )
    ]
  ]);
}

/** A fresh JSON-safe strict schema for each provider request. */
export function capabilityAuthorPlanStrictJsonSchema(): Record<string, unknown> {
  const schema = strictifyCapabilityAuthorOutputSchema(
    z.toJSONSchema(capabilityAuthorPlanSchema)
  );
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    throw new Error("Capability author output schema must be an object.");
  }
  return schema as Record<string, unknown>;
}

export const capabilityAuthorDiagnosticSchema = z.strictObject({
  source: z.enum(["validation", "trace", "tool", "model", "limit"]),
  code: z.string().min(1).max(160),
  path: z.string().min(1).max(300),
  message: z.string().min(1).max(800),
  safetyRelated: z.boolean()
});

export const capabilityAuthorTraceDiagnosisSchema = z.strictObject({
  ruleId: z.string().min(1).max(240),
  status: z.enum(["satisfied", "violated", "pending"]),
  severity: z.enum([
    "info",
    "best-practice",
    "procedural",
    "conceptual",
    "safety"
  ]),
  recoverable: z.boolean(),
  evidenceEventIds: z
    .array(z.string().min(1).max(240))
    .max(CAPABILITY_AUTHOR_LIMITS.maxTraceEvidence)
});

export const capabilityAuthorTraceSummarySchema = z.strictObject({
  kind: capabilityAuthorTraceKindSchema,
  traceId: z.string().min(1).max(240),
  passed: z.boolean(),
  actionCount: z
    .number()
    .int()
    .min(0)
    .max(CAPABILITY_AUTHOR_LIMITS.maxTraceActions),
  workflowStatus: z.enum(["in_progress", "completed", "failed"]).nullable(),
  eventIds: z
    .array(z.string().min(1).max(240))
    .max(CAPABILITY_AUTHOR_LIMITS.maxTraceEvidence),
  evidenceEventIds: z
    .array(z.string().min(1).max(240))
    .max(CAPABILITY_AUTHOR_LIMITS.maxTraceEvidence),
  diagnoses: z
    .array(capabilityAuthorTraceDiagnosisSchema)
    .max(CAPABILITY_AUTHOR_LIMITS.maxTraceEvidence),
  observables: z
    .array(
      z.strictObject({
        observableId: z.string().min(1).max(240),
        value: z.union([z.boolean(), z.number().finite(), z.string().max(400)]),
        unitId: z.string().min(1).max(240).nullable()
      })
    )
    .max(CAPABILITY_AUTHOR_LIMITS.maxTraceEvidence),
  error: capabilityAuthorDiagnosticSchema.nullable()
});

export const capabilityAuthorValidationSummarySchema = z.strictObject({
  status: z.enum([
    "runnable",
    "partially_supported",
    "unsupported",
    "rejected_for_safety"
  ]),
  runnable: z.boolean(),
  previewEligible: z.boolean(),
  canonicalSpecHash: z.string().min(1).max(160),
  validatorVersion: z.string().min(1).max(160),
  checkedAt: z.string().min(1).max(160),
  issues: z
    .array(capabilityAuthorDiagnosticSchema)
    .max(CAPABILITY_AUTHOR_LIMITS.maxDiagnostics)
});

export const capabilityAuthorHashLineageEntrySchema = z.strictObject({
  attempt: z
    .number()
    .int()
    .min(1)
    .max(CAPABILITY_AUTHOR_LIMITS.maxRevisionAttempts),
  revision: z.number().int().min(1).max(1_000_000),
  draftHash: z.string().min(1).max(160),
  validationStatus: z.enum([
    "runnable",
    "partially_supported",
    "unsupported",
    "rejected_for_safety"
  ]),
  runnable: z.boolean()
});

export const capabilityAuthorToolAuditEntrySchema = z.strictObject({
  sequence: z
    .number()
    .int()
    .min(1)
    .max(CAPABILITY_AUTHOR_TOOL_LIMITS.maxToolCalls + 1),
  name: z.string().min(1).max(120),
  status: z.enum(["ok", "error"]),
  revisionBefore: z.number().int().min(1).max(1_000_000),
  revisionAfter: z.number().int().min(1).max(1_000_000),
  errorCode: z.string().min(1).max(160).nullable()
});

export const capabilityAuthorUsageSchema = z.strictObject({
  modelCalls: z
    .number()
    .int()
    .min(0)
    .max(CAPABILITY_AUTHOR_LIMITS.maxModelCalls),
  toolCalls: z
    .number()
    .int()
    .min(0)
    .max(CAPABILITY_AUTHOR_TOOL_LIMITS.maxToolCalls + 1),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  estimatedCost: z.strictObject({
    currency: z.literal("USD"),
    amount: z.number().finite().nonnegative().nullable(),
    source: z.enum(["deterministic_mock", "provider_not_priced"])
  })
});

export const capabilityAuthorSuccessResponseSchema = z.strictObject({
  ok: z.literal(true),
  metadata: z.strictObject({
    contractVersion: z.literal("2.0.0"),
    promptVersion: z.string().min(1).max(80),
    toolContractVersion: z.string().min(1).max(80),
    outputSchemaVersion: z.literal("2.0.0"),
    model: z.string().min(1).max(160),
    mode: z.enum(["live", "mock"]),
    registrySnapshotIds: z.record(registryIdSchema, z.string().min(1).max(160)),
    limits: z.strictObject({
      maxRevisionAttempts: z.literal(
        CAPABILITY_AUTHOR_LIMITS.maxRevisionAttempts
      ),
      maxModelCalls: z.literal(CAPABILITY_AUTHOR_LIMITS.maxModelCalls),
      maxToolCalls: z.literal(CAPABILITY_AUTHOR_TOOL_LIMITS.maxToolCalls),
      maxOutputTokensPerCall: z.literal(
        CAPABILITY_AUTHOR_LIMITS.maxOutputTokensPerCall
      ),
      timeoutMs: z.literal(CAPABILITY_AUTHOR_LIMITS.timeoutMs)
    }),
    usage: capabilityAuthorUsageSchema,
    hashLineage: z
      .array(capabilityAuthorHashLineageEntrySchema)
      .max(CAPABILITY_AUTHOR_LIMITS.maxRevisionAttempts),
    toolAudit: z
      .array(capabilityAuthorToolAuditEntrySchema)
      .max(CAPABILITY_AUTHOR_TOOL_LIMITS.maxToolCalls + 1)
  }),
  result: z.strictObject({
    outcome: z.enum([
      "runnable",
      "needs_clarification",
      "unsupported",
      "rejected_for_safety",
      "limited"
    ]),
    objective: boundedText(1_000),
    assumptions: z
      .array(boundedText())
      .max(CAPABILITY_AUTHOR_LIMITS.maxAssumptions),
    questions: z
      .array(boundedText())
      .max(CAPABILITY_AUTHOR_LIMITS.maxQuestions),
    limitations: z
      .array(boundedText())
      .max(CAPABILITY_AUTHOR_LIMITS.maxLimitations),
    workflow: labWorkflowSpecV2Schema.nullable(),
    validation: capabilityAuthorValidationSummarySchema.nullable(),
    traces: z.array(capabilityAuthorTraceSummarySchema).max(5),
    unresolvedDiagnostics: z
      .array(capabilityAuthorDiagnosticSchema)
      .max(CAPABILITY_AUTHOR_LIMITS.maxDiagnostics)
  })
});

export const capabilityAuthorErrorCodeSchema = z.enum([
  "authoring.invalid_json.v2",
  "authoring.invalid_request.v2",
  "authoring.request_too_large.v2",
  // Authoring reaches a paid model, so the route authenticates before running.
  "authoring.unauthenticated.v2",
  "authoring.forbidden.v2",
  "authoring.rate_limited.v2",
  "authoring.model_refused.v2",
  "authoring.provider_configuration.v2",
  "authoring.provider_retryable.v2",
  "authoring.model_unavailable.v2",
  "authoring.tool_failure.v2",
  "authoring.timeout.v2",
  "authoring.output_truncated.v2",
  "authoring.output_invalid.v2",
  "authoring.internal_failure.v2"
]);

export const capabilityAuthorErrorResponseSchema = z.strictObject({
  ok: z.literal(false),
  metadata: z.strictObject({
    contractVersion: z.literal("2.0.0"),
    promptVersion: z.string().min(1).max(80),
    toolContractVersion: z.string().min(1).max(80)
  }),
  error: z.strictObject({
    code: capabilityAuthorErrorCodeSchema,
    message: z.string().min(1).max(500),
    retryable: z.boolean(),
    fieldPaths: z.array(z.string().min(1).max(256)).max(64)
  })
});

export const capabilityAuthorProgressStageSchema = z.enum([
  "understanding_request",
  "checking_available_parts",
  "building_draft",
  "checking_lab",
  "testing_student_paths",
  "using_verified_fallback",
  "finalizing"
]);

export const capabilityAuthorProgressSchema = z.strictObject({
  stage: capabilityAuthorProgressStageSchema,
  message: z.string().min(1).max(180)
});

export const capabilityAuthorStreamEventSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("progress"),
    progress: capabilityAuthorProgressSchema
  }),
  z.strictObject({
    type: z.literal("result"),
    result: capabilityAuthorSuccessResponseSchema
  }),
  z.strictObject({
    type: z.literal("error"),
    error: capabilityAuthorErrorResponseSchema
  })
]);

export type CapabilityAuthorRequest = z.infer<
  typeof capabilityAuthorRequestSchema
>;
export type CapabilityAuthorPlan = z.infer<typeof capabilityAuthorPlanSchema>;
export type CapabilityAuthorDiagnostic = z.infer<
  typeof capabilityAuthorDiagnosticSchema
>;
export type CapabilityAuthorTraceSummary = z.infer<
  typeof capabilityAuthorTraceSummarySchema
>;
export type CapabilityAuthorSuccessResponse = z.infer<
  typeof capabilityAuthorSuccessResponseSchema
>;
export type CapabilityAuthorErrorCode = z.infer<
  typeof capabilityAuthorErrorCodeSchema
>;
export type CapabilityAuthorErrorResponse = z.infer<
  typeof capabilityAuthorErrorResponseSchema
>;
export type CapabilityAuthorProgress = z.infer<
  typeof capabilityAuthorProgressSchema
>;
export type CapabilityAuthorStreamEvent = z.infer<
  typeof capabilityAuthorStreamEventSchema
>;
