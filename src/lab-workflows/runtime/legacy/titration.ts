import { z } from "zod";

import type { SemanticEvent } from "../../../experiments/shared";
import { createTitrationRetryScenario } from "../../../experiments/titration/retry";
import {
  observedColor,
  INDICATOR_SPECIFICATIONS,
  titration,
  type IndicatorId,
  type TitrationAction,
  type TitrationState
} from "../../../experiments/titration/titration";
import {
  LEGACY_TITRATION_CHEMISTRY_MODEL,
  LEGACY_TITRATION_RUNTIME_ADAPTER
} from "../../adapters/titration/metadata";
import { createWorkflowEvaluator } from "../../evaluation";
import {
  MATERIAL_LEDGER_SCHEMA_VERSION,
  validateMaterialLedger,
  type MaterialLedger
} from "../../chemistry-models/material-ledger";
import type { ValidatedLabWorkflowSpecV2 } from "../../schema/v2";
import type {
  CompiledGenericLabProgram,
  GenericChemistryProjection,
  GenericEquipmentState,
  GenericLegacyRuntimeAdapterPort,
  GenericLegacyRuntimeProjection,
  GenericMechanicalAdapterPort,
  GenericModelCoordinatorPort,
  GenericRuntimePorts,
  NormalizedLabAction,
  NormalizedActionParameter
} from "../generic";
import { deepFreeze } from "../generic/utils";
import {
  LEGACY_TITRATION_COMPATIBILITY_ERROR_CODES as ERROR,
  LegacyTitrationCompatibilityError
} from "./errors";

const STATE_SCHEMA_ID = "schema.compatibility_state.titration.v1";
const ENGINE_CONFIG_ID =
  "engine_config.titration.strong_acid_strong_base_25ml.v1";
const INITIALIZATION_PRESET_ID = "seed.titration.near_endpoint_22ml.v1";

const indicatorSchema = z.enum([
  "phenolphthalein",
  "bromothymol_blue",
  "methyl_orange"
]);
const configSchema = z.strictObject({
  analyte: z.strictObject({
    name: z.string(),
    type: z.enum(["strong_acid", "weak_acid"]),
    concentrationM: z.number().finite().positive(),
    volumeML: z.number().finite().positive(),
    pKa: z.number().finite().optional()
  }),
  titrant: z.strictObject({
    name: z.string(),
    concentrationM: z.number().finite().positive()
  }),
  indicator: indicatorSchema,
  buretteCapacityML: z.number().finite().positive()
});
const legacyStateSchema = z.strictObject({
  config: configSchema,
  sessionSeed: z.string().nullable(),
  indicatorAdded: z.boolean(),
  titrantAddedML: z.number().finite().nonnegative(),
  buretteAvailableML: z.number().finite().nonnegative(),
  buretteReadingML: z.number().finite().nonnegative(),
  fillCount: z.number().int().nonnegative(),
  fillHistory: z
    .array(
      z.strictObject({
        requestedML: z.number().finite().positive(),
        resultingAvailableML: z.number().finite().nonnegative(),
        currentReadingML: z.number().finite().nonnegative(),
        kind: z.enum(["initial", "refill"]),
        tSim: z.number().finite().nonnegative()
      })
    )
    .max(10_000),
  buretteConditioned: z.boolean(),
  titrantDilutionFactor: z.number().finite().positive(),
  tSim: z.number().finite().nonnegative(),
  curve: z
    .array(
      z.strictObject({
        volumeML: z.number().finite().nonnegative(),
        pH: z.number().finite()
      })
    )
    .max(100_000),
  submitted: z.boolean()
});

type EquipmentRole =
  | "indicator_source"
  | "reaction_vessel"
  | "titrant_delivery"
  | "titrant_source";
type MaterialRole = "analyte" | "indicator" | "titrant";

interface ExactCompatibilityBindings {
  readonly equipmentByRole: ReadonlyMap<EquipmentRole, string>;
  readonly materialByRole: ReadonlyMap<MaterialRole, string>;
}

