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

export function currentProjectedVolumeML(
  context: Readonly<GenericMechanicalContext>,
  equipmentInstanceId: string
): number {
  return volumeAt(context.materialLedger, equipmentInstanceId);
}
