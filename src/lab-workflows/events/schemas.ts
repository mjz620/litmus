import { z } from "zod";

import { GENERIC_LAB_RUNTIME_SCHEMA_VERSION } from "../runtime/generic/types";
import { SEMANTIC_EVENT_ENVELOPE_SCHEMA_VERSION } from "./types";

const id = z.string().min(1).max(256);
const payloadId = z.string().min(1).max(128);
const scalar = z.union([z.boolean(), z.number().finite(), z.string().max(4_000)]);
const normalizedAction = z.strictObject({
  schemaVersion: z.literal(GENERIC_LAB_RUNTIME_SCHEMA_VERSION),
  permissionId: id,
  actionId: id,
  sourceEquipmentInstanceId: id.optional(),
  targetEquipmentInstanceIds: z.array(id).max(64),
  parameters: z.array(
    z.discriminatedUnion("valueType", [
      z.strictObject({ key: id, valueType: z.literal("number"), value: z.number().finite() }),
      z.strictObject({ key: id, valueType: z.literal("string"), value: z.string().max(4_000) }),
      z.strictObject({ key: id, valueType: z.literal("enum"), value: z.string().max(4_000) })
    ])
  ).max(64)
});
export const semanticEventPayloadSchema = z.strictObject({
  type: payloadId,
  tSim: z.number().finite().nonnegative(),
  observation: z.record(id, scalar),
  flags: z.array(payloadId).max(64),
  evidence: z.array(
    z.strictObject({
      skillId: payloadId,
      delta: z.number().finite().min(-1).max(1),
      reason: payloadId,
      detail: z.record(id, scalar).optional()
    })
  ).max(256)
});

export const semanticEventEnvelopeV2Schema = z.strictObject({
  schemaVersion: z.literal(SEMANTIC_EVENT_ENVELOPE_SCHEMA_VERSION),
  eventId: id,
  sequence: z.number().int().nonnegative().max(1_000_000),
  actionSequence: z.number().int().positive().max(1_000_000),
  normalizedAction,
  sourceEquipmentInstanceId: id.optional(),
  targetEquipmentInstanceIds: z.array(id).max(64),
  materialInstanceIds: z.array(id).max(64),
  ruleEvidenceIds: z.array(id).max(256),
  payload: semanticEventPayloadSchema
}).superRefine((envelope, context) => {
  for (const key of [
    "targetEquipmentInstanceIds",
    "materialInstanceIds",
    "ruleEvidenceIds"
  ] as const) {
    if (new Set(envelope[key]).size !== envelope[key].length) {
      context.addIssue({ code: "custom", path: [key], message: `${key} must be unique` });
    }
  }
});