function fail(
  code: LegacyTitrationCompatibilityError["code"],
  message: string,
  details: Readonly<Record<string, unknown>> = {}
): never {
  throw new LegacyTitrationCompatibilityError(code, details, message);
}

function parameter(
  parameters: readonly NormalizedActionParameter[],
  key: string,
  valueType: "enum" | "number"
): NormalizedActionParameter {
  const matches = parameters.filter((candidate) => candidate.key === key);
  if (matches.length !== 1 || matches[0]!.valueType !== valueType) {
    fail(
      ERROR.parameterInvalid,
      `Expected one ${valueType} parameter ${key}.`,
      { key }
    );
  }
  return matches[0]!;
}

function assertOnlyParameters(
  action: Readonly<NormalizedLabAction>,
  keys: readonly string[]
): void {
  if (
    action.parameters.length !== keys.length ||
    action.parameters.some(({ key }) => !keys.includes(key))
  ) {
    fail(
      ERROR.parameterInvalid,
      `Parameters do not match ${action.actionId}.`,
      {
        actionId: action.actionId
      }
    );
  }
}

export function adaptNormalizedTitrationAction(
  action: Readonly<NormalizedLabAction>
): TitrationAction {
  switch (action.actionId) {
    case "action.rinse.v1": {
      assertOnlyParameters(action, ["solvent"]);
      const solvent = parameter(action.parameters, "solvent", "enum").value;
      if (solvent !== "water" && solvent !== "titrant") {
        fail(ERROR.parameterInvalid, `Unsupported rinse solvent ${solvent}.`);
      }
      return { type: "rinse_burette", solvent };
    }
    case "action.fill.v1": {
      assertOnlyParameters(action, ["volumeML"]);
      const volumeML = parameter(action.parameters, "volumeML", "number").value;
      if (typeof volumeML !== "number" || !Number.isFinite(volumeML)) {
        fail(ERROR.parameterInvalid, "Fill volume must be finite.");
      }
      return { type: "fill_burette", volumeML };
    }
    case "action.select_indicator.v1":
    case "action.add_indicator.v1": {
      assertOnlyParameters(action, ["indicator"]);
      const parsed = indicatorSchema.safeParse(
        parameter(action.parameters, "indicator", "enum").value
      );
      if (!parsed.success) {
        fail(ERROR.parameterInvalid, "Indicator must resolve exactly.");
      }
      return { type: "select_indicator", indicator: parsed.data };
    }
    case "action.dispense.v1": {
      assertOnlyParameters(action, ["volumeML", "durationS"]);
      const volumeML = parameter(action.parameters, "volumeML", "number").value;
      const durationS = parameter(
        action.parameters,
        "durationS",
        "number"
      ).value;
      if (
        typeof volumeML !== "number" ||
        typeof durationS !== "number" ||
        !Number.isFinite(volumeML) ||
        !Number.isFinite(durationS)
      ) {
        fail(ERROR.parameterInvalid, "Dispense parameters must be finite.");
      }
      return { type: "add_titrant", volumeML, durationS };
    }
    case "action.read_volume.v1": {
      assertOnlyParameters(action, ["reportedML"]);
      const reportedML = parameter(
        action.parameters,
        "reportedML",
        "number"
      ).value;
      if (typeof reportedML !== "number" || !Number.isFinite(reportedML)) {
        fail(ERROR.parameterInvalid, "Reported volume must be finite.");
      }
      return { type: "read_meniscus", reportedML };
    }
    default:
      return fail(
        ERROR.mappingMissing,
        `No exact titration action mapping exists for ${action.actionId}.`,
        { actionId: action.actionId }
      );
  }
}

