import { z } from "zod";

import { labWorkflowConsumerContextSchema } from "../../lab-workflows/consumers";
import type {
  AuthoredCoachRequest,
  AuthoredCoachResponse
} from "./authoredCoachSchemas";

const scalarSchema = z.union([z.string(), z.number(), z.boolean()]);
export const semanticEventSchema = z.object({
  type: z.string().min(1).max(128),
  tSim: z.number().finite().nonnegative(),
  observation: z.record(z.string(), scalarSchema),
  flags: z.array(z.string().min(1).max(128)).max(64),
  evidence: z
    .array(
      z.object({
        skillId: z.string().min(1).max(128),
        delta: z.number().finite().min(-1).max(1),
        reason: z.string().min(1).max(128),
        detail: z.record(z.string(), scalarSchema).optional()
      })
    )
    .max(64)
});

export const studentModelSchema = z.object({
  sessionId: z.string().min(1).max(160),
  experimentId: z.string().min(1).max(128),
  skills: z.record(
    z.string(),
    z.object({
      mastery: z.number().min(0).max(1),
      evidenceCount: z.number().int().nonnegative(),
      lastReason: z.string().max(128).optional()
    })
  ),
  activeFlags: z.array(z.string().max(128)).max(64)
});

export const coachRequestSchema = z.object({
  sessionId: z.string().min(1).max(160),
  experimentId: z.string().min(1).max(128),
  currentState: z.unknown(),
  recentEvents: z.array(semanticEventSchema).max(50),
  studentModel: studentModelSchema,
  labWorkflowContext: labWorkflowConsumerContextSchema.optional(),
  studentQuestion: z.string().trim().min(1).max(600).optional(),
  activeProcedureStep: z.string().max(160).optional(),
  triggerPolicy: z.object({
    source: z.enum(["event", "question", "retry"]),
    maxHintLevel: z.number().int().min(0).max(3)
  })
});

export const coachResponseSchema = z.object({
  shouldRespond: z.boolean(),
  interventionType: z.enum([
    "none",
    "hint",
    "question",
    "warning",
    "encouragement"
  ]),
  skillIds: z.array(z.string().min(1).max(128)).max(16),
  hintLevel: z.number().int().min(0).max(3),
  message: z.string().max(1200),
  /*
   * OpenAI structured outputs require every field, so `.optional()` alone
   * makes the API reject the whole schema — which the coach was silently
   * swallowing into its canned local response, so every question returned
   * generic mock text instead of a real answer. `.nullable()` keeps the
   * schema API-legal; the model returns null when it has no suggestion.
   */
  suggestedToolCall: z
    .object({
      name: z.enum([
        "create_targeted_retry",
        "record_diagnosis",
        "set_learning_goal"
      ]),
      /*
       * A JSON-encoded object, not an open record. OpenAI structured outputs
       * reject the `propertyNames` an open `z.record` emits, which failed the
       * whole schema and dropped every coach answer to the canned local
       * response. A string keeps the field expressive and API-legal.
       */
      args: z.string()
    })
    .nullable()
    .optional(),
  evidenceEventTypes: z.array(z.string().min(1).max(128)).max(32),
  safety: z.object({
    refused: z.boolean(),
    reason: z.string().max(400).nullable().optional()
  })
});

export type CoachRequest = z.infer<typeof coachRequestSchema>;
export type CoachResponse = z.infer<typeof coachResponseSchema>;
export type AnyCoachRequest =
  | CoachRequest
  | (AuthoredCoachRequest & { readonly labWorkflowContext?: undefined });
export type AnyCoachResponse = CoachResponse | AuthoredCoachResponse;
