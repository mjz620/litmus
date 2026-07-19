"use client";

import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { createAuthoredCoachWorkflowContext } from "../../../lib/agent/authoredCoach";
import { AUTHORED_COACH_CONTRACT_VERSION } from "../../../lib/agent/authoredCoachSchemas";
import { HttpCoachClient } from "../../../lib/agent/client";
import type { AnyCoachRequest } from "../../../lib/agent/schemas";
import { actionRegistry } from "../../../lab-workflows/registries/actions";
import { configurationRegistry } from "../../../lab-workflows/registries/configurations";
import {
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  GenericLabRuntimeError,
  type GenericLabState,
  type NormalizedLabAction
} from "../../../lab-workflows/runtime";
import type { ValidatedLabWorkflowSpecV2 } from "../../../lab-workflows/schema/v2";
import {
  type CoachMessage,
  type CoachStatus,
  localCoachFallback
} from "../../../stores/labStore";
import {
  createSetupDrivenNativeSession,
  type SetupDrivenLabProjection,
  type SetupDrivenNativeSession
} from "../../../stores/setupDrivenLabSession";
import { useLabUiStore } from "../../../stores/labUiStore";
import { ImmersiveSetupDrivenBench } from "./ImmersiveSetupDrivenBench";
import {
  projectionActionsForEquipmentFocus,
  resolveTitrationSceneConfiguration
} from "../titration/setupDrivenScene";
import type { LabVisualGesture } from "../three/gestures/LabVisualGestures";
import { gestureForNativeAction } from "../three/gestures/nativeActionGestures";
import { getLabSounds } from "../three/labSounds";

import sessionBarStyles from "../LabSessionBar.module.css";
import styles from "./SetupDrivenWorkspace.module.css";

interface WorkspaceSnapshot {
  readonly projection: Readonly<SetupDrivenLabProjection>;
  readonly state: Readonly<GenericLabState>;
}

const PARAMETER_LABELS: Readonly<Record<string, string>> = Object.freeze({
  volumeML: "Volume",
  finalVolumeML: "Final volume",
  inversions: "Number of inversions",
  reportedC: "Reported temperature"
});

function createSession(
  workflow: Readonly<ValidatedLabWorkflowSpecV2>,
  replaySeed: string,
  run: number,
  sessionIdPrefix = "teacher-preview"
): SetupDrivenNativeSession {
  return createSetupDrivenNativeSession({
    sessionId: `${sessionIdPrefix}-${run}`,
    sessionSeed: `${replaySeed}:${run}`,
    selection: {
      workflowId: workflow.id,
      workflowHash: workflow.validation.canonicalSpecHash
    },
    workflow
  });
}

function snapshot(session: SetupDrivenNativeSession): WorkspaceSnapshot {
  return Object.freeze({
    projection: session.getProjection(),
    state: session.getGenericState()
  });
}

function initialParameterValue(
  action: SetupDrivenLabProjection["actions"][number],
  key: string
): string {
  const bounds = action.numericParameterBounds.find(
    ({ parameterKey }) => parameterKey === key
  );
  if (key === "inversions") return "10";
  if (
    bounds?.effectiveMaximum !== null &&
    bounds?.effectiveMaximum !== undefined
  )
    return String(bounds.effectiveMaximum);
  if (
    bounds?.effectiveMinimum !== null &&
    bounds?.effectiveMinimum !== undefined
  )
    return String(bounds.effectiveMinimum);
  return "";
}

