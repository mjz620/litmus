import Link from "next/link";

import { ExperimentCard } from "../../components/ui/ExperimentCard";
import { listExperimentCatalog } from "../../components/ui/experimentCatalog";
import { PageHeader, ProductShell } from "../../components/ui/ProductShell";

import styles from "./page.module.css";

export default function ExperimentsPage() {
  const catalog = listExperimentCatalog();

  return (
    <ProductShell>
      <PageHeader
        eyebrow="Guest practice"
        title="Choose an experiment"
        description="Practise the technique before you do it for real. Nothing here can break or be wasted — restart any experiment as many times as you like. No account needed."
        backHref="/"
        backLabel="Home"
      />
      <section className={styles.grid} aria-label="Available experiments">
        {catalog.map((entry) => (
          <ExperimentCard key={entry.key} entry={entry} />
        ))}
      </section>
      {/*
        Teachers get one quiet line after the student's choice, not a button
        above it. The Composer is already in the primary nav.
      */}
      <p className={styles.teacherNote}>
        Teaching with this?{" "}
        <Link href="/lab-composer">Build a lab in the Composer</Link>.
      </p>
    </ProductShell>
  );
}
