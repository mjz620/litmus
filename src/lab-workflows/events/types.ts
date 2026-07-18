import type { SemanticEvent } from "../../experiments/shared";
import type { NormalizedLabAction } from "../runtime/generic/types";

export const SEMANTIC_EVENT_ENVELOPE_SCHEMA_VERSION = "2.0.0" as const;

/** Compact deterministic context around the unchanged legacy event payload. */
export interface SemanticEventEnvelopeV2 {
  readonly schemaVersion: typeof SEMANTIC_EVENT_ENVELOPE_SCHEMA_VERSION;
  readonly eventId: string;
  readonly sequence: number;
  readonly actionSequence: number;
  readonly normalizedAction: Readonly<NormalizedLabAction>;
  readonly sourceEquipmentInstanceId?: string;
  readonly targetEquipmentInstanceIds: readonly string[];
  readonly materialInstanceIds: readonly string[];
  readonly ruleEvidenceIds: readonly string[];
  readonly payload: Readonly<SemanticEvent>;
}

export interface CheckpointCompatibleEvent {
  readonly clientEventId: string;
  readonly seq: number;
  readonly payload: SemanticEvent;
}
