import { describe, expect, it } from "vitest";

import {
  LAB_WORKFLOW_SCHEMA_LIMITS,
  judgeCritiqueSchema,
  judgeDimensionSchema,
  labWorkflowDraftSchema,
  labWorkflowSpecSchema,
  safetyConstraintSchema,
  sha256HashSchema,
  validatedLabWorkflowSpecSchema
} from "../../../src/lab-workflows";
import { createSchemaValidWorkflowDraft } from "./fixtures";

function issuePaths(
  result: ReturnType<typeof labWorkflowSpecSchema.safeParse>
) {
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.path.join("."));
}

describe("LabWorkflowSpec schema", () => {
  it("parses a bounded unvalidated draft using existing registry IDs", () => {
    const draft = createSchemaValidWorkflowDraft();

    expect(labWorkflowSpecSchema.parse(draft)).toEqual(draft);
    expect(labWorkflowDraftSchema.parse(draft)).toEqual(draft);
  });

  it("rejects unknown fields at the root and every nested object", () => {
    const root = {
      ...createSchemaValidWorkflowDraft(),
      chemistryFormula: "generated chemistry is not a workflow field"
    };
    const nested = createSchemaValidWorkflowDraft() as Record<string, unknown>;
    nested.metadata = {
      ...(nested.metadata as object),
      arbitraryPhysics: { formula: "not allowed" }
    };

    expect(labWorkflowSpecSchema.safeParse(root).success).toBe(false);
    const nestedResult = labWorkflowSpecSchema.safeParse(nested);
    expect(nestedResult.success).toBe(false);
    expect(issuePaths(nestedResult)).toContain("metadata");
  });

  it("requires draft validation and critique artifacts to be cleared", () => {
    const draftWithClaimedValidation = {
      ...createSchemaValidWorkflowDraft(),
      validation: {
        validatorVersion: "1.0.0"
      }
    };
    const draftWithClaimedCritique = {
      ...createSchemaValidWorkflowDraft(),
      judgeCritique: {
        recommendation: "approve"
      }
    };

    expect(
      labWorkflowSpecSchema.safeParse(draftWithClaimedValidation).success
    ).toBe(false);
    expect(
      labWorkflowSpecSchema.safeParse(draftWithClaimedCritique).success
    ).toBe(false);
  });

  it("rejects malformed identifiers, numeric values, and oversized arrays", () => {
    const malformed = createSchemaValidWorkflowDraft();
    malformed.engineId = "closest titration engine";
    malformed.reagents[0]!.requestedAmount = Number.NaN;
    malformed.skillIds = Array.from(
      { length: LAB_WORKFLOW_SCHEMA_LIMITS.listItemCount + 1 },
      (_, index) => `skill_${index}`
    );

    const result = labWorkflowSpecSchema.safeParse(malformed);
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toEqual(
      expect.arrayContaining([
        "engineId",
        "reagents.0.requestedAmount",
        "skillIds"
      ])
    );
  });

  it("rejects unsupported schema versions and empty procedure steps", () => {
    const futureVersion = {
      ...createSchemaValidWorkflowDraft(),
      schemaVersion: "2.0.0"
    };
    const noSteps = { ...createSchemaValidWorkflowDraft(), steps: [] };

    expect(labWorkflowSpecSchema.safeParse(futureVersion).success).toBe(false);
    expect(labWorkflowSpecSchema.safeParse(noSteps).success).toBe(false);
  });
});

describe("safety and validation artifact schemas", () => {
  it("accepts each explicit safety severity and rejects invented severities", () => {
    const safety = createSchemaValidWorkflowDraft().safetyConstraints[0]!;

    for (const severity of ["required", "restricted", "prohibited"] as const) {
      expect(
        safetyConstraintSchema.safeParse({ ...safety, severity }).success
      ).toBe(true);
    }
    expect(
      safetyConstraintSchema.safeParse({ ...safety, severity: "advisory" })
        .success
    ).toBe(false);
  });

  it("represents a validator-produced safety rejection without making it runnable", () => {
    const draft = createSchemaValidWorkflowDraft();
    const rejected = {
      ...draft,
      supportStatus: "rejected_for_safety" as const,
      validation: {
        validatorVersion: "1.0.0",
        checkedAt: "2026-07-17T12:00:00Z",
        canonicalSpecHash:
          "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        registrySnapshotIds: {
          components: "components.1.0.0",
          safety: "safety.1.0.0"
        },
        status: "rejected_for_safety" as const,
        runnable: false,
        previewEligible: false,
        assignmentEligible: false,
        issues: [
          {
            code: "validation.prohibited_capability.v1",
            severity: "error" as const,
            path: "safetyConstraints[0]",
            message: "The requested capability is prohibited.",
            registryId: "safety.no_open_flame_mvp.v1",
            suggestedSupportedIds: [],
            safetyRelated: true
          }
        ],
        passedCheckIds: ["check.schema.v1"]
      },
      judgeCritique: null
    };

    expect(validatedLabWorkflowSpecSchema.safeParse(rejected).success).toBe(
      true
    );
    expect(labWorkflowSpecSchema.safeParse(rejected).success).toBe(true);
    expect(labWorkflowDraftSchema.safeParse(rejected).success).toBe(false);
  });

  it("requires a complete, bounded Judge critique without extra dimensions", () => {
    const scores = Object.fromEntries(
      judgeDimensionSchema.options.map((dimension) => [
        dimension,
        { score: 3, rationale: `Review of ${dimension}.` }
      ])
    );
    const critique = {
      critiqueVersion: "1.0.0",
      specHash:
        "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      scores,
      issues: [],
      strengths: ["The procedure is concise."],
      summary: "The workflow is usable but should be reviewed by the teacher.",
      recommendation: "revise"
    };

    expect(judgeCritiqueSchema.safeParse(critique).success).toBe(true);

    const missingDimension = structuredClone(critique);
    delete missingDimension.scores.skill_alignment;
    expect(judgeCritiqueSchema.safeParse(missingDimension).success).toBe(false);

    const inventedDimension = structuredClone(critique);
    inventedDimension.scores.scientific_truth = {
      score: 5,
      rationale: "A judge cannot add a new authority dimension."
    };
    expect(judgeCritiqueSchema.safeParse(inventedDimension).success).toBe(
      false
    );
  });

  it("rejects malformed validation and critique hashes", () => {
    const scores = Object.fromEntries(
      judgeDimensionSchema.options.map((dimension) => [
        dimension,
        { score: 3, rationale: `Review of ${dimension}.` }
      ])
    );

    expect(
      judgeCritiqueSchema.safeParse({
        critiqueVersion: "1.0.0",
        specHash: "sha256:not-a-digest",
        scores,
        issues: [],
        strengths: ["Clear objective."],
        summary: "Review complete.",
        recommendation: "approve"
      }).success
    ).toBe(false);
    expect(sha256HashSchema.safeParse("sha256:not-a-digest").success).toBe(
      false
    );
    expect(
      sha256HashSchema.safeParse(
        "sha256:ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789"
      ).success
    ).toBe(false);
  });
});
