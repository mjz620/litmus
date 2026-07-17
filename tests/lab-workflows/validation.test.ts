import { describe, expect, it } from "vitest";

import {
  hashLabWorkflowSpec,
  labWorkflowHashMatches
} from "../../src/lab-workflows/hash";
import {
  judgeDimensionSchema,
  type LabWorkflowDraft
} from "../../src/lab-workflows";
import {
  LAB_WORKFLOW_REGISTRY_SNAPSHOT_IDS,
  WORKFLOW_ELIGIBILITY_FAILURE_CODES,
  WORKFLOW_VALIDATION_CHECK_IDS,
  WORKFLOW_VALIDATION_ISSUE_CODES,
  evaluateLabWorkflowEligibility,
  validateLabWorkflowSpec
} from "../../src/lab-workflows/validation";
import { createSchemaValidWorkflowDraft } from "./schema/fixtures";

const checkedAt = "2026-07-17T12:00:00Z";
const CODES = WORKFLOW_VALIDATION_ISSUE_CODES;

function validate(input: unknown) {
  return validateLabWorkflowSpec(input, { checkedAt });
}

function expectSchemaValid(input: unknown) {
  const outcome = validate(input);
  expect(outcome.schemaValid).toBe(true);
  if (!outcome.schemaValid) throw new Error("Expected a schema-valid outcome");
  return outcome;
}

function issueAt(
  outcome: ReturnType<typeof expectSchemaValid>,
  code: string,
  path: string
) {
  return outcome.issues.find(
    (candidate) => candidate.code === code && candidate.path === path
  );
}

