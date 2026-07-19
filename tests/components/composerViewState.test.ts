import { describe, expect, it } from "vitest";

import {
  COMPOSER_VIEW_STATE_KEY_PREFIX,
  LocalComposerViewStateRepository,
  pruneComposerNodePositions
} from "../../src/components/teacher/lab-composer/composerViewState";
import { NATIVE_TITRATION_V2_DRAFT } from "../../src/lab-workflows/definitions/titration/native-endpoint-control";
import { hashLabWorkflowSpec } from "../../src/lab-workflows/hash";

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("Composer non-authoritative view state", () => {
  it("saves separately and never changes the workflow hash", () => {
    const storage = new MemoryStorage();
    const repository = new LocalComposerViewStateRepository(storage);
    const ruleIds = NATIVE_TITRATION_V2_DRAFT.rules
      .filter(({ kind }) => kind !== "ordering")
      .map(({ id }) => id);
    const hashBefore = hashLabWorkflowSpec(NATIVE_TITRATION_V2_DRAFT);

    repository.save(
      NATIVE_TITRATION_V2_DRAFT.id,
      {
        workflowView: "outline",
        nodePositions: { [ruleIds[0]!]: { x: 120, y: 240 } },
        selectedRuleId: ruleIds[0]
      },
      ruleIds
    );

    expect(repository.load(NATIVE_TITRATION_V2_DRAFT.id, ruleIds)).toEqual({
      schemaVersion: "1.0.0",
      workflowId: NATIVE_TITRATION_V2_DRAFT.id,
      workflowView: "outline",
      nodePositions: { [ruleIds[0]!]: { x: 120, y: 240 } },
      selectedRuleId: ruleIds[0]
    });
    expect(hashLabWorkflowSpec(NATIVE_TITRATION_V2_DRAFT)).toBe(hashBefore);
    expect(
      [...storage.values.keys()].every((key) =>
        key.startsWith(COMPOSER_VIEW_STATE_KEY_PREFIX)
      )
    ).toBe(true);
  });

  it("prunes removed nodes and fails corrupt or stale positions closed", () => {
    expect(
      pruneComposerNodePositions(
        {
          keep: { x: 1, y: 2 },
          removed: { x: 3, y: 4 }
        },
        ["keep"]
      )
    ).toEqual({ keep: { x: 1, y: 2 } });

    const storage = new MemoryStorage();
    storage.setItem(
      `${COMPOSER_VIEW_STATE_KEY_PREFIX}${encodeURIComponent("workflow")}`,
      JSON.stringify({
        schemaVersion: "1.0.0",
        workflowId: "workflow",
        workflowView: "graph",
        nodePositions: { rule: { x: Number.MAX_VALUE, y: 0 } }
      })
    );
    const loaded = new LocalComposerViewStateRepository(storage).load(
      "workflow",
      ["rule"]
    );
    expect(loaded).toEqual({
      schemaVersion: "1.0.0",
      workflowId: "workflow",
      workflowView: "graph",
      nodePositions: {}
    });
  });
});
