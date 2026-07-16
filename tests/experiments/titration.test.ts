import { describe, expect, it } from "vitest";

import {
  computePH,
  equivalenceVolumeML,
  EXAMPLE_STRONG,
  EXAMPLE_WEAK,
  observedColor,
  titration
} from "../../src/experiments/titration/titration";

describe("titration chemistry (truth layer)", () => {
  it("calculates the equivalence volume for matched 0.100 M / 25.0 mL", () => {
    expect(equivalenceVolumeML(EXAMPLE_STRONG)).toBeCloseTo(25, 2);
  });

  it("increases pH monotonically as strong base is added to a strong acid", () => {
    let previous = -Infinity;

    for (let volumeML = 0; volumeML <= 45; volumeML += 0.5) {
      const pH = computePH(EXAMPLE_STRONG, volumeML, 1);
      expect(pH).toBeGreaterThan(previous);
      previous = pH;
    }
  });

  it("sets strong-acid/strong-base equivalence to pH 7", () => {
    expect(computePH(EXAMPLE_STRONG, 25, 1)).toBeCloseTo(7, 5);
  });

  it("sets weak-acid half-equivalence pH to pKa", () => {
    expect(computePH(EXAMPLE_WEAK, 12.5, 1)).toBeCloseTo(
      EXAMPLE_WEAK.analyte.pKa!,
      2
    );
  });

  it("sets the weak-acid equivalence point above pH 7", () => {
    expect(computePH(EXAMPLE_WEAK, 25, 1)).toBeGreaterThan(7);
  });

  it("shows phenolphthalein as colorless in acid and pink in base", () => {
    expect(observedColor("phenolphthalein", 3)).toBe("colorless");
    expect(observedColor("phenolphthalein", 11)).toBe("pink");
  });

  it("models a water-rinsed burette as a longer endpoint volume", () => {
    const cleanEquivalenceML = equivalenceVolumeML(EXAMPLE_STRONG, 1);
    const waterRinseEquivalenceML = equivalenceVolumeML(EXAMPLE_STRONG, 0.98);

    expect(waterRinseEquivalenceML).toBeGreaterThan(cleanEquivalenceML);
  });

  it("starts empty and fills to the configured burette capacity", () => {
    const initialState = titration.createInitialState(EXAMPLE_STRONG);

    expect(initialState.buretteAvailableML).toBe(0);

    const { state, events } = titration.step(initialState, {
      type: "fill_burette"
    });

    expect(state.buretteAvailableML).toBe(EXAMPLE_STRONG.buretteCapacityML);
    expect(events).toEqual([
      {
        type: "fill_burette",
        tSim: 0,
        observation: { capacityML: 50, availableML: 50 },
        flags: [],
        evidence: []
      }
    ]);
  });

  it("requires valid delivery within the available burette volume", () => {
    const initialState = titration.createInitialState(EXAMPLE_STRONG);

    expect(() =>
      titration.step(initialState, {
        type: "add_titrant",
        volumeML: 0.1,
        durationS: 4
      })
    ).toThrow("Fill the burette before adding titrant.");

    const filledState = titration.step(initialState, {
      type: "fill_burette"
    }).state;

    expect(() =>
      titration.step(filledState, {
        type: "add_titrant",
        volumeML: 50.01,
        durationS: 4
      })
    ).toThrow("Cannot add more titrant than remains in the burette.");
    expect(() =>
      titration.step(filledState, {
        type: "add_titrant",
        volumeML: 0,
        durationS: 4
      })
    ).toThrow("Titrant volume must be a positive number.");
    expect(() =>
      titration.step(filledState, {
        type: "add_titrant",
        volumeML: 0.1,
        durationS: 0
      })
    ).toThrow("Delivery time must be a positive number.");
    expect(filledState.buretteAvailableML).toBe(50);
  });

  it("consumes available volume and prevents preparation after filling", () => {
    const initialState = titration.createInitialState(EXAMPLE_STRONG);
    const filledState = titration.step(initialState, {
      type: "fill_burette"
    }).state;
    const deliveredState = titration.step(filledState, {
      type: "add_titrant",
      volumeML: 0.1,
      durationS: 4
    }).state;

    expect(deliveredState.titrantAddedML).toBeCloseTo(0.1, 10);
    expect(deliveredState.buretteAvailableML).toBeCloseTo(49.9, 10);
    expect(() =>
      titration.step(filledState, {
        type: "rinse_burette",
        solvent: "titrant"
      })
    ).toThrow("Cannot rinse a filled burette.");
    expect(() =>
      titration.step(deliveredState, { type: "fill_burette" })
    ).toThrow("The burette can only be filled once before titrant delivery.");
  });

  it("creates a consistent 22.00 mL intermediate seed and curve", () => {
    const state = titration.createInitialState(EXAMPLE_STRONG, {
      titrantAddedML: 22,
      buretteAvailableML: 28,
      buretteConditioned: true
    });

    expect(state.titrantAddedML).toBe(22);
    expect(state.buretteAvailableML).toBe(28);
    expect(state.curve.length).toBeGreaterThan(0);
    expect(state.curve.at(-1)).toEqual({
      volumeML: 22,
      pH: expect.any(Number)
    });
  });

  it("flags fast addition near the endpoint with negative evidence", () => {
    const state = titration.createInitialState(EXAMPLE_STRONG, {
      titrantAddedML: 24,
      buretteAvailableML: 26,
      buretteConditioned: true
    });
    const { events } = titration.step(state, {
      type: "add_titrant",
      volumeML: 2,
      durationS: 1
    });

    expect(events[0].flags).toContain("flow_rate_high_near_endpoint");
    expect(events[0].flags).toContain("endpoint_overshoot");
    expect(
      events[0].evidence.some(
        (evidence) =>
          evidence.skillId === "endpoint_control" && evidence.delta < 0
      )
    ).toBe(true);
  });

  it("keeps controlled dropwise addition near the endpoint unflagged", () => {
    const state = titration.createInitialState(EXAMPLE_STRONG, {
      titrantAddedML: 24.5,
      buretteAvailableML: 25.5,
      buretteConditioned: true
    });
    const { events } = titration.step(state, {
      type: "add_titrant",
      volumeML: 0.1,
      durationS: 4
    });

    expect(events[0].flags).not.toContain("flow_rate_high_near_endpoint");
  });
});
