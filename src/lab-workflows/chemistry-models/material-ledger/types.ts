export const MATERIAL_LEDGER_SCHEMA_VERSION = "1.0.0" as const;

export type MaterialQuantityUnitId =
  | "unit.drop.v1"
  | "unit.g.v1"
  | "unit.ml.v1";

export interface MaterialLocationQuantity {
  readonly equipmentInstanceId: string;
  readonly amount: number;
}

/**
 * One authored material instance may be split across multiple containers.
 * `initialAmount` is immutable and is the conservation anchor for replay.
 */
export interface MaterialLedgerMaterial {
  readonly materialInstanceId: string;
  readonly materialProfileId: string;
  readonly materialVersion: string;
  readonly unitId: MaterialQuantityUnitId;
  readonly initialAmount: number;
  readonly locations: readonly MaterialLocationQuantity[];
}

export interface MaterialLedger {
  readonly schemaVersion: typeof MATERIAL_LEDGER_SCHEMA_VERSION;
  readonly materials: readonly MaterialLedgerMaterial[];
}

export interface ExecutedMaterialTransfer {
  readonly kind: "transfer";
  readonly materialInstanceId: string;
  readonly materialProfileId: string;
  readonly unitId: MaterialQuantityUnitId;
  readonly sourceEquipmentInstanceId: string;
  readonly targetEquipmentInstanceId: string;
  readonly amount: number;
  readonly sourceAmountBefore: number;
  readonly sourceAmountAfter: number;
  readonly targetAmountBefore: number;
  readonly targetAmountAfter: number;
}

export interface ExecutedMaterialAction {
  readonly actionId: string;
  readonly sourceEquipmentInstanceId: string;
  readonly targetEquipmentInstanceIds: readonly string[];
  readonly materialInstanceIds: readonly string[];
  readonly transfers: readonly ExecutedMaterialTransfer[];
}

export interface InitialMaterialLedgerBinding {
  readonly materialInstanceId: string;
  readonly materialProfileId: string;
  readonly materialVersion: string;
  readonly containerInstanceId: string;
  readonly amount: number;
  readonly unitId: MaterialQuantityUnitId;
}

export interface MaterialContainerCapacity {
  readonly equipmentInstanceId: string;
  readonly capacityML: number | null;
}
