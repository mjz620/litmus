"use client";

import { type FormEvent, useState } from "react";

import {
  formatBuretteVolume,
  formatPH
} from "../../../experiments/titration/display";
import type { IndicatorId } from "../../../experiments/titration/titration";
import { useLabStore } from "../../../stores/labStore";

import styles from "./TitrationControls.module.css";

const indicatorOptions: ReadonlyArray<{
  value: IndicatorId;
  label: string;
}> = [
  { value: "phenolphthalein", label: "Phenolphthalein" },
  { value: "bromothymol_blue", label: "Bromothymol blue" },
  { value: "methyl_orange", label: "Methyl orange" }
];

export function TitrationControls() {
  const state = useLabStore((store) => store.state);
  const eventQueue = useLabStore((store) => store.eventQueue);
  const dispatch = useLabStore((store) => store.dispatch);
  const [additionVolume, setAdditionVolume] = useState("0.10");
  const [additionDuration, setAdditionDuration] = useState("4");
  const [reportedMeniscus, setReportedMeniscus] = useState("0.00");
  const [inputError, setInputError] = useState<string | null>(null);

  if (!state) return null;

  const latestPH = eventQueue.findLast(
    ({ observation }) => typeof observation.pH === "number"
  )?.observation.pH;
  const canPrepareBurette =
    state.titrantAddedML === 0 && state.buretteAvailableML === 0;
  const availableVolumeML = state.buretteAvailableML;
  const hasAvailableTitrant = availableVolumeML > 0;
  const conditioningStatus = state.buretteConditioned
    ? "Conditioned with titrant"
    : state.titrantDilutionFactor < 1
      ? "Rinsed with water — dilution risk"
      : "Not conditioned";

  function handleAddition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const volumeML = Number(additionVolume);
    const durationS = Number(additionDuration);

    if (!Number.isFinite(volumeML) || volumeML <= 0) {
      setInputError("Enter a titrant volume greater than zero.");
      return;
    }
    if (!Number.isFinite(durationS) || durationS <= 0) {
      setInputError("Enter a delivery time greater than zero.");
      return;
    }
    if (!hasAvailableTitrant) {
      setInputError("Fill the burette before adding titrant.");
      return;
    }
    if (volumeML > availableVolumeML) {
      setInputError(
        `Only ${formatBuretteVolume(availableVolumeML)} mL remains in the burette.`
      );
      return;
    }

    setInputError(null);
    dispatch({ type: "add_titrant", volumeML, durationS });
  }

  function handleMeniscusReading(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reportedML = Number(reportedMeniscus);

    if (!Number.isFinite(reportedML) || reportedML < 0) {
      setInputError("Enter a valid non-negative meniscus reading.");
      return;
    }

    setInputError(null);
    dispatch({ type: "read_meniscus", reportedML });
  }

  return (
    <section className={styles.controls} aria-labelledby="controls-heading">
      <div className={styles.headingRow}>
        <div>
          <p className={styles.eyebrow}>Precision controls</p>
          <h2 id="controls-heading">Burette and flask</h2>
        </div>
        <div
          className={styles.liveReading}
          aria-label="Current engine readings"
        >
          <span>{formatBuretteVolume(state.titrantAddedML)} mL</span>
          <span>{formatBuretteVolume(availableVolumeML)} mL available</span>
          {typeof latestPH === "number" && <span>pH {formatPH(latestPH)}</span>}
        </div>
      </div>

      <div className={styles.controlGrid}>
        <fieldset className={styles.controlGroup}>
          <legend>1. Prepare burette</legend>
          <p className={styles.groupStatus}>{conditioningStatus}</p>
          <div className={styles.buttonRow}>
            <button
              type="button"
              disabled={!canPrepareBurette}
              onClick={() =>
                dispatch({ type: "rinse_burette", solvent: "water" })
              }
            >
              Rinse with water
            </button>
            <button
              type="button"
              disabled={!canPrepareBurette}
              onClick={() =>
                dispatch({ type: "rinse_burette", solvent: "titrant" })
              }
            >
              Rinse with titrant
            </button>
          </div>
          <button
            className={styles.primaryButton}
            type="button"
            disabled={!canPrepareBurette}
            onClick={() => dispatch({ type: "fill_burette" })}
          >
            Fill burette
          </button>
          <p className={styles.note}>
            {hasAvailableTitrant
              ? `${formatBuretteVolume(availableVolumeML)} mL remains available.`
              : state.titrantAddedML > 0
                ? "The burette is empty. This practice run supports one pre-run fill."
                : "The burette is empty. Rinse it before filling for correct technique."}
          </p>
        </fieldset>

        <div className={styles.controlGroup}>
          <label htmlFor="indicator">2. Indicator</label>
          <select
            id="indicator"
            value={state.config.indicator}
            onChange={(event) =>
              dispatch({
                type: "select_indicator",
                indicator: event.currentTarget.value as IndicatorId
              })
            }
          >
            {indicatorOptions.map((indicator) => (
              <option key={indicator.value} value={indicator.value}>
                {indicator.label}
              </option>
            ))}
          </select>
          <p className={styles.note}>
            Selection is sent to the experiment engine as a typed action.
          </p>
        </div>

        <form className={styles.controlGroup} onSubmit={handleAddition}>
          <h3>3. Add titrant</h3>
          <div className={styles.fieldGrid}>
            <label>
              Volume to add (mL)
              <input
                type="number"
                min="0.01"
                max={availableVolumeML}
                step="0.01"
                value={additionVolume}
                onChange={(event) =>
                  setAdditionVolume(event.currentTarget.value)
                }
                disabled={!hasAvailableTitrant}
                required
              />
            </label>
            <label>
              Delivery time (seconds)
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={additionDuration}
                onChange={(event) =>
                  setAdditionDuration(event.currentTarget.value)
                }
                disabled={!hasAvailableTitrant}
                required
              />
            </label>
          </div>
          <div className={styles.presetRow} aria-label="Volume presets">
            <button
              type="button"
              disabled={!hasAvailableTitrant}
              onClick={() => setAdditionVolume("1.00")}
            >
              Coarse 1.00 mL
            </button>
            <button
              type="button"
              disabled={!hasAvailableTitrant}
              onClick={() => setAdditionVolume("0.10")}
            >
              Fine 0.10 mL
            </button>
            <button
              type="button"
              disabled={!hasAvailableTitrant}
              onClick={() => setAdditionVolume("0.05")}
            >
              Drop 0.05 mL
            </button>
          </div>
          <button
            className={styles.primaryButton}
            type="submit"
            disabled={!hasAvailableTitrant}
          >
            Add titrant
          </button>
        </form>

        <form className={styles.controlGroup} onSubmit={handleMeniscusReading}>
          <h3>4. Read meniscus</h3>
          <label>
            Reported burette reading (mL)
            <input
              type="number"
              min="0"
              step="0.01"
              value={reportedMeniscus}
              onChange={(event) =>
                setReportedMeniscus(event.currentTarget.value)
              }
              required
            />
          </label>
          <button
            type="button"
            onClick={() =>
              setReportedMeniscus(formatBuretteVolume(state.titrantAddedML))
            }
          >
            Use displayed reading
          </button>
          <button className={styles.primaryButton} type="submit">
            Record meniscus reading
          </button>
        </form>
      </div>

      {inputError && (
        <p className={styles.inputError} role="alert">
          {inputError}
        </p>
      )}
    </section>
  );
}
