import Link from "next/link";

import { DEMO_LABS } from "../../../lib/demo/demoLabs";

import styles from "../page.module.css";

export default function DemoLabsPage() {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <Link className={styles.backLink} href="/demo">
            ← Demo home
          </Link>
          <p className={styles.eyebrow}>Student bench</p>
          <h1>Run a lab</h1>
          <p className={styles.summary}>
            Four techniques, each a validated workflow students can run today.
            Every action you take is recorded as evidence the teacher view and
            the report are scored from.
          </p>
        </header>

        <section className={styles.grid} aria-label="Demo labs">
          {DEMO_LABS.map((lab) => (
            <article className={styles.card} key={lab.href}>
              <span className={styles.roleIcon} aria-hidden="true">
                {lab.icon}
              </span>
              <div>
                <p className={styles.kicker}>{lab.technique}</p>
                <h2>{lab.title}</h2>
                <p className={styles.description}>{lab.description}</p>
              </div>
              <Link className={styles.cardLink} href={lab.href}>
                Open lab
                <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
