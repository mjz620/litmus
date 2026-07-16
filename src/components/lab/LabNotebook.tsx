"use client";

import {
  formatBuretteVolume,
  formatPH
} from "../../experiments/titration/display";
import { useLabStore } from "../../stores/labStore";
import {
  getProcedureStage,
  getProcedureStageLabel
} from "./titration/procedureStage";

import styles from "./LabNotebook.module.css";

/**
 * Student-facing lab notebook. Shows only information a student would have at
 * a real bench: the objective, procedure stage, known sample and titrant
 * facts, their own recorded readings, and visible observations. It must never
 * render the unknown analyte concentration, equivalence volume, session seed,
 * or other internal engine values.
 */
export function LabNotebook() {
  const state = useLabStore((store) => store.state);
  const eventQueue = useLabStore((store) => store.eventQueue);

  if (!state) return null;

  const stage = getProcedureStage(state, eventQueue);
  const recordedReadings = eventQueue
    .filter(({ type }) => type === "read_meniscus")
    .map(({ observation }) => observation.reportedML)
    .filter((reading): reading is number => typeof reading === "number");
  const latestColor = eventQueue.findLast(
    ({ observation }) => typeof observation.observedColor === "string"
  )?.observation.observedColor;
  const latestPH = eventQueue.findLast(
    ({ observation }) => typeof observation.pH === "number"
  )?.observation.pH;

  return (
    <div className={styles.notebook}>
      <p className={styles.eyebrow}>Lab notebook</p>
      <h2 id="notebook-heading">Session notes</h2>

      <section className={styles.section} aria-label="Objective">
        <h3>Objective</h3>
        <p>
          Determine the concentration of the {state.config.analyte.name} sample
          by titrating it with the standardized {state.config.titrant.name}{" "}
          solution.
        </p>
      </section>

      <section className={styles.section} aria-label="Current stage">
        <h3>Current stage</h3>
        <p className={styles.stage}>{getProcedureStageLabel(stage)}</p>
      </section>

      <section className={styles.section} aria-label="Known values">
        <h3>Known values</h3>
        <dl className={styles.factList}>
          <div>
            <dt>Sample</dt>
            <dd>
              {state.config.analyte.volumeML.toFixed(1)} mL{" "}
              {state.config.analyte.name}, concentration unknown
            </dd>
          </div>
          <div>
            <dt>Titrant</dt>
            <dd>
              {state.config.titrant.concentrationM.toFixed(3)} M{" "}
              {state.config.titrant.name}
            </dd>
          </div>
          <div>
            <dt>Indicator</dt>
            <dd className={styles.indicator}>
              {state.config.indicator.replaceAll("_", " ")}
            </dd>
          </div>
        </dl>
      </section>

      <section
        className={styles.section}
        aria-label="Recorded burette readings"
      >
        <h3>Recorded burette readings</h3>
        {recordedReadings.length > 0 ? (
          <ol className={styles.readings}>
            {recordedReadings.map((reading, index) => (
              <li key={`${index}-${reading}`}>
                {formatBuretteVolume(reading)} mL
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.empty}>
            No readings yet. Use “Read meniscus” to record one.
          </p>
        )}
      </section>

      <section className={styles.section} aria-label="Observations">
        <h3>Observations</h3>
        <dl className={styles.factList}>
          <div>
            <dt>Solution color</dt>
            <dd className={styles.indicator}>
              {typeof latestColor === "string" ? latestColor : "colorless"}
            </dd>
          </div>
          {typeof latestPH === "number" && (
            <div>
              <dt>Measured pH</dt>
              <dd>{formatPH(latestPH)}</dd>
            </div>
          )}
        </dl>
      </section>
    </div>
  );
}