function exactBindings(
  workflow: Readonly<ValidatedLabWorkflowSpecV2>
): ExactCompatibilityBindings {
  const compatibility = workflow.compatibility;
  if (
    !compatibility ||
    compatibility.runtimeAdapterId !== LEGACY_TITRATION_RUNTIME_ADAPTER.id ||
    compatibility.runtimeAdapterVersion !==
      LEGACY_TITRATION_RUNTIME_ADAPTER.version ||
    compatibility.engineId !== LEGACY_TITRATION_RUNTIME_ADAPTER.engineId ||
    compatibility.engineConfigurationPresetId !== ENGINE_CONFIG_ID ||
    compatibility.initializationPresetId !== INITIALIZATION_PRESET_ID
  ) {
    fail(ERROR.contractMismatch, "Workflow legacy compatibility is not exact.");
  }

  const equipmentByRole = new Map<EquipmentRole, string>();
  for (const binding of compatibility.equipmentRoleBindings) {
    if (
      binding.legacyRoleId !== "indicator_source" &&
      binding.legacyRoleId !== "reaction_vessel" &&
      binding.legacyRoleId !== "titrant_delivery" &&
      binding.legacyRoleId !== "titrant_source"
    ) {
      fail(
        ERROR.mappingMissing,
        `Unknown legacy equipment role ${binding.legacyRoleId}.`
      );
    }
    if (equipmentByRole.has(binding.legacyRoleId)) {
      fail(
        ERROR.contractMismatch,
        `Duplicate legacy role ${binding.legacyRoleId}.`
      );
    }
    equipmentByRole.set(binding.legacyRoleId, binding.equipmentInstanceId);
  }
  const expectedEquipment: Readonly<
    Record<Exclude<EquipmentRole, "titrant_source">, string>
  > = {
    titrant_delivery: "component.burette.v1",
    reaction_vessel: "component.erlenmeyer_flask.v1",
    indicator_source: "component.indicator_bottle.v1"
  };
  for (const [role, definitionId] of Object.entries(expectedEquipment)) {
    const instanceId = equipmentByRole.get(role as EquipmentRole);
    const instance = workflow.equipment.find(
      (candidate) => candidate.instanceId === instanceId
    );
    if (!instance || instance.equipmentDefinitionId !== definitionId) {
      fail(
        ERROR.contractMismatch,
        `Legacy role ${role} does not resolve exactly.`
      );
    }
  }

  const materialByRole = new Map<MaterialRole, string>();
  for (const binding of compatibility.materialRoleBindings) {
    if (
      binding.legacyRoleId !== "analyte" &&
      binding.legacyRoleId !== "indicator" &&
      binding.legacyRoleId !== "titrant"
    ) {
      fail(
        ERROR.mappingMissing,
        `Unknown legacy material role ${binding.legacyRoleId}.`
      );
    }
    if (materialByRole.has(binding.legacyRoleId)) {
      fail(
        ERROR.contractMismatch,
        `Duplicate legacy role ${binding.legacyRoleId}.`
      );
    }
    materialByRole.set(binding.legacyRoleId, binding.materialInstanceId);
  }
  const expectedMaterials: Readonly<Record<MaterialRole, string>> = {
    analyte: "reagent.hydrochloric_acid_0_100m.v1",
    titrant: "reagent.sodium_hydroxide_0_100m.v1",
    indicator: "reagent.phenolphthalein.v1"
  };
  for (const [role, profileId] of Object.entries(expectedMaterials)) {
    const instanceId = materialByRole.get(role as MaterialRole);
    const binding = workflow.materials.find(
      (candidate) => candidate.instanceId === instanceId
    );
    if (!binding || binding.materialProfileId !== profileId) {
      fail(
        ERROR.contractMismatch,
        `Legacy material role ${role} does not resolve exactly.`
      );
    }
  }
  return { equipmentByRole, materialByRole };
}

function parseState(serialized: string): TitrationState {
  try {
    return legacyStateSchema.parse(JSON.parse(serialized)) as TitrationState;
  } catch {
    return fail(
      ERROR.stateInvalid,
      "Serialized legacy titration state is invalid."
    );
  }
}

function serializeState(state: Readonly<TitrationState>): string {
  return JSON.stringify(legacyStateSchema.parse(state));
}

