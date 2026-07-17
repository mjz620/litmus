"use client";

import type { TitrationRetrySkillId } from "../../../experiments/titration/retry";
import { createTitrationRetryScenario } from "../../../experiments/titration/retry";
import { useLabStore } from "../../../stores/labStore";

import styles from "./RetryBanner.module.css";

export function RetryBanner({ skillId }: { skillId: TitrationRetrySkillId }) {
  const events = useLabStore((store) => store.eventQueue);
  const scenario = createTitrationRetryScenario(skillId, "display-only");
  const succeeded = events.some((event) =>
    event.evidence.some(
      (evidence) => evidence.skillId === skillId && evidence.delta > 0
    )
  );

  return (
    <section className={styles.banner} role="status" aria-live="polite">
      <span className={styles.icon} aria-hidden="true">
        ↺
      </span>
      <div>
        <strong>{scenario.title}</strong>
        <p>{scenario.goal}</p>
        {succeeded && (
          <p className={styles.success}>
            Retry success recorded as new positive evidence.
          </p>
        )}
      </div>
    </section>
  );
}
