import { describe, expect, it, vi } from "vitest";

import { replayTitrationActions } from "../../../../src/experiments/titration/replay";
import { titration } from "../../../../src/experiments/titration/titration";
import {
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  adaptNormalizedTitrationAction,
  assembleGenericLabRuntime,
  createLegacyTitrationRuntimePorts,
  type NormalizedLabAction
} from "../../../../src/lab-workflows/runtime";
import {
  createGenericLabActionTrace,
  replayGenericLabActionTrace
} from "../../../../src/lab-workflows/replay";
import { migrateLabWorkflowV1ToV2 } from "../../../../src/lab-workflows/schema/migration";
import { validateLabWorkflowSpecV2 } from "../../../../src/lab-workflows/validation";
import {
  ENDPOINT_CONTROL_PRELAB_DRAFT,
  ENDPOINT_CONTROL_PRELAB_REPLAY_ACTIONS,
  ENDPOINT_CONTROL_PRELAB_REPLAY_SESSION_SEED
} from "../../../../src/lab-workflows/seeds";

const CHECKED_AT = "2026-07-18T01:00:00.000Z";

function validatedWorkflow() {
  const outcome = validateLabWorkflowSpecV2(
    migrateLabWorkflowV1ToV2(ENDPOINT_CONTROL_PRELAB_DRAFT),
    { checkedAt: CHECKED_AT }
  );
  expect(outcome.schemaValid).toBe(true);
  if (!outcome.schemaValid) throw new Error("Expected migrated workflow");
  expect(outcome.validation).toMatchObject({
    status: "runnable",
    runnable: true
  });
  return outcome.spec;
}

function normalizedTrace(): readonly NormalizedLabAction[] {
  return ENDPOINT_CONTROL_PRELAB_REPLAY_ACTIONS.map(({ action }) => {
    switch (action.type) {
      case "read_meniscus":
        return {
          schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
          permissionId: "migration.permission.s1.a1",
          actionId: "action.read_volume.v1",
          sourceEquipmentInstanceId: "titrant_burette",
          targetEquipmentInstanceIds: [],
          parameters: [
            { key: "reportedML", valueType: "number", value: action.reportedML }
          ]
        };
      case "add_titrant":
        return {
          schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
          permissionId: "migration.permission.s2.a1",
          actionId: "action.dispense.v1",
          sourceEquipmentInstanceId: "titrant_burette",
          targetEquipmentInstanceIds: ["analyte_flask"],
          parameters: [
            { key: "volumeML", valueType: "number", value: action.volumeML },
            { key: "durationS", valueType: "number", value: action.durationS }
          ]
        };
      default:
        throw new Error("Unsupported canonical action");
    }
  });
}

