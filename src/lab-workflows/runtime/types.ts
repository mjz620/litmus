import type { SemanticEvent } from "../../experiments/shared";
import type {
  TitrationAction,
  TitrationState
} from "../../experiments/titration/titration";
import type { ComponentRegistryEntry } from "../registries/components";
import type { LabWorkflowStep, ValidatedLabWorkflowSpec } from "../schema";

export type ComponentRuntimeStateValue =
  | boolean
  | null
  | number
  | string
  | readonly string[];

export interface ComponentRuntimeView {
  readonly instanceId: string;
  readonly componentId: string;
  readonly visualAdapterId: ComponentRegistryEntry["visualAdapterId"];
  readonly state: Readonly<Record<string, ComponentRuntimeStateValue>>;
}

export interface LabWorkflowRuntimeCommand {
  readonly stepId: string;
  readonly actionId: string;
  readonly actorComponentInstanceId: string;
  readonly targetComponentInstanceIds: readonly string[];
  readonly parameters: Readonly<Record<string, unknown>>;
}

export interface RuntimeAllowedAction {
  readonly actionId: string;
  readonly actorComponentInstanceId: string;
  readonly targetComponentInstanceIds: readonly string[];
  readonly maxAttempts: number | null;
  readonly attemptsUsed: number;
}

export interface TitrationWorkflowRuntimeSnapshot {
  readonly workflowId: string;
  readonly workflowRevision: number;
  readonly workflowHash: string;
  readonly engineId: "engine.titration.v1";
  readonly experimentDefinitionId: "acid_base_titration";
  readonly status: "active" | "completed";
  readonly currentStep: Readonly<LabWorkflowStep> | null;
  readonly completedStepIds: readonly string[];
  readonly satisfiedObservationIds: readonly string[];
  readonly allowedActions: readonly RuntimeAllowedAction[];
  readonly componentViews: readonly ComponentRuntimeView[];
  readonly engineState: Readonly<TitrationState>;
  readonly semanticEvents: readonly SemanticEvent[];
}

export interface TitrationWorkflowTransition {
  /** Events are the exact records emitted by ExperimentDefinition.step(). */
  readonly events: readonly SemanticEvent[];
  readonly snapshot: Readonly<TitrationWorkflowRuntimeSnapshot>;
}

export interface TitrationWorkflowRuntime {
  readonly workflow: Readonly<ValidatedLabWorkflowSpec>;
  getSnapshot(): Readonly<TitrationWorkflowRuntimeSnapshot>;
  dispatch(command: LabWorkflowRuntimeCommand): TitrationWorkflowTransition;
}

export interface TitrationWorkflowRuntimeOptions {
  /** Explicit seed keeps assembly deterministic and free from wall-clock/random reads. */
  readonly sessionSeed: string;
}

export interface TitrationEngineAdapter {
  readonly engineId: "engine.titration.v1";
  readonly experimentDefinitionId: "acid_base_titration";
  readonly definition: {
    createInitialState(
      config: import("../../experiments/titration/titration").TitrationConfig,
      seed?: Partial<TitrationState>
    ): TitrationState;
    step(
      state: TitrationState,
      action: TitrationAction
    ): import("../../experiments/shared").StepResult<TitrationState>;
  };
  readonly config: import("../../experiments/titration/titration").TitrationConfig;
  readonly seed: Partial<TitrationState>;
}
