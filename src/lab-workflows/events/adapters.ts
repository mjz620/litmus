import {
  applyEvidence,
  type SemanticEvent,
  type StudentModel
} from "../../experiments/shared";
import type {
  CheckpointCompatibleEvent,
  SemanticEventEnvelopeV2
} from "./types";

export function toLegacySemanticEvent(
  envelope: Readonly<SemanticEventEnvelopeV2>
): SemanticEvent {
  return structuredClone(envelope.payload);
}

export function toLegacySemanticEvents(
  envelopes: readonly Readonly<SemanticEventEnvelopeV2>[]
): readonly SemanticEvent[] {
  return envelopes.map(toLegacySemanticEvent);
}

export function applyEnvelopeEvidence(
  model: StudentModel,
  envelope: Readonly<SemanticEventEnvelopeV2>
): StudentModel {
  return applyEvidence(model, toLegacySemanticEvent(envelope));
}

export function toCheckpointCompatibleEvent(
  envelope: Readonly<SemanticEventEnvelopeV2>
): CheckpointCompatibleEvent {
  return {
    clientEventId: envelope.eventId,
    seq: envelope.sequence,
    payload: toLegacySemanticEvent(envelope)
  };
}

export function toCheckpointCompatibleEvents(
  envelopes: readonly Readonly<SemanticEventEnvelopeV2>[]
): readonly CheckpointCompatibleEvent[] {
  return envelopes.map(toCheckpointCompatibleEvent);
}

export const toLegacyCoachEvents = toLegacySemanticEvents;
