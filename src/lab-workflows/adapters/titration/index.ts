import {
  getExperimentManifest,
  loadExperimentDefinition
} from "../../../experiments/registry";
import type { SemanticEvent } from "../../../experiments/shared";
import { createTitrationRetryScenario } from "../../../experiments/titration/retry";
import {
  EXAMPLE_STRONG,
  INDICATOR_SPECIFICATIONS,
  observedColor,
  type IndicatorId,
  type TitrationAction,
  type TitrationState
} from "../../../experiments/titration/titration";
import { actionRegistry } from "../../registries/actions";
import type { ActionRegistryEntry } from "../../registries/actions";
import { componentRegistry } from "../../registries/components";
import type { ComponentRegistryEntry } from "../../registries/components";
import { configurationRegistry } from "../../registries/configurations";
import { engineRegistry } from "../../registries/engines";
import type { AllowedActionSpec, ValidatedLabWorkflowSpec } from "../../schema";
import {
  LAB_WORKFLOW_RUNTIME_ERROR_CODES as ERROR,
  LabWorkflowRuntimeError
} from "../../runtime/errors";
import type {
  ComponentRuntimeStateValue,
  ComponentRuntimeView,
  TitrationEngineAdapter
} from "../../runtime/types";

const ENGINE_ID = "engine.titration.v1" as const;
const EXPERIMENT_ID = "acid_base_titration" as const;
const ENGINE_VERSION = "1.0.0" as const;
const ENGINE_CONFIG_ID =
  "engine_config.titration.strong_acid_strong_base_25ml.v1" as const;
const ENGINE_CONFIG_ADAPTER_KEY = "EXAMPLE_STRONG" as const;
const SEED_ID = "seed.titration.near_endpoint_22ml.v1" as const;
const SEED_ADAPTER_KEY =
  "createTitrationRetryScenario:endpoint_control" as const;

function adapterNotFound(kind: string, id: string): never {
  throw new LabWorkflowRuntimeError(
    ERROR.adapterNotFound,
    `No exact ${kind} adapter is registered for ${id}.`,
    { adapterKind: kind, registryId: id }
  );
}

function contractMismatch(kind: string, id: string): never {
  throw new LabWorkflowRuntimeError(
    ERROR.adapterContractMismatch,
    `The registered ${kind} contract does not match adapter ${id}.`,
    { adapterKind: kind, registryId: id }
  );
}

function parameterInvalid(actionId: string, message: string): never {
  throw new LabWorkflowRuntimeError(ERROR.actionParameterInvalid, message, {
    actionId
  });
}

function isPlainRecord(
  value: unknown
): value is Readonly<Record<string, unknown>> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateParameters(
  entry: ActionRegistryEntry,
  allowedAction: AllowedActionSpec,
  parameters: unknown
): Readonly<Record<string, unknown>> {
  if (!isPlainRecord(parameters)) {
    parameterInvalid(entry.id, `Parameters for ${entry.id} must be an object.`);
  }

  const definitions = new Map(
    entry.parameters.map((definition) => [definition.key, definition])
  );
  for (const key of Object.keys(parameters)) {
    if (!definitions.has(key)) {
      parameterInvalid(entry.id, `Unknown parameter ${key} for ${entry.id}.`);
    }
  }

  for (const definition of entry.parameters) {
    const value = parameters[definition.key];
    if (value === undefined) {
      if (definition.required) {
        parameterInvalid(
          entry.id,
          `Missing required parameter ${definition.key} for ${entry.id}.`
        );
      }
      continue;
    }

    if (definition.valueType === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        parameterInvalid(
          entry.id,
          `${definition.key} for ${entry.id} must be a finite number.`
        );
      }
      if (definition.minimum !== undefined && value < definition.minimum) {
        parameterInvalid(
          entry.id,
          `${definition.key} for ${entry.id} is below its registered minimum.`
        );
      }
      if (definition.maximum !== undefined && value > definition.maximum) {
        parameterInvalid(
          entry.id,
          `${definition.key} for ${entry.id} exceeds its registered maximum.`
        );
      }
      if (definition.authoredMinimumKey) {
        const authoredMinimum =
          allowedAction.authoredLimits?.[definition.authoredMinimumKey];
        if (authoredMinimum !== undefined && value < authoredMinimum) {
          parameterInvalid(
            entry.id,
            `${definition.key} for ${entry.id} is below the authored minimum.`
          );
        }
      }
      if (definition.authoredMaximumKey) {
        const authoredMaximum =
          allowedAction.authoredLimits?.[definition.authoredMaximumKey];
        if (authoredMaximum !== undefined && value > authoredMaximum) {
          parameterInvalid(
            entry.id,
            `${definition.key} for ${entry.id} exceeds the authored maximum.`
          );
        }
      }
      continue;
    }

    if (typeof value !== "string") {
      parameterInvalid(
        entry.id,
        `${definition.key} for ${entry.id} must be a string.`
      );
    }
    if (
      definition.valueType === "enum" &&
      !definition.allowedValues?.includes(value)
    ) {
      parameterInvalid(
        entry.id,
        `${definition.key} for ${entry.id} is not a registered value.`
      );
    }
  }

  return parameters;
}

