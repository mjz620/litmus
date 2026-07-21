import { describe, expect, it } from "vitest";

import {
  THERMAL_ENERGY_ERROR_CODES,
  THERMAL_ENERGY_MODULE,
  THERMAL_ENERGY_OBSERVABLE_IDS,
  WATER_SPECIFIC_HEAT_J_PER_G_C
} from "../../../src/lab-workflows/chemistry-models/thermal-energy";
import {
  applyExecutedMaterialAction,
  createMaterialTransfer,
  initializeMaterialLedger,
  type ExecutedMaterialAction,
  type MaterialLedger
} from "../../../src/lab-workflows/chemistry-models/material-ledger";
import { createChemistryModelCoordinator } from "../../../src/lab-workflows/chemistry-models/coordinator";
import { PRODUCTION_GENERIC_CHEMISTRY_MODEL_REGISTRATIONS } from "../../../src/lab-workflows/chemistry-models/concentration-dilution";
import { componentRegistry } from "../../../src/lab-workflows/registries/components";
import { configurationRegistry } from "../../../src/lab-workflows/registries/configurations";
import { resolveChemistryModelProviders } from "../../../src/lab-workflows/registries/chemistry-models";
import {
  materialRegistry,
  type ReagentRegistryId
} from "../../../src/lab-workflows/registries/reagents";
import type {
  CompiledEquipmentBinding,
  CompiledMaterialBinding,
  GenericEquipmentState,
  GenericStateField
} from "../../../src/lab-workflows/runtime/generic";

const COLD = "cold_bottle";
const HOT = "hot_bottle";
const CALORIMETER = "calorimeter";
const COLD_MATERIAL = "cold_water";
const HOT_MATERIAL = "hot_water";

const CAPACITIES = [
  { equipmentInstanceId: COLD, capacityML: 250 },
  { equipmentInstanceId: HOT, capacityML: 250 },
  { equipmentInstanceId: CALORIMETER, capacityML: 100 }
] as const;

function equipmentBinding(
  instanceId: string,
  equipmentDefinitionId:
    | "component.wash_bottle.v1"
    | "component.reagent_bottle.v1"
    | "component.calorimeter.v1"
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
  quantityPresetId: string
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
    initialConcentrationM: profile.concentrationM,
    initialTemperatureC: profile.initialTemperatureC,
    acidBaseDissociation: profile.acidBaseDissociation ?? null,
    molarMassGPerMol: profile.molarMassGPerMol ?? null,
    initializationPresetSchemaId: profile.initializationPresetSchemaId,
    providedChemistryCapabilityIds: [...profile.providedChemistryCapabilityIds],
    requiredContainerCapabilityIds: [
      ...profile.compatibleContainerCapabilityIds
    ],
    quantityAmount: quantity.amount,
    quantityUnitId: quantity.unitId
  };
}

function equipmentState(
  binding: CompiledEquipmentBinding,
  fields: Record<string, GenericStateField["value"]>
): GenericEquipmentState {
  return {
    instanceId: binding.instanceId,
    equipmentDefinitionId: binding.equipmentDefinitionId,
    stateSchemaId: binding.stateSchemaId,
    fields: binding.stateFields.map(({ key }) => ({
      key,
      value: fields[key] ?? null
    }))
  };
}

