import { describe, expect, it } from "vitest";

import { createWorkflowEvaluator } from "../../../src/lab-workflows/evaluation";
import { hashLabWorkflowSpec } from "../../../src/lab-workflows/hash";
import type {
  WorkflowDiagnosis,
  WorkflowRule
} from "../../../src/lab-workflows/schema/conditions";
import {
  GENERIC_LAB_RUNTIME_ERROR_CODES,
  assembleGenericLabRuntime,
  type GenericWorkflowEvaluationContext
} from "../../../src/lab-workflows/runtime/generic";
import { validateLabWorkflowSpecV2 } from "../../../src/lab-workflows/validation";
import {
  GENERIC_TEST_CONFIG,
  READ_VOLUME_ACTION,
  createTestGenericPorts,
  validatedMechanicalWorkflow
} from "../runtime/generic/fixtures";
import { createRunnableMechanicalV2Draft } from "../validation/v2Fixtures";

function rule(
  id: string,
  condition: WorkflowRule["condition"],
  kind: WorkflowRule["kind"] = "required",
  options: Partial<Pick<WorkflowRule, "recoverable" | "terminal">> = {}
): WorkflowRule {
  return {
    id,
    kind,
    condition,
    severity: kind === "best_practice" ? "best-practice" : "procedural",
    recoverable: options.recoverable ?? true,
    terminal: options.terminal ?? false,
    objectiveIds: ["meniscus_reading"]
  };
}

function baseContext(
  rules: readonly WorkflowRule[],
  overrides: Partial<GenericWorkflowEvaluationContext> = {}
): GenericWorkflowEvaluationContext {
  const runtime = assembleGenericLabRuntime(
    validatedMechanicalWorkflow(),
    GENERIC_TEST_CONFIG,
    createTestGenericPorts()
  );
  const state = runtime.getState();
  return {
    rules,
    equipmentBindings: runtime.program.equipment,
    actionBindings: runtime.program.actions,
    equipment: state.equipment,
    materialLedger: {
      schemaVersion: "1.0.0",
      materials: [
        {
          materialInstanceId: "material.water",
          materialProfileId: "reagent.distilled_water.v1",
          materialVersion: "1.0.0",
          unitId: "unit.ml.v1",
          initialAmount: 10,
          locations: [
            { equipmentInstanceId: "measurement_burette", amount: 10 }
          ]
        }
      ]
    },
    observables: [
      {
        observableId: "observable.burette_reading_ml.v1",
        value: 12.35,
        unitId: "unit.ml.v1"
      }
    ],
    events: [
      {
        type: "read_meniscus",
        tSim: 1,
        observation: { reportedML: 12.35 },
        flags: [],
        evidence: []
      }
    ],
    previousDiagnoses: [],
    permissionAttempts: [
      { permissionId: "permission.read_measurement_burette", count: 1 }
    ],
    currentAction: READ_VOLUME_ACTION,
    sequence: 1,
    studentResponses: [
      {
        submissionFieldId: "submission.initial_burette_reading.v1",
        value: "12.35 mL"
      }
    ],
    ...overrides
  };
}

function diagnosis(
  rule: WorkflowRule,
  status: WorkflowDiagnosis["status"],
  evidenceEventIds: readonly string[] = []
): WorkflowDiagnosis {
  return {
    ruleId: rule.id,
    status,
    severity: rule.severity,
    recoverable: rule.recoverable,
    objectiveIds: [...rule.objectiveIds],
    evidenceEventIds: [...evidenceEventIds]
  };
}