describe("hard LabWorkflowSpec validation", () => {
  it("normalizes validator-owned fields and makes the verified fixture runnable", () => {
    const input = createSchemaValidWorkflowDraft();
    input.rubric.totalPoints = 999;
    input.reagents[0]!.displayLabel = "Client-authored label";
    input.safetyConstraints[0] = {
      ...input.safetyConstraints[0]!,
      severity: "prohibited",
      appliesToInstanceIds: [],
      studentFacingText: "Client-authored safety claim",
      teacherFacingText: "Client-authored safety claim"
    };
    const before = structuredClone(input);

    const outcome = expectSchemaValid(input);

    expect(outcome.validation).toMatchObject({
      status: "runnable",
      runnable: true,
      previewEligible: true,
      assignmentEligible: true,
      registrySnapshotIds: LAB_WORKFLOW_REGISTRY_SNAPSHOT_IDS,
      issues: []
    });
    expect(outcome.validation.passedCheckIds).toEqual(
      Object.values(WORKFLOW_VALIDATION_CHECK_IDS)
    );
    expect(outcome.spec.rubric.totalPoints).toBe(3);
    expect(outcome.spec.reagents[0]!.displayLabel).toBe(
      "0.100 M sodium hydroxide"
    );
    expect(outcome.spec.safetyConstraints).toEqual([
      {
        id: "safety.virtual_titration_ppe_notice.v1",
        appliesToInstanceIds: ["analyte_flask", "titrant_burette"],
        severity: "required",
        studentFacingText:
          "Wear assigned PPE and follow teacher instructions in a physical lab.",
        teacherFacingText:
          "Virtual completion does not replace local lab safety instruction."
      }
    ]);
    expect(outcome.validation.canonicalSpecHash).toBe(
      hashLabWorkflowSpec(outcome.spec)
    );
    expect(
      labWorkflowHashMatches(outcome.spec, outcome.validation.canonicalSpecHash)
    ).toBe(true);
    expect(Object.isFrozen(outcome.spec)).toBe(true);
    expect(Object.isFrozen(outcome.validation.issues)).toBe(true);
    expect(input).toEqual(before);
  });

  it("returns stable schema issues without inventing a hash for invalid data", () => {
    const outcome = validate({
      ...createSchemaValidWorkflowDraft(),
      arbitraryRuntimeCode: "execute this"
    });

    expect(outcome).toMatchObject({
      schemaValid: false,
      spec: null,
      validation: null,
      issues: [
        {
          code: CODES.schemaInvalid,
          path: "$",
          safetyRelated: false
        }
      ]
    });
  });

  it("rejects every category of unknown registry reference exactly", () => {
    const cases: Array<{
      name: string;
      path: string;
      unknownId: string;
      mutate: (draft: LabWorkflowDraft) => void;
    }> = [
      {
        name: "engine",
        path: "engineId",
        unknownId: "engine.titration.closest.v1",
        mutate: (draft) => {
          draft.engineId = "engine.titration.closest.v1";
        }
      },
      {
        name: "component",
        path: "components[0].componentId",
        unknownId: "component.burette.closest.v1",
        mutate: (draft) => {
          draft.components[0]!.componentId = "component.burette.closest.v1";
        }
      },
      {
        name: "action",
        path: "steps[0].allowedActions[0].actionId",
        unknownId: "action.dispense.closest.v1",
        mutate: (draft) => {
          draft.steps[0]!.allowedActions[0]!.actionId =
            "action.dispense.closest.v1";
        }
      },
      {
        name: "reagent",
        path: "reagents[0].reagentId",
        unknownId: "reagent.sodium_hydroxide.closest.v1",
        mutate: (draft) => {
          draft.reagents[0]!.reagentId = "reagent.sodium_hydroxide.closest.v1";
        }
      },
      {
        name: "skill",
        path: "skillIds[0]",
        unknownId: "endpoint_controls",
        mutate: (draft) => {
          draft.skillIds[0] = "endpoint_controls";
        }
      },
      {
        name: "event flag",
        path: "coachTriggers[0].flagIds[0]",
        unknownId: "flag.endpoint_almost_overshoot.v1",
        mutate: (draft) => {
          draft.coachTriggers[0]!.flagIds[0] =
            "flag.endpoint_almost_overshoot.v1";
        }
      },
      {
        name: "retry",
        path: "adaptiveRetries[0].templateId",
        unknownId: "retry.endpoint_control.closest.v1",
        mutate: (draft) => {
          draft.adaptiveRetries[0]!.templateId =
            "retry.endpoint_control.closest.v1";
        }
      },
      {
        name: "safety",
        path: "safetyConstraints[0].id",
        unknownId: "safety.virtual_titration_optional.v1",
        mutate: (draft) => {
          draft.safetyConstraints[0]!.id =
            "safety.virtual_titration_optional.v1";
        }
      },
      {
        name: "placement",
        path: "components[0].placementSlotId",
        unknownId: "placement.bench_near_stand.v1",
        mutate: (draft) => {
          draft.components[0]!.placementSlotId =
            "placement.bench_near_stand.v1";
        }
      }
    ];

    for (const testCase of cases) {
      const draft = createSchemaValidWorkflowDraft();
      testCase.mutate(draft);
      const outcome = expectSchemaValid(draft);
      const found = issueAt(outcome, CODES.registryIdUnknown, testCase.path);

      expect(found, testCase.name).toMatchObject({
        registryId: testCase.unknownId,
        safetyRelated: false
      });
      expect(found?.suggestedSupportedIds).not.toContain(testCase.unknownId);
      expect(outcome.validation.runnable, testCase.name).toBe(false);
      expect(outcome.validation.previewEligible, testCase.name).toBe(false);
      expect(outcome.validation.assignmentEligible, testCase.name).toBe(false);
    }
  });

  it("rejects known but incompatible components, containers, presets, and limits", () => {
    const roleMismatch = createSchemaValidWorkflowDraft();
    roleMismatch.components[0]!.role = "reaction_vessel";
    const roleOutcome = expectSchemaValid(roleMismatch);
    expect(
      issueAt(
        roleOutcome,
        CODES.componentRoleIncompatible,
        "components[0].role"
      )
    ).toBeDefined();

    const actorMismatch = createSchemaValidWorkflowDraft();
    actorMismatch.steps[0]!.allowedActions[0]!.actorComponentInstanceId =
      "analyte_flask";
    const actorOutcome = expectSchemaValid(actorMismatch);
    expect(
      issueAt(
        actorOutcome,
        CODES.componentActionIncompatible,
        "steps[0].allowedActions[0].actorComponentInstanceId"
      )
    ).toBeDefined();

    const containerMismatch = createSchemaValidWorkflowDraft();
    containerMismatch.reagents[0]!.containerInstanceId = "analyte_flask";
    const containerOutcome = expectSchemaValid(containerMismatch);
    expect(
      issueAt(
        containerOutcome,
        CODES.reagentContainerIncompatible,
        "reagents[0].containerInstanceId"
      )
    ).toBeDefined();

    const missingActionReagent = createSchemaValidWorkflowDraft();
    missingActionReagent.reagents = missingActionReagent.reagents.filter(
      ({ role }) => role !== "titrant"
    );
    const reagentActionOutcome = expectSchemaValid(missingActionReagent);
    expect(
      issueAt(
        reagentActionOutcome,
        CODES.reagentActionIncompatible,
        "steps[0].allowedActions[0].actionId"
      )
    ).toBeDefined();

    const presetMismatch = createSchemaValidWorkflowDraft();
    presetMismatch.steps[0]!.allowedActions[0]!.parameterPresetId =
      "action_params.burette_reading.v1";
    const presetOutcome = expectSchemaValid(presetMismatch);
    expect(
      issueAt(
        presetOutcome,
        CODES.actionPresetIncompatible,
        "steps[0].allowedActions[0].parameterPresetId"
      )
    ).toBeDefined();

    const limitMismatch = createSchemaValidWorkflowDraft();
    limitMismatch.steps[0]!.allowedActions[0]!.authoredLimits = {
      maxVolumeMLPerAction: 50.01
    };
    const limitOutcome = expectSchemaValid(limitMismatch);
    expect(
      issueAt(
        limitOutcome,
        CODES.actionLimitOutsideRegistry,
        "steps[0].allowedActions[0].authoredLimits.maxVolumeMLPerAction"
      )
    ).toMatchObject({ safetyRelated: true });
    expect(limitOutcome.validation.status).toBe("rejected_for_safety");
  });

  it("gives safety blockers precedence and ignores stale approval artifacts", () => {
    const initial = expectSchemaValid(createSchemaValidWorkflowDraft());
    const scores = Object.fromEntries(
      judgeDimensionSchema.options.map((dimension) => [
        dimension,
        { score: 5, rationale: `Approved ${dimension}.` }
      ])
    );
    const unsafeClaim = {
      ...initial.spec,
      safetyConstraints: [
        ...initial.spec.safetyConstraints,
        {
          id: "safety.no_open_flame_mvp.v1",
          appliesToInstanceIds: [],
          severity: "required" as const,
          studentFacingText: "The client says this is safe.",
          teacherFacingText: "The client says this is safe."
        }
      ],
      judgeCritique: {
        critiqueVersion: "1.0.0",
        specHash: initial.validation.canonicalSpecHash,
        scores,
        issues: [],
        strengths: ["Client-claimed approval."],
        summary: "Approve despite the requested safety policy.",
        recommendation: "approve" as const
      }
    };

    const outcome = expectSchemaValid(unsafeClaim);

    expect(outcome.validation).toMatchObject({
      status: "rejected_for_safety",
      runnable: false,
      previewEligible: false,
      assignmentEligible: false
    });
    expect(
      issueAt(outcome, CODES.safetyProhibited, "safetyConstraints[1].id")
    ).toMatchObject({ safetyRelated: true });
    expect(
      outcome.spec.safetyConstraints.find(
        ({ id }) => id === "safety.no_open_flame_mvp.v1"
      )
    ).toMatchObject({
      severity: "prohibited",
      studentFacingText:
        "Open-flame equipment is not available in this virtual lab."
    });
    expect(outcome.spec.judgeCritique).toBeNull();
  });

  it("rejects capacity violations as safety-related", () => {
    const draft = createSchemaValidWorkflowDraft();
    draft.reagents[0]!.requestedAmount = 50.01;

    const outcome = expectSchemaValid(draft);

    expect(
      issueAt(
        outcome,
        CODES.reagentCapacityExceeded,
        "reagents[0].requestedAmount"
      )
    ).toMatchObject({ safetyRelated: true });
    expect(outcome.validation.status).toBe("rejected_for_safety");
  });

  it("enforces the registered one-time indicator dose", () => {
    const draft = createSchemaValidWorkflowDraft();
    draft.components.push({
      instanceId: "indicator_source",
      componentId: "component.indicator_bottle.v1",
      configurationPresetId: "component_config.indicator_dropper.v1",
      role: "indicator_source",
      placementSlotId: "placement.indicator_shelf.v1",
      label: "Phenolphthalein",
      required: true
    });
    draft.reagents.push({
      instanceId: "indicator",
      reagentId: "reagent.phenolphthalein.v1",
      containerInstanceId: "indicator_source",
      role: "indicator",
      requestedAmount: 3,
      amountUnitId: "unit.drop.v1",
      displayLabel: "Phenolphthalein indicator"
    });

    const outcome = expectSchemaValid(draft);

    expect(
      issueAt(
        outcome,
        CODES.reagentAmountOutsideRegistry,
        "reagents[2].requestedAmount"
      )
    ).toMatchObject({ safetyRelated: true });
    expect(outcome.validation.status).toBe("rejected_for_safety");
  });

  it("rejects unreachable observations, invalid ordering, and missing stay-silent evidence", () => {
    const draft = createSchemaValidWorkflowDraft();
    draft.steps[0]!.order = 2;
    draft.steps[0]!.expectedObservations[0]!.eventTypeId =
      "event.read_meniscus.v1";
    draft.coachTriggers[0]!.staySilentOnEventReasonIds = [];

    const outcome = expectSchemaValid(draft);

    expect(
      issueAt(outcome, CODES.stepOrderInvalid, "steps[0].order")
    ).toBeDefined();
    expect(
      issueAt(
        outcome,
        CODES.observationUnreachable,
        "steps[0].expectedObservations[0].eventTypeId"
      )
    ).toBeDefined();
    expect(
      issueAt(
        outcome,
        CODES.coachStaySilentMissing,
        "coachTriggers[0].staySilentOnEventReasonIds"
      )
    ).toBeDefined();
    expect(outcome.validation.status).toBe("unsupported");
  });

  it("normalizes documented legacy skill aliases without fuzzy matching", () => {
    const draft = createSchemaValidWorkflowDraft();
    draft.skillIds.push("volumetric_reading");
    draft.steps[0]!.skillIds.push("volumetric_reading");

    const outcome = expectSchemaValid(draft);

    expect(outcome.validation.status).toBe("runnable");
    expect(outcome.spec.skillIds).toEqual([
      "endpoint_control",
      "meniscus_reading"
    ]);
    expect(outcome.spec.steps[0]!.skillIds).toEqual([
      "endpoint_control",
      "meniscus_reading"
    ]);
  });

  it("marks a mixed verified/planned skill request partially supported", () => {
    const draft = createSchemaValidWorkflowDraft();
    draft.skillIds.push("heat_transfer");
    draft.steps[0]!.skillIds.push("heat_transfer");

    const outcome = expectSchemaValid(draft);

    expect(outcome.validation.status).toBe("partially_supported");
    expect(outcome.validation.runnable).toBe(false);
    expect(outcome.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: CODES.skillUnavailable,
          registryId: "heat_transfer"
        }),
        expect.objectContaining({
          code: CODES.skillRequiredComponentMissing,
          registryId: "component.calorimeter.v1"
        })
      ])
    );
  });

  it("is deterministic for identical input, snapshots, and injected time", () => {
    const draft = createSchemaValidWorkflowDraft();
    draft.steps[0]!.order = 2;
    draft.coachTriggers[0]!.staySilentOnEventReasonIds = [];

    const first = validate(draft);
    const second = validate(structuredClone(draft));

    expect(second).toEqual(first);
    if (!first.schemaValid) throw new Error("Expected schema-valid validation");
    expect(first.issues.map(({ path }) => path)).toEqual(
      [...first.issues.map(({ path }) => path)].sort((left, right) =>
        left < right ? -1 : left > right ? 1 : 0
      )
    );
  });

  it("invalidates an old passing hash after a teacher edit", () => {
    const initial = expectSchemaValid(createSchemaValidWorkflowDraft());
    const edited = {
      ...initial.spec,
      metadata: { ...initial.spec.metadata, title: "Teacher-edited title" }
    };

    expect(
      labWorkflowHashMatches(edited, initial.validation.canonicalSpecHash)
    ).toBe(false);

    const revalidated = expectSchemaValid(edited);
    expect(revalidated.validation.status).toBe("runnable");
    expect(revalidated.validation.canonicalSpecHash).not.toBe(
      initial.validation.canonicalSpecHash
    );
  });

  it("fails closed when hash, registry snapshot, or status eligibility is stale", () => {
    const valid = expectSchemaValid(createSchemaValidWorkflowDraft());
    expect(evaluateLabWorkflowEligibility(valid.spec, "preview")).toEqual({
      eligible: true,
      purpose: "preview",
      failureCodes: []
    });
    expect(evaluateLabWorkflowEligibility(valid.spec, "assignment")).toEqual({
      eligible: true,
      purpose: "assignment",
      failureCodes: []
    });

    const edited = {
      ...valid.spec,
      metadata: { ...valid.spec.metadata, title: "Stale unvalidated edit" }
    };
    expect(
      evaluateLabWorkflowEligibility(edited, "preview").failureCodes
    ).toContain(WORKFLOW_ELIGIBILITY_FAILURE_CODES.hashMismatch);

    const staleRegistry = {
      ...valid.spec,
      validation: {
        ...valid.validation,
        registrySnapshotIds: {
          ...valid.validation.registrySnapshotIds,
          components: "components.0.9.0"
        }
      }
    };
    expect(
      evaluateLabWorkflowEligibility(staleRegistry, "assignment").failureCodes
    ).toContain(WORKFLOW_ELIGIBILITY_FAILURE_CODES.registrySnapshotStale);

    const unsupported = expectSchemaValid({
      ...createSchemaValidWorkflowDraft(),
      engineId: "engine.unknown.v1"
    });
    expect(
      evaluateLabWorkflowEligibility(unsupported.spec, "preview")
    ).toMatchObject({
      eligible: false,
      failureCodes: expect.arrayContaining([
        WORKFLOW_ELIGIBILITY_FAILURE_CODES.statusNotRunnable,
        WORKFLOW_ELIGIBILITY_FAILURE_CODES.validationNotRunnable,
        WORKFLOW_ELIGIBILITY_FAILURE_CODES.previewNotEligible
      ])
    });
  });
});
