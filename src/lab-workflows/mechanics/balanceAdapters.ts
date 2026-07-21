import {
  createMaterialTransfer,
  materialAmountAt,
  type MaterialLedgerMaterial
} from "../chemistry-models/material-ledger";
import type {
  GenericEquipmentInitializationContext,
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
import { numericStateField, stateField, withStateFields } from "./state";

const OK = Object.freeze({ ok: true as const });
/**
 * Registered mass of this simulated reusable boat. Real disposable boat tare
 * masses vary by manufacturer, so this is apparatus calibration data rather
 * than a claimed universal material constant.
 */
const WEIGHING_BOAT_EMPTY_MASS_G = 2;
/**
 * University of York Chemistry Teaching Labs documents teaching balances
 * that report to two decimal places:
 * https://chemtl.york.ac.uk/techniques/basic-techniques/weigh-measure/weighing-solids
 */
const CENTIGRAM_RESOLUTION_G = 0.01;

function fail(message: string): never {
  throw new LiquidMechanicsError(ERROR.invalidEquipment, message);
}

function createState(
  context: Readonly<GenericEquipmentInitializationContext>,
  values: Readonly<Record<string, boolean | null | number | string>>
): GenericEquipmentState {
  const { binding } = context;
  return {
    instanceId: binding.instanceId,
    equipmentDefinitionId: binding.equipmentDefinitionId,
    stateSchemaId: binding.stateSchemaId,
    fields: binding.stateFields.map(({ key }) => {
      if (!Object.prototype.hasOwnProperty.call(values, key)) {
        fail(`Balance initializer omitted ${key}.`);
      }
      return { key, value: values[key]! };
    })
  };
}

function initialize(
  context: Readonly<GenericEquipmentInitializationContext>
): GenericEquipmentState {
  switch (context.binding.equipmentDefinitionId) {
    case "component.balance.v1":
      return createState(context, {
        currentReadingG: 0,
        tareOffsetG: 0,
        panEquipmentInstanceId: null,
        resolutionG:
          context.binding.measurement?.reportIncrementML ??
          CENTIGRAM_RESOLUTION_G,
        lastReportedG: null
      });
    case "component.weighing_boat.v1":
      return createState(context, {
        emptyMassG: WEIGHING_BOAT_EMPTY_MASS_G,
        onBalance: false,
        collectedPrecipitateMassG: 0
      });
    default:
      fail("Balance initializer received unsupported equipment.");
  }
}

function replaceEquipment(
  equipment: readonly GenericEquipmentState[],
  replacements: readonly GenericEquipmentState[]
): readonly GenericEquipmentState[] {
  const byId = new Map(replacements.map((entry) => [entry.instanceId, entry]));
  return equipment.map((entry) => byId.get(entry.instanceId) ?? entry);
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
    fail(`${key} must be a finite number.`);
  }
  return parameter.value;
}

function solidMassAt(
  context: Readonly<GenericMechanicalContext>,
  equipmentInstanceId: string
): number {
  return context.materialLedger.materials
    .filter(({ unitId }) => unitId === "unit.g.v1")
    .reduce(
      (total, material) =>
        total +
        materialAmountAt(
          context.materialLedger,
          material.materialInstanceId,
          equipmentInstanceId
        ),
      0
    );
}

function quantize(value: number, resolution: number): number {
  return Math.round(value / resolution) * resolution;
}

function grossMassG(
  context: Readonly<GenericMechanicalContext>,
  equipmentInstanceId: string
): number {
  const equipment = context.equipment.find(
    ({ instanceId }) => instanceId === equipmentInstanceId
  );
  if (!equipment) fail(`Unknown pan equipment ${equipmentInstanceId}.`);
  const emptyMass =
    equipment.equipmentDefinitionId === "component.weighing_boat.v1"
      ? numericStateField(equipment, "emptyMassG")
      : 0;
  const collectedPrecipitateMassG =
    equipment.equipmentDefinitionId === "component.weighing_boat.v1"
      ? numericStateField(equipment, "collectedPrecipitateMassG")
      : 0;
  return (
    emptyMass +
    collectedPrecipitateMassG +
    solidMassAt(context, equipmentInstanceId)
  );
}

function observableNumber(
  context: Readonly<GenericMechanicalContext>,
  observableId: string
): number {
  const observable = context.chemistry?.observables.find(
    (candidate) => candidate.observableId === observableId
  );
  if (
    !observable ||
    typeof observable.value !== "number" ||
    !Number.isFinite(observable.value)
  ) {
    fail(`Required chemistry measurement ${observableId} is unavailable.`);
  }
  return observable.value;
}

