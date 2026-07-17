"use client";

import Link from "next/link";

import { isTitrationState, useLabStore } from "../../stores/labStore";
import { getExperimentPath } from "../../components/ui/experimentRoutes";
import {
  getProcedureStage,
  getProcedureStageLabel
} from "./titration/procedureStage";

import styles from "./LabSessionBar.module.css";

interface LabSessionBarProps {
  title: string;
}

/** Shared session identity, persistence status, and experiment navigation. */
export function LabSessionBar({ title }: LabSessionBarProps) {
  const state = useLabStore((store) =>
    isTitrationState(store.state) ? store.state : null
  );
  const eventQueue = useLabStore((store) => store.eventQueue);
  const saveStatus = useLabStore((store) => store.saveStatus);
  const saveError = useLabStore((store) => store.saveError);
  const retryCheckpoint = useLabStore((store) => store.retryCheckpoint);
  const experimentId = useLabStore((store) => store.experimentId);

  const stageLabel = state
    ? getProcedureStageLabel(getProcedureStage(state, eventQueue))
    : null;

  return (
    <header className={styles.bar}>
      <div className={styles.identity}>
        <span className={styles.mark} aria-hidden="true">
          ⚗
        </span>
        <div>
          <Link className={styles.backLink} href="/experiments">
            ← Experiments
          </Link>
          <div className={styles.titleRow}>
            <h1>{title}</h1>
            {stageLabel && <span className={styles.stage}>{stageLabel}</span>}
          </div>
        </div>
      </div>

      <div className={styles.session}>
        <span className={styles.saveStatus} role="status" aria-live="polite">
          {saveStatus === "idle" && "Practice mode — ready"}
          {saveStatus === "pending" && "Saving progress…"}
          {saveStatus === "saved" && "Progress saved"}
          {saveStatus === "error" &&
            `Save failed${saveError ? `: ${saveError}` : ""}`}
        </span>
        <div className={styles.actions}>
          {saveStatus === "error" && (
            <button type="button" onClick={retryCheckpoint}>
              Retry save
            </button>
          )}
          {experimentId && state && (
            <Link href={`${getExperimentPath(experimentId)}/report`}>
              Open report <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
