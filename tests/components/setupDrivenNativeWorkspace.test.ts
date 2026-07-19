import { describe, expect, it } from "vitest";

import { completedActionMessage } from "../../src/components/lab/setup-driven/NativeSetupDrivenWorkspace";
import { resolveSetupDrivenPoses } from "../../src/components/lab/setup-driven/SetupDrivenBench";
import {
  SOLUTION_PREPARATION_V2_EXPECTED_HASH,
  validateSolutionPreparationV2
} from "../../src/lab-workflows/definitions/solution-preparation";
import { validateStrictMigratedTitrationV2 } from "../../src/lab-workflows/definitions/titration";
import {
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  type NormalizedLabAction
} from "../../src/lab-workflows/runtime";
import {
  STRICT_TITRATION_SETUP_SELECTION,
  createSetupDrivenNativeSession,
  createSetupDrivenTitrationSession
} from "../../src/stores/setupDrivenLabSession";

const workflow = validateSolutionPreparationV2("2026-07-18T15:00:00.000Z");

function action(
  permissionId: string,
  actionId: string,
  sourceEquipmentInstanceId: string,
  targetEquipmentInstanceIds: readonly string[],
  parameters: NormalizedLabAction["parameters"] = []
): NormalizedLabAction {
  return {
    schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
    permissionId,
    actionId,
    sourceEquipmentInstanceId,
    targetEquipmentInstanceIds,
    parameters
  };
}

function session() {
  return createSetupDrivenNativeSession({
    sessionId: "native-student-preview",
    sessionSeed: "native-student-preview-seed",
    selection: {
      workflowId: workflow.id,
      workflowHash: SOLUTION_PREPARATION_V2_EXPECTED_HASH
    },
    workflow
  });
}

const condition = () =>
  action(
    "permission.condition_pipette",
    "action.rinse_transfer_device.v1",
    "stock_bottle",
    ["transfer_pipette"]
  );
const aspirate = (volumeML: number) =>
  action(
    "permission.aspirate_stock",
    "action.transfer_liquid.v1",
    "stock_bottle",
    ["transfer_pipette"],
    [{ key: "volumeML", valueType: "number", value: volumeML }]
  );
const deliver = (volumeML: number) =>
  action(
    "permission.deliver_aliquot",
    "action.transfer_liquid.v1",
    "transfer_pipette",
    ["preparation_flask"],
    [{ key: "volumeML", valueType: "number", value: volumeML }]
  );
const fill = (finalVolumeML: number) =>
  action(
    "permission.fill_to_mark",
    "action.fill_to_mark.v1",
    "water_bottle",
    ["preparation_flask"],
    [{ key: "finalVolumeML", valueType: "number", value: finalVolumeML }]
  );
const mix = () =>
  action(
    "permission.mix_solution",
    "action.mix_solution.v1",
    "preparation_flask",
    [],
    [{ key: "inversions", valueType: "number", value: 10 }]
  );

