import { describe, expect, it } from "vitest";

import {
  judgeDimensionSchema,
  type JudgeCritique,
  type LabWorkflowDraftV2
} from "../../src/lab-workflows";
import {
  PRODUCTION_LAB_WORKFLOW_V2_REGISTRIES,
  evaluateLabWorkflowEligibility,
  validateLabWorkflowSpec,
  validateLabWorkflowSpecV2,
  WORKFLOW_ELIGIBILITY_FAILURE_CODES_V2,
  WORKFLOW_VALIDATION_CHECK_IDS_V2,
  WORKFLOW_VALIDATION_ISSUE_CODES_V2
} from "../../src/lab-workflows/validation";
import { createComponentRegistry } from "../../src/lab-workflows/registries/components";
import {
  createMigratedEndpointV2Draft,
  createRunnableMechanicalV2Draft
} from "./validation/v2Fixtures";

const CHECKED_AT = "2026-07-17T20:00:00.000Z";

function cloneDraft(draft: LabWorkflowDraftV2): LabWorkflowDraftV2 {
  return structuredClone(draft);
}

function issueIdentity(
  outcome: ReturnType<typeof validateLabWorkflowSpecV2>
): readonly string[] {
  return outcome.issues.map(
    ({ code, path, severity }) => `${code}|${path}|${severity}`
  );
}

function createJudgeCritique(
  specHash: string,
  recommendation: JudgeCritique["recommendation"]
): JudgeCritique {
  return {
    critiqueVersion: "1.0.0",
    specHash,
    scores: Object.fromEntries(
      judgeDimensionSchema.options.map((dimension) => [
        dimension,
        { score: 4, rationale: `Review of ${dimension}.` }
      ])
    ) as JudgeCritique["scores"],
    issues: [],
    strengths: ["The mechanical workflow is inspectable."],
    summary: "This advisory review does not determine runtime eligibility.",
    recommendation
  };
}

