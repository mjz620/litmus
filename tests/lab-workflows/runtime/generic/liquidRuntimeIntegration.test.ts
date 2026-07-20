import { describe, expect, it, vi } from "vitest";

import { hashLabWorkflowSpec } from "../../../../src/lab-workflows/hash";
import {
  LIQUID_MECHANICAL_ADAPTERS,
  stateField
} from "../../../../src/lab-workflows/mechanics";
import {
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  assembleGenericLabRuntime,
  type GenericRuntimePorts,
  type NormalizedLabAction
} from "../../../../src/lab-workflows/runtime/generic";
import { validateLabWorkflowSpecV2 } from "../../../../src/lab-workflows/validation";
import { createRunnableLiquidTransferV2Draft } from "../../validation/v2Fixtures";

const ACTION: NormalizedLabAction = {
  schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  permissionId: "permission.fill_transfer_burette",
  actionId: "action.fill.v1",
  sourceEquipmentInstanceId: "water_source",
  targetEquipmentInstanceIds: ["transfer_burette"],
  parameters: [{ key: "volumeML", valueType: "number", value: 10 }]
};

function ports(): GenericRuntimePorts {
  return {
    mechanicalAdapters: LIQUID_MECHANICAL_ADAPTERS,
    safetyPolicy: {
      supportedPolicyIds: ["safety.virtual_titration_ppe_notice.v1"],
      check: () => ({ ok: true })
    },
    models: {
      supportedModels: [],
      initialize: vi.fn(() => ({
        modelStates: [],
        observables: [],
        groundTruth: { values: {}, notes: [] }
      })),
      transition: vi.fn(({ previous }) => previous)
    },
    evaluator: {
      evaluate: ({ rules }) =>
        rules.map((rule) => ({
          ruleId: rule.id,
          status: "pending" as const,
          severity: rule.severity,
          recoverable: rule.recoverable,
          objectiveIds: [...rule.objectiveIds],
          evidenceEventIds: []
        }))
    }
  };
}

describe("generic liquid runtime integration", () => {
  it("executes a validated fill through ExperimentDefinition.step and the conserved ledger", () => {
    const draft = createRunnableLiquidTransferV2Draft();
    const validation = validateLabWorkflowSpecV2(draft, {
      checkedAt: "2026-07-17T23:00:00.000Z"
    });
    expect(validation.schemaValid).toBe(true);
    if (!validation.schemaValid)
      throw new Error("Expected schema-valid workflow");
    expect(validation.validation).toMatchObject({
      status: "runnable",
      runnable: true
    });
    expect(validation.issues).toEqual([]);
    const runtimePorts = ports();
    const runtime = assembleGenericLabRuntime(
      validation.spec,
      {
        schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
        sessionId: "liquid-runtime-integration",
        workflowId: draft.id,
        workflowRevision: draft.revision,
        workflowHash: hashLabWorkflowSpec(draft)
      },
      runtimePorts
    );
    const initial = runtime.getState();
    const before = structuredClone(initial);
    const stepSpy = vi.spyOn(runtime.definition, "step");

    const transition = runtime.dispatch(ACTION);

    expect(stepSpy).toHaveBeenCalledTimes(1);
    expect(initial).toEqual(before);
    expect(transition.state.sequence).toBe(1);
    expect(transition.state.materialLedger.materials[0]).toMatchObject({
      materialInstanceId: "material.water",
      initialAmount: 50,
      locations: [
        { equipmentInstanceId: "transfer_burette", amount: 10 },
        { equipmentInstanceId: "water_source", amount: 40 }
      ]
    });
    const burette = transition.state.equipment.find(
      ({ instanceId }) => instanceId === "transfer_burette"
    );
    expect(burette && stateField(burette, "availableML")).toBe(10);
    expect(burette && stateField(burette, "meniscusReadingML")).toBe(40);
    expect(transition.events).toEqual([
      {
        type: "fill_burette",
        tSim: 0,
        observation: {
          requestedML: 10,
          resultingAvailableML: 10,
          currentReadingML: 40,
          fillKind: "initial"
        },
        flags: [],
        evidence: []
      }
    ]);
    const modelTransition = vi.mocked(runtimePorts.models.transition).mock
      .calls[0]![0];
    expect(modelTransition.materialAction).toMatchObject({
      actionId: "action.fill.v1",
      materialInstanceIds: ["material.water"],
      transfers: [{ kind: "transfer", amount: 10, unitId: "unit.ml.v1" }]
    });
    expect(modelTransition.materialLedger).toEqual(
      transition.state.materialLedger
    );
  });
});
