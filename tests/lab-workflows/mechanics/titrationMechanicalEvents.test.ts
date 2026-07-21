import { describe, expect, it } from "vitest";

import type { SemanticEvent } from "../../../src/experiments/shared";
import { ACID_BASE_TITRATION_MODULE } from "../../../src/lab-workflows/chemistry-models/acid-base";
import type { GenericChemistryActionContext } from "../../../src/lab-workflows/chemistry-models/coordinator";
import {
  applyExecutedMaterialAction,
  initializeMaterialLedger,
  type ExecutedMaterialAction,
  type MaterialLedger
} from "../../../src/lab-workflows/chemistry-models/material-ledger";
import {
  BURETTE_MECHANICAL_ADAPTER,
  ERLENMEYER_FLASK_MECHANICAL_ADAPTER,
  INDICATOR_BOTTLE_MECHANICAL_ADAPTER,
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
import { configurationRegistry } from "../../../src/lab-workflows/registries/configurations";
import {
  materialRegistry,
  type ReagentRegistryId
} from "../../../src/lab-workflows/registries/reagents";
import {
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  type CompiledActionBinding,
  type CompiledEquipmentBinding,
  type CompiledMaterialBinding,
  type GenericEquipmentState,
  type GenericMechanicalContext,
  type GenericStateField,
  type NormalizedLabAction
} from "../../../src/lab-workflows/runtime/generic";

const BURETTE = "titrant_burette";
const FLASK = "analyte_flask";
const INDICATOR_BOTTLE = "indicator_source";
const TITRANT_BOTTLE = "titrant_bottle";
const ANALYTE = "analyte";
const TITRANT = "titrant";
const INDICATOR = "indicator";

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
    initializationPresetSchemaId: profile.initializationPresetSchemaId,
    providedChemistryCapabilityIds: [...profile.providedChemistryCapabilityIds],
    requiredContainerCapabilityIds: [
      ...profile.compatibleContainerCapabilityIds
    ],
    quantityAmount: quantity.amount,
    quantityUnitId: quantity.unitId
  };
}

/** The exact full-titration bench the parity oracle drives through legacy. */
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
  const equipment = equipmentBindings.map((binding) =>
    initializeLiquidEquipmentState({ binding, materialLedger })
  );
  return { equipmentBindings, materialBindings, materialLedger, equipment };
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
    { equipmentInstanceId: TITRANT_BOTTLE, capacityML: null },
    { equipmentInstanceId: INDICATOR_BOTTLE, capacityML: null },
    { equipmentInstanceId: BURETTE, capacityML: 50 },
    { equipmentInstanceId: FLASK, capacityML: 125 }
  ]);
}

const rinseAction = (solvent: string) =>
  action("action.rinse.v1", TITRANT_BOTTLE, [BURETTE], [
    { key: "solvent", valueType: "enum", value: solvent }
  ]);
const fillAction = (volumeML: number) =>
  action("action.fill.v1", TITRANT_BOTTLE, [BURETTE], [
    { key: "volumeML", valueType: "number", value: volumeML }
  ]);
const dispenseAction = (volumeML: number, durationS: number) =>
  action("action.dispense.v1", BURETTE, [FLASK], [
    { key: "volumeML", valueType: "number", value: volumeML },
    { key: "durationS", valueType: "number", value: durationS }
  ]);
const readAction = (reportedML: number) =>
  action("action.read_volume.v1", BURETTE, [], [
    { key: "reportedML", valueType: "number", value: reportedML }
  ]);
const addIndicatorAction = (indicator: string) =>
  action("action.add_indicator.v1", FLASK, [FLASK], [
    { key: "indicator", valueType: "enum", value: indicator }
  ]);
const selectIndicatorAction = (indicator: string) =>
  action("action.select_indicator.v1", INDICATOR_BOTTLE, [FLASK], [
    { key: "indicator", valueType: "enum", value: indicator }
  ]);

/** Bench state after conditioning and a full 50 mL initial fill. */
function filledBench() {
  const fixture = setup();
  let ledger = fixture.materialLedger;
  let equipment = fixture.equipment;
  const rinsed = BURETTE_MECHANICAL_ADAPTER.apply(
    context(rinseAction("titrant"), equipment, ledger)
  );
  equipment = [...rinsed.equipment];
  const filled = BURETTE_MECHANICAL_ADAPTER.apply(
    context(fillAction(50), equipment, ledger)
  );
  ledger = applyLedger(ledger, filled);
  equipment = [...filled.equipment];
  return { fixture, ledger, equipment };
}

