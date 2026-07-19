import { describe, expect, it } from "vitest";

import {
  applyExecutedMaterialAction,
  initializeMaterialLedger,
  materialAmountAt
} from "../../../src/lab-workflows/chemistry-models/material-ledger";
import {
  LIQUID_MECHANICS_ERROR_CODES,
  VOLUMETRIC_FLASK_MECHANICAL_ADAPTER,
  VOLUMETRIC_PIPETTE_MECHANICAL_ADAPTER,
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

const STOCK = "stock";
const WATER = "water";
const PIPETTE = "pipette";
const FLASK = "flask";

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
  { equipmentInstanceId: STOCK, capacityML: null },
  { equipmentInstanceId: WATER, capacityML: 250 },
  { equipmentInstanceId: PIPETTE, capacityML: 10 },
  { equipmentInstanceId: FLASK, capacityML: 100 }
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
      materialInstanceId: "material.stock",
      materialProfileId: "reagent.sodium_chloride_1_000m.v1",
      materialVersion: "1.0.0",
      containerInstanceId: STOCK,
      amount: 50,
      unitId: "unit.ml.v1"
    },
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
    binding(STOCK, "component.reagent_bottle.v1"),
    binding(WATER, "component.wash_bottle.v1"),
    binding(PIPETTE, "component.volumetric_pipette.v1"),
    binding(FLASK, "component.volumetric_flask.v1")
  ].map((entry) =>
    initializeLiquidEquipmentState({ binding: entry, materialLedger: ledger })
  );
  return { ledger, equipment };
}

