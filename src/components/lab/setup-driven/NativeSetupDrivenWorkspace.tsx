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
  nativeTitrationCurvePoints,
  type SetupDrivenLabProjection,
  type SetupDrivenNativeSession
} from "../../../stores/setupDrivenLabSession";
import { useLabUiStore } from "../../../stores/labUiStore";
import type { SaveStatus } from "../../../lib/persistence";
import type { SemanticEvent } from "../../../experiments/shared";
import type { IndicatorId } from "../../../experiments/titration/titration";
import { LabNotebook } from "../LabNotebook";
import { nativeTitrationBenchFacts } from "./nativeTitrationFacts";
import { PHCurve } from "../PHCurve";
import { ProcedureGuide } from "../ProcedureGuide";
import { enumValueLabel, registeredEnumParameters } from "./actionParameters";
import { procedureGuideStepsFromWorkflow } from "./procedureGuideSteps";
import { ImmersiveSetupDrivenBench } from "./ImmersiveSetupDrivenBench";
import { IndicatorSelectionDialog } from "./IndicatorSelectionDialog";
import {
  projectionActionsForEquipmentFocus,
  resolveLabSceneConfiguration,
  type LabSceneConfiguration
} from "./labScene";
import type { DispenseCommit } from "./useDispenseGesture";
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
  reportedC: "Reported temperature",
  durationS: "Delivery time (seconds)",
  reportedML: "Reported burette reading",
  massG: "Mass to transfer",
  reportedG: "Balance reading",
  solvent: "Rinse liquid",
  indicator: "Indicator"
});

function asIndicatorId(value: string): IndicatorId | null {
  return value === "phenolphthalein" ||
    value === "bromothymol_blue" ||
    value === "methyl_orange"
    ? value
    : null;
}

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

/**
 * Session access for the native workspace. The workspace owns a local
 * capability session by default (teacher preview, assignments); a host that
 * needs shared-store persistence — the practice route, whose checkpoints and
 * report flow live in the lab store — injects a port over that store instead.
 * Dispatch throws on runtime rejection (session state unchanged) and returns
 * the emitted semantic events on success.
 */
export interface NativeWorkspaceSessionPort {
  readonly sessionId: string;
  getProjection(): Readonly<SetupDrivenLabProjection>;
  getGenericState(): Readonly<GenericLabState>;
  dispatch(action: NormalizedLabAction): readonly SemanticEvent[];
  restart(): void;
}

type WorkspaceSessionSource = Pick<
  NativeWorkspaceSessionPort,
  "getProjection" | "getGenericState"
>;

function snapshot(session: WorkspaceSessionSource): WorkspaceSnapshot {
  return Object.freeze({
    projection: session.getProjection(),
    state: session.getGenericState()
  });
}

