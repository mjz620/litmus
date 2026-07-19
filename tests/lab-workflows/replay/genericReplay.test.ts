import { describe, expect, it, vi } from "vitest";

import { replayTitrationActions } from "../../../src/experiments/titration/replay";
import {
  EXAMPLE_STRONG,
  type TitrationAction
} from "../../../src/experiments/titration/titration";
import { createWorkflowEvaluator } from "../../../src/lab-workflows/evaluation";
import {
  GENERIC_LAB_ACTION_TRACE_SCHEMA_VERSION,
  LAB_TRACE_ERROR_CODES,
  createGenericLabActionTrace,
  genericLabActionTraceSchema,
  replayGenericLabActionTrace,
  replayLegacyTitrationActions,
  runGenericTraceSuite,
  type GenericTraceSuiteCaseKind
} from "../../../src/lab-workflows/replay";
import type { GenericRuntimePorts } from "../../../src/lab-workflows/runtime/generic";
import { validateLabWorkflowSpecV2 } from "../../../src/lab-workflows/validation";
import {
  READ_VOLUME_ACTION,
  createTestGenericPorts,
  validatedMechanicalWorkflow
} from "../runtime/generic/fixtures";
import { createRunnableMechanicalV2Draft } from "../validation/v2Fixtures";

type SuiteKind = GenericTraceSuiteCaseKind;

function suiteWorkflow(kind: SuiteKind) {
  const draft = createRunnableMechanicalV2Draft();
  const required = draft.rules.find(
    ({ id }) => id === "rule.meniscus_observed"
  )!;
  if (kind === "alternate_valid" || kind === "recoverable_mistake") {
    required.condition = {
      kind: "action_count_within_range",
      actionId: "action.read_volume.v1",
      sourceEquipmentInstanceId: "measurement_burette",
      targetEquipmentInstanceIds: [],
      minimumCount: 2,
      maximumCount: 2
    };
  }
  if (kind === "recoverable_mistake") {
    draft.rules.push({
      id: "rule.recoverable_open_stopcock",
      kind: "failure",
      condition: {
        kind: "equipment_state_equals",
        equipmentInstanceId: "measurement_burette",
        stateFieldKey: "stopcockDetent",
        expectedValue: { valueType: "identifier", value: "open" }
      },
      severity: "procedural",
      recoverable: true,
      terminal: false,
      objectiveIds: ["meniscus_reading"]
    });
  }
  if (kind === "terminal_mistake") {
    draft.rules.push({
      id: "rule.terminal_read_failure",
      kind: "failure",
      condition: {
        kind: "semantic_event_observed",
        eventTypeId: "event.read_meniscus.v1"
      },
      severity: "conceptual",
      recoverable: false,
      terminal: true,
      objectiveIds: ["meniscus_reading"]
    });
  }
  if (kind === "tolerance_boundary") {
    required.condition = {
      kind: "observable_within_tolerance",
      observableId: "observable.burette_reading_ml.v1",
      minimum: 12.35,
      maximum: 12.35,
      minimumInclusive: true,
      maximumInclusive: true,
      unitId: "unit.ml.v1"
    };
  }
  const validation = validateLabWorkflowSpecV2(draft, {
    checkedAt: "2026-07-18T01:00:00.000Z"
  });
  expect(validation.schemaValid).toBe(true);
  if (!validation.schemaValid) throw new Error("Expected trace suite fixture");
  expect(validation.validation.runnable).toBe(true);
  return validation.spec;
}

function suitePorts(
  kind: SuiteKind,
  workflow: ReturnType<typeof suiteWorkflow>
): GenericRuntimePorts {
  const ports = createTestGenericPorts();
  if (kind === "recoverable_mistake") {
    vi.mocked(ports.mechanicalAdapters[0].apply).mockImplementation(
      (context) => {
        const reported = context.action.parameters.find(
          ({ key }) => key === "reportedML"
        );
        const value = reported?.valueType === "number" ? reported.value : 12.35;
        return {
          equipment: context.equipment.map((equipment) => ({
            ...equipment,
            fields: equipment.fields.map((field) =>
              field.key === "stopcockDetent"
                ? { ...field, value: value === 12 ? "open" : "closed" }
                : field
            )
          })),
          materialAction: null,
          events: [
            {
              type: "read_meniscus",
              tSim: context.action.parameters.length,
              observation: {
                reportedML: value,
                trueML: 12.35,
                errorML: value - 12.35
              },
              flags: [],
              evidence: []
            }
          ]
        };
      }
    );
  }
  return {
    ...ports,
    evaluator: createWorkflowEvaluator({ rules: workflow.rules })
  };
}

function trace() {
  return createGenericLabActionTrace({
    traceId: "trace.meniscus.v1",
    sessionId: "trace-replay-session",
    sessionSeed: "trace-seed-v1",
    workflow: validatedMechanicalWorkflow(),
    actions: [READ_VOLUME_ACTION],
    studentResponses: [
      {
        afterActionSequence: 1,
        submissionFieldId: "submission.initial_burette_reading.v1",
        value: "12.35 mL"
      }
    ]
  });
}