function equipmentState(
  program: Readonly<CompiledGenericLabProgram>,
  state: Readonly<TitrationState>,
  bindings: ExactCompatibilityBindings
): readonly GenericEquipmentState[] {
  const currentPH = state.curve.at(-1)?.pH;
  return program.equipment.map((binding) => {
    let values: Readonly<Record<string, boolean | null | number | string>>;
    switch (binding.equipmentDefinitionId) {
      case "component.burette.v1":
        values = {
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
        break;
      case "component.erlenmeyer_flask.v1":
        values = {
          capacityML: binding.measurement?.capacityML ?? 125,
          totalVolumeML: state.config.analyte.volumeML + state.titrantAddedML,
          observableColor:
            currentPH === undefined
              ? "not yet observed"
              : observedColor(state.config.indicator, currentPH),
          indicatorAdded: state.indicatorAdded
        };
        break;
      case "component.indicator_bottle.v1":
        values = {
          indicatorReagentInstanceId: bindings.materialByRole.get("indicator")!,
          selected: state.indicatorAdded,
          added: state.indicatorAdded
        };
        break;
      case "component.reagent_bottle.v1":
        values = {
          reagentInstanceId: bindings.materialByRole.get("titrant")!,
          selected: state.fillCount > 0
        };
        break;
      default:
        return fail(
          ERROR.mappingMissing,
          `No legacy projection exists for ${binding.equipmentDefinitionId}.`
        );
    }
    return {
      instanceId: binding.instanceId,
      equipmentDefinitionId: binding.equipmentDefinitionId,
      stateSchemaId: binding.stateSchemaId,
      fields: binding.stateFields.map(({ key }) => {
        if (!(key in values)) {
          fail(
            ERROR.projectionMismatch,
            `Projection omits ${binding.instanceId}.${key}.`
          );
        }
        return { key, value: values[key]! };
      })
    };
  });
}

function projectedLedger(
  program: Readonly<CompiledGenericLabProgram>,
  state: Readonly<TitrationState>,
  bindings: ExactCompatibilityBindings
): MaterialLedger {
  const buretteId = bindings.equipmentByRole.get("titrant_delivery")!;
  const flaskId = bindings.equipmentByRole.get("reaction_vessel")!;
  const indicatorSourceId = bindings.equipmentByRole.get("indicator_source")!;
  const titrantSourceId = bindings.equipmentByRole.get("titrant_source");
  return validateMaterialLedger({
    schemaVersion: MATERIAL_LEDGER_SCHEMA_VERSION,
    materials: program.materials.map((material) => {
      let locations: readonly { equipmentInstanceId: string; amount: number }[];
      if (material.instanceId === bindings.materialByRole.get("titrant")) {
        const sourceAmount =
          material.quantityAmount -
          state.buretteAvailableML -
          state.titrantAddedML;
        if (sourceAmount < -1e-6 || (sourceAmount > 1e-6 && !titrantSourceId)) {
          fail(
            ERROR.projectionMismatch,
            "Titrant state is not conserved by authored bindings."
          );
        }
        locations = [
          { equipmentInstanceId: buretteId, amount: state.buretteAvailableML },
          { equipmentInstanceId: flaskId, amount: state.titrantAddedML },
          ...(sourceAmount > 1e-6 && titrantSourceId
            ? [{ equipmentInstanceId: titrantSourceId, amount: sourceAmount }]
            : [])
        ];
      } else if (
        material.instanceId === bindings.materialByRole.get("analyte")
      ) {
        if (
          Math.abs(material.quantityAmount - state.config.analyte.volumeML) >
          1e-6
        ) {
          fail(
            ERROR.projectionMismatch,
            "Analyte quantity does not match engine configuration."
          );
        }
        locations = [
          { equipmentInstanceId: flaskId, amount: material.quantityAmount }
        ];
      } else if (
        material.instanceId === bindings.materialByRole.get("indicator")
      ) {
        locations = [
          {
            equipmentInstanceId: state.indicatorAdded
              ? flaskId
              : indicatorSourceId,
            amount: material.quantityAmount
          }
        ];
      } else {
        locations = [
          {
            equipmentInstanceId: material.containerInstanceId,
            amount: material.quantityAmount
          }
        ];
      }
      return {
        materialInstanceId: material.instanceId,
        materialProfileId: material.materialProfileId,
        materialVersion: material.materialVersion,
        unitId: material.quantityUnitId,
        initialAmount: material.quantityAmount,
        locations
      };
    })
  });
}

function chemistryProjection(
  state: Readonly<TitrationState>
): GenericChemistryProjection {
  const current = state.curve.at(-1);
  const endpointObserved = current
    ? observedColor(state.config.indicator, current.pH) !==
      INDICATOR_SPECIFICATIONS[state.config.indicator].low
    : false;
  return {
    modelStates: [
      {
        modelId: LEGACY_TITRATION_CHEMISTRY_MODEL.id,
        modelVersion: LEGACY_TITRATION_CHEMISTRY_MODEL.version,
        fields: [
          { key: "buretteAvailableML", value: state.buretteAvailableML },
          { key: "buretteConditioned", value: state.buretteConditioned },
          { key: "indicator", value: state.config.indicator },
          { key: "indicatorAdded", value: state.indicatorAdded },
          {
            key: "observedColor",
            value: current
              ? observedColor(state.config.indicator, current.pH)
              : "not yet observed"
          },
          { key: "pH", value: current?.pH ?? null },
          { key: "submitted", value: state.submitted },
          { key: "titrantAddedML", value: state.titrantAddedML },
          { key: "titrantDilutionFactor", value: state.titrantDilutionFactor },
          { key: "tSim", value: state.tSim }
        ]
      }
    ],
    observables: [
      {
        observableId: "observable.burette_reading_ml.v1",
        value: state.buretteReadingML,
        unitId: "unit.ml.v1"
      },
      {
        observableId: "observable.endpoint_observed.v1",
        value: endpointObserved
      }
    ],
    groundTruth: titration.getGroundTruth(state)
  };
}

function materialIdsFor(
  action: Readonly<NormalizedLabAction>,
  bindings: ExactCompatibilityBindings
): readonly string[] {
  switch (action.actionId) {
    case "action.rinse.v1":
    case "action.fill.v1":
    case "action.dispense.v1":
      return [bindings.materialByRole.get("titrant")!];
    case "action.select_indicator.v1":
    case "action.add_indicator.v1":
      return [bindings.materialByRole.get("indicator")!];
    default:
      return [];
  }
}

function checkLegacyPreconditions(
  state: Readonly<TitrationState>,
  action: Readonly<TitrationAction>,
  preconditionIds: readonly string[],
  bindings: ExactCompatibilityBindings,
  program: Readonly<CompiledGenericLabProgram>
):
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reasonCode: string;
      readonly message: string;
    } {
  if (action.type === "select_indicator") {
    const indicatorMaterialId = bindings.materialByRole.get("indicator")!;
    const profileId = program.materials.find(
      ({ instanceId }) => instanceId === indicatorMaterialId
    )?.materialProfileId;
    const profileIndicator: Readonly<Record<string, IndicatorId>> = {
      "reagent.phenolphthalein.v1": "phenolphthalein",
      "reagent.bromothymol_blue.v1": "bromothymol_blue",
      "reagent.methyl_orange.v1": "methyl_orange"
    };
    if (!profileId || profileIndicator[profileId] !== action.indicator) {
      return {
        ok: false,
        reasonCode: ERROR.contractMismatch,
        message:
          "Indicator action does not match the exact bound material profile."
      };
    }
  }
  for (const id of preconditionIds) {
    const rejected = (message: string) => ({
      ok: false as const,
      reasonCode: id,
      message
    });
    switch (id) {
      case "precondition.equipment.burette_empty_before_rinse.v1":
        if (state.buretteAvailableML > 0 || state.fillCount > 0) {
          return rejected(
            "The burette must be unused and empty before rinsing."
          );
        }
        break;
      case "precondition.equipment.burette_capacity_available.v1":
        if (
          action.type !== "fill_burette" ||
          action.volumeML >
            state.config.buretteCapacityML - state.buretteAvailableML
        ) {
          return rejected("The requested fill exceeds remaining capacity.");
        }
        break;
      case "precondition.equipment.indicator_not_added.v1":
        if (state.indicatorAdded) {
          return rejected("Indicator has already been added.");
        }
        break;
      case "precondition.equipment.burette_has_liquid.v1":
        if (state.buretteAvailableML <= 0) {
          return rejected("The burette contains no available liquid.");
        }
        break;
      case "precondition.equipment.dispense_within_available_volume.v1":
        if (
          action.type !== "add_titrant" ||
          action.volumeML > state.buretteAvailableML
        ) {
          return rejected("The requested dispense exceeds available liquid.");
        }
        break;
      case "precondition.equipment.indicator_added.v1":
        if (!state.indicatorAdded) {
          return rejected("The receiving flask has no confirmed indicator.");
        }
        break;
      default:
        return rejected(`Unsupported legacy precondition ${id}.`);
    }
  }
  return { ok: true };
}

