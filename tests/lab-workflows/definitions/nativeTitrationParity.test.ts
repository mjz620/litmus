import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { createFullTitrationTracePlan } from "../../../src/lab-workflows/definitions/titration/fullTitrationTracePlan";
import { validateNativeEndpointDrillV2 } from "../../../src/lab-workflows/definitions/titration/native-endpoint-drill";
import { validateNativeFullTitrationV2 } from "../../../src/lab-workflows/definitions/titration/native-full-titration";
import {
  PARITY_TRACE_SCHEMA_VERSION,
  createGenericLabActionTrace,
  projectParityTrace,
  replayGenericLabActionTrace,
  type ParityStepRecord,
  type ParityTraceRecord
} from "../../../src/lab-workflows/replay";
import {
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  createCapabilityGenericRuntimePorts,
  type NormalizedLabAction
} from "../../../src/lab-workflows/runtime";
import type { ValidatedLabWorkflowSpecV2 } from "../../../src/lab-workflows/schema/v2";

/**
 * Native-vs-oracle parity for the titration migration.
 *
 * Replays the exact NormalizedLabAction sequences pinned by the legacy parity
 * oracle through the capability-native workflows on the production capability
 * ports and compares the full pedagogical projection against the golden
 * fixture. Events, flags, skill evidence, workflow-status transitions, and
 * diagnosis records must match EXACTLY; every tolerated difference is one
 * explicit named entry in the allowed-divergence tables below.
 */
const CHECKED_AT = "2026-07-20T09:00:00.000Z";
const FIXTURE_PATH =
  "tests/lab-workflows/definitions/fixtures/titration-parity-oracle.json";
const SESSION_SEED = "titration-parity-oracle-seed";

interface ParityOracleDocument {
  readonly schemaVersion: typeof PARITY_TRACE_SCHEMA_VERSION;
  readonly traces: readonly ParityTraceRecord[];
}

/**
 * Equipment bookkeeping fields where legacy and native runtimes are known to
 * disagree. Each entry names one field on one instance with the reason the
 * divergence is acceptable; the comparator strips exactly these fields from
 * both projections and nothing else.
 */
const EQUIPMENT_FIELD_DIVERGENCES: readonly {
  readonly instanceId: string;
  readonly key: string;
  readonly reason: string;
}[] = [
  {
    instanceId: "analyte_flask",
    key: "observableColor",
    reason:
      "Legacy pins 'not yet observed' then mirrors the chemistry colour; the native flask initializes 'unobserved' and never updates. The colour truth lives in observable.observed_color.v1 and in add_titrant observations, both compared exactly."
  },
  {
    instanceId: "indicator_source",
    key: "selected",
    reason:
      "Legacy mirrors flask indicatorAdded onto the bottle; the native add_indicator mechanic is flask-owned and does not touch the bottle."
  },
  {
    instanceId: "indicator_source",
    key: "added",
    reason:
      "Legacy mirrors flask indicatorAdded onto the bottle; the native add_indicator mechanic is flask-owned and does not touch the bottle."
  },
  {
    instanceId: "titrant_bottle",
    key: "selected",
    reason:
      "Legacy flips the reagent bottle 'selected' after the first fill; the native fill mechanic records fill history on the burette only."
  }
];

/**
 * Observables the native runtime projects beyond the legacy pair. The
 * acid-base model owns solution pH and indicator colour natively; legacy only
 * surfaced them inside event observations (which are compared exactly).
 */
const NATIVE_ONLY_OBSERVABLE_IDS: readonly string[] = [
  "observable.observed_color.v1",
  "observable.solution_ph.v1"
];

/**
 * The native coordinator folds numeric observables into groundTruth.values;
 * legacy carries exactly the three model keys. Solution pH is the only numeric
 * native-only observable.
 */
const NATIVE_ONLY_GROUND_TRUTH_KEYS: readonly string[] = [
  "observable.solution_ph.v1"
];

function normalizeStep(step: ParityStepRecord): ParityStepRecord {
  const groundTruth = step.groundTruth as {
    readonly values: Readonly<Record<string, number>>;
    readonly notes: readonly string[];
  };
  return {
    ...step,
    equipment: step.equipment.map((entry) => ({
      instanceId: entry.instanceId,
      fields: entry.fields.filter(
        (field) =>
          !EQUIPMENT_FIELD_DIVERGENCES.some(
            (divergence) =>
              divergence.instanceId === entry.instanceId &&
              divergence.key === field.key
          )
      )
    })),
    observables: step.observables.filter(
      ({ observableId }) => !NATIVE_ONLY_OBSERVABLE_IDS.includes(observableId)
    ),
    groundTruth: {
      values: Object.fromEntries(
        Object.entries(groundTruth.values).filter(
          ([key]) => !NATIVE_ONLY_GROUND_TRUTH_KEYS.includes(key)
        )
      ),
      notes: [...groundTruth.notes]
    }
  };
}

