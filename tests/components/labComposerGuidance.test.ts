import { describe, expect, it } from "vitest";

import { applyLabDraftCommand } from "../../src/lab-workflows/authoring";
import { NATIVE_TITRATION_V2_DRAFT } from "../../src/lab-workflows/definitions/titration/native-endpoint-control";
import { labWorkflowDraftV2Schema } from "../../src/lab-workflows/schema/v2";
import {
  stageForIssuePath,
  summarizeStageReadiness
} from "../../src/components/teacher/lab-composer/composerStages";
import { restoreDraftSnapshot } from "../../src/components/teacher/lab-composer/draftHistory";

describe("guided Lab Composer presentation adapters", () => {
  it("routes validator paths to the task that owns the authored content", () => {
    expect(stageForIssuePath("metadata.title")).toBe("define");
    expect(stageForIssuePath("equipment[2].configurationPresetId")).toBe(
      "setup"
    );
    expect(stageForIssuePath("rules[3].condition")).toBe("workflow");
    expect(stageForIssuePath("rubric.criteria[0].ruleIds")).toBe("assess");
    expect(stageForIssuePath("validation.canonicalSpecHash")).toBe("validate");
  });

  it("summarizes structural content without claiming deterministic eligibility", () => {
    const setup = summarizeStageReadiness(NATIVE_TITRATION_V2_DRAFT, "setup");
    const validation = summarizeStageReadiness(
      NATIVE_TITRATION_V2_DRAFT,
      "validate"
    );

    expect(setup.summary).toContain("equipment");
    expect(setup.summary).not.toMatch(/runnable|eligible|valid/i);
    expect(validation.summary).toBe("Run the checker after every edit");
  });

  it("restores strict history snapshots as new unvalidated revisions", () => {
    const edited = applyLabDraftCommand(NATIVE_TITRATION_V2_DRAFT, {
      type: "add_objective",
      objectiveId: "significant_figures"
    });
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;

    const restored = restoreDraftSnapshot(
      edited.draft,
      NATIVE_TITRATION_V2_DRAFT
    );

    expect(restored.revision).toBe(edited.draft.revision + 1);
    expect(restored.objectiveIds).toEqual(
      NATIVE_TITRATION_V2_DRAFT.objectiveIds
    );
    expect(restored.supportStatus).toBe("draft_unvalidated");
    expect(restored.validation).toBeNull();
    expect(restored.judgeCritique).toBeNull();
    expect(labWorkflowDraftV2Schema.safeParse(restored).success).toBe(true);
    expect(Object.isFrozen(restored)).toBe(true);
  });
});
