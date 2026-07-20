"use client";

import { useMemo, useState } from "react";

import {
  NativeSetupDrivenWorkspace,
  type NativeWorkspaceSessionPort
} from "../../../components/lab/setup-driven/NativeSetupDrivenWorkspace";
import { useLabSession } from "../../../components/lab/useLabSession";
import { getExperimentPath } from "../../../components/ui/experimentRoutes";
import type { ExperimentId } from "../../../experiments/registry";
import { useLabStore } from "../../../stores/labStore";
import {
  NATIVE_FULL_TITRATION_SETUP_SELECTION,
  resolveNativeTitrationWorkflow,
  type SetupDrivenLabSelection
} from "../../../stores/setupDrivenLabSession";
import type { ValidatedLabWorkflowSpecV2 } from "../../../lab-workflows/schema/v2";

import styles from "./page.module.css";

interface NativeLabRouteShellProps {
  experimentId: ExperimentId;
  title: string;
  replaySeed?: string;
  mode?: "practice" | "assignment" | "demo" | "preview";
  setupDrivenSelection?: SetupDrivenLabSelection;
}

/**
 * Default (native_v2) student route: renders the shared native setup-driven
 * workspace over the validated capability-native titration workflow (full
 * procedure by default, endpoint drill via `?runtime=endpoint-drill`). The
 * session lives in the shared lab store — the same store the strangler route
 * used — so checkpoint persistence, the StudentModel, and the report flow
 * keep their existing guarantees; the workspace drives it through a session
 * port. Validation fails closed to a visible error rather than substituting
 * a definition.
 */
export function NativeLabRouteShell({
  experimentId,
  title,
  replaySeed,
  mode = "practice",
  setupDrivenSelection
}: NativeLabRouteShellProps) {
  const [run, setRun] = useState(1);
  const selection =
    setupDrivenSelection ?? NATIVE_FULL_TITRATION_SETUP_SELECTION;
  const resolution = useMemo(():
    | { workflow: Readonly<ValidatedLabWorkflowSpecV2>; error: null }
    | { workflow: null; error: string } => {
    try {
      const workflow = resolveNativeTitrationWorkflow(selection.workflowId);
      if (workflow.validation.canonicalSpecHash !== selection.workflowHash) {
        return {
          workflow: null,
          error:
            "The requested native definition does not match its exact ID and hash."
        };
      }
      return { workflow, error: null };
    } catch (error) {
      return {
        workflow: null,
        error:
          error instanceof Error
            ? error.message
            : "The native lab definition could not be validated."
      };
    }
  }, [selection.workflowId, selection.workflowHash]);

  const { status, sessionId, error, isCurrentExperiment, isPending, isReady } =
    useLabSession({
      experimentId,
      // Restarts derive a fresh deterministic seed from the requested one;
      // without ?seed= each run seeds from its own new session ID.
      replaySeed:
        replaySeed === undefined
          ? undefined
          : run === 1
            ? replaySeed
            : `${replaySeed}:${run}`,
      mode,
      runtimeMode: "native_v2",
      setupDrivenSelection: selection,
      restartToken: run
    });
  const saveStatus = useLabStore((store) => store.saveStatus);
  const saveError = useLabStore((store) => store.saveError);
  const retryCheckpoint = useLabStore((store) => store.retryCheckpoint);

  /**
   * Session port over the shared lab store: dispatches flow through
   * `dispatchNormalized` (events, StudentModel, and checkpoint writes), and
   * restart initializes a fresh store session, remounting the workspace.
   */
  const port = useMemo<NativeWorkspaceSessionPort>(
    () => ({
      sessionId: sessionId ?? "native-session-pending",
      getProjection: () => {
        const projection = useLabStore.getState().runtimeProjection;
        if (!projection) {
          throw new Error("The native session projection is unavailable.");
        }
        return projection;
      },
      getGenericState: () => {
        const generic = useLabStore.getState().runtimeGenericState;
        if (!generic) {
          throw new Error("The native session state is unavailable.");
        }
        return generic;
      },
      dispatch: (action) => useLabStore.getState().dispatchNormalized(action),
      restart: () => setRun((current) => current + 1)
    }),
    [sessionId]
  );

  if (!resolution.workflow || (status === "error" && isCurrentExperiment)) {
    return (
      <main className={styles.page}>
        <div className={styles.error} role="alert">
          <strong>Experiment unavailable</strong>
          <span>
            {resolution.error ??
              error ??
              "The experiment could not be initialized."}
          </span>
        </div>
      </main>
    );
  }

  if (isPending || !isReady) {
    return (
      <main className={styles.page}>
        <p className={styles.loading} role="status" aria-live="polite">
          Preparing your lab session…
        </p>
      </main>
    );
  }

  return (
    <NativeSetupDrivenWorkspace
      key={sessionId ?? run}
      workflow={resolution.workflow}
      replaySeed={`${sessionId ?? "native-lab"}:${run}`}
      mode={mode === "demo" ? "practice" : mode === "preview" ? "preview" : mode}
      title={title}
      sessionIdPrefix="native-lab"
      sessionPort={port}
      saveStatus={saveStatus}
      saveError={saveError}
      onRetrySave={retryCheckpoint}
      reportHref={`${getExperimentPath(experimentId)}/report`}
    />
  );
}
