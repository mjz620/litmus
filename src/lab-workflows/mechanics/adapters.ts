import {
  createMaterialTransfer,
  materialAmountAt,
  quantityToIntegerUnits,
  volumeAt,
  type ExecutedMaterialAction,
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
    !Number.isFinite(parameter.value) ||
    parameter.value <= 0
  ) {
    fail(ERROR.invalidParameter, `${key} must be a finite positive number.`, {
      parameterKey: key
    });
  }
  return parameter.value;
}

function stringParameter(
  parameters: readonly NormalizedActionParameter[],
  key: string
): string {
  const parameter = parameters.find((candidate) => candidate.key === key);
  if (
    !parameter ||
    (parameter.valueType !== "enum" && parameter.valueType !== "string")
  ) {
    fail(ERROR.invalidParameter, `${key} must be a registered string value.`, {
      parameterKey: key
    });
  }
  return parameter.value;
}

function assertConnection(
  context: Readonly<GenericMechanicalContext>,
  sourceDefinitionId: string,
  targetDefinitionId?: string
): {
  readonly source: Readonly<GenericEquipmentState>;
  readonly target: Readonly<GenericEquipmentState> | null;
} {
  if (
    !context.source ||
    context.source.equipmentDefinitionId !== sourceDefinitionId ||
    context.targets.length !== (targetDefinitionId ? 1 : 0) ||
    (targetDefinitionId &&
      context.targets[0]?.equipmentDefinitionId !== targetDefinitionId)
  ) {
    fail(
      ERROR.invalidConnection,
      `Invalid ${context.action.actionId} connection.`,
      {
        actionId: context.action.actionId
      }
    );
  }
  return { source: context.source, target: context.targets[0] ?? null };
}

function sourceLiquid(
  context: Readonly<GenericMechanicalContext>,
  sourceEquipmentInstanceId: string
): MaterialLedgerMaterial {
  const candidates = context.materialLedger.materials.filter(
    (material) =>
      material.unitId === "unit.ml.v1" &&
      materialAmountAt(
        context.materialLedger,
        material.materialInstanceId,
        sourceEquipmentInstanceId
      ) > 0
  );
  if (candidates.length === 0) {
    fail(
      ERROR.materialUnavailable,
      "The source contains no transferable liquid.",
      {
        equipmentInstanceId: sourceEquipmentInstanceId
      }
    );
  }
  if (candidates.length > 1) {
    fail(
      ERROR.materialAmbiguous,
      "The source contains multiple transferable liquids.",
      {
        equipmentInstanceId: sourceEquipmentInstanceId
      }
    );
  }
  return candidates[0]!;
}

function replaceEquipment(
  equipment: readonly Readonly<GenericEquipmentState>[],
  replacements: readonly GenericEquipmentState[]
): readonly GenericEquipmentState[] {
  const byId = new Map(replacements.map((state) => [state.instanceId, state]));
  return equipment.map((state) => byId.get(state.instanceId) ?? state);
}

