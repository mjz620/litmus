import { describe, expect, it } from "vitest";

import {
  applyExecutedMaterialAction,
  initializeMaterialLedger,
  materialAmountAt
} from "../../../src/lab-workflows/chemistry-models/material-ledger";
import {
  CALORIMETER_MECHANICAL_ADAPTER,
  LIQUID_MECHANICS_ERROR_CODES,
  THERMOMETER_MECHANICAL_ADAPTER,
  initializeLiquidEquipmentState,
  stateField
} from "../../../src/lab-workflows/mechanics";
import {
  actionParameterSchemaRegistry,
  actionRegistry,
  equipmentPreconditionRegistry,
  type ActionRegistryId
} from "../../../src/lab-workflows/registries/actions";
import {
  componentRegistry,
  type ComponentRegistryId
} from "../../../src/lab-workflows/registries/components";
import {
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  type CompiledActionBinding,
  type GenericEquipmentState,
  type GenericMechanicalContext,
  type GenericMechanicalTransition,
  type NormalizedLabAction
} from "../../../src/lab-workflows/runtime/generic";

const WATER = "water";
const CALORIMETER = "calorimeter";
const THERMOMETER = "thermometer";

function binding(instanceId: string, id: ComponentRegistryId) {
  const definition = componentRegistry.get(id);
  return {
    instanceId,
    equipmentDefinitionId: definition.id,
    equipmentVersion: definition.version,
    configurationPresetId: definition.defaultConfigurationPresetId,
    stateSchemaId: definition.stateSchemaId,
    stateFields: definition.stateSchema.fields.map((field) => ({
      key: field.key,
      valueType: field.valueType,
      nullable: field.nullable,
      allowedValues: [...(field.allowedValues ?? [])]
    })),
    capabilityIds: [...definition.capabilityIds],
    measurement: definition.measurement
      ? {
          capacityML: definition.measurement.capacityML,
          reportIncrementML: definition.measurement.reportIncrementML,
          toleranceML: definition.measurement.toleranceML
        }
      : null,
    mechanicalAdapterId: definition.mechanicalAdapterId,
    safetyPolicyIds: [...definition.safetyConstraintIds]
  };
}

function compiledAction(action: NormalizedLabAction): CompiledActionBinding {
  const definition = actionRegistry.get(action.actionId);
  return {
    permission: {
      id: action.permissionId,
      actionId: action.actionId,
      ...(action.sourceEquipmentInstanceId
        ? { sourceEquipmentInstanceId: action.sourceEquipmentInstanceId }
        : {}),
      targetEquipmentInstanceIds: [...action.targetEquipmentInstanceIds],
      availability: { allSatisfiedRuleIds: [], allUnsatisfiedRuleIds: [] }
    },
    actionVersion: definition.version,
    requiredSourceCapabilityIds: definition.requiredSourceCapabilityIds,
    requiredTargetCapabilityIds: definition.requiredTargetCapabilityIds,
    parameterSchemaId: definition.parameterSchemaId,
    parameters: actionParameterSchemaRegistry.get(definition.parameterSchemaId)
      .parameters,
    preconditions: definition.preconditionIds.map((id) =>
      equipmentPreconditionRegistry.get(id)
    ),
    mechanicalAdapterId: definition.mechanicalAdapterId,
    emittedEventContractId: definition.emittedEventContractId,
    emittedSemanticEventTypes: definition.emittedSemanticEventTypes
  };
}

function normalized(
  actionId: ActionRegistryId,
  sourceEquipmentInstanceId: string,
  targetEquipmentInstanceIds: readonly string[],
  parameters: NormalizedLabAction["parameters"]
): NormalizedLabAction {
  return {
    schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
    permissionId: `permission.${actionId}`,
    actionId,
    sourceEquipmentInstanceId,
    targetEquipmentInstanceIds,
    parameters
  };
}

