"use client";

import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent
} from "react";

import type { SetupDrivenLabProjection } from "../../../stores/setupDrivenLabSession";
import { EQUIPMENT, type EquipmentId } from "./equipment";
import { enumValueLabel, registeredEnumParameters } from "./actionParameters";
import {
  FLOW_RATES_ML_PER_S,
  type DispenseGestureController,
  type FlowDetent
} from "./useDispenseGesture";

import sceneStyles from "../titration/TitrationScene.module.css";
import styles from "./SetupDrivenWorkspace.module.css";

export interface FocusedDispenseControl {
  readonly controller: DispenseGestureController;
  readonly enabled: boolean;
}

export interface FocusedEquipmentActionPanelProps {
  readonly focused: EquipmentId;
  readonly actions: SetupDrivenLabProjection["actions"];
  readonly equipmentLabels: ReadonlyMap<string, string>;
  readonly actionLabel: (
    action: SetupDrivenLabProjection["actions"][number]
  ) => string;
  readonly completedActionMessage: (
    action: SetupDrivenLabProjection["actions"][number]
  ) => string | null;
  readonly parameterLabel: (parameterKey: string) => string;
  readonly parameterValue: (
    action: SetupDrivenLabProjection["actions"][number],
    key: string
  ) => string;
  readonly onParameterChange: (
    action: SetupDrivenLabProjection["actions"][number],
    key: string,
    value: string
  ) => void;
  readonly onDispatch: (
    action: SetupDrivenLabProjection["actions"][number]
  ) => void;
  readonly onClearFocus: () => void;
  /**
   * Optional hold-to-dispense stopcock control rendered with the focused
   * dispense action. Pointer-hold or holding Space drives continuous
   * delivery; the typed volume + Apply below remains the precise entry path.
   */
  readonly dispense?: FocusedDispenseControl | null;
}

/**
 * Titration-style in-simulation action panel for the focused native-lab
 * equipment selection.
 */
