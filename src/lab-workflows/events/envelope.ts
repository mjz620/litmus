import type { SemanticEvent } from "../../experiments/shared";
import type { ExecutedMaterialAction } from "../chemistry-models/material-ledger";
import type { WorkflowDiagnosis } from "../schema/conditions";
import type { NormalizedLabAction } from "../runtime/generic/types";
import { deepFreeze } from "../runtime/generic/utils";
import { semanticEventEnvelopeV2Schema } from "./schemas";
import {
  SEMANTIC_EVENT_ENVELOPE_SCHEMA_VERSION,
  type SemanticEventEnvelopeV2
} from "./types";

export interface EnvelopeSemanticEventsInput {
  readonly sessionId: string;
  readonly nextEventSequence: number;
  readonly actionSequence: number;
  readonly action: Readonly<NormalizedLabAction>;
  readonly materialAction: Readonly<ExecutedMaterialAction> | null;
  readonly materialInstanceIds?: readonly string[];
  readonly events: readonly Readonly<SemanticEvent>[];
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

export function semanticEventId(sessionId: string, sequence: number): string {
  return `${sessionId}:event:${sequence}`;
}

export function envelopeSemanticEvents(
  input: EnvelopeSemanticEventsInput
): readonly SemanticEventEnvelopeV2[] {
  return deepFreeze(
    input.events.map((payload, index) => {
      const sequence = input.nextEventSequence + index;
      return semanticEventEnvelopeV2Schema.parse({
        schemaVersion: SEMANTIC_EVENT_ENVELOPE_SCHEMA_VERSION,
        eventId: semanticEventId(input.sessionId, sequence),
        sequence,
        actionSequence: input.actionSequence,
        normalizedAction: input.action,
        ...(input.action.sourceEquipmentInstanceId
          ? {
              sourceEquipmentInstanceId: input.action.sourceEquipmentInstanceId
            }
          : {}),
        targetEquipmentInstanceIds: input.action.targetEquipmentInstanceIds,
        materialInstanceIds: unique(
          [
            ...(input.materialAction?.materialInstanceIds ?? []),
            ...(input.materialInstanceIds ?? [])
          ].sort()
        ),
        ruleEvidenceIds: [],
        payload
      });
    })
  );
}

export function linkEnvelopeDiagnoses(
  envelopes: readonly SemanticEventEnvelopeV2[],
  diagnoses: readonly WorkflowDiagnosis[]
): readonly SemanticEventEnvelopeV2[] {
  return deepFreeze(
    envelopes.map((envelope) => ({
      ...envelope,
      ruleEvidenceIds: diagnoses
        .filter(({ evidenceEventIds }) =>
          evidenceEventIds.includes(envelope.eventId)
        )
        .map(({ ruleId }) => ruleId)
    }))
  );
}