function numberParameter(
  actionId: string,
  parameters: Readonly<Record<string, unknown>>,
  key: string
): number {
  const value = parameters[key];
  if (typeof value !== "number") {
    parameterInvalid(actionId, `Missing numeric parameter ${key}.`);
  }
  return value;
}

function stringParameter(
  actionId: string,
  parameters: Readonly<Record<string, unknown>>,
  key: string
): string {
  const value = parameters[key];
  if (typeof value !== "string") {
    parameterInvalid(actionId, `Missing string parameter ${key}.`);
  }
  return value;
}

export function assertTitrationActionAdapter(actionId: string): void {
  if (!actionRegistry.has(actionId)) adapterNotFound("action", actionId);
  const entry = actionRegistry.get(actionId);

  switch (entry.id) {
    case "action.rinse.v1":
      if (entry.engineActionType !== "rinse_burette") {
        contractMismatch("action", actionId);
      }
      return;
    case "action.fill.v1":
      if (entry.engineActionType !== "fill_burette") {
        contractMismatch("action", actionId);
      }
      return;
    case "action.select_indicator.v1":
    case "action.add_indicator.v1":
      if (entry.engineActionType !== "select_indicator") {
        contractMismatch("action", actionId);
      }
      return;
    case "action.dispense.v1":
      if (entry.engineActionType !== "add_titrant") {
        contractMismatch("action", actionId);
      }
      return;
    case "action.read_volume.v1":
      if (entry.engineActionType !== "read_meniscus") {
        contractMismatch("action", actionId);
      }
      return;
  }
  adapterNotFound("action", actionId);
}

export function adaptTitrationAction(
  allowedAction: AllowedActionSpec,
  parameters: unknown
): TitrationAction {
  assertTitrationActionAdapter(allowedAction.actionId);
  const entry = actionRegistry.get(allowedAction.actionId);
  const validated = validateParameters(entry, allowedAction, parameters);

  switch (entry.id) {
    case "action.rinse.v1":
      return {
        type: "rinse_burette",
        solvent: stringParameter(entry.id, validated, "solvent") as
          | "titrant"
          | "water"
      };
    case "action.fill.v1":
      return {
        type: "fill_burette",
        volumeML: numberParameter(entry.id, validated, "volumeML")
      };
    case "action.select_indicator.v1":
    case "action.add_indicator.v1":
      return {
        type: "select_indicator",
        indicator: stringParameter(
          entry.id,
          validated,
          "indicator"
        ) as IndicatorId
      };
    case "action.dispense.v1":
      return {
        type: "add_titrant",
        volumeML: numberParameter(entry.id, validated, "volumeML"),
        durationS: numberParameter(entry.id, validated, "durationS")
      };
    case "action.read_volume.v1":
      return {
        type: "read_meniscus",
        reportedML: numberParameter(entry.id, validated, "reportedML")
      };
  }
  return adapterNotFound("action", allowedAction.actionId);
}

