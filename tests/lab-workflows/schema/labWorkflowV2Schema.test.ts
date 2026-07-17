import { describe, expect, expectTypeOf, it } from "vitest";

import {
  LAB_WORKFLOW_V2_SCHEMA_LIMITS,
  labWorkflowDraftSchema,
  labWorkflowDraftV1Schema,
  labWorkflowDraftV2Schema,
  labWorkflowSpecV1Schema,
  labWorkflowSpecV2Schema,
  validatedLabWorkflowSpecV2Schema,
  versionedLabWorkflowDraftSchema,
  versionedLabWorkflowSpecSchema,
  type LabWorkflowDraft,
  type LabWorkflowDraftV1,
  type LabWorkflowDraftV2,
  type LabWorkflowSpecV1,
  type LabWorkflowSpecV2,
  type VersionedLabWorkflowDraft,
  type VersionedLabWorkflowSpec
} from "../../../src/lab-workflows";
import { hashLabWorkflowSpec } from "../../../src/lab-workflows/hash";
import { createSchemaValidWorkflowDraft } from "./fixtures";

function createMinimalV2Draft(): LabWorkflowDraftV2 {
  return {
    schemaVersion: "2.0.0",
    id: "workflow.minimum.v2",
    revision: 1,
    sourceRequest: "Create an editable capability-driven laboratory draft.",
    metadata: {
      title: "Minimum v2 draft",
      learningObjective: "Compose a laboratory from verified primitives.",
      studentSummary: "A structurally valid incomplete laboratory draft.",
      gradeBand: "mixed_high_school",
      estimatedMinutes: 10,
      difficulty: "intro",
      tags: [],
      accessibilityNotes: [],
      deviceProfileId: "device.chromebook_core.v1"
    },
    objectiveIds: [],
    equipment: [],
    materials: [],
    layout: {
      configurationSchemaId: "schema.layout_configuration.titration_bench.v1",
      placements: []
    },
    requiredChemistryCapabilityIds: [],
    permittedActions: [],
    rules: [],
    instructions: [],
    coachPolicy: { triggers: [], adaptiveRetries: [] },
    rubric: {
      id: "rubric.minimum.v2",
      version: "2.0.0",
      title: "Minimum rubric",
      criteria: [],
      totalPoints: 0,
      passingPolicyId: "passing.percent_70.v1"
    },
    safetyPolicyIds: [],
    safetyBindings: [],
    presentation: {
      instructionGuidance: [],
      materialLabels: [],
      rulePrompts: []
    },
    supportStatus: "draft_unvalidated",
    validation: null,
    judgeCritique: null
  };
}

