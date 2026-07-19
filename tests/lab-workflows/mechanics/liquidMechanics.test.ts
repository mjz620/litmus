import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  applyExecutedMaterialAction,
  initializeMaterialLedger,
  materialAmountAt,
  type MaterialLedger
} from "../../../src/lab-workflows/chemistry-models/material-ledger";
import {
  LIQUID_MECHANICS_ERROR_CODES as ERROR,
  BURETTE_MECHANICAL_ADAPTER,
  LIQUID_MECHANICAL_ADAPTERS,
  LiquidMechanicsError,
  getLiquidMechanicalAdapter,
  initializeLiquidEquipmentState,
  stateField,
  withStateFields
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
  type CompiledEquipmentBinding,
  type GenericEquipmentState,
  type GenericMechanicalContext,
  type NormalizedLabAction
} from "../../../src/lab-workflows/runtime/generic";

const SOURCE = "liquid_source";
const BURETTE = "burette";
const FLASK = "flask";

function expectMechanicsError(
  run: () => unknown,
  code: LiquidMechanicsError["code"]
): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(LiquidMechanicsError);
    expect(error).toMatchObject({ code });
    return;
  }
  throw new Error(`Expected ${code}`);
}

function equipmentBinding(
  instanceId: string,
  equipmentDefinitionId: ComponentRegistryId
): CompiledEquipmentBinding {
  const definition = componentRegistry.get(equipmentDefinitionId);
  return {
    instanceId,
    equipmentDefinitionId,
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

function initialLedger(
  extra: readonly {
    readonly id: string;
    readonly profileId: string;
    readonly containerId: string;
    readonly amount: number;
  }[] = []
): MaterialLedger {
  return initializeMaterialLedger([
    {
      materialInstanceId: "material.water",
      materialProfileId: "reagent.distilled_water.v1",
      materialVersion: "1.0.0",
      containerInstanceId: SOURCE,
      amount: 50,
      unitId: "unit.ml.v1"
    },
    {
      materialInstanceId: "material.sample",
      materialProfileId: "reagent.hydrochloric_acid_0_100m.v1",
      materialVersion: "1.0.0",
      containerInstanceId: FLASK,
      amount: 25,
      unitId: "unit.ml.v1"
    },
    ...extra.map((entry) => ({
      materialInstanceId: entry.id,
      materialProfileId: entry.profileId,
      materialVersion: "1.0.0",
      containerInstanceId: entry.containerId,
      amount: entry.amount,
      unitId: "unit.ml.v1" as const
    }))
  ]);
}

function initializeEquipment(ledger: MaterialLedger): GenericEquipmentState[] {
  return [
    equipmentBinding(SOURCE, "component.reagent_bottle.v1"),
    equipmentBinding(BURETTE, "component.burette.v1"),
    equipmentBinding(FLASK, "component.erlenmeyer_flask.v1")
  ].map((binding) =>
    initializeLiquidEquipmentState({ binding, materialLedger: ledger })
  );
}

function actionBinding(
  actionId: ActionRegistryId,
  sourceEquipmentInstanceId: string,
  targetEquipmentInstanceIds: readonly string[]
): CompiledActionBinding {
  const definition = actionRegistry.get(actionId);
  return {
    permission: {
      id: `permission.${actionId}`,
      actionId,
      sourceEquipmentInstanceId,
      targetEquipmentInstanceIds: [...targetEquipmentInstanceIds],
      availability: { allSatisfiedRuleIds: [], allUnsatisfiedRuleIds: [] }
    },
    actionVersion: definition.version,
    requiredSourceCapabilityIds: [...definition.requiredSourceCapabilityIds],
    requiredTargetCapabilityIds: [...definition.requiredTargetCapabilityIds],
    parameterSchemaId: definition.parameterSchemaId,
    parameters: actionParameterSchemaRegistry.get(definition.parameterSchemaId)
      .parameters,
    preconditions: definition.preconditionIds.map((id) =>
      equipmentPreconditionRegistry.get(id)
    ),
    mechanicalAdapterId: definition.mechanicalAdapterId,
    emittedEventContractId: definition.emittedEventContractId,
    emittedSemanticEventTypes: []
  };
}

function action(
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
  actionValue: NormalizedLabAction,
  equipment: readonly GenericEquipmentState[],
  materialLedger: MaterialLedger
): GenericMechanicalContext {
  const binding = actionBinding(
    actionValue.actionId as ActionRegistryId,
    actionValue.sourceEquipmentInstanceId!,
    actionValue.targetEquipmentInstanceIds
  );
  return {
    binding,
    action: actionValue,
    source:
      equipment.find(
        ({ instanceId }) => instanceId === actionValue.sourceEquipmentInstanceId
      ) ?? null,
    targets: actionValue.targetEquipmentInstanceIds.map(
      (id) => equipment.find(({ instanceId }) => instanceId === id)!
    ),
    equipment,
    materialLedger,
    preconditions: binding.preconditions
  };
}

function applyLedger(
  ledger: MaterialLedger,
  transition: ReturnType<typeof BURETTE_MECHANICAL_ADAPTER.apply>
): MaterialLedger {
  if (!transition.materialAction) return ledger;
  return applyExecutedMaterialAction(ledger, transition.materialAction, [
    { equipmentInstanceId: SOURCE, capacityML: null },
    { equipmentInstanceId: BURETTE, capacityML: 50 },
    { equipmentInstanceId: FLASK, capacityML: 125 }
  ]);
}

describe("reusable liquid equipment mechanics", () => {
  it("fills and dispenses exact liquid deltas without chemistry or evidence", () => {
    const ledger = initialLedger();
    const equipment = initializeEquipment(ledger);
    const fillAction = action(
      "action.fill.v1",
      SOURCE,
      [BURETTE],
      [{ key: "volumeML", valueType: "number", value: 10 }]
    );
    const fillContext = context(fillAction, equipment, ledger);

    expect(BURETTE_MECHANICAL_ADAPTER.checkPreconditions(fillContext)).toEqual({
      ok: true
    });
    const filled = BURETTE_MECHANICAL_ADAPTER.apply(fillContext);
    const afterFillLedger = applyLedger(ledger, filled);
    const filledBurette = filled.equipment.find(
      ({ instanceId }) => instanceId === BURETTE
    )!;
    expect(stateField(filledBurette, "availableML")).toBe(10);
    expect(stateField(filledBurette, "meniscusReadingML")).toBe(40);
    expect(filled.events).toEqual([]);
    expect(materialAmountAt(afterFillLedger, "material.water", SOURCE)).toBe(
      40
    );
    expect(materialAmountAt(afterFillLedger, "material.water", BURETTE)).toBe(
      10
    );

    const flask = filled.equipment.find(
      ({ instanceId }) => instanceId === FLASK
    )!;
    const indicatorReadyEquipment = filled.equipment.map((state) =>
      state.instanceId === FLASK
        ? withStateFields(flask, { indicatorAdded: true })
        : state
    );
    const dispenseAction = action(
      "action.dispense.v1",
      BURETTE,
      [FLASK],
      [
        { key: "volumeML", valueType: "number", value: 2.5 },
        { key: "durationS", valueType: "number", value: 30 }
      ]
    );
    const dispenseContext = context(
      dispenseAction,
      indicatorReadyEquipment,
      afterFillLedger
    );
    expect(
      BURETTE_MECHANICAL_ADAPTER.checkPreconditions(dispenseContext)
    ).toEqual({
      ok: true
    });
    const dispensed = BURETTE_MECHANICAL_ADAPTER.apply(dispenseContext);
    const afterDispenseLedger = applyLedger(afterFillLedger, dispensed);
    const source = dispensed.equipment.find(
      ({ instanceId }) => instanceId === BURETTE
    )!;
    const target = dispensed.equipment.find(
      ({ instanceId }) => instanceId === FLASK
    )!;

    expect(stateField(source, "availableML")).toBe(7.5);
    expect(stateField(source, "deliveredML")).toBe(2.5);
    expect(stateField(source, "meniscusReadingML")).toBe(42.5);
    expect(stateField(target, "totalVolumeML")).toBe(27.5);
    expect(
      materialAmountAt(afterDispenseLedger, "material.water", BURETTE)
    ).toBe(7.5);
    expect(materialAmountAt(afterDispenseLedger, "material.water", FLASK)).toBe(
      2.5
    );
    expect(
      afterDispenseLedger.materials.find(
        ({ materialInstanceId }) => materialInstanceId === "material.water"
      )?.initialAmount
    ).toBe(50);
  });

  it("keeps the prior state immutable and repeated mechanics deterministic", () => {
    const ledger = initialLedger();
    const equipment = initializeEquipment(ledger);
    const fillAction = action(
      "action.fill.v1",
      SOURCE,
      [BURETTE],
      [{ key: "volumeML", valueType: "number", value: 12.34 }]
    );
    const input = context(fillAction, equipment, ledger);
    const beforeEquipment = structuredClone(equipment);
    const beforeLedger = structuredClone(ledger);

    const first = BURETTE_MECHANICAL_ADAPTER.apply(input);
    const second = BURETTE_MECHANICAL_ADAPTER.apply(input);

    expect(first).toEqual(second);
    expect(equipment).toEqual(beforeEquipment);
    expect(ledger).toEqual(beforeLedger);
  });

  it("records an exact rinse solvent without inventing volume, dilution, flags, or evidence", () => {
    const ledger = initializeMaterialLedger([
      {
        materialInstanceId: "material.base",
        materialProfileId: "reagent.sodium_hydroxide_0_100m.v1",
        materialVersion: "1.0.0",
        containerInstanceId: SOURCE,
        amount: 50,
        unitId: "unit.ml.v1"
      }
    ]);
    const equipment = initializeEquipment(ledger);
    const rinseAction = action(
      "action.rinse.v1",
      SOURCE,
      [BURETTE],
      [{ key: "solvent", valueType: "enum", value: "titrant" }]
    );
    const rinseContext = context(rinseAction, equipment, ledger);

    expect(BURETTE_MECHANICAL_ADAPTER.checkPreconditions(rinseContext)).toEqual(
      {
        ok: true
      }
    );
    const transition = BURETTE_MECHANICAL_ADAPTER.apply(rinseContext);
    const burette = transition.equipment.find(
      ({ instanceId }) => instanceId === BURETTE
    )!;

    expect(stateField(burette, "conditionedWith")).toBe("titrant");
    expect(transition.materialAction).toBeNull();
    expect(transition.events).toEqual([]);
    expect(applyLedger(ledger, transition)).toBe(ledger);

    const waterLedger = initialLedger();
    const waterEquipment = initializeEquipment(waterLedger);
    const waterContext = context(
      action(
        "action.rinse.v1",
        SOURCE,
        [BURETTE],
        [{ key: "solvent", valueType: "enum", value: "water" }]
      ),
      waterEquipment,
      waterLedger
    );
    expect(
      stateField(
        BURETTE_MECHANICAL_ADAPTER.apply(waterContext).equipment.find(
          ({ instanceId }) => instanceId === BURETTE
        )!,
        "conditionedWith"
      )
    ).toBe("water");

    const wrongWater = context(
      action(
        "action.rinse.v1",
        SOURCE,
        [BURETTE],
        [{ key: "solvent", valueType: "enum", value: "water" }]
      ),
      equipment,
      initializeMaterialLedger([
        {
          materialInstanceId: "material.base",
          materialProfileId: "reagent.sodium_hydroxide_0_100m.v1",
          materialVersion: "1.0.0",
          containerInstanceId: SOURCE,
          amount: 50,
          unitId: "unit.ml.v1"
        }
      ])
    );
    expectMechanicsError(
      () => BURETTE_MECHANICAL_ADAPTER.apply(wrongWater),
      ERROR.materialUnavailable
    );
    expectMechanicsError(
      () =>
        BURETTE_MECHANICAL_ADAPTER.apply(
          context(rinseAction, waterEquipment, waterLedger)
        ),
      ERROR.materialUnavailable
    );
  });

  it("reads without mutating the true meniscus or material ledger", () => {
    const ledger = initialLedger();
    const equipment = initializeEquipment(ledger);
    const readContext = context(
      action(
        "action.read_volume.v1",
        BURETTE,
        [],
        [{ key: "reportedML", valueType: "number", value: 49.95 }]
      ),
      equipment,
      ledger
    );
    const transition = BURETTE_MECHANICAL_ADAPTER.apply(readContext);

    expect(transition.equipment).toBe(equipment);
    expect(transition.materialAction).toBeNull();
    expect(transition.events).toEqual([]);
  });

  it("rejects empty, ambiguous, over-capacity, reused-rinse, and incompatible paths", () => {
    const emptyLedger = initializeMaterialLedger([]);
    const equipment = initializeEquipment(initialLedger());
    const fillAction = action(
      "action.fill.v1",
      SOURCE,
      [BURETTE],
      [{ key: "volumeML", valueType: "number", value: 1 }]
    );
    expectMechanicsError(
      () =>
        BURETTE_MECHANICAL_ADAPTER.apply(
          context(fillAction, equipment, emptyLedger)
        ),
      ERROR.materialUnavailable
    );

    const ambiguous = initialLedger([
      {
        id: "material.second",
        profileId: "reagent.sodium_hydroxide_0_100m.v1",
        containerId: SOURCE,
        amount: 1
      }
    ]);
    expectMechanicsError(
      () =>
        BURETTE_MECHANICAL_ADAPTER.apply(
          context(fillAction, equipment, ambiguous)
        ),
      ERROR.materialAmbiguous
    );

    const almostFull = equipment.map((state) =>
      state.instanceId === BURETTE
        ? withStateFields(state, {
            availableML: 49.99,
            meniscusReadingML: 0.01,
            filled: true
          })
        : state
    );
    expect(
      BURETTE_MECHANICAL_ADAPTER.checkPreconditions(
        context(fillAction, almostFull, initialLedger())
      )
    ).toMatchObject({ ok: false });

    const rinseAction = action(
      "action.rinse.v1",
      SOURCE,
      [BURETTE],
      [{ key: "solvent", valueType: "enum", value: "titrant" }]
    );
    expect(
      BURETTE_MECHANICAL_ADAPTER.checkPreconditions(
        context(rinseAction, almostFull, initialLedger())
      )
    ).toMatchObject({ ok: false });

    const incompatible = context(fillAction, equipment, initialLedger());
    expectMechanicsError(
      () =>
        BURETTE_MECHANICAL_ADAPTER.apply({
          ...incompatible,
          source: incompatible.targets[0]!,
          targets: [incompatible.source!]
        }),
      ERROR.invalidConnection
    );
  });

  it("resolves only exact code-owned adapters", () => {
    expect(getLiquidMechanicalAdapter("mechanical-adapter.burette.v1")).toBe(
      BURETTE_MECHANICAL_ADAPTER
    );
    expect(LIQUID_MECHANICAL_ADAPTERS).toHaveLength(7);
    expectMechanicsError(
      () => getLiquidMechanicalAdapter("mechanical-adapter.burette.closest.v1"),
      ERROR.unknownAdapter
    );
  });

  it("contains no family dispatch, chemistry formulas, framework, browser, or network imports", () => {
    const files = [
      "adapters.ts",
      "errors.ts",
      "index.ts",
      "registry.ts",
      "state.ts"
    ];
    for (const file of files) {
      const source = readFileSync(
        new URL(
          `../../../src/lab-workflows/mechanics/${file}`,
          import.meta.url
        ),
        "utf8"
      );
      expect(source).not.toMatch(
        /familyId|compatibleFamily|engine\.titration|computePH|equivalenceVolume|indicatorResponse|\bfetch\b|\bwindow\b|\bdocument\b|from ["'](?:react|three|next|@supabase|openai)/
      );
      expect(source).not.toMatch(/import\s*\(/);
    }
  });
});