describe("LC2-503 native setup-driven student projection", () => {
  it("resolves every exact visual pose and exposes capability-checked controls", () => {
    const runtime = session();
    const projection = runtime.getProjection();

    expect(resolveSetupDrivenPoses(projection)).toEqual([
      expect.objectContaining({
        equipmentInstanceId: "stock_bottle",
        visualAdapterDefinitionId: "visual-adapter.reagent_bottle.v1"
      }),
      expect.objectContaining({
        equipmentInstanceId: "transfer_pipette",
        visualAdapterDefinitionId: "visual-adapter.volumetric_pipette.v1"
      }),
      expect.objectContaining({
        equipmentInstanceId: "preparation_flask",
        visualAdapterDefinitionId: "visual-adapter.volumetric_flask.v1"
      }),
      expect.objectContaining({
        equipmentInstanceId: "water_bottle",
        visualAdapterDefinitionId: "visual-adapter.wash_bottle.v1"
      })
    ]);
    expect(projection.availablePermissionIds).toEqual([
      "permission.condition_pipette",
      "permission.aspirate_stock",
      "permission.deliver_aliquot",
      "permission.fill_to_mark",
      "permission.mix_solution"
    ]);
    expect(
      projection.actions.find(
        ({ permissionId }) => permissionId === "permission.fill_to_mark"
      )?.numericParameterBounds
    ).toEqual([
      expect.objectContaining({
        parameterKey: "finalVolumeML",
        effectiveMinimum: 90,
        effectiveMaximum: 100
      })
    ]);
  });

  it("executes the student controls through the generic definition and exposes evidence", () => {
    const runtime = session();
    for (const next of [
      condition(),
      aspirate(10),
      deliver(10),
      fill(100),
      mix()
    ]) {
      runtime.dispatch(next);
    }

    expect(runtime.getState().workflowStatus).toBe("completed");
    expect(runtime.getInspection()).toMatchObject({
      executionKind: "native_generic",
      runtimeAdapterId: null,
      engineId: null,
      runtimeSchemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
      sequence: 5
    });
    expect(runtime.getGenericState().eventEnvelopes.length).toBeGreaterThan(0);
    expect(runtime.getGenericState().diagnoses).toContainEqual(
      expect.objectContaining({
        ruleId: "rule.workflow_complete",
        status: "satisfied"
      })
    );
    expect(runtime.getGenericState().chemistry.observables).toContainEqual(
      expect.objectContaining({
        observableId: "observable.solution_concentration_m.v1",
        value: 0.05
      })
    );
    expect(runtime.getActionTrace().actions).toHaveLength(5);
  });

  it("labels a completed conditioning step while keeping the next procedural step usable", () => {
    const runtime = session();
    runtime.dispatch(condition());
    const projection = runtime.getProjection();
    const conditionAction = projection.actions.find(
      ({ permissionId }) => permissionId === "permission.condition_pipette"
    );
    const aspirateAction = projection.actions.find(
      ({ permissionId }) => permissionId === "permission.aspirate_stock"
    );

    expect(conditionAction).toBeDefined();
    expect(
      completedActionMessage(
        conditionAction as NonNullable<typeof conditionAction>,
        projection
      )
    ).toBe("Completed — the pipette is conditioned with stock solution.");
    expect(aspirateAction?.available).toBe(true);
  });

  it("projects alternate, recoverable, terminal, and boundary preview attempts", () => {
    const cases = [
      {
        actions: [
          condition(),
          aspirate(5),
          deliver(5),
          aspirate(5),
          deliver(5),
          fill(100),
          mix()
        ],
        expectedStatus: "completed"
      },
      {
        actions: [
          condition(),
          aspirate(10),
          deliver(10),
          fill(99.91),
          fill(100),
          mix()
        ],
        expectedStatus: "completed"
      },
      { actions: [fill(90)], expectedStatus: "failed" },
      {
        actions: [condition(), aspirate(10), deliver(10), fill(99.92), mix()],
        expectedStatus: "completed"
      }
    ] as const;

    for (const testCase of cases) {
      const runtime = session();
      for (const next of testCase.actions) runtime.dispatch(next);
      expect(runtime.getGenericState().workflowStatus).toBe(
        testCase.expectedStatus
      );
      expect(runtime.getProjection().diagnoses.length).toBeGreaterThan(0);
      expect(runtime.getActionTrace().actions).toHaveLength(
        testCase.actions.length
      );
    }
  });

  it("fails closed for stale selection and compatibility-owned definitions", () => {
    expect(() =>
      createSetupDrivenNativeSession({
        sessionId: "stale",
        sessionSeed: "stale",
        selection: {
          workflowId: workflow.id,
          workflowHash:
            "sha256:0000000000000000000000000000000000000000000000000000000000000000"
        },
        workflow
      })
    ).toThrowError(/stale, ineligible/);

    const titration = createSetupDrivenTitrationSession({
      experimentId: "acid_base_titration",
      sessionId: "shared-coordinator-titration",
      sessionSeed: "shared-coordinator-titration",
      selection: STRICT_TITRATION_SETUP_SELECTION
    });
    expect(titration.getInspection()).toMatchObject({
      executionKind: "legacy_compatibility",
      runtimeSchemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION
    });
    expect(runtimeSchema(session())).toBe(runtimeSchema(titration));
    expect(() =>
      createSetupDrivenNativeSession({
        sessionId: "compatibility",
        sessionSeed: "compatibility",
        selection: STRICT_TITRATION_SETUP_SELECTION,
        workflow: validateStrictMigratedTitrationV2("2026-07-18T03:00:00.000Z")
      })
    ).toThrowError(/compatibility-owned/);
  });
});

function runtimeSchema(
  runtime:
    | ReturnType<typeof session>
    | ReturnType<typeof createSetupDrivenTitrationSession>
): string {
  return runtime.getGenericState().schemaVersion;
}