function projection(
  program: Readonly<CompiledGenericLabProgram>,
  state: Readonly<TitrationState>,
  bindings: ExactCompatibilityBindings,
  events: readonly SemanticEvent[],
  materialInstanceIds: readonly string[]
): GenericLegacyRuntimeProjection {
  return deepFreeze({
    compatibilityState: {
      runtimeAdapterId: LEGACY_TITRATION_RUNTIME_ADAPTER.id,
      runtimeAdapterVersion: LEGACY_TITRATION_RUNTIME_ADAPTER.version,
      stateSchemaId: STATE_SCHEMA_ID,
      serializedState: serializeState(state)
    },
    equipment: equipmentState(program, state, bindings),
    materialLedger: projectedLedger(program, state, bindings),
    chemistry: chemistryProjection(state),
    events: [...events],
    materialInstanceIds: [...materialInstanceIds]
  });
}

function placeholderMechanicalPort(
  adapterId: string,
  equipmentIds: readonly string[],
  actionIds: readonly string[],
  preconditionIds: readonly string[]
): GenericMechanicalAdapterPort {
  return {
    adapterId,
    adapterVersion: "1.0.0",
    supportedEquipmentDefinitionIds: equipmentIds,
    supportedActionIds: actionIds,
    supportedPreconditionIds: preconditionIds,
    initializeEquipment: () =>
      fail(
        ERROR.contractMismatch,
        `${adapterId} requires the atomic legacy port.`
      ),
    checkPreconditions: () => ({ ok: true }),
    apply: () =>
      fail(
        ERROR.contractMismatch,
        `${adapterId} requires the atomic legacy port.`
      )
  };
}