function context(
  action: NormalizedLabAction,
  equipment: readonly GenericEquipmentState[],
  materialLedger: ReturnType<typeof initializeMaterialLedger>
): GenericMechanicalContext {
  const compiled = compiledAction(action);
  return {
    binding: compiled,
    action,
    source:
      equipment.find(
        ({ instanceId }) => instanceId === action.sourceEquipmentInstanceId
      ) ?? null,
    targets: action.targetEquipmentInstanceIds.map(
      (id) => equipment.find(({ instanceId }) => instanceId === id)!
    ),
    equipment,
    materialLedger,
    preconditions: compiled.preconditions
  };
}

const CAPACITIES = [
  { equipmentInstanceId: WATER, capacityML: 250 },
  { equipmentInstanceId: CALORIMETER, capacityML: 100 },
  { equipmentInstanceId: THERMOMETER, capacityML: null }
] as const;

function apply(
  ledger: ReturnType<typeof initializeMaterialLedger>,
  transition: GenericMechanicalTransition
) {
  return transition.materialAction
    ? applyExecutedMaterialAction(ledger, transition.materialAction, CAPACITIES)
    : ledger;
}

function setup() {
  const ledger = initializeMaterialLedger([
    {
      materialInstanceId: "material.water",
      materialProfileId: "reagent.distilled_water.v1",
      materialVersion: "1.0.0",
      containerInstanceId: WATER,
      amount: 250,
      unitId: "unit.ml.v1"
    }
  ]);
  const equipment = [
    binding(WATER, "component.wash_bottle.v1"),
    binding(CALORIMETER, "component.calorimeter.v1"),
    binding(THERMOMETER, "component.thermometer.v1")
  ].map((entry) =>
    entry.equipmentDefinitionId === "component.thermometer.v1"
      ? THERMOMETER_MECHANICAL_ADAPTER.initializeEquipment({
          binding: entry,
          materialLedger: ledger
        })
      : initializeLiquidEquipmentState({
          binding: entry,
          materialLedger: ledger
        })
  );
  return { ledger, equipment };
}

