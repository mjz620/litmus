import { create } from "zustand";

import {
  type ExperimentId,
  getExperimentManifest,
  loadExperimentDefinition,
  type RegisteredExperimentDefinition
} from "../experiments/registry";
import {
  applyEvidence,
  newStudentModel,
  type SemanticEvent,
  type StudentModel
} from "../experiments/shared";
import type {
  PrecipitationAction,
  PrecipitationConfig,
  PrecipitationState,
  precipitation as precipitationDefinition
} from "../experiments/precipitation/precipitation";
import type {
  TitrationAction,
  TitrationConfig,
  TitrationState,
  titration as titrationDefinition
} from "../experiments/titration/titration";
import {
  CHECKPOINT_SCHEMA_VERSION,
  CheckpointQueue,
  NoopCheckpointTransport,
  type SaveStatus,
  type CheckpointRequest
} from "../lib/persistence";
import { HttpCheckpointTransport } from "../lib/persistence/httpCheckpointTransport";
import {
  HttpCoachClient,
  NoopCoachClient,
  type CoachClient
} from "../lib/agent/client";
import { createAuthoredCoachWorkflowContext } from "../lib/agent/authoredCoach";
import { AUTHORED_COACH_CONTRACT_VERSION } from "../lib/agent/authoredCoachSchemas";
import type {
  AnyCoachRequest,
  AnyCoachResponse,
  CoachResponse
} from "../lib/agent/schemas";
import { decideCoachTrigger } from "../lib/agent/triggerPolicy";
import type { LabWorkflowConsumerContext } from "../lab-workflows/consumers";
import type { GenericLabActionTrace } from "../lab-workflows/replay";
import {
  GenericLabRuntimeError,
  type GenericLabRuntimeErrorDetail
} from "../lab-workflows/runtime";
import type { ValidatedLabWorkflowSpecV2 } from "../lab-workflows/schema/v2";
import {
  createSetupDrivenTitrationSession,
  normalizeSetupDrivenTitrationAction,
  type LabSessionRuntimeMode,
  type SetupDrivenLabProjection,
  type SetupDrivenLabSelection,
  type SetupDrivenRuntimeInspection,
  SetupDrivenSessionError,
  type SetupDrivenTitrationSession
} from "./setupDrivenLabSession";

export type LabExperimentConfig = TitrationConfig | PrecipitationConfig;
export type LabExperimentState = TitrationState | PrecipitationState;
export type LabExperimentAction = TitrationAction | PrecipitationAction;

export type LabStoreStatus = "idle" | "loading" | "ready" | "error";
export type CoachStatus = "idle" | "loading" | "error";

export interface LabActionErrorState {
  readonly code: string;
  readonly actionType: LabExperimentAction["type"];
  readonly message: string;
  readonly technicalMessage: string;
  readonly details: Readonly<Record<string, GenericLabRuntimeErrorDetail>>;
}

export interface CoachMessage {
  id: string;
  role: "student" | "coach";
  text: string;
  response?: AnyCoachResponse;
}

interface LoadExperimentRequestBase {
  sessionId: string;
  mode?: "practice" | "assignment" | "demo" | "preview";
  parentSessionId?: string;
  workflowVersionId?: string;
  runtimeMode?: LabSessionRuntimeMode;
}

export type LoadExperimentRequest =
  | (LoadExperimentRequestBase & {
      experimentId: "acid_base_titration";
      config: TitrationConfig;
      seed?: Partial<TitrationState>;
      setupDrivenSelection?: SetupDrivenLabSelection;
      setupDrivenWorkflow?: Readonly<ValidatedLabWorkflowSpecV2>;
    })
  | (LoadExperimentRequestBase & {
      experimentId: "precipitation_solubility";
      config: PrecipitationConfig;
      seed?: Partial<PrecipitationState>;
    });