describe("versioned generic normalized action replay", () => {
  it("round-trips a strict provenance-pinned trace with no authored expected truth", () => {
    const value = trace();
    expect(value.schemaVersion).toBe(GENERIC_LAB_ACTION_TRACE_SCHEMA_VERSION);
    expect(
      genericLabActionTraceSchema.parse(JSON.parse(JSON.stringify(value)))
    ).toEqual(value);
    expect(JSON.stringify(value)).not.toContain("expectedState");
    expect(JSON.stringify(value)).not.toContain("expectedChemistry");
    expect(Object.isFrozen(value)).toBe(true);
  });

  it("replays every action through the real runtime with deterministic deep equality", () => {
    const workflow = validatedMechanicalWorkflow();
    const firstPorts = createTestGenericPorts();
    const secondPorts = createTestGenericPorts();
    const first = replayGenericLabActionTrace(trace(), {
      workflow,
      ports: firstPorts
    });
    const second = replayGenericLabActionTrace(trace(), {
      workflow,
      ports: secondPorts
    });

    expect(second).toEqual(first);
    expect(first.states).toHaveLength(2);
    expect(first.transitions).toHaveLength(1);
    expect(first.finalState.sequence).toBe(1);
    expect(first.finalState.eventEnvelopes[0]?.eventId).toBe(
      "trace-replay-session:event:0"
    );
    expect(firstPorts.mechanicalAdapters[0].apply).toHaveBeenCalledTimes(1);
  });

  it("detects changed actions and rejects stale, unknown, or version-drifted input", () => {
    const workflow = validatedMechanicalWorkflow();
    const original = replayGenericLabActionTrace(trace(), {
      workflow,
      ports: createTestGenericPorts()
    });
    const changed = structuredClone(trace());
    changed.actions[0]!.parameters = [
      { key: "reportedML", valueType: "number", value: 12 }
    ];
    const divergent = replayGenericLabActionTrace(changed, {
      workflow,
      ports: createTestGenericPorts()
    });
    expect(divergent.finalState).not.toEqual(original.finalState);

    const stale = structuredClone(trace());
    stale.provenance.workflowHash = "0".repeat(64);
    expect(() =>
      replayGenericLabActionTrace(stale, {
        workflow,
        ports: createTestGenericPorts()
      })
    ).toThrowError(
      expect.objectContaining({
        code: LAB_TRACE_ERROR_CODES.provenanceMismatch
      })
    );

    const unknownAction = structuredClone(trace());
    unknownAction.actions[0]!.actionId = "action.unknown.v1";
    expect(() =>
      replayGenericLabActionTrace(unknownAction, {
        workflow,
        ports: createTestGenericPorts()
      })
    ).toThrowError(
      expect.objectContaining({ code: LAB_TRACE_ERROR_CODES.replayRejected })
    );

    expect(() =>
      replayGenericLabActionTrace(
        { ...trace(), runtimeSchemaVersion: "0.0.0" },
        { workflow, ports: createTestGenericPorts() }
      )
    ).toThrowError(
      expect.objectContaining({ code: LAB_TRACE_ERROR_CODES.schemaInvalid })
    );
  });

  it("is independent of network, wall-clock, randomness, and timers", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const now = vi.spyOn(Date, "now");
    const random = vi.spyOn(Math, "random");
    const timeout = vi.spyOn(globalThis, "setTimeout");
    replayGenericLabActionTrace(trace(), {
      workflow: validatedMechanicalWorkflow(),
      ports: createTestGenericPorts()
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
    expect(random).not.toHaveBeenCalled();
    expect(timeout).not.toHaveBeenCalled();
  });

  it("keeps the legacy titration action format and replay result unchanged", () => {
    const actions = [
      { type: "rinse_burette", solvent: "titrant" },
      { type: "select_indicator", indicator: "phenolphthalein" },
      { type: "fill_burette", volumeML: 30 },
      { type: "add_titrant", volumeML: 5, durationS: 25 }
    ] satisfies TitrationAction[];
    expect(replayLegacyTitrationActions(EXAMPLE_STRONG, actions)).toEqual(
      replayTitrationActions(EXAMPLE_STRONG, actions)
    );
  });

  it("executes the five required generated-trace suite categories against the runtime", () => {
    const kinds = [
      "valid",
      "alternate_valid",
      "recoverable_mistake",
      "terminal_mistake",
      "tolerance_boundary"
    ] as const satisfies readonly GenericTraceSuiteCaseKind[];
    const workflows = new Map(kinds.map((kind) => [kind, suiteWorkflow(kind)]));
    const actionsByKind: Record<SuiteKind, (typeof READ_VOLUME_ACTION)[]> = {
      valid: [READ_VOLUME_ACTION],
      alternate_valid: [
        {
          ...READ_VOLUME_ACTION,
          parameters: [{ key: "reportedML", valueType: "number", value: 12.36 }]
        },
        {
          ...READ_VOLUME_ACTION,
          parameters: [{ key: "reportedML", valueType: "number", value: 12.34 }]
        }
      ],
      recoverable_mistake: [
        {
          ...READ_VOLUME_ACTION,
          parameters: [{ key: "reportedML", valueType: "number", value: 12 }]
        },
        READ_VOLUME_ACTION
      ],
      terminal_mistake: [READ_VOLUME_ACTION],
      tolerance_boundary: []
    };
    const cases = kinds.map((kind, index) => {
      const workflow = workflows.get(kind)!;
      return {
        kind,
        trace: createGenericLabActionTrace({
          traceId: `trace.suite.${kind}`,
          sessionId: `trace-suite-${index}`,
          sessionSeed: `seed-${index}`,
          workflow,
          actions: actionsByKind[kind]
        })
      };
    });

    const results = runGenericTraceSuite(cases, ({ kind }) => {
      const workflow = workflows.get(kind)!;
      return { workflow, ports: suitePorts(kind, workflow) };
    });

    expect(results).toHaveLength(5);
    expect(results.map(({ finalState }) => finalState.workflowStatus)).toEqual([
      "completed",
      "completed",
      "completed",
      "failed",
      "completed"
    ]);
    expect(
      results[2]?.states[1]?.diagnoses.find(
        ({ ruleId }) => ruleId === "rule.recoverable_open_stopcock"
      )?.status
    ).toBe("violated");
    expect(results[4]?.finalState.sequence).toBe(0);
  });
});
