/**
 * Canonical color contract for the 3D laboratory. Scene materials,
 * CanvasTextures, and shader uniforms import from here so both rendering
 * quality tiers preserve the same scientific color semantics.
 */
export const LAB_PALETTE = {
  benchTop: "#4B5962",
  benchEdge: "#35434E",
  wood: "#E7A259",
  woodDark: "#B96752",
  wall: "#F4CD63",
  ceiling: "#FFE6AF",
  floor: "#B5C36F",
  wallTrim: "#477F78",
  safetyRed: "#D95F69",
  safetyGreen: "#5B9A67",
  safetyPaper: "#FFF0C2",
  ceramic: "#FFF2CC",
  fixtureDark: "#40515D",
  fixtureMetal: "#93AAA2",
  stopcockHandle: "#168FC7",
  glass: "#E8F7F4",
  glassAttenuation: "#D5ECE6",
  glassFallback: "#D8EAE6",
  buretteLiquid: "#BCE8F1",
  graduationInk: "#102A34",
  hoverMint: "#56D6C1",
  selectionTeal: "#0F766E",
  phenolphthalein: "#EAA2BA",
  bromothymolBlue: "#4D86D8",
  methylOrange: "#EC8B32",
  colorlessLiquid: "#E6F5F1",
  faintPinkLiquid: "#F9D5E0",
  yellowLiquid: "#F0CF4A",
  greenLiquid: "#53AC75",
  redLiquid: "#DF5B5B",
  /*
   * Suspended precipitates. These read as opaque solids rather than tinted
   * solutions, so they sit apart from the indicator liquids above.
   */
  whitePrecipitate: "#F2F5F3",
  /* Lightened from a truer iron oxide so graduation ink stays legible over it. */
  rustBrownPrecipitate: "#C0834A",
  muralCoral: "#EB7D75",
  muralBerry: "#A86FAE",
  muralBlue: "#65AFC7",
  muralBoard: "#A9D0C8",
  muralSun: "#F3A840",
  plantLeaf: "#6B9B57",
  plantPot: "#D97758",
  skyHorizon: "#F6C493",
  skyMiddle: "#9ED0C4",
  skyZenith: "#88BC93",
  sceneFallback: "#B9C978"
} as const;

/**
 * Engine observation labels mapped only to their display colors.
 *
 * Every label any chemistry model can emit must appear here: an unmapped
 * label silently falls back to colorless, which is how a precipitate can form
 * with nothing visible happening in the scene. `clear` is the precipitation
 * model's no-reaction label and maps to the same colorless liquid.
 */
export const LAB_LIQUID_COLORS = {
  colorless: LAB_PALETTE.colorlessLiquid,
  clear: LAB_PALETTE.colorlessLiquid,
  "faint pink": LAB_PALETTE.faintPinkLiquid,
  pink: LAB_PALETTE.phenolphthalein,
  yellow: LAB_PALETTE.yellowLiquid,
  green: LAB_PALETTE.greenLiquid,
  blue: LAB_PALETTE.bromothymolBlue,
  red: LAB_PALETTE.redLiquid,
  orange: LAB_PALETTE.methylOrange,
  white: LAB_PALETTE.whitePrecipitate,
  "rust brown": LAB_PALETTE.rustBrownPrecipitate
} as const;

export type LabLiquidColorName = keyof typeof LAB_LIQUID_COLORS;
