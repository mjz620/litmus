import { describe, expect, it } from "vitest";

import {
  DEFAULT_PRECIPITATION_CONFIG,
  precipitation,
  predictPrecipitation
} from "../../src/experiments/precipitation/precipitation";
import { decideCoachTrigger } from "../../src/lib/agent/triggerPolicy";

describe("precipitation truth layer", () => {
  it.each([
    ["silver_nitrate", "sodium_chloride", "silver_chloride", "AgCl"],
    ["barium_chloride", "sodium_sulfate", "barium_sulfate", "BaSO4"],
    ["copper_sulfate", "sodium_hydroxide", "copper_ii_hydroxide", "Cu(OH)2"],
    ["iron_iii_chloride", "sodium_hydroxide", "iron_iii_hydroxide", "Fe(OH)3"]
  ] as const)("predicts %s + %s", (left, right, precipitateId, formula) => {
    expect(predictPrecipitation(left, right)).toMatchObject({
      formsPrecipitate: true,
      precipitateId,
      formula
    });
  });

  it("keeps an all-soluble nitrate/alkali-metal mix clear", () => {
    expect(
      predictPrecipitation("sodium_nitrate", "potassium_chloride")
    ).toMatchObject({
      formsPrecipitate: false,
      netIonicEquation: "No reaction"
    });
  });

  it("emits misconception evidence and explicit positive stay-silent evidence", () => {
    let state = precipitation.createInitialState(DEFAULT_PRECIPITATION_CONFIG);
    state = precipitation.step(state, {
      type: "select_solution",
      slot: "A",
      solutionId: "silver_nitrate"
    }).state;
    state = precipitation.step(state, {
      type: "select_solution",
      slot: "B",
      solutionId: "sodium_chloride"
    }).state;
    state = precipitation.step(state, { type: "mix_solutions" }).state;
    const wrong = precipitation.step(state, {
      type: "submit_precipitate_prediction",
      precipitateId: "none"
    }).events[0]!;
    const correct = precipitation.step(state, {
      type: "submit_precipitate_prediction",
      precipitateId: "silver_chloride"
    }).events[0]!;
    expect(wrong.flags).toContain("incorrect_precipitate_prediction");
    expect(decideCoachTrigger({ recentEvents: [wrong] }).shouldTrigger).toBe(
      true
    );
    expect(correct.flags).toEqual([]);
    expect(decideCoachTrigger({ recentEvents: [correct] }).shouldTrigger).toBe(
      false
    );
  });
});
