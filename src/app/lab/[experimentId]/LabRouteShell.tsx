"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { PHCurve } from "../../../components/lab/PHCurve";
import { TitrationControls } from "../../../components/lab/titration/TitrationControls";
import { TitrationScene } from "../../../components/lab/titration/TitrationScene";
import {
  formatBuretteVolume,
  formatPH
} from "../../../experiments/titration/display";
import { generateTitrationSessionConfig } from "../../../experiments/titration/sessionConfig";
import type { ExperimentId } from "../../../experiments/registry";
import { useLabStore } from "../../../stores/labStore";

import styles from "./page.module.css";

interface LabRouteShellProps {
  experimentId: ExperimentId;
  title: string;
  replaySeed?: string;
}

export function LabRouteShell({
  experimentId,
  title,
  replaySeed
}: LabRouteShellProps) {
  const started = useRef(false);
  const status = useLabStore((store) => store.status);
  const loadedExperimentId = useLabStore((store) => store.experimentId);
  const state = useLabStore((store) => store.state);
  const studentModel = useLabStore((store) => store.studentModel);
  const eventQueue = useLabStore((store) => store.eventQueue);
  const error = useLabStore((store) => store.error);
  const loadExperiment = useLabStore((store) => store.loadExperiment);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const sessionId = globalThis.crypto?.randomUUID
      ? `guest-${globalThis.crypto.randomUUID()}`
      : `guest-${Date.now()}`;
    const sessionSeed = replaySeed ?? sessionId;
    const config = generateTitrationSessionConfig(sessionSeed);

    void loadExperiment({
      experimentId,
      sessionId,
      config,
      seed: { sessionSeed }
    }).catch(() => undefined);
  }, [experimentId, loadExperiment, replaySeed]);

  const isCurrentExperiment = loadedExperimentId === experimentId;
  const isReady = status === "ready" && isCurrentExperiment && state;
  const latestPH = eventQueue.findLast(
    ({ observation }) => typeof observation.pH === "number"
  )?.observation.pH;

  return (
    <main className={styles.page}>
      <header className={styles.sessionHeader}>
        <div>
          <Link className={styles.backLink} href="/experiments">
            ← Experiments
          </Link>
          <h1>{title}</h1>
        </div>
        <span className={styles.mode}>Practice mode</span>
      </header>

      <div className={styles.workspace}>
        <section className={styles.bench} aria-labelledby="bench-heading">
          <div>
            <p className={styles.eyebrow}>Lab workspace</p>
            <h2 id="bench-heading">Practice precise technique</h2>
            <p>
              Use the accessible controls below to drive the same deterministic
              engine that will power the visual bench.
            </p>
          </div>
          {isReady && <TitrationScene />}
          {isReady && <TitrationControls />}
          {isReady && (
            <PHCurve
              points={state.curve}
              maxVolumeML={state.config.buretteCapacityML}
            />
          )}
        </section>

        <aside className={styles.summary} aria-labelledby="summary-heading">
          <p className={styles.eyebrow}>Engine state</p>
          <h2 id="summary-heading">Initialized state summary</h2>

          {(!isCurrentExperiment ||
            status === "idle" ||
            status === "loading") && (
            <p className={styles.loading} role="status" aria-live="polite">
              Initializing deterministic experiment…
            </p>
          )}

          {status === "error" && isCurrentExperiment && (
            <div className={styles.error} role="alert">
              <strong>Experiment unavailable</strong>
              <span>{error ?? "The experiment could not be initialized."}</span>
            </div>
          )}

          {isReady && (
            <dl className={styles.stateList}>
              <div>
                <dt>Status</dt>
                <dd className={styles.ready}>Ready</dd>
              </div>
              <div>
                <dt>Experiment ID</dt>
                <dd>{experimentId}</dd>
              </div>
              <div>
                <dt>Session seed</dt>
                <dd className={styles.seed}>{state.sessionSeed}</dd>
              </div>
              <div>
                <dt>Analyte</dt>
                <dd className={styles.measurement}>
                  {state.config.analyte.volumeML.toFixed(1)} mL{" "}
                  {state.config.analyte.concentrationM.toFixed(3)} M{" "}
                  {state.config.analyte.name}
                </dd>
              </div>
              <div>
                <dt>Titrant</dt>
                <dd className={styles.measurement}>
                  {state.config.titrant.concentrationM.toFixed(3)} M{" "}
                  {state.config.titrant.name}
                </dd>
              </div>
              <div>
                <dt>Titrant added</dt>
                <dd>{formatBuretteVolume(state.titrantAddedML)} mL</dd>
              </div>
              <div>
                <dt>Titrant available</dt>
                <dd>{formatBuretteVolume(state.buretteAvailableML)} mL</dd>
              </div>
              <div>
                <dt>Indicator</dt>
                <dd>{state.config.indicator.replaceAll("_", " ")}</dd>
              </div>
              {typeof latestPH === "number" && (
                <div>
                  <dt>Current pH</dt>
                  <dd>{formatPH(latestPH)}</dd>
                </div>
              )}
              <div>
                <dt>Skills tracked</dt>
                <dd>{Object.keys(studentModel?.skills ?? {}).length}</dd>
              </div>
              <div>
                <dt>Events recorded</dt>
                <dd>{eventQueue.length}</dd>
              </div>
            </dl>
          )}
        </aside>
      </div>
    </main>
  );
}
