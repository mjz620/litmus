"use client";

import type { SemanticEvent } from "../../experiments/shared";
import {
  formatBuretteVolume,
  formatPH
} from "../../experiments/titration/display";
import type { TitrationState } from "../../experiments/titration/titration";
import type { NativeTitrationBenchFacts } from "./setup-driven/nativeTitrationFacts";
import { isTitrationState, useLabStore } from "../../stores/labStore";
import {
  getProcedureStage,
  getProcedureStageLabel
} from "./titration/procedureStage";

import styles from "./LabNotebook.module.css";

interface LabNotebookProps {
  /**
   * Explicit session projection for hosts that do not use the shared lab
   * store. Both values must be provided together; without them the notebook
   * reads the store as before.
   */
  state?: Readonly<TitrationState> | null;
  events?: readonly SemanticEvent[];
  /**
   * Native-truth projection for the native setup-driven workspace: facts read
   * from equipment-owned observables and registry metadata, with `events` as
   * the emitted envelope payloads. Takes precedence over `state`.
   */
  facts?: Readonly<NativeTitrationBenchFacts> | null;
}

interface NotebookView {
  readonly analyteName: string;
  readonly analyteVolumeML: number;
  readonly titrantName: string;
  readonly titrantConcentrationM: number;
  readonly indicatorName: string;
  readonly stageLabel: string;
}

/**
 * Student-facing lab notebook. Shows only information a student would have at
 * a real bench: the objective, procedure stage, known sample and titrant
 * facts, their own recorded readings, and visible observations. It must never
 * render the unknown analyte concentration, equivalence volume, session seed,
 * or other internal engine values.
 */
export function LabNotebook({
  state: stateProp,
  events: eventsProp,
  facts
}: LabNotebookProps = {}) {
  const storeState = useLabStore((store) =>
    isTitrationState(store.state) ? store.state : null
  );
  const storeEventQueue = useLabStore((store) => store.eventQueue);
  const state = stateProp !== undefined ? stateProp : storeState;
  const eventQueue = eventsProp ?? storeEventQueue;

  const view: NotebookView | null = facts
    ? {
        analyteName: facts.analyteName,
        analyteVolumeML: facts.analyteVolumeML,
        titrantName: facts.titrantName,
        titrantConcentrationM: facts.titrantConcentrationM,
        indicatorName: facts.indicatorName,
        stageLabel: facts.stageLabel
      }
    : state
      ? {
          analyteName: state.config.analyte.name,
          analyteVolumeML: state.config.analyte.volumeML,
          titrantName: state.config.titrant.name,
          titrantConcentrationM: state.config.titrant.concentrationM,
          indicatorName: state.config.indicator.replaceAll("_", " "),
          stageLabel: getProcedureStageLabel(
            getProcedureStage(state, eventQueue)
          )
        }
      : null;

  if (!view) return null;

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
          Determine the concentration of the {view.analyteName} sample by
          titrating it with the standardized {view.titrantName} solution.
        </p>
      </section>

      <section className={styles.section} aria-label="Current stage">
        <h3>Current stage</h3>
        <p className={styles.stage}>{view.stageLabel}</p>
      </section>

      <section className={styles.section} aria-label="Known values">
        <h3>Known values</h3>
        <dl className={styles.factList}>
          <div>
            <dt>Sample</dt>
            <dd>
              {view.analyteVolumeML.toFixed(1)} mL {view.analyteName},
              concentration unknown
            </dd>
          </div>
          <div>
            <dt>Titrant</dt>
            <dd>
              {view.titrantConcentrationM.toFixed(3)} M {view.titrantName}
            </dd>
          </div>
          <div>
            <dt>Indicator</dt>
            <dd className={styles.indicator}>{view.indicatorName}</dd>
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
