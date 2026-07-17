/**
 * Canonical color contract for the 3D laboratory. Scene materials,
 * CanvasTextures, and shader uniforms import from here so both rendering
 * quality tiers preserve the same scientific color semantics.
 */
export const LAB_PALETTE = {
  benchTop: "#181C22",
  benchEdge: "#2B333B",
  wood: "#B97842",
  woodDark: "#80502F",
  wall: "#E8EEE9",
  floor: "#CBD4CF",
  wallTrim: "#47736D",
  ceramic: "#F7F3E9",
  fixtureDark: "#394348",
  fixtureMetal: "#AAB5B8",
  glass: "#E8F7F4",
  glassAttenuation: "#D5ECE6",
  glassFallback: "#D8EAE6",
  buretteLiquid: "#BCE8F1",
  graduationInk: "#102A34",
  hoverMint: "#56D6C1",
  selectionTeal: "#0F766E",
  phenolphthalein: "#E56B9B",
  bromothymolBlue: "#4D86D8",
  methylOrange: "#EC8B32",
  colorlessLiquid: "#E6F5F1",
  faintPinkLiquid: "#F5B5CC",
  yellowLiquid: "#F0CF4A",
  greenLiquid: "#53AC75",
  redLiquid: "#DF5B5B",
  skyHorizon: "#F5C5A9",
  skyMiddle: "#BEDDE6",
  skyZenith: "#A8DEC8",
  sceneFallback: "#D5E3DF"
} as const;

/** Engine observation labels mapped only to their display colors. */
export const LAB_LIQUID_COLORS = {
  colorless: LAB_PALETTE.colorlessLiquid,
  "faint pink": LAB_PALETTE.faintPinkLiquid,
  pink: LAB_PALETTE.phenolphthalein,
  yellow: LAB_PALETTE.yellowLiquid,
  green: LAB_PALETTE.greenLiquid,
  blue: LAB_PALETTE.bromothymolBlue,
  red: LAB_PALETTE.redLiquid,
  orange: LAB_PALETTE.methylOrange
} as const;

export type LabLiquidColorName = keyof typeof LAB_LIQUID_COLORS;
