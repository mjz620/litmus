"use client";

import { LabNotebook } from "../../../components/lab/LabNotebook";
import { LabSessionBar } from "../../../components/lab/LabSessionBar";
import { PHCurve } from "../../../components/lab/PHCurve";
import { TitrationWorkspace } from "../../../components/lab/titration/TitrationWorkspace";
import { useLabSession } from "../../../components/lab/useLabSession";
import type { ExperimentId } from "../../../experiments/registry";

import styles from "./page.module.css";

interface LabRouteShellProps {
  experimentId: ExperimentId;
  title: string;
  replaySeed?: string;
}

/**
 * Student-facing lab session. Internal diagnostics (seed, raw state, skills,
 * event counts, ground truth) belong exclusively to the developer testing
 * route and must never render here.
 */
export function LabRouteShell({
  experimentId,
  title,
  replaySeed
}: LabRouteShellProps) {
  const { status, state, error, isCurrentExperiment, isPending, isReady } =
    useLabSession({ experimentId, replaySeed });

  return (
    <main className={styles.page}>
      <LabSessionBar title={title} />

      <div className={styles.workspace}>
        <section className={styles.bench} aria-labelledby="bench-heading">
          <div>
            <p className={styles.eyebrow}>Lab workspace</p>
            <h2 id="bench-heading">Practice precise technique</h2>
            <p>
              Work through the titration on the visual bench, then use its
              precision controls panel for each measured step.
            </p>
          </div>

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
              <TitrationWorkspace />
              <PHCurve
                points={state.curve}
                maxVolumeML={state.config.buretteCapacityML}
              />
            </>
          )}
        </section>

        {isReady && (
          <aside className={styles.summary} aria-labelledby="notebook-heading">
            <LabNotebook />
          </aside>
        )}
      </div>
    </main>
  );
}