export interface LabStore {
  status: LabStoreStatus;
  experimentId: ExperimentId | null;
  sessionId: string | null;
  mode: "practice" | "assignment" | "demo" | "preview";
  parentSessionId: string | null;
  workflowVersionId: string | null;
  runtimeMode: LabSessionRuntimeMode;
  runtimeInspection: SetupDrivenRuntimeInspection | null;
  runtimeProjection: SetupDrivenLabProjection | null;
  runtimeConsumerContext: LabWorkflowConsumerContext | null;
  runtimeActionTrace: GenericLabActionTrace | null;
  definition: RegisteredExperimentDefinition | null;
  state: LabExperimentState | null;
  studentModel: StudentModel | null;
  eventQueue: SemanticEvent[];
  saveStatus: SaveStatus;
  saveError: string | null;
  coachMessages: CoachMessage[];
  coachStatus: CoachStatus;
  coachError: string | null;
  lastCoachRequest: AnyCoachRequest | null;
  lastCheckpoint: CheckpointRequest | null;
  actionError: LabActionErrorState | null;
  error: string | null;
  loadExperiment: (request: LoadExperimentRequest) => Promise<void>;
  dispatch: (action: LabExperimentAction) => boolean;
  clearActionError: () => void;
  checkpoint: (completed?: boolean) => void;
  retryCheckpoint: () => void;
  askCoach: (question: string) => Promise<void>;
}

export interface CreateLabStoreOptions {
  checkpointQueue?: CheckpointQueue;
  mode?: "practice" | "assignment" | "demo" | "preview";
  parentSessionId?: string;
  workflowVersionId?: string;
  coachClient?: CoachClient;
}

export class LabStoreNotReadyError extends Error {
  constructor() {
    super("Cannot dispatch an experiment action before the lab is ready.");
    this.name = "LabStoreNotReadyError";
  }
}

