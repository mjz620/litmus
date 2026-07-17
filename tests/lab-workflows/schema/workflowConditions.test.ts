import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  WORKFLOW_CONDITION_KINDS,
  WORKFLOW_CONSTRAINT_SCHEMA_LIMITS,
  instructionSectionSchema,
  instructionSectionsSchema,
  rubricCriterionSpecV2Schema,
  rubricEvidenceMappingSchema,
  rubricSpecV2Schema,
  structuredEvidenceValueSchema,
  workflowConditionSchema,
  workflowDiagnosesSchema,
  workflowDiagnosisSchema,
  workflowRuleSchema,
  workflowRulesSchema,
  type WorkflowCondition
} from "../../../src/lab-workflows";
import { labWorkflowSpecSchema } from "../../../src/lab-workflows/schema";
import { createSchemaValidWorkflowDraft } from "./fixtures";

const VALID_CONDITIONS = {
  equipment_state_equals: {
    kind: "equipment_state_equals",
    equipmentInstanceId: "titrant_burette",
    stateFieldKey: "availableML",
    expectedValue: { valueType: "number", value: 25, unitId: "unit.ml.v1" }
  },
  equipment_capability_present: {
    kind: "equipment_capability_present",
    equipmentInstanceId: "titrant_burette",
    capabilityId: "capability.measure_volume.v1"
  },
  material_bound_to_container: {
    kind: "material_bound_to_container",
    materialInstanceId: "material.titrant",
    containerEquipmentInstanceId: "titrant_burette"
  },
  action_observed: {
    kind: "action_observed",
    actionId: "action.dispense.v1",
    sourceEquipmentInstanceId: "titrant_burette",
    targetEquipmentInstanceIds: ["sample_flask"]
  },
  action_count_within_range: {
    kind: "action_count_within_range",
    actionId: "action.dispense.v1",
    sourceEquipmentInstanceId: "titrant_burette",
    targetEquipmentInstanceIds: ["sample_flask"],
    minimumCount: 1,
    maximumCount: 3
  },
  semantic_event_observed: {
    kind: "semantic_event_observed",
    eventTypeId: "event.read_meniscus.v1"
  },
  observation_recorded: {
    kind: "observation_recorded",
    observationKeyId: "observation.reported_volume_ml.v1",
    eventTypeId: "event.read_meniscus.v1",
    expectedValueSourceId: "observable.burette_reading_ml.v1"
  },
  registered_completion_policy_satisfied: {
    kind: "registered_completion_policy_satisfied",
    completionPolicyId: "completion.all_required_observations.v1",
    evidenceRuleIds: ["rule.meniscus_recorded"]
  },
  observable_within_tolerance: {
    kind: "observable_within_tolerance",
    observableId: "observable.burette_reading_ml.v1",
    minimum: 24.9,
    maximum: 25.1,
    minimumInclusive: true,
    maximumInclusive: false,
    unitId: "unit.ml.v1"
  },
  event_flag: {
    kind: "event_flag",
    flagId: "flag.endpoint_overshoot.v1",
    presence: "absent",
    eventTypeId: "event.add_titrant.v1"
  },
  rule_satisfied_before: {
    kind: "rule_satisfied_before",
    predecessorRuleId: "rule.indicator_added",
    successorRuleId: "rule.endpoint_observed"
  },
  forbidden_state_never_reached: {
    kind: "forbidden_state_never_reached",
    equipmentInstanceId: "sample_flask",
    stateFieldKey: "spilled",
    forbiddenValue: { valueType: "boolean", value: true }
  },
  student_response_submitted: {
    kind: "student_response_submitted",
    submissionFieldId: "submission.endpoint_reflection.v1"
  }
} satisfies {
  [Kind in WorkflowCondition["kind"]]: Extract<
    WorkflowCondition,
    { kind: Kind }
  >;
};

const BASE_RULE = {
  id: "rule.endpoint",
  kind: "required" as const,
  condition: VALID_CONDITIONS.action_observed,
  severity: "procedural" as const,
  recoverable: true,
  terminal: false,
  objectiveIds: ["skill.measure_volume.v1"]
};

const BASE_RUBRIC_CRITERION = {
  id: "criterion.endpoint",
  objectiveIds: ["skill.measure_volume.v1"],
  ruleIds: ["rule.endpoint"],
  description: "Measures the endpoint using deterministic evidence.",
  maxPoints: 5,
  assessmentModeId: "assessment.hybrid.v1",
  evidenceMappings: [
    { kind: "rule_diagnosis" as const, ruleId: "rule.endpoint", required: true }
  ],
  scoringGuide: ["Uses the endpoint evidence."]
};