describe("legacy titration compatibility runtime", () => {
  it("maps only the exact registered normalized action vocabulary", () => {
    const base = {
      schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
      permissionId: "test.permission",
      sourceEquipmentInstanceId: "test.source",
      targetEquipmentInstanceIds: []
    } as const;
    expect(
      adaptNormalizedTitrationAction({
        ...base,
        actionId: "action.rinse.v1",
        parameters: [{ key: "solvent", valueType: "enum", value: "water" }]
      })
    ).toEqual({ type: "rinse_burette", solvent: "water" });
    expect(
      adaptNormalizedTitrationAction({
        ...base,
        actionId: "action.fill.v1",
        parameters: [{ key: "volumeML", valueType: "number", value: 20 }]
      })
    ).toEqual({ type: "fill_burette", volumeML: 20 });
    expect(
      adaptNormalizedTitrationAction({
        ...base,
        actionId: "action.select_indicator.v1",
        parameters: [
          { key: "indicator", valueType: "enum", value: "bromothymol_blue" }
        ]
      })
    ).toEqual({ type: "select_indicator", indicator: "bromothymol_blue" });
    expect(() =>
      adaptNormalizedTitrationAction({
        ...base,
        actionId: "action.submit_report.v1",
        parameters: []
      })
    ).toThrowError(
      expect.objectContaining({ code: "legacy-titration.mapping_missing" })
    );
    expect(() =>
      adaptNormalizedTitrationAction({
        ...base,
        actionId: "action.fill.v1",
        parameters: [
          { key: "volumeML", valueType: "number", value: 20 },
          { key: "extra", valueType: "number", value: 1 }
        ]
      })
    ).toThrowError(
      expect.objectContaining({ code: "legacy-titration.parameter_invalid" })
    );
  });

  it("runs the canonical seed through legacy step exactly once per action with full parity", () => {
    const workflow = validatedWorkflow();
    const ports = createLegacyTitrationRuntimePorts(workflow);
    const runtime = assembleGenericLabRuntime(
      workflow,
      {
        schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
        sessionId: "legacy-titration-parity",
        sessionSeed: ENDPOINT_CONTROL_PRELAB_REPLAY_SESSION_SEED,
        workflowId: workflow.id,
        workflowRevision: workflow.revision,
        workflowHash: workflow.validation.canonicalSpecHash
      },
      ports
    );
    const initial = runtime.getState();
    expect(initial.provenance.compatibility).toEqual({
      kind: "legacy_v1",
      runtimeAdapterId: "runtime-adapter.titration.v1",
      runtimeAdapterVersion: "1.0.0",
      engineId: "engine.titration.v1",
      engineVersion: "1.0.0",
      experimentDefinitionId: "acid_base_titration",
      experimentDefinitionVersion: "1.0.0"
    });
    expect(initial.provenance.resolvedChemistryModels).toEqual([
      expect.objectContaining({
        modelId: "chemistry-model.legacy_titration.v1",
        version: "1.0.0"
      })
    ]);
    expect(initial.materialLedger.materials).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          materialInstanceId: "titrant",
          locations: [
            { equipmentInstanceId: "analyte_flask", amount: 22 },
            { equipmentInstanceId: "titrant_burette", amount: 28 }
          ]
        }),
        expect.objectContaining({
          materialInstanceId: "indicator",
          locations: [{ equipmentInstanceId: "analyte_flask", amount: 2 }]
        })
      ])
    );

    const actions = normalizedTrace();
    const direct = replayTitrationActions(
      JSON.parse(initial.compatibilityState!.serializedState).config,
      ENDPOINT_CONTROL_PRELAB_REPLAY_ACTIONS.map(({ action }) => action),
      JSON.parse(initial.compatibilityState!.serializedState)
    );
    const step = vi.spyOn(titration, "step");
    const events = [];
    for (const action of actions) {
      const transition = runtime.dispatch(action);
      events.push(...transition.events);
      expect(transition.eventEnvelopes.at(-1)?.payload).toEqual(
        transition.events.at(-1)
      );
    }
    const finalState = runtime.getState();
    expect(step).toHaveBeenCalledTimes(actions.length);
    expect(JSON.parse(finalState.compatibilityState!.serializedState)).toEqual(
      direct.state
    );
    expect(events).toEqual(direct.events);
    expect(runtime.definition.getGroundTruth(finalState)).toEqual(
      titration.getGroundTruth(direct.state)
    );
    expect(finalState.workflowStatus).toBe("completed");
    expect(finalState.eventEnvelopes.map(({ payload }) => payload)).toEqual(
      direct.events
    );
  });

  it("replays the serialized normalized trace deterministically with its stored seed", () => {
    const workflow = validatedWorkflow();
    const trace = createGenericLabActionTrace({
      traceId: "trace.legacy_titration.parity.v1",
      sessionId: "legacy-titration-replay",
      sessionSeed: ENDPOINT_CONTROL_PRELAB_REPLAY_SESSION_SEED,
      workflow,
      actions: normalizedTrace()
    });
    const first = replayGenericLabActionTrace(trace, {
      workflow,
      ports: createLegacyTitrationRuntimePorts(workflow)
    });
    const second = replayGenericLabActionTrace(trace, {
      workflow,
      ports: createLegacyTitrationRuntimePorts(workflow)
    });
    expect(first.finalState).toEqual(second.finalState);
    expect(first.finalState.workflowStatus).toBe("completed");
    expect(first.finalState.compatibilityState).not.toBeNull();
  });

  it("retains direct report truth without inventing an unregistered normalized action", () => {
    const workflow = validatedWorkflow();
    const runtime = assembleGenericLabRuntime(
      workflow,
      {
        schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
        sessionId: "legacy-report-characterization",
        sessionSeed: ENDPOINT_CONTROL_PRELAB_REPLAY_SESSION_SEED,
        workflowId: workflow.id,
        workflowRevision: workflow.revision,
        workflowHash: workflow.validation.canonicalSpecHash
      },
      createLegacyTitrationRuntimePorts(workflow)
    );
    const legacyState = JSON.parse(
      runtime.getState().compatibilityState!.serializedState
    );
    const report = titration.step(legacyState, {
      type: "submit_report",
      reportedMolarityM: 0.1,
      explanation: "Direct legacy report characterization"
    });
    expect(report.events[0]).toMatchObject({
      type: "submit_report",
      flags: []
    });
    expect(titration.getGroundTruth(report.state)).toEqual(
      runtime.definition.getGroundTruth(runtime.getState())
    );
  });
});
