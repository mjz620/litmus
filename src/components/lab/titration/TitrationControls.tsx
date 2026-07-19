"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  type PointerEvent,
  useState
} from "react";

import type { SemanticEvent } from "../../../experiments/shared";
import {
  formatBuretteVolume,
  formatPH
} from "../../../experiments/titration/display";
import type { IndicatorId } from "../../../experiments/titration/titration";
import { isTitrationState, useLabStore } from "../../../stores/labStore";
import { getLabSounds } from "../three/labSounds";
import { type ControlGroupId, getVisibleControlGroups } from "./equipment";
import {
  getIndicatorLabel,
  IndicatorSelectionDialog
} from "./IndicatorSelectionDialog";
import {
  DISPENSE_RESIDUE_ML,
  FLOW_RATES_ML_PER_S,
  type FlowDetent,
  useDispenseGesture
} from "./useDispenseGesture";

import styles from "./TitrationControls.module.css";

const indicatorOptions: ReadonlyArray<{
  value: IndicatorId;
  label: string;
}> = [
  { value: "phenolphthalein", label: "Phenolphthalein" },
  { value: "bromothymol_blue", label: "Bromothymol blue" },
  { value: "methyl_orange", label: "Methyl orange" }
];

function formatDispenseLimit(volumeML: number): string {
  const fixed = volumeML.toFixed(6);
  const trimmed = fixed.replace(/0+$/, "").replace(/\.$/, "");
  const [whole, fraction = ""] = trimmed.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}

interface TitrationControlsProps {
  /**
   * Control groups to render; defaults to every group. Selecting equipment in
   * the 3D scene narrows this to that object's contextual controls.
   */
  visibleGroups?: readonly ControlGroupId[];
  /** Selected equipment name shown as the contextual heading. */
  contextLabel?: string;
  /** Runtime-authored maximum for one normalized dispense action. */
  maxDispenseVolumeML?: number | null;
  /** Effective registered/authored minimum for one normalized dispense action. */
  minDispenseVolumeML?: number | null;
  /** Shows an action-aware empty state for a setup-driven selection. */
  setupDriven?: boolean;
}