function createFullV2Draft(): LabWorkflowDraftV2 {
  return {
    ...createMinimalV2Draft(),
    id: "workflow.endpoint_control.v2",
    catalog: { familyId: "family.acid_base_titration.v1" },
    objectiveIds: ["endpoint_control", "meniscus_reading"],
    equipment: [
      {
        instanceId: "titrant_burette",
        equipmentDefinitionId: "component.burette.v1",
        configurationPresetId: "component_config.burette.50ml.v1",
        label: "Titrant burette",
        required: true
      },
      {
        instanceId: "analyte_flask",
        equipmentDefinitionId: "component.erlenmeyer_flask.v1",
        configurationPresetId: "component_config.erlenmeyer.125ml.v1",
        label: "Analyte flask",
        required: true
      }
    ],
    materials: [
      {
        instanceId: "titrant",
        materialProfileId: "reagent.sodium_hydroxide_0_100m.v1",
        containerInstanceId: "titrant_burette",
        quantityPresetId: "quantity-preset.sodium_hydroxide_0_100m_25ml.v1"
      }
    ],
    layout: {
      configurationSchemaId: "schema.layout_configuration.titration_bench.v1",
      placements: [
        {
          equipmentInstanceId: "titrant_burette",
          placementSlotId: "placement.bench_center_stand.v1"
        },
        {
          equipmentInstanceId: "analyte_flask",
          placementSlotId: "placement.under_burette.v1"
        }
      ]
    },
    requiredChemistryCapabilityIds: [
      "chemistry.acid_base_equilibrium.v1",
      "chemistry.indicator_response.v1"
    ],
    permittedActions: [
      {
        id: "permission.read_burette",
        actionId: "action.read_volume.v1",
        sourceEquipmentInstanceId: "titrant_burette",
        targetEquipmentInstanceIds: [],
        parameterPresetId: "action_params.burette_reading.v1",
        maxAttempts: 3,
        availability: {
          allSatisfiedRuleIds: [],
          allUnsatisfiedRuleIds: ["rule.meniscus_recorded"]
        }
      }
    ],
    rules: [
      {
        id: "rule.meniscus_recorded",
        kind: "required",
        condition: {
          kind: "observation_recorded",
          observationKeyId: "observation.reported_volume_ml.v1",
          eventTypeId: "event.read_meniscus.v1",
          expectedValueSourceId: "observable.burette_reading_ml.v1"
        },
        severity: "procedural",
        recoverable: true,
        terminal: false,
        objectiveIds: ["meniscus_reading"]
      }
    ],
    instructions: [
      {
        id: "instruction.read_burette",
        title: "Read the burette",
        guidance: "Record the bottom of the meniscus at eye level.",
        relatedRuleIds: ["rule.meniscus_recorded"]
      }
    ],
    coachPolicy: {
      triggers: [
        {
          id: "coach.high_flow",
          objectiveIds: ["endpoint_control"],
          eventTypeIds: ["event.add_titrant.v1"],
          flagIds: ["flag.endpoint_overshoot.v1"],
          triggerTypeId: "coach_trigger.mistake_reflection.v1",
          hintStrategyId: "hint.endpoint_control_graduated.v1",
          maxHintLevel: 2,
          cooldownEventCount: 2,
          staySilentOnEventReasonIds: [
            "evidence.controlled_addition_near_endpoint.v1"
          ]
        }
      ],
      adaptiveRetries: [
        {
          id: "retry.endpoint",
          templateId: "retry.endpoint_control_near_endpoint.v1",
          targetObjectiveIds: ["endpoint_control"],
          eligibleFlagIds: ["flag.endpoint_overshoot.v1"],
          initializationPresetId: "seed.titration.near_endpoint_22ml.v1",
          maxMinutes: 3,
          studentGoal: "Reach the endpoint with controlled additions.",
          successEvidenceReasonIds: [
            "evidence.controlled_addition_near_endpoint.v1"
          ]
        }
      ]
    },
    rubric: {
      id: "rubric.endpoint_control.v2",
      version: "2.0.0",
      title: "Endpoint-control rubric",
      criteria: [
        {
          id: "criterion.meniscus",
          objectiveIds: ["meniscus_reading"],
          ruleIds: ["rule.meniscus_recorded"],
          description: "Records a valid burette observation.",
          maxPoints: 2,
          assessmentModeId: "assessment.event_plus_entry.v1",
          evidenceMappings: [
            {
              kind: "semantic_event_observation",
              observationKeyId: "observation.reported_volume_ml.v1",
              eventTypeId: "event.read_meniscus.v1",
              required: true
            }
          ],
          scoringGuide: ["2: precise reading"]
        }
      ],
      totalPoints: 2,
      passingPolicyId: "passing.percent_70.v1"
    },
    safetyPolicyIds: ["safety.virtual_titration_ppe_notice.v1"],
    safetyBindings: [
      {
        safetyPolicyId: "safety.virtual_titration_ppe_notice.v1",
        equipmentInstanceIds: ["titrant_burette", "analyte_flask"],
        materialInstanceIds: ["titrant"]
      }
    ],
    presentation: {
      instructionGuidance: [
        {
          instructionId: "instruction.read_burette",
          teacherRationale: "Establishes apparatus-appropriate reading.",
          equipmentInstanceIds: ["titrant_burette"]
        }
      ],
      materialLabels: [
        {
          materialInstanceId: "titrant",
          displayLabel: "0.100 M sodium hydroxide"
        }
      ],
      rulePrompts: [
        {
          ruleId: "rule.meniscus_recorded",
          studentPrompt: "Record the reading to the correct precision."
        }
      ]
    },
    compatibility: {
      kind: "legacy_v1",
      runtimeAdapterId: "runtime-adapter.titration.v1",
      runtimeAdapterVersion: "1.0.0",
      engineId: "engine.titration.v1",
      engineConfigurationPresetId:
        "engine_config.titration.strong_acid_strong_base_25ml.v1",
      initializationPresetId: "seed.titration.near_endpoint_22ml.v1",
      equipmentRoleBindings: [
        {
          equipmentInstanceId: "titrant_burette",
          legacyRoleId: "titrant_delivery"
        }
      ],
      materialRoleBindings: [
        { materialInstanceId: "titrant", legacyRoleId: "titrant" }
      ]
    },
    provenance: {
      kind: "migrated_v1",
      sourceSchemaVersion: "1.0.0",
      sourceSpecHash:
        "sha256:adc83cc11fc51b63b8481716c605dfbf9859adb31e7c0f0e8b943031457ab1ff",
      migrationVersion: "1.0.0",
      sourceRegistrySnapshotIds: {
        components: "components.2.0.0",
        actions: "actions.2.0.0"
      }
    }
  };
}

