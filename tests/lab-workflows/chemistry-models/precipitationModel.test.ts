import { describe, expect, it } from "vitest";

import {
  KSP_REGISTRY,
  PRECIPITATION_BISECTION_STEPS,
  PRECIPITATION_MODEL_ID,
  PRECIPITATION_MODULE,
  PRECIPITATION_OBSERVABLE_IDS,
  inventoryFromSolutionPortions,
  predictPrecipitation,
  solvePrecipitationEquilibrium
} from "../../../src/lab-workflows/chemistry-models/precipitation";
import {
  applyExecutedMaterialAction,
  createMaterialTransfer,
  initializeMaterialLedger,
  type MaterialLedger
} from "../../../src/lab-workflows/chemistry-models/material-ledger";
import type { GenericStateField } from "../../../src/lab-workflows/runtime/generic/types";
import { GENERIC_LAB_RUNTIME_SCHEMA_VERSION } from "../../../src/lab-workflows/runtime/generic/types";

const SILVER = "reagent.silver_nitrate_0_100m.v1";
const CHLORIDE = "reagent.sodium_chloride_0_100m.v1";
const WATER = "reagent.distilled_water.v1";

function binding(
  instanceId: string,
  materialProfileId: string,
  containerInstanceId: string,
  concentrationM: number
) {
  return {
    instanceId,
    materialProfileId,
    containerInstanceId,
    initialConcentrationM: concentrationM,
    providedChemistryCapabilityIds:
      materialProfileId === WATER
        ? []
        : ["chemistry.precipitation_solubility.v1"]
  };
}

const BINDINGS = [
  binding("silver_stock", SILVER, "silver_bottle", 0.1),
  binding("chloride_stock", CHLORIDE, "chloride_bottle", 0.1),
  binding("water_stock", WATER, "water_bottle", 0)
];

function initialLedger(): MaterialLedger {
  return initializeMaterialLedger(
    BINDINGS.map((entry) => ({
      materialInstanceId: entry.instanceId,
      materialProfileId: entry.materialProfileId,
      materialVersion: "1.0.0",
      containerInstanceId: entry.containerInstanceId,
      amount: entry.instanceId === "water_stock" ? 250 : 50,
      unitId: "unit.ml.v1" as const
    }))
  );
}

