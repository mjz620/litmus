export const LIQUID_MECHANICS_ERROR_CODES = Object.freeze({
  invalidEquipment: "liquid-mechanics.invalid_equipment.v1",
  invalidConnection: "liquid-mechanics.invalid_connection.v1",
  invalidParameter: "liquid-mechanics.invalid_parameter.v1",
  materialUnavailable: "liquid-mechanics.material_unavailable.v1",
  materialAmbiguous: "liquid-mechanics.material_ambiguous.v1",
  unsupportedAction: "liquid-mechanics.unsupported_action.v1",
  unknownAdapter: "liquid-mechanics.unknown_adapter.v1"
} as const);

export type LiquidMechanicsErrorCode =
  (typeof LIQUID_MECHANICS_ERROR_CODES)[keyof typeof LIQUID_MECHANICS_ERROR_CODES];

export class LiquidMechanicsError extends Error {
  readonly code: LiquidMechanicsErrorCode;
  readonly details: Readonly<Record<string, number | string>>;

  constructor(
    code: LiquidMechanicsErrorCode,
    message: string,
    details: Readonly<Record<string, number | string>> = {}
  ) {
    super(message);
    this.name = "LiquidMechanicsError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}