export function createLabStore(options: CreateLabStoreOptions = {}) {
  const checkpointQueue =
    options.checkpointQueue ??
    new CheckpointQueue(new NoopCheckpointTransport());
  const coachClient = options.coachClient ?? new NoopCoachClient();
  let nextEventSequence = 0;
  let nextCoachMessageSequence = 0;
  let setupDrivenTitrationSession: SetupDrivenTitrationSession | null = null;
  // Reasons that have already auto-triggered the coach and are still active in
  // the recent-event window. Prevents repeated GPT calls for the same ongoing
  // mistake; a reason that clears from the window and later recurs triggers
  // again. Explicit questions and retries are never deduped here.
  let servedCoachEventReasons = new Set<string>();

  const store = create<LabStore>((set, get) => ({
    status: "idle",
    experimentId: null,
    sessionId: null,
    mode: options.mode ?? "practice",
    parentSessionId: options.parentSessionId ?? null,
    workflowVersionId: options.workflowVersionId ?? null,
    runtimeMode: "legacy",
    runtimeInspection: null,
    runtimeProjection: null,
    runtimeConsumerContext: null,
    runtimeActionTrace: null,
    definition: null,
    state: null,
    studentModel: null,
    eventQueue: [],
    saveStatus: "idle",
    saveError: null,
    coachMessages: [],
    coachStatus: "idle",
    coachError: null,
    lastCoachRequest: null,
    lastCheckpoint: null,
    actionError: null,
    error: null,

    async loadExperiment(request) {
      servedCoachEventReasons = new Set<string>();
      set({
        status: "loading",
        experimentId: request.experimentId,
        sessionId: request.sessionId,
        mode: request.mode ?? options.mode ?? "practice",
        parentSessionId:
          request.parentSessionId ?? options.parentSessionId ?? null,
        workflowVersionId:
          request.workflowVersionId ?? options.workflowVersionId ?? null,
        runtimeMode: request.runtimeMode ?? "legacy",
        runtimeInspection: null,
        runtimeProjection: null,
        runtimeConsumerContext: null,
        runtimeActionTrace: null,
        definition: null,
        state: null,
        studentModel: null,
        eventQueue: [],
        saveStatus: "idle",
        saveError: null,
        coachMessages: [],
        coachStatus: "idle",
        coachError: null,
        lastCoachRequest: null,
        lastCheckpoint: null,
        actionError: null,
        error: null
      });

      try {
        nextEventSequence = 0;
        setupDrivenTitrationSession = null;
        const { definition, state, setupDrivenSession } =
          await initializeRegisteredExperiment(request);
        setupDrivenTitrationSession = setupDrivenSession;
        const studentModel = newStudentModel(request.sessionId, definition);

        set({
          status: "ready",
          definition,
          state,
          studentModel,
          runtimeMode: setupDrivenSession?.mode ?? "legacy",
          runtimeInspection: setupDrivenSession?.getInspection() ?? null,
          runtimeProjection: setupDrivenSession?.getProjection() ?? null,
          runtimeConsumerContext:
            setupDrivenSession?.getConsumerContext() ?? null,
          runtimeActionTrace: setupDrivenSession?.getActionTrace() ?? null
        });
        queueCheckpoint([], state, studentModel);
      } catch (error) {
        set({
          status: "error",
          definition: null,
          state: null,
          studentModel: null,
          runtimeInspection: null,
          runtimeProjection: null,
          runtimeConsumerContext: null,
          runtimeActionTrace: null,
          error: getErrorMessage(error)
        });
        throw error;
      }
    },

    dispatch(action) {
      const current = get();

      if (
        current.status !== "ready" ||
        !current.experimentId ||
        !current.definition ||
        !current.state ||
        !current.studentModel
      ) {
        throw new LabStoreNotReadyError();
      }

      let setupTransition;
      let result;
      try {
        setupTransition = setupDrivenTitrationSession
          ? dispatchSetupDrivenTitration(
              current.experimentId,
              action,
              setupDrivenTitrationSession
            )
          : null;
        result =
          setupTransition ??
          stepRegisteredExperiment(
            current.experimentId,
            current.definition,
            current.state,
            action
          );
      } catch (error) {
        if (setupDrivenTitrationSession && isContainedSetupActionError(error)) {
          set({ actionError: toLabActionErrorState(action, error) });
          return false;
        }
        throw error;
      }
      const resultEvents: readonly SemanticEvent[] = result.events;
      const studentModel = resultEvents.reduce(
        (model, event) => applyEvidence(model, event),
        current.studentModel
      );

      set({
        state: result.state,
        studentModel,
        eventQueue: [...current.eventQueue, ...resultEvents],
        runtimeInspection:
          setupTransition?.inspection ?? current.runtimeInspection,
        runtimeProjection:
          setupTransition?.projection ?? current.runtimeProjection,
        runtimeConsumerContext:
          setupDrivenTitrationSession?.getConsumerContext() ??
          current.runtimeConsumerContext,
        runtimeActionTrace:
          setupDrivenTitrationSession?.getActionTrace() ??
          current.runtimeActionTrace,
        actionError: null
      });

      queueCheckpoint(resultEvents, result.state, studentModel);

      const decision = decideCoachTrigger({
        recentEvents: [...current.eventQueue, ...resultEvents].slice(-12),
        diagnoses:
          setupDrivenTitrationSession?.getGenericState().diagnoses ?? []
      });
      // Deduplicate automatic (event-driven) coaching: only call the coach when
      // an error reason appears that has not already been served while it is
      // still active. Drop served reasons that are no longer active so a genuine
      // recurrence coaches again.
      const activeReasons = new Set(decision.reasons);
      for (const reason of [...servedCoachEventReasons]) {
        if (!activeReasons.has(reason)) servedCoachEventReasons.delete(reason);
      }
      const freshReasons = decision.reasons.filter(
        (reason) => !servedCoachEventReasons.has(reason)
      );
      if (decision.shouldTrigger && freshReasons.length > 0) {
        freshReasons.forEach((reason) => servedCoachEventReasons.add(reason));
        void requestCoach(
          undefined,
          decision.source,
          decision.maxHintLevel,
          freshReasons
        );
      }
      return true;
    },

    clearActionError() {
      set({ actionError: null });
    },

    checkpoint(completed = false) {
      const current = get();
      if (!current.state || !current.studentModel) return;
      queueCheckpoint([], current.state, current.studentModel, completed);
    },

    retryCheckpoint() {
      checkpointQueue.retry();
    },

    async askCoach(question) {
      const normalized = question.trim();
      if (!normalized) return;
      store.setState((current) => ({
        coachMessages: [
          ...current.coachMessages,
          {
            id: `coach-message-${nextCoachMessageSequence++}`,
            role: "student",
            text: normalized
          }
        ]
      }));
      await requestCoach(normalized, "question", 3, ["student_question"]);
    }
  }));

  checkpointQueue.subscribe((snapshot) => {
    store.setState({
      saveStatus: snapshot.status,
      saveError: snapshot.lastError
    });
  });

  function queueCheckpoint(
    events: readonly SemanticEvent[],
    state: LabExperimentState,
    studentModel: StudentModel,
    completed = false
  ): void {
    const current = store.getState();
    if (!current.sessionId || !current.experimentId) return;
    // Teacher preview is explicitly not saved: never persist a checkpoint.
    if (current.mode === "preview") return;

    const manifest = getExperimentManifest(current.experimentId);
    const checkpointEvents = events.map((payload) => {
      const seq = nextEventSequence++;
      return {
        clientEventId: `${current.sessionId}:${seq}`,
        seq,
        payload
      };
    });
    const sessionSeed =
      "sessionSeed" in state && typeof state.sessionSeed === "string"
        ? state.sessionSeed
        : undefined;

    const checkpoint: CheckpointRequest = {
      schemaVersion: CHECKPOINT_SCHEMA_VERSION,
      sessionId: current.sessionId,
      experimentId: current.experimentId,
      experimentVersion: manifest.version,
      mode: current.mode,
      parentSessionId: current.parentSessionId ?? undefined,
      workflowVersionId: current.workflowVersionId ?? undefined,
      sessionSeed,
      events: checkpointEvents.length > 0 ? checkpointEvents : undefined,
      skillEstimates: Object.entries(studentModel.skills).map(
        ([skillId, estimate]) => ({ skillId, ...estimate })
      ),
      finalState: completed ? state : undefined,
      labWorkflowContext: current.runtimeConsumerContext ?? undefined,
      normalizedActionTrace: current.runtimeActionTrace ?? undefined,
      completedAt: completed ? new Date().toISOString() : undefined
    };
    store.setState({ lastCheckpoint: checkpoint });
    checkpointQueue.enqueue(checkpoint);
  }

  async function requestCoach(
    studentQuestion: string | undefined,
    source: "event" | "question" | "retry",
    maxHintLevel: 0 | 1 | 2 | 3,
    reasons: readonly string[]
  ): Promise<void> {
    const current = store.getState();
    if (
      current.status !== "ready" ||
      !current.sessionId ||
      !current.experimentId ||
      !current.state ||
      !current.studentModel
    ) {
      return;
    }

    store.setState({ coachStatus: "loading", coachError: null });
    try {
      const authoredContext = setupDrivenTitrationSession
        ? createAuthoredCoachWorkflowContext(
            setupDrivenTitrationSession.getWorkflow(),
            setupDrivenTitrationSession.getGenericState()
          )
        : null;
      const hasCurrentViolation = authoredContext?.diagnoses.some(
        ({ status }) => status === "violated"
      );
      const hasGroundedAuthoredReason = reasons.some((reason) =>
        authoredContext?.evidence.some(({ payload }) =>
          payload.flags.includes(reason)
        )
      );
      const useAuthoredContext =
        authoredContext !== null &&
        (source === "question" ||
          hasCurrentViolation === true ||
          hasGroundedAuthoredReason);
      const coachRequest: AnyCoachRequest = useAuthoredContext
        ? {
            contractVersion: AUTHORED_COACH_CONTRACT_VERSION,
            sessionId: current.sessionId,
            experimentId: current.experimentId,
            workflowContext: authoredContext,
            studentQuestion,
            triggerPolicy: {
              source,
              reasons: [...new Set(reasons)],
              maxHintLevel
            }
          }
        : {
            sessionId: current.sessionId,
            experimentId: current.experimentId,
            currentState: current.state,
            recentEvents: current.eventQueue.slice(-12),
            studentModel: current.studentModel,
            labWorkflowContext: current.runtimeConsumerContext ?? undefined,
            studentQuestion,
            triggerPolicy: { source, maxHintLevel }
          };
      store.setState({ lastCoachRequest: coachRequest });
      const response = await coachClient.request(coachRequest);

      store.setState((latest) => ({
        coachStatus: "idle",
        coachError: null,
        coachMessages:
          response.shouldRespond && response.message
            ? [
                ...latest.coachMessages,
                {
                  id: `coach-message-${nextCoachMessageSequence++}`,
                  role: "coach" as const,
                  text: response.message,
                  response
                }
              ]
            : latest.coachMessages
      }));
    } catch {
      const fallback = localCoachFallback(studentQuestion);
      store.setState((latest) => ({
        coachStatus: "idle",
        coachError: null,
        coachMessages:
          fallback.shouldRespond && fallback.message
            ? [
                ...latest.coachMessages,
                {
                  id: `coach-message-${nextCoachMessageSequence++}`,
                  role: "coach" as const,
                  text: fallback.message,
                  response: fallback
                }
              ]
            : latest.coachMessages
      }));
    }
  }

  return store;
}

