import { z } from "zod";

import {
  resolvedAdapterV2Schema,
  resolvedChemistryModelV2Schema
} from "../schema/v2";
import { normalizedLabActionSchema } from "../runtime/generic/schemas";
import { GENERIC_LAB_RUNTIME_SCHEMA_VERSION } from "../runtime/generic/types";

export const GENERIC_LAB_ACTION_TRACE_SCHEMA_VERSION = "1.0.0" as const;
const id = z.string().min(1).max(240);
const sessionId = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const scalar = z.union([z.boolean(), z.number().finite(), z.string().max(4_000)]);

export const genericTraceProvenanceSchema = z.strictObject({
  workflowId: id,
  workflowRevision: z.number().int().positive(),
  workflowHash: id,
  validatorVersion: id,
  registrySnapshots: z.array(
    z.strictObject({ registryId: id, snapshotId: id })
  ).max(64),
  resolvedAdapters: z.array(resolvedAdapterV2Schema).max(256),
  resolvedChemistryModels: z.array(resolvedChemistryModelV2Schema).max(64)
});

export const genericTraceStudentResponseSchema = z.strictObject({
  afterActionSequence: z.number().int().nonnegative().max(1_000),
  submissionFieldId: id,
  value: scalar
});

export const genericLabActionTraceSchema = z.strictObject({
  schemaVersion: z.literal(GENERIC_LAB_ACTION_TRACE_SCHEMA_VERSION),
  runtimeSchemaVersion: z.literal(GENERIC_LAB_RUNTIME_SCHEMA_VERSION),
  traceId: id,
  sessionId,
  sessionSeed: z.string().min(1).max(256),
  provenance: genericTraceProvenanceSchema,
  actions: z.array(normalizedLabActionSchema).max(1_000),
  studentResponses: z.array(genericTraceStudentResponseSchema).max(256)
}).superRefine((trace, context) => {
  trace.studentResponses.forEach((response, index) => {
    if (response.afterActionSequence > trace.actions.length) {
      context.addIssue({
        code: "custom",
        path: ["studentResponses", index, "afterActionSequence"],
        message: "Response sequence exceeds the trace action count"
      });
    }
  });
});