describe("LabWorkflowSpec v2 hard validation", () => {
  it("validates a verified mechanical composition but keeps runtime gates closed", () => {
    const input = createRunnableMechanicalV2Draft();
    const direct = validateLabWorkflowSpecV2(input, { checkedAt: CHECKED_AT });
    const facade = validateLabWorkflowSpec(input, { checkedAt: CHECKED_AT });

    expect(direct).toEqual(facade);
    expect(direct.schemaValid).toBe(true);
    if (!direct.schemaValid) throw new Error("Expected schema-valid fixture");

    expect(direct.validation).toMatchObject({
      status: "runnable",
      runnable: true,
      previewEligible: false,
      assignmentEligible: false
    });
    expect(direct.issues).toEqual([
      expect.objectContaining({
        code: WORKFLOW_VALIDATION_ISSUE_CODES_V2.runtimeUnavailable,
        severity: "warning",
        path: "$"
      })
    ]);
    expect(evaluateLabWorkflowEligibility(direct.spec, "preview")).toEqual({
      eligible: false,
      purpose: "preview",
      failureCodes: [WORKFLOW_ELIGIBILITY_FAILURE_CODES_V2.previewNotEligible]
    });
    expect(evaluateLabWorkflowEligibility(direct.spec, "assignment")).toEqual({
      eligible: false,
      purpose: "assignment",
      failureCodes: [
        WORKFLOW_ELIGIBILITY_FAILURE_CODES_V2.assignmentNotEligible
      ]
    });
  });

  it("admits migrated titration only through its exact executable compatibility seam", () => {
    const outcome = validateLabWorkflowSpecV2(createMigratedEndpointV2Draft(), {
      checkedAt: CHECKED_AT
    });

    expect(outcome.schemaValid).toBe(true);
    if (!outcome.schemaValid) throw new Error("Expected migrated v2 schema");

    expect(outcome.validation).toMatchObject({
      status: "runnable",
      runnable: true,
      previewEligible: false,
      assignmentEligible: false
    });
    expect(outcome.validation.resolvedChemistryModels).toEqual([
      expect.objectContaining({
        modelId: "chemistry-model.legacy_titration.v1",
        version: "1.0.0"
      })
    ]);
    expect(outcome.issues.map(({ code }) => code)).toEqual([
      WORKFLOW_VALIDATION_ISSUE_CODES_V2.runtimeUnavailable
    ]);

    const unscoped = createMigratedEndpointV2Draft();
    delete unscoped.compatibility;
    const rejected = validateLabWorkflowSpecV2(unscoped, {
      checkedAt: CHECKED_AT
    });
    expect(rejected.schemaValid).toBe(true);
    if (!rejected.schemaValid) throw new Error("Expected unscoped v2 schema");
    expect(rejected.validation.runnable).toBe(false);
    expect(rejected.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: WORKFLOW_VALIDATION_ISSUE_CODES_V2.chemistryModelResolutionFailed
        })
      ])
    );
  });

  it("does not use optional catalog family metadata as runtime dispatch", () => {
    const titration = createRunnableMechanicalV2Draft();
    titration.catalog = { familyId: "family.acid_base_titration.v1" };
    const precipitation = createRunnableMechanicalV2Draft();
    precipitation.catalog = {
      familyId: "family.precipitation_solubility.v1"
    };

    const first = validateLabWorkflowSpecV2(titration, {
      checkedAt: CHECKED_AT
    });
    const second = validateLabWorkflowSpecV2(precipitation, {
      checkedAt: CHECKED_AT
    });

    expect(first.schemaValid).toBe(true);
    expect(second.schemaValid).toBe(true);
    if (!first.schemaValid || !second.schemaValid)
      throw new Error("Expected schema-valid catalog variants");
    expect(issueIdentity(first)).toEqual(issueIdentity(second));
    expect(first.validation.status).toBe(second.validation.status);
    expect(first.validation.resolvedAdapters).toEqual(
      second.validation.resolvedAdapters
    );
    expect(first.validation.resolvedChemistryModels).toEqual(
      second.validation.resolvedChemistryModels
    );
  });

  it("rejects prohibited safety selections regardless of otherwise valid mechanics", () => {
    const draft = createRunnableMechanicalV2Draft();
    draft.safetyPolicyIds.push("safety.no_open_flame_mvp.v1");
    const outcome = validateLabWorkflowSpecV2(draft, {
      checkedAt: CHECKED_AT
    });

    expect(outcome.schemaValid).toBe(true);
    if (!outcome.schemaValid)
      throw new Error("Expected schema-valid safety case");
    expect(outcome.validation).toMatchObject({
      status: "rejected_for_safety",
      runnable: false
    });
    expect(outcome.issues).toContainEqual(
      expect.objectContaining({
        code: WORKFLOW_VALIDATION_ISSUE_CODES_V2.safetyProhibited,
        safetyRelated: true
      })
    );
  });

  it("emits mixed registry, configuration, and reference issues in a stable order", () => {
    const draft = createRunnableMechanicalV2Draft();
    draft.equipment[0]!.equipmentDefinitionId = "action.read_volume.v1";
    draft.layout.configurationSchemaId = "action_params.burette_reading.v1";
    draft.safetyBindings[0]!.equipmentInstanceIds = ["rule.meniscus_observed"];

    const first = validateLabWorkflowSpecV2(draft, {
      checkedAt: CHECKED_AT
    });
    const second = validateLabWorkflowSpecV2(cloneDraft(draft), {
      checkedAt: CHECKED_AT,
      registries: {
        ...PRODUCTION_LAB_WORKFLOW_V2_REGISTRIES,
        components: createComponentRegistry(
          [...PRODUCTION_LAB_WORKFLOW_V2_REGISTRIES.components.list()].reverse()
        )
      }
    });
    const relevantCodes = new Set<string>([
      WORKFLOW_VALIDATION_ISSUE_CODES_V2.registryIdUnknown,
      WORKFLOW_VALIDATION_ISSUE_CODES_V2.configurationMismatch,
      WORKFLOW_VALIDATION_ISSUE_CODES_V2.referenceUnknown
    ]);
    const relevant = first.issues.filter(({ code }) => relevantCodes.has(code));

    expect(issueIdentity(first)).toEqual(issueIdentity(second));
    expect(relevant.map(({ code }) => code)).toEqual(
      expect.arrayContaining([...relevantCodes])
    );
    expect(relevant.map(({ path }) => path)).toEqual([
      "equipment[0].equipmentDefinitionId",
      "layout.configurationSchemaId",
      "permittedActions[0].sourceEquipmentInstanceId",
      "safetyBindings[0].equipmentInstanceIds[0]"
    ]);
  });

  it("fails each ordered hard-validation pass on a representative invalid definition", () => {
    const cases = [
      {
        checkId: WORKFLOW_VALIDATION_CHECK_IDS_V2.references,
        mutate(draft: LabWorkflowDraftV2) {
          draft.objectiveIds[0] = "objective.unknown.v1";
        }
      },
      {
        checkId: WORKFLOW_VALIDATION_CHECK_IDS_V2.equipment,
        mutate(draft: LabWorkflowDraftV2) {
          draft.layout.configurationSchemaId =
            "action_params.burette_reading.v1";
        }
      },
      {
        checkId: WORKFLOW_VALIDATION_CHECK_IDS_V2.materials,
        migrated: true,
        mutate(draft: LabWorkflowDraftV2) {
          draft.materials[0]!.materialProfileId = "material.unknown.v1";
        }
      },
      {
        checkId: WORKFLOW_VALIDATION_CHECK_IDS_V2.actions,
        mutate(draft: LabWorkflowDraftV2) {
          draft.permittedActions[0]!.actionId = "action.unknown.v1";
        }
      },
      {
        checkId: WORKFLOW_VALIDATION_CHECK_IDS_V2.chemistryModels,
        migrated: true,
        mutate(draft: LabWorkflowDraftV2) {
          delete draft.compatibility;
        }
      },
      {
        checkId: WORKFLOW_VALIDATION_CHECK_IDS_V2.rules,
        mutate(draft: LabWorkflowDraftV2) {
          draft.rules.splice(
            draft.rules.findIndex(({ kind }) => kind === "success"),
            1
          );
        }
      },
      {
        checkId: WORKFLOW_VALIDATION_CHECK_IDS_V2.rubric,
        mutate(draft: LabWorkflowDraftV2) {
          draft.rubric.totalPoints += 1;
        }
      },
      {
        checkId: WORKFLOW_VALIDATION_CHECK_IDS_V2.presentationCoach,
        mutate(draft: LabWorkflowDraftV2) {
          draft.presentation.instructionGuidance[0]!.instructionId =
            "instruction.unknown";
        }
      },
      {
        checkId: WORKFLOW_VALIDATION_CHECK_IDS_V2.safety,
        mutate(draft: LabWorkflowDraftV2) {
          draft.safetyPolicyIds[0] = "safety.unknown.v1";
        }
      }
    ] as const;

    for (const testCase of cases) {
      const draft =
        "migrated" in testCase && testCase.migrated
          ? createMigratedEndpointV2Draft()
          : createRunnableMechanicalV2Draft();
      testCase.mutate(draft);
      const outcome = validateLabWorkflowSpecV2(draft, {
        checkedAt: CHECKED_AT
      });

      expect(outcome.schemaValid, testCase.checkId).toBe(true);
      if (!outcome.schemaValid) throw new Error("Expected schema-valid case");
      expect(outcome.validation.passedCheckIds, testCase.checkId).not.toContain(
        testCase.checkId
      );
    }

    const schemaInvalid = validateLabWorkflowSpecV2(
      { schemaVersion: "2.0.0" },
      { checkedAt: CHECKED_AT }
    );
    expect(schemaInvalid.schemaValid).toBe(false);

    const eligibility = validateLabWorkflowSpecV2(
      createRunnableMechanicalV2Draft(),
      { checkedAt: CHECKED_AT }
    );
    expect(eligibility.schemaValid).toBe(true);
    if (!eligibility.schemaValid) throw new Error("Expected validated fixture");
    expect(eligibility.validation.passedCheckIds).not.toContain(
      WORKFLOW_VALIDATION_CHECK_IDS_V2.eligibility
    );
  });

  it("detects rule cycles, contradictions, and unreachable success", () => {
    const cyclic = createRunnableMechanicalV2Draft();
    const completion = cyclic.rules.find(
      ({ id }) => id === "rule.workflow_complete"
    );
    if (
      !completion ||
      completion.condition.kind !== "registered_completion_policy_satisfied"
    )
      throw new Error("Missing completion fixture rule");
    completion.condition.evidenceRuleIds.push("rule.workflow_complete");

    const contradictory = createRunnableMechanicalV2Draft();
    contradictory.rules.push({
      id: "rule.meniscus_forbidden",
      kind: "forbidden",
      condition: structuredClone(contradictory.rules[0]!.condition),
      severity: "procedural",
      recoverable: true,
      terminal: false,
      objectiveIds: ["meniscus_reading"]
    });

    const unreachable = createRunnableMechanicalV2Draft();
    const success = unreachable.rules.find(
      ({ id }) => id === "rule.workflow_complete"
    );
    if (!success) throw new Error("Missing success fixture rule");
    success.condition = {
      kind: "action_observed",
      actionId: "action.dispense.v1",
      sourceEquipmentInstanceId: "measurement_burette",
      targetEquipmentInstanceIds: []
    };

    const cycleIssues = validateLabWorkflowSpecV2(cyclic, {
      checkedAt: CHECKED_AT
    }).issues.map(({ code }) => code);
    const contradictionIssues = validateLabWorkflowSpecV2(contradictory, {
      checkedAt: CHECKED_AT
    }).issues.map(({ code }) => code);
    const unreachableIssues = validateLabWorkflowSpecV2(unreachable, {
      checkedAt: CHECKED_AT
    }).issues.map(({ code }) => code);

    expect(cycleIssues).toContain(WORKFLOW_VALIDATION_ISSUE_CODES_V2.ruleCycle);
    expect(contradictionIssues).toContain(
      WORKFLOW_VALIDATION_ISSUE_CODES_V2.ruleContradiction
    );
    expect(unreachableIssues).toContain(
      WORKFLOW_VALIDATION_ISSUE_CODES_V2.successUnreachable
    );
  });

  it("rejects tampered hashes, snapshots, and resolved validation artifacts", () => {
    const outcome = validateLabWorkflowSpecV2(
      createRunnableMechanicalV2Draft(),
      { checkedAt: CHECKED_AT }
    );
    expect(outcome.schemaValid).toBe(true);
    if (!outcome.schemaValid) throw new Error("Expected validated fixture");

    const hashTampered = structuredClone(outcome.spec);
    hashTampered.metadata.title = "Tampered title";
    expect(
      evaluateLabWorkflowEligibility(hashTampered, "preview").failureCodes
    ).toContain(WORKFLOW_ELIGIBILITY_FAILURE_CODES_V2.hashMismatch);

    const snapshotTampered = structuredClone(outcome.spec);
    snapshotTampered.validation.registrySnapshotIds.components =
      "components.1.0.0";
    expect(
      evaluateLabWorkflowEligibility(snapshotTampered, "preview").failureCodes
    ).toEqual(
      expect.arrayContaining([
        WORKFLOW_ELIGIBILITY_FAILURE_CODES_V2.registrySnapshotStale,
        WORKFLOW_ELIGIBILITY_FAILURE_CODES_V2.validationArtifactMismatch
      ])
    );

    const adapterTampered = structuredClone(outcome.spec);
    adapterTampered.validation.resolvedAdapters.pop();
    expect(
      evaluateLabWorkflowEligibility(adapterTampered, "preview").failureCodes
    ).toEqual(
      expect.arrayContaining([
        WORKFLOW_ELIGIBILITY_FAILURE_CODES_V2.resolvedAdapterMismatch,
        WORKFLOW_ELIGIBILITY_FAILURE_CODES_V2.validationArtifactMismatch
      ])
    );
  });

  it("treats Judge recommendations as advisory and clears stale critiques", () => {
    const initial = validateLabWorkflowSpecV2(
      createRunnableMechanicalV2Draft(),
      { checkedAt: CHECKED_AT }
    );
    expect(initial.schemaValid).toBe(true);
    if (!initial.schemaValid) throw new Error("Expected validated fixture");

    for (const recommendation of ["approve", "reject"] as const) {
      const reviewed = {
        ...structuredClone(initial.spec),
        judgeCritique: createJudgeCritique(
          initial.validation.canonicalSpecHash,
          recommendation
        )
      };
      const outcome = validateLabWorkflowSpecV2(reviewed, {
        checkedAt: CHECKED_AT
      });

      expect(outcome.schemaValid).toBe(true);
      if (!outcome.schemaValid) throw new Error("Expected reviewed fixture");
      expect(outcome.validation.status).toBe("runnable");
      expect(outcome.validation.previewEligible).toBe(false);
      expect(outcome.spec.judgeCritique?.recommendation).toBe(recommendation);
    }

    const stale = {
      ...structuredClone(initial.spec),
      judgeCritique: createJudgeCritique(
        "sha256:0000000000000000000000000000000000000000000000000000000000000000",
        "approve"
      )
    };
    const staleOutcome = validateLabWorkflowSpecV2(stale, {
      checkedAt: CHECKED_AT
    });
    expect(staleOutcome.schemaValid).toBe(true);
    if (!staleOutcome.schemaValid) throw new Error("Expected stale fixture");
    expect(staleOutcome.spec.judgeCritique).toBeNull();
    expect(staleOutcome.validation.status).toBe("runnable");

    for (const draft of [
      (() => {
        const unsupported = createMigratedEndpointV2Draft();
        delete unsupported.compatibility;
        return unsupported;
      })(),
      (() => {
        const unsafe = createRunnableMechanicalV2Draft();
        unsafe.safetyPolicyIds.push("safety.no_open_flame_mvp.v1");
        return unsafe;
      })()
    ]) {
      const rejected = validateLabWorkflowSpecV2(draft, {
        checkedAt: CHECKED_AT
      });
      expect(rejected.schemaValid).toBe(true);
      if (!rejected.schemaValid)
        throw new Error("Expected hard-invalid fixture");
      const approved = validateLabWorkflowSpecV2(
        {
          ...structuredClone(rejected.spec),
          judgeCritique: createJudgeCritique(
            rejected.validation.canonicalSpecHash,
            "approve"
          )
        },
        { checkedAt: CHECKED_AT }
      );
      expect(approved.schemaValid).toBe(true);
      if (!approved.schemaValid) throw new Error("Expected reviewed fixture");
      expect(approved.validation.runnable).toBe(false);
      expect(approved.validation.status).toBe(rejected.validation.status);
    }
  });

  it("does not mutate inputs and deeply freezes successful output", () => {
    const input = createRunnableMechanicalV2Draft();
    const before = cloneDraft(input);
    const outcome = validateLabWorkflowSpecV2(input, { checkedAt: CHECKED_AT });

    expect(input).toEqual(before);
    expect(outcome.schemaValid).toBe(true);
    if (!outcome.schemaValid) throw new Error("Expected validated fixture");
    expect(Object.isFrozen(outcome)).toBe(true);
    expect(Object.isFrozen(outcome.spec)).toBe(true);
    expect(Object.isFrozen(outcome.spec.equipment)).toBe(true);
    expect(Object.isFrozen(outcome.spec.equipment[0])).toBe(true);
    expect(Object.isFrozen(outcome.validation)).toBe(true);
    expect(Object.isFrozen(outcome.validation.registrySnapshotIds)).toBe(true);
    expect(Object.isFrozen(outcome.issues)).toBe(true);

    const later = validateLabWorkflowSpecV2(input, {
      checkedAt: "2026-07-17T21:00:00.000Z"
    });
    expect(later.schemaValid).toBe(true);
    if (!later.schemaValid) throw new Error("Expected later validation");
    expect(later.validation.canonicalSpecHash).toBe(
      outcome.validation.canonicalSpecHash
    );
    expect(later.issues).toEqual(outcome.issues);
    expect(later.validation.checkedAt).not.toBe(outcome.validation.checkedAt);
  });
});
