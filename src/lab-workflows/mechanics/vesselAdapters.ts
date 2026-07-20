import {
  createMaterialTransfer,
  materialAmountAt,
  quantityToIntegerUnits,
  type MaterialLedgerMaterial
} from "../chemistry-models/material-ledger";
import type {
  GenericEquipmentState,
  GenericMechanicalAdapterPort,
  GenericMechanicalContext,
  GenericMechanicalTransition,
  NormalizedActionParameter
} from "../runtime/generic/types";
import {
  LIQUID_MECHANICS_ERROR_CODES as ERROR,
  LiquidMechanicsError
} from "./errors";
import {
  initializeLiquidEquipmentState,
  numericStateField,
  withStateFields
} from "./state";

const OK = Object.freeze({ ok: true as const });

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
  const parameter = parameters.find((entry) => entry.key === key);
  if (!parameter || parameter.valueType !== "number") {
    fail(ERROR.invalidParameter, `Missing numeric parameter ${key}.`, {
      parameterKey: key
    });
  }
  const { value } = parameter;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(ERROR.invalidParameter, `Parameter ${key} must be finite.`, {
      parameterKey: key
    });
  }
  return value;
}

function replaceEquipment(
  equipment: readonly GenericEquipmentState[],
  replacements: readonly GenericEquipmentState[]
): readonly GenericEquipmentState[] {
  return equipment.map(
    (entry) =>
      replacements.find(
        (replacement) => replacement.instanceId === entry.instanceId
      ) ?? entry
  );
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

/**
 * Pour into a general vessel.
 *
 * Deliberately does not restrict which reagent may be poured — the receiving
 * component's registered capabilities and the action's parameter bounds are
 * the gate. The calorimeter adapter accepts distilled water only because
 * coffee-cup calorimetry requires it; a beaker has no such constraint, which
 * is what lets the same glassware serve different labs.
 */
function pourIntoVessel(
  context: Readonly<GenericMechanicalContext>
): GenericMechanicalTransition {
  const source = context.source;
  const target = context.targets[0] ?? null;
  if (!source || !target || context.targets.length !== 1) {
    fail(ERROR.invalidEquipment, "Pour requires exactly one source and target.");
  }

  const amount = numberParameter(context.action.parameters, "volumeML");
  if (amount <= 0) {
    fail(ERROR.invalidParameter, "volumeML must be a finite positive number.", {
      parameterKey: "volumeML"
    });
  }

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
    fail(ERROR.invalidParameter, "Pour exceeds vessel capacity.", {
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
      withStateFields(source, { availableML: availableAtSource - amount })
    );
  }

  return {
    equipment: replaceEquipment(context.equipment, replacements),
    materialAction: {
      actionId: context.action.actionId,
      sourceEquipmentInstanceId: source.instanceId,
      targetEquipmentInstanceIds: [target.instanceId],
      materialInstanceIds: [material.materialInstanceId],
      transfers: [
        createMaterialTransfer(context.materialLedger, {
          materialInstanceId: material.materialInstanceId,
          sourceEquipmentInstanceId: source.instanceId,
          targetEquipmentInstanceId: target.instanceId,
          amount,
          unitId: "unit.ml.v1"
        })
      ]
    },
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

function mixVessel(
  context: Readonly<GenericMechanicalContext>
): GenericMechanicalTransition {
  const source = context.source;
  if (!source) fail(ERROR.invalidEquipment, "Mix requires a source vessel.");

  const totalVolumeML = numericStateField(source, "totalVolumeML");
  if (totalVolumeML <= 0) {
    fail(ERROR.invalidEquipment, "Cannot mix an empty vessel.", {
      equipmentInstanceId: source.instanceId
    });
  }

  const mixCount = numericStateField(source, "mixCount") + 1;
  return {
    equipment: replaceEquipment(context.equipment, [
      withStateFields(source, { mixed: true, mixCount })
    ]),
    materialAction: null,
    events: [
      {
        type: "mix_solution",
        tSim: 0,
        observation: {
          sourceEquipmentInstanceId: source.instanceId,
          mixCount
        },
        flags: [],
        evidence: []
      }
    ]
  };
}

/**
 * Mechanics for the general-purpose beaker. Holds liquid, receives pours from
 * any registered dispensing source, and mixes — no lab-specific behaviour.
 */
export const BEAKER_MECHANICAL_ADAPTER: GenericMechanicalAdapterPort =
  Object.freeze({
    adapterId: "mechanical-adapter.beaker.v1",
    adapterVersion: "1.0.0",
    supportedEquipmentDefinitionIds: Object.freeze(["component.beaker.v1"]),
    supportedActionIds: Object.freeze([
      "action.pour_liquid.v1",
      "action.mix_solution.v1"
    ]),
    supportedPreconditionIds: Object.freeze([]),
    initializeEquipment: initializeLiquidEquipmentState,
    checkPreconditions: () => OK,
    apply(context: Readonly<GenericMechanicalContext>) {
      switch (context.action.actionId) {
        case "action.pour_liquid.v1":
          return pourIntoVessel(context);
        case "action.mix_solution.v1":
          return mixVessel(context);
        default:
          fail(
            ERROR.unsupportedAction,
            `Beaker adapter cannot apply ${context.action.actionId}.`
          );
      }
    }
  });
