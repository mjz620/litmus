import { describe, expect, it } from "vitest";

import {
  getBuretteFillFraction,
  getFlaskLiquidColor
} from "../../src/components/lab/three/sceneProjection";
import { LAB_PALETTE } from "../../src/components/lab/three/labPalette";

describe("3D scene projections", () => {
  it("projects available burette volume into a bounded fill fraction", () => {
    expect(getBuretteFillFraction(50, 50)).toBe(1);
    expect(getBuretteFillFraction(25, 50)).toBe(0.5);
    expect(getBuretteFillFraction(-1, 50)).toBe(0);
    expect(getBuretteFillFraction(60, 50)).toBe(1);
    expect(getBuretteFillFraction(10, 0)).toBe(0);
  });

  it("maps engine observation colors to presentation colors", () => {
    expect(getFlaskLiquidColor("pink")).toBe(LAB_PALETTE.phenolphthalein);
    expect(getFlaskLiquidColor("faint pink")).toBe(LAB_PALETTE.faintPinkLiquid);
    expect(LAB_PALETTE.faintPinkLiquid).not.toBe(LAB_PALETTE.phenolphthalein);
    expect(getFlaskLiquidColor("yellow")).toBe(LAB_PALETTE.yellowLiquid);
    expect(getFlaskLiquidColor("unknown")).toBe(LAB_PALETTE.colorlessLiquid);
    expect(getFlaskLiquidColor()).toBe(LAB_PALETTE.colorlessLiquid);
  });
});
