import { describe, expect, it, vi } from "vitest";

import type { ExperimentId } from "../../src/experiments/registry";

import {
  EXAMPLE_STRONG,
  titration
} from "../../src/experiments/titration/titration";
import {
  createLabStore,
  isTitrationState,
  LabStoreNotReadyError,
  type LabExperimentAction
} from "../../src/stores/labStore";
import type { CoachClient } from "../../src/lib/agent/client";
import { generateAuthoredCoachResponse } from "../../src/lib/agent/authoredCoach";
import {
  CheckpointQueue,
  type CheckpointRequest
} from "../../src/lib/persistence";
import {
  STRICT_TITRATION_SETUP_SELECTION,
  resolveLabSessionRuntimeMode
} from "../../src/stores/setupDrivenLabSession";
import { validateNativeTitrationV2 } from "../../src/lab-workflows/definitions/titration/native-endpoint-control";

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

  it("loads the exact serialized titration through the setup-driven store path", async () => {
    const store = createLabStore();
    const step = vi.spyOn(titration, "step");
    await store.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: "setup-driven-store",
      config: EXAMPLE_STRONG,
      seed: { sessionSeed: "setup-driven-seed" },
      runtimeMode: "setup_driven_v2",
      setupDrivenSelection: STRICT_TITRATION_SETUP_SELECTION,
      workflowVersionId: STRICT_TITRATION_SETUP_SELECTION.workflowHash
    });

    const initial = store.getState();
    expect(initial.status).toBe("ready");
    expect(initial.runtimeMode).toBe("setup_driven_v2");
    expect(initial.workflowVersionId).toBe(
      STRICT_TITRATION_SETUP_SELECTION.workflowHash
    );
    expect(initial.runtimeInspection).toMatchObject({
      mode: "setup_driven_v2",
      workflowId: STRICT_TITRATION_SETUP_SELECTION.workflowId,
      workflowHash: STRICT_TITRATION_SETUP_SELECTION.workflowHash,
      sequence: 0,
      runtimeAdapterId: "runtime-adapter.titration.v1",
      engineId: "engine.titration.v1",
      chemistryModels: [
        {
          modelId: "chemistry-model.legacy_titration.v1",
          version: "1.0.0"
        }
      ]
    });
    expect(initial.runtimeProjection).toMatchObject({
      workflowId: STRICT_TITRATION_SETUP_SELECTION.workflowId,
      equipment: [
        {
          instanceId: "titrant_burette",
          visualAdapterDefinitionId: "visual-adapter.burette.v1",
          placementSlotId: "placement.bench_center_stand.v1"
        },
        { instanceId: "analyte_flask" },
        { instanceId: "indicator_source" }
      ],
      actions: [
        {
          permissionId: "migration.permission.s1.a1",
          available: true,
          numericParameterBounds: [
            {
              parameterKey: "reportedML",
              effectiveMinimum: 0,
              effectiveMaximum: 50
            }
          ]
        },
        {
          permissionId: "migration.permission.s2.a1",
          available: false,
          authoredLimits: { maxVolumeMLPerAction: 0.5 },
          numericParameterBounds: [
            {
              parameterKey: "volumeML",
              registeredMinimum: 0.01,
              registeredMaximum: 50,
              authoredMinimum: null,
              authoredMaximum: 0.5,
              effectiveMinimum: 0.01,
              effectiveMaximum: 0.5
            },
            {
              parameterKey: "durationS",
              effectiveMinimum: 0.01,
              effectiveMaximum: 600
            }
          ]
        }
      ],
      availablePermissionIds: ["migration.permission.s1.a1"]
    });
    expect(initial.runtimeConsumerContext).toMatchObject({
      workflow: {
        id: STRICT_TITRATION_SETUP_SELECTION.workflowId,
        canonicalSpecHash: STRICT_TITRATION_SETUP_SELECTION.workflowHash
      },
      objectiveIds: ["endpoint_control", "meniscus_reading"],
      rubric: { id: "rubric.endpoint_control_prelab.seed.v1" },
      eventEnvelopes: []
    });
    expect(initial.runtimeActionTrace).toMatchObject({
      sessionId: "setup-driven-store",
      sessionSeed: "setup-driven-seed",
      actions: []
    });
    expect(requireTitrationState(initial.state)).toMatchObject({
      sessionSeed: "setup-driven-seed",
      titrantAddedML: 22,
      buretteAvailableML: 28,
      indicatorAdded: true
    });

    store.getState().dispatch({ type: "read_meniscus", reportedML: 22 });
    store.getState().dispatch({
      type: "add_titrant",
      volumeML: 0.5,
      durationS: 25
    });

    const updated = store.getState();
    expect(requireTitrationState(updated.state).titrantAddedML).toBe(22.5);
    expect(updated.eventQueue.map(({ type }) => type)).toEqual([
      "read_meniscus",
      "add_titrant"
    ]);
    expect(updated.runtimeInspection).toMatchObject({
      sequence: 2,
      eventSequence: 2
    });
    expect(updated.runtimeInspection?.eventIds).toHaveLength(2);
    expect(updated.runtimeConsumerContext?.eventEnvelopes).toHaveLength(2);
    expect(updated.runtimeActionTrace?.actions).toHaveLength(2);
    expect(updated.lastCheckpoint?.labWorkflowContext?.workflow).toMatchObject({
      id: STRICT_TITRATION_SETUP_SELECTION.workflowId,
      canonicalSpecHash: STRICT_TITRATION_SETUP_SELECTION.workflowHash
    });
    expect(updated.lastCheckpoint?.normalizedActionTrace?.actions).toHaveLength(
      2
    );
    expect(updated.runtimeProjection?.availablePermissionIds).toEqual([
      "migration.permission.s2.a1"
    ]);
    expect(step).toHaveBeenCalledTimes(2);
    step.mockRestore();
  });

  it("contains typed setup action errors without mutating state, events, or replay", async () => {
    const store = createLabStore();
    await store.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: "setup-driven-contained-error",
      config: EXAMPLE_STRONG,
      runtimeMode: "setup_driven_v2",
      setupDrivenSelection: STRICT_TITRATION_SETUP_SELECTION
    });
    expect(
      store.getState().dispatch({ type: "read_meniscus", reportedML: 22 })
    ).toBe(true);
    const before = store.getState();

    expect(
      store.getState().dispatch({
        type: "add_titrant",
        volumeML: 0.500001,
        durationS: 25
      })
    ).toBe(false);
    expect(store.getState().actionError).toMatchObject({
      code: "generic-runtime.parameter_invalid.v1",
      details: {
        submittedValue: 0.500001,
        authoredMaximum: 0.5,
        effectiveMaximum: 0.5
      }
    });

    expect(
      store.getState().dispatch({
        type: "add_titrant",
        volumeML: 0.005,
        durationS: 0.1
      })
    ).toBe(false);

    const rejected = store.getState();
    expect(rejected.state).toBe(before.state);
    expect(rejected.eventQueue).toBe(before.eventQueue);
    expect(rejected.runtimeActionTrace).toBe(before.runtimeActionTrace);
    expect(rejected.lastCheckpoint).toBe(before.lastCheckpoint);
    expect(rejected.actionError).toMatchObject({
      code: "generic-runtime.parameter_invalid.v1",
      actionType: "add_titrant",
      details: {
        submittedValue: 0.005,
        registeredMinimum: 0.01,
        registeredMaximum: 50,
        authoredMaximum: 0.5,
        effectiveMinimum: 0.01,
        effectiveMaximum: 0.5
      }
    });
    expect(rejected.actionError?.message).toContain("0.01 to 0.5");

    store.getState().clearActionError();
    expect(store.getState().actionError).toBeNull();
    expect(
      store.getState().dispatch({
        type: "add_titrant",
        volumeML: 0.5,
        durationS: 25
      })
    ).toBe(true);
    expect(store.getState().actionError).toBeNull();
  });

  it("contains a stale terminal setup action but still surfaces unknown legacy errors", async () => {
    const setupStore = createLabStore();
    await setupStore.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: "setup-driven-terminal-error",
      config: EXAMPLE_STRONG,
      runtimeMode: "setup_driven_v2",
      setupDrivenSelection: STRICT_TITRATION_SETUP_SELECTION
    });
    setupStore.getState().dispatch({ type: "read_meniscus", reportedML: 22 });
    for (let index = 0; index < 6; index += 1) {
      expect(
        setupStore.getState().dispatch({
          type: "add_titrant",
          volumeML: 0.5,
          durationS: 25
        })
      ).toBe(true);
    }
    expect(
      setupStore.getState().dispatch({
        type: "add_titrant",
        volumeML: 0.1,
        durationS: 5
      })
    ).toBe(true);
    const completed = setupStore.getState();
    expect(completed.runtimeProjection?.availablePermissionIds).toEqual([]);
    expect(
      setupStore.getState().dispatch({
        type: "add_titrant",
        volumeML: 0.01,
        durationS: 1
      })
    ).toBe(false);
    expect(setupStore.getState().state).toBe(completed.state);
    expect(setupStore.getState().eventQueue).toBe(completed.eventQueue);
    expect(setupStore.getState().runtimeActionTrace).toBe(
      completed.runtimeActionTrace
    );
    expect(setupStore.getState().actionError).toMatchObject({
      code: "generic-runtime.workflow_terminal.v1"
    });

    const legacyStore = createLabStore();
    await legacyStore.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: "legacy-unknown-error",
      config: EXAMPLE_STRONG
    });
    expect(() =>
      legacyStore.getState().dispatch({
        type: "add_titrant",
        volumeML: -1,
        durationS: 1
      })
    ).toThrow(RangeError);
    expect(legacyStore.getState().actionError).toBeNull();
  });

  it("previews an exact teacher-validated definition through the same generic coordinator", async () => {
    const workflow = validateNativeTitrationV2("2026-07-18T08:15:00.000Z");
    const selection = {
      workflowId: workflow.id,
      workflowHash: workflow.validation.canonicalSpecHash
    };
    const store = createLabStore();
    const step = vi.spyOn(titration, "step");

    await store.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: "composer-preview-store",
      config: EXAMPLE_STRONG,
      seed: { sessionSeed: "composer-preview-seed" },
      mode: "preview",
      runtimeMode: "setup_driven_v2",
      setupDrivenSelection: selection,
      setupDrivenWorkflow: workflow,
      workflowVersionId: workflow.validation.canonicalSpecHash
    });

    expect(store.getState()).toMatchObject({
      status: "ready",
      mode: "preview",
      runtimeInspection: {
        workflowId: workflow.id,
        workflowHash: workflow.validation.canonicalSpecHash,
        runtimeAdapterId: "runtime-adapter.titration.v1"
      },
      runtimeProjection: {
        availablePermissionIds: [
          "migration.permission.s1.a1",
          "migration.permission.s2.a1"
        ]
      }
    });

    store.getState().dispatch({ type: "read_meniscus", reportedML: 22 });
    expect(store.getState().runtimeActionTrace?.actions).toHaveLength(1);
    expect(
      store.getState().runtimeConsumerContext?.eventEnvelopes
    ).toHaveLength(1);
    expect(step).toHaveBeenCalledTimes(1);
    step.mockRestore();
  });

  it("clears the setup runtime when the same store reloads in legacy mode", async () => {
    const store = createLabStore();
    await store.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: "setup-before-reload",
      config: EXAMPLE_STRONG,
      runtimeMode: "setup_driven_v2",
      setupDrivenSelection: STRICT_TITRATION_SETUP_SELECTION
    });
    expect(store.getState().runtimeInspection).not.toBeNull();

    await store.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: "legacy-after-reload",
      config: EXAMPLE_STRONG,
      runtimeMode: "legacy"
    });
    store.getState().dispatch({ type: "rinse_burette", solvent: "titrant" });

    expect(store.getState().runtimeMode).toBe("legacy");
    expect(store.getState().runtimeInspection).toBeNull();
    expect(store.getState().runtimeConsumerContext).toBeNull();
    expect(store.getState().runtimeActionTrace).toBeNull();
    expect(
      requireTitrationState(store.getState().state).buretteConditioned
    ).toBe(true);
  });

  it("preserves report submission without inventing an unregistered normalized action", async () => {
    const store = createLabStore();
    const step = vi.spyOn(titration, "step");
    await store.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: "setup-driven-report",
      config: EXAMPLE_STRONG,
      runtimeMode: "setup_driven_v2",
      setupDrivenSelection: STRICT_TITRATION_SETUP_SELECTION
    });
    store.getState().dispatch({
      type: "submit_report",
      reportedMolarityM: 0.1,
      explanation: "Evidence-grounded setup-driven report"
    });

    expect(requireTitrationState(store.getState().state).submitted).toBe(true);
    expect(store.getState().eventQueue.at(-1)).toMatchObject({
      type: "submit_report"
    });
    expect(store.getState().runtimeActionTrace?.actions).toEqual([]);
    expect(store.getState().runtimeConsumerContext?.eventEnvelopes).toEqual([]);
    expect(step).toHaveBeenCalledTimes(1);
    step.mockRestore();
  });

  it("does not mix a legacy report flag into authored Coach evidence", async () => {
    const coachRequests: Parameters<CoachClient["request"]>[0][] = [];
    const store = createLabStore({
      coachClient: {
        async request(input) {
          coachRequests.push(input);
          return {
            shouldRespond: false,
            interventionType: "none",
            skillIds: [],
            hintLevel: 0,
            message: "",
            evidenceEventTypes: [],
            safety: { refused: false }
          };
        }
      }
    });
    await store.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: "native-report-coach-grounding",
      config: EXAMPLE_STRONG,
      runtimeMode: "native_v2"
    });

    expect(
      store
        .getState()
        .dispatch({ type: "rinse_burette", solvent: "titrant" })
    ).toBe(true);
    expect(
      store.getState().dispatch({ type: "fill_burette", volumeML: 50 })
    ).toBe(true);
    expect(
      store.getState().dispatch({
        type: "select_indicator",
        indicator: "phenolphthalein"
      })
    ).toBe(true);
    expect(
      store.getState().dispatch({ type: "read_meniscus", reportedML: 0 })
    ).toBe(true);
    for (let addition = 0; addition < 51; addition += 1) {
      expect(
        store.getState().dispatch({
          type: "add_titrant",
          volumeML: 0.5,
          durationS: 1
        })
      ).toBe(true);
    }
    await flushMicrotasks();
    expect(
      coachRequests.some((request) => "contractVersion" in request)
    ).toBe(true);

    expect(
      store.getState().dispatch({
        type: "submit_report",
        reportedMolarityM: 1,
        explanation: "Deliberately outside tolerance"
      })
    ).toBe(true);
    await flushMicrotasks();

    const reportRequest = coachRequests.at(-1);
    expect(reportRequest).toBeDefined();
    expect(reportRequest).not.toHaveProperty("contractVersion");
    expect(reportRequest).toMatchObject({
      recentEvents: expect.arrayContaining([
        expect.objectContaining({ flags: ["result_out_of_tolerance"] })
      ]),
      triggerPolicy: { source: "event" }
    });
  });

  it("keeps setup-driven simulation synchronous while checkpoint and coach work wait", async () => {
    let releaseCheckpoint!: () => void;
    const checkpointBlocked = new Promise<void>((resolve) => {
      releaseCheckpoint = resolve;
    });
    let releaseCoach!: () => void;
    const coachBlocked = new Promise<void>((resolve) => {
      releaseCoach = resolve;
    });
    let coachRequested = false;
    const queue = new CheckpointQueue({
      async send() {
        await checkpointBlocked;
      }
    });
    const store = createLabStore({
      checkpointQueue: queue,
      coachClient: {
        async request() {
          coachRequested = true;
          await coachBlocked;
          return {
            shouldRespond: false,
            interventionType: "none",
            skillIds: [],
            hintLevel: 0,
            message: "",
            evidenceEventTypes: [],
            safety: { refused: false }
          };
        }
      }
    });
    await store.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: "setup-driven-nonblocking",
      config: EXAMPLE_STRONG,
      runtimeMode: "setup_driven_v2",
      setupDrivenSelection: STRICT_TITRATION_SETUP_SELECTION
    });
    store.getState().dispatch({ type: "read_meniscus", reportedML: 22 });
    for (let index = 0; index < 5; index += 1) {
      store.getState().dispatch({
        type: "add_titrant",
        volumeML: 0.5,
        durationS: 25
      });
    }

    const before = performance.now();
    store.getState().dispatch({
      type: "add_titrant",
      volumeML: 0.5,
      durationS: 0.1
    });
    const elapsed = performance.now() - before;

    expect(elapsed).toBeLessThan(50);
    expect(requireTitrationState(store.getState().state).titrantAddedML).toBe(
      25
    );
    expect(store.getState().lastCheckpoint?.events?.at(-1)?.payload.type).toBe(
      "add_titrant"
    );
    expect(coachRequested).toBe(true);
    expect(store.getState().coachStatus).toBe("loading");
    const coachRequest = store.getState().lastCoachRequest;
    expect(coachRequest).toMatchObject({
      contractVersion: "2.0.0",
      workflowContext: {
        definitionHash: STRICT_TITRATION_SETUP_SELECTION.workflowHash,
        runtime: {
          workflowId: STRICT_TITRATION_SETUP_SELECTION.workflowId,
          workflowHash: STRICT_TITRATION_SETUP_SELECTION.workflowHash
        }
      }
    });

    releaseCheckpoint();
    releaseCoach();
    await queue.whenIdle();
  });

  it("uses exact authored Coach context for direct questions without mutating the lab", async () => {
    const coachClient: CoachClient = {
      async request(input) {
        if (!("contractVersion" in input)) {
          throw new Error("Expected authored Coach context.");
        }
        return generateAuthoredCoachResponse(input);
      }
    };
    const store = createLabStore({ coachClient });
    await store.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: "authored-coach-question",
      config: EXAMPLE_STRONG,
      runtimeMode: "setup_driven_v2",
      setupDrivenSelection: STRICT_TITRATION_SETUP_SELECTION
    });
    const before = JSON.stringify(store.getState().state);

    await store.getState().askCoach("What should I focus on first?");

    expect(JSON.stringify(store.getState().state)).toBe(before);
    expect(store.getState().lastCoachRequest).toMatchObject({
      contractVersion: "2.0.0",
      workflowContext: {
        definitionHash: STRICT_TITRATION_SETUP_SELECTION.workflowHash,
        activeObjectiveIds: ["endpoint_control", "meniscus_reading"]
      },
      triggerPolicy: {
        source: "question",
        reasons: ["student_question"],
        maxHintLevel: 3
      }
    });
    expect(store.getState().coachMessages.at(-1)?.response).toMatchObject({
      contractVersion: "2.0.0",
      shouldRespond: true,
      guidance: { kind: "ai_guidance" },
      authority: { simulationStateChanged: false }
    });
    expect(store.getState().coachStatus).toBe("idle");
  });

  it("keeps setup-driven controls usable and returns local guidance when coaching is unavailable", async () => {
    const store = createLabStore({
      coachClient: {
        async request() {
          throw new Error("Coach service offline");
        }
      }
    });
    await store.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: "authored-coach-offline",
      config: EXAMPLE_STRONG,
      runtimeMode: "setup_driven_v2",
      setupDrivenSelection: STRICT_TITRATION_SETUP_SELECTION
    });

    await store.getState().askCoach("What should I do?");
    const dispatched = store.getState().dispatch({
      type: "read_meniscus",
      reportedML: 22
    });

    expect(store.getState()).toMatchObject({
      coachStatus: "idle",
      coachError: null
    });
    expect(store.getState().coachMessages.at(-1)).toMatchObject({
      role: "coach",
      text: expect.stringContaining("next available lab step")
    });
    expect(store.getState().coachMessages.at(-1)?.text).not.toMatch(
      /offline|503|service/i
    );
    expect(dispatched).toBe(true);
    expect(store.getState().eventQueue.at(-1)?.type).toBe("read_meniscus");
  });

  it("fails closed for a missing or stale setup-driven selection", async () => {
    const store = createLabStore();
    await expect(
      store.getState().loadExperiment({
        experimentId: "acid_base_titration",
        sessionId: "setup-driven-missing",
        config: EXAMPLE_STRONG,
        runtimeMode: "setup_driven_v2"
      })
    ).rejects.toThrow("exact setup-driven workflow ID and hash");
    expect(store.getState()).toMatchObject({
      status: "error",
      runtimeMode: "setup_driven_v2",
      runtimeInspection: null
    });

    await expect(
      store.getState().loadExperiment({
        experimentId: "acid_base_titration",
        sessionId: "setup-driven-stale",
        config: EXAMPLE_STRONG,
        runtimeMode: "setup_driven_v2",
        setupDrivenSelection: {
          ...STRICT_TITRATION_SETUP_SELECTION,
          workflowHash:
            "sha256:0000000000000000000000000000000000000000000000000000000000000000"
        } as unknown as typeof STRICT_TITRATION_SETUP_SELECTION
      })
    ).rejects.toThrow("definition is stale, ineligible");
    expect(store.getState().status).toBe("error");
  });

  it("defaults titration to native_v2 and keeps explicit rollback escape hatches", () => {
    expect(resolveLabSessionRuntimeMode("acid_base_titration", undefined)).toBe(
      "native_v2"
    );
    expect(
      resolveLabSessionRuntimeMode("acid_base_titration", "setup-v2")
    ).toBe("setup_driven_v2");
    expect(
      resolveLabSessionRuntimeMode("acid_base_titration", "legacy")
    ).toBe("legacy");
    // Only titration has a setup-driven runtime. The guard stays for future
    // experiments, so it is exercised past the single-member union.
    expect(
      resolveLabSessionRuntimeMode(
        "some_other_experiment" as ExperimentId,
        "setup-v2"
      )
    ).toBe("legacy");
  });

  it("does not persist checkpoints in teacher preview mode", async () => {
    const sent: CheckpointRequest[] = [];
    const queue = new CheckpointQueue({
      async send(checkpoint) {
        sent.push(checkpoint);
      }
    });
    const store = createLabStore({ checkpointQueue: queue });
    await store.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: "00000000-0000-4000-8000-000000000001",
      mode: "preview",
      config: EXAMPLE_STRONG,
      seed: {
        titrantAddedML: 24.5,
        buretteAvailableML: 25.5,
        buretteConditioned: true
      }
    });

    store
      .getState()
      .dispatch({ type: "add_titrant", volumeML: 0.1, durationS: 4 });
    store.getState().checkpoint(true);
    await queue.whenIdle();

    expect(sent).toEqual([]);
    expect(store.getState().lastCheckpoint).toBeNull();
  });

  it("auto-triggers the coach once per ongoing error, but again for a distinct error", async () => {
    let coachCalls = 0;
    const coachClient: CoachClient = {
      async request() {
        coachCalls += 1;
        return {
          shouldRespond: false,
          interventionType: "none",
          skillIds: [],
          hintLevel: 0,
          message: "",
          evidenceEventTypes: [],
          safety: { refused: false }
        };
      }
    };
    const store = createLabStore({ coachClient });
    await store.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: "coach-dedupe",
      config: EXAMPLE_STRONG,
      seed: {
        titrantAddedML: 23,
        buretteAvailableML: 27,
        buretteConditioned: true
      }
    });

    // Three fast additions near the endpoint raise the same flag each time. The
    // coach must fire once for that ongoing error, not once per action.
    for (let i = 0; i < 3; i += 1) {
      store.getState().dispatch({
        type: "add_titrant",
        volumeML: 0.2,
        durationS: 0.05
      });
    }
    await flushMicrotasks();
    expect(store.getState().lastCoachRequest?.triggerPolicy.source).toBe(
      "event"
    );
    expect(coachCalls).toBe(1);

    // A distinct error (endpoint overshoot) is a new reason and coaches again.
    store.getState().dispatch({
      type: "add_titrant",
      volumeML: 2,
      durationS: 0.05
    });
    await flushMicrotasks();
    expect(coachCalls).toBe(2);
  });
});

async function flushMicrotasks() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function requireTitrationState(
  state: ReturnType<ReturnType<typeof createLabStore>["getState"]>["state"]
) {
  if (!isTitrationState(state)) throw new Error("Expected titration state.");
  return state;
}
