import { describe, expect, it } from "vitest";

import {
  BOUNDED_CONCENTRATION_ERROR_CODES,
  BoundedConcentrationError,
  canonicalBoundedDecimalToNumber,
  canonicalizeBoundedConcentrationDecimal
} from "../../../src/lab-workflows/material-initialization";

const CONTRACT = Object.freeze({
  minimumDecimalValue: "0.1",
  maximumDecimalValue: "1",
  maximumDecimalPlaces: 4
});

function expectCode(input: string, code: string): void {
  try {
    canonicalizeBoundedConcentrationDecimal(input, CONTRACT);
    throw new Error(`Expected ${input} to be rejected.`);
  } catch (error) {
    expect(error).toBeInstanceOf(BoundedConcentrationError);
    expect((error as BoundedConcentrationError).code).toBe(code);
  }
}

describe("LC2-501A bounded concentration decimals", () => {
  it.each([
    ["0.1", "0.1"],
    ["0.1000", "0.1"],
    ["0.1001", "0.1001"],
    ["0.2500", "0.25"],
    ["0.9999", "0.9999"],
    ["1.0000", "1"]
  ])(
    "canonicalizes %s without floating-point formatting",
    (input, expected) => {
      expect(
        canonicalizeBoundedConcentrationDecimal(input, CONTRACT)
          .canonicalDecimalValue
      ).toBe(expected);
    }
  );

  it.each(["0.0999", "1.0001", "0", "0.0000"])(
    "rejects out-of-range value %s",
    (input) => expectCode(input, BOUNDED_CONCENTRATION_ERROR_CODES.range)
  );

  it.each(["0.12345", "0.10000"])("rejects excess precision %s", (input) =>
    expectCode(input, BOUNDED_CONCENTRATION_ERROR_CODES.precision)
  );

  it.each([
    "1e-1",
    "1E-1",
    "0,5",
    "+0.5",
    "-0.5",
    " 0.5",
    "0.5 ",
    "01.0",
    "NaN",
    "Infinity",
    "9007199254740992"
  ])("rejects non-canonical numeric syntax %s", (input) =>
    expectCode(input, BOUNDED_CONCENTRATION_ERROR_CODES.syntax)
  );

  it("converts only an already-canonical bounded value for model initialization", () => {
    expect(canonicalBoundedDecimalToNumber("0.375", CONTRACT)).toBe(0.375);
    expect(() => canonicalBoundedDecimalToNumber("0.3750", CONTRACT)).toThrow(
      BoundedConcentrationError
    );
  });
});
