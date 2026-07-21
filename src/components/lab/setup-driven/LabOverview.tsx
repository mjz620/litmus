"use client";

import { useEffect, useRef } from "react";

import type { ValidatedLabWorkflowSpecV2 } from "../../../lab-workflows/schema/v2";

import styles from "./LabOverview.module.css";

export interface LabOverviewProps {
  readonly workflow: Readonly<ValidatedLabWorkflowSpecV2>;
  readonly onStart: () => void;
}

function difficultyLabel(value: string): string {
  switch (value) {
    case "intro":
      return "Introductory";
    case "intermediate":
      return "Intermediate";
    case "advanced":
      return "Advanced";
    default:
      return value;
  }
}

/**
 * Pre-lab briefing shown before the bench.
 *
 * Students previously landed straight on a full-bleed 3D bench with no idea
 * what they were about to do or why — the procedure existed, but behind a
 * closed drawer. Everything here is authored content the workflow already
 * carries, so a lab that adds equipment or steps updates its own briefing with
 * no separate copy to maintain.
 */
export function LabOverview({ workflow, onStart }: LabOverviewProps) {
  const startRef = useRef<HTMLButtonElement>(null);
  const { metadata } = workflow;

  useEffect(() => {
    // Land focus on the primary action so the keyboard path starts here.
    startRef.current?.focus();
  }, []);

  return (
    <section className={styles.overview} aria-labelledby="lab-overview-title">
      <header className={styles.header}>
        <p className={styles.eyebrow}>Before you start</p>
        <h1 id="lab-overview-title">{metadata.title}</h1>
        <p className={styles.summary}>{metadata.studentSummary}</p>
        <dl className={styles.facts}>
          <div>
            <dt>Time</dt>
            <dd>about {metadata.estimatedMinutes} minutes</dd>
          </div>
          <div>
            <dt>Level</dt>
            <dd>{difficultyLabel(metadata.difficulty)}</dd>
          </div>
          <div>
            <dt>Steps</dt>
            <dd>{workflow.instructions.length}</dd>
          </div>
        </dl>
      </header>

      <div className={styles.panels}>
        <section aria-labelledby="lab-overview-goal">
          <h2 id="lab-overview-goal">What you are doing</h2>
          <p>{metadata.learningObjective}</p>
        </section>

        <section aria-labelledby="lab-overview-procedure">
          <h2 id="lab-overview-procedure">Procedure</h2>
          <ol className={styles.procedure}>
            {workflow.instructions.map((instruction) => (
              <li key={instruction.id}>
                <strong>{instruction.title}</strong>
                <span>{instruction.guidance}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="lab-overview-bench">
          <h2 id="lab-overview-bench">On the bench</h2>
          <ul className={styles.equipment}>
            {workflow.equipment.map((item) => (
              <li key={item.instanceId}>{item.label}</li>
            ))}
          </ul>
        </section>

        {workflow.rubric.criteria.length > 0 && (
          <section aria-labelledby="lab-overview-assessment">
            <h2 id="lab-overview-assessment">How this is assessed</h2>
            <ul className={styles.criteria}>
              {workflow.rubric.criteria.map((criterion) => (
                <li key={criterion.id}>{criterion.description}</li>
              ))}
            </ul>
          </section>
        )}

        {metadata.accessibilityNotes.length > 0 && (
          <section aria-labelledby="lab-overview-access">
            <h2 id="lab-overview-access">Ways to work</h2>
            <ul className={styles.criteria}>
              {metadata.accessibilityNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <footer className={styles.actions}>
        <button
          className="ui-button"
          type="button"
          onClick={onStart}
          ref={startRef}
        >
          Start the lab
        </button>
        <p className={styles.reassurance}>
          You can reread this from Lab steps at any point, and restart the lab
          if something goes wrong.
        </p>
      </footer>
    </section>
  );
}