export async function loadTitrationEngineAdapter(
  engineId: string,
  engineConfigId: string,
  seedTemplateId: string,
  sessionSeed: string
): Promise<TitrationEngineAdapter> {
  if (engineId !== ENGINE_ID || !engineRegistry.has(engineId)) {
    adapterNotFound("engine", engineId);
  }
  const engine = engineRegistry.get(engineId);
  if (
    engine.experimentDefinitionId !== EXPERIMENT_ID ||
    engine.experimentDefinitionVersion !== ENGINE_VERSION ||
    engine.availability !== "verified" ||
    !engine.deterministic ||
    !engine.supportsSeededState
  ) {
    contractMismatch("engine", engineId);
  }

  if (engineConfigId !== ENGINE_CONFIG_ID) {
    adapterNotFound("engine configuration", engineConfigId);
  }
  if (!configurationRegistry.has(engineConfigId)) {
    adapterNotFound("engine configuration", engineConfigId);
  }
  const engineConfig = configurationRegistry.get(engineConfigId);
  if (
    engineConfig.category !== "engine_configuration" ||
    engineConfig.adapterKey !== ENGINE_CONFIG_ADAPTER_KEY ||
    engineConfig.availability !== "verified"
  ) {
    contractMismatch("engine configuration", engineConfigId);
  }

  if (seedTemplateId !== SEED_ID) {
    adapterNotFound("seed", seedTemplateId);
  }
  if (!configurationRegistry.has(seedTemplateId)) {
    adapterNotFound("seed", seedTemplateId);
  }
  const seedEntry = configurationRegistry.get(seedTemplateId);
  if (
    seedEntry.category !== "seed_template" ||
    seedEntry.adapterKey !== SEED_ADAPTER_KEY ||
    seedEntry.availability !== "verified"
  ) {
    contractMismatch("seed", seedTemplateId);
  }

  const manifest = getExperimentManifest(EXPERIMENT_ID);
  if (manifest.version !== ENGINE_VERSION) {
    contractMismatch("experiment manifest", EXPERIMENT_ID);
  }
  const definition = await loadExperimentDefinition(EXPERIMENT_ID);
  if (definition.id !== EXPERIMENT_ID) {
    contractMismatch("experiment definition", EXPERIMENT_ID);
  }

  const scenario = createTitrationRetryScenario(
    "endpoint_control",
    sessionSeed
  );
  if (scenario.config !== EXAMPLE_STRONG) {
    contractMismatch("seed", seedTemplateId);
  }

  return Object.freeze({
    engineId: ENGINE_ID,
    experimentDefinitionId: EXPERIMENT_ID,
    definition,
    config: {
      ...EXAMPLE_STRONG,
      analyte: { ...EXAMPLE_STRONG.analyte },
      titrant: { ...EXAMPLE_STRONG.titrant }
    },
    seed: scenario.seed
  });
}

function latestObservedColor(
  state: Readonly<TitrationState>,
  semanticEvents: readonly SemanticEvent[]
): string {
  for (let index = semanticEvents.length - 1; index >= 0; index -= 1) {
    const value = semanticEvents[index]?.observation.observedColor;
    if (typeof value === "string") return value;
  }
  const latestCurvePoint = state.curve.at(-1);
  return latestCurvePoint
    ? observedColor(state.config.indicator, latestCurvePoint.pH)
    : "not yet observed";
}

function projectComponentState(
  entry: ComponentRegistryEntry,
  instanceId: string,
  workflow: Readonly<ValidatedLabWorkflowSpec>,
  state: Readonly<TitrationState>,
  semanticEvents: readonly SemanticEvent[]
): Record<string, ComponentRuntimeStateValue> {
  const componentId = entry.id;
  switch (entry.id) {
    case "component.burette.v1":
      if (entry.visualAdapterId !== "Burette") {
        contractMismatch("component", entry.id);
      }
      return {
        capacityML: state.config.buretteCapacityML,
        availableML: state.buretteAvailableML,
        deliveredML: state.titrantAddedML,
        conditionedWith: state.buretteConditioned
          ? "titrant"
          : state.titrantDilutionFactor < 1
            ? "water"
            : null,
        filled: state.fillCount > 0,
        stopcockDetent: "closed",
        meniscusReadingML: state.buretteReadingML
      };
    case "component.erlenmeyer_flask.v1":
      if (entry.visualAdapterId !== "ErlenmeyerFlask") {
        contractMismatch("component", entry.id);
      }
      if (!entry.measurement) {
        contractMismatch("component measurement", entry.id);
      }
      return {
        capacityML: entry.measurement.capacityML,
        totalVolumeML: state.config.analyte.volumeML + state.titrantAddedML,
        observableColor: latestObservedColor(state, semanticEvents),
        indicatorAdded: state.indicatorAdded
      };
    case "component.reagent_bottle.v1": {
      if (entry.visualAdapterId !== "WashStation") {
        contractMismatch("component", entry.id);
      }
      const reagent = workflow.reagents.find(({ role }) => role === "titrant");
      if (!reagent) contractMismatch("component binding", instanceId);
      return {
        reagentInstanceId: reagent.instanceId,
        selected: state.fillCount > 0
      };
    }
    case "component.indicator_bottle.v1": {
      if (entry.visualAdapterId !== "IndicatorShelf") {
        contractMismatch("component", entry.id);
      }
      const reagent = workflow.reagents.find(
        ({ role }) => role === "indicator"
      );
      if (!reagent) contractMismatch("component binding", instanceId);
      return {
        indicatorReagentInstanceId: reagent.instanceId,
        selected: state.indicatorAdded,
        added: state.indicatorAdded
      };
    }
  }
  return adapterNotFound("component", componentId);
}

