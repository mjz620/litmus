import Link from "next/link";

import type {
  ExperimentId,
  ExperimentMetadata
} from "../../experiments/registry";
import { getExperimentPath } from "./experimentRoutes";

import styles from "./ExperimentCard.module.css";

interface ExperimentCardProps {
  id: ExperimentId;
  title: string;
  version: string;
  metadata: ExperimentMetadata;
}

export function ExperimentCard({
  id,
  title,
  version,
  metadata
}: ExperimentCardProps) {
  return (
    <article className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.availability}>Available</span>
        <span className={styles.version}>v{version}</span>
      </div>
      <h2>{title}</h2>
      <p className={styles.description}>{metadata.description}</p>
      <dl className={styles.details}>
        <div>
          <dt>Estimated time</dt>
          <dd>{metadata.estimatedMinutes} minutes</dd>
        </div>
        <div>
          <dt>Difficulty</dt>
          <dd>{metadata.difficulty}</dd>
        </div>
        <div>
          <dt>Skills practiced</dt>
          <dd>{Object.keys(metadata.readinessWeights).length}</dd>
        </div>
      </dl>
      <Link className={styles.cta} href={getExperimentPath(id)}>
        Start practice
      </Link>
    </article>
  );
}
