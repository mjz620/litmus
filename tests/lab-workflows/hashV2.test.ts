import { describe, expect, it } from "vitest";

import {
  LAB_WORKFLOW_HASH_DOMAIN_V2,
  canonicalizeLabWorkflowSpec,
  getHashableLabWorkflowSpec,
  hashLabWorkflowSpec,
  labWorkflowHashMatches,
  serializeLabWorkflowSpecHashPreimage
} from "../../src/lab-workflows/hash";
import {
  judgeDimensionSchema,
  migrateLabWorkflowV1ToV2,
  validatedLabWorkflowSpecV2Schema
} from "../../src/lab-workflows";
import {
  ENDPOINT_CONTROL_PRELAB_DRAFT,
  ENDPOINT_CONTROL_PRELAB_EXPECTED_HASH
} from "../../src/lab-workflows/seeds/endpointControlPrelab";
import { createSchemaValidWorkflowDraft } from "./schema/fixtures";

function migratedV2() {
  return migrateLabWorkflowV1ToV2(ENDPOINT_CONTROL_PRELAB_DRAFT);
}

function validatedV2() {
  const draft = migratedV2();
  const hash = hashLabWorkflowSpec(draft);
  return validatedLabWorkflowSpecV2Schema.parse({
    ...draft,
    supportStatus: "unsupported",
    validation: {
      artifactSchemaVersion: "2.0.0",
      validatedSchemaVersion: "2.0.0",
      validatorVersion: "2.0.0",
      checkedAt: "2026-07-17T20:00:00Z",
      canonicalSpecHash: hash,
      registrySnapshotIds: { capabilities: "capabilities.1.0.0" },
      resolvedAdapters: [],
      resolvedChemistryModels: [],
      status: "unsupported",
      runnable: false,
      previewEligible: false,
      assignmentEligible: false,
      issues: [],
      passedCheckIds: ["check.schema.v2"]
    },
    judgeCritique: null
  });
}

