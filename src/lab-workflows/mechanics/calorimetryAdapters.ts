import {
  createMaterialTransfer,
  materialAmountAt,
  quantityToIntegerUnits,
  volumeAt,
  type MaterialLedgerMaterial
} from "../chemistry-models/material-ledger";
import type {
  GenericEquipmentState,
  GenericMechanicalAdapterPort,
  GenericMechanicalContext,
  GenericMechanicalTransition,
  GenericPortCheck,
  NormalizedActionParameter
} from "../runtime/generic/types";
import {
  LIQUID_MECHANICS_ERROR_CODES as ERROR,
  LiquidMechanicsError
} from "./errors";
import {
  booleanStateField,
  initializeLiquidEquipmentState,
  numericStateField,
  stateField,
  withStateFields
} from "./state";

const OK = Object.freeze({ ok: true as const });

function reject(reasonCode: string, message: string): GenericPortCheck {
  return { ok: false, reasonCode, message };
}

function fail(
  code: LiquidMechanicsError["code"],
  message: string,
  details: LiquidMechanicsError["details"] = {}
): never {
  throw new LiquidMechanicsError(code, message, details);
}

function numberParameter(
  parameters: readonly NormalizedActionParameter[],
  key: string
): number {
  const parameter = parameters.find((candidate) => candidate.key === key);
  if (
    !parameter ||
    parameter.valueType !== "number" ||
    !Number.isFinite(parameter.value)
  ) {
    fail(ERROR.invalidParameter, `${key} must be a finite number.`, {
      parameterKey: key
    });
  }
  return parameter.value;
}

function booleanParameter(
  parameters: readonly NormalizedActionParameter[],
  key: string
): boolean {
  const parameter = parameters.find((candidate) => candidate.key === key);
  if (!parameter || parameter.valueType !== "enum") {
    fail(ERROR.invalidParameter, `${key} must be a registered enum value.`, {
      parameterKey: key
    });
  }
  if (parameter.value === "closed") return true;
  if (parameter.value === "open") return false;
  fail(ERROR.invalidParameter, `${key} must be open or closed.`, {
    parameterKey: key
  });
}

function replaceEquipment(
  equipment: readonly GenericEquipmentState[],
  replacements: readonly GenericEquipmentState[]
): readonly GenericEquipmentState[] {
  const byId = new Map(
    replacements.map((entry) => [entry.instanceId, entry] as const)
  );
  return equipment.map((entry) => byId.get(entry.instanceId) ?? entry);
}

function sourceLiquid(
  context: Readonly<GenericMechanicalContext>,
  equipmentInstanceId: string
): MaterialLedgerMaterial {
  const matches = context.materialLedger.materials.filter((material) =>
    material.locations.some(
      (location) =>
        location.equipmentInstanceId === equipmentInstanceId &&
        location.amount > 0
    )
  );
  if (matches.length !== 1) {
    fail(
      ERROR.materialUnavailable,
      "Exact one liquid material is required at the source.",
      { equipmentInstanceId }
    );
  }
  return matches[0]!;
}

function executedTransfer(
  context: Readonly<GenericMechanicalContext>,
  material: MaterialLedgerMaterial,
  amount: number,
  sourceEquipmentInstanceId: string,
  targetEquipmentInstanceId: string
) {
  const transfer = createMaterialTransfer(context.materialLedger, {
    materialInstanceId: material.materialInstanceId,
    sourceEquipmentInstanceId,
    targetEquipmentInstanceId,
    amount,
    unitId: "unit.ml.v1"
  });
  return {
    actionId: context.action.actionId,
    sourceEquipmentInstanceId,
    targetEquipmentInstanceIds: [targetEquipmentInstanceId],
    materialInstanceIds: [material.materialInstanceId],
    transfers: [transfer]
  };
}