function displayedMassG(
  context: Readonly<GenericMechanicalContext>,
  balance: Readonly<GenericEquipmentState>,
  grossAdjustmentG = 0
): number {
  const panId = stateField(balance, "panEquipmentInstanceId");
  const gross = typeof panId === "string" ? grossMassG(context, panId) : 0;
  return quantize(
    gross + grossAdjustmentG - numericStateField(balance, "tareOffsetG"),
    numericStateField(balance, "resolutionG")
  );
}

function event(
  type: string,
  observation: Record<string, number | string | boolean>
) {
  return { type, tSim: 0, observation, flags: [], evidence: [] };
}

function place(
  context: Readonly<GenericMechanicalContext>
): GenericMechanicalTransition {
  const boat = context.source;
  const balance = context.targets[0];
  if (
    !boat ||
    !balance ||
    context.targets.length !== 1 ||
    boat.equipmentDefinitionId !== "component.weighing_boat.v1" ||
    balance.equipmentDefinitionId !== "component.balance.v1"
  ) {
    fail("Place on balance requires one weighing boat and one balance.");
  }
  if (stateField(balance, "panEquipmentInstanceId") !== null) {
    fail("Remove the current item before placing another on the balance.");
  }
  const placedBalance = withStateFields(balance, {
    panEquipmentInstanceId: boat.instanceId
  });
  const nextBalance = withStateFields(placedBalance, {
    currentReadingG: displayedMassG(context, placedBalance)
  });
  return {
    equipment: replaceEquipment(context.equipment, [
      nextBalance,
      withStateFields(boat, { onBalance: true })
    ]),
    materialAction: null,
    events: [
      event("place_on_balance", { equipmentInstanceId: boat.instanceId })
    ]
  };
}

function tare(
  context: Readonly<GenericMechanicalContext>
): GenericMechanicalTransition {
  const balance = context.source;
  if (!balance || balance.equipmentDefinitionId !== "component.balance.v1") {
    fail("Tare requires a balance as the sole actor.");
  }
  const panId = stateField(balance, "panEquipmentInstanceId");
  const gross = typeof panId === "string" ? grossMassG(context, panId) : 0;
  return {
    equipment: replaceEquipment(context.equipment, [
      withStateFields(balance, { tareOffsetG: gross, currentReadingG: 0 })
    ]),
    materialAction: null,
    events: [event("tare_balance", { tareOffsetG: gross })]
  };
}

function remove(
  context: Readonly<GenericMechanicalContext>
): GenericMechanicalTransition {
  const balance = context.source;
  if (!balance || balance.equipmentDefinitionId !== "component.balance.v1") {
    fail("Remove from balance requires a balance as the sole actor.");
  }
  const panId = stateField(balance, "panEquipmentInstanceId");
  if (typeof panId !== "string") fail("The balance pan is already empty.");
  const boat = context.equipment.find(({ instanceId }) => instanceId === panId);
  if (!boat) fail("The balance pan references unknown equipment.");
  const emptyBalance = withStateFields(balance, {
    panEquipmentInstanceId: null
  });
  return {
    equipment: replaceEquipment(context.equipment, [
      withStateFields(emptyBalance, {
        currentReadingG: displayedMassG(context, emptyBalance)
      }),
      withStateFields(boat, { onBalance: false })
    ]),
    materialAction: null,
    events: [event("remove_from_balance", { equipmentInstanceId: panId })]
  };
}

function exactSolid(
  context: Readonly<GenericMechanicalContext>,
  sourceId: string
): MaterialLedgerMaterial {
  const matches = context.materialLedger.materials.filter(
    (material) =>
      material.unitId === "unit.g.v1" &&
      materialAmountAt(
        context.materialLedger,
        material.materialInstanceId,
        sourceId
      ) > 0
  );
  if (matches.length !== 1)
    fail("Solid transfer requires one exact solid at the source.");
  return matches[0]!;
}

function transferSolid(
  context: Readonly<GenericMechanicalContext>
): GenericMechanicalTransition {
  const source = context.source;
  const target = context.targets[0];
  if (!source || !target || context.targets.length !== 1) {
    fail("Solid transfer requires one source and one target.");
  }
  const massG = numberParameter(context.action.parameters, "massG");
  if (massG <= 0) fail("massG must be positive.");
  const material = exactSolid(context, source.instanceId);
  const transfer = createMaterialTransfer(context.materialLedger, {
    materialInstanceId: material.materialInstanceId,
    sourceEquipmentInstanceId: source.instanceId,
    targetEquipmentInstanceId: target.instanceId,
    amount: massG,
    unitId: "unit.g.v1"
  });
  const balance = context.equipment.find(
    (candidate) => candidate.equipmentDefinitionId === "component.balance.v1"
  );
  const replacements: GenericEquipmentState[] = [];
  if (balance) {
    const panId = stateField(balance, "panEquipmentInstanceId");
    const adjustment =
      panId === target.instanceId
        ? massG
        : panId === source.instanceId
          ? -massG
          : 0;
    if (adjustment !== 0) {
      replacements.push(
        withStateFields(balance, {
          currentReadingG: displayedMassG(context, balance, adjustment)
        })
      );
    }
  }
  if (target.equipmentDefinitionId === "component.calorimeter.v1") {
    replacements.push(withStateFields(target, { mixed: false }));
  }
  return {
    equipment: replaceEquipment(context.equipment, replacements),
    materialAction: {
      actionId: context.action.actionId,
      sourceEquipmentInstanceId: source.instanceId,
      targetEquipmentInstanceIds: [target.instanceId],
      materialInstanceIds: [material.materialInstanceId],
      transfers: [transfer]
    },
    events: [
      event("transfer_solid", {
        massG,
        sourceEquipmentInstanceId: source.instanceId,
        targetEquipmentInstanceId: target.instanceId
      })
    ]
  };
}