function setup() {
  const equipmentBindings = [
    equipmentBinding(COLD, "component.wash_bottle.v1"),
    equipmentBinding(HOT, "component.reagent_bottle.v1"),
    equipmentBinding(CALORIMETER, "component.calorimeter.v1")
  ];
  const materialBindings = [
    materialBinding(
      COLD_MATERIAL,
      "reagent.distilled_water_cold_20c.v1",
      COLD,
      "quantity-preset.distilled_water_cold_20c_100ml.v1"
    ),
    materialBinding(
      HOT_MATERIAL,
      "reagent.distilled_water_hot_60c.v1",
      HOT,
      "quantity-preset.distilled_water_hot_60c_100ml.v1"
    )
  ];
  const materialLedger = initializeMaterialLedger([
    {
      materialInstanceId: COLD_MATERIAL,
      materialProfileId: "reagent.distilled_water_cold_20c.v1",
      materialVersion: "1.0.0",
      containerInstanceId: COLD,
      amount: 100,
      unitId: "unit.ml.v1"
    },
    {
      materialInstanceId: HOT_MATERIAL,
      materialProfileId: "reagent.distilled_water_hot_60c.v1",
      materialVersion: "1.0.0",
      containerInstanceId: HOT,
      amount: 100,
      unitId: "unit.ml.v1"
    }
  ]);
  const equipment = [
    equipmentState(equipmentBindings[0]!, {
      reagentInstanceId: COLD_MATERIAL,
      availableML: 100
    }),
    equipmentState(equipmentBindings[1]!, {
      reagentInstanceId: HOT_MATERIAL,
      selected: false
    }),
    equipmentState(equipmentBindings[2]!, {
      capacityML: 100,
      totalVolumeML: 0,
      lidClosed: false,
      probeInserted: false,
      insertedThermometerInstanceId: null,
      mixed: false,
      mixCount: 0
    })
  ];
  return { equipmentBindings, materialBindings, materialLedger, equipment };
}

function pour(
  ledger: MaterialLedger,
  materialInstanceId: string,
  materialProfileId: string,
  source: string,
  amount: number
): { ledger: MaterialLedger; action: ExecutedMaterialAction } {
  const transfer = createMaterialTransfer(ledger, {
    materialInstanceId,
    sourceEquipmentInstanceId: source,
    targetEquipmentInstanceId: CALORIMETER,
    amount,
    unitId: "unit.ml.v1"
  });
  const action: ExecutedMaterialAction = {
    actionId: "action.pour_liquid.v1",
    sourceEquipmentInstanceId: source,
    targetEquipmentInstanceIds: [CALORIMETER],
    materialInstanceIds: [materialInstanceId],
    transfers: [{ ...transfer, materialProfileId }]
  };
  return {
    ledger: applyExecutedMaterialAction(ledger, action, CAPACITIES),
    action
  };
}

