"use client";

import { LabNotebook } from "../../../components/lab/LabNotebook";
import { CoachPanel } from "../../../components/coach/CoachPanel";
import { LabSessionBar } from "../../../components/lab/LabSessionBar";
import { PHCurve } from "../../../components/lab/PHCurve";
import { TitrationWorkspace } from "../../../components/lab/titration/TitrationWorkspace";
import { PrecipitationWorkspace } from "../../../components/lab/precipitation/PrecipitationWorkspace";
import { useLabSession } from "../../../components/lab/useLabSession";
import type { ExperimentId } from "../../../experiments/registry";
import type { TitrationRetrySkillId } from "../../../experiments/titration/retry";
import { RetryBanner } from "../../../components/lab/retry/RetryBanner";
import { isTitrationState } from "../../../stores/labStore";
import type {
  LabSessionRuntimeMode,
  SetupDrivenLabSelection
} from "../../../stores/setupDrivenLabSession";
import type { ValidatedLabWorkflowSpecV2 } from "../../../lab-workflows/schema/v2";

import styles from "./page.module.css";

interface LabRouteShellProps {
  experimentId: ExperimentId;
  title: string;
  replaySeed?: string;
  retrySkillId?: TitrationRetrySkillId;
  parentSessionId?: string;
  mode?: "practice" | "assignment" | "demo" | "preview";
  runtimeMode?: LabSessionRuntimeMode;
  setupDrivenSelection?: SetupDrivenLabSelection;
  setupDrivenWorkflow?: Readonly<ValidatedLabWorkflowSpecV2>;
}

/**
 * Student-facing lab session. Internal diagnostics (seed, raw state, skills,
 * event counts, ground truth) belong exclusively to the developer testing
 * route and must never render here.
 */
export function LabRouteShell({
  experimentId,
  title,
  replaySeed,
  retrySkillId,
  parentSessionId,
  mode,
  runtimeMode,
  setupDrivenSelection,
  setupDrivenWorkflow
}: LabRouteShellProps) {
  const { status, state, error, isCurrentExperiment, isPending, isReady } =
    useLabSession({
      experimentId,
      replaySeed,
      retrySkillId,
      parentSessionId,
      mode,
      runtimeMode,
      setupDrivenSelection,
      setupDrivenWorkflow
    });
  const titrationState = isTitrationState(state) ? state : null;
  const chartMaxVolumeML = titrationState
    ? Math.max(
        titrationState.config.buretteCapacityML,
        Math.ceil(
          titrationState.titrantAddedML /
            titrationState.config.buretteCapacityML
        ) * titrationState.config.buretteCapacityML
      )
    : 0;

  return (
    <main className={styles.page}>
      <LabSessionBar title={title} />
      {retrySkillId && <RetryBanner skillId={retrySkillId} />}

      <div className={styles.workspace}>
        <section
          className={styles.bench}
          aria-label={titrationState ? "Immersive lab workspace" : undefined}
          aria-labelledby={titrationState ? undefined : "bench-heading"}
          data-immersive={titrationState ? "true" : "false"}
        >
          {!titrationState && (
            <div>
              <p className={styles.eyebrow}>Lab workspace</p>
              <h2 id="bench-heading">Practice precise technique</h2>
              <p>
                Choose verified solutions, make observations, and submit each
                conclusion through the shared experiment engine.
              </p>
            </div>
          )}

          {isPending && (
            <p className={styles.loading} role="status" aria-live="polite">
              Preparing your lab session…
            </p>
          )}

          {status === "error" && isCurrentExperiment && (
            <div className={styles.error} role="alert">
              <strong>Experiment unavailable</strong>
              <span>{error ?? "The experiment could not be initialized."}</span>
            </div>
          )}

          {isReady && state && (
            <>
              {titrationState ? (
                <TitrationWorkspace />
              ) : (
                <PrecipitationWorkspace />
              )}
            </>
          )}
        </section>

        {isReady && titrationState && (
          <div className={styles.accessoryTray}>
            <details className={styles.accessoryCard}>
              <summary>
                <span aria-hidden="true">▤</span>
                <span>
                  <strong>Lab notebook</strong>
                  <small>Observations and recorded readings</small>
                </span>
              </summary>
              <div className={styles.accessoryContent}>
                <aside aria-labelledby="notebook-heading">
                  <LabNotebook />
                </aside>
              </div>
            </details>
            <details className={styles.accessoryCard}>
              <summary>
                <span aria-hidden="true">⌁</span>
                <span>
                  <strong>Live pH graph</strong>
                  <small>Open the measurement curve</small>
                </span>
              </summary>
              <div className={styles.accessoryContent}>
                <PHCurve
                  points={titrationState.curve}
                  maxVolumeML={chartMaxVolumeML}
                />
              </div>
            </details>
          </div>
        )}

        {isReady && !titrationState && (
          <aside className={styles.summary} aria-labelledby="coach-heading">
            <CoachPanel />
          </aside>
        )}
      </div>
    </main>
  );
}
