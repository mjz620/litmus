import { describe, expect, it } from "vitest";

import { EXAMPLE_STRONG } from "../../src/experiments/titration/titration";
import {
  createLabStore,
  LabStoreNotReadyError,
  type LabExperimentAction
} from "../../src/stores/labStore";

describe("lab store", () => {
  it("loads a seeded experiment, StudentModel, and empty event queue", async () => {
    const store = createLabStore();

    await store.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: "session-1",
      config: EXAMPLE_STRONG,
      seed: {
        sessionSeed: "recorded-seed",
        titrantAddedML: 22,
        buretteAvailableML: 28,
        buretteConditioned: true
      }
    });

    const loaded = store.getState();
    expect(loaded.status).toBe("ready");
    expect(loaded.experimentId).toBe("acid_base_titration");
    expect(loaded.sessionId).toBe("session-1");
    expect(loaded.definition?.id).toBe("acid_base_titration");
    expect(loaded.state?.sessionSeed).toBe("recorded-seed");
    expect(loaded.state?.titrantAddedML).toBe(22);
    expect(loaded.state?.buretteAvailableML).toBe(28);
    expect(loaded.state?.curve.at(-1)?.volumeML).toBe(22);
    expect(loaded.studentModel).toMatchObject({
      sessionId: "session-1",
      experimentId: "acid_base_titration",
      skills: {
        burette_conditioning: { mastery: 0.5, evidenceCount: 0 },
        endpoint_control: { mastery: 0.5, evidenceCount: 0 },
        volumetric_reading: { mastery: 0.5, evidenceCount: 0 },
        stoichiometry: { mastery: 0.5, evidenceCount: 0 }
      },
      activeFlags: []
    });
    expect(loaded.eventQueue).toEqual([]);
    expect(loaded.error).toBeNull();
  });

  it("dispatches a typed titration action into state and the event queue", async () => {
    const store = createLabStore();
    await store.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: "session-2",
      config: EXAMPLE_STRONG,
      seed: {
        titrantAddedML: 24.5,
        buretteAvailableML: 25.5,
        buretteConditioned: true
      }
    });
    const action = {
      type: "add_titrant",
      volumeML: 0.1,
      durationS: 4
    } satisfies LabExperimentAction;

    store.getState().dispatch(action);

    const updated = store.getState();
    expect(updated.state?.titrantAddedML).toBeCloseTo(24.6, 10);
    expect(updated.state?.buretteAvailableML).toBeCloseTo(25.4, 10);
    expect(updated.eventQueue).toHaveLength(1);
    expect(updated.eventQueue[0]).toMatchObject({
      type: "add_titrant",
      flags: [],
      evidence: [
        {
          skillId: "endpoint_control",
          delta: 0.5,
          reason: "controlled_addition_near_endpoint"
        }
      ]
    });
    expect(updated.studentModel?.skills.endpoint_control).toEqual({
      mastery: 0.575,
      evidenceCount: 1,
      lastReason: "controlled_addition_near_endpoint"
    });
  });

  it("dispatches fill through the engine and records routine success", async () => {
    const store = createLabStore();
    await store.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: "session-fill",
      config: EXAMPLE_STRONG
    });
    const action = { type: "fill_burette" } satisfies LabExperimentAction;

    store.getState().dispatch(action);

    const updated = store.getState();
    expect(updated.state?.buretteAvailableML).toBe(50);
    expect(updated.eventQueue).toEqual([
      expect.objectContaining({
        type: "fill_burette",
        flags: [],
        evidence: []
      })
    ]);
    expect(updated.studentModel?.activeFlags).toEqual([]);
  });

  it("appends events and folds negative evidence into the model", async () => {
    const store = createLabStore();
    await store.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: "session-3",
      config: EXAMPLE_STRONG
    });

    store.getState().dispatch({ type: "rinse_burette", solvent: "water" });
    store.getState().dispatch({
      type: "read_meniscus",
      reportedML: 1
    });

    const updated = store.getState();
    expect(updated.eventQueue.map(({ type }) => type)).toEqual([
      "rinse_burette",
      "read_meniscus"
    ]);
    expect(
      updated.studentModel?.skills.burette_conditioning.mastery
    ).toBeLessThan(0.5);
    expect(
      updated.studentModel?.skills.volumetric_reading.mastery
    ).toBeLessThan(0.5);
    expect(updated.studentModel?.activeFlags).toEqual([
      "burette_not_conditioned",
      "meniscus_misread"
    ]);
  });

  it("rejects dispatch before an experiment is ready", () => {
    const store = createLabStore();

    expect(() =>
      store.getState().dispatch({ type: "rinse_burette", solvent: "titrant" })
    ).toThrow(LabStoreNotReadyError);
  });
});
