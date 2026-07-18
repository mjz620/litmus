export const LEGACY_TITRATION_COMPATIBILITY_ERROR_CODES = Object.freeze({
  contractMismatch: "legacy-titration.contract_mismatch",
  mappingMissing: "legacy-titration.mapping_missing",
  parameterInvalid: "legacy-titration.parameter_invalid",
  stateInvalid: "legacy-titration.state_invalid",
  projectionMismatch: "legacy-titration.projection_mismatch"
} as const);

export type LegacyTitrationCompatibilityErrorCode =
  (typeof LEGACY_TITRATION_COMPATIBILITY_ERROR_CODES)[keyof typeof LEGACY_TITRATION_COMPATIBILITY_ERROR_CODES];

export class LegacyTitrationCompatibilityError extends Error {
  constructor(
    readonly code: LegacyTitrationCompatibilityErrorCode,
    readonly details: Readonly<Record<string, unknown>> = {},
    message: string
  ) {
    super(message);
    this.name = "LegacyTitrationCompatibilityError";
  }
}