function executedTransfer(
  context: Readonly<GenericMechanicalContext>,
  material: MaterialLedgerMaterial,
  amount: number,
  sourceEquipmentInstanceId: string,
  targetEquipmentInstanceId: string
): ExecutedMaterialAction {
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

function fill(
  context: Readonly<GenericMechanicalContext>
): GenericMechanicalTransition {
  const { source, target } = assertConnection(
    context,
    "component.reagent_bottle.v1",
    "component.burette.v1"
  );
  if (!target) fail(ERROR.invalidConnection, "Fill target is missing.");
  const amount = numberParameter(context.action.parameters, "volumeML");
  const material = sourceLiquid(context, source.instanceId);
  const availableML = numericStateField(target, "availableML");
  const capacityML = numericStateField(target, "capacityML");
  if (
    quantityToIntegerUnits(availableML + amount, "unit.ml.v1") >
    quantityToIntegerUnits(capacityML, "unit.ml.v1")
  ) {
    fail(ERROR.invalidParameter, "Fill exceeds remaining burette capacity.", {
      requestedML: amount,
      availableCapacityML: capacityML - availableML
    });
  }
  const nextAvailableML = availableML + amount;
  const nextTarget = withStateFields(target, {
    availableML: nextAvailableML,
    meniscusReadingML: capacityML - nextAvailableML,
    filled: true
  });
  return {
    equipment: replaceEquipment(context.equipment, [nextTarget]),
    materialAction: executedTransfer(
      context,
      material,
      amount,
      source.instanceId,
      target.instanceId
    ),
    events: []
  };
}

function dispense(
  context: Readonly<GenericMechanicalContext>
): GenericMechanicalTransition {
  const { source, target } = assertConnection(
    context,
    "component.burette.v1",
    "component.erlenmeyer_flask.v1"
  );
  if (!target) fail(ERROR.invalidConnection, "Dispense target is missing.");
  const amount = numberParameter(context.action.parameters, "volumeML");
  const material = sourceLiquid(context, source.instanceId);
  const sourceAvailableML = numericStateField(source, "availableML");
  if (
    quantityToIntegerUnits(amount, "unit.ml.v1") >
    quantityToIntegerUnits(sourceAvailableML, "unit.ml.v1")
  ) {
    fail(ERROR.materialUnavailable, "Dispense exceeds source availability.", {
      requestedML: amount,
      availableML: sourceAvailableML
    });
  }
  const targetVolumeML = numericStateField(target, "totalVolumeML");
  const targetCapacityML = numericStateField(target, "capacityML");
  if (
    quantityToIntegerUnits(targetVolumeML + amount, "unit.ml.v1") >
    quantityToIntegerUnits(targetCapacityML, "unit.ml.v1")
  ) {
    fail(ERROR.invalidParameter, "Dispense exceeds target capacity.", {
      requestedML: amount,
      availableCapacityML: targetCapacityML - targetVolumeML
    });
  }
  const nextSource = withStateFields(source, {
    availableML: sourceAvailableML - amount,
    deliveredML: numericStateField(source, "deliveredML") + amount,
    meniscusReadingML: Math.min(
      numericStateField(source, "capacityML"),
      numericStateField(source, "meniscusReadingML") + amount
    )
  });
  const nextTarget = withStateFields(target, {
    totalVolumeML: targetVolumeML + amount
  });
  return {
    equipment: replaceEquipment(context.equipment, [nextSource, nextTarget]),
    materialAction: executedTransfer(
      context,
      material,
      amount,
      source.instanceId,
      target.instanceId
    ),
    events: []
  };
}

function rinse(
  context: Readonly<GenericMechanicalContext>
): GenericMechanicalTransition {
  const { source, target } = assertConnection(
    context,
    "component.reagent_bottle.v1",
    "component.burette.v1"
  );
  if (!target) fail(ERROR.invalidConnection, "Rinse target is missing.");
  const solvent = stringParameter(context.action.parameters, "solvent");
  const material = sourceLiquid(context, source.instanceId);
  if (
    solvent === "water" &&
    material.materialProfileId !== "reagent.distilled_water.v1"
  ) {
    fail(
      ERROR.materialUnavailable,
      "Water rinse requires exact distilled-water binding."
    );
  }
  if (
    solvent === "titrant" &&
    material.materialProfileId === "reagent.distilled_water.v1"
  ) {
    fail(
      ERROR.materialUnavailable,
      "Titrant rinse requires the exact bound non-water liquid source."
    );
  }
  if (solvent !== "water" && solvent !== "titrant") {
    fail(ERROR.invalidParameter, "Unsupported rinse solvent.", { solvent });
  }
  return {
    equipment: replaceEquipment(context.equipment, [
      withStateFields(target, { conditionedWith: solvent })
    ]),
    materialAction: null,
    events: []
  };
}

function read(
  context: Readonly<GenericMechanicalContext>
): GenericMechanicalTransition {
  assertConnection(context, "component.burette.v1");
  numberParameter(context.action.parameters, "reportedML");
  return { equipment: context.equipment, materialAction: null, events: [] };
}

function transferLiquid(
  context: Readonly<GenericMechanicalContext>
): GenericMechanicalTransition {
  const source = context.source;
  const target = context.targets[0] ?? null;
  if (!source || !target || context.targets.length !== 1) {
    fail(
      ERROR.invalidConnection,
      "Liquid transfer requires one source and one target."
    );
  }
  const sourceIsBottle =
    source.equipmentDefinitionId === "component.reagent_bottle.v1";
  const sourceIsPipette =
    source.equipmentDefinitionId === "component.volumetric_pipette.v1";
  const targetIsPipette =
    target.equipmentDefinitionId === "component.volumetric_pipette.v1";
  const targetIsFlask =
    target.equipmentDefinitionId === "component.volumetric_flask.v1";
  if (
    (!sourceIsBottle || !targetIsPipette) &&
    (!sourceIsPipette || !targetIsFlask)
  ) {
    fail(
      ERROR.invalidConnection,
      "That liquid-transfer connection is not registered.",
      {
        actionId: context.action.actionId
      }
    );
  }

  const amount = numberParameter(context.action.parameters, "volumeML");
  const material = sourceLiquid(context, source.instanceId);
  const availableAtSource = materialAmountAt(
    context.materialLedger,
    material.materialInstanceId,
    source.instanceId
  );
  if (
    quantityToIntegerUnits(amount, "unit.ml.v1") >
    quantityToIntegerUnits(availableAtSource, "unit.ml.v1")
  ) {
    fail(ERROR.materialUnavailable, "Transfer exceeds source availability.", {
      requestedML: amount,
      availableML: availableAtSource
    });
  }

  const targetVolumeKey = targetIsPipette ? "availableML" : "totalVolumeML";
  const targetVolumeML = numericStateField(target, targetVolumeKey);
  const targetCapacityML = numericStateField(target, "capacityML");
  if (
    quantityToIntegerUnits(targetVolumeML + amount, "unit.ml.v1") >
    quantityToIntegerUnits(targetCapacityML, "unit.ml.v1")
  ) {
    fail(ERROR.invalidParameter, "Transfer exceeds target capacity.", {
      requestedML: amount,
      availableCapacityML: targetCapacityML - targetVolumeML
    });
  }

  const replacements: GenericEquipmentState[] = [];
  if (sourceIsPipette) {
    replacements.push(
      withStateFields(source, {
        availableML: numericStateField(source, "availableML") - amount,
        deliveredML: numericStateField(source, "deliveredML") + amount
      })
    );
  }
  replacements.push(
    targetIsPipette
      ? withStateFields(target, { availableML: targetVolumeML + amount })
      : withStateFields(target, {
          totalVolumeML: targetVolumeML + amount,
          markErrorML: targetVolumeML + amount - targetCapacityML,
          filledToMark: false,
          withinMarkTolerance: false,
          mixed: false
        })
  );

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
        type: "transfer_liquid",
        tSim: 0,
        observation: { volumeML: amount },
        flags: [],
        evidence: []
      }
    ]
  };
}