const LEGACY_MECHANICAL_PORTS = Object.freeze([
  placeholderMechanicalPort(
    "mechanical-adapter.burette.v1",
    ["component.burette.v1"],
    [
      "action.rinse.v1",
      "action.fill.v1",
      "action.dispense.v1",
      "action.read_volume.v1"
    ],
    [
      "precondition.equipment.burette_empty_before_rinse.v1",
      "precondition.equipment.burette_capacity_available.v1",
      "precondition.equipment.burette_has_liquid.v1",
      "precondition.equipment.dispense_within_available_volume.v1",
      "precondition.equipment.indicator_added.v1"
    ]
  ),
  placeholderMechanicalPort(
    "mechanical-adapter.erlenmeyer_flask.v1",
    ["component.erlenmeyer_flask.v1"],
    ["action.add_indicator.v1"],
    ["precondition.equipment.indicator_not_added.v1"]
  ),
  placeholderMechanicalPort(
    "mechanical-adapter.indicator_bottle.v1",
    ["component.indicator_bottle.v1"],
    ["action.select_indicator.v1"],
    ["precondition.equipment.indicator_not_added.v1"]
  ),
  placeholderMechanicalPort(
    "mechanical-adapter.reagent_bottle.v1",
    ["component.reagent_bottle.v1"],
    [],
    []
  )
]);

