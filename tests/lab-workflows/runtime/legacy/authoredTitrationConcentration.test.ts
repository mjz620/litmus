import { describe, expect, it } from "vitest";

import { equivalenceVolumeML } from "../../../../src/experiments/titration/titration";
import {
  nearEndpointTitrantAddedML,
  createTitrationRetryScenario
} from "../../../../src/experiments/titration/retry";
import {
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  assembleGenericLabRuntime,
  createLegacyTitrationRuntimePorts
} from "../../../../src/lab-workflows/runtime";
import {
  migrateLabWorkflowV1ToV2,
  migrateLabWorkflowV2_0ToV2_1
} from "../../../../src/lab-workflows/schema/migration";
import {
  labWorkflowDraftV2_1Schema,
  type LabWorkflowDraftV2_1
} from "../../../../src/lab-workflows/schema/v2";
import {
  validateLabWorkflowSpecV2,
  WORKFLOW_VALIDATION_ISSUE_CODES_V2
} from "../../../../src/lab-workflows/validation";
import {
  ENDPOINT_CONTROL_PRELAB_DRAFT,
  ENDPOINT_CONTROL_PRELAB_REPLAY_SESSION_SEED
} from "../../../../src/lab-workflows/seeds";

const CHECKED_AT = "2026-07-19T12:00:00.000Z";

function authoredTitrationDraft(
  analyteM: string,
  titrantM: string
): LabWorkflowDraftV2_1 {
  const TITRATION_SAFETY = "safety.virtual_titration_ppe_notice.v1";
  const base = migrateLabWorkflowV2_0ToV2_1(
    migrateLabWorkflowV1ToV2(ENDPOINT_CONTROL_PRELAB_DRAFT)
  );
  const materials = base.materials.map((material) => {
    if (material.instanceId === "analyte") {
      return {
        ...material,
        materialProfileId: "reagent.hydrochloric_acid_aqueous.v1",
        quantityPresetId: "quantity-preset.hydrochloric_acid_solution_25ml.v1",
        initialization: {
          kind: "bounded_concentration" as const,
          configurationSchemaId:
            "schema.material_initialization.bounded_concentration.v1" as const,
          concentration: {
            decimalValue: analyteM,
            unitId: "unit.mol_per_l.v1" as const
          }
        }
      };
    }
    if (material.instanceId === "titrant") {
      return {
        ...material,
        materialProfileId: "reagent.sodium_hydroxide_aqueous.v1",
        quantityPresetId: "quantity-preset.sodium_hydroxide_solution_50ml.v1",
        initialization: {
          kind: "bounded_concentration" as const,
          configurationSchemaId:
            "schema.material_initialization.bounded_concentration.v1" as const,
          concentration: {
            decimalValue: titrantM,
            unitId: "unit.mol_per_l.v1" as const
          }
        }
      };
    }
    return material;
  });
  const safetyBindings = base.safetyBindings.map((binding) =>
    binding.safetyPolicyId === TITRATION_SAFETY
      ? {
          ...binding,
          materialInstanceIds: [
            ...new Set([
              ...binding.materialInstanceIds,
              "analyte",
              "titrant"
            ])
          ]
        }
      : binding
  );
  return labWorkflowDraftV2_1Schema.parse({
    ...base,
    materials,
    safetyBindings
  });
}

