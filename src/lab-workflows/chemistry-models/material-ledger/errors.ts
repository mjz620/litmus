export const MATERIAL_LEDGER_ERROR_CODES = Object.freeze({
  invalidLedger: "material-ledger.invalid_ledger.v1",
  invalidAmount: "material-ledger.invalid_amount.v1",
  unknownMaterial: "material-ledger.unknown_material.v1",
  unknownLocation: "material-ledger.unknown_location.v1",
  sourceUnavailable: "material-ledger.source_unavailable.v1",
  targetCapacityExceeded: "material-ledger.target_capacity_exceeded.v1",
  unitMismatch: "material-ledger.unit_mismatch.v1",
  conservationViolation: "material-ledger.conservation_violation.v1"
} as const);

export type MaterialLedgerErrorCode =
  (typeof MATERIAL_LEDGER_ERROR_CODES)[keyof typeof MATERIAL_LEDGER_ERROR_CODES];

export class MaterialLedgerError extends Error {
  readonly code: MaterialLedgerErrorCode;
  readonly details: Readonly<Record<string, number | string>>;

  constructor(
    code: MaterialLedgerErrorCode,
    message: string,
    details: Readonly<Record<string, number | string>> = {}
  ) {
    super(message);
    this.name = "MaterialLedgerError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}