function createStructurallyValidatedV2() {
  const draft = createFullV2Draft();
  return {
    ...draft,
    supportStatus: "runnable" as const,
    validation: {
      artifactSchemaVersion: "2.0.0" as const,
      validatedSchemaVersion: "2.0.0" as const,
      validatorVersion: "2.0.0",
      checkedAt: "2026-07-17T20:00:00Z",
      canonicalSpecHash:
        "sha256:1111111111111111111111111111111111111111111111111111111111111111",
      registrySnapshotIds: {
        capabilities: "capabilities.1.0.0",
        components: "components.2.0.0",
        actions: "actions.2.0.0",
        materials: "reagents.2.1.0",
        chemistryModels: "chemistry-models.1.0.0"
      },
      resolvedAdapters: [
        {
          kind: "visual" as const,
          ownerId: "component.burette.v1",
          adapterId: "visual-adapter.burette.v1",
          version: "1.0.0"
        }
      ],
      resolvedChemistryModels: [
        {
          modelId: "chemistry-model.legacy_titration.v1",
          version: "1.0.0",
          providedCapabilityIds: ["chemistry.acid_base_equilibrium.v1" as const]
        }
      ],
      status: "runnable" as const,
      runnable: true,
      previewEligible: true,
      assignmentEligible: false,
      issues: [],
      passedCheckIds: ["check.schema.v2"]
    },
    judgeCritique: null
  };
}