describe("titration mechanical event emission", () => {
  it("emits the mechanical rinse observation with the exact solvent", () => {
    const fixture = setup();
    const transition = BURETTE_MECHANICAL_ADAPTER.apply(
      context(rinseAction("titrant"), fixture.equipment, fixture.materialLedger)
    );
    expect(transition.materialAction).toBeNull();
    expect(transition.events).toEqual([
      {
        type: "rinse_burette",
        tSim: 0,
        observation: { solvent: "titrant" },
        flags: [],
        evidence: []
      }
    ]);
  });

  it("distinguishes the initial fill from a refill and rounds to two decimals", () => {
    const fixture = setup();
    const first = BURETTE_MECHANICAL_ADAPTER.apply(
      context(fillAction(33.33), fixture.equipment, fixture.materialLedger)
    );
    // 50 - 33.33 carries float residue; the observation must round like legacy.
    expect(first.events).toEqual([
      {
        type: "fill_burette",
        tSim: 0,
        observation: {
          requestedML: 33.33,
          resultingAvailableML: 33.33,
          currentReadingML: 16.67,
          fillKind: "initial"
        },
        flags: [],
        evidence: []
      }
    ]);

    const ledgerAfterFirst = applyLedger(fixture.materialLedger, first);
    const second = BURETTE_MECHANICAL_ADAPTER.apply(
      context(fillAction(10), first.equipment, ledgerAfterFirst)
    );
    expect(second.events).toEqual([
      {
        type: "refill_burette",
        tSim: 0,
        observation: {
          requestedML: 10,
          resultingAvailableML: 43.33,
          currentReadingML: 6.67,
          fillKind: "refill"
        },
        flags: [],
        evidence: []
      }
    ]);
  });

  it("marks a pre-filled bench's next fill as a refill", () => {
    const fixture = setup();
    const preFilled = fixture.equipment.map((state) =>
      state.instanceId === BURETTE
        ? {
            ...state,
            fields: state.fields.map((field) =>
              field.key === "filled" ? { key: field.key, value: true } : field
            )
          }
        : state
    );
    const transition = BURETTE_MECHANICAL_ADAPTER.apply(
      context(fillAction(10), preFilled, fixture.materialLedger)
    );
    expect(transition.events[0]).toMatchObject({
      type: "refill_burette",
      observation: expect.objectContaining({ fillKind: "refill" })
    });
  });

  it("emits the mechanical add_titrant portion from post-action burette state", () => {
    const { ledger, equipment } = filledBench();
    const first = BURETTE_MECHANICAL_ADAPTER.apply(
      context(dispenseAction(3.33, 10), equipment, ledger)
    );
    expect(first.events).toEqual([
      {
        type: "add_titrant",
        tSim: 0,
        observation: {
          addedML: 3.33,
          totalML: 3.33,
          cumulativeDeliveredML: 3.33,
          currentReadingML: 3.33,
          availableML: 46.67
        },
        flags: [],
        evidence: []
      }
    ]);

    const ledgerAfterFirst = applyLedger(ledger, first);
    const second = BURETTE_MECHANICAL_ADAPTER.apply(
      context(dispenseAction(0.5, 5), first.equipment, ledgerAfterFirst)
    );
    expect(second.events).toEqual([
      {
        type: "add_titrant",
        tSim: 0,
        observation: {
          addedML: 0.5,
          totalML: 3.83,
          cumulativeDeliveredML: 3.83,
          currentReadingML: 3.83,
          availableML: 46.17
        },
        flags: [],
        evidence: []
      }
    ]);
  });

  it("reads the true meniscus into the mechanical observation, accepting zero", () => {
    const { ledger, equipment } = filledBench();
    const zeroRead = BURETTE_MECHANICAL_ADAPTER.apply(
      context(readAction(0), equipment, ledger)
    );
    expect(zeroRead.equipment).toBe(equipment);
    expect(zeroRead.materialAction).toBeNull();
    expect(zeroRead.events).toEqual([
      {
        type: "read_meniscus",
        tSim: 0,
        observation: { reportedML: 0, trueML: 0, errorML: 0 },
        flags: [],
        evidence: []
      }
    ]);

    const dispensed = BURETTE_MECHANICAL_ADAPTER.apply(
      context(dispenseAction(3.33, 10), equipment, ledger)
    );
    const misread = BURETTE_MECHANICAL_ADAPTER.apply(
      context(readAction(3.3), dispensed.equipment, applyLedger(ledger, dispensed))
    );
    // 3.3 - 3.33 carries float residue; the observation must round like legacy.
    expect(misread.events).toEqual([
      {
        type: "read_meniscus",
        tSim: 0,
        observation: { reportedML: 3.3, trueML: 3.33, errorML: -0.03 },
        flags: [],
        evidence: []
      }
    ]);
  });

  it("commits the flask-side indicator addition with a select_indicator event", () => {
    const fixture = setup();
    const mechanicalContext = context(
      addIndicatorAction("phenolphthalein"),
      fixture.equipment,
      fixture.materialLedger
    );
    expect(
      ERLENMEYER_FLASK_MECHANICAL_ADAPTER.checkPreconditions(mechanicalContext)
    ).toEqual({ ok: true });
    const transition =
      ERLENMEYER_FLASK_MECHANICAL_ADAPTER.apply(mechanicalContext);
    const flask = transition.equipment.find(
      ({ instanceId }) => instanceId === FLASK
    )!;
    expect(stateField(flask, "indicatorAdded")).toBe(true);
    expect(transition.materialAction).toBeNull();
    expect(transition.events).toEqual([
      {
        type: "select_indicator",
        tSim: 0,
        observation: { indicator: "phenolphthalein" },
        flags: [],
        evidence: []
      }
    ]);

    const repeated = context(
      addIndicatorAction("phenolphthalein"),
      transition.equipment,
      fixture.materialLedger
    );
    expect(
      ERLENMEYER_FLASK_MECHANICAL_ADAPTER.checkPreconditions(repeated)
    ).toEqual({
      ok: false,
      reasonCode: "precondition.equipment.indicator_not_added.v1",
      message: "The flask has already received its one indicator addition."
    });
  });

  it("commits the bottle-side indicator selection to both bottle and flask", () => {
    const fixture = setup();
    const mechanicalContext = context(
      selectIndicatorAction("phenolphthalein"),
      fixture.equipment,
      fixture.materialLedger
    );
    expect(
      INDICATOR_BOTTLE_MECHANICAL_ADAPTER.checkPreconditions(mechanicalContext)
    ).toEqual({ ok: true });
    const transition =
      INDICATOR_BOTTLE_MECHANICAL_ADAPTER.apply(mechanicalContext);
    const bottle = transition.equipment.find(
      ({ instanceId }) => instanceId === INDICATOR_BOTTLE
    )!;
    const flask = transition.equipment.find(
      ({ instanceId }) => instanceId === FLASK
    )!;
    expect(stateField(bottle, "selected")).toBe(true);
    expect(stateField(bottle, "added")).toBe(true);
    expect(stateField(flask, "indicatorAdded")).toBe(true);
    expect(transition.materialAction).toBeNull();
    expect(transition.events).toEqual([
      {
        type: "select_indicator",
        tSim: 0,
        observation: { indicator: "phenolphthalein" },
        flags: [],
        evidence: []
      }
    ]);
  });
});

