import { describe, expect, it } from "vitest";

import {
  applyLabDraftTransaction,
  type LabDraftCommand
} from "../../../src/lab-workflows/authoring";
import { NATIVE_TITRATION_V2_DRAFT } from "../../../src/lab-workflows/definitions/titration/native-endpoint-control";
import { validateLabWorkflowSpecV2 } from "../../../src/lab-workflows/validation";

/**
 * Reproductions for the Strict Product Judge report
 * (docs/qa/strict-product-judge-report.md).
 *
 * These tests document confirmed defects observed while driving the Lab
 * Composer. They assert the CURRENT (buggy) behavior so the suite stays green,
 * with the desired behavior encoded in `it.fails(...)` where the product does
 * not yet do the right thing. When a defect is fixed, the matching `it.fails`
 * test will start failing and must be converted to a normal `it(...)` — that is
 * the intended signal, not a regression.
 *
 * No application code is modified by this file.
 */

const CHECKED_AT = "2026-07-18T00:00:00.000Z";

function apply(commands: readonly LabDraftCommand[]) {
  return applyLabDraftTransaction(
    NATIVE_TITRATION_V2_DRAFT,
    commands,
    NATIVE_TITRATION_V2_DRAFT.revision
  );
}

describe("QA reproduction · SYSTEM-002 chemically implausible measurement range", () => {
  const objectiveId = NATIVE_TITRATION_V2_DRAFT.objectiveIds[0];

  const negativeRangeRule: LabDraftCommand = {
    type: "add_rule",
    rule: {
      id: "teacher.tolerance.repro",
      kind: "required",
      condition: {
        kind: "observable_within_tolerance",
        observableId: "observable.burette_reading_ml.v1",
        // A burette can never read a negative delivered volume.
        minimum: -5,
        maximum: -1,
        minimumInclusive: true,
        maximumInclusive: true,
        unitId: "unit.ml.v1"
      },
      severity: "procedural",
      recoverable: true,
      terminal: false,
      objectiveIds: [objectiveId]
    }
  };

  const reversedRangeRule: LabDraftCommand = {
    type: "add_rule",
    rule: {
      id: "teacher.tolerance.reversed",
      kind: "required",
      condition: {
        kind: "observable_within_tolerance",
        observableId: "observable.burette_reading_ml.v1",
        minimum: 25.05,
        maximum: 24.95,
        minimumInclusive: true,
        maximumInclusive: true,
        unitId: "unit.ml.v1"
      },
      severity: "procedural",
      recoverable: true,
      terminal: false,
      objectiveIds: [objectiveId]
    }
  };

  it("validation refuses to mark a negative measurement range runnable (LC2-414)", () => {
    const result = apply([negativeRangeRule]);
    if (!result.ok) return; // command rejection is also acceptable
    const outcome = validateLabWorkflowSpecV2(result.draft, {
      checkedAt: CHECKED_AT
    });
    expect(outcome.schemaValid && outcome.validation.runnable).toBe(false);
  });

  it("a reversed range (min > max) never reaches a runnable state (LC2-414)", () => {
    const result = apply([reversedRangeRule]);
    if (!result.ok) {
      expect(result.ok).toBe(false);
      return;
    }
    const outcome = validateLabWorkflowSpecV2(result.draft, {
      checkedAt: CHECKED_AT
    });
    expect(outcome.schemaValid && outcome.validation.runnable).toBe(false);
  });
});

describe("TEACHER-007 zero-point grading is rejected (LC2-414)", () => {
  it("validation refuses to mark a draft with a 0-point grading item runnable", () => {
    const base = NATIVE_TITRATION_V2_DRAFT;
    const zeroPointDraft = {
      ...base,
      rubric: {
        ...base.rubric,
        criteria: base.rubric.criteria.map((criterion, index) =>
          index === 0 ? { ...criterion, maxPoints: 0 } : criterion
        ),
        totalPoints: base.rubric.criteria.reduce(
          (sum, criterion, index) =>
            sum + (index === 0 ? 0 : criterion.maxPoints),
          0
        )
      }
    };
    const outcome = validateLabWorkflowSpecV2(zeroPointDraft, {
      checkedAt: CHECKED_AT
    });
    expect(outcome.schemaValid && outcome.validation.runnable).toBe(false);
  });
});

describe("TEACHER-005 reagent/container pairing is enforced (LC2-411)", () => {
  // The default titration draft binds:
  //   sodium hydroxide (titrant) -> titrant_burette
  //   hydrochloric acid (analyte) -> analyte_flask
  //   phenolphthalein -> indicator_source
  // A container holds at most one reagent and a reagent lives in at most one
  // container, so the acid can no longer be bound into the burette that already
  // holds the base (the previously observed silent auto-pick behavior).
  const acid = NATIVE_TITRATION_V2_DRAFT.materials.find((binding) =>
    binding.materialProfileId.includes("hydrochloric")
  )!;
  const burette = NATIVE_TITRATION_V2_DRAFT.equipment.find((equipment) =>
    /burette/i.test(equipment.label)
  )!;

  it("rejects binding a second reagent into a container that already holds one", () => {
    const result = apply([
      {
        type: "bind_material",
        binding: {
          instanceId: "teacher.material.repro",
          materialProfileId: acid.materialProfileId,
          containerInstanceId: burette.instanceId,
          quantityPresetId: acid.quantityPresetId
        }
      }
    ]);
    expect(result.ok).toBe(false);
  });

  it("validation refuses to mark a two-reagents-in-one-container draft runnable", () => {
    // Simulate an imported/edited draft that bypassed the command guard.
    const contradictory = {
      ...NATIVE_TITRATION_V2_DRAFT,
      materials: [
        ...NATIVE_TITRATION_V2_DRAFT.materials,
        {
          instanceId: "imported.contradictory.binding",
          materialProfileId: acid.materialProfileId,
          containerInstanceId: burette.instanceId,
          quantityPresetId: acid.quantityPresetId
        }
      ]
    };
    const outcome = validateLabWorkflowSpecV2(contradictory, {
      checkedAt: CHECKED_AT
    });
    expect(outcome.schemaValid && outcome.validation.runnable).toBe(false);
  });
});
