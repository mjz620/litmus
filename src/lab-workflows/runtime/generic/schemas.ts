import { z } from "zod";

import { workflowDiagnosisSchema } from "../../schema/conditions";
import {
  executedMaterialActionSchema,
  materialLedgerSchema
} from "../../chemistry-models/material-ledger";
import {
  resolvedAdapterV2Schema,
  resolvedChemistryModelV2Schema
} from "../../schema/v2";
import { GENERIC_LAB_RUNTIME_SCHEMA_VERSION } from "./types";
import {
  semanticEventEnvelopeV2Schema,
  semanticEventPayloadSchema
} from "../../events/schemas";

const LIMIT = 1_000;
const idSchema = z.string().min(1).max(240);
const sessionIdSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const deterministicSeedSchema = z.string().trim().min(1).max(256);
const finiteNumberSchema = z.number().finite();
const stateValueSchema = z.union([
  z.null(),
  z.boolean(),
  finiteNumberSchema,
  z.string().max(4_000),
  z.array(z.string().max(4_000)).max(256)
]);
const observationValueSchema = z.union([
  z.boolean(),
  finiteNumberSchema,
  z.string().max(4_000)
]);

export const genericLabConfigSchema = z.strictObject({
  schemaVersion: z.literal(GENERIC_LAB_RUNTIME_SCHEMA_VERSION),
  sessionId: sessionIdSchema,
  workflowId: idSchema,
  workflowRevision: z.number().int().min(1),
  workflowHash: idSchema,
  sessionSeed: deterministicSeedSchema.optional()
});

export const normalizedLabActionSchema = z.strictObject({
  schemaVersion: z.literal(GENERIC_LAB_RUNTIME_SCHEMA_VERSION),
  permissionId: idSchema,
  actionId: idSchema,
  sourceEquipmentInstanceId: idSchema.optional(),
  targetEquipmentInstanceIds: z.array(idSchema).max(64),
  parameters: z
    .array(
      z.discriminatedUnion("valueType", [
        z.strictObject({
          key: idSchema,
          valueType: z.literal("number"),
          value: finiteNumberSchema
        }),
        z.strictObject({
          key: idSchema,
          valueType: z.literal("string"),
          value: z.string().max(4_000)
        }),
        z.strictObject({
          key: idSchema,
          valueType: z.literal("enum"),
          value: z.string().max(4_000)
        })
      ])
    )
    .max(64)
});

export const genericStateFieldSchema = z.strictObject({
  key: idSchema,
  value: stateValueSchema
});

export const genericEquipmentStateSchema = z.strictObject({
  instanceId: idSchema,
  equipmentDefinitionId: idSchema,
  stateSchemaId: idSchema,
  fields: z.array(genericStateFieldSchema).max(256)
});

export const genericMaterialActionSchema = executedMaterialActionSchema;

export const genericObservableSchema = z.strictObject({
  observableId: idSchema,
  value: observationValueSchema,
  unitId: idSchema.optional()
});

export const genericModelStateSchema = z.strictObject({
  modelId: idSchema,
  modelVersion: idSchema,
  fields: z.array(genericStateFieldSchema).max(256)
});

export const genericChemistryProjectionSchema = z.strictObject({
  modelStates: z.array(genericModelStateSchema).max(64),
  observables: z.array(genericObservableSchema).max(256),
  groundTruth: z.strictObject({
    values: z.record(idSchema, finiteNumberSchema),
    notes: z.array(z.string().max(4_000)).max(256)
  })
});

export const semanticEventSchema = semanticEventPayloadSchema;

const runtimeProvenanceSchema = z.strictObject({
  workflowId: idSchema,
  workflowRevision: z.number().int().min(1),
  workflowHash: idSchema,
  validatorVersion: idSchema,
  registrySnapshots: z
    .array(z.strictObject({ registryId: idSchema, snapshotId: idSchema }))
    .max(64),
  resolvedAdapters: z.array(resolvedAdapterV2Schema).max(256),
  resolvedChemistryModels: z.array(resolvedChemistryModelV2Schema).max(64),
  compatibility: z
    .strictObject({
      kind: z.literal("legacy_v1"),
      runtimeAdapterId: idSchema,
      runtimeAdapterVersion: idSchema,
      engineId: idSchema,
      engineVersion: idSchema,
      experimentDefinitionId: idSchema,
      experimentDefinitionVersion: idSchema
    })
    .nullable()
});

export const genericLegacyCompatibilityStateSchema = z.strictObject({
  runtimeAdapterId: idSchema,
  runtimeAdapterVersion: idSchema,
  stateSchemaId: idSchema,
  serializedState: z.string().min(2).max(2_000_000)
});

export const genericLabStateSchema = z.strictObject({
  schemaVersion: z.literal(GENERIC_LAB_RUNTIME_SCHEMA_VERSION),
  sessionId: sessionIdSchema,
  provenance: runtimeProvenanceSchema,
  sequence: z.number().int().min(0),
  equipment: z.array(genericEquipmentStateSchema).max(64),
  materialLedger: materialLedgerSchema,
  chemistry: genericChemistryProjectionSchema,
  workflowStatus: z.enum(["in_progress", "completed", "failed"]),
  diagnoses: z.array(workflowDiagnosisSchema).max(256),
  permissionAttempts: z
    .array(
      z.strictObject({
        permissionId: idSchema,
        count: z.number().int().min(0).max(LIMIT)
      })
    )
    .max(256),
  eventSequence: z.number().int().nonnegative().max(LIMIT),
  eventEnvelopes: z.array(semanticEventEnvelopeV2Schema).max(LIMIT),
  compatibilityState: genericLegacyCompatibilityStateSchema.nullable()
});