function initialize(ledger = initialLedger()) {
  return PRECIPITATION_MODULE.initialize({
    equipmentBindings: [],
    materialBindings: BINDINGS,
    equipment: [],
    materialLedger: ledger
    // The test supplies the compiled fields consumed by this model only.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

function pour(
  state: readonly GenericStateField[],
  ledger: MaterialLedger,
  materialInstanceId: string,
  source: string,
  amount: number,
  target = "vessel"
) {
  const transfer = createMaterialTransfer(ledger, {
    materialInstanceId,
    sourceEquipmentInstanceId: source,
    targetEquipmentInstanceId: target,
    amount,
    unitId: "unit.ml.v1"
  });
  const materialAction = {
    actionId: "action.pour_liquid.v1",
    sourceEquipmentInstanceId: source,
    targetEquipmentInstanceIds: [target],
    materialInstanceIds: [materialInstanceId],
    transfers: [transfer]
  };
  const nextLedger = applyExecutedMaterialAction(ledger, materialAction, [
    { equipmentInstanceId: "silver_bottle", capacityML: 250 },
    { equipmentInstanceId: "chloride_bottle", capacityML: 250 },
    { equipmentInstanceId: "water_bottle", capacityML: 500 },
    { equipmentInstanceId: target, capacityML: 10_000 }
  ]);
  const nextState = PRECIPITATION_MODULE.applyActionTransition!(
    {
      action: {
        schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
        permissionId: "permission.pour",
        actionId: "action.pour_liquid.v1",
        sourceEquipmentInstanceId: source,
        targetEquipmentInstanceIds: [target],
        parameters: [{ key: "volumeML", valueType: "number", value: amount }]
      },
      materialAction,
      equipment: [],
      materialLedger: nextLedger
    },
    state
  ).state;
  return { state: nextState, ledger: nextLedger };
}

function fieldValue(state: readonly GenericStateField[], key: string) {
  return state.find((entry) => entry.key === key)?.value;
}

describe("25 C solubility-product registry and equilibrium", () => {
  it("pins cited Ksp values for every supported insoluble salt", () => {
    expect(
      KSP_REGISTRY.map(({ formula, ksp25C }) => [formula, ksp25C])
    ).toEqual([
      ["AgCl", 1.77e-10],
      ["BaSO4", 1.08e-10],
      ["Cu(OH)2", 2.2e-20],
      ["Fe(OH)3", 2.79e-39]
    ]);
    expect(KSP_REGISTRY.every(({ source }) => source.includes("CRC"))).toBe(
      true
    );
    expect(PRECIPITATION_BISECTION_STEPS).toBe(200);
  });

  it("does not precipitate 10^-9 M AgNO3 mixed with 10^-9 M NaCl", () => {
    const result = solvePrecipitationEquilibrium(
      inventoryFromSolutionPortions([
        { solutionId: "silver_nitrate", concentrationM: 1e-9, volumeML: 50 },
        { solutionId: "sodium_chloride", concentrationM: 1e-9, volumeML: 50 }
      ])
    );
    expect(result.reactionQuotientBefore).toBeCloseTo(2.5e-19, 30);
    expect(result.reactionQuotientBefore).toBeLessThan(1.77e-10);
    expect(result.formsPrecipitate).toBe(false);
    expect(result.precipitateMassG).toBe(0);
  });

  it("precipitates above Ksp and conserves each reactive ion", () => {
    const input = inventoryFromSolutionPortions([
      { solutionId: "silver_nitrate", concentrationM: 0.1, volumeML: 25 },
      { solutionId: "sodium_chloride", concentrationM: 0.1, volumeML: 25 }
    ]);
    const result = solvePrecipitationEquilibrium(input);
    expect(result.formsPrecipitate).toBe(true);
    expect(result.precipitateId).toBe("silver_chloride");
    expect(result.color).toBe("white");
    expect(result.precipitateMassG).toBeGreaterThan(0.35);
    const dissolvedSilver = result.dissolvedIonConcentrationsM["Ag+"]!;
    const dissolvedChloride = result.dissolvedIonConcentrationsM["Cl-"]!;
    expect(dissolvedSilver * dissolvedChloride).toBeCloseTo(1.77e-10, 12);
    expect(
      dissolvedSilver * result.totalVolumeL + result.precipitateMoles
    ).toBeCloseTo(input.ionMoles["Ag+"]!, 13);
    expect(
      dissolvedChloride * result.totalVolumeL + result.precipitateMoles
    ).toBeCloseTo(input.ionMoles["Cl-"]!, 13);
  });

  it("produces the common-ion effect while retaining Q = Ksp", () => {
    const volumeL = 0.1;
    const pureWaterSolubilityM = Math.sqrt(1.77e-10);
    const result = solvePrecipitationEquilibrium({
      volumeL,
      ionMoles: {
        "Ag+": pureWaterSolubilityM * volumeL,
        "Cl-": (pureWaterSolubilityM + 0.01) * volumeL
      }
    });
    const silverM = result.dissolvedIonConcentrationsM["Ag+"]!;
    const chlorideM = result.dissolvedIonConcentrationsM["Cl-"]!;
    expect(silverM).toBeLessThan(pureWaterSolubilityM);
    expect(silverM * chlorideM).toBeCloseTo(1.77e-10, 12);
  });

  it("allows enough dilution to move an analytical mixture below Ksp", () => {
    const ionMoles = { "Ag+": 1e-8, "Cl-": 1e-8 } as const;
    expect(
      solvePrecipitationEquilibrium({ volumeL: 0.0001, ionMoles })
        .formsPrecipitate
    ).toBe(true);
    expect(
      solvePrecipitationEquilibrium({ volumeL: 1, ionMoles }).formsPrecipitate
    ).toBe(false);
  });

  it("is bit-identical across repeated fixed-step solves", () => {
    const input = inventoryFromSolutionPortions([
      { solutionId: "silver_nitrate", concentrationM: 0.1, volumeML: 20 },
      { solutionId: "sodium_chloride", concentrationM: 0.1, volumeML: 20 }
    ]);
    expect(JSON.stringify(solvePrecipitationEquilibrium(input))).toBe(
      JSON.stringify(solvePrecipitationEquilibrium(input))
    );
  });
});

describe("ledger-derived precipitation chemistry model", () => {
  it("declares the precipitation capability it provides", () => {
    expect(PRECIPITATION_MODULE.id).toBe(PRECIPITATION_MODEL_ID);
    expect(PRECIPITATION_MODULE.providedCapabilityIds).toEqual([
      "chemistry.precipitation_solubility.v1"
    ]);
  });

  it("uses transferred amounts and dilution rather than solution identity", () => {
    let ledger = initialLedger();
    let state = initialize(ledger);
    ({ ledger, state } = pour(
      state,
      ledger,
      "silver_stock",
      "silver_bottle",
      1
    ));
    ({ ledger, state } = pour(
      state,
      ledger,
      "chloride_stock",
      "chloride_bottle",
      1
    ));
    expect(fieldValue(state, "formsPrecipitate")).toBe(true);
    ({ ledger, state } = pour(
      state,
      ledger,
      "water_stock",
      "water_bottle",
      200
    ));
    expect(fieldValue(state, "totalVolumeL")).toBeCloseTo(0.202, 12);
    expect(fieldValue(state, "reactionQuotientBefore")).toBeCloseTo(
      Math.pow(0.0001 / 0.202, 2),
      14
    );
  });

  it("is order independent and reports registered quantitative observables", () => {
    let forwardLedger = initialLedger();
    let forward = initialize(forwardLedger);
    ({ ledger: forwardLedger, state: forward } = pour(
      forward,
      forwardLedger,
      "silver_stock",
      "silver_bottle",
      25
    ));
    ({ ledger: forwardLedger, state: forward } = pour(
      forward,
      forwardLedger,
      "chloride_stock",
      "chloride_bottle",
      25
    ));

    let reverseLedger = initialLedger();
    let reverse = initialize(reverseLedger);
    ({ ledger: reverseLedger, state: reverse } = pour(
      reverse,
      reverseLedger,
      "chloride_stock",
      "chloride_bottle",
      25
    ));
    ({ ledger: reverseLedger, state: reverse } = pour(
      reverse,
      reverseLedger,
      "silver_stock",
      "silver_bottle",
      25
    ));

    expect(reverse).toEqual(forward);
    const values = Object.fromEntries(
      PRECIPITATION_MODULE.deriveObservables(forward).map((entry) => [
        entry.observableId,
        entry.value
      ])
    );
    expect(values[PRECIPITATION_OBSERVABLE_IDS.precipitateObserved]).toBe(true);
    expect(values[PRECIPITATION_OBSERVABLE_IDS.precipitateColor]).toBe("white");
    expect(values[PRECIPITATION_OBSERVABLE_IDS.ionProduct]).toBeCloseTo(0.0025);
    expect(values[PRECIPITATION_OBSERVABLE_IDS.solubilityProduct]).toBe(
      1.77e-10
    );
    expect(
      values[PRECIPITATION_OBSERVABLE_IDS.precipitateMassG]
    ).toBeGreaterThan(0.35);
  });

  it("keeps solutions poured into separate vessels unreacted", () => {
    let ledger = initialLedger();
    let state = initialize(ledger);
    ({ ledger, state } = pour(
      state,
      ledger,
      "silver_stock",
      "silver_bottle",
      25,
      "vessel_a"
    ));
    ({ ledger, state } = pour(
      state,
      ledger,
      "chloride_stock",
      "chloride_bottle",
      25,
      "vessel_b"
    ));
    expect(fieldValue(state, "formsPrecipitate")).toBe(false);
  });

  it("preserves the identity-only compatibility helper", () => {
    expect(
      predictPrecipitation("silver_nitrate", "sodium_chloride")
    ).toMatchObject({
      precipitateId: "silver_chloride",
      netIonicEquation: "Ag+(aq) + Cl-(aq) → AgCl(s)"
    });
  });
});