/*
 * Composition oracle: a mechanical event plus acid-base annotation must equal
 * the event the legacy engine emits for the same step. The expected objects
 * below are copied verbatim from the pinned legacy fixture
 * tests/lab-workflows/definitions/fixtures/titration-parity-oracle.json
 * (trace parity.full_titration.valid.0, steps 3 and 4).
 */
const LEGACY_INITIAL_READ: SemanticEvent = {
  type: "read_meniscus",
  tSim: 0,
  observation: { reportedML: 0, trueML: 0, errorML: 0 },
  flags: [],
  evidence: [
    { skillId: "volumetric_reading", delta: 0.6, reason: "meniscus_read_ok" }
  ]
};

const LEGACY_FIRST_DELIVERY: SemanticEvent = {
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
};

describe("mechanical events compose with chemistry annotation", () => {
  function chemistryContext(
    actionValue: NormalizedLabAction,
    ledger: MaterialLedger,
    options: {
      readonly materialAction?: ExecutedMaterialAction | null;
      readonly equipment?: readonly GenericEquipmentState[];
    } = {}
  ): GenericChemistryActionContext {
    return {
      action: actionValue,
      materialAction: options.materialAction ?? null,
      equipment: options.equipment ?? [],
      materialLedger: ledger
    };
  }

  /**
   * Runs the legacy full-titration opening (condition, fill, indicator) with
   * mechanics owning equipment and the acid-base model owning chemistry.
   */
  function openedBench() {
    const { fixture, ledger, equipment } = filledBench();
    const indicated =
      ERLENMEYER_FLASK_MECHANICAL_ADAPTER.apply(
        context(addIndicatorAction("phenolphthalein"), equipment, ledger)
      );
    let state = ACID_BASE_TITRATION_MODULE.initialize(fixture);
    for (const chemistryAction of [
      rinseAction("titrant"),
      fillAction(50),
      addIndicatorAction("phenolphthalein")
    ]) {
      state = ACID_BASE_TITRATION_MODULE.applyActionTransition!(
        chemistryContext(chemistryAction, ledger),
        state
      ).state;
    }
    return { ledger, equipment: indicated.equipment, state };
  }

  function annotate(
    state: readonly GenericStateField[],
    actionValue: NormalizedLabAction,
    ledger: MaterialLedger,
    events: readonly SemanticEvent[],
    options: {
      readonly materialAction?: ExecutedMaterialAction | null;
      readonly equipment?: readonly GenericEquipmentState[];
    } = {}
  ): readonly SemanticEvent[] {
    return ACID_BASE_TITRATION_MODULE.annotateEvents!(
      chemistryContext(actionValue, ledger, options),
      state,
      events
    );
  }

  it("composes the legacy-identical initial read_meniscus event", () => {
    const { ledger, equipment, state } = openedBench();
    const mechanical = BURETTE_MECHANICAL_ADAPTER.apply(
      context(readAction(0), equipment, ledger)
    );
    expect(
      annotate(state, readAction(0), ledger, mechanical.events, {
        equipment: mechanical.equipment
      })
    ).toEqual([LEGACY_INITIAL_READ]);
  });

  it("composes the legacy-identical first add_titrant event", () => {
    const { ledger, equipment, state } = openedBench();
    const mechanical = BURETTE_MECHANICAL_ADAPTER.apply(
      context(dispenseAction(0.5, 4), equipment, ledger)
    );
    expect(mechanical.events).toEqual([
      {
        type: "add_titrant",
        tSim: 0,
        observation: {
          addedML: 0.5,
          totalML: 0.5,
          cumulativeDeliveredML: 0.5,
          currentReadingML: 0.5,
          availableML: 49.5
        },
        flags: [],
        evidence: []
      }
    ]);
    const dispensed = ACID_BASE_TITRATION_MODULE.applyActionTransition!(
      chemistryContext(dispenseAction(0.5, 4), ledger, {
        materialAction: mechanical.materialAction
      }),
      state
    ).state;
    expect(
      annotate(dispensed, dispenseAction(0.5, 4), ledger, mechanical.events, {
        materialAction: mechanical.materialAction,
        equipment: mechanical.equipment
      })
    ).toEqual([LEGACY_FIRST_DELIVERY]);
  });

  it("composes a legacy-identical misread with the chemistry-side flag", () => {
    const { ledger, equipment, state } = openedBench();
    const mechanicalDispense = BURETTE_MECHANICAL_ADAPTER.apply(
      context(dispenseAction(0.5, 4), equipment, ledger)
    );
    const dispensed = ACID_BASE_TITRATION_MODULE.applyActionTransition!(
      chemistryContext(dispenseAction(0.5, 4), ledger, {
        materialAction: mechanicalDispense.materialAction
      }),
      state
    ).state;
    const ledgerAfter = applyLedger(ledger, mechanicalDispense);
    const mechanicalRead = BURETTE_MECHANICAL_ADAPTER.apply(
      context(readAction(0.6), mechanicalDispense.equipment, ledgerAfter)
    );
    expect(mechanicalRead.events).toEqual([
      {
        type: "read_meniscus",
        tSim: 0,
        observation: { reportedML: 0.6, trueML: 0.5, errorML: 0.1 },
        flags: [],
        evidence: []
      }
    ]);
    expect(
      annotate(dispensed, readAction(0.6), ledgerAfter, mechanicalRead.events, {
        equipment: mechanicalDispense.equipment
      })
    ).toEqual([
      {
        type: "read_meniscus",
        tSim: 4,
        observation: { reportedML: 0.6, trueML: 0.5, errorML: 0.1 },
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
});