function assertConditionExhaustive(condition: WorkflowCondition): string {
  switch (condition.kind) {
    case "equipment_state_equals":
    case "equipment_capability_present":
    case "material_bound_to_container":
    case "action_observed":
    case "action_count_within_range":
    case "semantic_event_observed":
    case "observation_recorded":
    case "registered_completion_policy_satisfied":
    case "observable_within_tolerance":
    case "event_flag":
    case "rule_satisfied_before":
    case "forbidden_state_never_reached":
    case "student_response_submitted":
      return condition.kind;
    default: {
      const unreachable: never = condition;
      return unreachable;
    }
  }
}

describe("v2 workflow condition contracts", () => {
  it("parses one exact fixture for every closed condition kind", () => {
    expect(Object.keys(VALID_CONDITIONS)).toEqual(WORKFLOW_CONDITION_KINDS);

    for (const condition of Object.values(VALID_CONDITIONS)) {
      const parsed = workflowConditionSchema.parse(condition);
      expect(assertConditionExhaustive(parsed)).toBe(condition.kind);
      expect(parsed).toEqual(condition);
    }
  });

  it("rejects unknown discriminators, cross-variant fields, and expression fields", () => {
    expect(
      workflowConditionSchema.safeParse({
        kind: "arbitrary_expression",
        expression: "state.ph < 7"
      }).success
    ).toBe(false);
    expect(
      workflowConditionSchema.safeParse({
        ...VALID_CONDITIONS.action_observed,
        observableId: "observable.ph.v1"
      }).success
    ).toBe(false);

    for (const condition of Object.values(VALID_CONDITIONS)) {
      expect(
        workflowConditionSchema.safeParse({
          ...condition,
          expression: "student-authored query"
        }).success
      ).toBe(false);
    }
  });

  it("rejects malformed references and capabilities outside the closed vocabulary", () => {
    expect(
      workflowConditionSchema.safeParse({
        ...VALID_CONDITIONS.action_observed,
        actionId: "not an id"
      }).success
    ).toBe(false);
    expect(
      workflowConditionSchema.safeParse({
        ...VALID_CONDITIONS.equipment_capability_present,
        capabilityId: "capability.invented.v1"
      }).success
    ).toBe(false);
    expect(
      workflowConditionSchema.safeParse({
        ...VALID_CONDITIONS.action_observed,
        targetEquipmentInstanceIds: Array.from(
          { length: WORKFLOW_CONSTRAINT_SCHEMA_LIMITS.targetInstanceCount + 1 },
          (_, index) => `target.${index}`
        )
      }).success
    ).toBe(false);
  });

  it("bounds action counts without evaluating referenced actions", () => {
    for (const [minimumCount, maximumCount] of [
      [-1, 1],
      [1.5, 2],
      [2, 1],
      [0, Number.NaN],
      [0, Number.POSITIVE_INFINITY],
      [0, WORKFLOW_CONSTRAINT_SCHEMA_LIMITS.actionCountMaximum + 1]
    ]) {
      expect(
        workflowConditionSchema.safeParse({
          ...VALID_CONDITIONS.action_count_within_range,
          minimumCount,
          maximumCount
        }).success
      ).toBe(false);
    }

    expect(
      workflowConditionSchema.safeParse({
        ...VALID_CONDITIONS.action_count_within_range,
        minimumCount: 0,
        maximumCount: 0
      }).success
    ).toBe(true);
  });

  it("represents interval inclusivity exactly and rejects empty or illegal ranges", () => {
    for (const minimumInclusive of [true, false]) {
      for (const maximumInclusive of [true, false]) {
        const parsed = workflowConditionSchema.parse({
          ...VALID_CONDITIONS.observable_within_tolerance,
          minimumInclusive,
          maximumInclusive
        });
        expect(parsed).toMatchObject({ minimumInclusive, maximumInclusive });
      }
    }

    expect(
      workflowConditionSchema.safeParse({
        ...VALID_CONDITIONS.observable_within_tolerance,
        minimum: 2,
        maximum: 1
      }).success
    ).toBe(false);
    expect(
      workflowConditionSchema.safeParse({
        ...VALID_CONDITIONS.observable_within_tolerance,
        minimum: 1,
        maximum: 1,
        minimumInclusive: true,
        maximumInclusive: false
      }).success
    ).toBe(false);
    expect(
      workflowConditionSchema.safeParse({
        ...VALID_CONDITIONS.observable_within_tolerance,
        minimum: 1,
        maximum: 1,
        minimumInclusive: true,
        maximumInclusive: true
      }).success
    ).toBe(true);

    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, 1_000_001]) {
      expect(
        workflowConditionSchema.safeParse({
          ...VALID_CONDITIONS.observable_within_tolerance,
          minimum: value
        }).success
      ).toBe(false);
    }
  });
});

