import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { describe, expect, it } from "vitest";

import { createFullTitrationTracePlan } from "../../../src/lab-workflows/definitions/titration/fullTitrationTracePlan";
import { validateFullTitrationV2 } from "../../../src/lab-workflows/definitions/titration";
import { validateNativeTitrationV2 } from "../../../src/lab-workflows/definitions/titration/native-endpoint-control";
import {
  PARITY_TRACE_SCHEMA_VERSION,
  createGenericLabActionTrace,
  projectParityTrace,
  replayGenericLabActionTrace,
  runGenericTraceSuite,
  type GenericTraceSuiteCase,
  type ParityTraceRecord
} from "../../../src/lab-workflows/replay";
import {
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  type NormalizedLabAction
} from "../../../src/lab-workflows/runtime";
import { createLegacyTitrationRuntimePorts } from "../../../src/lab-workflows/runtime/legacy";

/**
 * Parity oracle for the titration migration (LC2 strangler retirement).
 *
 * Runs the checked-in titration workflows through the legacy compatibility
 * ports and pins the full pedagogical surface — per-step equipment fields,
 * chemistry observables and ground truth, semantic events with flags and
 * skill evidence, and diagnosis changes — as a golden fixture. A native
 * runtime for titration is at parity exactly when it reproduces this fixture.
 *
 * Regenerate after an intentional legacy-behavior change with:
 *   UPDATE_TITRATION_PARITY_ORACLE=1 npx vitest run tests/lab-workflows/definitions/titrationParityOracle.test.ts
 */
const CHECKED_AT = "2026-07-19T17:00:00.000Z";
const FIXTURE_PATH =
  "tests/lab-workflows/definitions/fixtures/titration-parity-oracle.json";
const SESSION_SEED = "titration-parity-oracle-seed";

interface ParityOracleDocument {
  readonly schemaVersion: typeof PARITY_TRACE_SCHEMA_VERSION;
  readonly traces: readonly ParityTraceRecord[];
}

function endpointRead(reportedML: number): NormalizedLabAction {
  return {
    schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
    permissionId: "migration.permission.s1.a1",
    actionId: "action.read_volume.v1",
    sourceEquipmentInstanceId: "titrant_burette",
    targetEquipmentInstanceIds: [],
    parameters: [{ key: "reportedML", valueType: "number", value: reportedML }]
  };
}

function endpointDispense(
  volumeML: number,
  durationS = 5
): NormalizedLabAction {
  return {
    schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
    permissionId: "migration.permission.s2.a1",
    actionId: "action.dispense.v1",
    sourceEquipmentInstanceId: "titrant_burette",
    targetEquipmentInstanceIds: ["analyte_flask"],
    parameters: [
      { key: "volumeML", valueType: "number", value: volumeML },
      { key: "durationS", valueType: "number", value: durationS }
    ]
  };
}

function collectCases(): {
  readonly cases: readonly GenericTraceSuiteCase[];
  readonly workflowFor: (traceId: string) => "full" | "endpoint";
} {
  const fullWorkflow = validateFullTitrationV2(CHECKED_AT);
  const endpointWorkflow = validateNativeTitrationV2(CHECKED_AT);

  const fullCases = createFullTitrationTracePlan().map((testCase, index) => ({
    kind: testCase.kind,
    trace: createGenericLabActionTrace({
      traceId: `parity.full_titration.${testCase.kind}.${index}`,
      sessionId: `parity-full-${index}`,
      sessionSeed: SESSION_SEED,
      workflow: fullWorkflow,
      actions: testCase.actions
    })
  }));

  const controlledDelivery = [
    ...Array.from({ length: 6 }, () => endpointDispense(0.5)),
    endpointDispense(0.1)
  ];
  const endpointPlans = [
    {
      kind: "valid" as const,
      name: "read_first",
      actions: [endpointRead(22), ...controlledDelivery]
    },
    {
      kind: "alternate_valid" as const,
      name: "delivery_first",
      actions: [...controlledDelivery, endpointRead(25.1)]
    },
    {
      kind: "terminal_mistake" as const,
      name: "endpoint_overshoot",
      actions: [
        endpointRead(22),
        ...Array.from({ length: 7 }, () => endpointDispense(0.5))
      ]
    },
    {
      // Enters the near-endpoint zone (>= 23 mL of the 25 mL equivalence),
      // then delivers 0.5 mL in half a second — rate 1.0 mL/s raises
      // flow_rate_high_near_endpoint without overshooting.
      kind: "alternate_valid" as const,
      name: "fast_near_endpoint",
      actions: [
        endpointRead(22),
        endpointDispense(0.5),
        endpointDispense(0.5),
        endpointDispense(0.5, 0.5),
        ...Array.from({ length: 3 }, () => endpointDispense(0.5)),
        endpointDispense(0.1, 6)
      ]
    },
    {
      // Reports 22.2 mL when the burette truly reads 22 — a 0.2 mL error
      // beyond the 0.05 mL tolerance raises meniscus_misread. The workflow
      // completes on the final dispense, so no closing read is possible.
      kind: "alternate_valid" as const,
      name: "meniscus_misread",
      actions: [endpointRead(22.2), ...controlledDelivery]
    }
  ];
  const endpointCases = endpointPlans.map((plan) => ({
    kind: plan.kind,
    trace: createGenericLabActionTrace({
      traceId: `parity.endpoint_control.${plan.name}`,
      sessionId: `parity-endpoint-${plan.name}`,
      sessionSeed: SESSION_SEED,
      workflow: endpointWorkflow,
      actions: plan.actions
    })
  }));

  return {
    cases: [...fullCases, ...endpointCases],
    workflowFor: (traceId) =>
      traceId.startsWith("parity.full_titration.") ? "full" : "endpoint"
  };
}