/**
 * The chemistry model owns precipitation and dry mass. This apparatus action
 * represents filtration, washing, and complete drying as one bounded school-
 * lab operation, then places that engine-owned mass in the weighing vessel.
 * It reads a registered observable and never recomputes Ksp or stoichiometry.
 */
function collectPrecipitate(
  context: Readonly<GenericMechanicalContext>
): GenericMechanicalTransition {
  const source = context.source;
  const boat = context.targets[0];
  if (
    !source ||
    !boat ||
    context.targets.length !== 1 ||
    source.equipmentDefinitionId !== "component.beaker.v1" ||
    boat.equipmentDefinitionId !== "component.weighing_boat.v1"
  ) {
    fail("Precipitate collection requires one beaker and one weighing boat.");
  }
  if (stateField(boat, "onBalance") !== false) {
    fail("Remove the weighing boat before collecting the precipitate.");
  }
  if (numericStateField(boat, "collectedPrecipitateMassG") !== 0) {
    fail("The precipitate has already been collected.");
  }
  const massG = observableNumber(context, "observable.precipitate_mass_g.v1");
  if (massG <= 0) fail("No precipitate is available to collect.");
  return {
    equipment: replaceEquipment(context.equipment, [
      withStateFields(boat, { collectedPrecipitateMassG: massG })
    ]),
    materialAction: null,
    events: [
      event("collect_precipitate", {
        massG,
        sourceEquipmentInstanceId: source.instanceId,
        targetEquipmentInstanceId: boat.instanceId
      })
    ]
  };
}

function read(
  context: Readonly<GenericMechanicalContext>
): GenericMechanicalTransition {
  const balance = context.source;
  if (!balance || balance.equipmentDefinitionId !== "component.balance.v1") {
    fail("Read balance requires a balance as the sole actor.");
  }
  const actualG = numericStateField(balance, "currentReadingG");
  const reportedG = numberParameter(context.action.parameters, "reportedG");
  return {
    equipment: replaceEquipment(context.equipment, [
      withStateFields(balance, { lastReportedG: reportedG })
    ]),
    materialAction: null,
    events: [
      event("read_balance", {
        actualG,
        reportedG,
        errorG: reportedG - actualG,
        tared: numericStateField(balance, "tareOffsetG") !== 0
      })
    ]
  };
}

export const BALANCE_MECHANICAL_ADAPTER: GenericMechanicalAdapterPort =
  Object.freeze({
    adapterId: "mechanical-adapter.balance.v1",
    adapterVersion: "1.0.0",
    supportedEquipmentDefinitionIds: Object.freeze([
      "component.balance.v1",
      "component.weighing_boat.v1",
      "component.reagent_bottle.v1",
      "component.calorimeter.v1",
      "component.beaker.v1"
    ]),
    supportedActionIds: Object.freeze([
      "action.tare_balance.v1",
      "action.place_on_balance.v1",
      "action.remove_from_balance.v1",
      "action.transfer_solid.v1",
      "action.collect_precipitate.v1",
      "action.read_balance.v1"
    ]),
    supportedPreconditionIds: Object.freeze([]),
    initializeEquipment: initialize,
    checkPreconditions: () => OK,
    apply(context: Readonly<GenericMechanicalContext>) {
      switch (context.action.actionId) {
        case "action.tare_balance.v1":
          return tare(context);
        case "action.place_on_balance.v1":
          return place(context);
        case "action.remove_from_balance.v1":
          return remove(context);
        case "action.transfer_solid.v1":
          return transferSolid(context);
        case "action.collect_precipitate.v1":
          return collectPrecipitate(context);
        case "action.read_balance.v1":
          return read(context);
        default:
          fail(`Balance adapter cannot apply ${context.action.actionId}.`);
      }
    }
  });

export { CENTIGRAM_RESOLUTION_G, WEIGHING_BOAT_EMPTY_MASS_G };