async function initializeRegisteredExperiment(
  request: LoadExperimentRequest
): Promise<{
  definition: RegisteredExperimentDefinition;
  state: LabExperimentState;
  setupDrivenSession: SetupDrivenTitrationSession | null;
}> {
  if (request.experimentId === "acid_base_titration") {
    const definition = await loadExperimentDefinition(request.experimentId);
    if (request.runtimeMode === "setup_driven_v2") {
      if (!request.setupDrivenSelection) {
        throw new TypeError(
          "An exact setup-driven workflow ID and hash are required."
        );
      }
      const setupDrivenSession = createSetupDrivenTitrationSession({
        experimentId: request.experimentId,
        sessionId: request.sessionId,
        sessionSeed: request.seed?.sessionSeed ?? request.sessionId,
        selection: request.setupDrivenSelection,
        workflow: request.setupDrivenWorkflow
      });
      return {
        definition,
        state: setupDrivenSession.getState(),
        setupDrivenSession
      };
    }
    return {
      definition,
      state: definition.createInitialState(request.config, request.seed),
      setupDrivenSession: null
    };
  }

  if (request.runtimeMode === "setup_driven_v2") {
    throw new TypeError(
      "The setup-driven titration definition cannot load this experiment."
    );
  }
  const definition = await loadExperimentDefinition(request.experimentId);
  return {
    definition,
    state: definition.createInitialState(request.config, request.seed),
    setupDrivenSession: null
  };
}

