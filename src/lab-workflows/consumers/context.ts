import { z } from "zod";

import { semanticEventEnvelopeV2Schema } from "../events";
import type { GenericLabState } from "../runtime";
import { deepFreeze } from "../runtime/generic/utils";
import {
  rubricSpecV2Schema,
  workflowDiagnosesSchema
} from "../schema/conditions";
import type { ValidatedLabWorkflowSpecV2 } from "../schema/v2";

export const LAB_WORKFLOW_CONSUMER_CONTEXT_SCHEMA_VERSION = "1.0.0" as const;

const identifierSchema = z.string().min(1).max(256);

export const labWorkflowConsumerContextSchema = z.strictObject({
  schemaVersion: z.literal(LAB_WORKFLOW_CONSUMER_CONTEXT_SCHEMA_VERSION),
  workflow: z.strictObject({
    id: identifierSchema,
    revision: z.number().int().positive(),
    canonicalSpecHash: identifierSchema,
    validatorVersion: identifierSchema
  }),
  objectiveIds: z.array(identifierSchema).max(64),
  rubric: rubricSpecV2Schema,
  diagnoses: workflowDiagnosesSchema,
  eventEnvelopes: z.array(semanticEventEnvelopeV2Schema).max(1_000),
  finalObservables: z
    .array(
      z.strictObject({
        observableId: identifierSchema,
        value: z.union([z.boolean(), z.number().finite(), z.string()]),
        unitId: identifierSchema.optional()
      })
    )
    .max(128)
});

export type LabWorkflowConsumerContext = z.infer<
  typeof labWorkflowConsumerContextSchema
>;

/**
 * Builds the one deterministic workflow context shared by coach, evaluation,
 * local checkpoint/replay, demo, and technical-inspection consumers.
 */
export function createLabWorkflowConsumerContext(
  workflow: Readonly<ValidatedLabWorkflowSpecV2>,
  state: Readonly<GenericLabState>
): Readonly<LabWorkflowConsumerContext> {
  if (
    state.provenance.workflowId !== workflow.id ||
    state.provenance.workflowRevision !== workflow.revision ||
    state.provenance.workflowHash !== workflow.validation.canonicalSpecHash ||
    state.provenance.validatorVersion !== workflow.validation.validatorVersion
  ) {
    throw new TypeError(
      "Runtime provenance does not match the validated workflow consumer context."
    );
  }

  return deepFreeze(
    labWorkflowConsumerContextSchema.parse({
      schemaVersion: LAB_WORKFLOW_CONSUMER_CONTEXT_SCHEMA_VERSION,
      workflow: {
        id: workflow.id,
        revision: workflow.revision,
        canonicalSpecHash: workflow.validation.canonicalSpecHash,
        validatorVersion: workflow.validation.validatorVersion
      },
      objectiveIds: workflow.objectiveIds,
      rubric: workflow.rubric,
      diagnoses: state.diagnoses,
      eventEnvelopes: state.eventEnvelopes,
      finalObservables: state.chemistry.observables
    })
  );
}
