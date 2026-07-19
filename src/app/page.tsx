import Link from "next/link";

import { ProductShell } from "../components/ui/ProductShell";

import styles from "./page.module.css";

export default function Home() {
  return (
    <ProductShell width="wide">
      <section className={styles.hero} aria-labelledby="page-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>
            Chemistry rehearsal, built for action
          </p>
          <h1 id="page-title">LabBench AI</h1>
          <p className={styles.summary}>
            Practice real lab decisions in a deterministic virtual workspace,
            get evidence-based guidance, and arrive at the bench ready to work.
          </p>
          <div className={styles.actions}>
            <Link className="ui-button" href="/experiments">
              Choose an experiment <span aria-hidden="true">→</span>
            </Link>
            <Link className="ui-button-secondary" href="/lab-composer">
              Open Lab Composer
            </Link>
            <Link className="ui-button-secondary" href="/demo">
              Judge demo
            </Link>
          </div>
          <ul className={styles.trustList} aria-label="Access details">
            <li>No account required for practice or Composer drafting</li>
            <li>Teachers sign in to save cloud drafts and assign labs</li>
            <li>Deterministic chemistry · keyboard-accessible controls</li>
          </ul>
        </div>

        <aside className={styles.labConsole} aria-label="How LabBench works">
          <div className={styles.consoleHeader}>
            <span className={styles.consoleMark} aria-hidden="true">
              ⚗
            </span>
            <div>
              <p>Student bench</p>
              <strong>Practice loop</strong>
            </div>
            <span className={styles.ready}>Ready</span>
          </div>
          <ol className={styles.steps}>
            <li>
              <span>01</span>
              <div>
                <strong>Manipulate real equipment</strong>
                <p>Prepare, measure, observe, and record.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Build semantic evidence</strong>
                <p>Your meaningful actions drive the learning model.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Reflect with guidance</strong>
                <p>Coaching explains technique without inventing science.</p>
              </div>
            </li>
          </ol>
          <div className={styles.readout}>
            <span>Current objective</span>
            <strong>Build confidence before the physical lab</strong>
          </div>
        </aside>
      </section>

      <section className={styles.audiences} aria-label="LabBench experiences">
        <article>
          <span aria-hidden="true">⌁</span>
          <h2>Student practice</h2>
          <p>Clear next actions, precise measurements, and accessible tools.</p>
        </article>
        <article>
          <span aria-hidden="true">▤</span>
          <h2>Teacher readiness</h2>
          <p>Deterministic class summaries grounded in persisted evidence.</p>
        </article>
        <article>
          <span aria-hidden="true">✦</span>
          <h2>Focused coaching</h2>
          <p>Timely pedagogical support that never mutates the simulation.</p>
        </article>
      </section>
    </ProductShell>
  );
}
