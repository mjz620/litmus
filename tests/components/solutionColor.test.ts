import { describe, expect, it } from "vitest";

import { LAB_PALETTE } from "../../src/components/lab/three/labPalette";
import {
  getAqueousSolutionColor,
  type AqueousAppearance
} from "../../src/components/lab/three/solutionColor";

/** Copper(II) nitrate as published by the reagent registry. */
const COPPER_NITRATE: AqueousAppearance = {
  tintHex: "#1F9BAF",
  referenceConcentrationM: 1
};

function luminance(hex: string): number {
  const value = hex.replace(/^#/, "");
  const channel = (offset: number) =>
    Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

describe("aqueous solution colour", () => {
  it("returns the published tint exactly at the reference concentration", () => {
    expect(getAqueousSolutionColor(COPPER_NITRATE, 1)).toBe("#1F9BAF");
  });

  it("converges on the solvent colour as the solute is diluted away", () => {
    expect(getAqueousSolutionColor(COPPER_NITRATE, 0)).toBe(
      LAB_PALETTE.colorlessLiquid.toUpperCase()
    );
  });

  it("darkens monotonically with concentration", () => {
    const ladder = [0.05, 0.1, 0.2, 0.5, 1, 2].map((concentrationM) =>
      luminance(getAqueousSolutionColor(COPPER_NITRATE, concentrationM))
    );
    for (let index = 1; index < ladder.length; index += 1) {
      expect(ladder[index]!).toBeLessThan(ladder[index - 1]!);
    }
  });

  it("falls off by Beer-Lambert rather than linearly", () => {
    /*
     * Transmittance is exponential in concentration, so the product of a
     * tenfold dilution stays much closer to the solvent than a linear blend
     * would put it. A linear model would land the 0.1 M product at 10% of the
     * way from solvent to tint; Beer-Lambert keeps it well under half.
     */
    const solvent = luminance(LAB_PALETTE.colorlessLiquid);
    const reference = luminance(COPPER_NITRATE.tintHex);
    const tenth = luminance(getAqueousSolutionColor(COPPER_NITRATE, 0.1));
    const linearShare = (solvent - tenth) / (solvent - reference);
    expect(linearShare).toBeGreaterThan(0);
    expect(linearShare).toBeLessThan(0.5);
  });

  it("treats a reagent with no published appearance as colourless", () => {
    expect(getAqueousSolutionColor(null, 1)).toBe(LAB_PALETTE.colorlessLiquid);
    expect(getAqueousSolutionColor(undefined, 1)).toBe(
      LAB_PALETTE.colorlessLiquid
    );
  });

  it("renders a real liquid rather than an error state for unusable input", () => {
    const cases: readonly (number | null | undefined)[] = [
      null,
      undefined,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      -1
    ];
    for (const concentrationM of cases) {
      expect(getAqueousSolutionColor(COPPER_NITRATE, concentrationM)).toBe(
        LAB_PALETTE.colorlessLiquid
      );
    }
    expect(
      getAqueousSolutionColor(
        { tintHex: "not-a-colour", referenceConcentrationM: 1 },
        1
      )
    ).toBe(LAB_PALETTE.colorlessLiquid);
    expect(
      getAqueousSolutionColor(
        { tintHex: "#1F9BAF", referenceConcentrationM: 0 },
        1
      )
    ).toBe(LAB_PALETTE.colorlessLiquid);
  });

  it("clamps far above the reference instead of collapsing to black", () => {
    const saturated = getAqueousSolutionColor(COPPER_NITRATE, 1000);
    expect(saturated).toMatch(/^#[0-9A-F]{6}$/);
    expect(saturated).toBe(getAqueousSolutionColor(COPPER_NITRATE, 4));
  });
});
