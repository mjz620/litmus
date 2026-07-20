import Link from "next/link";

import type { ExperimentCatalogEntry } from "./experimentCatalog";

import styles from "./ExperimentCard.module.css";

/**
 * One lab in the chooser.
 *
 * It shows the two facts a student decides on — how long, how hard — and
 * nothing else. Version numbers, engine names, and a count of "skills
 * practiced" were all removed: they were surfaced because the data existed,
 * not because anyone reads them, and a bare integer beside "Intermediate"
 * reads as a score to a student already worried about looking foolish.
 */
export function ExperimentCard({ entry }: { entry: ExperimentCatalogEntry }) {
  return (
    <article className={styles.card}>
      <h2>{entry.title}</h2>
      <p className={styles.description}>{entry.description}</p>
      <dl className={styles.details}>
        <div>
          <dt>Takes about</dt>
          <dd>{entry.estimatedMinutes} minutes</dd>
        </div>
        <div>
          <dt>Difficulty</dt>
          <dd>{entry.difficulty}</dd>
        </div>
      </dl>
      <Link
        className={`ui-button ${styles.cta}`}
        href={entry.href}
        aria-label={`Start practice: ${entry.title}`}
      >
        Start practice
      </Link>
    </article>
  );
}
