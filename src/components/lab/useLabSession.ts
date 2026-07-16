"use client";

import { useEffect, useRef } from "react";

import type { ExperimentId } from "../../experiments/registry";
import { generateTitrationSessionConfig } from "../../experiments/titration/sessionConfig";
import { useLabStore } from "../../stores/labStore";

export interface LabSessionOptions {
  experimentId: ExperimentId;
  replaySeed?: string;
}

/**
 * Initialize and expose one lab session. The student route and the developer
 * testing route both use this hook, so they share the same store, seeded
 * configuration generator, and typed engine flow; only their presentation of
 * the resulting session differs.
 */
export function useLabSession({ experimentId, replaySeed }: LabSessionOptions) {
  const started = useRef(false);
  const status = useLabStore((store) => store.status);
  const loadedExperimentId = useLabStore((store) => store.experimentId);
  const sessionId = useLabStore((store) => store.sessionId);
  const definition = useLabStore((store) => store.definition);
  const state = useLabStore((store) => store.state);
  const studentModel = useLabStore((store) => store.studentModel);
  const eventQueue = useLabStore((store) => store.eventQueue);
  const error = useLabStore((store) => store.error);
  const loadExperiment = useLabStore((store) => store.loadExperiment);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const newSessionId = globalThis.crypto?.randomUUID
      ? `guest-${globalThis.crypto.randomUUID()}`
      : `guest-${Date.now()}`;
    const sessionSeed = replaySeed ?? newSessionId;
    const config = generateTitrationSessionConfig(sessionSeed);

    void loadExperiment({
      experimentId,
      sessionId: newSessionId,
      config,
      seed: { sessionSeed }
    }).catch(() => undefined);
  }, [experimentId, loadExperiment, replaySeed]);

  const isCurrentExperiment = loadedExperimentId === experimentId;
  const isReady = status === "ready" && isCurrentExperiment && state !== null;
  const isPending =
    !isCurrentExperiment || status === "idle" || status === "loading";
  const latestPH = eventQueue.findLast(
    ({ observation }) => typeof observation.pH === "number"
  )?.observation.pH;

  return {
    status,
    sessionId,
    definition,
    state,
    studentModel,
    eventQueue,
    error,
    isCurrentExperiment,
    isPending,
    isReady,
    latestPH: typeof latestPH === "number" ? latestPH : undefined
  };
}