function actionLabel(
  action: SetupDrivenLabProjection["actions"][number],
  projection: Readonly<SetupDrivenLabProjection>
): string {
  switch (action.actionId) {
    case "action.rinse_transfer_device.v1":
      return "Condition the pipette";
    case "action.fill_to_mark.v1":
      return "Fill the flask to the mark";
    case "action.mix_solution.v1":
      return "Mix the prepared solution";
    case "action.pour_liquid.v1": {
      const source = projection.equipment.find(
        ({ instanceId }) => instanceId === action.sourceEquipmentInstanceId
      );
      return source?.equipmentDefinitionId === "component.wash_bottle.v1"
        ? "Pour cold water into the calorimeter"
        : "Pour hot water into the calorimeter";
    }
    case "action.mix_calorimeter.v1":
      return "Mix the calorimeter contents";
    case "action.set_calorimeter_lid.v1":
      return "Open or close the calorimeter lid";
    case "action.place_thermometer.v1":
      return "Place the thermometer probe";
    case "action.read_temperature.v1":
      return "Read the calorimeter temperature";
    case "action.transfer_liquid.v1": {
      const source = projection.equipment.find(
        ({ instanceId }) => instanceId === action.sourceEquipmentInstanceId
      );
      return source?.equipmentDefinitionId === "component.volumetric_pipette.v1"
        ? "Deliver the aliquot into the flask"
        : "Measure stock solution into the pipette";
    }
    default:
      return actionRegistry.get(action.actionId).purpose;
  }
}

function equipmentSummary(
  equipment: SetupDrivenLabProjection["equipment"][number]
): string {
  const value = (key: string) => equipment.stateFields[key];
  switch (equipment.equipmentDefinitionId) {
    case "component.volumetric_pipette.v1":
      return `${Number(value("availableML") ?? 0).toFixed(2)} mL held · ${value("conditionedMaterialProfileId") ? "conditioned" : "not yet conditioned"}`;
    case "component.volumetric_flask.v1":
      return `${Number(value("totalVolumeML") ?? 0).toFixed(2)} mL · ${value("mixed") ? "mixed" : "not yet mixed"}`;
    case "component.wash_bottle.v1":
      return `${Number(value("availableML") ?? 0).toFixed(2)} mL water remaining`;
    case "component.reagent_bottle.v1":
      return "Registered liquid ready";
    case "component.calorimeter.v1":
      return `${Number(value("totalVolumeML") ?? 0).toFixed(2)} mL · lid ${value("lidClosed") ? "closed" : "open"} · ${value("mixed") ? "mixed" : "not yet mixed"}`;
    case "component.thermometer.v1":
      return value("placed") ? "Probe inserted" : "Probe ready to place";
    default:
      return "Ready";
  }
}

function observableLabel(observableId: string): string {
  if (observableId === "observable.solution_concentration_m.v1")
    return "Solution concentration";
  if (observableId === "observable.solution_volume_ml.v1")
    return "Solution volume";
  if (observableId === "observable.calorimeter_temperature_c.v1")
    return "Calorimeter temperature";
  if (observableId === "observable.calorimeter_heat_content_j.v1")
    return "Calorimeter heat content";
  if (observableId === "observable.calorimeter_volume_ml.v1")
    return "Calorimeter volume";
  const entry = configurationRegistry
    .list()
    .find(({ id }) => id === observableId);
  return entry?.description ?? "Measured result";
}

function ruleLabel(
  workflow: Readonly<ValidatedLabWorkflowSpecV2>,
  ruleId: string
): string {
  const rule = workflow.rules.find(({ id }) => id === ruleId);
  if (!rule) return "Workflow requirement";
  const condition = rule.condition;
  switch (condition.kind) {
    case "equipment_state_equals": {
      const equipment = workflow.equipment.find(
        ({ instanceId }) => instanceId === condition.equipmentInstanceId
      );
      if (condition.stateFieldKey === "conditionedMaterialProfileId")
        return "Pipette conditioned with stock solution";
      if (condition.stateFieldKey === "mixCount")
        return "Solution mixed thoroughly";
      return `${equipment?.label ?? "Equipment"} ready`;
    }
    case "action_observed":
      if (condition.actionId === "action.rinse_transfer_device.v1")
        return "Pipette conditioning observed";
      if (condition.actionId === "action.fill_to_mark.v1")
        return "Flask filled to the mark";
      if (condition.actionId === "action.mix_solution.v1")
        return "Prepared solution mixed";
      return condition.sourceEquipmentInstanceId === "transfer_pipette"
        ? "Aliquot delivered to the flask"
        : "Stock aliquot measured";
    case "observable_within_tolerance":
      return `${observableLabel(condition.observableId)} within the required range`;
    case "rule_satisfied_before":
      return "Steps completed in the required order";
    case "registered_completion_policy_satisfied":
      return "All required work complete";
    default:
      return `${rule.kind.replaceAll("_", " ")} requirement`;
  }
}

