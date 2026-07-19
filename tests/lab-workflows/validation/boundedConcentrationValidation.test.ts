import { describe, expect, it } from "vitest";

import { migrateLabWorkflowV2_0ToV2_1 } from "../../../src/lab-workflows/schema/migration";
import {
  labWorkflowDraftV2_1Schema,
  type LabWorkflowDraftV2_1
} from "../../../src/lab-workflows/schema/v2";
import {
  validateLabWorkflowSpecV2,
  WORKFLOW_VALIDATION_ISSUE_CODES_V2
} from "../../../src/lab-workflows/validation";
import { createRunnableMechanicalV2Draft } from "./v2Fixtures";

const CHECKED_AT = "2026-07-18T12:30:00.000Z";
const SOLUTION_SAFETY =
  "safety.virtual_solution_preparation_ppe_notice.v1" as const;

function createDraft(decimalValue = "0.25"): LabWorkflowDraftV2_1 {
  const base = migrateLabWorkflowV2_0ToV2_1(createRunnableMechanicalV2Draft());
  return labWorkflowDraftV2_1Schema.parse({
    ...base,
    equipment: [
      ...base.equipment,
      {
        instanceId: "stock_bottle",
        equipmentDefinitionId: "component.reagent_bottle.v1",
        configurationPresetId:
          "component_config.reagent_bottle.stock_solution.v1",
        label: "Sodium chloride stock",
        required: true
      }
    ],
    materials: [
      {
        instanceId: "stock_solution",
        materialProfileId: "reagent.sodium_chloride_aqueous.v1",
        containerInstanceId: "stock_bottle",
        quantityPresetId: "quantity-preset.sodium_chloride_solution_50ml.v1",
        initialization: {
          kind: "bounded_concentration",
          configurationSchemaId:
            "schema.material_initialization.bounded_concentration.v1",
          concentration: {
            decimalValue,
            unitId: "unit.mol_per_l.v1"
          }
        }
      }
    ],
    requiredChemistryCapabilityIds: ["chemistry.concentration_dilution.v1"],
    safetyPolicyIds: [...base.safetyPolicyIds, SOLUTION_SAFETY],
    safetyBindings: [
      ...base.safetyBindings,
      {
        safetyPolicyId: SOLUTION_SAFETY,
        equipmentInstanceIds: ["stock_bottle"],
        materialInstanceIds: ["stock_solution"]
      }
    ]
  });
}

function issueCodes(draft: LabWorkflowDraftV2_1): readonly string[] {
  return validateLabWorkflowSpecV2(draft, { checkedAt: CHECKED_AT }).issues.map(
    ({ code }) => code
  );
}

describe("LC2-501A concentration hard validation", () => {
  it.each(["0.1", "0.1001", "0.25", "0.9999", "1"])(
    "accepts canonical supported value %s at the material boundary",
    (decimalValue) => {
      const codes = issueCodes(createDraft(decimalValue));
      expect(codes).not.toContain(
        WORKFLOW_VALIDATION_ISSUE_CODES_V2.materialInitializationMissing
      );
      expect(codes).not.toContain(
        WORKFLOW_VALIDATION_ISSUE_CODES_V2.materialInitializationInvalid
      );
    }
  );

  it.each(["0.0999", "1.0001"])(
    "rejects unsupported range value %s as safety-related",
    (decimalValue) => {
      const outcome = validateLabWorkflowSpecV2(createDraft(decimalValue), {
        checkedAt: CHECKED_AT
      });
      if (!outcome.schemaValid) throw new Error("Expected schema-valid draft");
      expect(outcome.issues).toContainEqual(
        expect.objectContaining({
          code: WORKFLOW_VALIDATION_ISSUE_CODES_V2.materialInitializationInvalid,
          safetyRelated: true
        })
      );
      expect(outcome.validation.status).toBe("rejected_for_safety");
      expect(outcome.validation.runnable).toBe(false);
    }
  );

  it("requires initialization for an authorable material profile", () => {
    const draft = createDraft();
    const material = draft.materials[0]!;
    const { initialization, ...withoutInitialization } = material;
    void initialization;
    const missing = labWorkflowDraftV2_1Schema.parse({
      ...draft,
      materials: [withoutInitialization]
    });
    expect(issueCodes(missing)).toContain(
      WORKFLOW_VALIDATION_ISSUE_CODES_V2.materialInitializationMissing
    );
  });

  it.each([
    ["schema.material_initialization.aqueous_solution.v1", "unit.mol_per_l.v1"],
    ["schema.material_initialization.bounded_concentration.v1", "unit.ml.v1"],
    ["schema.material_initialization.unknown.v1", "unit.mol_per_l.v1"]
  ])("rejects mismatched schema %s or unit %s", (schemaId, unitId) => {
    const draft = createDraft();
    const initialization = draft.materials[0]!.initialization!;
    const invalid = labWorkflowDraftV2_1Schema.parse({
      ...draft,
      materials: [
        {
          ...draft.materials[0],
          initialization: {
            ...initialization,
            configurationSchemaId: schemaId,
            concentration: {
              ...initialization.concentration,
              unitId
            }
          }
        }
      ]
    });
    expect(issueCodes(invalid)).toContain(
      WORKFLOW_VALIDATION_ISSUE_CODES_V2.materialInitializationInvalid
    );
  });

  it("requires the registered concentration safety policy and material binding", () => {
    const draft = createDraft();
    const unsafe = labWorkflowDraftV2_1Schema.parse({
      ...draft,
      safetyPolicyIds: draft.safetyPolicyIds.filter(
        (id) => id !== SOLUTION_SAFETY
      ),
      safetyBindings: draft.safetyBindings.filter(
        ({ safetyPolicyId }) => safetyPolicyId !== SOLUTION_SAFETY
      )
    });
    const outcome = validateLabWorkflowSpecV2(unsafe, {
      checkedAt: CHECKED_AT
    });
    if (!outcome.schemaValid) throw new Error("Expected schema-valid draft");
    expect(outcome.issues).toContainEqual(
      expect.objectContaining({
        code: WORKFLOW_VALIDATION_ISSUE_CODES_V2.safetyBindingInvalid,
        safetyRelated: true
      })
    );
    expect(outcome.validation.runnable).toBe(false);
  });
});
