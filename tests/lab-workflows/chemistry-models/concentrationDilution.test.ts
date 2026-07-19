import { describe, expect, it } from "vitest";

import {
  CONCENTRATION_DILUTION_ERROR_CODES,
  CONCENTRATION_DILUTION_MODULE,
  CONCENTRATION_DILUTION_OBSERVABLE_IDS,
  PRODUCTION_GENERIC_CHEMISTRY_MODEL_REGISTRATIONS
} from "../../../src/lab-workflows/chemistry-models/concentration-dilution";
import {
  applyExecutedMaterialAction,
  createMaterialTransfer,
  initializeMaterialLedger,
  type ExecutedMaterialAction,
  type MaterialLedger
} from "../../../src/lab-workflows/chemistry-models/material-ledger";
import { createChemistryModelCoordinator } from "../../../src/lab-workflows/chemistry-models/coordinator";
import { componentRegistry } from "../../../src/lab-workflows/registries/components";
import { configurationRegistry } from "../../../src/lab-workflows/registries/configurations";
import { resolveChemistryModelProviders } from "../../../src/lab-workflows/registries/chemistry-models";
import {
  materialRegistry,
  type ReagentRegistryId
} from "../../../src/lab-workflows/registries/reagents";
import {
  compileGenericLabProgram,
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  type CompiledEquipmentBinding,
  type CompiledGenericLabProgram,
  type CompiledMaterialBinding,
  type GenericEquipmentState,
  type GenericStateField
} from "../../../src/lab-workflows/runtime/generic";
import {
  createTestGenericPorts,
  validatedMechanicalWorkflow
} from "../runtime/generic/fixtures";

const STOCK = "stock_bottle";
const WATER = "wash_bottle";
const PIPETTE = "transfer_pipette";
const FLASK = "volumetric_flask";
const STOCK_MATERIAL = "stock_solution";
const WATER_MATERIAL = "distilled_water";

const CAPACITIES = [
  { equipmentInstanceId: STOCK, capacityML: null },
  { equipmentInstanceId: WATER, capacityML: 250 },
  { equipmentInstanceId: PIPETTE, capacityML: 10 },
  { equipmentInstanceId: FLASK, capacityML: 100 }
] as const;

