import Link from "next/link";

import { ExperimentCard } from "../../components/ui/ExperimentCard";
import {
  listExperimentManifests,
  type ExperimentId
} from "../../experiments/registry";

import styles from "./page.module.css";

export default function ExperimentsPage() {
  const experiments = listExperimentManifests();

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <nav aria-label="Breadcrumb">
          <Link className={styles.backLink} href="/">
            LabBench AI
          </Link>
        </nav>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Guest practice</p>
          <h1>Choose an experiment</h1>
          <p>
            Rehearse a chemistry lab with deterministic science and learning
            evidence. No account is required.
          </p>
        </header>
        <section className={styles.grid} aria-label="Available experiments">
          {experiments.map((manifest) => (
            <ExperimentCard
              key={manifest.id}
              id={manifest.id as ExperimentId}
              title={manifest.title}
              version={manifest.version}
              metadata={manifest.metadata}
            />
          ))}
        </section>
      </div>
    </main>
  );
}