function assertProjectedState(
  entry: ComponentRegistryEntry,
  state: Readonly<Record<string, ComponentRuntimeStateValue>>
): void {
  const fields = new Map(
    entry.stateSchema.fields.map((field) => [field.key, field])
  );
  if (
    Object.keys(state).length !== fields.size ||
    Object.keys(state).some((key) => !fields.has(key))
  ) {
    contractMismatch("component state", entry.id);
  }

  for (const [key, field] of fields) {
    const value = state[key];
    if (value === null) {
      if (!field.nullable) contractMismatch("component state", entry.id);
      continue;
    }
    const matches =
      (field.valueType === "number" &&
        typeof value === "number" &&
        Number.isFinite(value)) ||
      (field.valueType === "boolean" && typeof value === "boolean") ||
      ((field.valueType === "enum" || field.valueType === "string") &&
        typeof value === "string") ||
      (field.valueType === "string_array" &&
        Array.isArray(value) &&
        value.every((item) => typeof item === "string"));
    if (!matches) contractMismatch("component state", entry.id);
    if (
      field.allowedValues &&
      typeof value === "string" &&
      !field.allowedValues.includes(value)
    ) {
      contractMismatch("component state", entry.id);
    }
  }
}

export function assertTitrationComponentAdapter(componentId: string): void {
  if (!componentRegistry.has(componentId)) {
    adapterNotFound("component", componentId);
  }
  const entry = componentRegistry.get(componentId);
  const expectedVisualAdapter: Readonly<
    Record<
      ComponentRegistryEntry["id"],
      ComponentRegistryEntry["visualAdapterId"]
    >
  > = {
    "component.burette.v1": "Burette",
    "component.erlenmeyer_flask.v1": "ErlenmeyerFlask",
    "component.reagent_bottle.v1": "WashStation",
    "component.indicator_bottle.v1": "IndicatorShelf"
  };
  if (entry.visualAdapterId !== expectedVisualAdapter[entry.id]) {
    contractMismatch("component", entry.id);
  }
}

export function projectTitrationComponents(
  workflow: Readonly<ValidatedLabWorkflowSpec>,
  state: Readonly<TitrationState>,
  semanticEvents: readonly SemanticEvent[]
): readonly ComponentRuntimeView[] {
  return workflow.components.map((component) => {
    assertTitrationComponentAdapter(component.componentId);
    const entry = componentRegistry.get(component.componentId);
    const projectedState = Object.freeze(
      projectComponentState(
        entry,
        component.instanceId,
        workflow,
        state,
        semanticEvents
      )
    );
    assertProjectedState(entry, projectedState);
    return Object.freeze({
      instanceId: component.instanceId,
      componentId: component.componentId,
      visualAdapterId: entry.visualAdapterId,
      state: projectedState
    });
  });
}

export function isTitrationEndpointObserved(
  state: Readonly<TitrationState>,
  event: Readonly<SemanticEvent>
): boolean {
  if (event.type !== "add_titrant") return false;
  const observed = event.observation.observedColor;
  if (typeof observed !== "string") return false;
  return observed !== INDICATOR_SPECIFICATIONS[state.config.indicator].low;
}
