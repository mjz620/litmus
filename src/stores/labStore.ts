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
import type { CoachRequest, CoachResponse } from "../lib/agent/schemas";
import { decideCoachTrigger } from "../lib/agent/triggerPolicy";
import type { LabWorkflowConsumerContext } from "../lab-workflows/consumers";
import type { GenericLabActionTrace } from "../lab-workflows/replay";
import type { ValidatedLabWorkflowSpecV2 } from "../lab-workflows/schema/v2";
import {
  createSetupDrivenTitrationSession,
  normalizeSetupDrivenTitrationAction,
  type LabSessionRuntimeMode,
  type SetupDrivenLabProjection,
  type SetupDrivenLabSelection,
  type SetupDrivenRuntimeInspection,
  type SetupDrivenTitrationSession
} from "./setupDrivenLabSession";

export type LabExperimentConfig = TitrationConfig | PrecipitationConfig;
export type LabExperimentState = TitrationState | PrecipitationState;
export type LabExperimentAction = TitrationAction | PrecipitationAction;

export type LabStoreStatus = "idle" | "loading" | "ready" | "error";
export type CoachStatus = "idle" | "loading" | "error";

export interface CoachMessage {
  id: string;
  role: "student" | "coach";
  text: string;
  response?: CoachResponse;
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
  lastCoachRequest: CoachRequest | null;
  lastCheckpoint: CheckpointRequest | null;
  error: string | null;
  loadExperiment: (request: LoadExperimentRequest) => Promise<void>;
  dispatch: (action: LabExperimentAction) => void;
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
    error: null,

    async loadExperiment(request) {
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

      const setupTransition = setupDrivenTitrationSession
        ? dispatchSetupDrivenTitration(
            current.experimentId,
            action,
            setupDrivenTitrationSession
          )
        : null;
      const result =
        setupTransition ??
        stepRegisteredExperiment(
          current.experimentId,
          current.definition,
          current.state,
          action
        );
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
          current.runtimeActionTrace
      });

      queueCheckpoint(resultEvents, result.state, studentModel);

      const decision = decideCoachTrigger({
        recentEvents: [...current.eventQueue, ...resultEvents].slice(-12)
      });
      if (decision.shouldTrigger) {
        void requestCoach(undefined, decision.source, decision.maxHintLevel);
      }
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
      await requestCoach(normalized, "question", 3);
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
    maxHintLevel: 0 | 1 | 2 | 3
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
      const coachRequest: CoachRequest = {
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
    } catch (error) {
      store.setState({
        coachStatus: "error",
        coachError: getErrorMessage(error)
      });
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
