import {
  MATERIAL_LEDGER_ERROR_CODES as ERROR,
  MaterialLedgerError
} from "../material-ledger/errors";
import { quantityToIntegerUnits, volumeAt } from "../material-ledger/quantity";
import type {
  MaterialContainerCapacity,
  MaterialLedger
} from "../material-ledger/types";

function capacityFor(
  capacities: readonly MaterialContainerCapacity[],
  equipmentInstanceId: string
): number | null {
  const capacity = capacities.find(
    (candidate) => candidate.equipmentInstanceId === equipmentInstanceId
  );
  if (!capacity) {
    throw new MaterialLedgerError(
      ERROR.unknownLocation,
      `Unknown material location ${equipmentInstanceId}.`,
      { equipmentInstanceId }
    );
  }
  return capacity.capacityML;
}

export function assertContainerVolumeWithinCapacity(
  ledger: Readonly<MaterialLedger>,
  equipmentInstanceId: string,
  capacities: readonly MaterialContainerCapacity[]
): void {
  const capacityML = capacityFor(capacities, equipmentInstanceId);
  if (capacityML === null) return;
  const volumeML = volumeAt(ledger, equipmentInstanceId);
  if (
    quantityToIntegerUnits(volumeML, "unit.ml.v1") >
    quantityToIntegerUnits(capacityML, "unit.ml.v1")
  ) {
    throw new MaterialLedgerError(
      ERROR.targetCapacityExceeded,
      "Material transfer exceeds target capacity.",
      { equipmentInstanceId, capacityML, resultingVolumeML: volumeML }
    );
  }
}

export function assertVolumeConserved(
  before: Readonly<MaterialLedger>,
  after: Readonly<MaterialLedger>
): void {
  if (before.materials.length !== after.materials.length) {
    throw new MaterialLedgerError(
      ERROR.conservationViolation,
      "Material set changed during a volume-conserving transition."
    );
  }
  for (const previous of before.materials) {
    const next = after.materials.find(
      ({ materialInstanceId }) =>
        materialInstanceId === previous.materialInstanceId
    );
    if (
      !next ||
      next.unitId !== previous.unitId ||
      quantityToIntegerUnits(next.initialAmount, next.unitId) !==
        quantityToIntegerUnits(previous.initialAmount, previous.unitId)
    ) {
      throw new MaterialLedgerError(
        ERROR.conservationViolation,
        `Material ${previous.materialInstanceId} changed conserved quantity.`,
        { materialInstanceId: previous.materialInstanceId }
      );
    }
  }
}

export function assertKnownMaterialContainer(
  equipmentInstanceId: string,
  capacities: readonly MaterialContainerCapacity[]
): void {
  capacityFor(capacities, equipmentInstanceId);
}
