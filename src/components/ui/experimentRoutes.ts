import type { ExperimentId } from "../../experiments/registry";

const pathsByExperimentId = {
  acid_base_titration: "/lab/titration"
} as const satisfies Record<ExperimentId, `/lab/${string}`>;

export function getExperimentPath(
  experimentId: ExperimentId
): `/lab/${string}` {
  return pathsByExperimentId[experimentId];
}

export function resolveExperimentId(routeSegment: string): ExperimentId | null {
  const match = Object.entries(pathsByExperimentId).find(
    ([, path]) => path === `/lab/${routeSegment}`
  );

  return (match?.[0] as ExperimentId | undefined) ?? null;
}
