import { describe, expect, it } from "vitest";

import { EXAMPLE_STRONG } from "../../src/experiments/titration/titration";
import { GENERIC_LAB_RUNTIME_SCHEMA_VERSION } from "../../src/lab-workflows/runtime";
import {
  CheckpointQueue,
  type CheckpointRequest
} from "../../src/lib/persistence";
import { createLabStore, isTitrationState } from "../../src/stores/labStore";
import {
  NATIVE_FULL_TITRATION_SETUP_SELECTION,
  createSetupDrivenNativeTitrationSession,
  normalizeSetupDrivenTitrationAction,
  resolveLabSessionRuntimeMode
} from "../../src/stores/setupDrivenLabSession";

describe("native titration runtime mode", () => {
  it("defaults titration to native_v2 and preserves the rollback params", () => {
    expect(resolveLabSessionRuntimeMode("acid_base_titration", undefined)).toBe(
      "native_v2"
    );
    expect(resolveLabSessionRuntimeMode("acid_base_titration", "native")).toBe(
      "native_v2"
    );
    // ?runtime=endpoint-drill now selects the native drill definition.
    expect(
      resolveLabSessionRuntimeMode("acid_base_titration", "endpoint-drill")
    ).toBe("native_v2");
    // Rollback paths: the strangler and the pure legacy engine stay reachable.
    expect(
      resolveLabSessionRuntimeMode("acid_base_titration", "setup-v2")
    ).toBe("setup_driven_v2");
    expect(resolveLabSessionRuntimeMode("acid_base_titration", "legacy")).toBe(
      "legacy"
    );
    // Unknown values fall to the default runtime, never to the legacy engine.
    expect(
      resolveLabSessionRuntimeMode("acid_base_titration", "unknown-value")
    ).toBe("native_v2");
    expect(
      resolveLabSessionRuntimeMode(
        "precipitation_agcl" as Parameters<
          typeof resolveLabSessionRuntimeMode
        >[0],
        "native"
      )
    ).toBe("legacy");
  });
});