function pourLiquid(
  context: Readonly<GenericMechanicalContext>
): GenericMechanicalTransition {
  const source = context.source;
  const target = context.targets[0] ?? null;
  if (!source || !target || context.targets.length !== 1) {
    fail(
      ERROR.invalidConnection,
      "Pour requires one liquid source and one calorimeter."
    );
  }
  const sourceOk =
    source.equipmentDefinitionId === "component.wash_bottle.v1" ||
    source.equipmentDefinitionId === "component.reagent_bottle.v1";
  if (
    !sourceOk ||
    target.equipmentDefinitionId !== "component.calorimeter.v1"
  ) {
    fail(
      ERROR.invalidConnection,
      "Pour is registered only from a wash bottle or reagent bottle into a calorimeter."
    );
  }
  if (booleanStateField(target, "lidClosed")) {
    fail(ERROR.invalidEquipment, "Open the calorimeter lid before pouring.", {
      equipmentInstanceId: target.instanceId
    });
  }
  const amount = numberParameter(context.action.parameters, "volumeML");
  if (amount <= 0) {
    fail(ERROR.invalidParameter, "volumeML must be a finite positive number.", {
      parameterKey: "volumeML"
    });
  }
  const material = sourceLiquid(context, source.instanceId);
  if (
    material.materialProfileId !== "reagent.distilled_water.v1" &&
    material.materialProfileId !== "reagent.distilled_water_cold_20c.v1" &&
    material.materialProfileId !== "reagent.distilled_water_hot_60c.v1"
  ) {
    fail(
      ERROR.materialUnavailable,
      "Coffee-cup pour accepts registered distilled water only."
    );
  }
  const availableAtSource = materialAmountAt(
    context.materialLedger,
    material.materialInstanceId,
    source.instanceId
  );
  if (
    quantityToIntegerUnits(amount, "unit.ml.v1") >
    quantityToIntegerUnits(availableAtSource, "unit.ml.v1")
  ) {
    fail(ERROR.materialUnavailable, "Pour exceeds source availability.", {
      requestedML: amount,
      availableML: availableAtSource
    });
  }
  const currentVolumeML = numericStateField(target, "totalVolumeML");
  const capacityML = numericStateField(target, "capacityML");
  if (
    quantityToIntegerUnits(currentVolumeML + amount, "unit.ml.v1") >
    quantityToIntegerUnits(capacityML, "unit.ml.v1")
  ) {
    fail(ERROR.invalidParameter, "Pour exceeds calorimeter capacity.", {
      requestedML: amount,
      availableCapacityML: capacityML - currentVolumeML
    });
  }

  const replacements: GenericEquipmentState[] = [
    withStateFields(target, {
      totalVolumeML: currentVolumeML + amount,
      mixed: false
    })
  ];
  if (source.equipmentDefinitionId === "component.wash_bottle.v1") {
    replacements.push(
      withStateFields(source, {
        availableML: availableAtSource - amount
      })
    );
  }

  return {
    equipment: replaceEquipment(context.equipment, replacements),
    materialAction: executedTransfer(
      context,
      material,
      amount,
      source.instanceId,
      target.instanceId
    ),
    events: [
      {
        type: "pour_liquid",
        tSim: 0,
        observation: {
          volumeML: amount,
          sourceEquipmentInstanceId: source.instanceId,
          targetEquipmentInstanceId: target.instanceId
        },
        flags: [],
        evidence: []
      }
    ]
  };
}

function mixCalorimeter(
  context: Readonly<GenericMechanicalContext>
): GenericMechanicalTransition {
  const source = context.source;
  if (
    !source ||
    source.equipmentDefinitionId !== "component.calorimeter.v1" ||
    context.targets.length !== 0
  ) {
    fail(
      ERROR.invalidConnection,
      "Calorimeter mix requires the calorimeter as the sole actor."
    );
  }
  if (numericStateField(source, "totalVolumeML") <= 0) {
    fail(ERROR.invalidEquipment, "Cannot mix an empty calorimeter.", {
      equipmentInstanceId: source.instanceId
    });
  }
  const inversions = numberParameter(context.action.parameters, "inversions");
  if (!Number.isInteger(inversions) || inversions < 1 || inversions > 20) {
    fail(
      ERROR.invalidParameter,
      "inversions must be an integer between 1 and 20.",
      { parameterKey: "inversions" }
    );
  }
  return {
    equipment: replaceEquipment(context.equipment, [
      withStateFields(source, {
        mixed: true,
        mixCount: numericStateField(source, "mixCount") + inversions
      })
    ]),
    materialAction: null,
    events: [
      {
        type: "mix_calorimeter",
        tSim: 0,
        observation: { inversions },
        flags: [],
        evidence: []
      }
    ]
  };
}

function setCalorimeterLid(
  context: Readonly<GenericMechanicalContext>
): GenericMechanicalTransition {
  const source = context.source;
  if (
    !source ||
    source.equipmentDefinitionId !== "component.calorimeter.v1" ||
    context.targets.length !== 0
  ) {
    fail(
      ERROR.invalidConnection,
      "Lid control requires the calorimeter as the sole actor."
    );
  }
  const lidClosed = booleanParameter(context.action.parameters, "lidState");
  return {
    equipment: replaceEquipment(context.equipment, [
      withStateFields(source, { lidClosed })
    ]),
    materialAction: null,
    events: [
      {
        type: "set_calorimeter_lid",
        tSim: 0,
        observation: { lidClosed },
        flags: [],
        evidence: []
      }
    ]
  };
}

