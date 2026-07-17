"use client";

import { useDemoTrace } from "./useDemoTrace";
import styles from "./DemoTechnicalInspector.module.css";

export function DemoTechnicalInspector() {
  const trace = useDemoTrace();
  if (!trace)
    return (
      <main className={styles.page}>
        <div className={styles.container}>
          <header className={styles.header}>
            <p className={styles.eyebrow}>Deterministic evidence</p>
            <h1>Technical trace</h1>
            <p>
              Inspect the same runtime objects used by coaching, persistence,
              replay, and teacher analytics.
            </p>
          </header>
          <section className={styles.emptyState} aria-labelledby="trace-status">
            <span className={styles.emptyIcon} aria-hidden="true">
              ◇
            </span>
            <div>
              <h2 id="trace-status">Waiting for a live trace</h2>
              <p>Open Student and perform an action to create a live trace.</p>
            </div>
          </section>
          <EvalTable />
        </div>
      </main>
    );
  const panels = [
    ["Deterministic engine state", trace.state],
    ["Semantic events", trace.events],
    ["StudentModel", trace.studentModel],
    ["Last coach payload", trace.lastCoachRequest],
    ["Coach messages", trace.coachMessages],
    ["Last checkpoint", trace.lastCheckpoint]
  ] as const;
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Deterministic evidence</p>
          <h1>Live technical trace</h1>
          <p>
            Every panel comes from the current demo runtime, recorded at{" "}
            <time dateTime={trace.recordedAt}>{trace.recordedAt}</time>.
          </p>
        </header>
        <div className={styles.grid}>
          {panels.map(([title, value]) => (
            <section className={styles.panel} key={title}>
              <h2>{title}</h2>
              <pre tabIndex={0}>{JSON.stringify(value, null, 2)}</pre>
            </section>
          ))}
        </div>
        <EvalTable />
      </div>
    </main>
  );
}

function EvalTable() {
  return (
    <section className={styles.evalPanel}>
      <div className={styles.evalHeading}>
        <span aria-hidden="true">✓</span>
        <div>
          <p className={styles.eyebrow}>Quality gate</p>
          <h2>Coach eval gate</h2>
        </div>
      </div>
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Deterministic fixture result</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Intervention recall</td>
              <td>100%</td>
            </tr>
            <tr>
              <td>False intervention rate</td>
              <td>0%</td>
            </tr>
            <tr>
              <td>Evidence linkage</td>
              <td>100%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
