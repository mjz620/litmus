import type { ExperimentId } from "../../experiments/registry";

const pathsByExperimentId = {
  acid_base_titration: "/lab/titration",
  precipitation_solubility: "/lab/precipitation"
} as const satisfies Record<ExperimentId, `/lab/${string}`>;

/** Guest practice path for the verified native dilution seed (not an engine registry id). */
export const SOLUTION_PREPARATION_PRACTICE_PATH =
  "/lab/solution-preparation" as const;

export const SOLUTION_PREPARATION_PRACTICE_SEED =
  "2026-07-18T15:00:00.000Z" as const;

/** Guest practice path for the verified native calorimetry seed (not an engine registry id). */
export const CALORIMETRY_PRACTICE_PATH = "/lab/calorimetry" as const;

export const CALORIMETRY_PRACTICE_SEED = "2026-07-19T12:00:00.000Z" as const;

export function getExperimentPath(
  experimentId: ExperimentId
): `/lab/${string}` {
  return pathsByExperimentId[experimentId];
}

export function getSolutionPreparationPracticePath(): typeof SOLUTION_PREPARATION_PRACTICE_PATH {
  return SOLUTION_PREPARATION_PRACTICE_PATH;
}

export function getCalorimetryPracticePath(): typeof CALORIMETRY_PRACTICE_PATH {
  return CALORIMETRY_PRACTICE_PATH;
}

export function resolveExperimentId(routeSegment: string): ExperimentId | null {
  const match = Object.entries(pathsByExperimentId).find(
    ([, path]) => path === `/lab/${routeSegment}`
  );

  return (match?.[0] as ExperimentId | undefined) ?? null;
}
