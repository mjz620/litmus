"use client";

import { useMemo, useRef, useState } from "react";

import { CoachPanelView } from "../../coach/CoachPanel";
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
import { type CoachMessage, type CoachStatus, localCoachFallback } from "../../../stores/labStore";
import {
  createSetupDrivenNativeSession,
  type SetupDrivenLabProjection,
  type SetupDrivenNativeSession
} from "../../../stores/setupDrivenLabSession";
import { SetupDrivenBench } from "./SetupDrivenBench";

import styles from "./SetupDrivenWorkspace.module.css";

interface WorkspaceSnapshot {
  readonly projection: Readonly<SetupDrivenLabProjection>;
  readonly state: Readonly<GenericLabState>;
}

const PARAMETER_LABELS: Readonly<Record<string, string>> = Object.freeze({
  volumeML: "Volume",
  finalVolumeML: "Final volume",
  inversions: "Number of inversions"
});

function createSession(
  workflow: Readonly<ValidatedLabWorkflowSpecV2>,
  replaySeed: string,
  run: number
): SetupDrivenNativeSession {
  return createSetupDrivenNativeSession({
    sessionId: `teacher-preview-${run}`,
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
      return "Stock solution ready";
    default:
      return "Ready";
  }
}

function observableLabel(observableId: string): string {
  if (observableId === "observable.solution_concentration_m.v1")
    return "Solution concentration";
  if (observableId === "observable.solution_volume_ml.v1")
    return "Solution volume";
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
  replaySeed
}: {
  readonly workflow: Readonly<ValidatedLabWorkflowSpecV2>;
  readonly replaySeed: string;
}) {
  const [run, setRun] = useState(1);
  const [session, setSession] = useState(() =>
    createSession(workflow, replaySeed, 1)
  );
  const [current, setCurrent] = useState(() => snapshot(session));
  const [values, setValues] = useState<Readonly<Record<string, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [coachMessages, setCoachMessages] = useState<readonly CoachMessage[]>(
    []
  );
  const [coachStatus, setCoachStatus] = useState<CoachStatus>("idle");
  const [coachError, setCoachError] = useState<string | null>(null);
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
        sessionId: `teacher-preview-${run}`,
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
    const nextSession = createSession(workflow, replaySeed, nextRun);
    setRun(nextRun);
    setSession(nextSession);
    setCurrent(snapshot(nextSession));
    setValues({});
    setError(null);
    setCoachMessages([]);
    setCoachStatus("idle");
    setCoachError(null);
    servedCoachReasons.current = new Set();
  }

  const status = current.state.workflowStatus;
  return (
    <section
      className={styles.workspace}
      aria-label="Interactive setup-driven lab"
      data-workflow-status={status}
      data-workflow-id={workflow.id}
    >
      <header className={styles.workspaceHeader}>
        <div>
          <p>Student workspace</p>
          <h2>{workflow.metadata.title}</h2>
          <span>{workflow.metadata.studentSummary}</span>
        </div>
        <div className={styles.statusBlock} role="status" aria-live="polite">
          <strong>
            {status === "completed"
              ? "Lab complete"
              : status === "failed"
                ? "Attempt ended"
                : "Lab in progress"}
          </strong>
          <button type="button" onClick={restart}>
            Restart preview
          </button>
        </div>
      </header>

      <div className={styles.mainGrid}>
        <div>
          <SetupDrivenBench projection={current.projection} />
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
        </div>

        <aside className={styles.controls} aria-labelledby="actions-heading">
          <div className={styles.controlsHeading}>
            <p>Keyboard and pointer controls</p>
            <h3 id="actions-heading">Lab steps</h3>
          </div>
          {error && (
            <div className={styles.actionError} role="alert">
              {error}
            </div>
          )}
          {current.projection.actions.map((action) => {
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
                          step={bounds.parameterKey === "inversions" ? 1 : 0.01}
                          onChange={(event) => {
                            const nextValue = event.currentTarget.value;
                            setValues((currentValues) => ({
                              ...currentValues,
                              [key]: nextValue
                            }));
                          }}
                        />
                        {bounds.unitId === "unit.ml.v1" ? "mL" : ""}
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
        </aside>
      </div>

      <div className={styles.coachCard}>
        <CoachPanelView
          messages={coachMessages}
          status={coachStatus}
          error={coachError}
          sessionId={`teacher-preview-${run}`}
          askCoach={askCoach}
        />
      </div>

      <details className={styles.teacherEvidence}>
        <summary>Teacher preview evidence</summary>
        <div className={styles.evidenceGrid}>
          <section>
            <h3>Measured results</h3>
            {current.state.chemistry.observables.length === 0 ? (
              <p>No measurements yet.</p>
            ) : (
              <ul>
                {current.state.chemistry.observables.map((observable) => (
                  <li key={observable.observableId}>
                    <strong>{observableLabel(observable.observableId)}</strong>
                    <span>
                      {String(observable.value)}
                      {observable.unitId === "unit.ml.v1"
                        ? " mL"
                        : observable.unitId === "unit.mol_per_l.v1"
                          ? " mol/L"
                          : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3>Rule results</h3>
            <ul>
              {current.state.diagnoses.map((diagnosis) => (
                <li key={diagnosis.ruleId}>
                  <strong>{ruleLabel(workflow, diagnosis.ruleId)}</strong>
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
    </section>
  );
}
