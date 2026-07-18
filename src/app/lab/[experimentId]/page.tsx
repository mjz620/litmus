import { notFound } from "next/navigation";

import { resolveExperimentId } from "../../../components/ui/experimentRoutes";
import { getExperimentManifest } from "../../../experiments/registry";
import { isTitrationRetrySkillId } from "../../../experiments/titration/retry";
import {
  STRICT_TITRATION_SETUP_SELECTION,
  resolveLabSessionRuntimeMode
} from "../../../stores/setupDrivenLabSession";
import { LabRouteShell } from "./LabRouteShell";

interface LabPageProps {
  params: Promise<{ experimentId: string }>;
  searchParams: Promise<{
    seed?: string | string[];
    retry?: string | string[];
    parent?: string | string[];
    runtime?: string | string[];
  }>;
}

export default async function LabPage({ params, searchParams }: LabPageProps) {
  const { experimentId: routeSegment } = await params;
  const { seed, retry, parent, runtime } = await searchParams;
  const experimentId = resolveExperimentId(routeSegment);

  if (!experimentId) {
    notFound();
  }

  const manifest = getExperimentManifest(experimentId);
  const requestedSeed = Array.isArray(seed) ? seed[0] : seed;
  const replaySeed = requestedSeed?.trim().slice(0, 128) || undefined;
  const requestedRetry = Array.isArray(retry) ? retry[0] : retry;
  const retrySkillId = isTitrationRetrySkillId(requestedRetry)
    ? requestedRetry
    : undefined;
  const requestedParent = Array.isArray(parent) ? parent[0] : parent;
  const parentSessionId = requestedParent?.trim().slice(0, 160) || undefined;
  const requestedRuntime = Array.isArray(runtime) ? runtime[0] : runtime;
  const runtimeMode = retrySkillId
    ? "legacy"
    : resolveLabSessionRuntimeMode(experimentId, requestedRuntime);

  return (
    <LabRouteShell
      experimentId={experimentId}
      title={manifest.title}
      replaySeed={replaySeed}
      retrySkillId={retrySkillId}
      parentSessionId={parentSessionId}
      runtimeMode={runtimeMode}
      setupDrivenSelection={
        runtimeMode === "setup_driven_v2"
          ? STRICT_TITRATION_SETUP_SELECTION
          : undefined
      }
    />
  );
}