describe("LabWorkflowSpec v2 schema", () => {
  it("parses minimal and full unvalidated drafts", () => {
    const minimum = createMinimalV2Draft();
    const full = createFullV2Draft();

    expect(labWorkflowDraftV2Schema.parse(minimum)).toEqual(minimum);
    expect(labWorkflowSpecV2Schema.parse(full)).toEqual(full);
  });

  it("structurally parses a validated artifact without granting eligibility", () => {
    const claimedArtifact = createStructurallyValidatedV2();

    expect(validatedLabWorkflowSpecV2Schema.parse(claimedArtifact)).toEqual(
      claimedArtifact
    );
    expect(claimedArtifact.validation.canonicalSpecHash).not.toBe(
      claimedArtifact.provenance?.sourceSpecHash
    );
  });

  it("keeps catalog family and legacy runtime compatibility optional", () => {
    const minimum = createMinimalV2Draft();

    expect(minimum).not.toHaveProperty("catalog");
    expect(minimum).not.toHaveProperty("compatibility");
    expect(labWorkflowDraftV2Schema.safeParse(minimum).success).toBe(true);
    expect(
      labWorkflowDraftV2Schema.safeParse({
        ...createFullV2Draft(),
        compatibility: {
          ...createFullV2Draft().compatibility!,
          runtimeAdapterId: "runtime-adapter.invented.v1"
        }
      }).success
    ).toBe(false);
  });

  it("rejects v1-only fields and unknown nested fields", () => {
    const draft = createMinimalV2Draft();
    expect(
      labWorkflowDraftV2Schema.safeParse({
        ...draft,
        familyId: "family.acid_base_titration.v1",
        engineId: "engine.titration.v1",
        reagents: [],
        steps: []
      }).success
    ).toBe(false);

    const nestedMutations = [
      { ...draft, metadata: { ...draft.metadata, formula: "H+" } },
      { ...draft, catalog: { familyId: "family.example.v1", dispatch: true } },
      {
        ...createFullV2Draft(),
        equipment: [
          { ...createFullV2Draft().equipment[0]!, componentCode: "Burette" }
        ]
      },
      {
        ...draft,
        layout: { ...draft.layout, transformScript: "execute()" }
      },
      {
        ...draft,
        coachPolicy: { ...draft.coachPolicy, chatMode: "unconstrained" }
      }
    ];

    for (const mutation of nestedMutations) {
      expect(labWorkflowDraftV2Schema.safeParse(mutation).success).toBe(false);
    }
  });

  it("enforces the draft validation and Judge trust boundary", () => {
    const draft = createFullV2Draft();
    const artifact = createStructurallyValidatedV2();

    expect(
      labWorkflowSpecV2Schema.safeParse({
        ...draft,
        supportStatus: "runnable",
        validation: artifact.validation
      }).success
    ).toBe(true);
    expect(
      labWorkflowSpecV2Schema.safeParse({
        ...draft,
        validation: artifact.validation
      }).success
    ).toBe(false);
    expect(
      labWorkflowSpecV2Schema.safeParse({
        ...draft,
        judgeCritique: { recommendation: "approve" }
      }).success
    ).toBe(false);
    expect(
      labWorkflowSpecV2Schema.safeParse({
        ...draft,
        supportStatus: "runnable",
        validation: null
      }).success
    ).toBe(false);
  });

  it("bounds setup, action, layout, and reference collections", () => {
    const draft = createMinimalV2Draft();
    const equipment = {
      instanceId: "equipment.sample",
      equipmentDefinitionId: "component.burette.v1",
      configurationPresetId: "component_config.burette.50ml.v1",
      label: "Sample equipment",
      required: true
    };
    const action = {
      id: "permission.sample",
      actionId: "action.read_volume.v1",
      targetEquipmentInstanceIds: [],
      availability: {
        allSatisfiedRuleIds: [],
        allUnsatisfiedRuleIds: []
      }
    };

    const mutations = [
      {
        ...draft,
        equipment: Array.from(
          { length: LAB_WORKFLOW_V2_SCHEMA_LIMITS.equipmentCount + 1 },
          (_, index) => ({ ...equipment, instanceId: `equipment.${index}` })
        )
      },
      {
        ...draft,
        layout: {
          ...draft.layout,
          placements: Array.from(
            { length: LAB_WORKFLOW_V2_SCHEMA_LIMITS.placementCount + 1 },
            (_, index) => ({
              equipmentInstanceId: `equipment.${index}`,
              placementSlotId: "placement.bench_center_stand.v1"
            })
          )
        }
      },
      {
        ...draft,
        permittedActions: Array.from(
          { length: LAB_WORKFLOW_V2_SCHEMA_LIMITS.permittedActionCount + 1 },
          (_, index) => ({ ...action, id: `permission.${index}` })
        )
      },
      {
        ...draft,
        objectiveIds: Array.from(
          { length: LAB_WORKFLOW_V2_SCHEMA_LIMITS.referenceCount + 1 },
          (_, index) => `objective.${index}`
        )
      }
    ];

    for (const mutation of mutations) {
      expect(labWorkflowDraftV2Schema.safeParse(mutation).success).toBe(false);
    }
  });

  it("rejects non-finite action limits and invalid capability IDs", () => {
    const full = createFullV2Draft();
    expect(
      labWorkflowDraftV2Schema.safeParse({
        ...full,
        permittedActions: [
          {
            ...full.permittedActions[0]!,
            authoredLimits: { maximum: Infinity }
          }
        ]
      }).success
    ).toBe(false);
    expect(
      labWorkflowDraftV2Schema.safeParse({
        ...full,
        requiredChemistryCapabilityIds: ["chemistry.invented.v1"]
      }).success
    ).toBe(false);
  });
});