describe("structured workflow evidence", () => {
  it("accepts every bounded tagged JSON-safe value variant", () => {
    const values = [
      { valueType: "null", value: null },
      { valueType: "boolean", value: false },
      { valueType: "number", value: 7, unitId: "unit.ph.v1" },
      { valueType: "text", value: "" },
      { valueType: "text", value: "pale pink" },
      { valueType: "text_list", value: ["blue", "green"] },
      { valueType: "identifier", value: "state.ready" },
      { valueType: "identifier_list", value: ["event.one", "event.two"] }
    ];

    for (const value of values) {
      expect(structuredEvidenceValueSchema.parse(value)).toEqual(value);
    }
  });

  it("rejects arbitrary, executable, non-finite, and oversized values", () => {
    const invalidValues = [
      undefined,
      new Date(),
      () => true,
      { nested: { arbitrary: true } },
      { valueType: "number", value: Number.NaN },
      { valueType: "number", value: Number.POSITIVE_INFINITY },
      { valueType: "object", value: { query: "$.state" } },
      {
        valueType: "text_list",
        value: Array.from(
          { length: WORKFLOW_CONSTRAINT_SCHEMA_LIMITS.referenceCount + 1 },
          () => "value"
        )
      },
      {
        valueType: "text",
        value: "x".repeat(LAB_LONG_TEXT_LIMIT + 1)
      }
    ];

    for (const value of invalidValues) {
      expect(structuredEvidenceValueSchema.safeParse(value).success).toBe(
        false
      );
    }
  });
});

const LAB_LONG_TEXT_LIMIT = 2_000;

describe("workflow rules and presentation guidance", () => {
  it("accepts every rule kind and severity as bounded data", () => {
    const kinds = [
      "required",
      "success",
      "failure",
      "forbidden",
      "ordering",
      "best_practice",
      "scoring"
    ] as const;
    const severities = [
      "info",
      "best-practice",
      "procedural",
      "conceptual",
      "safety"
    ] as const;

    for (const kind of kinds) {
      expect(workflowRuleSchema.safeParse({ ...BASE_RULE, kind }).success).toBe(
        true
      );
    }
    for (const severity of severities) {
      expect(
        workflowRuleSchema.safeParse({ ...BASE_RULE, severity }).success
      ).toBe(true);
    }
  });

  it("rejects terminal recoverability, invented severities, and illegal points", () => {
    expect(
      workflowRuleSchema.safeParse({
        ...BASE_RULE,
        recoverable: true,
        terminal: true
      }).success
    ).toBe(false);
    expect(
      workflowRuleSchema.safeParse({ ...BASE_RULE, severity: "warning" })
        .success
    ).toBe(false);

    for (const points of [-1, Number.NaN, Number.POSITIVE_INFINITY, 1_001]) {
      expect(
        workflowRuleSchema.safeParse({ ...BASE_RULE, points }).success
      ).toBe(false);
    }
    expect(
      workflowRuleSchema.safeParse({ ...BASE_RULE, points: 0 }).success
    ).toBe(true);
  });

  it("bounds rule lists and rejects runtime control fields on instructions", () => {
    expect(
      workflowRulesSchema.safeParse(
        Array.from(
          { length: WORKFLOW_CONSTRAINT_SCHEMA_LIMITS.ruleCount + 1 },
          (_, index) => ({ ...BASE_RULE, id: `rule.${index}` })
        )
      ).success
    ).toBe(false);

    const instruction = {
      id: "instruction.endpoint",
      title: "Observe the endpoint",
      guidance: "Record the stable color change.",
      relatedRuleIds: ["rule.endpoint"]
    };
    expect(instructionSectionSchema.parse(instruction)).toEqual(instruction);
    expect(
      instructionSectionsSchema.safeParse(
        Array.from(
          {
            length: WORKFLOW_CONSTRAINT_SCHEMA_LIMITS.instructionCount + 1
          },
          (_, index) => ({ ...instruction, id: `instruction.${index}` })
        )
      ).success
    ).toBe(false);

    for (const field of [
      "order",
      "currentStep",
      "requiredForCompletion",
      "completionPolicyId",
      "allowedActions",
      "nextRuleId"
    ]) {
      expect(
        instructionSectionSchema.safeParse({ ...instruction, [field]: true })
          .success
      ).toBe(false);
    }
  });
});

