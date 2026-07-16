const BURETTE_INCREMENT_ML = 0.05;
const BURETTE_DECIMAL_PLACES = 2;
const PH_DECIMAL_PLACES = 2;

/** Format a burette reading to the nearest readable 0.05 mL increment. */
export function formatBuretteVolume(volumeML: number): string {
  const scaled = volumeML / BURETTE_INCREMENT_ML;
  const midpointCorrection = Number.EPSILON * Math.abs(scaled);
  const rounded =
    Math.round(scaled + midpointCorrection) * BURETTE_INCREMENT_ML;

  return rounded.toFixed(BURETTE_DECIMAL_PLACES);
}

/** Format a pH value for display without changing the engine value. */
export function formatPH(pH: number): string {
  return pH.toFixed(PH_DECIMAL_PLACES);
}
