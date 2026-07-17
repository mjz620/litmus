import { ExperimentCard } from "../../components/ui/ExperimentCard";
import {
  listExperimentManifests,
  type ExperimentId
} from "../../experiments/registry";
import { PageHeader, ProductShell } from "../../components/ui/ProductShell";

import styles from "./page.module.css";

export default function ExperimentsPage() {
  const experiments = listExperimentManifests();

  return (
    <ProductShell>
      <PageHeader
        eyebrow="Guest practice"
        title="Choose an experiment"
        description="Rehearse a chemistry lab with deterministic science and learning evidence. No account is required."
        backHref="/"
        backLabel="Home"
      />
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
    </ProductShell>
  );
}
