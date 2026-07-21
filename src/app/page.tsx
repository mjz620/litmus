import Image from "next/image";
import Link from "next/link";

import benchCalorimetry from "../../public/landing/bench-calorimetry.png";
import benchSolutionPreparation from "../../public/landing/bench-solution-preparation.png";
import benchTitration from "../../public/landing/bench-titration.png";
import composerShot from "../../public/landing/composer.png";
import experimentsShot from "../../public/landing/experiments.png";
import { ProductShell } from "../components/ui/ProductShell";

import styles from "./page.module.css";

/**
 * Every image on this page is captured from the running product by
 * `scripts/capture-landing-shots.mjs`. A page whose whole claim is that the
 * chemistry underneath is real cannot illustrate itself with drawings of a
 * lab bench, so re-run that script when a captured surface changes rather
 * than editing the imagery by hand.
 */
export default function Home() {
  return (
    <ProductShell width="wide">
      <section className={styles.hero} aria-labelledby="page-title">
        <p className={styles.eyebrow}>For high-school chemistry</p>
        <h1 id="page-title">The lab you&rsquo;re allowed to touch</h1>

        {/*
          The headline runs the full width of the shell and the supporting copy
          splits beneath it. Holding all of this in one narrow column left most
          of a 90rem page empty next to the hero.
        */}
        <div className={styles.heroFoot}>
          <div>
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
          </div>

          <div className={styles.heroAside}>
            <ul className={styles.trustList} aria-label="Access details">
              <li>No account needed to practise</li>
              <li>Teachers sign in to save labs and assign them</li>
              <li>The same chemistry every time, and it works by keyboard</li>
            </ul>
            {/*
              Demoted out of the action row. It is a guided tour for judges, not
              a thing a student on this page is looking for, and as a third
              button of near-equal weight it competed with the one action that
              matters.
            */}
            <p className={styles.asideLink}>
              <Link href="/demo">Reviewing Litmus? Take the guided demo →</Link>
            </p>
          </div>
        </div>

        <figure className={`${styles.shot} ${styles.heroShot}`}>
          <figcaption className={styles.shotCaption}>
            <span className={styles.shotDot} aria-hidden="true" />
            Acid–base titration, as a student operates it
          </figcaption>
          <Image
            src={benchTitration}
            alt="The Litmus 3D bench mid-titration: a burette clamped above a conical flask, an indicator shelf, and a wash station, with the next step reading 'Rinse the burette with titrant'."
            sizes="(max-width: 60rem) 100vw, 88rem"
            placeholder="blur"
            priority
          />
        </figure>
      </section>

      <div className={styles.showcase}>
        <section className={styles.block} aria-labelledby="handle-title">
          <div className={styles.blockCopy}>
            <h2 id="handle-title">Handle the equipment, not a diagram</h2>
            <p>
              Tare the balance, weigh out the solid, stir it into water, and
              follow the temperature as it falls. You operate each instrument
              the way the procedure asks, and the bench responds to what you
              actually did with it.
            </p>
            <ul className={styles.points}>
              <li>Every lab action has a keyboard path</li>
              <li>Reduced-graphics mode for shared Chromebooks</li>
              <li>Restart an attempt as often as you need</li>
            </ul>
          </div>
          <figure className={styles.shot}>
            <figcaption className={styles.shotCaption}>
              <span className={styles.shotDot} aria-hidden="true" />
              Measuring the enthalpy of ammonium nitrate dissolution
            </figcaption>
            <Image
              src={benchCalorimetry}
              alt="The calorimetry bench: a laboratory balance reading 0.00 g, a weighing boat, a coffee-cup calorimeter, a digital thermometer, and a stock bottle, with the next step reading 'Place the weighing boat on the balance'."
              sizes="(max-width: 60rem) 100vw, 52rem"
              placeholder="blur"
            />
          </figure>
        </section>

        <section
          className={styles.block}
          data-flip="true"
          aria-labelledby="determinism-title"
        >
          <div className={styles.blockCopy}>
            <h2 id="determinism-title">
              The chemistry does not bend to make you feel good
            </h2>
            <p>
              Concentrations, volumes, and temperatures come from a
              deterministic engine. Condition the pipette badly and the number
              moves — the same way, every time. Nothing on screen is generated
              to be encouraging.
            </p>
            <p className={styles.aside}>
              The coach reads what you did and explains the technique behind it.
              It never invents a measurement.
            </p>
          </div>
          <figure className={styles.shot}>
            <figcaption className={styles.shotCaption}>
              <span className={styles.shotDot} aria-hidden="true" />
              Preparing a copper(II) nitrate dilution
            </figcaption>
            <Image
              src={benchSolutionPreparation}
              alt="The solution preparation bench: a volumetric pipette on a stand, a volumetric flask, a wash bottle, and a stock bottle, with the next step reading 'Condition the pipette'."
              sizes="(max-width: 60rem) 100vw, 52rem"
              placeholder="blur"
            />
          </figure>
        </section>

        <section className={styles.block} aria-labelledby="teacher-title">
          <div className={styles.blockCopy}>
            <h2 id="teacher-title">
              Teachers build the lab, and see who is ready
            </h2>
            <p>
              Compose a procedure from verified equipment and actions, run the
              safety and simulation checks, then assign it to a class. What
              comes back is a record of what each student did — not a summary a
              model wrote about them.
            </p>
            <dl className={styles.specs}>
              <div>
                <dt>Authoring and preview</dt>
                <dd>No account needed</dd>
              </div>
              <div>
                <dt>Saving and assigning</dt>
                <dd>Teacher sign-in</dd>
              </div>
            </dl>
          </div>
          <figure className={styles.shot}>
            <figcaption className={styles.shotCaption}>
              <span className={styles.shotDot} aria-hidden="true" />
              Lab Composer, mid-build
            </figcaption>
            <Image
              src={composerShot}
              alt="Lab Composer showing the six authoring stages — Define, Set up, Workflow, Assess, Check and preview, and AI review — above a draft checklist and the lab's authoring task."
              sizes="(max-width: 60rem) 100vw, 52rem"
              placeholder="blur"
            />
          </figure>
        </section>
      </div>

      <section className={styles.closing} aria-labelledby="closing-title">
        <div className={styles.closingCopy}>
          <h2 id="closing-title">Pick an experiment and start</h2>
          <p>
            Titration, calorimetry, dilution, and precipitation are ready to
            run. No account, no setup — practise until the procedure is yours.
          </p>
          <div className={styles.actions}>
            <Link className="ui-button" href="/experiments">
              Choose an experiment <span aria-hidden="true">→</span>
            </Link>
            <Link className={styles.closingLink} href="/lab-composer">
              Or build your own lab
            </Link>
          </div>
        </div>
        <figure className={styles.closingShot}>
          <Image
            src={experimentsShot}
            alt="The Litmus experiment catalog, listing each practice lab with how long it takes and how difficult it is."
            sizes="(max-width: 60rem) 100vw, 44rem"
            placeholder="blur"
          />
        </figure>
      </section>
    </ProductShell>
  );
}
