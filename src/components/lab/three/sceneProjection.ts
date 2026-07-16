const flaskColors = {
  colorless: "#dff4f1",
  "faint pink": "#f4b8cf",
  pink: "#df6f9c",
  yellow: "#e8ca4d",
  green: "#55a878",
  blue: "#4d7fc5",
  red: "#c95757",
  orange: "#df8a3e"
} as const;

export function getBuretteFillFraction(
  availableML: number,
  capacityML: number
): number {
  if (!Number.isFinite(availableML) || !Number.isFinite(capacityML)) return 0;
  if (capacityML <= 0) return 0;
  return Math.max(0, Math.min(1, availableML / capacityML));
}

export function getFlaskLiquidColor(observedColor?: string): string {
  if (!observedColor) return flaskColors.colorless;
  return flaskColors[observedColor as keyof typeof flaskColors] ?? "#dff4f1";
}