function placeThermometer(
  context: Readonly<GenericMechanicalContext>
): GenericMechanicalTransition {
  const source = context.source;
  const target = context.targets[0] ?? null;
  if (!source || !target || context.targets.length !== 1) {
    fail(
      ERROR.invalidConnection,
      "Place thermometer requires the probe and one calorimeter."
    );
  }
  if (
    source.equipmentDefinitionId !== "component.thermometer.v1" ||
    target.equipmentDefinitionId !== "component.calorimeter.v1"
  ) {
    fail(
      ERROR.invalidConnection,
      "Place thermometer is registered only from a thermometer into a calorimeter."
    );
  }
  if (booleanStateField(source, "placed")) {
    fail(ERROR.invalidEquipment, "Thermometer is already placed.", {
      equipmentInstanceId: source.instanceId
    });
  }
  if (booleanStateField(target, "probeInserted")) {
    fail(
      ERROR.invalidEquipment,
      "Calorimeter already has a thermometer inserted.",
      { equipmentInstanceId: target.instanceId }
    );
  }
  return {
    equipment: replaceEquipment(context.equipment, [
      withStateFields(source, {
        placed: true,
        hostCalorimeterInstanceId: target.instanceId
      }),
      withStateFields(target, {
        probeInserted: true,
        insertedThermometerInstanceId: source.instanceId
      })
    ]),
    materialAction: null,
    events: [
      {
        type: "place_thermometer",
        tSim: 0,
        observation: {
          thermometerInstanceId: source.instanceId,
          calorimeterInstanceId: target.instanceId
        },
        flags: [],
        evidence: []
      }
    ]
  };
}

function removeThermometer(
  context: Readonly<GenericMechanicalContext>
): GenericMechanicalTransition {
  const source = context.source;
  if (
    !source ||
    source.equipmentDefinitionId !== "component.thermometer.v1" ||
    context.targets.length !== 0
  ) {
    fail(
      ERROR.invalidConnection,
      "Remove thermometer requires the probe as the sole actor."
    );
  }
  if (!booleanStateField(source, "placed")) {
    fail(ERROR.invalidEquipment, "Thermometer is not placed.", {
      equipmentInstanceId: source.instanceId
    });
  }
  const hostId = stateField(source, "hostCalorimeterInstanceId");
  if (typeof hostId !== "string") {
    fail(ERROR.invalidEquipment, "Thermometer host binding is missing.", {
      equipmentInstanceId: source.instanceId
    });
  }
  const host = context.equipment.find((entry) => entry.instanceId === hostId);
  if (!host || host.equipmentDefinitionId !== "component.calorimeter.v1") {
    fail(ERROR.invalidEquipment, "Thermometer host calorimeter is missing.", {
      equipmentInstanceId: source.instanceId
    });
  }
  return {
    equipment: replaceEquipment(context.equipment, [
      withStateFields(source, {
        placed: false,
        hostCalorimeterInstanceId: null
      }),
      withStateFields(host, {
        probeInserted: false,
        insertedThermometerInstanceId: null
      })
    ]),
    materialAction: null,
    events: [
      {
        type: "remove_thermometer",
        tSim: 0,
        observation: {
          thermometerInstanceId: source.instanceId,
          calorimeterInstanceId: host.instanceId
        },
        flags: [],
        evidence: []
      }
    ]
  };
}

function readTemperature(
  context: Readonly<GenericMechanicalContext>
): GenericMechanicalTransition {
  const source = context.source;
  if (
    !source ||
    source.equipmentDefinitionId !== "component.thermometer.v1" ||
    context.targets.length !== 0
  ) {
    fail(
      ERROR.invalidConnection,
      "Read temperature requires the thermometer as the sole actor."
    );
  }
  if (!booleanStateField(source, "placed")) {
    fail(
      ERROR.invalidEquipment,
      "Place the thermometer before reading temperature.",
      { equipmentInstanceId: source.instanceId }
    );
  }
  const reportedC = numberParameter(context.action.parameters, "reportedC");
  const increment = numericStateField(source, "reportIncrementC");
  const scaled = Math.round(reportedC / increment) * increment;
  // Decimal reporting increments such as 0.1 are not exactly representable in
  // binary floating point. Compare at a tiny fraction of the registered
  // increment so valid display values such as 39.3 are accepted consistently.
  if (Math.abs(scaled - reportedC) > increment * 1e-9) {
    fail(
      ERROR.invalidParameter,
      `reportedC must align to the registered ${increment} °C increment.`,
      { parameterKey: "reportedC" }
    );
  }
  return {
    equipment: replaceEquipment(context.equipment, [
      withStateFields(source, { lastReportedC: reportedC })
    ]),
    materialAction: null,
    events: [
      {
        type: "read_temperature",
        tSim: 0,
        observation: { reportedC },
        flags: [],
        evidence: []
      }
    ]
  };
}

