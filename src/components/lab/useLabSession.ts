"use client";

import { useEffect, useRef } from "react";

import type { ExperimentId } from "../../experiments/registry";
import { generateTitrationSessionConfig } from "../../experiments/titration/sessionConfig";
import {
  createTitrationRetryScenario,
  type TitrationRetrySkillId
} from "../../experiments/titration/retry";
import { useLabStore } from "../../stores/labStore";
import type { ValidatedLabWorkflowSpecV2 } from "../../lab-workflows/schema/v2";
import type {
  LabSessionRuntimeMode,
  SetupDrivenLabSelection
} from "../../stores/setupDrivenLabSession";

export interface LabSessionOptions {
  experimentId: ExperimentId;
  replaySeed?: string;
  retrySkillId?: TitrationRetrySkillId;
  parentSessionId?: string;
  mode?: "practice" | "assignment" | "demo" | "preview";
  runtimeMode?: LabSessionRuntimeMode;
  setupDrivenSelection?: SetupDrivenLabSelection;
  setupDrivenWorkflow?: Readonly<ValidatedLabWorkflowSpecV2>;
  labDefinitionVersionId?: string;
  labDefinitionCanonicalHash?: string;
  /**
   * Bump to abandon the current session and initialize a fresh one with a new
   * session ID (the native workspace's "Restart attempt"). Identical options
   * with the same token never re-initialize.
   */
  restartToken?: number;
}

/**
 * Initialize and expose one lab session. The student route and the developer
 * testing route both use this hook, so they share the same store, seeded
 * configuration generator, and typed engine flow; only their presentation of
 * the resulting session differs.
 */
export function useLabSession({
  experimentId,
  replaySeed,
  retrySkillId,
  parentSessionId,
  mode,
  runtimeMode = "legacy",
  setupDrivenSelection,
  setupDrivenWorkflow,
  labDefinitionVersionId,
  labDefinitionCanonicalHash,
  restartToken
}: LabSessionOptions) {
  const startedKey = useRef<string | null>(null);
  const status = useLabStore((store) => store.status);
  const loadedExperimentId = useLabStore((store) => store.experimentId);
  const sessionId = useLabStore((store) => store.sessionId);
  const definition = useLabStore((store) => store.definition);
  const state = useLabStore((store) => store.state);
  const studentModel = useLabStore((store) => store.studentModel);
  const eventQueue = useLabStore((store) => store.eventQueue);
  const error = useLabStore((store) => store.error);
  const activeRuntimeMode = useLabStore((store) => store.runtimeMode);
  const runtimeInspection = useLabStore((store) => store.runtimeInspection);
  const loadExperiment = useLabStore((store) => store.loadExperiment);

  useEffect(() => {
    const initializationKey = JSON.stringify({
      experimentId,
      replaySeed,
      retrySkillId,
      parentSessionId,
      mode,
      runtimeMode,
      workflowId: setupDrivenSelection?.workflowId,
      workflowHash: setupDrivenSelection?.workflowHash,
      labDefinitionVersionId,
      labDefinitionCanonicalHash,
      restartToken
    });
    if (startedKey.current === initializationKey) return;
    startedKey.current = initializationKey;

    const newSessionId = globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : createFallbackSessionId();
    const sessionSeed = replaySeed ?? newSessionId;
    const retryScenario = retrySkillId
      ? createTitrationRetryScenario(
          retrySkillId,
          `retry:${parentSessionId ?? "standalone"}:${sessionSeed}`
        )
      : null;
    void loadExperiment({
      experimentId,
      sessionId: newSessionId,
      config:
        retryScenario?.config ?? generateTitrationSessionConfig(sessionSeed),
      seed: retryScenario?.seed ?? { sessionSeed },
      mode,
      parentSessionId,
      runtimeMode,
      setupDrivenSelection,
      setupDrivenWorkflow,
      workflowVersionId: setupDrivenSelection?.workflowHash,
      labDefinitionVersionId,
      labDefinitionCanonicalHash
    }).catch(() => undefined);
  }, [
    experimentId,
    labDefinitionCanonicalHash,
    labDefinitionVersionId,
    loadExperiment,
    mode,
    parentSessionId,
    replaySeed,
    restartToken,
    retrySkillId,
    runtimeMode,
    setupDrivenSelection,
    setupDrivenWorkflow
  ]);

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
    latestPH: typeof latestPH === "number" ? latestPH : undefined,
    runtimeMode: activeRuntimeMode,
    runtimeInspection
  };
}

function createFallbackSessionId(): string {
  const timestamp = Date.now().toString(16).padStart(12, "0").slice(-12);
  return `00000000-0000-4000-8000-${timestamp}`;
}