describe("v2 rubric and diagnosis schemas", () => {
  it("preserves typed objective, rule, and evidence mappings", () => {
    const mappings = [
      { kind: "rule_diagnosis", ruleId: "rule.endpoint", required: true },
      {
        kind: "semantic_event",
        eventTypeId: "event.dispense.v1",
        required: true
      },
      {
        kind: "semantic_event_observation",
        observationKeyId: "observation.reported_volume_ml.v1",
        eventTypeId: "event.read_meniscus.v1",
        required: true
      },
      {
        kind: "observable",
        observableId: "observable.ph.v1",
        required: false
      },
      {
        kind: "student_response",
        submissionFieldId: "submission.endpoint_reflection.v1",
        required: true
      }
    ];

    for (const mapping of mappings) {
      expect(rubricEvidenceMappingSchema.parse(mapping)).toEqual(mapping);
    }

    const criterion = {
      ...BASE_RUBRIC_CRITERION,
      evidenceMappings: mappings
    };
    expect(rubricCriterionSpecV2Schema.parse(criterion)).toEqual(criterion);
  });

  it("keeps the v2 rubric separate and bounded without evaluating it", () => {
    const rubric = {
      id: "rubric.titration.v2",
      version: "2.0.0",
      title: "Titration rubric",
      criteria: [BASE_RUBRIC_CRITERION],
      totalPoints: 5,
      passingPolicyId: "passing.standard.v1"
    };
    expect(rubricSpecV2Schema.parse(rubric)).toEqual(rubric);
    expect(
      rubricSpecV2Schema.safeParse({
        ...rubric,
        criteria: Array.from(
          {
            length: WORKFLOW_CONSTRAINT_SCHEMA_LIMITS.rubricCriterionCount + 1
          },
          (_, index) => ({
            ...BASE_RUBRIC_CRITERION,
            id: `criterion.${index}`
          })
        )
      }).success
    ).toBe(false);

    expect(
      rubricCriterionSpecV2Schema.safeParse({
        ...BASE_RUBRIC_CRITERION,
        objectiveIds: []
      }).success
    ).toBe(false);
    expect(
      rubricCriterionSpecV2Schema.safeParse({
        ...BASE_RUBRIC_CRITERION,
        evidenceMappings: Array.from(
          {
            length: WORKFLOW_CONSTRAINT_SCHEMA_LIMITS.evidenceMappingCount + 1
          },
          () => ({
            kind: "rule_diagnosis",
            ruleId: "rule.endpoint",
            required: true
          })
        )
      }).success
    ).toBe(false);
    expect(
      rubricSpecV2Schema.safeParse({ ...rubric, totalPoints: Number.NaN })
        .success
    ).toBe(false);
  });

  it("accepts inspectable diagnoses and bounds runtime evidence IDs", () => {
    const diagnosis = {
      ruleId: "rule.endpoint",
      status: "violated" as const,
      severity: "safety" as const,
      recoverable: false,
      objectiveIds: ["skill.measure_volume.v1"],
      evidenceEventIds: ["event.17"],
      expected: { valueType: "boolean" as const, value: false },
      observed: { valueType: "boolean" as const, value: true }
    };
    expect(workflowDiagnosisSchema.parse(diagnosis)).toEqual(diagnosis);

    for (const status of ["satisfied", "violated", "pending"] as const) {
      expect(
        workflowDiagnosisSchema.safeParse({ ...diagnosis, status }).success
      ).toBe(true);
    }
    expect(
      workflowDiagnosisSchema.safeParse({ ...diagnosis, message: "prose" })
        .success
    ).toBe(false);
    expect(
      workflowDiagnosisSchema.safeParse({
        ...diagnosis,
        evidenceEventIds: Array.from(
          {
            length: WORKFLOW_CONSTRAINT_SCHEMA_LIMITS.diagnosisEvidenceCount + 1
          },
          (_, index) => `event.${index}`
        )
      }).success
    ).toBe(false);
    expect(
      workflowDiagnosesSchema.safeParse(
        Array.from(
          { length: WORKFLOW_CONSTRAINT_SCHEMA_LIMITS.diagnosisCount + 1 },
          (_, index) => ({ ...diagnosis, ruleId: `rule.${index}` })
        )
      ).success
    ).toBe(false);
  });
});

describe("contract compatibility and import boundary", () => {
  it("leaves the v1 workflow and rubric contract unchanged", () => {
    const v1 = createSchemaValidWorkflowDraft();
    expect(labWorkflowSpecSchema.parse(v1)).toEqual(v1);
  });

  it("contains no executable query language or forbidden implementation imports", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lab-workflows/schema/conditions.ts"),
      "utf8"
    );
    const imports = source
      .split("\n")
      .filter((line) => line.trimStart().startsWith("import "))
      .join("\n");

    expect(imports).not.toMatch(
      /react|three|next|openai|supabase|experiments|window|document/i
    );
    expect(source).not.toMatch(
      /\b(?:eval|Function|formula|jsonPath|expression|queryLanguage)\b/
    );
  });
});
