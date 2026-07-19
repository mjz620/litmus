"use client";

import type { SetupDrivenLabProjection } from "../../../stores/setupDrivenLabSession";
import { EQUIPMENT, type EquipmentId } from "../titration/equipment";

import sceneStyles from "../titration/TitrationScene.module.css";
import styles from "./SetupDrivenWorkspace.module.css";

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
  onClearFocus
}: FocusedEquipmentActionPanelProps) {
  const equipment = EQUIPMENT[focused];
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
                      />
                      {bounds.unitId === "unit.ml.v1"
                        ? " mL"
                        : bounds.unitId === "unit.celsius.v1"
                          ? " °C"
                          : ""}
                    </span>
                  </label>
                ))}
                <button type="button" onClick={() => onDispatch(action)}>
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
