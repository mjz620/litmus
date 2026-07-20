import { notFound } from "next/navigation";

import { resolveExperimentId } from "../../../components/ui/experimentRoutes";
import { getExperimentManifest } from "../../../experiments/registry";
import { isTitrationRetrySkillId } from "../../../experiments/titration/retry";
import {
  ENDPOINT_DRILL_TITRATION_RUNTIME_FLAG,
  FULL_TITRATION_SETUP_SELECTION,
  NATIVE_ENDPOINT_DRILL_SETUP_SELECTION,
  NATIVE_FULL_TITRATION_SETUP_SELECTION,
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
    drill?: string | string[];
  }>;
}

export default async function LabPage({ params, searchParams }: LabPageProps) {
  const { experimentId: routeSegment } = await params;
  const { seed, retry, parent, runtime, drill } = await searchParams;
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
      /*
       * Default to the complete native procedure from a clean bench. The
       * endpoint-control drill starts mid-titration by design, so it is
       * opt-in via ?runtime=endpoint-drill (or &drill) and the retry flow,
       * not what a student demo lands on. The strangler rollback
       * (?runtime=setup-v2) keeps its own drill behind the same &drill flag.
       */
      setupDrivenSelection={
        runtimeMode === "setup_driven_v2"
          ? drill !== undefined
            ? STRICT_TITRATION_SETUP_SELECTION
            : FULL_TITRATION_SETUP_SELECTION
          : runtimeMode === "native_v2"
            ? drill !== undefined ||
              requestedRuntime === ENDPOINT_DRILL_TITRATION_RUNTIME_FLAG
              ? NATIVE_ENDPOINT_DRILL_SETUP_SELECTION
              : NATIVE_FULL_TITRATION_SETUP_SELECTION
            : undefined
      }
    />
  );
}