describe("LC2-901/902 authored acid/base concentrations", () => {
  it.each([
    ["0.05", "0.05"],
    ["0.1", "0.1"],
    ["0.2", "0.2"],
    ["0.25", "0.25"]
  ])(
    "accepts supported concentrations %s/%s mol/L that admit a near-endpoint seed",
    (analyteM, titrantM) => {
      const outcome = validateLabWorkflowSpecV2(
        authoredTitrationDraft(analyteM, titrantM),
        { checkedAt: CHECKED_AT }
      );
      expect(outcome.schemaValid).toBe(true);
      if (!outcome.schemaValid) throw new Error("Expected schema-valid draft");
      expect(outcome.issues.map(({ code }) => code)).not.toContain(
        WORKFLOW_VALIDATION_ISSUE_CODES_V2.materialInitializationInvalid
      );
      expect(outcome.issues.map(({ code }) => code)).not.toContain(
        WORKFLOW_VALIDATION_ISSUE_CODES_V2.titrationNearEndpointSeedUnsupported
      );
      expect(outcome.validation.runnable).toBe(true);
    }
  );

  it.each(["0.0499", "0.2501"])(
    "rejects out-of-range acid/base concentration %s as safety-related",
    (decimalValue) => {
      const outcome = validateLabWorkflowSpecV2(
        authoredTitrationDraft(decimalValue, "0.1"),
        { checkedAt: CHECKED_AT }
      );
      expect(outcome.schemaValid).toBe(true);
      if (!outcome.schemaValid) throw new Error("Expected schema-valid draft");
      expect(outcome.issues).toContainEqual(
        expect.objectContaining({
          code: WORKFLOW_VALIDATION_ISSUE_CODES_V2.materialInitializationInvalid,
          safetyRelated: true
        })
      );
      expect(outcome.validation.status).toBe("rejected_for_safety");
    }
  );

  it("initializes legacy titration chemistry from Composer-authored concentrations", () => {
    const outcome = validateLabWorkflowSpecV2(
      authoredTitrationDraft("0.2", "0.2"),
      { checkedAt: CHECKED_AT }
    );
    expect(outcome.schemaValid).toBe(true);
    if (!outcome.schemaValid) throw new Error("Expected schema-valid draft");
    expect(outcome.validation.runnable).toBe(true);

    const workflow = outcome.spec;
    const runtime = assembleGenericLabRuntime(
      workflow,
      {
        schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
        sessionId: "authored-titration-m",
        sessionSeed: ENDPOINT_CONTROL_PRELAB_REPLAY_SESSION_SEED,
        workflowId: workflow.id,
        workflowRevision: workflow.revision,
        workflowHash: workflow.validation.canonicalSpecHash
      },
      createLegacyTitrationRuntimePorts(workflow)
    );
    const serialized = JSON.parse(
      runtime.getState().compatibilityState!.serializedState
    );
    expect(serialized.config.analyte.concentrationM).toBeCloseTo(0.2, 10);
    expect(serialized.config.titrant.concentrationM).toBeCloseTo(0.2, 10);
    expect(serialized.titrantAddedML).toBe(
      nearEndpointTitrantAddedML(serialized.config)
    );
    expect(equivalenceVolumeML(serialized.config)).toBeCloseTo(25, 10);
  });

  it("recomputes the near-endpoint seed when the equivalence volume changes", () => {
    const outcome = validateLabWorkflowSpecV2(
      authoredTitrationDraft("0.1", "0.2"),
      { checkedAt: CHECKED_AT }
    );
    expect(outcome.schemaValid).toBe(true);
    if (!outcome.schemaValid) throw new Error("Expected schema-valid draft");
    const workflow = outcome.spec;
    const runtime = assembleGenericLabRuntime(
      workflow,
      {
        schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
        sessionId: "authored-titration-ratio",
        sessionSeed: ENDPOINT_CONTROL_PRELAB_REPLAY_SESSION_SEED,
        workflowId: workflow.id,
        workflowRevision: workflow.revision,
        workflowHash: workflow.validation.canonicalSpecHash
      },
      createLegacyTitrationRuntimePorts(workflow)
    );
    const serialized = JSON.parse(
      runtime.getState().compatibilityState!.serializedState
    );
    expect(serialized.config.analyte.concentrationM).toBeCloseTo(0.1, 10);
    expect(serialized.config.titrant.concentrationM).toBeCloseTo(0.2, 10);
    expect(equivalenceVolumeML(serialized.config)).toBeCloseTo(12.5, 10);
    expect(serialized.titrantAddedML).toBeCloseTo(9.5, 10);
    expect(
      runtime
        .getState()
        .materialLedger.materials.find(
          ({ materialInstanceId }) => materialInstanceId === "titrant"
        )?.locations
    ).toEqual([
      { equipmentInstanceId: "analyte_flask", amount: 9.5 },
      { equipmentInstanceId: "titrant_burette", amount: 40.5 }
    ]);
  });

  it("rejects acid/base ratios that cannot support the near-endpoint seed", () => {
    const outcome = validateLabWorkflowSpecV2(
      authoredTitrationDraft("0.25", "0.05"),
      { checkedAt: CHECKED_AT }
    );
    expect(outcome.schemaValid).toBe(true);
    if (!outcome.schemaValid) throw new Error("Expected schema-valid draft");
    expect(outcome.issues).toContainEqual(
      expect.objectContaining({
        code: WORKFLOW_VALIDATION_ISSUE_CODES_V2.titrationNearEndpointSeedUnsupported,
        path: "materials"
      })
    );
    expect(outcome.validation.runnable).toBe(false);
  });

  it("keeps the default EXAMPLE_STRONG endpoint-control seed at 22.00 mL", () => {
    const scenario = createTitrationRetryScenario(
      "endpoint_control",
      "default-seed"
    );
    expect(scenario.seed.titrantAddedML).toBe(22);
  });
});
