import {
  labWorkflowDraftV2Schema,
  type LabWorkflowDraftV2
} from "../schema/v2";
import { deepFreeze } from "../runtime/generic/utils";

export const LAB_DRAFT_SERIALIZATION_SCHEMA_VERSION = "1.0.0" as const;

export interface SerializedLabDraftEnvelope {
  readonly schemaVersion: typeof LAB_DRAFT_SERIALIZATION_SCHEMA_VERSION;
  readonly draft: Readonly<LabWorkflowDraftV2>;
}

/** Local/fixture serialization only. Permanent version storage is Phase 8. */
export function serializeLabDraft(input: unknown): string {
  const draft = labWorkflowDraftV2Schema.parse(input);
  return JSON.stringify({
    schemaVersion: LAB_DRAFT_SERIALIZATION_SCHEMA_VERSION,
    draft
  } satisfies SerializedLabDraftEnvelope);
}

export function deserializeLabDraft(
  serialized: string
): Readonly<LabWorkflowDraftV2> {
  const parsed = JSON.parse(serialized) as unknown;
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Object.keys(parsed).length !== 2 ||
    !("schemaVersion" in parsed) ||
    parsed.schemaVersion !== LAB_DRAFT_SERIALIZATION_SCHEMA_VERSION ||
    !("draft" in parsed)
  ) {
    throw new TypeError("Serialized lab draft envelope is invalid.");
  }
  return deepFreeze(labWorkflowDraftV2Schema.parse(parsed.draft));
}
