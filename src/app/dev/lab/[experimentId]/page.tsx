import { notFound } from "next/navigation";

import { resolveExperimentId } from "../../../../components/ui/experimentRoutes";
import { getExperimentManifest } from "../../../../experiments/registry";
import {
  STRICT_TITRATION_SETUP_SELECTION,
  resolveLabSessionRuntimeMode
} from "../../../../stores/setupDrivenLabSession";
import { DevLabShell } from "./DevLabShell";

interface DevLabPageProps {
  params: Promise<{ experimentId: string }>;
  searchParams: Promise<{
    seed?: string | string[];
    runtime?: string | string[];
  }>;
}

/**
 * Developer testing route. It intentionally exposes seeds, raw engine state,
 * and answer-bearing configuration, so it must be unreachable in production
 * builds: outside development it is a hard 404, not a hidden link.
 */
export default async function DevLabPage({
  params,
  searchParams
}: DevLabPageProps) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const { experimentId: routeSegment } = await params;
  const { seed, runtime } = await searchParams;
  const experimentId = resolveExperimentId(routeSegment);

  if (!experimentId) {
    notFound();
  }

  const manifest = getExperimentManifest(experimentId);
  const requestedSeed = Array.isArray(seed) ? seed[0] : seed;
  const replaySeed = requestedSeed?.trim().slice(0, 128) || undefined;
  const requestedRuntime = Array.isArray(runtime) ? runtime[0] : runtime;
  const runtimeMode = resolveLabSessionRuntimeMode(
    experimentId,
    requestedRuntime
  );

  return (
    <DevLabShell
      experimentId={experimentId}
      routeSegment={routeSegment}
      title={manifest.title}
      replaySeed={replaySeed}
      runtimeMode={runtimeMode}
      setupDrivenSelection={
        runtimeMode === "setup_driven_v2"
          ? STRICT_TITRATION_SETUP_SELECTION
          : undefined
      }
    />
  );
}