describe("constraint workflow evaluator", () => {
  it("evaluates every closed condition kind without instruction-order control flow", () => {
    const equipment = rule("rule.equipment", {
      kind: "equipment_state_equals",
      equipmentInstanceId: "measurement_burette",
      stateFieldKey: "filled",
      expectedValue: { valueType: "boolean", value: false }
    });
    const capability = rule("rule.capability", {
      kind: "equipment_capability_present",
      equipmentInstanceId: "measurement_burette",
      capabilityId: "capability.measure_volume.v1"
    });
    const action = rule("rule.action", {
      kind: "action_observed",
      actionId: "action.read_volume.v1",
      sourceEquipmentInstanceId: "measurement_burette",
      targetEquipmentInstanceIds: []
    });
    const rules: WorkflowRule[] = [
      equipment,
      capability,
      rule("rule.material", {
        kind: "material_bound_to_container",
        materialInstanceId: "material.water",
        containerEquipmentInstanceId: "measurement_burette"
      }),
      action,
      rule("rule.count", {
        kind: "action_count_within_range",
        actionId: "action.read_volume.v1",
        sourceEquipmentInstanceId: "measurement_burette",
        targetEquipmentInstanceIds: [],
        minimumCount: 1,
        maximumCount: 2
      }),
      rule("rule.event", {
        kind: "semantic_event_observed",
        eventTypeId: "event.read_meniscus.v1"
      }),
      rule("rule.observation", {
        kind: "observation_recorded",
        observationKeyId: "observation.reported_volume_ml.v1",
        eventTypeId: "event.read_meniscus.v1",
        expectedValueSourceId: "observable.burette_reading_ml.v1"
      }),
      rule(
        "rule.complete",
        {
          kind: "registered_completion_policy_satisfied",
          completionPolicyId: "completion.all_required_observations.v1",
          evidenceRuleIds: [equipment.id, capability.id]
        },
        "success"
      ),
      rule("rule.tolerance", {
        kind: "observable_within_tolerance",
        observableId: "observable.burette_reading_ml.v1",
        minimum: 12.3,
        maximum: 12.4,
        minimumInclusive: true,
        maximumInclusive: true,
        unitId: "unit.ml.v1"
      }),
      rule(
        "rule.clean",
        {
          kind: "event_flag",
          flagId: "meniscus_misread",
          presence: "absent",
          eventTypeId: "event.read_meniscus.v1"
        },
        "best_practice"
      ),
      rule(
        "rule.order",
        {
          kind: "rule_satisfied_before",
          predecessorRuleId: equipment.id,
          successorRuleId: action.id
        },
        "ordering"
      ),
      rule(
        "rule.forbidden",
        {
          kind: "forbidden_state_never_reached",
          equipmentInstanceId: "measurement_burette",
          stateFieldKey: "stopcockDetent",
          forbiddenValue: { valueType: "identifier", value: "open" }
        },
        "forbidden"
      ),
      rule("rule.response", {
        kind: "student_response_submitted",
        submissionFieldId: "submission.initial_burette_reading.v1"
      })
    ];
    const context = baseContext(rules, {
      previousDiagnoses: [diagnosis(equipment, "satisfied")]
    });
    const before = structuredClone(context);
    const evaluator = createWorkflowEvaluator({ rules });

    const first = evaluator.evaluate(context);
    const second = evaluator.evaluate(context);

    expect(first).toEqual(second);
    expect(context).toEqual(before);
    expect(first.map(({ ruleId, status }) => ({ ruleId, status }))).toEqual(
      rules.map(({ id }) => ({ ruleId: id, status: "satisfied" }))
    );
    expect(first.find(({ ruleId }) => ruleId === "rule.event")?.evidenceEventIds).toEqual([
      "event.1"
    ]);
  });

  it("accepts either order for independent requirements and enforces only authored strict ordering", () => {
    const firstRule = rule("rule.first", {
      kind: "action_observed",
      actionId: "action.read_volume.v1",
      sourceEquipmentInstanceId: "measurement_burette",
      targetEquipmentInstanceIds: []
    });
    const secondRule = rule("rule.second", {
      kind: "student_response_submitted",
      submissionFieldId: "submission.initial_burette_reading.v1"
    });
    const independent = createWorkflowEvaluator({ rules: [firstRule, secondRule] });
    expect(
      independent.evaluate(baseContext([firstRule, secondRule])).map(({ status }) => status)
    ).toEqual(["satisfied", "satisfied"]);

    const ordering = rule(
      "rule.order",
      {
        kind: "rule_satisfied_before",
        predecessorRuleId: firstRule.id,
        successorRuleId: secondRule.id
      },
      "ordering"
    );
    const orderedRules = [firstRule, secondRule, ordering];
    const evaluator = createWorkflowEvaluator({ rules: orderedRules });
    const passed = evaluator.evaluate(
      baseContext(orderedRules, {
        previousDiagnoses: [diagnosis(firstRule, "satisfied", ["step.1.action"])]
      })
    );
    const failed = evaluator.evaluate(baseContext(orderedRules));
    expect(passed[2]?.status).toBe("satisfied");
    expect(failed[2]?.status).toBe("violated");
    const latched = evaluator.evaluate(
      baseContext(orderedRules, { previousDiagnoses: failed })
    );
    expect(latched[2]?.status).toBe("violated");
  });

  it("handles count and all inclusive/exclusive tolerance boundaries deterministically", () => {
    const countRule = rule("rule.count", {
      kind: "action_count_within_range",
      actionId: "action.read_volume.v1",
      sourceEquipmentInstanceId: "measurement_burette",
      targetEquipmentInstanceIds: [],
      minimumCount: 1,
      maximumCount: 2
    });
    const countEvaluator = createWorkflowEvaluator({ rules: [countRule] });
    for (const [count, status] of [
      [0, "pending"],
      [1, "satisfied"],
      [2, "satisfied"],
      [3, "violated"]
    ] as const) {
      expect(
        countEvaluator.evaluate(
          baseContext([countRule], {
            permissionAttempts: [
              { permissionId: "permission.read_measurement_burette", count }
            ],
            currentAction: null
          })
        )[0]?.status
      ).toBe(status);
    }

    for (const test of [
      { value: 1, minInclusive: false, maxInclusive: true, status: "violated" },
      { value: 1.0001, minInclusive: false, maxInclusive: true, status: "satisfied" },
      { value: 2, minInclusive: true, maxInclusive: true, status: "satisfied" },
      { value: 2, minInclusive: true, maxInclusive: false, status: "violated" }
    ] as const) {
      const tolerance = rule("rule.tolerance", {
        kind: "observable_within_tolerance",
        observableId: "observable.burette_reading_ml.v1",
        minimum: 1,
        maximum: 2,
        minimumInclusive: test.minInclusive,
        maximumInclusive: test.maxInclusive,
        unitId: "unit.ml.v1"
      });
      expect(
        createWorkflowEvaluator({ rules: [tolerance] }).evaluate(
          baseContext([tolerance], {
            observables: [
              {
                observableId: "observable.burette_reading_ml.v1",
                value: test.value,
                unitId: "unit.ml.v1"
              }
            ]
          })
        )[0]?.status
      ).toBe(test.status);
    }
  });

  it("keeps clean best-practice evidence silent and latches forbidden-state violations", () => {
    const clean = rule(
      "rule.clean",
      {
        kind: "event_flag",
        flagId: "meniscus_misread",
        presence: "absent",
        eventTypeId: "event.read_meniscus.v1"
      },
      "best_practice"
    );
    const evaluator = createWorkflowEvaluator({ rules: [clean] });
    expect(evaluator.evaluate(baseContext([clean], { events: [] }))[0]?.status).toBe("pending");
    expect(evaluator.evaluate(baseContext([clean]))[0]?.status).toBe("satisfied");
    expect(
      evaluator.evaluate(
        baseContext([clean], {
          events: [
            {
              type: "read_meniscus",
              tSim: 1,
              observation: { reportedML: 12 },
              flags: ["meniscus_misread"],
              evidence: []
            }
          ]
        })
      )[0]?.status
    ).toBe("violated");
  });

  it("integrates post-action evidence and terminal completion through ExperimentDefinition.step", () => {
    const workflow = validatedMechanicalWorkflow();
    const evaluator = createWorkflowEvaluator({ rules: workflow.rules });
    const ports = createTestGenericPorts();
    const runtime = assembleGenericLabRuntime(workflow, GENERIC_TEST_CONFIG, {
      ...ports,
      evaluator
    });

    expect(runtime.getState().workflowStatus).toBe("in_progress");
    const transition = runtime.dispatch(READ_VOLUME_ACTION);

    expect(transition.state.workflowStatus).toBe("completed");
    expect(transition.state.diagnoses.map(({ status }) => status)).toEqual([
      "satisfied",
      "satisfied",
      "satisfied"
    ]);
    expect(() => runtime.dispatch(READ_VOLUME_ACTION)).toThrowError(
      expect.objectContaining({ code: GENERIC_LAB_RUNTIME_ERROR_CODES.workflowTerminal })
    );
  });

  it("lets a terminal deterministic violation dominate simultaneous success", () => {
    const draft = createRunnableMechanicalV2Draft();
    const terminal = draft.rules.find(({ id }) => id === "rule.score_reading_event");
    if (!terminal) throw new Error("Expected scoring rule fixture");
    terminal.kind = "failure";
    terminal.terminal = true;
    terminal.recoverable = false;
    const validation = validateLabWorkflowSpecV2(draft, {
      checkedAt: "2026-07-18T00:00:00.000Z"
    });
    expect(validation.schemaValid).toBe(true);
    if (!validation.schemaValid) throw new Error("Expected valid terminal fixture");
    expect(validation.validation.runnable).toBe(true);
    const ports = createTestGenericPorts();
    const runtime = assembleGenericLabRuntime(
      validation.spec,
      {
        schemaVersion: GENERIC_TEST_CONFIG.schemaVersion,
        sessionId: "terminal-workflow-test",
        workflowId: draft.id,
        workflowRevision: draft.revision,
        workflowHash: hashLabWorkflowSpec(draft)
      },
      {
        ...ports,
        evaluator: createWorkflowEvaluator({ rules: validation.spec.rules })
      }
    );

    const transition = runtime.dispatch(READ_VOLUME_ACTION);

    expect(transition.state.workflowStatus).toBe("failed");
    expect(
      transition.state.diagnoses.find(({ ruleId }) => ruleId === terminal.id)
        ?.status
    ).toBe("violated");
  });
});
