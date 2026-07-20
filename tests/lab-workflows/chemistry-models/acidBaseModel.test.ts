import { describe, expect, it } from "vitest";

import type { SemanticEvent } from "../../../src/experiments/shared";
import {
  computePH as legacyComputePH,
  equivalenceVolumeML as legacyEquivalenceVolumeML,
  INDICATOR_SPECIFICATIONS as LEGACY_INDICATOR_SPECIFICATIONS,
  observedColor as legacyObservedColor
} from "../../../src/experiments/titration/titration";
import {
  ACID_BASE_TITRATION_ERROR_CODES,
  ACID_BASE_TITRATION_MODEL_ID,
  ACID_BASE_TITRATION_MODULE,
  ACID_BASE_TITRATION_OBSERVABLE_IDS,
  FAST_RATE_ML_PER_S,
  INDICATOR_SPECIFICATIONS,
  NEAR_ENDPOINT_ML,
  OVERSHOOT_TOLERANCE_ML,
  WATER_RINSE_DILUTION,
  computePH,
  equivalenceVolumeML,
  observedColor,
  type AcidBaseTitrationChemistryConfig
} from "../../../src/lab-workflows/chemistry-models/acid-base";
import { PRODUCTION_GENERIC_CHEMISTRY_MODEL_REGISTRATIONS } from "../../../src/lab-workflows/chemistry-models/concentration-dilution";
import {
  CHEMISTRY_MODEL_COORDINATOR_ERROR_CODES as COORDINATOR_ERROR,
  createChemistryModelCoordinator,
  type GenericChemistryActionContext,
  type GenericChemistryModuleRegistration
} from "../../../src/lab-workflows/chemistry-models/coordinator";
import {
  initializeMaterialLedger,
  type ExecutedMaterialAction,
  type MaterialLedger
} from "../../../src/lab-workflows/chemistry-models/material-ledger";
import {
  CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES,
  resolveChemistryModelProviders
} from "../../../src/lab-workflows/registries/chemistry-models";
import { componentRegistry } from "../../../src/lab-workflows/registries/components";
import { configurationRegistry } from "../../../src/lab-workflows/registries/configurations";
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
  type GenericStateField,
  type NormalizedLabAction
} from "../../../src/lab-workflows/runtime/generic";
import {
  createTestGenericPorts,
  validatedMechanicalWorkflow
} from "../runtime/generic/fixtures";

const BURETTE = "titrant_burette";
const FLASK = "analyte_flask";
const INDICATOR_BOTTLE = "indicator_source";
const TITRANT_BOTTLE = "titrant_bottle";
const ANALYTE = "analyte";
const TITRANT = "titrant";
const INDICATOR = "indicator";

const STRONG: AcidBaseTitrationChemistryConfig = {
  analyte: { type: "strong_acid", concentrationM: 0.1, volumeML: 25 },
  titrant: { concentrationM: 0.1 }
};
const WEAK: AcidBaseTitrationChemistryConfig = {
  analyte: { type: "weak_acid", concentrationM: 0.1, volumeML: 25, pKa: 4.76 },
  titrant: { concentrationM: 0.1 }
};

function equipmentBinding(
  instanceId: string,
  equipmentDefinitionId:
    | "component.burette.v1"
    | "component.erlenmeyer_flask.v1"
    | "component.indicator_bottle.v1"
    | "component.reagent_bottle.v1"
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
    initializationPresetSchemaId: profile.initializationPresetSchemaId,
    providedChemistryCapabilityIds: [...profile.providedChemistryCapabilityIds],
    requiredContainerCapabilityIds: [
      ...profile.compatibleContainerCapabilityIds
    ],
    quantityAmount: quantity.amount,
    quantityUnitId: quantity.unitId
  };
}

