import { describe, expect, it } from "vitest";

import { applyLabDraftTransaction } from "../../../src/lab-workflows/authoring";
import { NATIVE_TITRATION_V2_DRAFT } from "../../../src/lab-workflows/definitions/titration/native-endpoint-control";
import { hashLabWorkflowSpec } from "../../../src/lab-workflows/hash";
import {
  migrateLabWorkflowV2_0ToV2_1,
  LAB_WORKFLOW_V2_0_TO_V2_1_MIGRATION_VERSION
} from "../../../src/lab-workflows/schema/migration";
import {
  labWorkflowDraftV2_0Schema,
  labWorkflowDraftV2_1Schema,
  labWorkflowSpecV2Schema
} from "../../../src/lab-workflows/schema/v2";
import { validateLabWorkflowSpecV2 } from "../../../src/lab-workflows/validation";

describe("LC2-501A LabWorkflowSpec 2.1", () => {
  it("keeps exact 2.0 drafts and their established hash domain unchanged", () => {
    const parsed = labWorkflowDraftV2_0Schema.parse(
      structuredClone(NATIVE_TITRATION_V2_DRAFT)
    );
    expect(parsed.schemaVersion).toBe("2.0.0");
    expect(hashLabWorkflowSpec(parsed)).toBe(
      hashLabWorkflowSpec(NATIVE_TITRATION_V2_DRAFT)
    );
    expect(labWorkflowSpecV2Schema.parse(parsed)).toEqual(parsed);
  });

  it("migrates deterministically without rewriting fixed concentration profiles", () => {
    const validation = validateLabWorkflowSpecV2(NATIVE_TITRATION_V2_DRAFT, {
      checkedAt: "2026-07-18T12:00:00.000Z"
    });
    if (!validation.schemaValid) throw new Error("Expected a valid fixture");

    const first = migrateLabWorkflowV2_0ToV2_1(validation.spec);
    const second = migrateLabWorkflowV2_0ToV2_1(validation.spec);
    expect(LAB_WORKFLOW_V2_0_TO_V2_1_MIGRATION_VERSION).toBe("1.0.0");
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      schemaVersion: "2.1.0",
      supportStatus: "draft_unvalidated",
      validation: null,
      judgeCritique: null
    });
    expect(first.materials).toEqual(NATIVE_TITRATION_V2_DRAFT.materials);
    expect(
      first.materials.every((material) => !("initialization" in material))
    ).toBe(true);
    expect(hashLabWorkflowSpec(first)).not.toBe(
      hashLabWorkflowSpec(NATIVE_TITRATION_V2_DRAFT)
    );
  });

  it("stores only canonical decimal strings in a 2.1 material initialization", () => {
    const migrated = migrateLabWorkflowV2_0ToV2_1(NATIVE_TITRATION_V2_DRAFT);
    const candidate = {
      ...migrated,
      materials: [
        {
          ...migrated.materials[0],
          initialization: {
            kind: "bounded_concentration",
            configurationSchemaId:
              "schema.material_initialization.bounded_concentration.v1",
            concentration: {
              decimalValue: "0.25",
              unitId: "unit.mol_per_l.v1"
            }
          }
        },
        ...migrated.materials.slice(1)
      ]
    };
    expect(labWorkflowDraftV2_1Schema.safeParse(candidate).success).toBe(true);
    expect(
      labWorkflowDraftV2_1Schema.safeParse({
        ...candidate,
        materials: [
          {
            ...candidate.materials[0],
            initialization: {
              ...candidate.materials[0]!.initialization,
              concentration: {
                decimalValue: "0.2500",
                unitId: "unit.mol_per_l.v1"
              }
            }
          },
          ...candidate.materials.slice(1)
        ]
      }).success
    ).toBe(false);
  });

  it("sets, changes, and clears concentration through shared atomic commands", () => {
    const initial = {
      ...structuredClone(NATIVE_TITRATION_V2_DRAFT),
      equipment: [
        ...structuredClone(NATIVE_TITRATION_V2_DRAFT.equipment),
        {
          instanceId: "stock_bottle",
          equipmentDefinitionId: "component.reagent_bottle.v1",
          configurationPresetId:
            "component_config.reagent_bottle.stock_solution.v1",
          label: "Stock solution",
          required: false
        }
      ],
      materials: [
        ...structuredClone(NATIVE_TITRATION_V2_DRAFT.materials),
        {
          instanceId: "teacher_stock",
          materialProfileId: "reagent.sodium_chloride_aqueous.v1",
          containerInstanceId: "stock_bottle",
          quantityPresetId: "quantity-preset.sodium_chloride_solution_50ml.v1"
        }
      ]
    };
    const parsed = labWorkflowDraftV2_0Schema.parse(initial);
    const beforeHash = hashLabWorkflowSpec(parsed);
    const set = applyLabDraftTransaction(
      parsed,
      [
        {
          type: "set_material_concentration",
          instanceId: "teacher_stock",
          initialization: {
            kind: "bounded_concentration",
            configurationSchemaId:
              "schema.material_initialization.bounded_concentration.v1",
            concentration: {
              decimalValue: "0.2500",
              unitId: "unit.mol_per_l.v1"
            }
          }
        }
      ],
      parsed.revision
    );
    expect(set.ok).toBe(true);
    if (!set.ok) throw new Error(set.error.message);
    expect(set.draft).toMatchObject({
      schemaVersion: "2.1.0",
      revision: parsed.revision + 1,
      supportStatus: "draft_unvalidated",
      validation: null,
      judgeCritique: null
    });
    expect(set.edit).toMatchObject({
      revisionAfter: parsed.revision + 1,
      validationInvalidated: true,
      judgeCritiqueInvalidated: true
    });
    expect(set.draft.materials.at(-1)).toMatchObject({
      initialization: {
        concentration: { decimalValue: "0.25", unitId: "unit.mol_per_l.v1" }
      }
    });
    expect(set.draft.requiredChemistryCapabilityIds).toContain(
      "chemistry.concentration_dilution.v1"
    );
    expect(hashLabWorkflowSpec(set.draft)).not.toBe(beforeHash);

    const clear = applyLabDraftTransaction(
      set.draft,
      [{ type: "clear_material_concentration", instanceId: "teacher_stock" }],
      set.draft.revision
    );
    expect(clear.ok).toBe(true);
    if (!clear.ok) throw new Error(clear.error.message);
    expect(clear.draft.revision).toBe(set.draft.revision + 1);
    expect(clear.draft.materials.at(-1)).not.toHaveProperty("initialization");
  });

  it.each(["0.0999", "1.0001", "0.12345", "1e-1", "0,5"])(
    "fails closed without changing the draft for %s",
    (decimalValue) => {
      const migrated = migrateLabWorkflowV2_0ToV2_1({
        ...structuredClone(NATIVE_TITRATION_V2_DRAFT),
        equipment: [
          ...structuredClone(NATIVE_TITRATION_V2_DRAFT.equipment),
          {
            instanceId: "stock_bottle",
            equipmentDefinitionId: "component.reagent_bottle.v1",
            configurationPresetId:
              "component_config.reagent_bottle.stock_solution.v1",
            label: "Stock solution",
            required: false
          }
        ],
        materials: [
          ...structuredClone(NATIVE_TITRATION_V2_DRAFT.materials),
          {
            instanceId: "teacher_stock",
            materialProfileId: "reagent.sodium_chloride_aqueous.v1",
            containerInstanceId: "stock_bottle",
            quantityPresetId: "quantity-preset.sodium_chloride_solution_50ml.v1"
          }
        ]
      });
      const before = structuredClone(migrated);
      const result = applyLabDraftTransaction(
        migrated,
        [
          {
            type: "set_material_concentration",
            instanceId: "teacher_stock",
            initialization: {
              kind: "bounded_concentration",
              configurationSchemaId:
                "schema.material_initialization.bounded_concentration.v1",
              concentration: { decimalValue, unitId: "unit.mol_per_l.v1" }
            }
          }
        ],
        migrated.revision
      );
      expect(result.ok).toBe(false);
      expect(migrated).toEqual(before);
    }
  );
});
