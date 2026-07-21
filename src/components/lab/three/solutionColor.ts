/**
 * Concentration-dependent color for aqueous solutions.
 *
 * A dissolved absorbing species does not have one color — it has one molar
 * absorptivity, and the color you see is what survives the path length at the
 * current concentration. So the registry publishes a reagent's transmitted
 * color at a stated reference concentration, and this module projects that
 * fact onto whatever concentration the engine currently reports.
 *
 * The projection is Beer-Lambert. For absorbance A = e * c * l, transmittance
 * is T = 10^-A, so T scales as T(c) = T_ref^(c / c_ref) per channel. Halving
 * the concentration therefore takes the square root of transmittance rather
 * than lerping halfway to clear, which is why a 10x dilution reads as a large
 * visual jump near the top of the range and a small one near the bottom —
 * the same falloff a student sees at the bench.
 *
 * The view never computes concentration. It receives an engine observable and
 * maps a number to a color; the chemistry stays in the chemistry models.
 */
import { LAB_PALETTE } from "./labPalette";

/**
 * Registry-published appearance of an aqueous reagent. Solids and suspended
 * precipitates are excluded on purpose: their color reports presence, not
 * concentration, and scaling them would misstate the chemistry.
 */
export interface AqueousAppearance {
  /** Transmitted sRGB hex observed at `referenceConcentrationM`. */
  readonly tintHex: string;
  /** Concentration in mol/L at which `tintHex` is the observed color. */
  readonly referenceConcentrationM: number;
}

/**
 * Solvent color at zero solute. Every tint converges here as c approaches 0,
 * so a fully diluted solution matches distilled water in the same glassware
 * instead of landing on a slightly different "empty" color.
 */
const SOLVENT_COLOR = LAB_PALETTE.colorlessLiquid;

/**
 * Concentrations above this multiple of the reference are clamped. Past ~4x
 * reference every channel has bottomed out, so further scaling only risks
 * denormals while producing no visible difference.
 */
const MAX_CONCENTRATION_RATIO = 4;

/** Floor on reference transmittance; 0 would make the exponent degenerate. */
const MIN_TRANSMITTANCE = 1e-4;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/** sRGB 0-255 to linear-light 0-1. Blending must happen in linear light. */
function srgbChannelToLinear(channel: number): number {
  const normalized = clamp(channel, 0, 255) / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function linearChannelToSrgb(channel: number): number {
  const clamped = clamp(channel, 0, 1);
  const encoded =
    clamped <= 0.0031308
      ? clamped * 12.92
      : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return Math.round(clamp(encoded, 0, 1) * 255);
}

/** Parses `#rgb` or `#rrggbb`; returns null so callers can fall back. */
function parseHex(hex: string): readonly [number, number, number] | null {
  const value = hex.trim().replace(/^#/, "");
  if (value.length === 3) {
    const expanded = value
      .split("")
      .map((character) => character + character)
      .join("");
    return parseHex(`#${expanded}`);
  }
  if (value.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(value)) return null;
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16)
  ] as const;
}

function toHex(red: number, green: number, blue: number): string {
  const channel = (value: number) => value.toString(16).padStart(2, "0");
  return `#${channel(red)}${channel(green)}${channel(blue)}`.toUpperCase();
}

/**
 * Projects a reagent's reference color onto the concentration the engine
 * currently reports.
 *
 * Returns the solvent color when there is no appearance data, when the
 * concentration is zero or unreported, or when the reference values are
 * unusable — an aqueous vessel always renders as a real liquid, never as an
 * error state.
 */
export function getAqueousSolutionColor(
  appearance: AqueousAppearance | null | undefined,
  concentrationM: number | null | undefined
): string {
  if (!appearance) return SOLVENT_COLOR;
  if (typeof concentrationM !== "number" || !Number.isFinite(concentrationM))
    return SOLVENT_COLOR;
  if (concentrationM <= 0) return SOLVENT_COLOR;

  const { tintHex, referenceConcentrationM } = appearance;
  if (!Number.isFinite(referenceConcentrationM) || referenceConcentrationM <= 0)
    return SOLVENT_COLOR;

  const tint = parseHex(tintHex);
  const solvent = parseHex(SOLVENT_COLOR);
  if (!tint || !solvent) return SOLVENT_COLOR;

  const ratio = clamp(
    concentrationM / referenceConcentrationM,
    0,
    MAX_CONCENTRATION_RATIO
  );

  const channels = [0, 1, 2].map((index) => {
    const solventLinear = srgbChannelToLinear(solvent[index]!);
    const tintLinear = srgbChannelToLinear(tint[index]!);
    if (solventLinear <= 0) return 0;
    // Transmittance of the reference solution relative to pure solvent. A
    // tint brighter than the solvent in some channel is not physical for an
    // absorbing species, so it is clamped to "no absorption" rather than
    // allowed to amplify light as concentration rises.
    const referenceTransmittance = clamp(
      tintLinear / solventLinear,
      MIN_TRANSMITTANCE,
      1
    );
    return linearChannelToSrgb(solventLinear * referenceTransmittance ** ratio);
  });

  return toHex(channels[0]!, channels[1]!, channels[2]!);
}
