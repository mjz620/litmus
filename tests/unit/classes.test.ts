import { describe, expect, it } from "vitest";

import {
  generateJoinCode,
  isValidJoinCode,
  normalizeJoinCode
} from "../../src/lib/classes/classes";

describe("class join codes", () => {
  it("normalizes and validates unambiguous codes", () => {
    expect(normalizeJoinCode(" abcd-23 ")).toBe("ABCD23");
    expect(isValidJoinCode("ABCD23")).toBe(true);
    expect(isValidJoinCode("O0IL11")).toBe(false);
  });

  it("generates a six-character code", () => {
    expect(generateJoinCode(() => 0)).toBe("AAAAAA");
  });
});