function checkCalorimeterPreconditions(
  context: Readonly<GenericMechanicalContext>
): GenericPortCheck {
  for (const precondition of context.preconditions) {
    switch (precondition.id) {
      case "precondition.equipment.calorimeter_has_liquid.v1": {
        const actor = context.source;
        if (
          !actor ||
          actor.equipmentDefinitionId !== "component.calorimeter.v1"
        ) {
          return reject(
            precondition.id,
            "Calorimeter liquid precondition requires a calorimeter actor."
          );
        }
        if (numericStateField(actor, "totalVolumeML") <= 0) {
          return reject(precondition.id, "Calorimeter has no liquid.");
        }
        break;
      }
      default:
        return reject(
          precondition.id,
          `Unsupported precondition ${precondition.id}.`
        );
    }
  }
  return OK;
}

function initializeThermometerState(
  context: Parameters<GenericMechanicalAdapterPort["initializeEquipment"]>[0]
): GenericEquipmentState {
  const { binding } = context;
  if (binding.equipmentDefinitionId !== "component.thermometer.v1") {
    fail(
      ERROR.invalidEquipment,
      "Thermometer initializer received a non-thermometer binding.",
      { equipmentInstanceId: binding.instanceId }
    );
  }
  return {
    instanceId: binding.instanceId,
    equipmentDefinitionId: binding.equipmentDefinitionId,
    stateSchemaId: binding.stateSchemaId,
    fields: binding.stateFields.map(({ key }) => {
      switch (key) {
        case "placed":
          return { key, value: false };
        case "hostCalorimeterInstanceId":
          return { key, value: null };
        case "reportIncrementC":
          return {
            key,
            value: binding.measurement?.reportIncrementML ?? 0.1
          };
        case "lastReportedC":
          return { key, value: null };
        default:
          fail(
            ERROR.invalidEquipment,
            `Thermometer initializer omitted ${key}.`,
            { equipmentInstanceId: binding.instanceId }
          );
      }
    })
  };
}

export const CALORIMETER_MECHANICAL_ADAPTER: GenericMechanicalAdapterPort =
  Object.freeze({
    adapterId: "mechanical-adapter.calorimeter.v1",
    adapterVersion: "1.0.0",
    supportedEquipmentDefinitionIds: Object.freeze([
      "component.calorimeter.v1"
    ]),
    supportedActionIds: Object.freeze([
      "action.pour_liquid.v1",
      "action.mix_calorimeter.v1",
      "action.set_calorimeter_lid.v1"
    ]),
    supportedPreconditionIds: Object.freeze([
      "precondition.equipment.calorimeter_has_liquid.v1"
    ]),
    initializeEquipment: initializeLiquidEquipmentState,
    checkPreconditions: checkCalorimeterPreconditions,
    apply(context: Readonly<GenericMechanicalContext>) {
      switch (context.action.actionId) {
        case "action.pour_liquid.v1":
          return pourLiquid(context);
        case "action.mix_calorimeter.v1":
          return mixCalorimeter(context);
        case "action.set_calorimeter_lid.v1":
          return setCalorimeterLid(context);
        default:
          fail(
            ERROR.unsupportedAction,
            `Unsupported action ${context.action.actionId}.`,
            { actionId: context.action.actionId }
          );
      }
    }
  });

export const THERMOMETER_MECHANICAL_ADAPTER: GenericMechanicalAdapterPort =
  Object.freeze({
    adapterId: "mechanical-adapter.thermometer.v1",
    adapterVersion: "1.0.0",
    supportedEquipmentDefinitionIds: Object.freeze([
      "component.thermometer.v1"
    ]),
    supportedActionIds: Object.freeze([
      "action.place_thermometer.v1",
      "action.remove_thermometer.v1",
      "action.read_temperature.v1"
    ]),
    supportedPreconditionIds: Object.freeze([]),
    initializeEquipment: initializeThermometerState,
    checkPreconditions: () => OK,
    apply(context: Readonly<GenericMechanicalContext>) {
      switch (context.action.actionId) {
        case "action.place_thermometer.v1":
          return placeThermometer(context);
        case "action.remove_thermometer.v1":
          return removeThermometer(context);
        case "action.read_temperature.v1":
          return readTemperature(context);
        default:
          fail(
            ERROR.unsupportedAction,
            `Unsupported action ${context.action.actionId}.`,
            { actionId: context.action.actionId }
          );
      }
    }
  });

export function currentCalorimeterVolumeML(
  context: Readonly<GenericMechanicalContext>,
  equipmentInstanceId: string
): number {
  return volumeAt(context.materialLedger, equipmentInstanceId);
}