describe("LC2-910 coffee-cup calorimetry mechanics", () => {
  it("pours, seals, mixes, places a probe, and records a temperature reading", () => {
    let { ledger, equipment } = setup();

    const poured = CALORIMETER_MECHANICAL_ADAPTER.apply(
      context(
        normalized(
          "action.pour_liquid.v1",
          WATER,
          [CALORIMETER],
          [{ key: "volumeML", valueType: "number", value: 50 }]
        ),
        equipment,
        ledger
      )
    );
    ledger = apply(ledger, poured);
    equipment = [...poured.equipment];
    expect(materialAmountAt(ledger, "material.water", CALORIMETER)).toBe(50);
    expect(
      stateField(
        equipment.find(({ instanceId }) => instanceId === CALORIMETER)!,
        "totalVolumeML"
      )
    ).toBe(50);

    const sealed = CALORIMETER_MECHANICAL_ADAPTER.apply(
      context(
        normalized("action.set_calorimeter_lid.v1", CALORIMETER, [], [
          { key: "lidState", valueType: "enum", value: "closed" }
        ]),
        equipment,
        ledger
      )
    );
    equipment = [...sealed.equipment];
    expect(
      stateField(
        equipment.find(({ instanceId }) => instanceId === CALORIMETER)!,
        "lidClosed"
      )
    ).toBe(true);

    const mixed = CALORIMETER_MECHANICAL_ADAPTER.apply(
      context(
        normalized("action.mix_calorimeter.v1", CALORIMETER, [], [
          { key: "inversions", valueType: "number", value: 5 }
        ]),
        equipment,
        ledger
      )
    );
    equipment = [...mixed.equipment];
    expect(
      stateField(
        equipment.find(({ instanceId }) => instanceId === CALORIMETER)!,
        "mixed"
      )
    ).toBe(true);

    const placed = THERMOMETER_MECHANICAL_ADAPTER.apply(
      context(
        normalized("action.place_thermometer.v1", THERMOMETER, [CALORIMETER], []),
        equipment,
        ledger
      )
    );
    equipment = [...placed.equipment];
    expect(
      stateField(
        equipment.find(({ instanceId }) => instanceId === THERMOMETER)!,
        "placed"
      )
    ).toBe(true);
    expect(
      stateField(
        equipment.find(({ instanceId }) => instanceId === CALORIMETER)!,
        "probeInserted"
      )
    ).toBe(true);

    const read = THERMOMETER_MECHANICAL_ADAPTER.apply(
      context(
        normalized("action.read_temperature.v1", THERMOMETER, [], [
          { key: "reportedC", valueType: "number", value: 24.5 }
        ]),
        equipment,
        ledger
      )
    );
    equipment = [...read.equipment];
    expect(
      stateField(
        equipment.find(({ instanceId }) => instanceId === THERMOMETER)!,
        "lastReportedC"
      )
    ).toBe(24.5);
  });

  it("fails closed when pouring through a closed lid", () => {
    const { ledger, equipment: initial } = setup();
    const sealed = CALORIMETER_MECHANICAL_ADAPTER.apply(
      context(
        normalized("action.set_calorimeter_lid.v1", CALORIMETER, [], [
          { key: "lidState", valueType: "enum", value: "closed" }
        ]),
        initial,
        ledger
      )
    );
    expect(() =>
      CALORIMETER_MECHANICAL_ADAPTER.apply(
        context(
          normalized(
            "action.pour_liquid.v1",
            WATER,
            [CALORIMETER],
            [{ key: "volumeML", valueType: "number", value: 10 }]
          ),
          sealed.equipment,
          ledger
        )
      )
    ).toThrowError(
      expect.objectContaining({
        code: LIQUID_MECHANICS_ERROR_CODES.invalidEquipment
      })
    );
  });

  it("fails closed when mixing an empty calorimeter", () => {
    const { ledger, equipment } = setup();
    expect(() =>
      CALORIMETER_MECHANICAL_ADAPTER.apply(
        context(
          normalized("action.mix_calorimeter.v1", CALORIMETER, [], [
            { key: "inversions", valueType: "number", value: 3 }
          ]),
          equipment,
          ledger
        )
      )
    ).toThrowError(
      expect.objectContaining({
        code: LIQUID_MECHANICS_ERROR_CODES.invalidEquipment
      })
    );
  });

  it("fails closed when reading temperature before placement", () => {
    const { ledger, equipment } = setup();
    expect(() =>
      THERMOMETER_MECHANICAL_ADAPTER.apply(
        context(
          normalized("action.read_temperature.v1", THERMOMETER, [], [
            { key: "reportedC", valueType: "number", value: 20 }
          ]),
          equipment,
          ledger
        )
      )
    ).toThrowError(
      expect.objectContaining({
        code: LIQUID_MECHANICS_ERROR_CODES.invalidEquipment
      })
    );
  });

  it("fails closed for unsupported pour materials", () => {
    const ledger = initializeMaterialLedger([
      {
        materialInstanceId: "material.acid",
        materialProfileId: "reagent.hydrochloric_acid_0_100m.v1",
        materialVersion: "1.0.0",
        containerInstanceId: WATER,
        amount: 50,
        unitId: "unit.ml.v1"
      }
    ]);
    const equipment = [
      binding(WATER, "component.wash_bottle.v1"),
      binding(CALORIMETER, "component.calorimeter.v1")
    ].map((entry) =>
      initializeLiquidEquipmentState({ binding: entry, materialLedger: ledger })
    );
    expect(() =>
      CALORIMETER_MECHANICAL_ADAPTER.apply(
        context(
          normalized(
            "action.pour_liquid.v1",
            WATER,
            [CALORIMETER],
            [{ key: "volumeML", valueType: "number", value: 10 }]
          ),
          equipment,
          ledger
        )
      )
    ).toThrowError(
      expect.objectContaining({
        code: LIQUID_MECHANICS_ERROR_CODES.materialUnavailable
      })
    );
  });
});
