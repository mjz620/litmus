"use client";

import Link from "next/link";

import { useLabStore } from "../../stores/labStore";
import {
  getProcedureStage,
  getProcedureStageLabel
} from "./titration/procedureStage";

import styles from "./LabSessionBar.module.css";

interface LabSessionBarProps {
  title: string;
}

/**
 * Top session bar. Save status, reset, help, and report navigation are
 * placeholders for later tickets (persistence, coach, report); they must not
 * gain behavior here.
 */
export function LabSessionBar({ title }: LabSessionBarProps) {
  const state = useLabStore((store) => store.state);
  const eventQueue = useLabStore((store) => store.eventQueue);

  const stageLabel = state
    ? getProcedureStageLabel(getProcedureStage(state, eventQueue))
    : null;

  return (
    <header className={styles.bar}>
      <div className={styles.identity}>
        <Link className={styles.backLink} href="/experiments">
          ← Experiments
        </Link>
        <h1>{title}</h1>
        {stageLabel && <span className={styles.stage}>{stageLabel}</span>}
      </div>

      <div className={styles.session}>
        <span className={styles.saveStatus} role="status">
          Practice mode — progress is not saved yet
        </span>
        <div className={styles.actions}>
          <button type="button" disabled title="Available in a later update">
            Reset
          </button>
          <button type="button" disabled title="Available in a later update">
            Help
          </button>
          <button type="button" disabled title="Available in a later update">
            Report
          </button>
        </div>
      </div>
    </header>
  );
}
