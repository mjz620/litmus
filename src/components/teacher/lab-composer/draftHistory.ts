import {
  deserializeLabDraft,
  serializeLabDraft
} from "../../../lab-workflows/authoring";
import type { LabWorkflowDraftV2 } from "../../../lab-workflows/schema/v2";

/**
 * Restores authored content without restoring stale authority artifacts.
 *
 * History snapshots are strict serialized drafts, not a second mutable model.
 * A restore is itself a new local revision so revision numbers remain monotonic;
 * validation and Judge artifacts are explicitly reset and must be regenerated.
 */
export function restoreDraftSnapshot(
  current: Readonly<LabWorkflowDraftV2>,
  snapshot: Readonly<LabWorkflowDraftV2>
): Readonly<LabWorkflowDraftV2> {
  if (current.revision >= 1_000_000) {
    throw new RangeError(
      "Draft revision cannot be incremented beyond 1000000."
    );
  }
  const strictSnapshot = deserializeLabDraft(serializeLabDraft(snapshot));
  return deserializeLabDraft(
    serializeLabDraft({
      ...strictSnapshot,
      revision: current.revision + 1,
      supportStatus: "draft_unvalidated",
      validation: null,
      judgeCritique: null
    })
  );
}