describe("LC2-500 reusable dilution mechanics", () => {
  it("conditions, transfers, fills to the mark, and mixes without calculating chemistry", () => {
    let { ledger, equipment } = setup();

    const rinseAction = normalized(
      "action.rinse_transfer_device.v1",
      STOCK,
      [PIPETTE],
      []
    );
    const rinseContext = context(rinseAction, equipment, ledger);
    expect(
      VOLUMETRIC_PIPETTE_MECHANICAL_ADAPTER.checkPreconditions(rinseContext)
    ).toEqual({ ok: true });
    const rinsed = VOLUMETRIC_PIPETTE_MECHANICAL_ADAPTER.apply(rinseContext);
    equipment = [...rinsed.equipment];
    expect(
      stateField(
        equipment.find(({ instanceId }) => instanceId === PIPETTE)!,
        "conditionedMaterialProfileId"
      )
    ).toBe("reagent.sodium_chloride_1_000m.v1");
    expect(rinsed.materialAction).toBeNull();

    const aspirateAction = normalized(
      "action.transfer_liquid.v1",
      STOCK,
      [PIPETTE],
      [{ key: "volumeML", valueType: "number", value: 10 }]
    );
    const aspirated = VOLUMETRIC_PIPETTE_MECHANICAL_ADAPTER.apply(
      context(aspirateAction, equipment, ledger)
    );
    ledger = apply(ledger, aspirated);
    equipment = [...aspirated.equipment];
    expect(materialAmountAt(ledger, "material.stock", PIPETTE)).toBe(10);
    expect(
      stateField(
        equipment.find(({ instanceId }) => instanceId === PIPETTE)!,
        "availableML"
      )
    ).toBe(10);

    const deliverAction = normalized(
      "action.transfer_liquid.v1",
      PIPETTE,
      [FLASK],
      [{ key: "volumeML", valueType: "number", value: 10 }]
    );
    const delivered = VOLUMETRIC_PIPETTE_MECHANICAL_ADAPTER.apply(
      context(deliverAction, equipment, ledger)
    );
    ledger = apply(ledger, delivered);
    equipment = [...delivered.equipment];
    expect(materialAmountAt(ledger, "material.stock", FLASK)).toBe(10);

    const fillAction = normalized(
      "action.fill_to_mark.v1",
      WATER,
      [FLASK],
      [{ key: "finalVolumeML", valueType: "number", value: 100 }]
    );
    const filled = VOLUMETRIC_FLASK_MECHANICAL_ADAPTER.apply(
      context(fillAction, equipment, ledger)
    );
    ledger = apply(ledger, filled);
    equipment = [...filled.equipment];
    const flask = equipment.find(({ instanceId }) => instanceId === FLASK)!;
    expect(stateField(flask, "totalVolumeML")).toBe(100);
    expect(stateField(flask, "withinMarkTolerance")).toBe(true);
    expect(materialAmountAt(ledger, "material.water", FLASK)).toBe(90);

    const mixAction = normalized(
      "action.mix_solution.v1",
      FLASK,
      [],
      [{ key: "inversions", valueType: "number", value: 10 }]
    );
    const mixed = VOLUMETRIC_FLASK_MECHANICAL_ADAPTER.apply(
      context(mixAction, equipment, ledger)
    );
    const mixedFlask = mixed.equipment.find(
      ({ instanceId }) => instanceId === FLASK
    )!;
    expect(stateField(mixedFlask, "mixed")).toBe(true);
    expect(stateField(mixedFlask, "mixCount")).toBe(10);
    expect(mixed.events.map(({ type }) => type)).toEqual(["mix_solution"]);
    expect(
      ledger.materials.find(
        ({ materialInstanceId }) => materialInstanceId === "material.stock"
      )?.initialAmount
    ).toBe(50);
    expect(
      ledger.materials.find(
        ({ materialInstanceId }) => materialInstanceId === "material.water"
      )?.initialAmount
    ).toBe(250);
  });

  it("rejects over-capacity, unavailable, incompatible, and out-of-mark transfers without mutation", () => {
    const { ledger, equipment } = setup();
    const before = structuredClone({ ledger, equipment });
    const overfill = normalized(
      "action.transfer_liquid.v1",
      STOCK,
      [PIPETTE],
      [{ key: "volumeML", valueType: "number", value: 10.01 }]
    );
    expect(() =>
      VOLUMETRIC_PIPETTE_MECHANICAL_ADAPTER.apply(
        context(overfill, equipment, ledger)
      )
    ).toThrowError(
      expect.objectContaining({
        code: LIQUID_MECHANICS_ERROR_CODES.invalidParameter
      })
    );

    const wrongConnection = normalized(
      "action.transfer_liquid.v1",
      WATER,
      [FLASK],
      [{ key: "volumeML", valueType: "number", value: 1 }]
    );
    expect(() =>
      VOLUMETRIC_PIPETTE_MECHANICAL_ADAPTER.apply(
        context(wrongConnection, equipment, ledger)
      )
    ).toThrowError(
      expect.objectContaining({
        code: LIQUID_MECHANICS_ERROR_CODES.invalidConnection
      })
    );
    expect({ ledger, equipment }).toEqual(before);
  });

  it("applies the exact inclusive calibration tolerance", () => {
    let { ledger, equipment } = setup();
    const aspirated = VOLUMETRIC_PIPETTE_MECHANICAL_ADAPTER.apply(
      context(
        normalized(
          "action.transfer_liquid.v1",
          STOCK,
          [PIPETTE],
          [{ key: "volumeML", valueType: "number", value: 10 }]
        ),
        equipment,
        ledger
      )
    );
    ledger = apply(ledger, aspirated);
    equipment = [...aspirated.equipment];
    const delivered = VOLUMETRIC_PIPETTE_MECHANICAL_ADAPTER.apply(
      context(
        normalized(
          "action.transfer_liquid.v1",
          PIPETTE,
          [FLASK],
          [{ key: "volumeML", valueType: "number", value: 10 }]
        ),
        equipment,
        ledger
      )
    );
    ledger = apply(ledger, delivered);
    equipment = [...delivered.equipment];

    for (const [finalVolumeML, expected] of [
      [99.92, true],
      [99.91, false],
      [100, true]
    ] as const) {
      const transition = VOLUMETRIC_FLASK_MECHANICAL_ADAPTER.apply(
        context(
          normalized(
            "action.fill_to_mark.v1",
            WATER,
            [FLASK],
            [
              {
                key: "finalVolumeML",
                valueType: "number",
                value: finalVolumeML
              }
            ]
          ),
          equipment,
          ledger
        )
      );
      expect(
        stateField(
          transition.equipment.find(({ instanceId }) => instanceId === FLASK)!,
          "withinMarkTolerance"
        )
      ).toBe(expected);
    }
  });
});
