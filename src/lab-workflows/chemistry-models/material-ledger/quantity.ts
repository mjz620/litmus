import {
  MATERIAL_LEDGER_ERROR_CODES as ERROR,
  MaterialLedgerError
} from "./errors";
import type { MaterialLedger, MaterialQuantityUnitId } from "./types";

const VOLUME_UNITS_PER_ML = 1_000_000;
/** Micrograms preserve exact centigram-balance readings in the shared ledger. */
const MASS_UNITS_PER_G = 1_000_000;

function unitsPerQuantity(unitId: MaterialQuantityUnitId): number {
  if (unitId === "unit.ml.v1") return VOLUME_UNITS_PER_ML;
  if (unitId === "unit.g.v1") return MASS_UNITS_PER_G;
  return 1;
}

export function quantityToIntegerUnits(
  amount: number,
  unitId: MaterialQuantityUnitId,
  allowZero = true
): number {
  if (!Number.isFinite(amount) || amount < 0 || (!allowZero && amount <= 0)) {
    throw new MaterialLedgerError(
      ERROR.invalidAmount,
      "Material quantity must be finite and positive.",
      { amount }
    );
  }
  const scale = unitsPerQuantity(unitId);
  const scaled = Math.round(amount * scale);
  /*
   * Tolerance scales with magnitude. A fixed absolute epsilon rejected totals
   * that had merely accumulated float error: ~50 dropwise 0.1 mL additions sum
   * to 23.299999999999997, which is representable to the micro-litre but drifts
   * past a fixed bound — so a student titrating dropwise hit a hard runtime
   * failure partway down the burette. Genuinely sub-unit quantities are still
   * rejected, because their error is a fraction of the amount, not of its ulp.
   */
  const tolerance = Math.max(
    Number.EPSILON * 16,
    Math.abs(amount) * Number.EPSILON * 16
  );
  if (
    !Number.isSafeInteger(scaled) ||
    Math.abs(scaled / scale - amount) > tolerance
  ) {
    throw new MaterialLedgerError(
      ERROR.invalidAmount,
      `Material quantity is not representable in ${unitId}.`,
      { amount, unitId }
    );
  }
  return scaled;
}

export function integerUnitsToQuantity(
  units: number,
  unitId: MaterialQuantityUnitId
): number {
  if (!Number.isSafeInteger(units) || units < 0) {
    throw new MaterialLedgerError(
      ERROR.invalidAmount,
      "Material integer quantity is invalid.",
      { units, unitId }
    );
  }
  return units / unitsPerQuantity(unitId);
}

export function volumeAt(
  ledger: Readonly<MaterialLedger>,
  equipmentInstanceId: string
): number {
  const units = ledger.materials.reduce((total, material) => {
    if (material.unitId !== "unit.ml.v1") return total;
    const amount =
      material.locations.find(
        (location) => location.equipmentInstanceId === equipmentInstanceId
      )?.amount ?? 0;
    return total + quantityToIntegerUnits(amount, material.unitId);
  }, 0);
  return integerUnitsToQuantity(units, "unit.ml.v1");
}