function replayOptionsFor(workflowKind: "full" | "endpoint") {
  const workflow =
    workflowKind === "full"
      ? validateFullTitrationV2(CHECKED_AT)
      : validateNativeTitrationV2(CHECKED_AT);
  return { workflow, ports: createLegacyTitrationRuntimePorts(workflow) };
}

function buildOracle(): ParityOracleDocument {
  const { cases, workflowFor } = collectCases();
  const results = runGenericTraceSuite(cases, ({ trace }) =>
    replayOptionsFor(workflowFor(trace.traceId))
  );
  return {
    schemaVersion: PARITY_TRACE_SCHEMA_VERSION,
    traces: results.map(projectParityTrace)
  };
}

describe("titration parity oracle", () => {
  it("projects deterministically across independent runtime assemblies", () => {
    const { cases, workflowFor } = collectCases();
    for (const testCase of cases) {
      const first = projectParityTrace(
        replayGenericLabActionTrace(
          testCase.trace,
          replayOptionsFor(workflowFor(testCase.trace.traceId))
        )
      );
      const second = projectParityTrace(
        replayGenericLabActionTrace(
          testCase.trace,
          replayOptionsFor(workflowFor(testCase.trace.traceId))
        )
      );
      expect(second).toEqual(first);
    }
  });

  it("matches the pinned golden fixture", () => {
    const oracle = buildOracle();
    if (process.env.UPDATE_TITRATION_PARITY_ORACLE) {
      mkdirSync(dirname(FIXTURE_PATH), { recursive: true });
      writeFileSync(FIXTURE_PATH, `${JSON.stringify(oracle, null, 2)}\n`);
    }
    expect(
      existsSync(FIXTURE_PATH),
      "Golden fixture missing. Generate it with UPDATE_TITRATION_PARITY_ORACLE=1."
    ).toBe(true);
    const pinned = JSON.parse(
      readFileSync(FIXTURE_PATH, "utf8")
    ) as ParityOracleDocument;
    expect(oracle).toEqual(pinned);
  });

  it("covers every titration verb the native runtime must reproduce", () => {
    const oracle = buildOracle();
    const actionIds = new Set(
      oracle.traces.flatMap(({ steps }) => steps.map(({ actionId }) => actionId))
    );
    expect([...actionIds].sort()).toEqual([
      "action.add_indicator.v1",
      "action.dispense.v1",
      "action.fill.v1",
      "action.read_volume.v1",
      "action.rinse.v1"
    ]);
    const flags = new Set(
      oracle.traces.flatMap(({ steps }) =>
        steps.flatMap(({ events }) => events.flatMap(({ flags }) => flags))
      )
    );
    // The pedagogy-critical flags must appear somewhere in the oracle, or the
    // fixture cannot police their native reimplementation.
    expect([...flags].sort()).toEqual([
      "burette_not_conditioned",
      "endpoint_overshoot",
      "flow_rate_high_near_endpoint",
      "meniscus_misread"
    ]);
  });
});
