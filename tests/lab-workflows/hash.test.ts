import { describe, expect, it } from "vitest";

import {
  canonicalizeLabWorkflowSpec,
  getHashableLabWorkflowSpec,
  hashLabWorkflowSpec,
  labWorkflowHashMatches
} from "../../src/lab-workflows/hash";
import {
  judgeDimensionSchema,
  validatedLabWorkflowSpecSchema
} from "../../src/lab-workflows";
import { createSchemaValidWorkflowDraft } from "./schema/fixtures";

function createValidatedSpec() {
  const draft = createSchemaValidWorkflowDraft();
  const hash = hashLabWorkflowSpec(draft);
  return validatedLabWorkflowSpecSchema.parse({
    ...draft,
    supportStatus: "runnable",
    validation: {
      validatorVersion: "1.0.0",
      checkedAt: "2026-07-17T12:00:00Z",
      canonicalSpecHash: hash,
      registrySnapshotIds: {
        actions: "actions.1.0.0",
        components: "components.1.0.0",
        engines: "engines.1.0.0"
      },
      status: "runnable",
      runnable: true,
      previewEligible: true,
      assignmentEligible: true,
      issues: [],
      passedCheckIds: ["check.schema.v1"]
    },
    judgeCritique: null
  });
}

describe("canonical LabWorkflowSpec hashing", () => {
  it("produces a stable lowercase SHA-256 digest for the schema fixture", () => {
    const draft = createSchemaValidWorkflowDraft();

    expect(hashLabWorkflowSpec(draft)).toBe(
      "sha256:adc83cc11fc51b63b8481716c605dfbf9859adb31e7c0f0e8b943031457ab1ff"
    );
    expect(labWorkflowHashMatches(draft, hashLabWorkflowSpec(draft))).toBe(
      true
    );
  });

  it("sorts object keys recursively while preserving array order", () => {
    const draft = createSchemaValidWorkflowDraft();
    const reordered = structuredClone(draft);
    reordered.steps[0]!.allowedActions[0]!.authoredLimits = {
      zLimit: 5,
      maxVolumeMLPerAction: 0.5,
      aLimit: 1
    };
    const differentlyOrdered = structuredClone(reordered);
    differentlyOrdered.steps[0]!.allowedActions[0]!.authoredLimits = {
      aLimit: 1,
      maxVolumeMLPerAction: 0.5,
      zLimit: 5
    };

    expect(canonicalizeLabWorkflowSpec(reordered)).toBe(
      canonicalizeLabWorkflowSpec(differentlyOrdered)
    );
    expect(hashLabWorkflowSpec(reordered)).toBe(
      hashLabWorkflowSpec(differentlyOrdered)
    );

    differentlyOrdered.coachTriggers[0]!.flagIds.reverse();
    expect(hashLabWorkflowSpec(reordered)).not.toBe(
      hashLabWorkflowSpec(differentlyOrdered)
    );
  });

  it("excludes only validation status and critique artifacts", () => {
    const draft = createSchemaValidWorkflowDraft();
    const validated = createValidatedSpec();
    const alternateArtifact = {
      ...validated,
      supportStatus: "unsupported" as const,
      validation: {
        ...validated.validation,
        checkedAt: "2026-07-17T13:00:00Z",
        status: "unsupported" as const,
        runnable: false,
        previewEligible: false,
        assignmentEligible: false
      }
    };
    const critiquedArtifact = {
      ...validated,
      judgeCritique: {
        critiqueVersion: "1.0.0",
        specHash: validated.validation.canonicalSpecHash,
        scores: Object.fromEntries(
          judgeDimensionSchema.options.map((dimension) => [
            dimension,
            { score: 4, rationale: `Review of ${dimension}.` }
          ])
        ),
        issues: [],
        strengths: ["The workflow is focused."],
        summary: "The workflow is ready for teacher review.",
        recommendation: "approve" as const
      }
    };

    expect(getHashableLabWorkflowSpec(validated)).not.toHaveProperty(
      "supportStatus"
    );
    expect(getHashableLabWorkflowSpec(validated)).not.toHaveProperty(
      "validation"
    );
    expect(getHashableLabWorkflowSpec(validated)).not.toHaveProperty(
      "judgeCritique"
    );
    expect(hashLabWorkflowSpec(validated)).toBe(hashLabWorkflowSpec(draft));
    expect(hashLabWorkflowSpec(alternateArtifact)).toBe(
      hashLabWorkflowSpec(draft)
    );
    expect(hashLabWorkflowSpec(critiquedArtifact)).toBe(
      hashLabWorkflowSpec(draft)
    );
  });

  it("invalidates the hash for authored, versioned, ordered, and safety edits", () => {
    const baseline = createSchemaValidWorkflowDraft();
    const mutations = [
      { ...baseline, revision: baseline.revision + 1 },
      {
        ...baseline,
        metadata: { ...baseline.metadata, title: "A revised title" }
      },
      {
        ...baseline,
        steps: baseline.steps.map((step) => ({
          ...step,
          studentInstruction: `${step.studentInstruction} Record your choice.`
        }))
      },
      {
        ...baseline,
        safetyConstraints: baseline.safetyConstraints.map((constraint) => ({
          ...constraint,
          severity: "restricted" as const
        }))
      }
    ];

    for (const mutation of mutations) {
      expect(hashLabWorkflowSpec(mutation)).not.toBe(
        hashLabWorkflowSpec(baseline)
      );
    }
  });

  it("does not mutate the supplied workflow", () => {
    const draft = createSchemaValidWorkflowDraft();
    const before = structuredClone(draft);

    canonicalizeLabWorkflowSpec(draft);
    hashLabWorkflowSpec(draft);

    expect(draft).toEqual(before);
  });

  it("refuses to hash a structurally invalid workflow", () => {
    const invalid = {
      ...createSchemaValidWorkflowDraft(),
      arbitraryRuntimeCode: "execute-me"
    };

    expect(() => hashLabWorkflowSpec(invalid)).toThrow();
  });
});