describe("LC2-911 thermal energy chemistry module", () => {
  it("resolves as the exclusive verified thermal provider", () => {
    const resolution = resolveChemistryModelProviders([
      "chemistry.thermal_energy.v1"
    ]);
    expect(resolution.orderedModelIds).toEqual([
      "chemistry-model.shared_liquid_foundation.v1",
      "chemistry-model.thermal_energy.v1"
    ]);
    expect(
      PRODUCTION_GENERIC_CHEMISTRY_MODEL_REGISTRATIONS.some(
        ({ metadataId }) => metadataId === "chemistry-model.thermal_energy.v1"
      )
    ).toBe(true);
  });

  it("conserves heat for equal hot and cold water pours (q = mcΔT)", () => {
    const { equipmentBindings, materialBindings, materialLedger, equipment } =
      setup();
    const state = THERMAL_ENERGY_MODULE.initialize({
      equipmentBindings,
      materialBindings,
      equipment,
      materialLedger
    });
    expect(THERMAL_ENERGY_MODULE.deriveObservables(state)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          observableId: THERMAL_ENERGY_OBSERVABLE_IDS.temperature,
          value: 0,
          unitId: "unit.celsius.v1"
        }),
        expect.objectContaining({
          observableId: THERMAL_ENERGY_OBSERVABLE_IDS.volume,
          value: 0
        })
      ])
    );

    let ledger = materialLedger;
    const coldPour = pour(
      ledger,
      COLD_MATERIAL,
      "reagent.distilled_water_cold_20c.v1",
      COLD,
      50
    );
    ledger = coldPour.ledger;
    let next = THERMAL_ENERGY_MODULE.applyMaterialAction(
      coldPour.action,
      state
    );
    expect(THERMAL_ENERGY_MODULE.deriveObservables(next.state)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          observableId: THERMAL_ENERGY_OBSERVABLE_IDS.temperature,
          value: 20
        }),
        expect.objectContaining({
          observableId: THERMAL_ENERGY_OBSERVABLE_IDS.volume,
          value: 50
        }),
        expect.objectContaining({
          observableId: THERMAL_ENERGY_OBSERVABLE_IDS.heatContent,
          value: 50 * WATER_SPECIFIC_HEAT_J_PER_G_C * 20 + 15.9 * 20
        })
      ])
    );

    const hotPour = pour(
      ledger,
      HOT_MATERIAL,
      "reagent.distilled_water_hot_60c.v1",
      HOT,
      50
    );
    next = THERMAL_ENERGY_MODULE.applyMaterialAction(
      hotPour.action,
      next.state
    );
    const observables = THERMAL_ENERGY_MODULE.deriveObservables(next.state);
    expect(observables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          observableId: THERMAL_ENERGY_OBSERVABLE_IDS.temperature,
          value: 39.268
        }),
        expect.objectContaining({
          observableId: THERMAL_ENERGY_OBSERVABLE_IDS.volume,
          value: 100
        })
      ])
    );
  });

  it("fails closed without a calorimeter or non-thermal materials", () => {
    const { materialBindings, materialLedger, equipment } = setup();
    expect(() =>
      THERMAL_ENERGY_MODULE.initialize({
        equipmentBindings: [
          equipmentBinding(COLD, "component.wash_bottle.v1"),
          equipmentBinding(HOT, "component.reagent_bottle.v1")
        ],
        materialBindings,
        equipment: equipment.slice(0, 2),
        materialLedger
      })
    ).toThrowError(
      expect.objectContaining({
        code: THERMAL_ENERGY_ERROR_CODES.unsupportedSetup
      })
    );

    const diluted = materialBinding(
      "nacl",
      "reagent.sodium_chloride_1_000m.v1",
      HOT,
      "quantity-preset.sodium_chloride_1_000m_50ml.v1"
    );
    expect(() =>
      THERMAL_ENERGY_MODULE.initialize({
        equipmentBindings: [
          equipmentBinding(CALORIMETER, "component.calorimeter.v1")
        ],
        materialBindings: [diluted],
        equipment: [equipment[2]!],
        materialLedger: initializeMaterialLedger([
          {
            materialInstanceId: "nacl",
            materialProfileId: "reagent.sodium_chloride_1_000m.v1",
            materialVersion: "1.0.0",
            containerInstanceId: HOT,
            amount: 50,
            unitId: "unit.ml.v1"
          }
        ])
      })
    ).toThrowError(
      expect.objectContaining({
        code: THERMAL_ENERGY_ERROR_CODES.unsupportedMaterial
      })
    );
  });

  it("coordinates through the production chemistry ports", () => {
    const { equipmentBindings, materialBindings, materialLedger, equipment } =
      setup();
    const resolution = resolveChemistryModelProviders([
      "chemistry.thermal_energy.v1"
    ]);
    const coordinator = createChemistryModelCoordinator({
      registrations: PRODUCTION_GENERIC_CHEMISTRY_MODEL_REGISTRATIONS
    });
    const initialized = coordinator.initialize({
      program: {
        chemistryModels: resolution.orderedModels.map((model) => ({
          modelId: model.id,
          modelVersion: model.version,
          providedCapabilityIds: [...model.providedCapabilityIds],
          requiredCapabilityIds: [...model.requiredCapabilityIds]
        })),
        equipment: equipmentBindings,
        materials: materialBindings,
        registeredObservableIds: Object.values(THERMAL_ENERGY_OBSERVABLE_IDS),
        registeredUnitIds: [
          "unit.celsius.v1",
          "unit.joule.v1",
          "unit.ml.v1",
          "unit.mol.v1",
          "unit.kj_per_mol.v1"
        ]
      } as never,
      equipment,
      materialLedger
    });
    expect(initialized.observables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          observableId: THERMAL_ENERGY_OBSERVABLE_IDS.temperature,
          value: 0
        })
      ])
    );
  });
});
