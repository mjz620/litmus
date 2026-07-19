import Link from "next/link";

import { ExperimentCard } from "../../components/ui/ExperimentCard";
import {
  getCalorimetryPracticePath,
  getSolutionPreparationPracticePath
} from "../../components/ui/experimentRoutes";
import {
  listExperimentManifests,
  type ExperimentId
} from "../../experiments/registry";
import { PageHeader, ProductShell } from "../../components/ui/ProductShell";
import cardStyles from "../../components/ui/ExperimentCard.module.css";

import styles from "./page.module.css";

export default function ExperimentsPage() {
  const experiments = listExperimentManifests();

  return (
    <ProductShell>
      <PageHeader
        eyebrow="Guest practice"
        title="Choose an experiment"
        description="Rehearse a chemistry lab with deterministic science and learning evidence. No account is required. Open Lab Composer anytime to author; teachers sign in only to save cloud drafts and assign."
        backHref="/"
        backLabel="Home"
      />
      <p>
        <Link className="ui-button-secondary" href="/lab-composer">
          Open Lab Composer
        </Link>
      </p>
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
        <article className={cardStyles.card}>
          <div className={cardStyles.cardHeader}>
            <span className={cardStyles.availability}>Available</span>
            <span className={cardStyles.version}>setup-driven</span>
          </div>
          <h2>Prepare a sodium chloride dilution</h2>
          <p className={cardStyles.description}>
            Transfer a calibrated aliquot, dilute to the mark, and mix a
            solution with deterministic concentration evidence. Uses the same
            immersive 3D bench as titration with volumetric equipment.
          </p>
          <dl className={cardStyles.details}>
            <div>
              <dt>Estimated time</dt>
              <dd>12 minutes</dd>
            </div>
            <div>
              <dt>Difficulty</dt>
              <dd>intermediate</dd>
            </div>
            <div>
              <dt>Skills practiced</dt>
              <dd>2</dd>
            </div>
          </dl>
          <Link
            className={cardStyles.cta}
            href={getSolutionPreparationPracticePath()}
          >
            Start practice
          </Link>
        </article>
        <article className={cardStyles.card}>
          <div className={cardStyles.cardHeader}>
            <span className={cardStyles.availability}>Available</span>
            <span className={cardStyles.version}>setup-driven</span>
          </div>
          <h2>Mix hot and cold water in a coffee-cup calorimeter</h2>
          <p className={cardStyles.description}>
            Pour equal registered hot and cold volumes, mix, place the probe,
            and record the equilibrium temperature from deterministic heat
            conservation. Uses the shared immersive 3D bench.
          </p>
          <dl className={cardStyles.details}>
            <div>
              <dt>Estimated time</dt>
              <dd>10 minutes</dd>
            </div>
            <div>
              <dt>Difficulty</dt>
              <dd>intro</dd>
            </div>
            <div>
              <dt>Skills practiced</dt>
              <dd>1</dd>
            </div>
          </dl>
          <Link className={cardStyles.cta} href={getCalorimetryPracticePath()}>
            Start practice
          </Link>
        </article>
      </section>
    </ProductShell>
  );
}