function dispatchSetupDrivenTitration(
  experimentId: ExperimentId,
  action: LabExperimentAction,
  session: SetupDrivenTitrationSession
) {
  if (experimentId !== "acid_base_titration" || !isTitrationAction(action)) {
    throw new TypeError(
      "Action does not match the setup-driven titration definition."
    );
  }
  // Report submission is an existing consumer action, not a registered lab
  // mechanic. Preserve its direct ExperimentDefinition.step() path until a
  // reviewed report action contract exists; never invent a normalized action.
  if (action.type === "submit_report") return null;
  return session.dispatch(normalizeSetupDrivenTitrationAction(action));
}

function stepRegisteredExperiment(
  experimentId: ExperimentId,
  definition: RegisteredExperimentDefinition,
  state: LabExperimentState,
  action: LabExperimentAction
) {
  if (
    experimentId === "acid_base_titration" &&
    isTitrationState(state) &&
    isTitrationAction(action)
  ) {
    return (definition as typeof titrationDefinition).step(state, action);
  }
  if (
    experimentId === "precipitation_solubility" &&
    isPrecipitationState(state) &&
    isPrecipitationAction(action)
  ) {
    return (definition as typeof precipitationDefinition).step(state, action);
  }
  throw new TypeError(
    `Action does not match loaded experiment ${experimentId}.`
  );
}