describe("version-aware LabWorkflowSpec hashing", () => {
  it("preserves both frozen v1 digests", () => {
    expect(hashLabWorkflowSpec(createSchemaValidWorkflowDraft())).toBe(
      "sha256:adc83cc11fc51b63b8481716c605dfbf9859adb31e7c0f0e8b943031457ab1ff"
    );
    expect(ENDPOINT_CONTROL_PRELAB_EXPECTED_HASH).toBe(
      "sha256:372b69f6855ce4fe2221f0b9ea839d3907f44f58701b7b938c7a28b7f36761c9"
    );
  });

  it("freezes the v2 domain-separated preimage and digest", () => {
    const draft = migratedV2();
    const canonical = canonicalizeLabWorkflowSpec(draft);
    const preimage = serializeLabWorkflowSpecHashPreimage(draft);

    expect(LAB_WORKFLOW_HASH_DOMAIN_V2).toBe(
      "lab-workflow-spec\0schema=2.0.0\0"
    );
    expect(Buffer.from(LAB_WORKFLOW_HASH_DOMAIN_V2, "utf8")).toEqual(
      Buffer.concat([
        Buffer.from("lab-workflow-spec", "utf8"),
        Buffer.from([0]),
        Buffer.from("schema=2.0.0", "utf8"),
        Buffer.from([0])
      ])
    );
    expect(preimage).toBe(`${LAB_WORKFLOW_HASH_DOMAIN_V2}${canonical}`);
    expect(hashLabWorkflowSpec(draft)).toMatchInlineSnapshot(
      `"sha256:4acc1b11ac2dff4978dcd7544717ac81c0d423d684e922d7ced36d13dd430444"`
    );
    expect(labWorkflowHashMatches(draft, hashLabWorkflowSpec(draft))).toBe(
      true
    );
  });

  it("excludes only validator status and Judge artifacts", () => {
    const draft = migratedV2();
    const validated = validatedV2();
    const critiqued = {
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
        strengths: ["The draft is inspectable."],
        summary: "Advisory critique cannot change deterministic eligibility.",
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
    expect(hashLabWorkflowSpec(critiqued)).toBe(hashLabWorkflowSpec(draft));
  });

  it("includes every authored v2 section, compatibility, and provenance", () => {
    const baseline = migratedV2();
    const mutations = [
      { ...baseline, id: `${baseline.id}.revised` },
      { ...baseline, revision: baseline.revision + 1 },
      { ...baseline, sourceRequest: `${baseline.sourceRequest} Revised.` },
      {
        ...baseline,
        metadata: { ...baseline.metadata, title: `${baseline.metadata.title}!` }
      },
      { ...baseline, catalog: { familyId: "family.catalog_only.v1" } },
      { ...baseline, objectiveIds: [...baseline.objectiveIds].reverse() },
      { ...baseline, equipment: [...baseline.equipment].reverse() },
      { ...baseline, materials: [...baseline.materials].reverse() },
      {
        ...baseline,
        layout: {
          ...baseline.layout,
          placements: [...baseline.layout.placements].reverse()
        }
      },
      {
        ...baseline,
        requiredChemistryCapabilityIds: [
          ...baseline.requiredChemistryCapabilityIds
        ].reverse()
      },
      {
        ...baseline,
        permittedActions: baseline.permittedActions.map((action, index) =>
          index === 0 ? { ...action, maxAttempts: 99 } : action
        )
      },
      {
        ...baseline,
        rules: baseline.rules.map((rule, index) =>
          index === 0 ? { ...rule, severity: "conceptual" as const } : rule
        )
      },
      { ...baseline, instructions: [...baseline.instructions].reverse() },
      {
        ...baseline,
        coachPolicy: {
          ...baseline.coachPolicy,
          triggers: baseline.coachPolicy.triggers.map((trigger, index) =>
            index === 0
              ? {
                  ...trigger,
                  cooldownEventCount: trigger.cooldownEventCount + 1
                }
              : trigger
          )
        }
      },
      {
        ...baseline,
        rubric: { ...baseline.rubric, title: `${baseline.rubric.title}!` }
      },
      {
        ...baseline,
        safetyPolicyIds: [
          ...baseline.safetyPolicyIds,
          "safety.no_open_flame_mvp.v1"
        ]
      },
      {
        ...baseline,
        safetyBindings: baseline.safetyBindings.map((binding, index) =>
          index === 0
            ? { ...binding, materialInstanceIds: ["titrant"] }
            : binding
        )
      },
      {
        ...baseline,
        presentation: {
          ...baseline.presentation,
          instructionGuidance: baseline.presentation.instructionGuidance.map(
            (guidance, index) =>
              index === 0
                ? {
                    ...guidance,
                    teacherRationale: `${guidance.teacherRationale} Revised.`
                  }
                : guidance
          )
        }
      },
      {
        ...baseline,
        compatibility: {
          ...baseline.compatibility!,
          runtimeAdapterVersion: "1.0.1"
        }
      },
      {
        ...baseline,
        provenance: { ...baseline.provenance!, migrationVersion: "1.0.1" }
      }
    ];

    for (const mutation of mutations) {
      expect(hashLabWorkflowSpec(mutation)).not.toBe(
        hashLabWorkflowSpec(baseline)
      );
    }
  });

  it("retains v1 optional-undefined normalization but rejects it for v2", () => {
    const v1 = createSchemaValidWorkflowDraft();
    v1.steps[0]!.allowedActions[0]!.maxAttempts = undefined;
    const withoutUndefined = structuredClone(v1);
    delete withoutUndefined.steps[0]!.allowedActions[0]!.maxAttempts;

    expect(hashLabWorkflowSpec(v1)).toBe(hashLabWorkflowSpec(withoutUndefined));

    const v2 = { ...migratedV2(), catalog: undefined };
    expect(() => hashLabWorkflowSpec(v2)).toThrow(/undefined/);
  });

  it("rejects non-JSON v2 inputs before schema normalization", () => {
    const invalidValues: unknown[] = [
      { ...migratedV2(), extra: BigInt(1) },
      { ...migratedV2(), extra: () => true },
      { ...migratedV2(), extra: Symbol("value") },
      { ...migratedV2(), extra: new Date() },
      { ...migratedV2(), extra: Number.NaN }
    ];

    const sparse = { ...migratedV2(), objectiveIds: new Array(1) };
    invalidValues.push(sparse);

    const customArray = [...migratedV2().objectiveIds] as string[] & {
      custom?: string;
    };
    customArray.custom = "not JSON";
    invalidValues.push({ ...migratedV2(), objectiveIds: customArray });

    const cyclic = { ...migratedV2() } as Record<string, unknown>;
    cyclic.cycle = cyclic;
    invalidValues.push(cyclic);

    const symbolKeyed = { ...migratedV2() } as Record<PropertyKey, unknown>;
    symbolKeyed[Symbol("hidden")] = true;
    invalidValues.push(symbolKeyed);

    const accessor = { ...migratedV2() } as Record<string, unknown>;
    Object.defineProperty(accessor, "hidden", {
      enumerable: true,
      get: () => "value"
    });
    invalidValues.push(accessor);

    const versionAccessor = { ...migratedV2() } as Record<string, unknown>;
    Object.defineProperty(versionAccessor, "schemaVersion", {
      enumerable: true,
      get: () => "2.0.0"
    });
    invalidValues.push(versionAccessor);

    const accessorArray = [...migratedV2().objectiveIds];
    Object.defineProperty(accessorArray, 0, {
      enumerable: true,
      get: () => migratedV2().objectiveIds[0]
    });
    invalidValues.push({ ...migratedV2(), objectiveIds: accessorArray });

    const nonEnumerable = { ...migratedV2() } as Record<string, unknown>;
    Object.defineProperty(nonEnumerable, "hidden", {
      enumerable: false,
      value: "value"
    });
    invalidValues.push(nonEnumerable);

    for (const invalid of invalidValues) {
      expect(() => hashLabWorkflowSpec(invalid)).toThrow();
    }
  });
});
