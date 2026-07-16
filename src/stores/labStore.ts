import { create } from "zustand";

import {
  type ExperimentId,
  loadExperimentDefinition,
  type RegisteredExperimentDefinition
} from "../experiments/registry";
import {
  applyEvidence,
  newStudentModel,
  type SemanticEvent,
  type StudentModel
} from "../experiments/shared";

export type LabExperimentConfig = Parameters<
  RegisteredExperimentDefinition["createInitialState"]
>[0];
export type LabExperimentState = ReturnType<
  RegisteredExperimentDefinition["createInitialState"]
>;
export type LabExperimentAction = Parameters<
  RegisteredExperimentDefinition["step"]
>[1];

export type LabStoreStatus = "idle" | "loading" | "ready" | "error";

export interface LoadExperimentRequest {
  experimentId: ExperimentId;
  sessionId: string;
  config: LabExperimentConfig;
  seed?: Partial<LabExperimentState>;
}

export interface LabStore {
  status: LabStoreStatus;
  experimentId: ExperimentId | null;
  sessionId: string | null;
  definition: RegisteredExperimentDefinition | null;
  state: LabExperimentState | null;
  studentModel: StudentModel | null;
  eventQueue: SemanticEvent[];
  error: string | null;
  loadExperiment: (request: LoadExperimentRequest) => Promise<void>;
  dispatch: (action: LabExperimentAction) => void;
}

export class LabStoreNotReadyError extends Error {
  constructor() {
    super("Cannot dispatch an experiment action before the lab is ready.");
    this.name = "LabStoreNotReadyError";
  }
}

export function createLabStore() {
  return create<LabStore>((set, get) => ({
    status: "idle",
    experimentId: null,
    sessionId: null,
    definition: null,
    state: null,
    studentModel: null,
    eventQueue: [],
    error: null,

    async loadExperiment(request) {
      set({
        status: "loading",
        experimentId: request.experimentId,
        sessionId: request.sessionId,
        definition: null,
        state: null,
        studentModel: null,
        eventQueue: [],
        error: null
      });

      try {
        const definition = await loadExperimentDefinition(request.experimentId);
        const state = definition.createInitialState(
          request.config,
          request.seed
        );
        const studentModel = newStudentModel(request.sessionId, definition);

        set({
          status: "ready",
          definition,
          state,
          studentModel
        });
      } catch (error) {
        set({
          status: "error",
          definition: null,
          state: null,
          studentModel: null,
          error: getErrorMessage(error)
        });
        throw error;
      }
    },

    dispatch(action) {
      const current = get();

      if (
        current.status !== "ready" ||
        !current.definition ||
        !current.state ||
        !current.studentModel
      ) {
        throw new LabStoreNotReadyError();
      }

      const result = current.definition.step(current.state, action);
      const studentModel = result.events.reduce(
        (model, event) => applyEvidence(model, event),
        current.studentModel
      );

      set({
        state: result.state,
        studentModel,
        eventQueue: [...current.eventQueue, ...result.events]
      });
    }
  }));
}

export const useLabStore = createLabStore();

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to load experiment.";
}