function rinseTransferDevice(
  context: Readonly<GenericMechanicalContext>
): GenericMechanicalTransition {
  const { source, target } = assertConnection(
    context,
    "component.reagent_bottle.v1",
    "component.volumetric_pipette.v1"
  );
  if (!target)
    fail(ERROR.invalidConnection, "Pipette rinse target is missing.");
  if (numericStateField(target, "availableML") !== 0) {
    fail(
      ERROR.invalidParameter,
      "The pipette must be empty before conditioning."
    );
  }
  const material = sourceLiquid(context, source.instanceId);
  return {
    equipment: replaceEquipment(context.equipment, [
      withStateFields(target, {
        conditionedMaterialProfileId: material.materialProfileId,
        residualFilmPresent: true
      })
    ]),
    materialAction: null,
    events: [
      {
        type: "rinse_transfer_device",
        tSim: 0,
        observation: { materialProfileId: material.materialProfileId },
        flags: [],
        evidence: []
      }
    ]
  };
}

function fillToMark(
  context: Readonly<GenericMechanicalContext>
): GenericMechanicalTransition {
  const { source, target } = assertConnection(
    context,
    "component.wash_bottle.v1",
    "component.volumetric_flask.v1"
  );
  if (!target)
    fail(ERROR.invalidConnection, "Volumetric flask target is missing.");
  const material = sourceLiquid(context, source.instanceId);
  if (material.materialProfileId !== "reagent.distilled_water.v1") {
    fail(
      ERROR.materialUnavailable,
      "Fill-to-mark requires registered distilled water."
    );
  }
  const finalVolumeML = numberParameter(
    context.action.parameters,
    "finalVolumeML"
  );
  const currentVolumeML = numericStateField(target, "totalVolumeML");
  const markVolumeML = numericStateField(target, "capacityML");
  if (finalVolumeML <= currentVolumeML || finalVolumeML > markVolumeML) {
    fail(
      ERROR.invalidParameter,
      "Final volume must increase the flask contents without exceeding capacity.",
      { finalVolumeML, currentVolumeML, markVolumeML }
    );
  }
  const amount = finalVolumeML - currentVolumeML;
  const availableML = materialAmountAt(
    context.materialLedger,
    material.materialInstanceId,
    source.instanceId
  );
  if (
    quantityToIntegerUnits(amount, "unit.ml.v1") >
    quantityToIntegerUnits(availableML, "unit.ml.v1")
  ) {
    fail(
      ERROR.materialUnavailable,
      "Fill-to-mark exceeds diluent availability.",
      {
        requestedML: amount,
        availableML
      }
    );
  }
  const markErrorML = finalVolumeML - markVolumeML;
  const toleranceML = numericStateField(target, "markToleranceML");
  const withinTolerance = Math.abs(markErrorML) <= toleranceML;
  return {
    equipment: replaceEquipment(context.equipment, [
      withStateFields(source, { availableML: availableML - amount }),
      withStateFields(target, {
        totalVolumeML: finalVolumeML,
        markErrorML,
        filledToMark: true,
        withinMarkTolerance: withinTolerance,
        mixed: false
      })
    ]),
    materialAction: executedTransfer(
      context,
      material,
      amount,
      source.instanceId,
      target.instanceId
    ),
    events: [
      {
        type: "fill_to_mark",
        tSim: 0,
        observation: {
          finalVolumeML,
          markVolumeML,
          markErrorML,
          withinTolerance
        },
        flags: [],
        evidence: []
      }
    ]
  };
}

