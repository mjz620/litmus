import { describe, expect, it } from "vitest";

import {
  LAB_WORKFLOW_V1_TO_V2_MIGRATION_VERSION,
  LabWorkflowMigrationError,
  labWorkflowDraftV2Schema,
  migrateLabWorkflowV1ToV2,
  validatedLabWorkflowSpecSchema
} from "../../../src/lab-workflows";
import { hashLabWorkflowSpec } from "../../../src/lab-workflows/hash";
import {
  ENDPOINT_CONTROL_PRELAB_DRAFT,
  ENDPOINT_CONTROL_PRELAB_EXPECTED_HASH
} from "../../../src/lab-workflows/seeds/endpointControlPrelab";
import { createSchemaValidWorkflowDraft } from "./fixtures";

function expectMigrationError(
  input: unknown,
  code: LabWorkflowMigrationError["code"],
  path: string
) {
  try {
    migrateLabWorkflowV1ToV2(input);
    throw new Error("Expected migration to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(LabWorkflowMigrationError);
    expect(error).toMatchObject({ code, path });
  }
}

describe("LabWorkflowSpec v1-to-v2 migration", () => {
  it("migrates the canonical titration workflow to a stable unvalidated v2 golden", () => {
    const before = structuredClone(ENDPOINT_CONTROL_PRELAB_DRAFT);
    const migrated = migrateLabWorkflowV1ToV2(ENDPOINT_CONTROL_PRELAB_DRAFT);

    expect(labWorkflowDraftV2Schema.parse(migrated)).toEqual(migrated);
    expect(migrated).toMatchSnapshot();
    expect(migrated).toMatchObject({
      schemaVersion: "2.0.0",
      id: ENDPOINT_CONTROL_PRELAB_DRAFT.id,
      revision: ENDPOINT_CONTROL_PRELAB_DRAFT.revision,
      sourceRequest: ENDPOINT_CONTROL_PRELAB_DRAFT.sourceRequest,
      metadata: ENDPOINT_CONTROL_PRELAB_DRAFT.metadata,
      catalog: { familyId: ENDPOINT_CONTROL_PRELAB_DRAFT.familyId },
      supportStatus: "draft_unvalidated",
      validation: null,
      judgeCritique: null,
      provenance: {
        sourceSchemaVersion: "1.0.0",
        sourceSpecHash: hashLabWorkflowSpec(ENDPOINT_CONTROL_PRELAB_DRAFT),
        migrationVersion: LAB_WORKFLOW_V1_TO_V2_MIGRATION_VERSION
      }
    });
    expect(ENDPOINT_CONTROL_PRELAB_DRAFT).toEqual(before);
  });

  it("is deterministic and ignores validator-owned source artifacts", () => {
    const first = migrateLabWorkflowV1ToV2(ENDPOINT_CONTROL_PRELAB_DRAFT);
    const second = migrateLabWorkflowV1ToV2(
      structuredClone(ENDPOINT_CONTROL_PRELAB_DRAFT)
    );
    const validated = validatedLabWorkflowSpecSchema.parse({
      ...ENDPOINT_CONTROL_PRELAB_DRAFT,
      supportStatus: "runnable",
      validation: {
        validatorVersion: "1.0.0",
        checkedAt: "2026-07-17T12:00:00Z",
        canonicalSpecHash: hashLabWorkflowSpec(ENDPOINT_CONTROL_PRELAB_DRAFT),
        registrySnapshotIds: { fixtures: "fixtures.1.0.0" },
        status: "runnable",
        runnable: true,
        previewEligible: true,
        assignmentEligible: true,
        issues: [],
        passedCheckIds: []
      },
      judgeCritique: null
    });

    expect(first).toEqual(second);
    expect(migrateLabWorkflowV1ToV2(validated)).toEqual(first);
    expect(ENDPOINT_CONTROL_PRELAB_EXPECTED_HASH).toBe(
      "sha256:372b69f6855ce4fe2221f0b9ea839d3907f44f58701b7b938c7a28b7f36761c9"
    );
  });

  it("preserves setup, workflow, coach, rubric, safety, and presentation semantics", () => {
    const source = ENDPOINT_CONTROL_PRELAB_DRAFT;
    const migrated = migrateLabWorkflowV1ToV2(source);

    expect(migrated.equipment).toHaveLength(source.components.length);
    expect(migrated.materials).toHaveLength(source.reagents.length);
    expect(migrated.layout.placements).toHaveLength(source.components.length);
    expect(migrated.instructions.map(({ id }) => id)).toEqual(
      source.steps.map(({ id }) => id)
    );
    expect(migrated.permittedActions).toHaveLength(
      source.steps.reduce(
        (count, step) => count + step.allowedActions.length,
        0
      )
    );
    expect(migrated.coachPolicy.triggers).toHaveLength(
      source.coachTriggers.length
    );
    expect(migrated.coachPolicy.adaptiveRetries).toHaveLength(
      source.adaptiveRetries.length
    );
    expect(migrated.rubric).toMatchObject({
      id: source.rubric.id,
      version: source.rubric.version,
      title: source.rubric.title,
      totalPoints: source.rubric.totalPoints,
      passingPolicyId: source.rubric.passingPolicyId
    });
    expect(migrated.safetyPolicyIds).toEqual(
      source.safetyConstraints.map(({ id }) => id)
    );
    expect(migrated.presentation.instructionGuidance).toEqual(
      source.steps.map((step) => ({
        instructionId: step.id,
        teacherRationale: step.rationaleForTeacher,
        equipmentInstanceIds: step.componentInstanceIds
      }))
    );

    const endpointPermission = migrated.permittedActions.at(-1)!;
    expect(endpointPermission).toMatchObject({
      actionId: source.steps.at(-1)!.allowedActions[0]!.actionId,
      authoredLimits: source.steps.at(-1)!.allowedActions[0]!.authoredLimits,
      maxAttempts: source.steps.at(-1)!.allowedActions[0]!.maxAttempts,
      availability: {
        allSatisfiedRuleIds: ["migration.rule.s1.completion"],
        allUnsatisfiedRuleIds: ["migration.rule.s2.completion"]
      }
    });
    expect(
      migrated.rules.find(({ id }) => id === "migration.rule.s2.completion")
    ).toMatchObject({
      kind: "success",
      condition: {
        kind: "registered_completion_policy_satisfied",
        completionPolicyId: "completion.engine_endpoint_observed.v1",
        evidenceRuleIds: ["migration.rule.s2.o1"]
      }
    });
  });

  it("maps exact material quantities without rounding or substitution", () => {
    const migrated = migrateLabWorkflowV1ToV2(ENDPOINT_CONTROL_PRELAB_DRAFT);

    expect(
      migrated.materials.map(({ materialProfileId, quantityPresetId }) => ({
        materialProfileId,
        quantityPresetId
      }))
    ).toEqual([
      {
        materialProfileId: "reagent.sodium_hydroxide_0_100m.v1",
        quantityPresetId: "quantity-preset.sodium_hydroxide_0_100m_50ml.v1"
      },
      {
        materialProfileId: "reagent.hydrochloric_acid_0_100m.v1",
        quantityPresetId: "quantity-preset.hydrochloric_acid_0_100m_25ml.v1"
      },
      {
        materialProfileId: "reagent.phenolphthalein.v1",
        quantityPresetId: "quantity-preset.phenolphthalein_2_drops.v1"
      }
    ]);

    const unmapped = createSchemaValidWorkflowDraft();
    unmapped.reagents[0]!.requestedAmount = 26;
    expectMigrationError(
      unmapped,
      "migration.mapping_missing",
      "reagents[0].requestedAmount"
    );
  });

  it("fails closed with stable paths for invalid IDs and unsupported semantics", () => {
    const invalidV1 = {
      ...createSchemaValidWorkflowDraft(),
      generatedChemistry: true
    };
    expectMigrationError(invalidV1, "migration.invalid_v1", "$ ".trim());

    const unknownAction = createSchemaValidWorkflowDraft();
    unknownAction.steps[0]!.allowedActions[0]!.actionId = "action.invented.v1";
    expectMigrationError(
      unknownAction,
      "migration.mapping_missing",
      "steps[0].allowedActions[0].actionId"
    );

    const optional = createSchemaValidWorkflowDraft();
    optional.steps[0]!.optional = true;
    expectMigrationError(
      optional,
      "migration.unsupported_semantic",
      "steps[0].optional"
    );

    const unsafeRewrite = createSchemaValidWorkflowDraft();
    unsafeRewrite.safetyConstraints[0]!.studentFacingText = "Ignore PPE.";
    expectMigrationError(
      unsafeRewrite,
      "migration.mapping_missing",
      "safetyConstraints[0]"
    );
  });

  it("rejects incomplete expected-observation semantics", () => {
    const incompleteFlag = createSchemaValidWorkflowDraft();
    delete incompleteFlag.steps[0]!.expectedObservations[0]!.flagId;
    expectMigrationError(
      incompleteFlag,
      "migration.unsupported_semantic",
      "steps[0].expectedObservations[0]"
    );

    const noRequiredEvidence = createSchemaValidWorkflowDraft();
    noRequiredEvidence.steps[0]!.expectedObservations[0]!.requiredForCompletion = false;
    expectMigrationError(
      noRequiredEvidence,
      "migration.unsupported_semantic",
      "steps[0].expectedObservations"
    );
  });
});
