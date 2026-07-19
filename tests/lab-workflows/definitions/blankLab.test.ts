import { describe, expect, it } from "vitest";

import { applyLabDraftTransaction } from "../../../src/lab-workflows/authoring";
import {
  BLANK_LAB_V2_DRAFT,
  createBlankLabDraftV2
} from "../../../src/lab-workflows/definitions/blank-lab";
import { labWorkflowDraftV2Schema } from "../../../src/lab-workflows/schema/v2";
import { validateLabWorkflowSpecV2 } from "../../../src/lab-workflows/validation";

describe("blank lab starting draft (LC2-412)", () => {
  it("is schema-valid, empty, and unvalidated", () => {
    expect(() =>
      labWorkflowDraftV2Schema.parse(BLANK_LAB_V2_DRAFT)
    ).not.toThrow();
    expect(BLANK_LAB_V2_DRAFT.equipment).toEqual([]);
    expect(BLANK_LAB_V2_DRAFT.materials).toEqual([]);
    expect(BLANK_LAB_V2_DRAFT.objectiveIds).toEqual([]);
    expect(BLANK_LAB_V2_DRAFT.rules).toEqual([]);
    expect(BLANK_LAB_V2_DRAFT.rubric.criteria).toEqual([]);
    expect(BLANK_LAB_V2_DRAFT.layout.placements).toEqual([]);
    expect(BLANK_LAB_V2_DRAFT.supportStatus).toBe("draft_unvalidated");
  });

  it("carries no legacy titration compatibility or provenance", () => {
    expect(BLANK_LAB_V2_DRAFT.compatibility).toBeUndefined();
    expect(BLANK_LAB_V2_DRAFT.provenance).toBeUndefined();
  });

  it("is not runnable until the teacher builds and validates it", () => {
    const outcome = validateLabWorkflowSpecV2(BLANK_LAB_V2_DRAFT, {
      checkedAt: "2026-07-18T00:00:00.000Z"
    });
    expect(outcome.schemaValid && outcome.validation.runnable).toBe(false);
  });

  it("accepts authoring commands (a teacher can start building)", () => {
    const result = applyLabDraftTransaction(
      BLANK_LAB_V2_DRAFT,
      [{ type: "add_objective", objectiveId: "endpoint_control" }],
      BLANK_LAB_V2_DRAFT.revision
    );
    expect(result.ok).toBe(true);
  });

  it("produces a fresh draft each call without shared references", () => {
    const a = createBlankLabDraftV2();
    const b = createBlankLabDraftV2();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
