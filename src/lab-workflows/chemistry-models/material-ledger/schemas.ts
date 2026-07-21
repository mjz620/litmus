import { z } from "zod";

import { MATERIAL_LEDGER_SCHEMA_VERSION } from "./types";

const idSchema = z.string().min(1).max(240);
const amountSchema = z.number().finite().nonnegative();
export const materialQuantityUnitIdSchema = z.enum([
  "unit.drop.v1",
  "unit.g.v1",
  "unit.ml.v1"
]);

export const materialLocationQuantitySchema = z.strictObject({
  equipmentInstanceId: idSchema,
  amount: amountSchema
});

export const materialLedgerMaterialSchema = z.strictObject({
  materialInstanceId: idSchema,
  materialProfileId: idSchema,
  materialVersion: idSchema,
  unitId: materialQuantityUnitIdSchema,
  initialAmount: amountSchema,
  locations: z.array(materialLocationQuantitySchema).max(64)
});

export const materialLedgerSchema = z.strictObject({
  schemaVersion: z.literal(MATERIAL_LEDGER_SCHEMA_VERSION),
  materials: z.array(materialLedgerMaterialSchema).max(256)
});

export const executedMaterialTransferSchema = z.strictObject({
  kind: z.literal("transfer"),
  materialInstanceId: idSchema,
  materialProfileId: idSchema,
  unitId: materialQuantityUnitIdSchema,
  sourceEquipmentInstanceId: idSchema,
  targetEquipmentInstanceId: idSchema,
  amount: z.number().finite().positive(),
  sourceAmountBefore: amountSchema,
  sourceAmountAfter: amountSchema,
  targetAmountBefore: amountSchema,
  targetAmountAfter: amountSchema
});

export const executedMaterialActionSchema = z.strictObject({
  actionId: idSchema,
  sourceEquipmentInstanceId: idSchema,
  targetEquipmentInstanceIds: z.array(idSchema).min(1).max(64),
  materialInstanceIds: z.array(idSchema).min(1).max(64),
  transfers: z.array(executedMaterialTransferSchema).min(1).max(64)
});