describe("strict schema-version facade", () => {
  it("parses v1 and v2 and narrows the inferred version union", () => {
    const v1 = createSchemaValidWorkflowDraft();
    const v2 = createFullV2Draft();
    const parsedV1 = versionedLabWorkflowSpecSchema.parse(v1);
    const parsedV2 = versionedLabWorkflowSpecSchema.parse(v2);

    expect(parsedV1.schemaVersion).toBe("1.0.0");
    expect(parsedV2.schemaVersion).toBe("2.0.0");
    expect(versionedLabWorkflowDraftSchema.parse(v1)).toEqual(v1);
    expect(versionedLabWorkflowDraftSchema.parse(v2)).toEqual(v2);

    expectTypeOf<LabWorkflowDraftV1>().toEqualTypeOf<LabWorkflowDraft>();
    expectTypeOf<VersionedLabWorkflowDraft>().toEqualTypeOf<
      LabWorkflowDraftV1 | LabWorkflowDraftV2
    >();
    expectTypeOf<VersionedLabWorkflowSpec>().toEqualTypeOf<
      LabWorkflowSpecV1 | LabWorkflowSpecV2
    >();
  });

  it("rejects absent, malformed, and unknown schema versions", () => {
    const v2 = createMinimalV2Draft();
    const absent: Record<string, unknown> = structuredClone(v2);
    delete absent.schemaVersion;

    for (const schemaVersion of [
      undefined,
      null,
      1,
      2,
      "3.0.0",
      "2.0.0-beta"
    ]) {
      const candidate =
        schemaVersion === undefined ? absent : { ...v2, schemaVersion };
      const result = versionedLabWorkflowSpecSchema.safeParse(candidate);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((issue) => issue.path[0] === "schemaVersion")
        ).toBe(true);
      }
    }
  });

  it("rejects cross-version masquerading", () => {
    const v1 = createSchemaValidWorkflowDraft();
    const v2 = createMinimalV2Draft();

    expect(
      versionedLabWorkflowSpecSchema.safeParse({
        ...v1,
        schemaVersion: "2.0.0"
      }).success
    ).toBe(false);
    expect(
      versionedLabWorkflowSpecSchema.safeParse({
        ...v2,
        schemaVersion: "1.0.0"
      }).success
    ).toBe(false);
    expect(
      labWorkflowSpecV1Schema.safeParse({ ...v1, equipment: [] }).success
    ).toBe(false);
  });

  it("keeps compatibility aliases v1-only while hashing by version", () => {
    const v1 = createSchemaValidWorkflowDraft();
    const v2 = createMinimalV2Draft();

    expect(labWorkflowDraftSchema.parse(v1)).toEqual(v1);
    expect(labWorkflowDraftV1Schema.parse(v1)).toEqual(v1);
    expect(hashLabWorkflowSpec(v1)).toBe(
      "sha256:adc83cc11fc51b63b8481716c605dfbf9859adb31e7c0f0e8b943031457ab1ff"
    );
    expect(hashLabWorkflowSpec(v2)).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(hashLabWorkflowSpec(v2)).not.toBe(hashLabWorkflowSpec(v1));
  });
});