function actionErrorMessage(error: unknown): string {
  if (error instanceof GenericLabRuntimeError) {
    if (error.code === "generic-runtime.parameter_invalid.v1")
      return "That value is outside the permitted range. Check the field and try again.";
    if (error.code === "generic-runtime.precondition_failed.v1")
      return "That step is not possible with the equipment in its current state.";
    if (error.code === "generic-runtime.workflow_terminal.v1")
      return "This attempt has ended. Restart the preview to try another approach.";
  }
  return "That step was not applied. The lab remains at its last valid state.";
}

export function completedActionMessage(
  action: SetupDrivenLabProjection["actions"][number],
  projection: Readonly<SetupDrivenLabProjection>
): string | null {
  if (action.permissionId !== "permission.condition_pipette") return null;
  const pipette = projection.equipment.find(
    ({ instanceId }) => instanceId === "transfer_pipette"
  );
  return pipette?.stateFields.conditionedMaterialProfileId
    ? "Completed — the pipette is conditioned with stock solution."
    : null;
}

export function NativeSetupDrivenWorkspace({
  workflow,
  replaySeed,
  mode = "preview",
  title,
  sessionIdPrefix
}: {
  readonly workflow: Readonly<ValidatedLabWorkflowSpecV2>;
  readonly replaySeed: string;
  readonly mode?: "preview" | "assignment" | "practice";
  readonly title?: string;
  readonly sessionIdPrefix?: string;
}) {
  const prefix =
    sessionIdPrefix ??
    (mode === "assignment"
      ? "assignment"
      : mode === "practice"
        ? "practice"
        : "teacher-preview");
  const heading =
    title ??
    (mode === "assignment"
      ? "Assigned lab"
      : mode === "practice"
        ? "Practice lab"
        : "Teacher preview");
  const [run, setRun] = useState(1);
  const [session, setSession] = useState(() =>
    createSession(workflow, replaySeed, 1, prefix)
  );
  const [current, setCurrent] = useState(() => snapshot(session));
  const [values, setValues] = useState<Readonly<Record<string, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [coachMessages, setCoachMessages] = useState<readonly CoachMessage[]>(
    []
  );
  const [coachStatus, setCoachStatus] = useState<CoachStatus>("idle");
  const [coachError, setCoachError] = useState<string | null>(null);
  const [activeVisualGesture, setActiveVisualGesture] =
    useState<LabVisualGesture | null>(null);
  const gestureSequenceRef = useRef(0);
  const coachClient = useRef(new HttpCoachClient()).current;
  const coachMessageSequence = useRef(0);
  const servedCoachReasons = useRef<Set<string>>(new Set());
  const equipmentLabels = useMemo(
    () =>
      new Map(
        current.projection.equipment.map(({ instanceId, label }) => [
          instanceId,
          label
        ])
      ),
    [current.projection.equipment]
  );

  function parameterValue(
    action: SetupDrivenLabProjection["actions"][number],
    key: string
  ): string {
    return (
      values[`${action.permissionId}:${key}`] ??
      initialParameterValue(action, key)
    );
  }

  async function requestCoach(
    studentQuestion: string | undefined,
    source: "event" | "question" | "retry",
    maxHintLevel: 0 | 1 | 2 | 3,
    reasons: readonly string[]
  ): Promise<void> {
    setCoachStatus("loading");
    setCoachError(null);
    const appendCoachMessage = (
      response: Awaited<ReturnType<HttpCoachClient["request"]>>
    ) => {
      if (!response.shouldRespond || !response.message) return;
      setCoachMessages((messages) => [
        ...messages,
        {
          id: `coach-message-${coachMessageSequence.current++}`,
          role: "coach",
          text: response.message,
          response
        }
      ]);
    };
    try {
      const authoredContext = createAuthoredCoachWorkflowContext(
        workflow,
        session.getGenericState()
      );
      const coachRequest: AnyCoachRequest = {
        contractVersion: AUTHORED_COACH_CONTRACT_VERSION,
        sessionId: `${prefix}-${run}`,
        experimentId: workflow.id,
        workflowContext: authoredContext,
        studentQuestion,
        triggerPolicy: { source, reasons: [...new Set(reasons)], maxHintLevel }
      };
      appendCoachMessage(await coachClient.request(coachRequest));
    } catch {
      appendCoachMessage(localCoachFallback(studentQuestion));
    }
    setCoachStatus("idle");
  }

  async function askCoach(question: string): Promise<void> {
    const normalized = question.trim();
    if (!normalized) return;
    setCoachMessages((messages) => [
      ...messages,
      {
        id: `coach-message-${coachMessageSequence.current++}`,
        role: "student",
        text: normalized
      }
    ]);
    await requestCoach(normalized, "question", 3, ["student_question"]);
  }

  function triggerCoachOnDiagnoses(state: Readonly<GenericLabState>): void {
    const violatedReasons = state.diagnoses
      .filter(({ status }) => status === "violated")
      .map(({ ruleId }) => `diagnosis:${ruleId}`);
    const activeReasons = new Set(violatedReasons);
    for (const reason of [...servedCoachReasons.current]) {
      if (!activeReasons.has(reason)) servedCoachReasons.current.delete(reason);
    }
    const freshReasons = violatedReasons.filter(
      (reason) => !servedCoachReasons.current.has(reason)
    );
    if (freshReasons.length === 0) return;
    freshReasons.forEach((reason) => servedCoachReasons.current.add(reason));
    void requestCoach(undefined, "event", 2, freshReasons);
  }

  function dispatch(action: SetupDrivenLabProjection["actions"][number]) {
    const parameters: NormalizedLabAction["parameters"] =
      action.numericParameterBounds.map(({ parameterKey }) => ({
        key: parameterKey,
        valueType: "number" as const,
        value: Number(parameterValue(action, parameterKey))
      }));
    try {
      let poses: ReturnType<
        typeof resolveTitrationSceneConfiguration
      >["equipmentPoses"] = [];
      try {
        poses = resolveTitrationSceneConfiguration(
          current.projection
        ).equipmentPoses;
      } catch {
        poses = [];
      }
      const gesture = gestureForNativeAction({
        action,
        poses,
        sequence: ++gestureSequenceRef.current,
        projection: current.projection
      });
      if (gesture) {
        setActiveVisualGesture(gesture);
        if (gesture.kind === "pour") {
          getLabSounds().playFromGesture("rinse_fill");
        } else if (gesture.kind === "mix") {
          getLabSounds().playFromGesture("drop");
        } else {
          getLabSounds().playFromGesture("indicator");
        }
      }
      session.dispatch({
        schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
        permissionId: action.permissionId,
        actionId: action.actionId,
        sourceEquipmentInstanceId:
          action.sourceEquipmentInstanceId ?? undefined,
        targetEquipmentInstanceIds: action.targetEquipmentInstanceIds,
        parameters
      });
      const nextSnapshot = snapshot(session);
      setCurrent(nextSnapshot);
      setError(null);
      triggerCoachOnDiagnoses(nextSnapshot.state);
    } catch (dispatchError) {
      setError(actionErrorMessage(dispatchError));
    }
  }

  function restart() {
    const nextRun = run + 1;
    const nextSession = createSession(workflow, replaySeed, nextRun, prefix);
    setRun(nextRun);
    setSession(nextSession);
    setCurrent(snapshot(nextSession));
    setValues({});
    setError(null);
    setControlsOpen(false);
    setCoachMessages([]);
    setCoachStatus("idle");
    setCoachError(null);
    setActiveVisualGesture(null);
    servedCoachReasons.current = new Set();
  }

  function handleWorkspaceKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;
    if (controlsOpen) {
      event.preventDefault();
      event.stopPropagation();
      setControlsOpen(false);
      return;
    }
    const {
      lookActive,
      focused,
      setLookActive,
      clearFocus
    } = useLabUiStore.getState();
    if (lookActive) {
      event.preventDefault();
      event.stopPropagation();
      setLookActive(false);
      return;
    }
    if (!focused) return;
    event.stopPropagation();
    clearFocus();
  }

  const status = current.state.workflowStatus;
  const statusLabel =
    status === "completed"
      ? "Lab complete"
      : status === "failed"
        ? "Attempt ended"
        : "Lab in progress";
  const nextAction = current.projection.actions.find(
    (action) => action.available
  );
  const prompt =
    status === "completed"
      ? "Lab complete. Open Lab steps to review measured results, or restart for another attempt."
      : status === "failed"
        ? "Attempt ended. Restart to try the procedure again."
        : nextAction
          ? `Next: ${actionLabel(nextAction, current.projection)}.`
          : "Open Lab steps to continue the verified procedure.";
  const focused = useLabUiStore((store) => store.focused);
  const drawerActions = useMemo(() => {
    try {
      const configuration = resolveTitrationSceneConfiguration(
        current.projection
      );
      const focus =
        focused && configuration.selectableEquipmentIds.includes(focused)
          ? focused
          : null;
      return projectionActionsForEquipmentFocus(current.projection, focus);
    } catch {
      return current.projection.actions;
    }
  }, [current.projection, focused]);

  return (
    <div
      className={styles.page}
      aria-label="Interactive setup-driven lab"
      data-workflow-status={status}
      data-workflow-id={workflow.id}
      data-session-mode={mode}
    >
      <header className={sessionBarStyles.bar}>
        <div className={sessionBarStyles.identity}>
          <span className={sessionBarStyles.mark} aria-hidden="true">
            ⚗
          </span>
          <div>
            {mode !== "preview" && (
              <Link className={sessionBarStyles.backLink} href="/experiments">
                ← Experiments
              </Link>
            )}
            {mode === "preview" && (
              <p className={styles.previewEyebrow}>{heading}</p>
            )}
            <div className={sessionBarStyles.titleRow}>
              <h1>{workflow.metadata.title}</h1>
              <span className={sessionBarStyles.stage}>{statusLabel}</span>
            </div>
          </div>
        </div>
        <div className={sessionBarStyles.session}>
          <span
            className={sessionBarStyles.saveStatus}
            role="status"
            aria-live="polite"
          >
            {mode === "preview"
              ? "Teacher preview"
              : mode === "assignment"
                ? "Assigned lab"
                : "Practice mode — ready"}
          </span>
          <div className={sessionBarStyles.actions}>
            <button type="button" onClick={restart}>
              Restart attempt
            </button>
          </div>
        </div>
      </header>

      <div
        className={styles.workspace}
        data-precision-controls-open={controlsOpen ? "true" : "false"}
        onKeyDown={handleWorkspaceKeyDown}
      >
        <ImmersiveSetupDrivenBench
          projection={current.projection}
          prompt={prompt}
          statusLabel={statusLabel}
          precisionControlsOpen={controlsOpen}
          onPrecisionControlsChange={setControlsOpen}
          coachMessages={coachMessages}
          coachStatus={coachStatus}
          coachError={coachError}
          coachSessionId={`${prefix}-${run}`}
          askCoach={askCoach}
          equipmentLabels={equipmentLabels}
          actionLabel={(action) => actionLabel(action, current.projection)}
          completedActionMessage={(action) =>
            completedActionMessage(action, current.projection)
          }
          parameterLabel={(parameterKey) =>
            PARAMETER_LABELS[parameterKey] ?? "Value"
          }
          parameterValue={parameterValue}
          onParameterChange={(action, key, value) => {
            setValues((currentValues) => ({
              ...currentValues,
              [`${action.permissionId}:${key}`]: value
            }));
          }}
          onDispatch={dispatch}
          activeVisualGesture={activeVisualGesture}
          onVisualGestureComplete={(sequence) => {
            setActiveVisualGesture((currentGesture) =>
              currentGesture?.sequence === sequence ? null : currentGesture
            );
          }}
        />

        {error && (
          <div
            className={styles.actionError}
            role="alert"
            aria-live="assertive"
          >
            <div>
              <strong>Action not applied</strong>
              <p>{error}</p>
            </div>
            <button type="button" onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        )}

        {controlsOpen && (
          <div className={styles.drawer} role="presentation">
            <div className={styles.drawerHeader}>
              <div>
                <p>Keyboard and pointer controls</p>
                <h2>Lab steps</h2>
                <span className={styles.setupBadge}>Setup-driven workflow</span>
              </div>
              <button
                type="button"
                aria-label="Close lab steps"
                onClick={() => setControlsOpen(false)}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <aside className={styles.controlPanel} aria-label="Lab steps">
              <section
                className={styles.equipmentList}
                aria-labelledby="equipment-heading"
              >
                <h3 id="equipment-heading">Equipment status</h3>
                <ul>
                  {current.projection.equipment.map((equipment) => (
                    <li key={equipment.instanceId}>
                      <strong>{equipment.label}</strong>
                      <span>{equipmentSummary(equipment)}</span>
                    </li>
                  ))}
                </ul>
              </section>
              {drawerActions.map((action) => {
                const completionMessage = completedActionMessage(
                  action,
                  current.projection
                );
                const unavailableMessage =
                  !action.available && !completionMessage
                    ? "Unavailable in the current attempt"
                    : null;
                return (
                  <fieldset
                    key={action.permissionId}
                    disabled={!action.available || completionMessage !== null}
                  >
                    <legend>{actionLabel(action, current.projection)}</legend>
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
                    {action.numericParameterBounds.map((bounds) => {
                      const key = `${action.permissionId}:${bounds.parameterKey}`;
                      return (
                        <label key={bounds.parameterKey}>
                          {PARAMETER_LABELS[bounds.parameterKey] ?? "Value"}
                          <span>
                            <input
                              type="number"
                              value={parameterValue(action, bounds.parameterKey)}
                              min={bounds.effectiveMinimum ?? undefined}
                              max={bounds.effectiveMaximum ?? undefined}
                              step={
                                bounds.parameterKey === "inversions" ? 1 : 0.01
                              }
                              onChange={(event) => {
                                const nextValue = event.currentTarget.value;
                                setValues((currentValues) => ({
                                  ...currentValues,
                                  [key]: nextValue
                                }));
                              }}
                            />
                            {bounds.unitId === "unit.ml.v1"
                              ? " mL"
                              : bounds.unitId === "unit.celsius.v1"
                                ? " °C"
                                : ""}
                          </span>
                        </label>
                      );
                    })}
                    <button type="button" onClick={() => dispatch(action)}>
                      Apply step
                    </button>
                    {(completionMessage || unavailableMessage) && (
                      <small>{completionMessage ?? unavailableMessage}</small>
                    )}
                  </fieldset>
                );
              })}
              {mode === "preview" && (
                <details className={styles.teacherEvidence}>
                  <summary>Teacher preview evidence</summary>
                  <div className={styles.evidenceGrid}>
                    <section>
                      <h3>Measured results</h3>
                      {current.state.chemistry.observables.length === 0 ? (
                        <p>No measurements yet.</p>
                      ) : (
                        <ul>
                          {current.state.chemistry.observables.map(
                            (observable) => (
                              <li key={observable.observableId}>
                                <strong>
                                  {observableLabel(observable.observableId)}
                                </strong>
                                <span>
                                  {String(observable.value)}
                                  {observable.unitId === "unit.ml.v1"
                                    ? " mL"
                                    : observable.unitId === "unit.mol_per_l.v1"
                                      ? " mol/L"
                                      : observable.unitId === "unit.celsius.v1"
                                        ? " °C"
                                        : ""}
                                </span>
                              </li>
                            )
                          )}
                        </ul>
                      )}
                    </section>
                    <section>
                      <h3>Rule results</h3>
                      <ul>
                        {current.state.diagnoses.map((diagnosis) => (
                          <li key={diagnosis.ruleId}>
                            <strong>
                              {ruleLabel(workflow, diagnosis.ruleId)}
                            </strong>
                            <span>{diagnosis.status}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                    <section>
                      <h3>Observed events</h3>
                      {current.state.eventEnvelopes.length === 0 ? (
                        <p>No actions observed yet.</p>
                      ) : (
                        <ol>
                          {current.state.eventEnvelopes.map((event) => (
                            <li key={event.eventId}>
                              {event.payload.type.replaceAll("_", " ")}
                            </li>
                          ))}
                        </ol>
                      )}
                    </section>
                  </div>
                </details>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