function normalizeTrace(trace: ParityTraceRecord): ParityTraceRecord {
  return { ...trace, steps: trace.steps.map(normalizeStep) };
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

interface NativeParityCase {
  readonly traceId: string;
  readonly sessionId: string;
  readonly workflow: Readonly<ValidatedLabWorkflowSpecV2>;
  readonly actions: readonly NormalizedLabAction[];
}

/** The exact action sequences the oracle pinned, keyed by its trace IDs. */
function collectNativeCases(): readonly NativeParityCase[] {
  const fullWorkflow = validateNativeFullTitrationV2(CHECKED_AT);
  const endpointWorkflow = validateNativeEndpointDrillV2(CHECKED_AT);

  const fullCases = createFullTitrationTracePlan().map((testCase, index) => ({
    traceId: `parity.full_titration.${testCase.kind}.${index}`,
    sessionId: `parity-full-${index}`,
    workflow: fullWorkflow,
    actions: testCase.actions
  }));

  const controlledDelivery = [
    ...Array.from({ length: 6 }, () => endpointDispense(0.5)),
    endpointDispense(0.1)
  ];
  const endpointPlans = [
    { name: "read_first", actions: [endpointRead(22), ...controlledDelivery] },
    {
      name: "delivery_first",
      actions: [...controlledDelivery, endpointRead(25.1)]
    },
    {
      name: "endpoint_overshoot",
      actions: [
        endpointRead(22),
        ...Array.from({ length: 7 }, () => endpointDispense(0.5))
      ]
    },
    {
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
      name: "meniscus_misread",
      actions: [endpointRead(22.2), ...controlledDelivery]
    }
  ];
  const endpointCases = endpointPlans.map((plan) => ({
    traceId: `parity.endpoint_control.${plan.name}`,
    sessionId: `parity-endpoint-${plan.name}`,
    workflow: endpointWorkflow,
    actions: plan.actions
  }));

  return [...fullCases, ...endpointCases];
}

function loadOracle(): ParityOracleDocument {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as ParityOracleDocument;
}

describe("native titration parity against the legacy oracle", () => {
  const oracle = loadOracle();
  const cases = collectNativeCases();

  it("covers every pinned oracle trace", () => {
    expect(cases.map(({ traceId }) => traceId).sort()).toEqual(
      oracle.traces.map(({ traceId }) => traceId).sort()
    );
  });

  for (const testCase of collectNativeCases()) {
    it(`reproduces ${testCase.traceId} through the capability-native runtime`, () => {
      const pinned = oracle.traces.find(
        ({ traceId }) => traceId === testCase.traceId
      );
      expect(pinned).toBeDefined();
      const replay = replayGenericLabActionTrace(
        createGenericLabActionTrace({
          traceId: testCase.traceId,
          sessionId: testCase.sessionId,
          sessionSeed: SESSION_SEED,
          workflow: testCase.workflow,
          actions: testCase.actions
        }),
        {
          workflow: testCase.workflow,
          ports: createCapabilityGenericRuntimePorts(testCase.workflow)
        }
      );
      const native = projectParityTrace(replay);

      // The strict pedagogy surface must match without any normalization.
      expect(native.finalWorkflowStatus).toBe(pinned!.finalWorkflowStatus);
      expect(native.finalDiagnoses).toEqual(pinned!.finalDiagnoses);
      expect(
        native.steps.map(({ workflowStatus }) => workflowStatus)
      ).toEqual(pinned!.steps.map(({ workflowStatus }) => workflowStatus));
      expect(native.steps.map(({ events }) => events)).toEqual(
        pinned!.steps.map(({ events }) => events)
      );
      expect(native.steps.map(({ changedDiagnoses }) => changedDiagnoses)).toEqual(
        pinned!.steps.map(({ changedDiagnoses }) => changedDiagnoses)
      );

      // Everything else matches under the explicit allowed-divergence tables.
      expect(normalizeTrace(native)).toEqual(normalizeTrace(pinned!));
    });
  }
});
