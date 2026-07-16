import { describe, expect, it } from "vitest";

import {
  getBuretteFillFraction,
  getFlaskLiquidColor
} from "../../src/components/lab/three/sceneProjection";

describe("3D scene projections", () => {
  it("projects available burette volume into a bounded fill fraction", () => {
    expect(getBuretteFillFraction(50, 50)).toBe(1);
    expect(getBuretteFillFraction(25, 50)).toBe(0.5);
    expect(getBuretteFillFraction(-1, 50)).toBe(0);
    expect(getBuretteFillFraction(60, 50)).toBe(1);
    expect(getBuretteFillFraction(10, 0)).toBe(0);
  });

  it("maps engine observation colors to presentation colors", () => {
    expect(getFlaskLiquidColor("pink")).toBe("#df6f9c");
    expect(getFlaskLiquidColor("yellow")).toBe("#e8ca4d");
    expect(getFlaskLiquidColor("unknown")).toBe("#dff4f1");
    expect(getFlaskLiquidColor()).toBe("#dff4f1");
  });
});