function mixSolution(
  context: Readonly<GenericMechanicalContext>
): GenericMechanicalTransition {
  const { source } = assertConnection(context, "component.volumetric_flask.v1");
  if (numericStateField(source, "totalVolumeML") <= 0) {
    fail(ERROR.materialUnavailable, "The volumetric flask is empty.");
  }
  const inversions = numberParameter(context.action.parameters, "inversions");
  if (!Number.isInteger(inversions)) {
    fail(ERROR.invalidParameter, "Inversions must be a whole number.");
  }
  const mixCount = numericStateField(source, "mixCount") + inversions;
  return {
    equipment: replaceEquipment(context.equipment, [
      withStateFields(source, { mixed: true, mixCount })
    ]),
    materialAction: null,
    events: [
      {
        type: "mix_solution",
        tSim: 0,
        observation: { inversions, mixCount },
        flags: [],
        evidence: []
      }
    ]
  };
}

function checkPreconditions(
  context: Readonly<GenericMechanicalContext>
): GenericPortCheck {
  for (const precondition of context.preconditions) {
    switch (precondition.id) {
      case "precondition.equipment.burette_empty_before_rinse.v1": {
        const target = context.targets[0];
        if (
          !target ||
          numericStateField(target, "availableML") !== 0 ||
          booleanStateField(target, "filled")
        ) {
          return reject(
            precondition.id,
            "The burette must be unused and empty before rinsing."
          );
        }
        break;
      }
      case "precondition.equipment.burette_capacity_available.v1": {
        const target = context.targets[0];
        const amount = numberParameter(context.action.parameters, "volumeML");
        if (
          !target ||
          numericStateField(target, "availableML") + amount >
            numericStateField(target, "capacityML")
        ) {
          return reject(
            precondition.id,
            "The requested fill exceeds remaining capacity."
          );
        }
        break;
      }
      case "precondition.equipment.burette_has_liquid.v1":
        if (
          !context.source ||
          numericStateField(context.source, "availableML") <= 0
        ) {
          return reject(
            precondition.id,
            "The burette contains no available liquid."
          );
        }
        break;
      case "precondition.equipment.dispense_within_available_volume.v1": {
        const amount = numberParameter(context.action.parameters, "volumeML");
        if (
          !context.source ||
          amount > numericStateField(context.source, "availableML")
        ) {
          return reject(
            precondition.id,
            "The requested dispense exceeds available liquid."
          );
        }
        break;
      }
      case "precondition.equipment.indicator_added.v1": {
        const target = context.targets[0];
        if (!target || !booleanStateField(target, "indicatorAdded")) {
          return reject(
            precondition.id,
            "The receiving flask has no confirmed indicator."
          );
        }
        break;
      }
      case "precondition.equipment.pipette_empty_before_rinse.v1": {
        const target = context.targets[0];
        if (!target || numericStateField(target, "availableML") !== 0) {
          return reject(
            precondition.id,
            "The pipette must be empty before conditioning."
          );
        }
        break;
      }
      case "precondition.equipment.source_has_transfer_volume.v1": {
        const amount = numberParameter(context.action.parameters, "volumeML");
        if (
          !context.source ||
          numericStateField(context.source, "availableML") < amount
        ) {
          return reject(
            precondition.id,
            "The source lacks the requested transfer volume."
          );
        }
        break;
      }
      case "precondition.equipment.target_has_transfer_capacity.v1": {
        const target = context.targets[0];
        const amount = numberParameter(context.action.parameters, "volumeML");
        if (
          !target ||
          numericStateField(target, "totalVolumeML") + amount >
            numericStateField(target, "capacityML")
        ) {
          return reject(precondition.id, "The target lacks transfer capacity.");
        }
        break;
      }
      case "precondition.equipment.volumetric_flask_has_liquid.v1":
        if (
          !context.source ||
          numericStateField(context.source, "totalVolumeML") <= 0
        ) {
          return reject(precondition.id, "The volumetric flask is empty.");
        }
        break;
      default:
        return reject(
          precondition.id,
          `Unsupported precondition ${precondition.id}.`
        );
    }
  }
  return OK;
}