export function FocusedEquipmentActionPanel({
  focused,
  actions,
  equipmentLabels,
  actionLabel,
  completedActionMessage,
  parameterLabel,
  parameterValue,
  onParameterChange,
  onDispatch,
  onClearFocus,
  dispense = null
}: FocusedEquipmentActionPanelProps) {
  const equipment = EQUIPMENT[focused];
  const isDispensing = dispense?.controller.state.isHolding ?? false;
  const canHoldDispense = Boolean(
    dispense?.enabled &&
      dispense.controller.state.selectedDetent !== "closed"
  );

  function handleHoldPointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!dispense || !canHoldDispense) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dispense.controller.start();
  }

  function handleHoldPointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!dispense || !isDispensing) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dispense.controller.end("pointer_up");
  }

  function handleHoldKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== " " || event.repeat || !dispense || !canHoldDispense) {
      return;
    }
    event.preventDefault();
    dispense.controller.start();
  }

  function handleHoldKeyUp(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key !== " " || !dispense || !isDispensing) return;
    event.preventDefault();
    dispense.controller.end("pointer_up");
  }
  return (
    <section
      className={sceneStyles.washSetup}
      aria-labelledby="focused-equipment-actions-heading"
      data-focused-equipment={focused}
    >
      <p className={sceneStyles.washEyebrow}>Selected equipment</p>
      <h3 id="focused-equipment-actions-heading">{equipment.name}</h3>
      <p>{equipment.purpose}</p>
      {actions.length === 0 ? (
        <p>
          No actions are available for this apparatus in the current attempt.
          Select another piece of equipment or open Lab steps for the full
          procedure list.
        </p>
      ) : (
        <div className={styles.focusedActionList}>
          {actions.map((action) => {
            const completionMessage = completedActionMessage(action);
            const unavailableMessage =
              !action.available && !completionMessage
                ? "Unavailable in the current attempt"
                : null;
            return (
              <fieldset
                key={action.permissionId}
                disabled={!action.available || completionMessage !== null}
              >
                <legend>{actionLabel(action)}</legend>
                <p>
                  {action.sourceEquipmentInstanceId
                    ? equipmentLabels.get(action.sourceEquipmentInstanceId)
                    : "Lab setup"}
                  {action.targetEquipmentInstanceIds.length > 0
                    ? ` → ${action.targetEquipmentInstanceIds
                        .map((id) => equipmentLabels.get(id) ?? "equipment")
                        .join(", ")}`
                    : ""}
                </p>
                {dispense && action.actionId === "action.dispense.v1" && (
                  <div className={styles.stopcockControl}>
                    <label>
                      Flow detent
                      <span>
                        <select
                          value={dispense.controller.state.selectedDetent}
                          onChange={(event) =>
                            dispense.controller.setDetent(
                              event.currentTarget.value as FlowDetent
                            )
                          }
                          disabled={!dispense.enabled && !isDispensing}
                        >
                          <option value="closed">Closed — 0 mL/s</option>
                          <option value="dropwise">
                            Dropwise — {FLOW_RATES_ML_PER_S.dropwise.toFixed(2)}{" "}
                            mL/s
                          </option>
                          <option value="slow">
                            Slow — {FLOW_RATES_ML_PER_S.slow.toFixed(2)} mL/s
                          </option>
                          <option value="open">
                            Open — {FLOW_RATES_ML_PER_S.open.toFixed(2)} mL/s
                          </option>
                        </select>
                      </span>
                    </label>
                    <button
                      type="button"
                      aria-pressed={isDispensing}
                      data-dispensing={isDispensing ? "true" : "false"}
                      disabled={!canHoldDispense}
                      onPointerDown={handleHoldPointerDown}
                      onPointerUp={handleHoldPointerUp}
                      onPointerCancel={() =>
                        dispense.controller.end("pointer_cancel")
                      }
                      onKeyDown={handleHoldKeyDown}
                      onKeyUp={handleHoldKeyUp}
                      onBlur={() => {
                        if (isDispensing) dispense.controller.end("blur");
                      }}
                    >
                      {isDispensing ? "Dispensing…" : "Hold to dispense"}
                    </button>
                    <small role="status" aria-live="polite">
                      {isDispensing
                        ? `Valve open at ${FLOW_RATES_ML_PER_S[
                            dispense.controller.state.activeDetent
                          ].toFixed(2)} mL/s · ${dispense.controller.state.pendingML.toFixed(3)} mL pending`
                        : "Valve closed. Hold the button or Space key to dispense, or enter an exact volume below."}
                    </small>
                  </div>
                )}
                {action.numericParameterBounds.map((bounds) => (
                  <label key={bounds.parameterKey}>
                    {parameterLabel(bounds.parameterKey)}
                    <span>
                      <input
                        type="number"
                        value={parameterValue(action, bounds.parameterKey)}
                        min={bounds.effectiveMinimum ?? undefined}
                        max={bounds.effectiveMaximum ?? undefined}
                        step={bounds.parameterKey === "inversions" ? 1 : 0.01}
                        onChange={(event) =>
                          onParameterChange(
                            action,
                            bounds.parameterKey,
                            event.currentTarget.value
                          )
                        }
                        disabled={isDispensing}
                      />
                      {bounds.unitId === "unit.ml.v1"
                        ? " mL"
                        : bounds.unitId === "unit.celsius.v1"
                          ? " °C"
                          : ""}
                    </span>
                  </label>
                ))}
                {registeredEnumParameters(action.actionId).map((parameter) => (
                  <label key={parameter.key}>
                    {parameterLabel(parameter.key)}
                    <span>
                      <select
                        value={parameterValue(action, parameter.key)}
                        onChange={(event) =>
                          onParameterChange(
                            action,
                            parameter.key,
                            event.currentTarget.value
                          )
                        }
                      >
                        {parameter.allowedValues.map((value) => (
                          <option key={value} value={value}>
                            {enumValueLabel(value)}
                          </option>
                        ))}
                      </select>
                    </span>
                  </label>
                ))}
                <button
                  type="button"
                  disabled={isDispensing}
                  onClick={() => onDispatch(action)}
                >
                  Apply
                </button>
                {(completionMessage || unavailableMessage) && (
                  <small>{completionMessage ?? unavailableMessage}</small>
                )}
              </fieldset>
            );
          })}
        </div>
      )}
      <button type="button" onClick={onClearFocus}>
        ← Back to full bench
      </button>
    </section>
  );
}
