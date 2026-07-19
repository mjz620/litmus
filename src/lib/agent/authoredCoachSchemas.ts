import { z } from "zod";

import { semanticEventEnvelopeV2Schema } from "../../lab-workflows/events";
import {
  instructionSectionsSchema,
  workflowDiagnosesSchema,
  workflowRulesSchema
} from "../../lab-workflows/schema/conditions";
import { validatedLabWorkflowSpecV2Schema } from "../../lab-workflows/schema/v2";

export const AUTHORED_COACH_CONTRACT_VERSION = "2.0.0" as const;
export const AUTHORED_COACH_CONTEXT_VERSION = "2.0.0" as const;
export const AUTHORED_COACH_OUTPUT_VERSION = "2.0.0" as const;

const identifierSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const uniqueIdentifiers = (maximum: number) =>
  z
    .array(identifierSchema)
    .max(maximum)
    .refine((values) => new Set(values).size === values.length, {
      message: "Identifiers must be unique"
    });

export const authoredCoachAvailableActionSchema = z.strictObject({
  permissionId: identifierSchema,
  actionId: identifierSchema
});

/**
 * Coach-only context. It is intentionally separate from checkpoint persistence:
 * old saved consumer envelopes remain unchanged while the live coach receives
 * the exact validated definition and its current deterministic projections.
 */
export const authoredCoachWorkflowContextSchema = z.strictObject({
  schemaVersion: z.literal(AUTHORED_COACH_CONTEXT_VERSION),
  definition: validatedLabWorkflowSpecV2Schema,
  definitionHash: identifierSchema,
  runtime: z.strictObject({
    sessionId: z.string().min(1).max(160),
    workflowId: identifierSchema,
    workflowRevision: z.number().int().positive(),
    workflowHash: identifierSchema,
    validatorVersion: identifierSchema,
    workflowStatus: z.enum(["in_progress", "completed", "failed"]),
    permissionAttempts: z
      .array(
        z.strictObject({
          permissionId: identifierSchema,
          count: z.number().int().nonnegative().max(1_000)
        })
      )
      .max(256)
  }),
  activeObjectiveIds: uniqueIdentifiers(64),
  instructions: instructionSectionsSchema,
  rules: workflowRulesSchema,
  diagnoses: workflowDiagnosesSchema,
  evidence: z.array(semanticEventEnvelopeV2Schema).max(1_000),
  availableActions: z.array(authoredCoachAvailableActionSchema).max(256)
});

export const authoredCoachTriggerPolicySchema = z.strictObject({
  source: z.enum(["event", "question", "retry"]),
  reasons: uniqueIdentifiers(64),
  maxHintLevel: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3)
  ])
});

export const authoredCoachRequestSchema = z.strictObject({
  contractVersion: z.literal(AUTHORED_COACH_CONTRACT_VERSION),
  sessionId: z.string().min(1).max(160),
  experimentId: z.string().min(1).max(128),
  workflowContext: authoredCoachWorkflowContextSchema,
  studentQuestion: z.string().trim().min(1).max(600).optional(),
  triggerPolicy: authoredCoachTriggerPolicySchema
});

export const authoredCoachGuidanceKindSchema = z.enum([
  "mandatory_procedure",
  "safety",
  "optional_context",
  "ai_guidance"
]);

export const authoredCoachGuidanceSchema = z.strictObject({
  kind: authoredCoachGuidanceKindSchema,
  title: z.string().trim().min(1).max(160),
  objectiveIds: uniqueIdentifiers(64),
  ruleIds: uniqueIdentifiers(64),
  instructionIds: uniqueIdentifiers(64),
  evidenceEventIds: uniqueIdentifiers(128),
  recoveryActionIds: uniqueIdentifiers(32)
});

export const authoredCoachModelOutputSchema = z
  .strictObject({
    shouldRespond: z.boolean(),
    interventionType: z.enum([
      "none",
      "hint",
      "question",
      "warning",
      "encouragement"
    ]),
    hintLevel: z.number().int().min(0).max(3),
    message: z.string().max(1_200),
    guidance: authoredCoachGuidanceSchema.nullable(),
    safety: z.strictObject({
      refused: z.boolean(),
      reason: z.string().max(400).nullable()
    })
  })
  .superRefine((output, context) => {
    if (output.shouldRespond && (!output.message.trim() || !output.guidance)) {
      context.addIssue({
        code: "custom",
        path: ["guidance"],
        message: "A response requires a message and structured guidance"
      });
    }
    if (
      !output.shouldRespond &&
      (output.interventionType !== "none" ||
        output.hintLevel !== 0 ||
        output.message !== "" ||
        output.guidance !== null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["shouldRespond"],
        message: "A silent response cannot contain guidance"
      });
    }
  });

export const authoredCoachResponseSchema = z.strictObject({
  ok: z.literal(true),
  contractVersion: z.literal(AUTHORED_COACH_CONTRACT_VERSION),
  shouldRespond: z.boolean(),
  interventionType: z.enum([
    "none",
    "hint",
    "question",
    "warning",
    "encouragement"
  ]),
  skillIds: uniqueIdentifiers(16),
  hintLevel: z.number().int().min(0).max(3),
  message: z.string().max(1_200),
  evidenceEventTypes: uniqueIdentifiers(32),
  guidance: authoredCoachGuidanceSchema.nullable(),
  safety: z.strictObject({
    refused: z.boolean(),
    reason: z.string().max(400).nullable()
  }),
  authority: z.strictObject({
    kind: z.literal("advisory"),
    simulationStateChanged: z.literal(false),
    canResetCheckpoint: z.literal(false),
    canChangeWorkflowRules: z.literal(false)
  }),
  metadata: z.strictObject({
    outputVersion: z.literal(AUTHORED_COACH_OUTPUT_VERSION),
    coachVersion: z.string().min(1).max(128),
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
    definitionId: identifierSchema,
    definitionRevision: z.number().int().positive(),
    definitionHash: identifierSchema
  })
});

export const authoredCoachErrorCodeSchema = z.enum([
  "coach.invalid_request.v2",
  "coach.stale_definition.v2",
  "coach.context_mismatch.v2",
  "coach.unsupported_reference.v2",
  "coach.trigger_not_authorized.v2"
]);

export const authoredCoachErrorResponseSchema = z.strictObject({
  ok: z.literal(false),
  contractVersion: z.literal(AUTHORED_COACH_CONTRACT_VERSION),
  error: z.strictObject({
    code: authoredCoachErrorCodeSchema,
    message: z.string().min(1).max(500),
    fieldPaths: z.array(z.string().min(1).max(256)).max(64)
  })
});

export type AuthoredCoachWorkflowContext = z.infer<
  typeof authoredCoachWorkflowContextSchema
>;
export type AuthoredCoachRequest = z.infer<typeof authoredCoachRequestSchema>;
export type AuthoredCoachGuidanceKind = z.infer<
  typeof authoredCoachGuidanceKindSchema
>;
export type AuthoredCoachGuidance = z.infer<typeof authoredCoachGuidanceSchema>;
export type AuthoredCoachModelOutput = z.infer<
  typeof authoredCoachModelOutputSchema
>;
export type AuthoredCoachResponse = z.infer<typeof authoredCoachResponseSchema>;
export type AuthoredCoachErrorCode = z.infer<
  typeof authoredCoachErrorCodeSchema
>;