export const BURETTE_MECHANICAL_ADAPTER: GenericMechanicalAdapterPort =
  Object.freeze({
    adapterId: "mechanical-adapter.burette.v1",
    adapterVersion: "1.0.0",
    supportedEquipmentDefinitionIds: Object.freeze(["component.burette.v1"]),
    supportedActionIds: Object.freeze([
      "action.rinse.v1",
      "action.fill.v1",
      "action.dispense.v1",
      "action.read_volume.v1"
    ]),
    supportedPreconditionIds: Object.freeze([
      "precondition.equipment.burette_empty_before_rinse.v1",
      "precondition.equipment.burette_capacity_available.v1",
      "precondition.equipment.burette_has_liquid.v1",
      "precondition.equipment.dispense_within_available_volume.v1",
      "precondition.equipment.indicator_added.v1"
    ]),
    initializeEquipment: initializeLiquidEquipmentState,
    checkPreconditions,
    apply(context: Readonly<GenericMechanicalContext>) {
      switch (context.action.actionId) {
        case "action.fill.v1":
          return fill(context);
        case "action.dispense.v1":
          return dispense(context);
        case "action.rinse.v1":
          return rinse(context);
        case "action.read_volume.v1":
          return read(context);
        default:
          fail(
            ERROR.unsupportedAction,
            `Unsupported action ${context.action.actionId}.`,
            {
              actionId: context.action.actionId
            }
          );
      }
    }
  });