const LEGACY_MODEL_PLACEHOLDER: GenericModelCoordinatorPort = {
  supportedModels: [
    {
      modelId: LEGACY_TITRATION_CHEMISTRY_MODEL.id,
      modelVersion: LEGACY_TITRATION_CHEMISTRY_MODEL.version
    }
  ],
  initialize: () =>
    fail(
      ERROR.contractMismatch,
      "Legacy chemistry requires the atomic runtime port."
    ),
  transition: () =>
    fail(
      ERROR.contractMismatch,
      "Legacy chemistry requires the atomic runtime port."
    )
};

export function createLegacyTitrationRuntimePorts(
  workflow: Readonly<ValidatedLabWorkflowSpecV2>
): GenericRuntimePorts {
  const bindings = exactBindings(workflow);
  const legacyAdapter: GenericLegacyRuntimeAdapterPort = {
    runtimeAdapterId: LEGACY_TITRATION_RUNTIME_ADAPTER.id,
    runtimeAdapterVersion: LEGACY_TITRATION_RUNTIME_ADAPTER.version,
    engineId: LEGACY_TITRATION_RUNTIME_ADAPTER.engineId,
    engineVersion: "1.0.0",
    experimentDefinitionId:
      LEGACY_TITRATION_RUNTIME_ADAPTER.experimentDefinitionId,
    experimentDefinitionVersion: "1.0.0",
    supportedModels: [
      {
        modelId: LEGACY_TITRATION_CHEMISTRY_MODEL.id,
        modelVersion: LEGACY_TITRATION_CHEMISTRY_MODEL.version
      }
    ],
    initialize(context) {
      if (!context.config.sessionSeed) {
        fail(
          ERROR.contractMismatch,
          "Legacy seeded initialization requires sessionSeed."
        );
      }
      const scenario = createTitrationRetryScenario(
        "endpoint_control",
        context.config.sessionSeed
      );
      const state = titration.createInitialState(
        scenario.config,
        scenario.seed
      );
      return projection(context.program, state, bindings, [], []);
    },
    checkPreconditions(context) {
      try {
        const action = adaptNormalizedTitrationAction(
          context.mechanical.action
        );
        const state = parseState(context.compatibilityState.serializedState);
        return checkLegacyPreconditions(
          state,
          action,
          context.mechanical.preconditions.map(({ id }) => id),
          bindings,
          context.program
        );
      } catch (error) {
        return {
          ok: false,
          reasonCode:
            error instanceof LegacyTitrationCompatibilityError
              ? error.code
              : ERROR.contractMismatch,
          message:
            error instanceof Error
              ? error.message
              : "Legacy titration precondition failed."
        };
      }
    },
    apply(context) {
      const state = parseState(context.compatibilityState.serializedState);
      const expected = projection(context.program, state, bindings, [], []);
      if (
        JSON.stringify(expected.equipment) !==
          JSON.stringify(context.mechanical.equipment) ||
        JSON.stringify(expected.materialLedger) !==
          JSON.stringify(context.materialLedger) ||
        JSON.stringify(expected.chemistry) !== JSON.stringify(context.chemistry)
      ) {
        fail(
          ERROR.projectionMismatch,
          "Generic and serialized legacy state diverged."
        );
      }
      const action = adaptNormalizedTitrationAction(context.mechanical.action);
      const result = titration.step(state, action);
      return projection(
        context.program,
        result.state,
        bindings,
        result.events,
        materialIdsFor(context.mechanical.action, bindings)
      );
    }
  };

  return {
    mechanicalAdapters: LEGACY_MECHANICAL_PORTS,
    safetyPolicy: {
      supportedPolicyIds: ["safety.virtual_titration_ppe_notice.v1"],
      check: () => ({ ok: true })
    },
    models: LEGACY_MODEL_PLACEHOLDER,
    evaluator: createWorkflowEvaluator({ rules: workflow.rules }),
    legacyRuntimeAdapters: [legacyAdapter]
  };
}
