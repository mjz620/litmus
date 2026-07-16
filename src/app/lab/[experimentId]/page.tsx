import { notFound } from "next/navigation";

import { resolveExperimentId } from "../../../components/ui/experimentRoutes";
import { getExperimentManifest } from "../../../experiments/registry";
import { LabRouteShell } from "./LabRouteShell";

interface LabPageProps {
  params: Promise<{ experimentId: string }>;
  searchParams: Promise<{ seed?: string | string[] }>;
}

export default async function LabPage({ params, searchParams }: LabPageProps) {
  const { experimentId: routeSegment } = await params;
  const { seed } = await searchParams;
  const experimentId = resolveExperimentId(routeSegment);

  if (!experimentId) {
    notFound();
  }

  const manifest = getExperimentManifest(experimentId);
  const requestedSeed = Array.isArray(seed) ? seed[0] : seed;
  const replaySeed = requestedSeed?.trim().slice(0, 128) || undefined;

  return (
    <LabRouteShell
      experimentId={experimentId}
      title={manifest.title}
      replaySeed={replaySeed}
    />
  );
}
