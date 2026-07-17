import { describe, expect, it } from "vitest";

import {
  LAB_LIQUID_COLORS,
  LAB_PALETTE
} from "../../src/components/lab/three/labPalette";

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((start) =>
    Number.parseInt(hex.slice(start, start + 2), 16)
  );
  const [red, green, blue] = channels.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });

  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function luminanceRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("lab 3D palette", () => {
  it("keeps graduation ink legible against burette and flask liquids", () => {
    const liquids = {
      burette: LAB_PALETTE.buretteLiquid,
      ...LAB_LIQUID_COLORS
    };

    for (const liquidColor of Object.values(liquids)) {
      expect(
        luminanceRatio(LAB_PALETTE.graduationInk, liquidColor)
      ).toBeGreaterThanOrEqual(4);
    }
  });

  it("uses canonical six-digit hexadecimal values", () => {
    for (const color of Object.values(LAB_PALETTE)) {
      expect(color).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});
