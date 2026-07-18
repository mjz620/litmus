import { describe, expect, it } from "vitest";

import {
  NATIVE_TITRATION_V2_DRAFT,
  NATIVE_TITRATION_V2_EXPECTED_HASH,
  NATIVE_TITRATION_V2_SOURCE_HASH,
  validateNativeTitrationV2
} from "../../../src/lab-workflows/definitions/titration/native-endpoint-control";
import {
  createGenericLabActionTrace,
  replayGenericLabActionTrace,
  runGenericTraceSuite
} from "../../../src/lab-workflows/replay";
import {
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  createLegacyTitrationRuntimePorts,
  type NormalizedLabAction
} from "../../../src/lab-workflows/runtime";

const CHECKED_AT = "2026-07-18T05:00:00.000Z";
const SESSION_SEED = "native-titration-v2-trace";

function read(reportedML: number): NormalizedLabAction {
  return {
    schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
    permissionId: "migration.permission.s1.a1",
    actionId: "action.read_volume.v1",
    sourceEquipmentInstanceId: "titrant_burette",
    targetEquipmentInstanceIds: [],
    parameters: [{ key: "reportedML", valueType: "number", value: reportedML }]
  };
}

function dispense(volumeML: number): NormalizedLabAction {
  return {
    schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
    permissionId: "migration.permission.s2.a1",
    actionId: "action.dispense.v1",
    sourceEquipmentInstanceId: "titrant_burette",
    targetEquipmentInstanceIds: ["analyte_flask"],
    parameters: [
      { key: "volumeML", valueType: "number", value: volumeML },
      { key: "durationS", valueType: "number", value: 5 }
    ]
  };
}

const controlledDelivery = [
  ...Array.from({ length: 6 }, () => dispense(0.5)),
  dispense(0.1)
];
const readFirst = [read(22), ...controlledDelivery];
const deliveryFirst = [...controlledDelivery, read(25.1)];
const overshoot = [read(22), ...Array.from({ length: 7 }, () => dispense(0.5))];

describe("native v2 titration definition", () => {
  it("pins a distinct canonical source and validates without a migration ordering edge", () => {
    expect(NATIVE_TITRATION_V2_SOURCE_HASH).toBe(
      NATIVE_TITRATION_V2_EXPECTED_HASH
    );
    const workflow = validateNativeTitrationV2(CHECKED_AT);
    expect(workflow.provenance).toBeUndefined();
    expect(workflow.catalog?.familyId).toBe("family.acid_base_titration.v1");
    expect(workflow.compatibility?.runtimeAdapterId).toBe(
      "runtime-adapter.titration.v1"
    );
    expect(workflow.rules).not.toContainEqual(
      expect.objectContaining({ id: "migration.rule.s1.before.s2" })
    );
    expect(
      workflow.permittedActions.map(({ availability }) => availability)
    ).toEqual([
      {
        allSatisfiedRuleIds: [],
        allUnsatisfiedRuleIds: ["migration.rule.s1.completion"]
      },
      {
        allSatisfiedRuleIds: [],
        allUnsatisfiedRuleIds: ["migration.rule.s2.completion"]
      }
    ]);
  });

  it("executes two valid orders plus recoverable, terminal, and tolerance traces", () => {
    const workflow = validateNativeTitrationV2(CHECKED_AT);
    const trace = (
      traceId: string,
      sessionId: string,
      actions: readonly NormalizedLabAction[]
    ) =>
      createGenericLabActionTrace({
        traceId,
        sessionId,
        sessionSeed: SESSION_SEED,
        workflow,
        actions
      });
    const cases = [
      {
        kind: "valid" as const,
        trace: trace("trace.native.read_first", "native-read-first", readFirst)
      },
      {
        kind: "alternate_valid" as const,
        trace: trace(
          "trace.native.delivery_first",
          "native-delivery-first",
          deliveryFirst
        )
      },
      {
        kind: "recoverable_mistake" as const,
        trace: trace(
          "trace.native.recovered_tolerance",
          "native-recovered-tolerance",
          readFirst
        )
      },
      {
        kind: "terminal_mistake" as const,
        trace: trace(
          "trace.native.endpoint_overshoot",
          "native-endpoint-overshoot",
          overshoot
        )
      },
      {
        kind: "tolerance_boundary" as const,
        trace: trace(
          "trace.native.tolerance_boundary",
          "native-tolerance-boundary",
          deliveryFirst
        )
      }
    ];
    const results = runGenericTraceSuite(cases, () => ({
      workflow,
      ports: createLegacyTitrationRuntimePorts(workflow)
    }));

    expect(results.map(({ finalState }) => finalState.workflowStatus)).toEqual([
      "completed",
      "completed",
      "completed",
      "failed",
      "completed"
    ]);
    expect(results[0]?.finalState.chemistry.groundTruth).toEqual(
      results[1]?.finalState.chemistry.groundTruth
    );
    expect(
      results[4]?.finalState.diagnoses.find(
        ({ ruleId }) => ruleId === "native.rule.endpoint_volume_tolerance"
      )
    ).toMatchObject({
      status: "satisfied",
      observed: { valueType: "number", value: 25.1, unitId: "unit.ml.v1" }
    });

    const replay = replayGenericLabActionTrace(cases[0]!.trace, {
      workflow,
      ports: createLegacyTitrationRuntimePorts(workflow)
    });
    expect(replay.finalState).toEqual(results[0]?.finalState);
  });

  it("keeps the checked-in draft unvalidated", () => {
    expect(NATIVE_TITRATION_V2_DRAFT).toMatchObject({
      supportStatus: "draft_unvalidated",
      validation: null,
      judgeCritique: null
    });
  });
});