describe("native titration session", () => {
  it("runs the full procedure on the capability ports and projects TitrationState", () => {
    const session = createSetupDrivenNativeTitrationSession({
      sessionId: "native-session-test",
      sessionSeed: "native-session-seed"
    });
    const workflow = session.getWorkflow();
    expect(workflow.id).toBe(NATIVE_FULL_TITRATION_SETUP_SELECTION.workflowId);
    expect(workflow.compatibility).toBeUndefined();
    expect(session.getInspection().executionKind).toBe("native_generic");
    expect(session.getGenericState().compatibilityState).toBeNull();

    const initial = session.getState();
    expect(initial.buretteAvailableML).toBe(0);
    expect(initial.buretteReadingML).toBe(50);
    expect(initial.indicatorAdded).toBe(false);
    expect(initial.buretteConditioned).toBe(false);
    expect(initial.config.buretteCapacityML).toBe(50);
    expect(initial.config.analyte.volumeML).toBe(25);
    expect(initial.config.indicator).toBe("phenolphthalein");

    const dispatchLegacy = (
      action: Parameters<typeof normalizeSetupDrivenTitrationAction>[0]
    ) =>
      session.dispatch(normalizeSetupDrivenTitrationAction(action, workflow));

    dispatchLegacy({ type: "rinse_burette", solvent: "titrant" });
    dispatchLegacy({ type: "fill_burette", volumeML: 50 });
    dispatchLegacy({
      type: "select_indicator",
      indicator: "phenolphthalein"
    });
    dispatchLegacy({ type: "read_meniscus", reportedML: 0 });
    const transition = dispatchLegacy({
      type: "add_titrant",
      volumeML: 0.5,
      durationS: 4
    });

    expect(transition.events).toHaveLength(1);
    expect(transition.events[0]).toMatchObject({
      type: "add_titrant",
      observation: expect.objectContaining({
        addedML: 0.5,
        pH: 1.02,
        observedColor: "colorless"
      })
    });
    const state = session.getState();
    expect(state.buretteConditioned).toBe(true);
    expect(state.indicatorAdded).toBe(true);
    expect(state.titrantAddedML).toBe(0.5);
    expect(state.buretteAvailableML).toBe(49.5);
    expect(state.buretteReadingML).toBe(0.5);
    expect(state.fillCount).toBe(1);
    expect(state.fillHistory).toEqual([
      {
        requestedML: 50,
        resultingAvailableML: 50,
        currentReadingML: 0,
        kind: "initial",
        tSim: 0
      }
    ]);
    expect(state.curve).toEqual([{ volumeML: 0.5, pH: 1.02 }]);
    expect(state.tSim).toBe(4);
    expect(state.titrantDilutionFactor).toBe(1);
    expect(session.getProjection().availablePermissionIds).toContain(
      "permission.dispense"
    );
  });

  it("loads through the lab store under native_v2 without changing other modes", async () => {
    const store = createLabStore();
    await store.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: "native-store-session",
      config: EXAMPLE_STRONG,
      runtimeMode: "native_v2"
    });
    const loaded = store.getState();
    expect(loaded.status).toBe("ready");
    expect(loaded.runtimeMode).toBe("native_v2");
    expect(loaded.runtimeInspection?.executionKind).toBe("native_generic");
    expect(loaded.runtimeInspection?.workflowId).toBe(
      NATIVE_FULL_TITRATION_SETUP_SELECTION.workflowId
    );
    expect(isTitrationState(loaded.state)).toBe(true);

    store.getState().dispatch({ type: "rinse_burette", solvent: "titrant" });
    store.getState().dispatch({ type: "fill_burette", volumeML: 50 });
    const updated = store.getState();
    expect(isTitrationState(updated.state)).toBe(true);
    if (isTitrationState(updated.state)) {
      expect(updated.state.buretteConditioned).toBe(true);
      expect(updated.state.buretteAvailableML).toBe(50);
    }
    expect(updated.eventQueue.map(({ type }) => type)).toEqual([
      "rinse_burette",
      "fill_burette"
    ]);
  });

  it("queues checkpoints for normalized native dispatches with full provenance", async () => {
    const checkpoints: CheckpointRequest[] = [];
    const queue = new CheckpointQueue({
      async send(checkpoint) {
        checkpoints.push(checkpoint);
      }
    });
    const store = createLabStore({ checkpointQueue: queue });
    await store.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: "native-checkpoint-session",
      config: EXAMPLE_STRONG,
      runtimeMode: "native_v2"
    });

    const projection = store.getState().runtimeProjection;
    expect(projection).not.toBeNull();
    const rinse = projection?.actions.find(
      ({ actionId }) => actionId === "action.rinse.v1"
    );
    expect(rinse).toBeDefined();
    if (!rinse) throw new Error("rinse action missing");

    // The native workspace dispatches actions it builds from the projection.
    const events = store.getState().dispatchNormalized({
      schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
      permissionId: rinse.permissionId,
      actionId: rinse.actionId,
      sourceEquipmentInstanceId: rinse.sourceEquipmentInstanceId ?? undefined,
      targetEquipmentInstanceIds: rinse.targetEquipmentInstanceIds,
      parameters: [{ key: "solvent", valueType: "enum", value: "titrant" }]
    });
    expect(events.map(({ type }) => type)).toEqual(["rinse_burette"]);
    await queue.whenIdle();

    // One checkpoint at load plus one per dispatch, exactly like the
    // strangler route.
    expect(checkpoints).toHaveLength(2);
    const last = checkpoints.at(-1);
    expect(last?.sessionId).toBe("native-checkpoint-session");
    expect(last?.events?.map(({ payload }) => payload.type)).toEqual([
      "rinse_burette"
    ]);
    expect(last?.labWorkflowContext).toBeDefined();
    expect(last?.normalizedActionTrace?.actions).toHaveLength(1);
    const updated = store.getState();
    expect(updated.eventQueue).toHaveLength(1);
    expect(updated.runtimeGenericState).not.toBeNull();
    expect(updated.studentModel?.skills.burette_conditioning.evidenceCount).toBe(
      1
    );
  });

  it("keeps the report submission path working over the native session", async () => {
    // The report route dispatches the legacy-shaped submit_report through the
    // shared store; on setup-driven and native sessions alike it falls
    // through to the legacy definition step over the projected TitrationState,
    // scoring against engine-owned ground truth. This is the same behavior
    // the pre-flip setup-driven default had.
    const store = createLabStore();
    await store.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: "native-report-session",
      config: EXAMPLE_STRONG,
      runtimeMode: "native_v2"
    });

    const accepted = store.getState().dispatch({
      type: "submit_report",
      reportedMolarityM: 0.1,
      explanation: "The endpoint volume fixes the analyte molarity."
    });
    expect(accepted).toBe(true);
    const submitted = store.getState();
    expect(
      isTitrationState(submitted.state) ? submitted.state.submitted : null
    ).toBe(true);
    const reportEvent = submitted.eventQueue.at(-1);
    expect(reportEvent?.type).toBe("submit_report");
    expect(typeof reportEvent?.observation.trueMolarityM).toBe("number");
    expect(typeof reportEvent?.observation.relErr).toBe("number");
  });
});
