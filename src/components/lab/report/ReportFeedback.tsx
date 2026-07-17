"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { RubricResponse } from "../../../lib/agent/evaluatorSchemas";

import styles from "./ReportForm.module.css";

export function ReportFeedback({
  rubric,
  sessionId
}: {
  rubric: RubricResponse;
  sessionId: string;
}) {
  const [retryDialogOpen, setRetryDialogOpen] = useState(false);
  const retryDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = retryDialogRef.current;
    if (!retryDialogOpen || !dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [retryDialogOpen]);

  const dimensions = [
    ["Concept understanding", rubric.concept_understanding],
    ["Procedure", rubric.procedure],
    ["Data analysis", rubric.data_analysis],
    ["Significant figures", rubric.sig_figs]
  ] as const;
  return (
    <section className={styles.feedback} aria-labelledby="feedback-heading">
      <h2 id="feedback-heading">Formative feedback</h2>
      <p>{rubric.overall_summary}</p>
      {dimensions.map(([label, criterion]) => (
        <article className={styles.criterion} key={label}>
          <h3>
            {label}: {criterion.score}/3
          </h3>
          <p>{criterion.feedback}</p>
          <div className={styles.chips} aria-label="Evidence event types">
            {criterion.evidenceEventTypes.length ? (
              criterion.evidenceEventTypes.map((type) => (
                <span key={type}>{type}</span>
              ))
            ) : (
              <span>Written response</span>
            )}
          </div>
        </article>
      ))}
      {rubric.recommended_retry && (
        <div>
          <h3>Recommended focused retry</h3>
          <p>{rubric.recommended_retry.reason}</p>
          <button
            className={styles.retry}
            type="button"
            onClick={() => setRetryDialogOpen(true)}
          >
            Review checkpoint retry
          </button>
          {retryDialogOpen && (
            <dialog
              ref={retryDialogRef}
              className={styles.retryOverlay}
              aria-labelledby="retry-dialog-heading"
              onCancel={() => setRetryDialogOpen(false)}
            >
              <section className={styles.retryDialog}>
                <p className={styles.retryEyebrow}>Student decision required</p>
                <h3 id="retry-dialog-heading">
                  Reset to a focused checkpoint?
                </h3>
                <p>{rubric.recommended_retry.reason}</p>
                <p>
                  Nothing resets automatically. Your completed session remains
                  saved; continuing creates a new child practice session from a
                  verified checkpoint.
                </p>
                <div className={styles.retryActions}>
                  <button
                    type="button"
                    className={styles.retryCancel}
                    onClick={() => setRetryDialogOpen(false)}
                  >
                    Not now
                  </button>
                  <Link
                    className={styles.retry}
                    href={`/lab/titration?retry=${rubric.recommended_retry.skillId}&parent=${encodeURIComponent(sessionId)}`}
                  >
                    Start checkpoint retry
                  </Link>
                </div>
              </section>
            </dialog>
          )}
        </div>
      )}
    </section>
  );
}
