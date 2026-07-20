import { describe, expect, it } from "vitest";

import {
  PRECIPITATION_MODEL_ID,
  PRECIPITATION_MODULE,
  PRECIPITATION_OBSERVABLE_IDS,
  predictPrecipitation
} from "../../../src/lab-workflows/chemistry-models/precipitation";
import type { GenericStateField } from "../../../src/lab-workflows/runtime/generic/types";

const SILVER = "reagent.silver_nitrate_0_100m.v1";
const CHLORIDE = "reagent.sodium_chloride_1_000m.v1";

const BINDINGS = [
  {
    instanceId: "silver_stock",
    materialProfileId: SILVER,
    containerInstanceId: "silver_bottle"
  },
  {
    instanceId: "chloride_stock",
    materialProfileId: CHLORIDE,
    containerInstanceId: "chloride_bottle"
  }
];

function initialize() {
  return PRECIPITATION_MODULE.initialize({
    equipmentBindings: [],
    materialBindings: BINDINGS,
    equipment: [],
    materialLedger: { materials: [] }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

function transfer(materialProfileId: string, target: string) {
  return {
    kind: "transfer" as const,
    materialInstanceId: `${materialProfileId}:instance`,
    materialProfileId,
    unitId: "unit.ml.v1",
    sourceEquipmentInstanceId: "source",
    targetEquipmentInstanceId: target,
    amount: 25,
    sourceAmountBefore: 50,
    sourceAmountAfter: 25,
    targetAmountBefore: 0,
    targetAmountAfter: 25
  };
}

function pour(
  state: readonly GenericStateField[],
  materialProfileId: string,
  target: string
) {
  return PRECIPITATION_MODULE.applyMaterialAction(
    {
      actionId: "action.pour_liquid.v1",
      sourceEquipmentInstanceId: "source",
      targetEquipmentInstanceIds: [target],
      materialInstanceIds: [`${materialProfileId}:instance`],
      transfers: [transfer(materialProfileId, target)]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    state
  ).state;
}

function fieldValue(state: readonly GenericStateField[], key: string) {
  return state.find((entry) => entry.key === key)?.value;
}

describe("precipitation chemistry model", () => {
  it("declares the precipitation capability it provides", () => {
    expect(PRECIPITATION_MODULE.id).toBe(PRECIPITATION_MODEL_ID);
    expect(PRECIPITATION_MODULE.providedCapabilityIds).toEqual([
      "chemistry.precipitation_solubility.v1"
    ]);
  });

  it("reports no precipitate before two solutions share a vessel", () => {
    const afterOnePour = pour(initialize(), SILVER, "vessel");
    expect(fieldValue(afterOnePour, "formsPrecipitate")).toBe(false);
    expect(fieldValue(afterOnePour, "precipitateColor")).toBe("clear");
  });

  it("forms silver chloride when both solutions reach the vessel", () => {
    let state = initialize();
    state = pour(state, SILVER, "vessel");
    state = pour(state, CHLORIDE, "vessel");

    expect(fieldValue(state, "formsPrecipitate")).toBe(true);
    expect(fieldValue(state, "precipitateId")).toBe("silver_chloride");
    expect(fieldValue(state, "precipitateFormula")).toBe("AgCl");
    expect(fieldValue(state, "precipitateColor")).toBe("white");
    expect(fieldValue(state, "netIonicEquation")).toBe(
      "Ag+(aq) + Cl-(aq) → AgCl(s)"
    );
    expect(fieldValue(state, "spectatorIons")).toEqual(["NO3-", "Na+"]);
  });

  it("matches the relocated solubility truth exactly", () => {
    let state = initialize();
    state = pour(state, SILVER, "vessel");
    state = pour(state, CHLORIDE, "vessel");

    const truth = predictPrecipitation("silver_nitrate", "sodium_chloride");
    expect(fieldValue(state, "precipitateId")).toBe(truth.precipitateId);
    expect(fieldValue(state, "netIonicEquation")).toBe(truth.netIonicEquation);
  });

  it("is order independent — pouring B then A gives the same result", () => {
    let forward = initialize();
    forward = pour(forward, SILVER, "vessel");
    forward = pour(forward, CHLORIDE, "vessel");

    let reverse = initialize();
    reverse = pour(reverse, CHLORIDE, "vessel");
    reverse = pour(reverse, SILVER, "vessel");

    expect(fieldValue(reverse, "precipitateId")).toBe(
      fieldValue(forward, "precipitateId")
    );
    expect(fieldValue(reverse, "netIonicEquation")).toBe(
      fieldValue(forward, "netIonicEquation")
    );
  });

  it("keeps solutions poured into separate vessels unreacted", () => {
    let state = initialize();
    state = pour(state, SILVER, "vessel_a");
    state = pour(state, CHLORIDE, "vessel_b");
    expect(fieldValue(state, "formsPrecipitate")).toBe(false);
  });

  it("projects precipitate presence and colour as observables", () => {
    let state = initialize();
    state = pour(state, SILVER, "vessel");
    state = pour(state, CHLORIDE, "vessel");

    expect(PRECIPITATION_MODULE.deriveObservables(state)).toEqual([
      {
        observableId: PRECIPITATION_OBSERVABLE_IDS.precipitateObserved,
        value: true
      },
      {
        observableId: PRECIPITATION_OBSERVABLE_IDS.precipitateColor,
        value: "white"
      }
    ]);
  });

  it("fails closed on a reagent with no solubility mapping", () => {
    expect(() =>
      pour(initialize(), "reagent.distilled_water.v1", "vessel")
    ).toThrow(/no registered solubility mapping/);
  });
});
