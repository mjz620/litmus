import { describe, expect, it } from "vitest";

import { EXAMPLE_STRONG } from "../../src/experiments/titration/titration";
import { DEFAULT_PRECIPITATION_CONFIG } from "../../src/experiments/precipitation/precipitation";
import {
  createLabStore,
  isTitrationState,
  LabStoreNotReadyError,
  type LabExperimentAction
} from "../../src/stores/labStore";
import {
  CheckpointQueue,
  type CheckpointRequest
} from "../../src/lib/persistence";

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
    const loadedState = requireTitrationState(loaded.state);
    expect(loadedState.titrantAddedML).toBe(22);
    expect(loadedState.buretteAvailableML).toBe(28);
    expect(loadedState.curve.at(-1)?.volumeML).toBe(22);
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
    const checkpoints: CheckpointRequest[] = [];
    const queue = new CheckpointQueue({
      async send(checkpoint) {
        checkpoints.push(checkpoint);
      }
    });
    const store = createLabStore({ checkpointQueue: queue });
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
    const updatedState = requireTitrationState(updated.state);
    expect(updatedState.titrantAddedML).toBeCloseTo(24.6, 10);
    expect(updatedState.buretteAvailableML).toBeCloseTo(25.4, 10);
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
    await queue.whenIdle();
    expect(checkpoints.find((checkpoint) => checkpoint.events)).toMatchObject({
      schemaVersion: "1",
      sessionId: "session-2",
      experimentVersion: "1.0.0",
      events: [{ clientEventId: "session-2:0", seq: 0 }]
    });
  });

  it("keeps dispatch synchronous when persistence fails", async () => {
    const queue = new CheckpointQueue({
      async send() {
        throw new Error("offline");
      }
    });
    const store = createLabStore({ checkpointQueue: queue });
    await store.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: "session-offline",
      config: EXAMPLE_STRONG
    });

    store.getState().dispatch({ type: "rinse_burette", solvent: "titrant" });
    expect(
      requireTitrationState(store.getState().state).buretteConditioned
    ).toBe(true);
    await queue.whenIdle();
    expect(store.getState().saveStatus).toBe("error");
  });

  it("dispatches fill through the engine and records routine success", async () => {
    const store = createLabStore();
    await store.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: "session-fill",
      config: EXAMPLE_STRONG
    });
    const action = {
      type: "fill_burette",
      volumeML: 50
    } satisfies LabExperimentAction;

    store.getState().dispatch(action);

    const updated = store.getState();
    expect(requireTitrationState(updated.state).buretteAvailableML).toBe(50);
    expect(updated.eventQueue).toEqual([
      expect.objectContaining({
        type: "fill_burette",
        flags: [],
        evidence: []
      })
    ]);
    expect(updated.studentModel?.activeFlags).toEqual([]);
  });

  it("preserves partial fills and refills in a final checkpoint", async () => {
    const checkpoints: CheckpointRequest[] = [];
    const queue = new CheckpointQueue({
      async send(checkpoint) {
        checkpoints.push(checkpoint);
      }
    });
    const store = createLabStore({ checkpointQueue: queue });
    await store.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: "11111111-1111-4111-8111-111111111148",
      config: EXAMPLE_STRONG
    });

    store.getState().dispatch({
      type: "select_indicator",
      indicator: "phenolphthalein"
    });
    store.getState().dispatch({ type: "fill_burette", volumeML: 30 });
    store.getState().dispatch({
      type: "add_titrant",
      volumeML: 20,
      durationS: 100
    });
    store.getState().dispatch({ type: "fill_burette", volumeML: 15 });
    store.getState().checkpoint(true);
    await queue.whenIdle();

    const finalState = checkpoints.at(-1)?.finalState;
    expect(isTitrationState(finalState as never)).toBe(true);
    expect(finalState).toMatchObject({
      titrantAddedML: 20,
      buretteAvailableML: 25,
      buretteReadingML: 25,
      fillCount: 2,
      fillHistory: [
        { kind: "initial", requestedML: 30 },
        { kind: "refill", requestedML: 15 }
      ]
    });
  });

  it("records retry parent provenance and new positive child evidence", async () => {
    const checkpoints: CheckpointRequest[] = [];
    const queue = new CheckpointQueue({
      async send(checkpoint) {
        checkpoints.push(checkpoint);
      }
    });
    const parentSessionId = "11111111-1111-4111-8111-111111111134";
    const childSessionId = "22222222-2222-4222-8222-222222222234";
    const store = createLabStore({ checkpointQueue: queue });
    await store.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: childSessionId,
      parentSessionId,
      config: EXAMPLE_STRONG,
      seed: {
        titrantAddedML: 22,
        buretteAvailableML: 28,
        buretteConditioned: true
      }
    });

    store.getState().dispatch({
      type: "add_titrant",
      volumeML: 2.5,
      durationS: 125
    });
    await queue.whenIdle();

    expect(
      store.getState().studentModel?.skills.endpoint_control
    ).toMatchObject({
      evidenceCount: 1,
      lastReason: "controlled_addition_near_endpoint"
    });
    expect(
      checkpoints.find((checkpoint) => checkpoint.events?.length)
    ).toMatchObject({
      sessionId: childSessionId,
      parentSessionId,
      events: [
        {
          payload: {
            evidence: [
              {
                skillId: "endpoint_control",
                delta: 0.5,
                reason: "controlled_addition_near_endpoint"
              }
            ]
          }
        }
      ]
    });
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

  it("uses the same store, event, model, and checkpoint path for precipitation", async () => {
    const store = createLabStore();
    await store.getState().loadExperiment({
      experimentId: "precipitation_solubility",
      sessionId: "11111111-1111-4111-8111-111111111112",
      config: DEFAULT_PRECIPITATION_CONFIG
    });
    store.getState().dispatch({
      type: "select_solution",
      slot: "A",
      solutionId: "silver_nitrate"
    });
    store.getState().dispatch({
      type: "select_solution",
      slot: "B",
      solutionId: "sodium_chloride"
    });
    store.getState().dispatch({ type: "mix_solutions" });
    expect(store.getState().eventQueue.map(({ type }) => type)).toEqual([
      "select_solution",
      "select_solution",
      "mix_solutions"
    ]);
    expect(store.getState().studentModel?.experimentId).toBe(
      "precipitation_solubility"
    );
  });
});

function requireTitrationState(
  state: ReturnType<ReturnType<typeof createLabStore>["getState"]>["state"]
) {
  if (!isTitrationState(state)) throw new Error("Expected titration state.");
  return state;
}
