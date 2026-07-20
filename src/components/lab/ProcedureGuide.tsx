import styles from "./ProcedureGuide.module.css";

export type ProcedureGuideStepStatus =
  | "done"
  | "active"
  | "attention"
  | "pending";

export interface ProcedureGuideStep {
  readonly id: string;
  readonly title: string;
  readonly guidance: string;
  readonly status: ProcedureGuideStepStatus;
}

interface ProcedureGuideProps {
  readonly steps: readonly ProcedureGuideStep[];
  /** Optional heading override; defaults to "Procedure". */
  readonly heading?: string;
  /** Hide the internal heading when the host surface already labels it. */
  readonly showHeader?: boolean;
}

const STATUS_LABELS: Readonly<Record<ProcedureGuideStepStatus, string>> =
  Object.freeze({
    done: "Done",
    active: "In progress",
    attention: "Needs attention",
    pending: "Not started"
  });

/**
 * Read-only procedure reference. It shows the authored steps for a lab and
 * reflects deterministic rule progress, but it never dispatches actions and is
 * not a substitute for the manual step executor.
 */
export function ProcedureGuide({
  steps,
  heading = "Procedure",
  showHeader = true
}: ProcedureGuideProps) {
  if (steps.length === 0) return null;

  return (
    <section className={styles.guide} aria-label={heading}>
      {showHeader && (
        <div className={styles.header}>
          <h2>{heading}</h2>
          <span className={styles.badge}>Reference only</span>
        </div>
      )}
      <ol className={styles.steps}>
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={styles.step}
            data-status={step.status}
            aria-current={step.status === "active" ? "step" : undefined}
          >
            <span className={styles.marker} aria-hidden="true">
              {step.status === "done" ? "✓" : index + 1}
            </span>
            <div className={styles.body}>
              <div className={styles.titleRow}>
                <h3>{step.title}</h3>
                <span className={styles.status}>
                  {STATUS_LABELS[step.status]}
                </span>
              </div>
              <p>{step.guidance}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