function equipmentBinding(
  instanceId: string,
  equipmentDefinitionId:
    | "component.reagent_bottle.v1"
    | "component.volumetric_pipette.v1"
    | "component.volumetric_flask.v1"
    | "component.wash_bottle.v1"
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

function materialBinding(
  instanceId: string,
  materialProfileId: ReagentRegistryId,
  containerInstanceId: string,
  quantityPresetId: string,
  initialConcentrationM = materialRegistry.get(materialProfileId).concentrationM
): CompiledMaterialBinding {
  const profile = materialRegistry.get(materialProfileId);
  const quantity = configurationRegistry.get(quantityPresetId);
  if (quantity.category !== "quantity_preset")
    throw new Error("Expected a quantity preset");
  return {
    instanceId,
    materialProfileId,
    containerInstanceId,
    quantityPresetId,
    materialVersion: profile.version,
    materialPhase: profile.phase,
    initialConcentrationM,
    initializationPresetSchemaId: profile.initializationPresetSchemaId,
    providedChemistryCapabilityIds: [...profile.providedChemistryCapabilityIds],
    requiredContainerCapabilityIds: [
      ...profile.compatibleContainerCapabilityIds
    ],
    quantityAmount: quantity.amount,
    quantityUnitId: quantity.unitId
  };
}

function setup(
  stockProfileId: ReagentRegistryId = "reagent.sodium_chloride_1_000m.v1",
  authoredConcentrationM?: number
) {
  const equipmentBindings = [
    equipmentBinding(STOCK, "component.reagent_bottle.v1"),
    equipmentBinding(WATER, "component.wash_bottle.v1"),
    equipmentBinding(PIPETTE, "component.volumetric_pipette.v1"),
    equipmentBinding(FLASK, "component.volumetric_flask.v1")
  ];
  const materialBindings = [
    materialBinding(
      STOCK_MATERIAL,
      stockProfileId,
      STOCK,
      stockProfileId === "reagent.sodium_chloride_1_000m.v1"
        ? "quantity-preset.sodium_chloride_1_000m_50ml.v1"
        : stockProfileId === "reagent.sodium_chloride_aqueous.v1"
          ? "quantity-preset.sodium_chloride_solution_50ml.v1"
          : "quantity-preset.hydrochloric_acid_0_100m_25ml.v1",
      authoredConcentrationM
    ),
    materialBinding(
      WATER_MATERIAL,
      "reagent.distilled_water.v1",
      WATER,
      "quantity-preset.distilled_water_250ml.v1"
    )
  ];
  const materialLedger = initializeMaterialLedger(
    materialBindings.map((binding) => ({
      materialInstanceId: binding.instanceId,
      materialProfileId: binding.materialProfileId,
      materialVersion: binding.materialVersion,
      containerInstanceId: binding.containerInstanceId,
      amount: binding.quantityAmount,
      unitId: binding.quantityUnitId
    }))
  );
  const equipment: GenericEquipmentState[] = equipmentBindings.map(
    (binding) => ({
      instanceId: binding.instanceId,
      equipmentDefinitionId: binding.equipmentDefinitionId,
      stateSchemaId: binding.stateSchemaId,
      fields: []
    })
  );
  return { equipmentBindings, materialBindings, materialLedger, equipment };
}

function action(
  ledger: Readonly<MaterialLedger>,
  input: {
    readonly actionId: string;
    readonly materialInstanceId: string;
    readonly sourceEquipmentInstanceId: string;
    readonly targetEquipmentInstanceId: string;
    readonly amount: number;
  }
): ExecutedMaterialAction {
  const transfer = createMaterialTransfer(ledger, {
    materialInstanceId: input.materialInstanceId,
    sourceEquipmentInstanceId: input.sourceEquipmentInstanceId,
    targetEquipmentInstanceId: input.targetEquipmentInstanceId,
    amount: input.amount,
    unitId: "unit.ml.v1"
  });
  return {
    actionId: input.actionId,
    sourceEquipmentInstanceId: input.sourceEquipmentInstanceId,
    targetEquipmentInstanceIds: [input.targetEquipmentInstanceId],
    materialInstanceIds: [input.materialInstanceId],
    transfers: [transfer]
  };
}

function observable(
  state: readonly GenericStateField[],
  observableId: string
): number {
  const match = CONCENTRATION_DILUTION_MODULE.deriveObservables(state).find(
    (candidate) => candidate.observableId === observableId
  );
  if (!match || typeof match.value !== "number")
    throw new Error(`Missing ${observableId}`);
  return match.value;
}

function applySequence(
  finalVolumeML: number,
  waterFirst = false,
  stockProfileId: ReagentRegistryId = "reagent.sodium_chloride_1_000m.v1",
  authoredConcentrationM?: number
) {
  const fixture = setup(stockProfileId, authoredConcentrationM);
  let ledger = fixture.materialLedger;
  let state = CONCENTRATION_DILUTION_MODULE.initialize(fixture);

  const aspirate = action(ledger, {
    actionId: "action.transfer_liquid.v1",
    materialInstanceId: STOCK_MATERIAL,
    sourceEquipmentInstanceId: STOCK,
    targetEquipmentInstanceId: PIPETTE,
    amount: 10
  });
  ledger = applyExecutedMaterialAction(ledger, aspirate, CAPACITIES);
  state = CONCENTRATION_DILUTION_MODULE.applyMaterialAction(
    aspirate,
    state
  ).state;

  const deliverStock = () => {
    const next = action(ledger, {
      actionId: "action.transfer_liquid.v1",
      materialInstanceId: STOCK_MATERIAL,
      sourceEquipmentInstanceId: PIPETTE,
      targetEquipmentInstanceId: FLASK,
      amount: 10
    });
    ledger = applyExecutedMaterialAction(ledger, next, CAPACITIES);
    state = CONCENTRATION_DILUTION_MODULE.applyMaterialAction(
      next,
      state
    ).state;
  };
  const deliverWater = () => {
    const next = action(ledger, {
      actionId: "action.fill_to_mark.v1",
      materialInstanceId: WATER_MATERIAL,
      sourceEquipmentInstanceId: WATER,
      targetEquipmentInstanceId: FLASK,
      amount: finalVolumeML - 10
    });
    ledger = applyExecutedMaterialAction(ledger, next, CAPACITIES);
    state = CONCENTRATION_DILUTION_MODULE.applyMaterialAction(
      next,
      state
    ).state;
  };
  if (waterFirst) {
    deliverWater();
    deliverStock();
  } else {
    deliverStock();
    deliverWater();
  }
  return { fixture, ledger, state };
}

describe("LC2-501 bounded concentration/dilution chemistry", () => {
  it("resolves the verified provider and its three explicit dependencies", () => {
    const resolution = resolveChemistryModelProviders([
      "chemistry.concentration_dilution.v1"
    ]);

    expect(resolution.orderedModelIds).toEqual([
      "chemistry-model.shared_liquid_foundation.v1",
      "chemistry-model.concentration_dilution.v1"
    ]);
    expect(resolution.capabilityProviders).toEqual(
      expect.arrayContaining([
        {
          capabilityId: "chemistry.material_ledger.v1",
          modelId: "chemistry-model.shared_liquid_foundation.v1"
        },
        {
          capabilityId: "chemistry.volume_conservation.v1",
          modelId: "chemistry-model.shared_liquid_foundation.v1"
        },
        {
          capabilityId: "chemistry.solution_mixing.v1",
          modelId: "chemistry-model.shared_liquid_foundation.v1"
        },
        {
          capabilityId: "chemistry.concentration_dilution.v1",
          modelId: "chemistry-model.concentration_dilution.v1"
        }
      ])
    );
  });

  it.each([
    [0.25, 0.025],
    [0.75, 0.075]
  ])(
    "initializes and dilutes teacher-authored %s mol/L stock deterministically",
    (stockConcentrationM, expectedFinalConcentrationM) => {
      const result = applySequence(
        100,
        false,
        "reagent.sodium_chloride_aqueous.v1",
        stockConcentrationM
      );
      expect(
        observable(
          result.state,
          CONCENTRATION_DILUTION_OBSERVABLE_IDS.concentration
        )
      ).toBe(expectedFinalConcentrationM);
      expect(
        observable(result.state, CONCENTRATION_DILUTION_OBSERVABLE_IDS.volume)
      ).toBe(100);
    }
  );

  it("derives the registered 10.00 mL into 100.00 mL preset exactly", () => {
    const { state, ledger } = applySequence(100);

    expect(
      observable(state, CONCENTRATION_DILUTION_OBSERVABLE_IDS.volume)
    ).toBe(100);
    expect(
      observable(state, CONCENTRATION_DILUTION_OBSERVABLE_IDS.concentration)
    ).toBe(0.1);
    expect(
      ledger.materials
        .flatMap(({ locations }) => locations)
        .filter(({ equipmentInstanceId }) => equipmentInstanceId === FLASK)
        .reduce((sum, { amount }) => sum + amount, 0)
    ).toBe(100);
  });

  it("preserves concentration and volume through partial and final fills at exact precision", () => {
    const fixture = setup();
    let ledger = fixture.materialLedger;
    let state = CONCENTRATION_DILUTION_MODULE.initialize(fixture);
    const stockToFlask = action(ledger, {
      actionId: "action.transfer_liquid.v1",
      materialInstanceId: STOCK_MATERIAL,
      sourceEquipmentInstanceId: STOCK,
      targetEquipmentInstanceId: FLASK,
      amount: 10
    });
    ledger = applyExecutedMaterialAction(ledger, stockToFlask, CAPACITIES);
    state = CONCENTRATION_DILUTION_MODULE.applyMaterialAction(
      stockToFlask,
      state
    ).state;
    expect(
      observable(state, CONCENTRATION_DILUTION_OBSERVABLE_IDS.concentration)
    ).toBe(1);

    const partialWater = action(ledger, {
      actionId: "action.fill_to_mark.v1",
      materialInstanceId: WATER_MATERIAL,
      sourceEquipmentInstanceId: WATER,
      targetEquipmentInstanceId: FLASK,
      amount: 40
    });
    ledger = applyExecutedMaterialAction(ledger, partialWater, CAPACITIES);
    state = CONCENTRATION_DILUTION_MODULE.applyMaterialAction(
      partialWater,
      state
    ).state;
    expect(
      observable(state, CONCENTRATION_DILUTION_OBSERVABLE_IDS.volume)
    ).toBe(50);
    expect(
      observable(state, CONCENTRATION_DILUTION_OBSERVABLE_IDS.concentration)
    ).toBe(0.2);

    const toleranceEdge = applySequence(99.92);
    expect(
      observable(
        toleranceEdge.state,
        CONCENTRATION_DILUTION_OBSERVABLE_IDS.concentration
      )
    ).toBe(0.10008);
  });

  it("is replay-stable and order-independent for valid conserved transfers", () => {
    const canonical = applySequence(100, false);
    const reordered = applySequence(100, true);
    const repeated = applySequence(100, false);

    expect(reordered.state).toEqual(canonical.state);
    expect(reordered.ledger).toEqual(canonical.ledger);
    expect(repeated).toEqual(canonical);
  });

  it("rejects unsupported identities and tampered transition identity", () => {
    expect(() =>
      CONCENTRATION_DILUTION_MODULE.initialize(
        setup("reagent.hydrochloric_acid_0_100m.v1")
      )
    ).toThrowError(
      expect.objectContaining({
        code: CONCENTRATION_DILUTION_ERROR_CODES.unsupportedMaterial
      })
    );

    const fixture = setup();
    const state = CONCENTRATION_DILUTION_MODULE.initialize(fixture);
    const valid = action(fixture.materialLedger, {
      actionId: "action.transfer_liquid.v1",
      materialInstanceId: STOCK_MATERIAL,
      sourceEquipmentInstanceId: STOCK,
      targetEquipmentInstanceId: PIPETTE,
      amount: 10
    });
    const tampered = {
      ...valid,
      transfers: valid.transfers.map((transfer) => ({
        ...transfer,
        materialProfileId: "reagent.phenolphthalein.v1"
      }))
    };
    expect(() =>
      CONCENTRATION_DILUTION_MODULE.applyMaterialAction(tampered, state)
    ).toThrowError(
      expect.objectContaining({
        code: CONCENTRATION_DILUTION_ERROR_CODES.unsupportedMaterial
      })
    );
  });

  it("executes through the unchanged generic coordinator contract", () => {
    const fixture = setup();
    const base = compileGenericLabProgram(
      validatedMechanicalWorkflow(),
      createTestGenericPorts()
    ).program;
    const resolution = resolveChemistryModelProviders([
      "chemistry.concentration_dilution.v1"
    ]);
    const program: CompiledGenericLabProgram = {
      ...base,
      schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
      equipment: fixture.equipmentBindings,
      materials: fixture.materialBindings,
      chemistryModels: resolution.orderedModels.map((model) => ({
        modelId: model.id,
        modelVersion: model.version,
        providedCapabilityIds: [...model.providedCapabilityIds],
        requiredCapabilityIds: [...model.requiredCapabilityIds]
      })),
      registeredObservableIds: [
        CONCENTRATION_DILUTION_OBSERVABLE_IDS.concentration,
        CONCENTRATION_DILUTION_OBSERVABLE_IDS.volume
      ],
      registeredUnitIds: ["unit.ml.v1", "unit.mol_per_l.v1"]
    };
    const coordinator = createChemistryModelCoordinator({
      registrations: PRODUCTION_GENERIC_CHEMISTRY_MODEL_REGISTRATIONS
    });
    const initial = coordinator.initialize({
      program,
      equipment: fixture.equipment,
      materialLedger: fixture.materialLedger
    });
    expect(initial.observables).toEqual([
      {
        observableId: CONCENTRATION_DILUTION_OBSERVABLE_IDS.concentration,
        value: 0,
        unitId: "unit.mol_per_l.v1"
      },
      {
        observableId: CONCENTRATION_DILUTION_OBSERVABLE_IDS.volume,
        value: 0,
        unitId: "unit.ml.v1"
      }
    ]);

    const transfer = action(fixture.materialLedger, {
      actionId: "action.transfer_liquid.v1",
      materialInstanceId: STOCK_MATERIAL,
      sourceEquipmentInstanceId: STOCK,
      targetEquipmentInstanceId: FLASK,
      amount: 10
    });
    const nextLedger = applyExecutedMaterialAction(
      fixture.materialLedger,
      transfer,
      CAPACITIES
    );
    const next = coordinator.transition({
      program,
      previous: initial,
      equipment: fixture.equipment,
      materialLedger: nextLedger,
      materialAction: transfer
    });
    expect(next.groundTruth.values).toEqual({
      [CONCENTRATION_DILUTION_OBSERVABLE_IDS.concentration]: 1,
      [CONCENTRATION_DILUTION_OBSERVABLE_IDS.volume]: 10
    });
  });
});