export function isTitrationState(
  state: LabExperimentState | null
): state is TitrationState {
  return state !== null && "titrantAddedML" in state;
}

export function isPrecipitationState(
  state: LabExperimentState | null
): state is PrecipitationState {
  return state !== null && "solutionA" in state && "solutionB" in state;
}

function isTitrationAction(
  action: LabExperimentAction
): action is TitrationAction {
  return [
    "rinse_burette",
    "fill_burette",
    "select_indicator",
    "add_titrant",
    "read_meniscus",
    "submit_report"
  ].includes(action.type);
}

function isPrecipitationAction(
  action: LabExperimentAction
): action is PrecipitationAction {
  return [
    "select_solution",
    "mix_solutions",
    "submit_precipitate_prediction",
    "submit_net_ionic_equation"
  ].includes(action.type);
}

export const useLabStore = createLabStore({
  checkpointQueue: new CheckpointQueue(new HttpCheckpointTransport()),
  coachClient: new HttpCoachClient()
});

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to load experiment.";
}

export function localCoachFallback(
  studentQuestion: string | undefined
): Readonly<CoachResponse> {
  if (!studentQuestion) {
    return {
      shouldRespond: false,
      interventionType: "none",
      skillIds: [],
      hintLevel: 0,
      message: "",
      evidenceEventTypes: [],
      safety: { refused: false }
    };
  }
  return {
    shouldRespond: true,
    interventionType: "hint",
    skillIds: [],
    hintLevel: 1,
    message:
      "Start with the next available lab step. Identify its equipment, the stated amount or observation, and the change you should see before moving on.",
    evidenceEventTypes: [],
    safety: { refused: false }
  };
}

function isContainedSetupActionError(
  error: unknown
): error is GenericLabRuntimeError | SetupDrivenSessionError {
  return (
    error instanceof GenericLabRuntimeError ||
    error instanceof SetupDrivenSessionError
  );
}

function toLabActionErrorState(
  action: LabExperimentAction,
  error: GenericLabRuntimeError | SetupDrivenSessionError
): LabActionErrorState {
  const details =
    error instanceof GenericLabRuntimeError ? error.details : Object.freeze({});
  return Object.freeze({
    code: error.code,
    actionType: action.type,
    message: actionErrorMessage(error, details),
    technicalMessage: error.message,
    details
  });
}

function actionErrorMessage(
  error: GenericLabRuntimeError | SetupDrivenSessionError,
  details: Readonly<Record<string, GenericLabRuntimeErrorDetail>>
): string {
  switch (error.code) {
    case "generic-runtime.parameter_invalid.v1": {
      const minimum = details.effectiveMinimum;
      const maximum = details.effectiveMaximum;
      const range =
        typeof minimum === "number" && typeof maximum === "number"
          ? ` Use a value from ${minimum} to ${maximum}.`
          : " Check the permitted range and try again.";
      return `That amount is outside this workflow's permitted range.${range}`;
    }
    case "generic-runtime.permission_unavailable.v1":
    case "generic-runtime.attempt_limit_exceeded.v1":
      return "That action is not available at this point in the workflow.";
    case "generic-runtime.workflow_terminal.v1":
      return "This workflow is already complete. No additional material was added.";
    case "generic-runtime.precondition_failed.v1":
    case "generic-runtime.safety_rejected.v1":
      return "The lab could not apply that action in its current state. Review the active equipment and workflow guidance.";
    default:
      return "The action was not applied. The lab remains at its last valid state; review the workflow guidance and try again.";
  }
}
