"use client";

import Link from "next/link";

import { EventInspector } from "../../../../components/lab/EventInspector";
import { PHCurve } from "../../../../components/lab/PHCurve";
import { TitrationWorkspace } from "../../../../components/lab/titration/TitrationWorkspace";
import { PrecipitationWorkspace } from "../../../../components/lab/precipitation/PrecipitationWorkspace";
import { useLabSession } from "../../../../components/lab/useLabSession";
import type { ExperimentId } from "../../../../experiments/registry";
import { isTitrationState } from "../../../../stores/labStore";
import type {
  LabSessionRuntimeMode,
  SetupDrivenLabSelection
} from "../../../../stores/setupDrivenLabSession";

import styles from "./page.module.css";

interface DevLabShellProps {
  experimentId: ExperimentId;
  routeSegment: string;
  title: string;
  replaySeed?: string;
  runtimeMode?: LabSessionRuntimeMode;
  setupDrivenSelection?: SetupDrivenLabSelection;
}

/**
 * Developer analytics surface. Shares the exact session hook, store, engine,
 * and controls with the student route; only this shell may render seeds, raw
 * state, ground-truth-bearing configuration, skills, and event diagnostics.
 */
export function DevLabShell({
  experimentId,
  routeSegment,
  title,
  replaySeed,
  runtimeMode,
  setupDrivenSelection
}: DevLabShellProps) {
  const {
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
    runtimeMode: activeRuntimeMode,
    runtimeInspection
  } = useLabSession({
    experimentId,
    replaySeed,
    runtimeMode,
    setupDrivenSelection
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

  const studentQuery = new URLSearchParams();
  if (replaySeed) studentQuery.set("seed", replaySeed);
  if (runtimeMode === "setup_driven_v2") {
    studentQuery.set("runtime", "setup-v2");
  }
  const serializedStudentQuery = studentQuery.toString();
  const studentPath = `/lab/${routeSegment}${
    serializedStudentQuery ? `?${serializedStudentQuery}` : ""
  }`;
  const latestEvent = eventQueue.at(-1);

  return (
    <main className={styles.page}>
      <div className={styles.banner} role="note" aria-label="Developer testing">
        <strong>⚠ Developer testing route</strong>
        <span>
          This page exposes internal session data, including answers. It is not
          the student experience and returns 404 in production builds.
        </span>
        <Link className={styles.studentLink} href={studentPath}>
          Open the student route →
        </Link>
      </div>

      <header className={styles.header}>
        <h1>{title} — developer testing</h1>
      </header>

      <div className={styles.workspace}>
        <section className={styles.bench} aria-labelledby="dev-bench-heading">
          <h2 id="dev-bench-heading">Shared lab workspace</h2>
          <p>
            The controls below dispatch the same typed actions through the same
            store and engine as the student route.
          </p>

          {isPending && (
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

          {isReady && state && (
            <>
              {titrationState ? (
                <>
                  <TitrationWorkspace />
                  <PHCurve
                    points={titrationState.curve}
                    maxVolumeML={chartMaxVolumeML}
                  />
                </>
              ) : (
                <PrecipitationWorkspace />
              )}
            </>
          )}
        </section>

        <aside className={styles.analytics} aria-labelledby="analytics-heading">
          <p className={styles.eyebrow}>Internal analytics</p>
          <h2 id="analytics-heading">Session diagnostics</h2>

          <dl className={styles.stateList}>
            <div>
              <dt>Status</dt>
              <dd className={isReady ? styles.ready : undefined}>
                {isReady ? "Ready" : status}
              </dd>
            </div>
            <div>
              <dt>Route experiment ID</dt>
              <dd className={styles.code}>{experimentId}</dd>
            </div>
            <div>
              <dt>Runtime mode</dt>
              <dd className={styles.code}>{activeRuntimeMode}</dd>
            </div>
            <div>
              <dt>Canonical engine ID</dt>
              <dd className={styles.code}>{definition?.id ?? "—"}</dd>
            </div>
            <div>
              <dt>Workflow definition</dt>
              <dd className={styles.code} data-testid="dev-workflow-definition">
                {runtimeInspection
                  ? `${runtimeInspection.workflowId} @ ${runtimeInspection.workflowHash}`
                  : "legacy route"}
              </dd>
            </div>
            <div>
              <dt>Runtime adapter</dt>
              <dd className={styles.code} data-testid="dev-runtime-adapter">
                {runtimeInspection
                  ? `${runtimeInspection.runtimeAdapterId} ${runtimeInspection.runtimeAdapterVersion}`
                  : "legacy store"}
              </dd>
            </div>
            <div>
              <dt>Chemistry models</dt>
              <dd className={styles.code}>
                {runtimeInspection
                  ? runtimeInspection.chemistryModels
                      .map(({ modelId, version }) => `${modelId} ${version}`)
                      .join(", ")
                  : "legacy engine"}
              </dd>
            </div>
            <div>
              <dt>Workflow diagnoses</dt>
              <dd>
                {runtimeInspection
                  ? `${runtimeInspection.diagnoses.length} · sequence ${runtimeInspection.sequence}`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>Session ID</dt>
              <dd className={styles.code}>{sessionId ?? "—"}</dd>
            </div>
            <div>
              <dt>Session seed</dt>
              <dd className={styles.code} data-testid="dev-session-seed">
                {state?.sessionSeed ?? "—"}
              </dd>
            </div>
            <div>
              <dt>Events recorded</dt>
              <dd data-testid="dev-event-count">{eventQueue.length}</dd>
            </div>
            <div>
              <dt>Latest event</dt>
              <dd className={styles.code}>
                {latestEvent
                  ? `${latestEvent.type}${
                      latestEvent.flags.length > 0
                        ? ` [${latestEvent.flags.join(", ")}]`
                        : ""
                    }`
                  : "—"}
              </dd>
            </div>
          </dl>

          <section aria-label="StudentModel skills">
            <h3>StudentModel skills</h3>
            {studentModel ? (
              <>
                <dl className={styles.stateList}>
                  {Object.entries(studentModel.skills).map(
                    ([skillId, estimate]) => (
                      <div key={skillId}>
                        <dt className={styles.code}>{skillId}</dt>
                        <dd>
                          {estimate.mastery.toFixed(2)} ·{" "}
                          {estimate.evidenceCount} evidence
                          {estimate.lastReason
                            ? ` · ${estimate.lastReason}`
                            : ""}
                        </dd>
                      </div>
                    )
                  )}
                </dl>
                <p className={styles.flags}>
                  Active flags:{" "}
                  {studentModel.activeFlags.length > 0
                    ? studentModel.activeFlags.join(", ")
                    : "none"}
                </p>
              </>
            ) : (
              <p>No StudentModel yet.</p>
            )}
          </section>

          <EventInspector
            sessionSeed={state?.sessionSeed ?? null}
            events={eventQueue}
            studentModel={studentModel}
            engineState={state}
          />
        </aside>
      </div>
    </main>
  );
}
