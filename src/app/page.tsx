import Link from "next/link";

import { LitmusMark } from "../components/ui/LitmusMark";
import { ProductShell } from "../components/ui/ProductShell";

import styles from "./page.module.css";

export default function Home() {
  return (
    <ProductShell width="wide">
      <section className={styles.hero} aria-labelledby="page-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>For high-school chemistry</p>
          <h1 id="page-title">Litmus</h1>
          <p className={styles.summary}>
            Practise the technique before you do it for real. Nothing here can
            break, spill, or be wasted, so you can run it as many times as you
            need.
          </p>
          <div className={styles.actions}>
            <Link className="ui-button" href="/experiments">
              Choose an experiment <span aria-hidden="true">→</span>
            </Link>
            <Link className="ui-button-secondary" href="/lab-composer">
              Open Lab Composer
            </Link>
          </div>
          <ul className={styles.trustList} aria-label="Access details">
            <li>No account needed to practise</li>
            <li>Teachers sign in to save labs and assign them</li>
            <li>The same chemistry every time · works by keyboard</li>
          </ul>
          {/*
            Demoted out of the action row. It is a guided tour for judges, not
            a thing a student on this page is looking for, and as a third button
            of near-equal weight it competed with the one action that matters.
          */}
          <p className={styles.asideLink}>
            <Link href="/demo">Reviewing Litmus? Take the guided demo →</Link>
          </p>
        </div>

        <aside className={styles.labConsole} aria-label="How Litmus works">
          <div className={styles.consoleHeader}>
            <LitmusMark className={styles.consoleMark} />
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
                <strong>Handle the equipment</strong>
                <p>
                  Pour, measure, and read instruments as you would for real.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Your work is recorded</strong>
                <p>
                  Every step you take is saved, so you can see what you did.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Ask when you are stuck</strong>
                <p>Coaching explains technique. It never invents chemistry.</p>
              </div>
            </li>
          </ol>
          <div className={styles.readout}>
            <span>Current objective</span>
            <strong>Build confidence before the physical lab</strong>
          </div>
        </aside>
      </section>

      <section className={styles.audiences} aria-label="Litmus experiences">
        {/*
          The decorative glyphs are gone. They were three unrelated characters
          from three type families, rendering inconsistently across platforms
          and carrying no meaning the heading did not already carry.
        */}
        <article>
          <h2>Student practice</h2>
          <p>
            See what to do next, take real measurements, and work entirely by
            keyboard if you need to.
          </p>
        </article>
        <article>
          <h2>Teacher readiness</h2>
          <p>
            See what each student actually did before they walk into the lab.
          </p>
        </article>
        <article>
          <h2>Focused coaching</h2>
          <p>Guidance on technique that never changes the chemistry.</p>
        </article>
      </section>
    </ProductShell>
  );
}