function setup() {
  const equipmentBindings = [
    equipmentBinding(BURETTE, "component.burette.v1"),
    equipmentBinding(FLASK, "component.erlenmeyer_flask.v1"),
    equipmentBinding(INDICATOR_BOTTLE, "component.indicator_bottle.v1"),
    equipmentBinding(TITRANT_BOTTLE, "component.reagent_bottle.v1")
  ];
  const materialBindings = [
    materialBinding(
      ANALYTE,
      "reagent.hydrochloric_acid_0_100m.v1",
      FLASK,
      "quantity-preset.hydrochloric_acid_0_100m_25ml.v1"
    ),
    materialBinding(
      TITRANT,
      "reagent.sodium_hydroxide_0_100m.v1",
      TITRANT_BOTTLE,
      "quantity-preset.sodium_hydroxide_0_100m_50ml.v1"
    ),
    materialBinding(
      INDICATOR,
      "reagent.phenolphthalein.v1",
      INDICATOR_BOTTLE,
      "quantity-preset.phenolphthalein_2_drops.v1"
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

function normalizedAction(
  actionId: string,
  parameters: NormalizedLabAction["parameters"],
  sourceEquipmentInstanceId = BURETTE,
  targetEquipmentInstanceIds: readonly string[] = []
): NormalizedLabAction {
  return {
    schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
    permissionId: `permission.${actionId}`,
    actionId,
    sourceEquipmentInstanceId,
    targetEquipmentInstanceIds: [...targetEquipmentInstanceIds],
    parameters
  };
}

const rinseAction = (solvent: "water" | "titrant") =>
  normalizedAction(
    "action.rinse.v1",
    [{ key: "solvent", valueType: "enum", value: solvent }],
    TITRANT_BOTTLE,
    [BURETTE]
  );
const fillAction = (volumeML: number) =>
  normalizedAction(
    "action.fill.v1",
    [{ key: "volumeML", valueType: "number", value: volumeML }],
    TITRANT_BOTTLE,
    [BURETTE]
  );
const dispenseAction = (volumeML: number, durationS: number) =>
  normalizedAction(
    "action.dispense.v1",
    [
      { key: "volumeML", valueType: "number", value: volumeML },
      { key: "durationS", valueType: "number", value: durationS }
    ],
    BURETTE,
    [FLASK]
  );
const readAction = (reportedML: number) =>
  normalizedAction("action.read_volume.v1", [
    { key: "reportedML", valueType: "number", value: reportedML }
  ]);
const indicatorAction = (indicator: string) =>
  normalizedAction(
    "action.add_indicator.v1",
    [{ key: "indicator", valueType: "enum", value: indicator }],
    INDICATOR_BOTTLE,
    [FLASK]
  );

function dispenseMaterialAction(amount: number): ExecutedMaterialAction {
  return {
    actionId: "action.dispense.v1",
    sourceEquipmentInstanceId: BURETTE,
    targetEquipmentInstanceIds: [FLASK],
    materialInstanceIds: [TITRANT],
    transfers: [
      {
        kind: "transfer",
        materialInstanceId: TITRANT,
        materialProfileId: "reagent.sodium_hydroxide_0_100m.v1",
        unitId: "unit.ml.v1",
        sourceEquipmentInstanceId: BURETTE,
        targetEquipmentInstanceId: FLASK,
        amount,
        sourceAmountBefore: 50,
        sourceAmountAfter: 50 - amount,
        targetAmountBefore: 0,
        targetAmountAfter: amount
      }
    ]
  };
}

function buretteEquipment(
  availableML: number,
  meniscusReadingML: number
): GenericEquipmentState {
  return {
    instanceId: BURETTE,
    equipmentDefinitionId: "component.burette.v1",
    stateSchemaId: "schema.component_state.burette.v1",
    fields: [
      { key: "availableML", value: availableML },
      { key: "meniscusReadingML", value: meniscusReadingML },
      { key: "capacityML", value: 50 }
    ]
  };
}

function actionContext(
  ledger: Readonly<MaterialLedger>,
  action: NormalizedLabAction,
  options: {
    readonly materialAction?: ExecutedMaterialAction | null;
    readonly equipment?: readonly GenericEquipmentState[];
  } = {}
): GenericChemistryActionContext {
  return {
    action,
    materialAction: options.materialAction ?? null,
    equipment: options.equipment ?? [],
    materialLedger: ledger
  };
}

function fieldValue(
  state: readonly GenericStateField[],
  key: string
): GenericStateField["value"] {
  const match = state.find((candidate) => candidate.key === key);
  if (!match) throw new Error(`Missing state field ${key}`);
  return match.value;
}

function blankEvent(type: string): SemanticEvent {
  return { type, tSim: 0, observation: {}, flags: [], evidence: [] };
}

/** Initialize and run a sequence of chemistry action transitions. */
function stateAfter(
  fixture: ReturnType<typeof setup>,
  steps: readonly {
    readonly action: NormalizedLabAction;
    readonly materialAction?: ExecutedMaterialAction | null;
  }[]
): readonly GenericStateField[] {
  let state = ACID_BASE_TITRATION_MODULE.initialize(fixture);
  for (const step of steps) {
    state = ACID_BASE_TITRATION_MODULE.applyActionTransition!(
      actionContext(fixture.materialLedger, step.action, {
        materialAction: step.materialAction ?? null
      }),
      state
    ).state;
  }
  return state;
}

describe("relocated pure acid-base chemistry", () => {
  it("is the single source the legacy titration engine re-exports", () => {
    expect(legacyComputePH).toBe(computePH);
    expect(legacyEquivalenceVolumeML).toBe(equivalenceVolumeML);
    expect(legacyObservedColor).toBe(observedColor);
    expect(LEGACY_INDICATOR_SPECIFICATIONS).toBe(INDICATOR_SPECIFICATIONS);
  });

  it("pins the legacy technique thresholds exactly", () => {
    expect(NEAR_ENDPOINT_ML).toBe(2);
    expect(FAST_RATE_ML_PER_S).toBe(0.5);
    expect(OVERSHOOT_TOLERANCE_ML).toBe(0.3);
    expect(WATER_RINSE_DILUTION).toBe(0.98);
  });

  it("calculates the equivalence volume for matched 0.100 M / 25.0 mL", () => {
    expect(equivalenceVolumeML(STRONG)).toBeCloseTo(25, 2);
    // Byte-identical float formula pinned by the parity oracle.
    expect(equivalenceVolumeML(STRONG)).toBe(25.000000000000004);
  });

  it("increases pH monotonically as strong base is added to a strong acid", () => {
    let previous = -Infinity;
    for (let volumeML = 0; volumeML <= 45; volumeML += 0.5) {
      const pH = computePH(STRONG, volumeML, 1);
      expect(pH).toBeGreaterThan(previous);
      previous = pH;
    }
  });

  it("sets strong-acid/strong-base equivalence to pH 7", () => {
    expect(computePH(STRONG, 25, 1)).toBeCloseTo(7, 5);
  });

  it("sets weak-acid half-equivalence pH to pKa", () => {
    expect(computePH(WEAK, 12.5, 1)).toBeCloseTo(WEAK.analyte.pKa!, 2);
  });

  it("sets the weak-acid equivalence point above pH 7", () => {
    expect(computePH(WEAK, 25, 1)).toBeGreaterThan(7);
  });

  it("shows phenolphthalein as colorless in acid and pink in base", () => {
    expect(observedColor("phenolphthalein", 3)).toBe("colorless");
    expect(observedColor("phenolphthalein", 11)).toBe("pink");
  });

  it("models a water-rinsed burette as a longer endpoint volume", () => {
    expect(equivalenceVolumeML(STRONG, WATER_RINSE_DILUTION)).toBeGreaterThan(
      equivalenceVolumeML(STRONG, 1)
    );
    expect(equivalenceVolumeML(STRONG, WATER_RINSE_DILUTION)).toBe(
      25.510204081632658
    );
  });
});

describe("acid-base titration chemistry module", () => {
  it("resolves as the verified provider over the shared liquid foundation", () => {
    const resolution = resolveChemistryModelProviders([
      "chemistry.acid_base_equilibrium.v1",
      "chemistry.indicator_response.v1"
    ]);
    expect(resolution.orderedModelIds).toEqual([
      "chemistry-model.shared_liquid_foundation.v1",
      ACID_BASE_TITRATION_MODEL_ID
    ]);
    expect(
      PRODUCTION_GENERIC_CHEMISTRY_MODEL_REGISTRATIONS.some(
        ({ metadataId }) => metadataId === ACID_BASE_TITRATION_MODEL_ID
      )
    ).toBe(true);
  });

  it("documents the instrument-observables ambiguity awaiting Phase 3", () => {
    // Both the dilution and acid-base models provide the exclusive
    // chemistry.instrument_observables.v1 capability, so a non-compatibility
    // workflow must not request it as a root requirement until provider
    // selection is disambiguated.
    expect(() =>
      resolveChemistryModelProviders(["chemistry.instrument_observables.v1"])
    ).toThrowError(
      expect.objectContaining({
        code: CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES.ambiguousExclusiveProvider
      })
    );
  });

  it("initializes exact integer state from the compiled bindings", () => {
    const state = ACID_BASE_TITRATION_MODULE.initialize(setup());
    expect(fieldValue(state, "analyteConcentrationMicromolar")).toBe(100_000);
    expect(fieldValue(state, "analyteVolumeUnits")).toBe(25_000_000);
    expect(fieldValue(state, "titrantConcentrationMicromolar")).toBe(100_000);
    expect(fieldValue(state, "deliveredTitrantUnits")).toBe(0);
    expect(fieldValue(state, "dilutionFactorPermyriad")).toBe(10_000);
    expect(fieldValue(state, "conditioned")).toBe(false);
    expect(fieldValue(state, "indicatorAdded")).toBe(false);
    expect(fieldValue(state, "indicatorId")).toBe("phenolphthalein");
    expect(fieldValue(state, "tSimCentiseconds")).toBe(0);
    expect(fieldValue(state, "flaskEquipmentInstanceId")).toBe(FLASK);
    expect(fieldValue(state, "buretteEquipmentInstanceId")).toBe(BURETTE);
    expect(fieldValue(state, "titrantMaterialInstanceId")).toBe(TITRANT);
  });

  it("fails closed for unsupported setups and materials", () => {
    const fixture = setup();
    expect(() =>
      ACID_BASE_TITRATION_MODULE.initialize({
        ...fixture,
        equipmentBindings: fixture.equipmentBindings.filter(
          ({ equipmentDefinitionId }) =>
            equipmentDefinitionId !== "component.burette.v1"
        )
      })
    ).toThrowError(
      expect.objectContaining({
        code: ACID_BASE_TITRATION_ERROR_CODES.unsupportedSetup
      })
    );
    expect(() =>
      ACID_BASE_TITRATION_MODULE.initialize({
        ...fixture,
        materialBindings: fixture.materialBindings.filter(
          ({ instanceId }) => instanceId !== INDICATOR
        )
      })
    ).toThrowError(
      expect.objectContaining({
        code: ACID_BASE_TITRATION_ERROR_CODES.unsupportedMaterial
      })
    );
  });

  it("records burette conditioning as an exact dilution factor", () => {
    const fixture = setup();
    const waterRinsed = stateAfter(fixture, [{ action: rinseAction("water") }]);
    expect(fieldValue(waterRinsed, "conditioned")).toBe(false);
    expect(fieldValue(waterRinsed, "dilutionFactorPermyriad")).toBe(9_800);

    const conditioned = stateAfter(fixture, [
      { action: rinseAction("water") },
      { action: rinseAction("titrant") }
    ]);
    expect(fieldValue(conditioned, "conditioned")).toBe(true);
    expect(fieldValue(conditioned, "dilutionFactorPermyriad")).toBe(10_000);
  });

  it("accumulates delivery from executed transfers and advances simulated time", () => {
    const fixture = setup();
    const state = stateAfter(fixture, [
      {
        action: dispenseAction(0.5, 4),
        materialAction: dispenseMaterialAction(0.5)
      },
      {
        action: dispenseAction(0.1, 6),
        materialAction: dispenseMaterialAction(0.1)
      }
    ]);
    expect(fieldValue(state, "deliveredTitrantUnits")).toBe(600_000);
    expect(fieldValue(state, "tSimCentiseconds")).toBe(1_000);
  });

  it("falls back to the authored volume only without a material action", () => {
    const state = stateAfter(setup(), [{ action: dispenseAction(2.5, 10) }]);
    expect(fieldValue(state, "deliveredTitrantUnits")).toBe(2_500_000);
  });

  it("records the committed indicator and ignores fills, reads, and unknown actions", () => {
    const fixture = setup();
    const initial = ACID_BASE_TITRATION_MODULE.initialize(fixture);
    const indicated = stateAfter(fixture, [
      { action: indicatorAction("bromothymol_blue") }
    ]);
    expect(fieldValue(indicated, "indicatorAdded")).toBe(true);
    expect(fieldValue(indicated, "indicatorId")).toBe("bromothymol_blue");

    for (const action of [
      fillAction(50),
      readAction(0),
      normalizedAction("action.mix_solution.v1", [
        { key: "inversions", valueType: "number", value: 3 }
      ])
    ]) {
      expect(stateAfter(fixture, [{ action }])).toEqual(initial);
    }
  });

  it("rejects the base material-action path with a typed error", () => {
    const fixture = setup();
    const state = ACID_BASE_TITRATION_MODULE.initialize(fixture);
    expect(() =>
      ACID_BASE_TITRATION_MODULE.applyMaterialAction(
        dispenseMaterialAction(0.5),
        state
      )
    ).toThrowError(
      expect.objectContaining({
        code: ACID_BASE_TITRATION_ERROR_CODES.materialActionPathUnsupported
      })
    );
  });

  it("derives pH, colour, and endpoint observables without storing them", () => {
    const fixture = setup();
    const initial = ACID_BASE_TITRATION_MODULE.initialize(fixture);
    expect(ACID_BASE_TITRATION_MODULE.deriveObservables(initial)).toEqual([
      {
        observableId: ACID_BASE_TITRATION_OBSERVABLE_IDS.endpointObserved,
        value: false
      },
      {
        observableId: ACID_BASE_TITRATION_OBSERVABLE_IDS.observedColor,
        value: "not yet observed"
      },
      { observableId: ACID_BASE_TITRATION_OBSERVABLE_IDS.pH, value: 1 }
    ]);

    const past = stateAfter(fixture, [
      { action: rinseAction("titrant") },
      {
        action: dispenseAction(26, 60),
        materialAction: dispenseMaterialAction(26)
      }
    ]);
    const expectedPH = Math.round(computePH(STRONG, 26, 1) * 100) / 100;
    expect(ACID_BASE_TITRATION_MODULE.deriveObservables(past)).toEqual([
      {
        observableId: ACID_BASE_TITRATION_OBSERVABLE_IDS.endpointObserved,
        value: true
      },
      {
        observableId: ACID_BASE_TITRATION_OBSERVABLE_IDS.observedColor,
        value: "pink"
      },
      { observableId: ACID_BASE_TITRATION_OBSERVABLE_IDS.pH, value: expectedPH }
    ]);
  });

  it("derives legacy-identical ground truth for the full-titration bench", () => {
    const fixture = setup();
    const conditioned = stateAfter(fixture, [
      { action: rinseAction("titrant") }
    ]);
    expect(
      ACID_BASE_TITRATION_MODULE.deriveGroundTruthValues!(conditioned)
    ).toEqual({
      trueAnalyteMolarity: 0.1,
      equivalenceVolumeML: 25.000000000000004,
      titrantDilutionFactor: 1
    });

    const waterRinsed = stateAfter(fixture, [{ action: rinseAction("water") }]);
    expect(
      ACID_BASE_TITRATION_MODULE.deriveGroundTruthValues!(waterRinsed)
    ).toEqual({
      trueAnalyteMolarity: 0.1,
      equivalenceVolumeML: 25.510204081632658,
      titrantDilutionFactor: 0.98
    });
  });
});

describe("acid-base event annotation", () => {
  const annotate = (
    state: readonly GenericStateField[],
    action: NormalizedLabAction,
    events: readonly SemanticEvent[],
    options: {
      readonly materialAction?: ExecutedMaterialAction | null;
      readonly equipment?: readonly GenericEquipmentState[];
    } = {}
  ) =>
    ACID_BASE_TITRATION_MODULE.annotateEvents!(
      actionContext(setup().materialLedger, action, options),
      state,
      events
    );

  it("annotates conditioning rinses with legacy flags and evidence", () => {
    const fixture = setup();
    const conditioned = stateAfter(fixture, [
      { action: rinseAction("titrant") }
    ]);
    expect(
      annotate(conditioned, rinseAction("titrant"), [
        blankEvent("rinse_burette")
      ])
    ).toEqual([
      {
        type: "rinse_burette",
        tSim: 0,
        observation: { solvent: "titrant" },
        flags: [],
        evidence: [
          {
            skillId: "burette_conditioning",
            delta: 0.8,
            reason: "conditioned_with_titrant"
          }
        ]
      }
    ]);

    const waterRinsed = stateAfter(fixture, [{ action: rinseAction("water") }]);
    expect(
      annotate(waterRinsed, rinseAction("water"), [blankEvent("rinse_burette")])
    ).toEqual([
      {
        type: "rinse_burette",
        tSim: 0,
        observation: { solvent: "water" },
        flags: ["burette_not_conditioned"],
        evidence: [
          {
            skillId: "burette_conditioning",
            delta: -0.9,
            reason: "rinsed_with_water"
          }
        ]
      }
    ]);
  });

  it("annotates fills and indicator selection from the post-transition bench", () => {
    const fixture = setup();
    const state = ACID_BASE_TITRATION_MODULE.initialize(fixture);
    expect(
      annotate(state, fillAction(50), [blankEvent("fill_burette")], {
        equipment: [buretteEquipment(50, 0)]
      })
    ).toEqual([
      {
        type: "fill_burette",
        tSim: 0,
        observation: {
          requestedML: 50,
          resultingAvailableML: 50,
          currentReadingML: 0,
          fillKind: "initial"
        },
        flags: [],
        evidence: []
      }
    ]);

    const indicated = stateAfter(fixture, [
      { action: indicatorAction("phenolphthalein") }
    ]);
    expect(
      annotate(indicated, indicatorAction("phenolphthalein"), [
        blankEvent("select_indicator")
      ])
    ).toEqual([
      {
        type: "select_indicator",
        tSim: 0,
        observation: { indicator: "phenolphthalein" },
        flags: [],
        evidence: []
      }
    ]);
  });

  it("reproduces the pinned legacy first-delivery observation exactly", () => {
    const fixture = setup();
    const state = stateAfter(fixture, [
      { action: rinseAction("titrant") },
      {
        action: dispenseAction(0.5, 4),
        materialAction: dispenseMaterialAction(0.5)
      }
    ]);
    // Byte-for-byte the event pinned by the titration parity oracle fixture.
    expect(
      annotate(state, dispenseAction(0.5, 4), [blankEvent("add_titrant")], {
        materialAction: dispenseMaterialAction(0.5),
        equipment: [buretteEquipment(49.5, 0.5)]
      })
    ).toEqual([
      {
        type: "add_titrant",
        tSim: 4,
        observation: {
          addedML: 0.5,
          totalML: 0.5,
          cumulativeDeliveredML: 0.5,
          currentReadingML: 0.5,
          availableML: 49.5,
          rateMlPerS: 0.13,
          pH: 1.02,
          observedColor: "colorless",
          equivalenceML: 25
        },
        flags: [],
        evidence: []
      }
    ]);
  });

  it("stays silent for controlled dropwise delivery near the endpoint", () => {
    const fixture = setup();
    const state = stateAfter(fixture, [
      { action: rinseAction("titrant") },
      {
        action: dispenseAction(23.5, 47),
        materialAction: dispenseMaterialAction(23.5)
      },
      {
        action: dispenseAction(0.5, 5),
        materialAction: dispenseMaterialAction(0.5)
      }
    ]);
    const [event] = annotate(
      state,
      dispenseAction(0.5, 5),
      [blankEvent("add_titrant")],
      {
        materialAction: dispenseMaterialAction(0.5),
        equipment: [buretteEquipment(26, 24)]
      }
    );
    expect(event!.flags).toEqual([]);
    expect(event!.evidence).toEqual([
      {
        skillId: "endpoint_control",
        delta: 0.5,
        reason: "controlled_addition_near_endpoint"
      }
    ]);
    expect(event!.observation).toMatchObject({ totalML: 24, rateMlPerS: 0.1 });
  });

  it("flags fast delivery near the endpoint with the legacy evidence", () => {
    const fixture = setup();
    const state = stateAfter(fixture, [
      { action: rinseAction("titrant") },
      {
        action: dispenseAction(23.5, 47),
        materialAction: dispenseMaterialAction(23.5)
      },
      {
        action: dispenseAction(0.5, 0.5),
        materialAction: dispenseMaterialAction(0.5)
      }
    ]);
    const [event] = annotate(
      state,
      dispenseAction(0.5, 0.5),
      [blankEvent("add_titrant")],
      {
        materialAction: dispenseMaterialAction(0.5),
        equipment: [buretteEquipment(26, 24)]
      }
    );
    expect(event!.tSim).toBe(47.5);
    expect(event!.flags).toEqual(["flow_rate_high_near_endpoint"]);
    expect(event!.evidence).toEqual([
      {
        skillId: "endpoint_control",
        delta: -0.7,
        reason: "flow_rate_high_near_endpoint",
        detail: { rateMlPerS: 1 }
      }
    ]);
  });

  it("flags an endpoint overshoot exactly once at the crossing", () => {
    const fixture = setup();
    const state = stateAfter(fixture, [
      { action: rinseAction("titrant") },
      {
        action: dispenseAction(25.1, 60),
        materialAction: dispenseMaterialAction(25.1)
      },
      {
        action: dispenseAction(0.5, 5),
        materialAction: dispenseMaterialAction(0.5)
      }
    ]);
    const [event] = annotate(
      state,
      dispenseAction(0.5, 5),
      [blankEvent("add_titrant")],
      {
        materialAction: dispenseMaterialAction(0.5),
        equipment: [buretteEquipment(24.4, 25.6)]
      }
    );
    expect(event!.flags).toEqual(["endpoint_overshoot"]);
    expect(event!.evidence).toEqual([
      {
        skillId: "endpoint_control",
        delta: 0.5,
        reason: "controlled_addition_near_endpoint"
      },
      {
        skillId: "endpoint_control",
        delta: -0.9,
        reason: "endpoint_overshoot",
        detail: { overshootML: 0.6 }
      }
    ]);
  });

  it("flags an unconditioned burette on delivery and shifts the equivalence", () => {
    const fixture = setup();
    const state = stateAfter(fixture, [
      { action: rinseAction("water") },
      {
        action: dispenseAction(0.5, 4),
        materialAction: dispenseMaterialAction(0.5)
      }
    ]);
    const [event] = annotate(
      state,
      dispenseAction(0.5, 4),
      [blankEvent("add_titrant")],
      {
        materialAction: dispenseMaterialAction(0.5),
        equipment: [buretteEquipment(49.5, 0.5)]
      }
    );
    expect(event!.flags).toEqual(["burette_not_conditioned"]);
    expect(event!.observation).toMatchObject({ equivalenceML: 25.51 });
  });

  it("annotates meniscus reads against the true equipment reading", () => {
    const fixture = setup();
    const state = ACID_BASE_TITRATION_MODULE.initialize(fixture);
    expect(
      annotate(state, readAction(22.2), [blankEvent("read_meniscus")], {
        equipment: [buretteEquipment(28, 22)]
      })
    ).toEqual([
      {
        type: "read_meniscus",
        tSim: 0,
        observation: { reportedML: 22.2, trueML: 22, errorML: 0.2 },
        flags: ["meniscus_misread"],
        evidence: [
          {
            skillId: "volumetric_reading",
            delta: -0.6,
            reason: "meniscus_misread"
          }
        ]
      }
    ]);
    expect(
      annotate(state, readAction(22), [blankEvent("read_meniscus")], {
        equipment: [buretteEquipment(28, 22)]
      })
    ).toEqual([
      {
        type: "read_meniscus",
        tSim: 0,
        observation: { reportedML: 22, trueML: 22, errorML: 0 },
        flags: [],
        evidence: [
          {
            skillId: "volumetric_reading",
            delta: 0.6,
            reason: "meniscus_read_ok"
          }
        ]
      }
    ]);
  });

  it("passes events outside its vocabulary through unchanged", () => {
    const state = ACID_BASE_TITRATION_MODULE.initialize(setup());
    const foreign: SemanticEvent = {
      type: "transfer_liquid",
      tSim: 3,
      observation: { volumeML: 10 },
      flags: ["some_flag"],
      evidence: [{ skillId: "other", delta: 0.1, reason: "other_reason" }]
    };
    expect(
      annotate(state, readAction(0), [foreign], {
        equipment: [buretteEquipment(50, 0)]
      })
    ).toEqual([foreign]);
  });
});

describe("coordinator action, annotation, and ground-truth hooks", () => {
  function acidBaseProgram(fixture: ReturnType<typeof setup>) {
    const base = compileGenericLabProgram(
      validatedMechanicalWorkflow(),
      createTestGenericPorts()
    ).program;
    const resolution = resolveChemistryModelProviders([
      "chemistry.acid_base_equilibrium.v1",
      "chemistry.indicator_response.v1"
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
      }))
    };
    return program;
  }

  it("routes null-material actions to applyActionTransition and merges ground truth", () => {
    const fixture = setup();
    const program = acidBaseProgram(fixture);
    const coordinator = createChemistryModelCoordinator({
      registrations: PRODUCTION_GENERIC_CHEMISTRY_MODEL_REGISTRATIONS
    });
    const initial = coordinator.initialize({
      program,
      equipment: fixture.equipment,
      materialLedger: fixture.materialLedger
    });
    expect(initial.groundTruth.values).toMatchObject({
      trueAnalyteMolarity: 0.1,
      equivalenceVolumeML: 25.000000000000004,
      titrantDilutionFactor: 1
    });

    // A rinse has no material action, yet the chemistry must react.
    const rinsed = coordinator.transition({
      program,
      previous: initial,
      action: rinseAction("water"),
      equipment: fixture.equipment,
      materialLedger: fixture.materialLedger,
      materialAction: null
    });
    expect(rinsed.groundTruth.values).toMatchObject({
      equivalenceVolumeML: 25.510204081632658,
      titrantDilutionFactor: 0.98
    });
    expect(
      rinsed.modelStates
        .find(({ modelId }) => modelId === ACID_BASE_TITRATION_MODEL_ID)!
        .fields.find(({ key }) => key === "dilutionFactorPermyriad")!.value
    ).toBe(9_800);
  });

  it("annotates mechanical events through the coordinator port", () => {
    const fixture = setup();
    const program = acidBaseProgram(fixture);
    const coordinator = createChemistryModelCoordinator({
      registrations: PRODUCTION_GENERIC_CHEMISTRY_MODEL_REGISTRATIONS
    });
    const initial = coordinator.initialize({
      program,
      equipment: fixture.equipment,
      materialLedger: fixture.materialLedger
    });
    const annotated = coordinator.annotateEvents!({
      program,
      modelStates: initial.modelStates,
      action: readAction(22.2),
      materialAction: null,
      equipment: [buretteEquipment(28, 22)],
      materialLedger: fixture.materialLedger,
      events: [blankEvent("read_meniscus")]
    });
    expect(annotated).toEqual([
      {
        type: "read_meniscus",
        tSim: 0,
        observation: { reportedML: 22.2, trueML: 22, errorML: 0.2 },
        flags: ["meniscus_misread"],
        evidence: [
          {
            skillId: "volumetric_reading",
            delta: -0.6,
            reason: "meniscus_misread"
          }
        ]
      }
    ]);
  });

  function syntheticProgram(
    modelIds: readonly string[],
    fixture: ReturnType<typeof setup>
  ): CompiledGenericLabProgram {
    const base = compileGenericLabProgram(
      validatedMechanicalWorkflow(),
      createTestGenericPorts()
    ).program;
    return {
      ...base,
      schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
      equipment: fixture.equipmentBindings,
      materials: fixture.materialBindings,
      chemistryModels: modelIds.map((modelId) => ({
        modelId,
        modelVersion: "1.0.0",
        providedCapabilityIds: ["chemistry.material_ledger.v1"],
        requiredCapabilityIds: []
      }))
    };
  }

  function syntheticRegistration(
    modelId: string,
    overrides: Partial<GenericChemistryModuleRegistration["module"]>
  ): GenericChemistryModuleRegistration {
    return {
      metadataId: modelId as `chemistry-model.${string}`,
      module: {
        id: modelId as `chemistry-model.${string}`,
        version: "1.0.0",
        providedCapabilityIds: ["chemistry.material_ledger.v1"],
        requiredCapabilityIds: [],
        initialize: () => [],
        applyMaterialAction: (_action, state) => ({
          state: state.map((entry) => ({ ...entry }))
        }),
        deriveObservables: () => [],
        ...overrides
      }
    };
  }

  it("rejects annotations that drop events or change their types", () => {
    const fixture = setup();
    const dropping = "chemistry-model.test.annotation_dropper.v1";
    const retyping = "chemistry-model.test.annotation_retyper.v1";
    const coordinator = createChemistryModelCoordinator({
      registrations: [
        syntheticRegistration(dropping, { annotateEvents: () => [] }),
        syntheticRegistration(retyping, {
          annotateEvents: (_context, _state, events) =>
            events.map((event) => ({ ...event, type: "renamed_event" }))
        })
      ]
    });
    for (const modelId of [dropping, retyping]) {
      expect(() =>
        coordinator.annotateEvents!({
          program: syntheticProgram([modelId], fixture),
          modelStates: [{ modelId, modelVersion: "1.0.0", fields: [] }],
          action: readAction(0),
          materialAction: null,
          equipment: [],
          materialLedger: fixture.materialLedger,
          events: [blankEvent("read_meniscus")]
        })
      ).toThrowError(
        expect.objectContaining({
          code: COORDINATOR_ERROR.eventAnnotationInvalid
        })
      );
    }
  });

  it("feeds each module's annotated events into the next in binding order", () => {
    const fixture = setup();
    const first = "chemistry-model.test.annotation_first.v1";
    const second = "chemistry-model.test.annotation_second.v1";
    const coordinator = createChemistryModelCoordinator({
      registrations: [
        syntheticRegistration(first, {
          annotateEvents: (_context, _state, events) =>
            events.map((event) => ({ ...event, flags: ["first_flag"] }))
        }),
        syntheticRegistration(second, {
          annotateEvents: (_context, _state, events) =>
            events.map((event) => ({
              ...event,
              flags: [...event.flags, "second_flag"]
            }))
        })
      ]
    });
    const annotated = coordinator.annotateEvents!({
      program: syntheticProgram([first, second], fixture),
      modelStates: [
        { modelId: first, modelVersion: "1.0.0", fields: [] },
        { modelId: second, modelVersion: "1.0.0", fields: [] }
      ],
      action: readAction(0),
      materialAction: null,
      equipment: [],
      materialLedger: fixture.materialLedger,
      events: [blankEvent("read_meniscus")]
    });
    expect(annotated[0]!.flags).toEqual(["first_flag", "second_flag"]);
  });

  it("rejects ground-truth key collisions across modules", () => {
    const fixture = setup();
    const first = "chemistry-model.test.truth_first.v1";
    const second = "chemistry-model.test.truth_second.v1";
    const coordinator = createChemistryModelCoordinator({
      registrations: [
        syntheticRegistration(first, {
          deriveGroundTruthValues: () => ({ sharedKey: 1 })
        }),
        syntheticRegistration(second, {
          deriveGroundTruthValues: () => ({ sharedKey: 2 })
        })
      ]
    });
    expect(() =>
      coordinator.initialize({
        program: syntheticProgram([first, second], fixture),
        equipment: fixture.equipment,
        materialLedger: fixture.materialLedger
      })
    ).toThrowError(
      expect.objectContaining({
        code: COORDINATOR_ERROR.groundTruthCollision
      })
    );
  });

  it("rejects ground-truth keys that collide with a numeric observable", () => {
    const fixture = setup();
    const modelId = "chemistry-model.test.truth_observable.v1";
    const coordinator = createChemistryModelCoordinator({
      registrations: [
        syntheticRegistration(modelId, {
          deriveObservables: () => [
            {
              observableId: "observable.burette_reading_ml.v1",
              value: 12,
              unitId: "unit.ml.v1"
            }
          ],
          deriveGroundTruthValues: () => ({
            "observable.burette_reading_ml.v1": 13
          })
        })
      ]
    });
    expect(() =>
      coordinator.initialize({
        program: syntheticProgram([modelId], fixture),
        equipment: fixture.equipment,
        materialLedger: fixture.materialLedger
      })
    ).toThrowError(
      expect.objectContaining({
        code: COORDINATOR_ERROR.groundTruthCollision
      })
    );
  });

  it("keeps modules without applyActionTransition on the material-action path", () => {
    const fixture = setup();
    const modelId = "chemistry-model.test.material_only.v1";
    let applied = 0;
    const coordinator = createChemistryModelCoordinator({
      registrations: [
        syntheticRegistration(modelId, {
          applyMaterialAction: (_action, state) => {
            applied += 1;
            return { state: state.map((entry) => ({ ...entry })) };
          }
        })
      ]
    });
    const program = syntheticProgram([modelId], fixture);
    const initial = coordinator.initialize({
      program,
      equipment: fixture.equipment,
      materialLedger: fixture.materialLedger
    });
    const next = coordinator.transition({
      program,
      previous: initial,
      action: readAction(0),
      equipment: fixture.equipment,
      materialLedger: fixture.materialLedger,
      materialAction: null
    });
    expect(applied).toBe(0);
    expect(next).toEqual(initial);
  });
});