function initializerAdapter(
  adapterId: string,
  equipmentDefinitionId: string
): GenericMechanicalAdapterPort {
  return Object.freeze({
    adapterId,
    adapterVersion: "1.0.0",
    supportedEquipmentDefinitionIds: Object.freeze([equipmentDefinitionId]),
    supportedActionIds: Object.freeze([]),
    supportedPreconditionIds: Object.freeze([]),
    initializeEquipment: initializeLiquidEquipmentState,
    checkPreconditions: () => OK,
    apply: () =>
      fail(
        ERROR.unsupportedAction,
        `${adapterId} has no LC2-201 action implementation.`
      )
  });
}

export const ERLENMEYER_FLASK_MECHANICAL_ADAPTER = initializerAdapter(
  "mechanical-adapter.erlenmeyer_flask.v1",
  "component.erlenmeyer_flask.v1"
);
export const REAGENT_BOTTLE_MECHANICAL_ADAPTER = initializerAdapter(
  "mechanical-adapter.reagent_bottle.v1",
  "component.reagent_bottle.v1"
);
export const INDICATOR_BOTTLE_MECHANICAL_ADAPTER = initializerAdapter(
  "mechanical-adapter.indicator_bottle.v1",
  "component.indicator_bottle.v1"
);

export const VOLUMETRIC_PIPETTE_MECHANICAL_ADAPTER: GenericMechanicalAdapterPort =
  Object.freeze({
    adapterId: "mechanical-adapter.volumetric_pipette.v1",
    adapterVersion: "1.0.0",
    supportedEquipmentDefinitionIds: Object.freeze([
      "component.volumetric_pipette.v1"
    ]),
    supportedActionIds: Object.freeze([
      "action.rinse_transfer_device.v1",
      "action.transfer_liquid.v1"
    ]),
    supportedPreconditionIds: Object.freeze([
      "precondition.equipment.pipette_empty_before_rinse.v1",
      "precondition.equipment.source_has_transfer_volume.v1",
      "precondition.equipment.target_has_transfer_capacity.v1"
    ]),
    initializeEquipment: initializeLiquidEquipmentState,
    checkPreconditions,
    apply(context: Readonly<GenericMechanicalContext>) {
      switch (context.action.actionId) {
        case "action.rinse_transfer_device.v1":
          return rinseTransferDevice(context);
        case "action.transfer_liquid.v1":
          return transferLiquid(context);
        default:
          fail(
            ERROR.unsupportedAction,
            `Unsupported action ${context.action.actionId}.`,
            {
              actionId: context.action.actionId
            }
          );
      }
    }
  });

export const VOLUMETRIC_FLASK_MECHANICAL_ADAPTER: GenericMechanicalAdapterPort =
  Object.freeze({
    adapterId: "mechanical-adapter.volumetric_flask.v1",
    adapterVersion: "1.0.0",
    supportedEquipmentDefinitionIds: Object.freeze([
      "component.volumetric_flask.v1"
    ]),
    supportedActionIds: Object.freeze([
      "action.fill_to_mark.v1",
      "action.mix_solution.v1"
    ]),
    supportedPreconditionIds: Object.freeze([
      "precondition.equipment.volumetric_flask_has_liquid.v1"
    ]),
    initializeEquipment: initializeLiquidEquipmentState,
    checkPreconditions,
    apply(context: Readonly<GenericMechanicalContext>) {
      switch (context.action.actionId) {
        case "action.fill_to_mark.v1":
          return fillToMark(context);
        case "action.mix_solution.v1":
          return mixSolution(context);
        default:
          fail(
            ERROR.unsupportedAction,
            `Unsupported action ${context.action.actionId}.`,
            {
              actionId: context.action.actionId
            }
          );
      }
    }
  });

export const WASH_BOTTLE_MECHANICAL_ADAPTER = initializerAdapter(
  "mechanical-adapter.wash_bottle.v1",
  "component.wash_bottle.v1"
);

export function currentProjectedVolumeML(
  context: Readonly<GenericMechanicalContext>,
  equipmentInstanceId: string
): number {
  return volumeAt(context.materialLedger, equipmentInstanceId);
}