export function TitrationControls({
  visibleGroups = getVisibleControlGroups(null),
  contextLabel,
  minDispenseVolumeML = null,
  maxDispenseVolumeML = null,
  setupDriven = false
}: TitrationControlsProps = {}) {
  const state = useLabStore((store) =>
    isTitrationState(store.state) ? store.state : null
  );
  const eventQueue = useLabStore((store) => store.eventQueue);
  const dispatch = useLabStore((store) => store.dispatch);
  const sessionId = useLabStore((store) => store.sessionId);
  const [additionVolume, setAdditionVolume] = useState("0.10");
  const [additionDuration, setAdditionDuration] = useState("4");
  const [reportedMeniscus, setReportedMeniscus] = useState("0.00");
  const [fillVolume, setFillVolume] = useState("50.00");
  const [inputError, setInputError] = useState<string | null>(null);
  const [indicatorCandidate, setIndicatorCandidate] = useState<IndicatorId>(
    state?.config.indicator ?? "phenolphthalein"
  );
  const [pendingIndicator, setPendingIndicator] = useState<IndicatorId | null>(
    null
  );
  const [preparationLiquid, setPreparationLiquid] = useState<
    "water" | "titrant" | null
  >(null);
  const [funnelSelected, setFunnelSelected] = useState(false);
  const availableVolumeML = state?.buretteAvailableML ?? 0;
  const minimumManualDispenseML = minDispenseVolumeML ?? 0.01;
  const minimumGestureCommitML = minDispenseVolumeML ?? DISPENSE_RESIDUE_ML;
  // Manual typed additions stay bounded by the per-action workflow max.
  const availableDispenseVolumeML = Math.min(
    availableVolumeML,
    maxDispenseVolumeML ?? availableVolumeML
  );
  const deliveryPermissionAvailable = visibleGroups.includes("deliver");
  const indicatorAdded = state?.indicatorAdded ?? false;
  const hasAvailableTitrant = availableVolumeML > 0;
  const dispense = useDispenseGesture({
    availableML: availableVolumeML,
    minimumCommitML: minimumGestureCommitML,
    maximumCommitML: maxDispenseVolumeML,
    enabled:
      deliveryPermissionAvailable &&
      indicatorAdded &&
      availableVolumeML >= minimumGestureCommitML,
    onCommit: () =>
      playDeliverySounds(useLabStore.getState().eventQueue.slice(-1)),
    onDetentChange: () => getLabSounds().playFromGesture("valve"),
    onGestureStart: () => getLabSounds().playFromGesture("valve"),
    onGestureEnd: () => getLabSounds().playFromGesture("valve")
  });

  if (!state) return null;

  const latestPH = eventQueue.findLast(
    ({ observation }) => typeof observation.pH === "number"
  )?.observation.pH;
  const canRinseBurette =
    state.fillCount === 0 && state.buretteAvailableML === 0;
  const hasRinsedBurette =
    state.buretteConditioned || state.titrantDilutionFactor < 1;
  const needsRinse = canRinseBurette && !hasRinsedBurette;
  const preparationReady = preparationLiquid === "titrant" && funnelSelected;
  const remainingFillCapacityML =
    state.config.buretteCapacityML - state.buretteAvailableML;
  const isDispensing = dispense.state.isHolding;
  const canFillBurette =
    remainingFillCapacityML > 0 && !isDispensing && preparationReady;
  const canHoldDispense =
    indicatorAdded &&
    availableVolumeML >= minimumGestureCommitML &&
    dispense.state.selectedDetent !== "closed";
  const conditioningStatus = state.buretteConditioned
    ? "Conditioned with titrant"
    : state.titrantDilutionFactor < 1
      ? "Rinsed with water — dilution risk"
      : "Not conditioned";

  function eventsSince(count: number): SemanticEvent[] {
    return useLabStore.getState().eventQueue.slice(count);
  }

  function playDeliverySounds(events = eventQueue.slice(-1)) {
    const sounds = getLabSounds();
    sounds.playFromGesture("drop");
    if (
      events.some(
        (event) =>
          event.flags.includes("endpoint_overshoot") ||
          event.evidence.some(
            ({ reason }) => reason === "controlled_addition_near_endpoint"
          )
      )
    ) {
      sounds.playFromGesture("endpoint", sessionId ?? "unscoped-session");
    }
  }

  function handleAddition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const volumeML = Number(additionVolume);
    const durationS = Number(additionDuration);

    if (!Number.isFinite(volumeML) || volumeML < minimumManualDispenseML) {
      setInputError(
        `Enter at least ${formatDispenseLimit(minimumManualDispenseML)} mL of titrant.`
      );
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
    if (!indicatorAdded) {
      setInputError("Review and add one indicator before adding titrant.");
      return;
    }
    if (volumeML > availableVolumeML) {
      setInputError(
        `Only ${formatBuretteVolume(availableVolumeML)} mL remains in the burette.`
      );
      return;
    }
    if (maxDispenseVolumeML !== null && volumeML > maxDispenseVolumeML) {
      setInputError(
        `This workflow permits at most ${formatBuretteVolume(maxDispenseVolumeML)} mL per addition.`
      );
      return;
    }

    setInputError(null);
    const eventCount = eventQueue.length;
    dispatch({ type: "add_titrant", volumeML, durationS });
    playDeliverySounds(eventsSince(eventCount));
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

  function handleFill() {
    const volumeML = Number(fillVolume);
    if (!Number.isFinite(volumeML) || volumeML <= 0) {
      setInputError("Enter a fill volume greater than zero.");
      return;
    }
    if (volumeML > remainingFillCapacityML + 1e-9) {
      setInputError(
        `Only ${formatBuretteVolume(remainingFillCapacityML)} mL fits before capacity.`
      );
      return;
    }
    setInputError(null);
    dispatch({ type: "fill_burette", volumeML });
    getLabSounds().playFromGesture("rinse_fill");
    setPreparationLiquid(null);
    setFunnelSelected(false);
  }

  function handleRinse() {
    if (!preparationLiquid || !funnelSelected || !needsRinse) return;
    dispatch({ type: "rinse_burette", solvent: preparationLiquid });
    getLabSounds().playFromGesture("rinse_fill");
  }

  function confirmIndicatorAddition() {
    if (!pendingIndicator || indicatorAdded) return;
    dispatch({ type: "select_indicator", indicator: pendingIndicator });
    getLabSounds().playFromGesture("indicator");
    setPendingIndicator(null);
  }

  function handleHoldPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!canHoldDispense) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dispense.start();
  }

  function handleHoldPointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (!isDispensing) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dispense.end("pointer_up");
  }

  function handleHoldKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== " " || event.repeat || !canHoldDispense) return;

    event.preventDefault();
    dispense.start();
  }

  function handleHoldKeyUp(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== " " || !isDispensing) return;

    event.preventDefault();
    dispense.end("pointer_up");
  }

  return (
    <section className={styles.controls} aria-labelledby="controls-heading">
      <div className={styles.headingRow}>
        <div>
          <p className={styles.eyebrow}>Precision controls</p>
          <h2 id="controls-heading">{contextLabel ?? "Burette and flask"}</h2>
        </div>
        <div
          className={styles.liveReading}
          aria-label="Current engine readings"
          aria-live="polite"
        >
          <span>{formatBuretteVolume(state.titrantAddedML)} mL cumulative</span>
          <span>
            {formatBuretteVolume(state.buretteReadingML)} mL current reading
          </span>
          <span>{formatBuretteVolume(availableVolumeML)} mL available</span>
          {typeof latestPH === "number" && <span>pH {formatPH(latestPH)}</span>}
        </div>
      </div>

      <div className={styles.controlGrid}>
        {setupDriven && visibleGroups.length === 0 && (
          <div className={styles.noAction} role="status">
            <strong>No action is available for this selection yet.</strong>
            <span>
              Choose equipment associated with the current workflow step.
            </span>
          </div>
        )}
        {visibleGroups.includes("prepare") && (
          <fieldset className={styles.controlGroup}>
            <legend>1. Prepare burette</legend>
            <p className={styles.groupStatus}>{conditioningStatus}</p>
            <p className={styles.note}>
              Select a liquid and the fill funnel before rinsing or filling.
            </p>
            <div
              className={styles.buttonRow}
              role="group"
              aria-label="Preparation liquid"
            >
              <button
                type="button"
                aria-pressed={preparationLiquid === "water"}
                disabled={!canRinseBurette || !needsRinse}
                onClick={() => setPreparationLiquid("water")}
              >
                Select distilled water
              </button>
              <button
                type="button"
                aria-pressed={preparationLiquid === "titrant"}
                disabled={!canRinseBurette && remainingFillCapacityML <= 0}
                onClick={() => setPreparationLiquid("titrant")}
              >
                Select titrant
              </button>
              <button
                type="button"
                aria-pressed={funnelSelected}
                disabled={remainingFillCapacityML <= 0}
                onClick={() => setFunnelSelected((current) => !current)}
              >
                {funnelSelected ? "Funnel selected" : "Select fill funnel"}
              </button>
            </div>
            {needsRinse && (
              <button
                className={styles.primaryButton}
                type="button"
                disabled={!preparationLiquid || !funnelSelected}
                onClick={handleRinse}
              >
                {preparationLiquid
                  ? `Rinse with ${preparationLiquid}`
                  : "Select rinse setup"}
              </button>
            )}
            <label>
              Amount to add to burette (mL)
              <input
                type="number"
                min="0.01"
                max={remainingFillCapacityML}
                step="0.01"
                value={fillVolume}
                onChange={(event) => setFillVolume(event.currentTarget.value)}
                aria-describedby="burette-availability"
                disabled={!canFillBurette}
              />
            </label>
            <div className={styles.buttonRow}>
              <button
                type="button"
                disabled={!canFillBurette}
                onClick={() =>
                  setFillVolume(formatBuretteVolume(remainingFillCapacityML))
                }
              >
                Full-capacity preset
              </button>
              <button
                className={styles.primaryButton}
                type="button"
                disabled={!canFillBurette}
                onClick={handleFill}
              >
                {state.fillCount === 0 ? "Fill burette" : "Add refill"}
              </button>
            </div>
            <p className={styles.note} id="burette-availability">
              {hasAvailableTitrant
                ? `${formatBuretteVolume(availableVolumeML)} mL remains available.`
                : needsRinse
                  ? "Choose a liquid and the funnel, then confirm the rinse."
                  : !preparationReady
                    ? "The burette is rinsed. Select titrant and the funnel before filling."
                    : state.fillCount > 0
                      ? "The burette is empty. Add a full or custom partial refill to continue."
                      : "The burette is empty. Rinse it before filling for correct technique."}
            </p>
          </fieldset>
        )}

        {visibleGroups.includes("indicator") && (
          <div className={styles.controlGroup}>
            <label htmlFor="indicator">2. Indicator</label>
            <select
              id="indicator"
              value={
                state.indicatorAdded
                  ? state.config.indicator
                  : indicatorCandidate
              }
              disabled={state.indicatorAdded}
              onChange={(event) =>
                setIndicatorCandidate(event.currentTarget.value as IndicatorId)
              }
            >
              {indicatorOptions.map((indicator) => (
                <option key={indicator.value} value={indicator.value}>
                  {indicator.label}
                </option>
              ))}
            </select>
            <p className={styles.note}>
              {state.indicatorAdded
                ? `${getIndicatorLabel(state.config.indicator)} is already in the flask and cannot be changed.`
                : "Review the transition range and observed colors before confirming one addition."}
            </p>
            {!state.indicatorAdded && (
              <button
                className={styles.primaryButton}
                type="button"
                onClick={() => setPendingIndicator(indicatorCandidate)}
              >
                Review indicator details
              </button>
            )}
          </div>
        )}

        {visibleGroups.includes("deliver") && (
          <form className={styles.controlGroup} onSubmit={handleAddition}>
            <h3>3. Add titrant (stopcock)</h3>
            <label>
              Flow detent
              <select
                value={dispense.state.selectedDetent}
                onChange={(event) =>
                  dispense.setDetent(event.currentTarget.value as FlowDetent)
                }
                disabled={!hasAvailableTitrant}
              >
                <option value="closed">Closed — 0 mL/s</option>
                <option value="dropwise">
                  Dropwise — {FLOW_RATES_ML_PER_S.dropwise.toFixed(2)} mL/s
                </option>
                <option value="slow">
                  Slow — {FLOW_RATES_ML_PER_S.slow.toFixed(2)} mL/s
                </option>
                <option value="open">
                  Open — {FLOW_RATES_ML_PER_S.open.toFixed(2)} mL/s
                </option>
              </select>
            </label>
            <button
              className={styles.primaryButton}
              type="button"
              aria-pressed={isDispensing}
              data-dispensing={isDispensing ? "true" : "false"}
              disabled={!canHoldDispense}
              onPointerDown={handleHoldPointerDown}
              onPointerUp={handleHoldPointerUp}
              onPointerCancel={() => dispense.end("pointer_cancel")}
              onKeyDown={handleHoldKeyDown}
              onKeyUp={handleHoldKeyUp}
              onBlur={() => {
                if (isDispensing) dispense.end("blur");
              }}
            >
              {isDispensing ? "Dispensing…" : "Hold to dispense"}
            </button>
            <p className={styles.note} role="status" aria-live="polite">
              {isDispensing
                ? `Valve open at ${FLOW_RATES_ML_PER_S[dispense.state.activeDetent].toFixed(2)} mL/s · ${dispense.state.pendingML.toFixed(3)} mL pending`
                : "Valve closed. Hold the button or Space key to dispense."}
            </p>
            <div className={styles.fieldGrid}>
              <label>
                Volume to add (mL)
                <input
                  type="number"
                  min={minimumManualDispenseML}
                  max={availableDispenseVolumeML}
                  step="0.01"
                  value={additionVolume}
                  onChange={(event) =>
                    setAdditionVolume(event.currentTarget.value)
                  }
                  onInvalid={(event) => {
                    event.preventDefault();
                    const volumeML = Number(event.currentTarget.value);
                    if (
                      Number.isFinite(volumeML) &&
                      volumeML > availableDispenseVolumeML
                    ) {
                      setInputError(
                        `This workflow permits at most ${formatDispenseLimit(availableDispenseVolumeML)} mL per addition.`
                      );
                      return;
                    }
                    setInputError(
                      `Enter a volume from ${formatDispenseLimit(minimumManualDispenseML)} to ${formatDispenseLimit(availableDispenseVolumeML)} mL.`
                    );
                  }}
                  disabled={!hasAvailableTitrant || isDispensing}
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
                  disabled={!hasAvailableTitrant || isDispensing}
                  required
                />
              </label>
            </div>
            {setupDriven && (
              <p className={styles.note}>
                Workflow range per addition:{" "}
                {formatDispenseLimit(minimumManualDispenseML)}–
                {formatDispenseLimit(availableDispenseVolumeML)} mL
              </p>
            )}
            <div className={styles.presetRow} aria-label="Volume presets">
              <button
                type="button"
                disabled={
                  !hasAvailableTitrant ||
                  isDispensing ||
                  minimumManualDispenseML > 1 ||
                  availableDispenseVolumeML < 1
                }
                onClick={() => setAdditionVolume("1.00")}
              >
                Coarse 1.00 mL
              </button>
              <button
                type="button"
                disabled={
                  !hasAvailableTitrant ||
                  isDispensing ||
                  minimumManualDispenseML > 0.1 ||
                  availableDispenseVolumeML < 0.1
                }
                onClick={() => setAdditionVolume("0.10")}
              >
                Fine 0.10 mL
              </button>
              <button
                type="button"
                disabled={
                  !hasAvailableTitrant ||
                  isDispensing ||
                  minimumManualDispenseML > 0.05 ||
                  availableDispenseVolumeML < 0.05
                }
                onClick={() => setAdditionVolume("0.05")}
              >
                Drop 0.05 mL
              </button>
            </div>
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={
                !state.indicatorAdded || !hasAvailableTitrant || isDispensing
              }
            >
              Add titrant
            </button>
          </form>
        )}

        {visibleGroups.includes("reading") && (
          <form
            className={styles.controlGroup}
            onSubmit={handleMeniscusReading}
          >
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
                setReportedMeniscus(formatBuretteVolume(state.buretteReadingML))
              }
            >
              Use displayed reading
            </button>
            <button className={styles.primaryButton} type="submit">
              Record meniscus reading
            </button>
          </form>
        )}
      </div>

      {inputError && (
        <p className={styles.inputError} role="alert">
          {inputError}
        </p>
      )}
      {pendingIndicator && !state.indicatorAdded && (
        <IndicatorSelectionDialog
          indicator={pendingIndicator}
          onCancel={() => setPendingIndicator(null)}
          onConfirm={confirmIndicatorAddition}
        />
      )}
    </section>
  );
}
