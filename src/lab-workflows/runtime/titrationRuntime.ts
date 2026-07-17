import type { SemanticEvent } from "../../experiments/shared";
import type { TitrationState } from "../../experiments/titration/titration";
import {
  adaptTitrationAction,
  assertTitrationActionAdapter,
  assertTitrationComponentAdapter,
  isTitrationEndpointObserved,
  loadTitrationEngineAdapter,
  projectTitrationComponents
} from "../adapters/titration";
import { actionRegistry } from "../registries/actions";
import { configurationRegistry } from "../registries/configurations";
import {
  eventFlagRegistry,
  eventTypeRegistry
} from "../registries/event-flags";
import {
  validatedLabWorkflowSpecSchema,
  type AllowedActionSpec,
  type ExpectedObservation,
  type LabWorkflowStep,
  type ValidatedLabWorkflowSpec
} from "../schema";
import { evaluateLabWorkflowEligibility } from "../validation";
import {
  LAB_WORKFLOW_RUNTIME_ERROR_CODES as ERROR,
  LabWorkflowRuntimeError
} from "./errors";
import type {
  LabWorkflowRuntimeCommand,
  RuntimeAllowedAction,
  TitrationEngineAdapter,
  TitrationWorkflowRuntime,
  TitrationWorkflowRuntimeOptions,
  TitrationWorkflowRuntimeSnapshot,
  TitrationWorkflowTransition
} from "./types";

interface CompiledAllowedAction {
  readonly spec: Readonly<AllowedActionSpec>;
  readonly attemptKey: string;
}

interface CompiledObservation {
  readonly spec: Readonly<ExpectedObservation>;
  readonly semanticEventType: string;
  readonly semanticFlag: string | null;
  readonly observationKey: string | null;
}

