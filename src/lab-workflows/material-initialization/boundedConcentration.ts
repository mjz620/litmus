export const BOUNDED_CONCENTRATION_ERROR_CODES = Object.freeze({
  syntax: "bounded_concentration.syntax",
  precision: "bounded_concentration.precision",
  range: "bounded_concentration.range",
  contract: "bounded_concentration.contract"
} as const);

export type BoundedConcentrationErrorCode =
  (typeof BOUNDED_CONCENTRATION_ERROR_CODES)[keyof typeof BOUNDED_CONCENTRATION_ERROR_CODES];

export interface BoundedConcentrationContract {
  readonly minimumDecimalValue: string;
  readonly maximumDecimalValue: string;
  readonly maximumDecimalPlaces: number;
}

export interface CanonicalBoundedDecimal {
  readonly canonicalDecimalValue: string;
  readonly scaledInteger: number;
  readonly scale: number;
}

export class BoundedConcentrationError extends Error {
  readonly code: BoundedConcentrationErrorCode;

  constructor(code: BoundedConcentrationErrorCode, message: string) {
    super(message);
    this.name = "BoundedConcentrationError";
    this.code = code;
  }
}

const DECIMAL_PATTERN = /^(0|[1-9]\d*)(?:\.(\d+))?$/;

function fail(code: BoundedConcentrationErrorCode, message: string): never {
  throw new BoundedConcentrationError(code, message);
}

function parseScaled(
  input: string,
  maximumDecimalPlaces: number,
  enforceInputPrecision: boolean
): CanonicalBoundedDecimal {
  if (
    !Number.isInteger(maximumDecimalPlaces) ||
    maximumDecimalPlaces < 0 ||
    maximumDecimalPlaces > 6
  ) {
    fail(
      BOUNDED_CONCENTRATION_ERROR_CODES.contract,
      "The registered decimal precision is invalid."
    );
  }
  const match = DECIMAL_PATTERN.exec(input);
  if (!match) {
    fail(
      BOUNDED_CONCENTRATION_ERROR_CODES.syntax,
      "Use ordinary decimal notation without signs, commas, or exponents."
    );
  }
  const fraction = match[2] ?? "";
  if (enforceInputPrecision && fraction.length > maximumDecimalPlaces) {
    fail(
      BOUNDED_CONCENTRATION_ERROR_CODES.precision,
      `Use at most ${maximumDecimalPlaces} decimal places.`
    );
  }
  if (fraction.length > maximumDecimalPlaces) {
    fail(
      BOUNDED_CONCENTRATION_ERROR_CODES.contract,
      "A registered bound exceeds its declared decimal precision."
    );
  }
  const scale = 10 ** maximumDecimalPlaces;
  const whole = Number(match[1]);
  const paddedFraction = fraction.padEnd(maximumDecimalPlaces, "0");
  const scaledInteger = whole * scale + Number(paddedFraction || "0");
  if (!Number.isSafeInteger(scaledInteger)) {
    fail(
      BOUNDED_CONCENTRATION_ERROR_CODES.syntax,
      "The decimal value is too large."
    );
  }
  const canonicalFraction = fraction.replace(/0+$/, "");
  return Object.freeze({
    canonicalDecimalValue:
      canonicalFraction.length > 0
        ? `${match[1]}.${canonicalFraction}`
        : match[1]!,
    scaledInteger,
    scale
  });
}

export function canonicalizeBoundedConcentrationDecimal(
  input: string,
  contract: Readonly<BoundedConcentrationContract>
): CanonicalBoundedDecimal {
  const parsed = parseScaled(input, contract.maximumDecimalPlaces, true);
  const minimum = parseScaled(
    contract.minimumDecimalValue,
    contract.maximumDecimalPlaces,
    false
  );
  const maximum = parseScaled(
    contract.maximumDecimalValue,
    contract.maximumDecimalPlaces,
    false
  );
  if (
    minimum.scaledInteger <= 0 ||
    minimum.scaledInteger > maximum.scaledInteger
  ) {
    fail(
      BOUNDED_CONCENTRATION_ERROR_CODES.contract,
      "The registered concentration range is invalid."
    );
  }
  if (
    parsed.scaledInteger < minimum.scaledInteger ||
    parsed.scaledInteger > maximum.scaledInteger
  ) {
    fail(
      BOUNDED_CONCENTRATION_ERROR_CODES.range,
      `Enter a value from ${minimum.canonicalDecimalValue} to ${maximum.canonicalDecimalValue}.`
    );
  }
  return parsed;
}

export function canonicalBoundedDecimalToNumber(
  input: string,
  contract: Readonly<BoundedConcentrationContract>
): number {
  const parsed = canonicalizeBoundedConcentrationDecimal(input, contract);
  if (parsed.canonicalDecimalValue !== input) {
    fail(
      BOUNDED_CONCENTRATION_ERROR_CODES.syntax,
      "The stored concentration decimal is not canonical."
    );
  }
  return parsed.scaledInteger / parsed.scale;
}