function initialParameterValue(
  action: SetupDrivenLabProjection["actions"][number],
  key: string
): string {
  const enumParameter = registeredEnumParameters(action.actionId).find(
    (parameter) => parameter.key === key
  );
  if (enumParameter) return enumParameter.allowedValues[0] ?? "";
  const bounds = action.numericParameterBounds.find(
    ({ parameterKey }) => parameterKey === key
  );
  if (key === "inversions") return "10";
  if (key === "durationS") return "4";
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

function equipmentLabel(
  projection: Readonly<SetupDrivenLabProjection>,
  instanceId: string | null | undefined
): string | null {
  if (!instanceId) return null;
  return (
    projection.equipment.find(({ instanceId: id }) => id === instanceId)
      ?.label ?? null
  );
}

/**
 * "Pour <source> into <target>", using the labels the workflow author wrote.
 * Falls back to the registered action purpose when either end is unlabelled.
 */
function transferPhrase(
  action: SetupDrivenLabProjection["actions"][number],
  projection: Readonly<SetupDrivenLabProjection>,
  verb: string
): string {
  const source = equipmentLabel(projection, action.sourceEquipmentInstanceId);
  const target = equipmentLabel(
    projection,
    action.targetEquipmentInstanceIds[0]
  );
  if (!source || !target) return actionRegistry.get(action.actionId).purpose;
  return `${verb} ${source} into ${target}`;
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
    case "action.pour_liquid.v1":
      /*
       * Built from the workflow's own labels. This used to hardcode
       * "cold/hot water into the calorimeter", which was correct only for
       * calorimetry — a precipitation bench read "pour hot water into the
       * calorimeter" while pouring silver nitrate into a beaker.
       */
      return transferPhrase(action, projection, "Pour");
    case "action.mix_calorimeter.v1":
      return "Mix the calorimeter contents";
    case "action.set_calorimeter_lid.v1":
      return "Open or close the calorimeter lid";
    case "action.place_thermometer.v1":
      return "Place the thermometer probe";
    case "action.read_temperature.v1":
      return "Read the calorimeter temperature";
    case "action.place_on_balance.v1":
      return "Place the weighing boat on the balance";
    case "action.tare_balance.v1":
      return "Tare the balance";
    case "action.remove_from_balance.v1":
      return "Remove the weighing boat from the balance";
    case "action.transfer_solid.v1":
      return transferPhrase(action, projection, "Transfer solid from");
    case "action.collect_precipitate.v1":
      return "Filter, dry, and collect the precipitate";
    case "action.read_balance.v1":
      return "Read the balance";
    case "action.transfer_liquid.v1": {
      const source = projection.equipment.find(
        ({ instanceId }) => instanceId === action.sourceEquipmentInstanceId
      );
      return source?.equipmentDefinitionId === "component.volumetric_pipette.v1"
        ? "Deliver the aliquot into the flask"
        : "Measure stock solution into the pipette";
    }
    /*
     * Titration actions. Without these the switch fell through to the action
     * registry's authoring prose — "Deliver a bounded titrant volume over a
     * positive duration through the burette stopcock" — which is written for
     * the Composer, not for a student. This string is also what the bench's
     * aria-live region announces, so the jargon was the screen-reader
     * experience too.
     */
    case "action.rinse.v1":
      return "Rinse the burette with titrant";
    case "action.fill.v1":
      return "Fill the burette with titrant";
    case "action.select_indicator.v1":
      return "Choose an indicator";
    case "action.add_indicator.v1":
      return "Add indicator to the flask";
    case "action.dispense.v1":
      return "Add titrant to the flask";
    case "action.read_volume.v1":
      return "Read the burette";
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
      return "Registered material ready";
    case "component.calorimeter.v1":
      return `${Number(value("totalVolumeML") ?? 0).toFixed(2)} mL · lid ${value("lidClosed") ? "closed" : "open"} · ${value("mixed") ? "mixed" : "not yet mixed"}`;
    case "component.thermometer.v1":
      return value("placed") ? "Probe inserted" : "Probe ready to place";
    case "component.balance.v1":
      return `Reads ${Number(value("currentReadingG") ?? 0).toFixed(2)} g · ${value("panEquipmentInstanceId") ? "item on pan" : "pan empty"} · ${Number(value("tareOffsetG") ?? 0) !== 0 ? "tared" : "not tared"}`;
    case "component.weighing_boat.v1":
      return `${Number(value("emptyMassG") ?? 0).toFixed(2)} g empty mass · ${Number(value("collectedPrecipitateMassG") ?? 0).toFixed(2)} g dry precipitate · ${value("onBalance") ? "on balance" : "off balance"}`;
    /*
     * The burette reading is the measurement this whole product is about, and
     * it previously existed only as rendered pixels — both vessels fell to
     * "Ready" here, so a student using a screen reader had no way to know what
     * to enter when asked to report the reading. Volumes are read to the
     * burette's 0.01 mL graduation.
     */
    case "component.burette.v1": {
      const reading = Number(value("meniscusReadingML") ?? 0).toFixed(2);
      const delivered = Number(value("deliveredML") ?? 0).toFixed(2);
      const conditioned =
        value("conditionedWith") === "titrant"
          ? "conditioned with titrant"
          : "not yet conditioned";
      return `Reads ${reading} mL · ${delivered} mL delivered · ${conditioned}`;
    }
    case "component.erlenmeyer_flask.v1": {
      const color = value("observableColor");
      const appearance =
        typeof color === "string" && color !== "unobserved"
          ? `contents ${color}`
          : "contents not yet observed";
      return `${Number(value("totalVolumeML") ?? 0).toFixed(2)} mL · ${
        value("indicatorAdded") ? "indicator added" : "no indicator yet"
      } · ${appearance}`;
    }
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
  if (observableId === "observable.balance_reading_g.v1")
    return "Balance reading";
  if (observableId === "observable.reacted_amount_mol.v1")
    return "Amount dissolved";
  if (observableId === "observable.reaction_heat_j.v1") return "Reaction heat";
  if (observableId === "observable.measured_molar_enthalpy_kj_per_mol.v1")
    return "Measured molar enthalpy";
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
  sessionIdPrefix,
  sessionPort,
  saveStatus,
  saveError,
  onRetrySave,
  reportHref
}: {
  readonly workflow: Readonly<ValidatedLabWorkflowSpecV2>;
  readonly replaySeed: string;
  readonly mode?: "preview" | "assignment" | "practice";
  readonly title?: string;
  readonly sessionIdPrefix?: string;
  /**
   * Externally-owned session (the lab-store-backed practice route). When
   * provided the workspace never creates a local session, restarts delegate
   * to the host (which remounts the workspace with a fresh session), and all
   * dispatches flow through the port so the host can persist checkpoints.
   */
  readonly sessionPort?: NativeWorkspaceSessionPort;
  /** Checkpoint save status from the persisting host; omitted when unsaved. */
  readonly saveStatus?: SaveStatus;
  readonly saveError?: string | null;
  readonly onRetrySave?: () => void;
  /** Link to the lab report route when the host supports report submission. */
  readonly reportHref?: string;
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
  const [localSession, setLocalSession] =
    useState<SetupDrivenNativeSession | null>(() =>
      sessionPort ? null : createSession(workflow, replaySeed, 1, prefix)
    );
  const port: NativeWorkspaceSessionPort = useMemo(() => {
    if (sessionPort) return sessionPort;
    if (!localSession) {
      throw new Error("The native workspace session is unavailable.");
    }
    const session = localSession;
    return {
      sessionId: `${prefix}-${run}`,
      getProjection: session.getProjection,
      getGenericState: session.getGenericState,
      dispatch: (action: NormalizedLabAction) =>
        session.dispatch(action).events,
      restart: () => undefined
    };
  }, [sessionPort, localSession, prefix, run]);
  const [current, setCurrent] = useState(() => snapshot(port));
  const [values, setValues] = useState<Readonly<Record<string, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [coachMessages, setCoachMessages] = useState<readonly CoachMessage[]>(
    []
  );
  const [coachStatus, setCoachStatus] = useState<CoachStatus>("idle");
  const [coachError, setCoachError] = useState<string | null>(null);
  const [activeVisualGesture, setActiveVisualGesture] =
    useState<LabVisualGesture | null>(null);
  const [pendingIndicator, setPendingIndicator] = useState<{
    readonly action: SetupDrivenLabProjection["actions"][number];
    readonly indicator: IndicatorId;
  } | null>(null);
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
        port.getGenericState()
      );
      const coachRequest: AnyCoachRequest = {
        contractVersion: AUTHORED_COACH_CONTRACT_VERSION,
        sessionId: port.sessionId,
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

  function dispatch(
    action: SetupDrivenLabProjection["actions"][number],
    parameterOverrides?: Readonly<Record<string, string>>
  ) {
    const parameters: NormalizedLabAction["parameters"] = [
      ...action.numericParameterBounds.map(({ parameterKey }) => ({
        key: parameterKey,
        valueType: "number" as const,
        value: Number(parameterValue(action, parameterKey))
      })),
      // Registered enum choices (rinse solvent, indicator, lid state) are as
      // required as the numeric bounds; omitting them made every enum-typed
      // titration step undispatchable from the keyboard panels.
      ...registeredEnumParameters(action.actionId).map(({ key }) => ({
        key,
        valueType: "enum" as const,
        value: parameterOverrides?.[key] ?? parameterValue(action, key)
      }))
    ];
    try {
      let poses: ReturnType<
        typeof resolveLabSceneConfiguration
      >["equipmentPoses"] = [];
      try {
        poses = resolveLabSceneConfiguration(current.projection).equipmentPoses;
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
      } else if (
        action.actionId === "action.rinse.v1" ||
        action.actionId === "action.fill.v1"
      ) {
        // Titration bench steps reuse the existing sound layer; the burette
        // meshes animate through BuretteDispenseProvider, not a new system.
        getLabSounds().playFromGesture("rinse_fill");
      } else if (
        action.actionId === "action.add_indicator.v1" ||
        action.actionId === "action.select_indicator.v1"
      ) {
        getLabSounds().playFromGesture("indicator");
      } else if (action.actionId === "action.dispense.v1") {
        getLabSounds().playFromGesture("drop");
      }
      port.dispatch({
        schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
        permissionId: action.permissionId,
        actionId: action.actionId,
        sourceEquipmentInstanceId:
          action.sourceEquipmentInstanceId ?? undefined,
        targetEquipmentInstanceIds: action.targetEquipmentInstanceIds,
        parameters
      });
      const nextSnapshot = snapshot(port);
      setCurrent(nextSnapshot);
      setError(null);
      triggerCoachOnDiagnoses(nextSnapshot.state);
    } catch (dispatchError) {
      setError(actionErrorMessage(dispatchError));
    }
  }

  /**
   * Panel entry point for a step. Indicator additions are gated behind the
   * shared review dialog (transition range shown before one committed
   * addition); every other action dispatches directly.
   */
  function requestDispatch(
    action: SetupDrivenLabProjection["actions"][number]
  ) {
    const hasIndicatorChoice = registeredEnumParameters(action.actionId).some(
      ({ key }) => key === "indicator"
    );
    if (hasIndicatorChoice) {
      const candidate = asIndicatorId(parameterValue(action, "indicator"));
      if (candidate) {
        setPendingIndicator({ action, indicator: candidate });
        return;
      }
    }
    dispatch(action);
  }

  /** 3D indicator-shelf path into the same review dialog as the panels. */
  function handleIndicatorShelfSelect(indicator: IndicatorId) {
    const action = current.projection.actions.find(
      (candidate) =>
        candidate.available &&
        registeredEnumParameters(candidate.actionId).some(
          ({ key }) => key === "indicator"
        )
    );
    if (!action) return;
    setPendingIndicator({ action, indicator });
  }

  /**
   * Session sink for one hold-to-dispense commit: dispatches the normalized
   * `action.dispense.v1` with the gesture's exact volume and duration through
   * the native runtime. Returns false when the runtime rejects it so the
   * gesture closes the valve instead of continuing against a refused permit.
   */
  function dispatchDispenseCommit(commit: DispenseCommit): boolean {
    const action = port
      .getProjection()
      .actions.find(
        (candidate) =>
          candidate.actionId === "action.dispense.v1" && candidate.available
      );
    if (!action) return false;
    try {
      const events = port.dispatch({
        schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
        permissionId: action.permissionId,
        actionId: action.actionId,
        sourceEquipmentInstanceId:
          action.sourceEquipmentInstanceId ?? undefined,
        targetEquipmentInstanceIds: action.targetEquipmentInstanceIds,
        parameters: [
          { key: "volumeML", valueType: "number", value: commit.volumeML },
          { key: "durationS", valueType: "number", value: commit.durationS }
        ]
      });
      if (
        events.some(
          (event) =>
            event.flags.includes("endpoint_overshoot") ||
            event.evidence.some(
              ({ reason }) => reason === "controlled_addition_near_endpoint"
            )
        )
      ) {
        getLabSounds().playFromGesture("endpoint", port.sessionId);
      }
      const nextSnapshot = snapshot(port);
      setCurrent(nextSnapshot);
      setError(null);
      triggerCoachOnDiagnoses(nextSnapshot.state);
      return true;
    } catch (dispatchError) {
      setError(actionErrorMessage(dispatchError));
      return false;
    }
  }

  function restart() {
    if (sessionPort) {
      // The host owns the session: it initializes a fresh one and remounts
      // this workspace, which resets the local UI state below.
      sessionPort.restart();
      return;
    }
    const nextRun = run + 1;
    const nextSession = createSession(workflow, replaySeed, nextRun, prefix);
    setRun(nextRun);
    setLocalSession(nextSession);
    setCurrent(snapshot(nextSession));
    setValues({});
    setError(null);
    setControlsOpen(false);
    setCoachMessages([]);
    setCoachStatus("idle");
    setCoachError(null);
    setActiveVisualGesture(null);
    setPendingIndicator(null);
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
    const { lookActive, focused, setLookActive, clearFocus } =
      useLabUiStore.getState();
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
  const procedureSteps = useMemo(
    () => procedureGuideStepsFromWorkflow(workflow, current.state.diagnoses),
    [workflow, current.state.diagnoses]
  );
  const sceneConfiguration =
    useMemo((): Readonly<LabSceneConfiguration> | null => {
      try {
        return resolveLabSceneConfiguration(current.projection);
      } catch {
        return null;
      }
    }, [current.projection]);
  const drawerActions = useMemo(() => {
    if (!sceneConfiguration) return current.projection.actions;
    const focus =
      focused && sceneConfiguration.selectableEquipmentIds.includes(focused)
        ? focused
        : null;
    return projectionActionsForEquipmentFocus(current.projection, focus);
  }, [current.projection, focused, sceneConfiguration]);
  /**
   * Accessory tray data for titration benches: the pH curve is projected from
   * engine-emitted add_titrant observations, its axis from the projected
   * burette capacity, and the notebook facts from equipment-owned observables
   * plus registry metadata (never the legacy TitrationState bridge, never
   * chemistry ground truth). Seeded drills begin mid-procedure with no
   * emitted add_titrant events, so the curve deliberately starts at the first
   * native measurement.
   */
  const titrationAccessories = useMemo((): {
    readonly curvePoints: readonly { volumeML: number; pH: number }[];
    readonly chartMaxVolumeML: number;
    readonly facts: ReturnType<typeof nativeTitrationBenchFacts>;
    readonly events: readonly SemanticEvent[];
  } | null => {
    const burette = sceneConfiguration?.projectedState?.burette;
    if (!burette || burette.capacityML <= 0) return null;
    return {
      curvePoints: nativeTitrationCurvePoints(current.state),
      chartMaxVolumeML: Math.max(
        burette.capacityML,
        Math.ceil(burette.deliveredML / burette.capacityML) * burette.capacityML
      ),
      facts: nativeTitrationBenchFacts(workflow, current.state),
      events: current.state.eventEnvelopes.map(({ payload }) => payload)
    };
  }, [current.state, sceneConfiguration, workflow]);

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
              <span
                className={sessionBarStyles.stage}
                role="status"
                aria-live="polite"
              >
                {statusLabel}
              </span>
            </div>
          </div>
        </div>
        <div className={sessionBarStyles.session}>
          <span
            className={sessionBarStyles.saveStatus}
            role="status"
            aria-live="polite"
          >
            {saveStatus === "pending"
              ? "Saving progress…"
              : saveStatus === "saved"
                ? "Progress saved"
                : saveStatus === "error"
                  ? `Save failed${saveError ? `: ${saveError}` : ""}`
                  : mode === "preview"
                    ? "Teacher preview"
                    : mode === "assignment"
                      ? "Assigned lab"
                      : "Practice mode — ready"}
          </span>
          <div className={sessionBarStyles.actions}>
            {saveStatus === "error" && onRetrySave && (
              <button type="button" onClick={onRetrySave}>
                Retry save
              </button>
            )}
            {reportHref && (
              <Link href={reportHref}>
                Open report <span aria-hidden="true">→</span>
              </Link>
            )}
            {procedureSteps.length > 0 && (
              <button
                type="button"
                aria-pressed={guideOpen}
                onClick={() => setGuideOpen(!guideOpen)}
              >
                Procedure
              </button>
            )}
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
          precisionControlsOpen={controlsOpen}
          onPrecisionControlsChange={setControlsOpen}
          coachMessages={coachMessages}
          coachStatus={coachStatus}
          coachError={coachError}
          coachSessionId={port.sessionId}
          askCoach={askCoach}
          titrationBenchStatus={
            titrationAccessories?.facts
              ? {
                  buretteFillFraction:
                    titrationAccessories.facts.buretteFillFraction,
                  buretteConditioned:
                    titrationAccessories.facts.buretteConditioned,
                  indicatorAdded: titrationAccessories.facts.indicatorAdded,
                  procedureStage: titrationAccessories.facts.stage
                }
              : null
          }
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
          onDispatch={requestDispatch}
          dispatchDispenseCommit={dispatchDispenseCommit}
          onIndicatorShelfSelect={handleIndicatorShelfSelect}
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

        {guideOpen && procedureSteps.length > 0 && (
          <div className={styles.guideDrawer} role="presentation">
            <div className={styles.drawerHeader}>
              <div>
                <p>Read-only reference</p>
                <h2>Procedure</h2>
              </div>
              <button
                type="button"
                aria-label="Close procedure guide"
                onClick={() => setGuideOpen(false)}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className={styles.guideBody}>
              <ProcedureGuide steps={procedureSteps} showHeader={false} />
            </div>
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
                              value={parameterValue(
                                action,
                                bounds.parameterKey
                              )}
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
                    {registeredEnumParameters(action.actionId).map(
                      (parameter) => (
                        <label key={parameter.key}>
                          {PARAMETER_LABELS[parameter.key] ?? "Choice"}
                          <span>
                            <select
                              value={parameterValue(action, parameter.key)}
                              onChange={(event) => {
                                const nextValue = event.currentTarget.value;
                                setValues((currentValues) => ({
                                  ...currentValues,
                                  [`${action.permissionId}:${parameter.key}`]:
                                    nextValue
                                }));
                              }}
                            >
                              {parameter.allowedValues.map((value) => (
                                <option key={value} value={value}>
                                  {enumValueLabel(value)}
                                </option>
                              ))}
                            </select>
                          </span>
                        </label>
                      )
                    )}
                    <button
                      type="button"
                      onClick={() => requestDispatch(action)}
                    >
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

      {titrationAccessories && (
        <div className={styles.accessoryTray}>
          {titrationAccessories.facts && (
            <details className={styles.accessoryCard}>
              <summary>
                <span aria-hidden="true">▤</span>
                <span>
                  <strong>Lab notebook</strong>
                  <small>Observations and recorded readings</small>
                </span>
              </summary>
              <div className={styles.accessoryContent}>
                <aside aria-labelledby="notebook-heading">
                  <LabNotebook
                    facts={titrationAccessories.facts}
                    events={titrationAccessories.events}
                  />
                </aside>
              </div>
            </details>
          )}
          <details className={styles.accessoryCard}>
            <summary>
              <span aria-hidden="true">⌁</span>
              <span>
                <strong>Live pH graph</strong>
                <small>Open the measurement curve</small>
              </span>
            </summary>
            <div className={styles.accessoryContent}>
              <PHCurve
                points={titrationAccessories.curvePoints}
                maxVolumeML={titrationAccessories.chartMaxVolumeML}
              />
            </div>
          </details>
        </div>
      )}

      {pendingIndicator && (
        <IndicatorSelectionDialog
          indicator={pendingIndicator.indicator}
          onCancel={() => setPendingIndicator(null)}
          onConfirm={() => {
            const confirmed = pendingIndicator;
            setPendingIndicator(null);
            dispatch(confirmed.action, { indicator: confirmed.indicator });
          }}
        />
      )}
    </div>
  );
}