interface CompiledStep {
  readonly spec: Readonly<LabWorkflowStep>;
  readonly actions: readonly CompiledAllowedAction[];
  readonly observations: readonly CompiledObservation[];
  readonly completionPolicyId:
    | "completion.all_required_observations.v1"
    | "completion.engine_endpoint_observed.v1";
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function adapterNotFound(kind: string, id: string): never {
  throw new LabWorkflowRuntimeError(
    ERROR.adapterNotFound,
    `No exact ${kind} runtime adapter is registered for ${id}.`,
    { adapterKind: kind, registryId: id }
  );
}

function contractMismatch(kind: string, id: string): never {
  throw new LabWorkflowRuntimeError(
    ERROR.adapterContractMismatch,
    `The ${kind} registry contract cannot be assembled for ${id}.`,
    { adapterKind: kind, registryId: id }
  );
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function compileObservation(
  observation: Readonly<ExpectedObservation>
): CompiledObservation {
  if (!eventTypeRegistry.has(observation.eventTypeId)) {
    adapterNotFound("event", observation.eventTypeId);
  }
  const event = eventTypeRegistry.get(observation.eventTypeId);

  let semanticFlag: string | null = null;
  if (observation.flagId) {
    if (!eventFlagRegistry.has(observation.flagId)) {
      adapterNotFound("event flag", observation.flagId);
    }
    semanticFlag = eventFlagRegistry.get(observation.flagId).semanticFlag;
  }

  let observationKey: string | null = null;
  if (observation.observationKeyId) {
    if (!configurationRegistry.has(observation.observationKeyId)) {
      adapterNotFound("observation", observation.observationKeyId);
    }
    const entry = configurationRegistry.get(observation.observationKeyId);
    if (entry.category !== "observation_key" || !entry.adapterKey) {
      contractMismatch("observation", observation.observationKeyId);
    }
    observationKey = entry.adapterKey;
  }

  return Object.freeze({
    spec: observation,
    semanticEventType: event.semanticEventType,
    semanticFlag,
    observationKey
  });
}

function compileStep(step: Readonly<LabWorkflowStep>): CompiledStep {
  const actions = step.allowedActions.map((allowedAction, index) => {
    assertTitrationActionAdapter(allowedAction.actionId);
    const entry = actionRegistry.get(allowedAction.actionId);
    if (!entry.compatibleEngineIds.includes("engine.titration.v1")) {
      contractMismatch("action", allowedAction.actionId);
    }
    return Object.freeze({
      spec: allowedAction,
      attemptKey: `${step.id}::${allowedAction.actionId}::${index}`
    });
  });

  const completionPolicyId = step.completionPolicyId;
  if (
    completionPolicyId !== "completion.all_required_observations.v1" &&
    completionPolicyId !== "completion.engine_endpoint_observed.v1"
  ) {
    adapterNotFound("completion policy", completionPolicyId);
  }
  if (!configurationRegistry.has(completionPolicyId)) {
    adapterNotFound("completion policy", completionPolicyId);
  }
  const completionEntry = configurationRegistry.get(completionPolicyId);
  if (completionEntry.category !== "completion_policy") {
    contractMismatch("completion policy", completionPolicyId);
  }

  return Object.freeze({
    spec: step,
    actions: Object.freeze(actions),
    observations: Object.freeze(
      step.expectedObservations.map(compileObservation)
    ),
    completionPolicyId
  });
}

function compileSteps(
  workflow: Readonly<ValidatedLabWorkflowSpec>
): readonly CompiledStep[] {
  for (const component of workflow.components) {
    assertTitrationComponentAdapter(component.componentId);
  }
  return Object.freeze(
    [...workflow.steps]
      .sort((left, right) => left.order - right.order)
      .map(compileStep)
  );
}

function observationMatches(
  compiled: CompiledObservation,
  event: Readonly<SemanticEvent>
): boolean {
  if (event.type !== compiled.semanticEventType) return false;

  switch (compiled.spec.expectation) {
    case "event_present":
      return true;
    case "flag_present":
      return (
        compiled.semanticFlag !== null &&
        event.flags.includes(compiled.semanticFlag)
      );
    case "flag_absent":
      return (
        compiled.semanticFlag !== null &&
        !event.flags.includes(compiled.semanticFlag)
      );
    case "value_recorded":
      return (
        compiled.observationKey !== null &&
        Object.prototype.hasOwnProperty.call(
          event.observation,
          compiled.observationKey
        )
      );
  }
}

function requiredObservationsSatisfied(
  step: CompiledStep,
  satisfiedObservationIds: ReadonlySet<string>
): boolean {
  return step.observations.every(
    ({ spec }) =>
      !spec.requiredForCompletion || satisfiedObservationIds.has(spec.id)
  );
}

function stepCompleted(
  step: CompiledStep,
  satisfiedObservationIds: ReadonlySet<string>,
  state: Readonly<TitrationState>,
  emittedEvents: readonly SemanticEvent[]
): boolean {
  if (!requiredObservationsSatisfied(step, satisfiedObservationIds)) {
    return false;
  }
  if (step.completionPolicyId === "completion.all_required_observations.v1") {
    return true;
  }
  return emittedEvents.some((event) =>
    isTitrationEndpointObserved(state, event)
  );
}

function matchingAction(
  step: CompiledStep,
  command: LabWorkflowRuntimeCommand
): CompiledAllowedAction | null {
  return (
    step.actions.find(
      ({ spec }) =>
        spec.actionId === command.actionId &&
        spec.actorComponentInstanceId === command.actorComponentInstanceId &&
        sameIds(
          spec.targetComponentInstanceIds,
          command.targetComponentInstanceIds
        )
    ) ?? null
  );
}

function createRuntime(
  workflow: Readonly<ValidatedLabWorkflowSpec>,
  adapter: TitrationEngineAdapter,
  steps: readonly CompiledStep[]
): TitrationWorkflowRuntime {
  let engineState = deepFreeze(
    adapter.definition.createInitialState(adapter.config, adapter.seed)
  );
  let currentStepIndex = 0;
  const completedStepIds: string[] = [];
  const satisfiedObservationIds = new Set<string>();
  const actionAttempts = new Map<string, number>();
  const semanticEvents: SemanticEvent[] = [];

  function currentStep(): CompiledStep | null {
    return steps[currentStepIndex] ?? null;
  }

  function allowedActionView(
    step: CompiledStep
  ): readonly RuntimeAllowedAction[] {
    return step.actions.map(({ spec, attemptKey }) =>
      Object.freeze({
        actionId: spec.actionId,
        actorComponentInstanceId: spec.actorComponentInstanceId,
        targetComponentInstanceIds: Object.freeze([
          ...spec.targetComponentInstanceIds
        ]),
        maxAttempts: spec.maxAttempts ?? null,
        attemptsUsed: actionAttempts.get(attemptKey) ?? 0
      })
    );
  }

  function snapshot(): Readonly<TitrationWorkflowRuntimeSnapshot> {
    const step = currentStep();
    return deepFreeze({
      workflowId: workflow.id,
      workflowRevision: workflow.revision,
      workflowHash: workflow.validation.canonicalSpecHash,
      engineId: adapter.engineId,
      experimentDefinitionId: adapter.experimentDefinitionId,
      status: step ? ("active" as const) : ("completed" as const),
      currentStep: step?.spec ?? null,
      completedStepIds: [...completedStepIds],
      satisfiedObservationIds: [...satisfiedObservationIds].sort(),
      allowedActions: step ? allowedActionView(step) : [],
      componentViews: projectTitrationComponents(
        workflow,
        engineState,
        semanticEvents
      ),
      engineState,
      semanticEvents: [...semanticEvents]
    });
  }

  function dispatch(
    command: LabWorkflowRuntimeCommand
  ): TitrationWorkflowTransition {
    const step = currentStep();
    if (!step) {
      throw new LabWorkflowRuntimeError(
        ERROR.workflowComplete,
        `Workflow ${workflow.id} is already complete.`,
        { workflowId: workflow.id }
      );
    }
    if (command.stepId !== step.spec.id) {
      throw new LabWorkflowRuntimeError(
        ERROR.stepMismatch,
        `Action targets step ${command.stepId}; active step is ${step.spec.id}.`,
        { activeStepId: step.spec.id, requestedStepId: command.stepId }
      );
    }

    const allowed = matchingAction(step, command);
    if (!allowed) {
      throw new LabWorkflowRuntimeError(
        ERROR.actionNotAllowed,
        `Action ${command.actionId} is not allowed for active step ${step.spec.id}.`,
        { actionId: command.actionId, stepId: step.spec.id }
      );
    }

    const attemptsUsed = actionAttempts.get(allowed.attemptKey) ?? 0;
    if (
      allowed.spec.maxAttempts !== undefined &&
      attemptsUsed >= allowed.spec.maxAttempts
    ) {
      throw new LabWorkflowRuntimeError(
        ERROR.actionAttemptLimitExceeded,
        `Action ${command.actionId} exceeded its attempt limit for ${step.spec.id}.`,
        {
          actionId: command.actionId,
          stepId: step.spec.id,
          maxAttempts: allowed.spec.maxAttempts
        }
      );
    }

    const engineAction = adaptTitrationAction(allowed.spec, command.parameters);
    let result;
    try {
      result = adapter.definition.step(engineState, engineAction);
    } catch (error) {
      throw new LabWorkflowRuntimeError(
        ERROR.engineActionRejected,
        error instanceof Error
          ? error.message
          : `Engine rejected ${command.actionId}.`,
        { actionId: command.actionId, stepId: step.spec.id }
      );
    }

    actionAttempts.set(allowed.attemptKey, attemptsUsed + 1);
    engineState = deepFreeze(result.state);
    const forwardedEvents = deepFreeze([...result.events]);
    semanticEvents.push(...forwardedEvents);

    for (const event of forwardedEvents) {
      for (const observation of step.observations) {
        if (observationMatches(observation, event)) {
          satisfiedObservationIds.add(observation.spec.id);
        }
      }
    }

    if (
      stepCompleted(step, satisfiedObservationIds, engineState, forwardedEvents)
    ) {
      completedStepIds.push(step.spec.id);
      currentStepIndex += 1;
      satisfiedObservationIds.clear();
    }

    return Object.freeze({
      events: forwardedEvents,
      snapshot: snapshot()
    });
  }

  return Object.freeze({
    workflow,
    getSnapshot: snapshot,
    dispatch
  });
}

/**
 * Assemble the bounded titration MVP from a current validator-approved artifact.
 * No spec value becomes executable code and no network service is consulted.
 */
export async function assembleTitrationWorkflow(
  input: unknown,
  options: TitrationWorkflowRuntimeOptions
): Promise<TitrationWorkflowRuntime> {
  const sessionSeed = options?.sessionSeed;
  if (
    typeof sessionSeed !== "string" ||
    sessionSeed.trim().length === 0 ||
    sessionSeed.length > 240
  ) {
    throw new LabWorkflowRuntimeError(
      ERROR.invalidOptions,
      "A non-blank sessionSeed of at most 240 characters is required."
    );
  }

  const eligibility = evaluateLabWorkflowEligibility(input, "preview");
  if (!eligibility.eligible) {
    throw new LabWorkflowRuntimeError(
      ERROR.workflowIneligible,
      "Workflow is not eligible for deterministic runtime assembly.",
      { failureCodes: eligibility.failureCodes }
    );
  }

  const parsed = validatedLabWorkflowSpecSchema.safeParse(input);
  if (!parsed.success) {
    throw new LabWorkflowRuntimeError(
      ERROR.workflowIneligible,
      "Workflow does not contain a validated runtime artifact."
    );
  }
  const workflow = deepFreeze(parsed.data);
  const steps = compileSteps(workflow);
  const adapter = await loadTitrationEngineAdapter(
    workflow.engineId,
    workflow.engineConfigId,
    workflow.initializationPresetId,
    sessionSeed
  );

  return createRuntime(workflow, adapter, steps);
}
