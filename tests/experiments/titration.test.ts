import { describe, expect, it } from "vitest";

import {
  computePH,
  equivalenceVolumeML,
  EXAMPLE_STRONG,
  EXAMPLE_WEAK,
  observedColor,
  titration
} from "../../src/experiments/titration/titration";

function addDefaultIndicator(
  state: ReturnType<typeof titration.createInitialState>
) {
  return titration.step(state, {
    type: "select_indicator",
    indicator: "phenolphthalein"
  }).state;
}

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

  it("adds one reviewed indicator and rejects changing or adding it twice", () => {
    const initial = titration.createInitialState(EXAMPLE_STRONG);
    const selected = titration.step(initial, {
      type: "select_indicator",
      indicator: "bromothymol_blue"
    });

    expect(initial.indicatorAdded).toBe(false);
    expect(selected.state.indicatorAdded).toBe(true);
    expect(selected.state.config.indicator).toBe("bromothymol_blue");
    expect(() =>
      titration.step(selected.state, {
        type: "select_indicator",
        indicator: "methyl_orange"
      })
    ).toThrow("Indicator has already been added and cannot be changed.");
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
      type: "fill_burette",
      volumeML: 50
    });

    expect(state.buretteAvailableML).toBe(EXAMPLE_STRONG.buretteCapacityML);
    expect(events).toEqual([
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
      type: "fill_burette",
      volumeML: 50
    }).state;

    expect(() =>
      titration.step(filledState, {
        type: "add_titrant",
        volumeML: 0.1,
        durationS: 4
      })
    ).toThrow("Add and confirm one indicator before adding titrant.");
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

  it("consumes available volume, prevents late rinsing, and permits a refill", () => {
    const initialState = addDefaultIndicator(
      titration.createInitialState(EXAMPLE_STRONG)
    );
    const filledState = titration.step(initialState, {
      type: "fill_burette",
      volumeML: 50
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
    ).toThrow("Cannot rinse a burette after filling has begun.");
    const refilledState = titration.step(deliveredState, {
      type: "fill_burette",
      volumeML: 0.1
    }).state;
    expect(refilledState.buretteAvailableML).toBe(50);
    expect(refilledState.titrantAddedML).toBeCloseTo(0.1, 10);
    expect(refilledState.buretteReadingML).toBe(0);
    expect(refilledState.fillCount).toBe(2);
  });

  it("tracks custom partial fills and cumulative delivery independently", () => {
    const initialState = addDefaultIndicator(
      titration.createInitialState(EXAMPLE_STRONG)
    );
    const firstFill = titration.step(initialState, {
      type: "fill_burette",
      volumeML: 30
    });
    const firstDelivery = titration.step(firstFill.state, {
      type: "add_titrant",
      volumeML: 10,
      durationS: 50
    });
    const refill = titration.step(firstDelivery.state, {
      type: "fill_burette",
      volumeML: 20
    });

    expect(firstFill.state.buretteAvailableML).toBe(30);
    expect(firstFill.state.buretteReadingML).toBe(20);
    expect(firstDelivery.state.titrantAddedML).toBe(10);
    expect(firstDelivery.state.buretteAvailableML).toBe(20);
    expect(firstDelivery.state.buretteReadingML).toBe(30);
    expect(refill.state.titrantAddedML).toBe(10);
    expect(refill.state.buretteAvailableML).toBe(40);
    expect(refill.state.buretteReadingML).toBe(10);
    expect(refill.state.fillHistory).toHaveLength(2);
    expect(refill.events[0]).toMatchObject({
      type: "refill_burette",
      observation: {
        requestedML: 20,
        resultingAvailableML: 40,
        currentReadingML: 10,
        fillKind: "refill"
      },
      flags: [],
      evidence: []
    });
  });

  it("rejects invalid fills without mutating the source state", () => {
    const initialState = titration.createInitialState(EXAMPLE_STRONG);

    expect(() =>
      titration.step(initialState, { type: "fill_burette", volumeML: 0 })
    ).toThrow("Fill volume must be a positive number.");
    expect(() =>
      titration.step(initialState, { type: "fill_burette", volumeML: 50.01 })
    ).toThrow("Fill volume exceeds remaining burette capacity.");
    expect(initialState.fillHistory).toEqual([]);
    expect(initialState.buretteAvailableML).toBe(0);
  });

  it("supports an endpoint that requires a second fill", () => {
    const config = {
      ...EXAMPLE_STRONG,
      analyte: {
        ...EXAMPLE_STRONG.analyte,
        concentrationM: 0.15,
        volumeML: 30
      },
      titrant: { ...EXAMPLE_STRONG.titrant, concentrationM: 0.075 }
    };
    const initial = addDefaultIndicator(titration.createInitialState(config));
    const conditioned = titration.step(initial, {
      type: "rinse_burette",
      solvent: "titrant"
    }).state;
    const filled = titration.step(conditioned, {
      type: "fill_burette",
      volumeML: 50
    }).state;
    const emptied = titration.step(filled, {
      type: "add_titrant",
      volumeML: 50,
      durationS: 250
    }).state;
    const refilled = titration.step(emptied, {
      type: "fill_burette",
      volumeML: 15
    }).state;
    const endpoint = titration.step(refilled, {
      type: "add_titrant",
      volumeML: 10,
      durationS: 50
    }).state;

    expect(equivalenceVolumeML(config)).toBeCloseTo(60, 8);
    expect(endpoint.titrantAddedML).toBe(60);
    expect(endpoint.buretteReadingML).toBe(45);
    expect(endpoint.buretteAvailableML).toBe(5);
    expect(endpoint.curve.at(-1)?.volumeML).toBe(60);
    expect(endpoint.curve.at(-1)?.pH).toBeCloseTo(7, 5);
    expect(endpoint.fillHistory.map((fill) => fill.kind)).toEqual([
      "initial",
      "refill"
    ]);
  });

  it("rejects a seeded reading that contradicts available volume", () => {
    expect(() =>
      titration.createInitialState(EXAMPLE_STRONG, {
        buretteAvailableML: 25,
        buretteReadingML: 10
      })
    ).toThrow("Seeded burette reading must match the available volume.");
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
