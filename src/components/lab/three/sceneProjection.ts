import {
  LAB_LIQUID_COLORS,
  LAB_PALETTE,
  type LabLiquidColorName
} from "./labPalette";

export function getBuretteFillFraction(
  availableML: number,
  capacityML: number
): number {
  if (!Number.isFinite(availableML) || !Number.isFinite(capacityML)) return 0;
  if (capacityML <= 0) return 0;
  return Math.max(0, Math.min(1, availableML / capacityML));
}

export function getFlaskLiquidColor(observedColor?: string): string {
  if (!observedColor) return LAB_PALETTE.colorlessLiquid;
  return (
    LAB_LIQUID_COLORS[observedColor as LabLiquidColorName] ??
    LAB_PALETTE.colorlessLiquid
  );
}
