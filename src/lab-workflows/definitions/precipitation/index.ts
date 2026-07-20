import serializedSilverChloride from "./silver-chloride.v2.json";

import { hashLabWorkflowSpec } from "../../hash";
import {
  labWorkflowDraftV2Schema,
  type ValidatedLabWorkflowSpecV2
} from "../../schema/v2";
import { validateLabWorkflowSpecV2 } from "../../validation";

export {
  PRECIPITATION_AUTHORING_COMMANDS,
  PRECIPITATION_WORKFLOW_ID,
  createAuthoredPrecipitationDraft
} from "./authoring";
export {
  createIncompletePrecipitationTrace,
  createPrecipitationTracePlan,
  type PrecipitationTracePlanCase
} from "./tracePlan";

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export const PRECIPITATION_V2_DRAFT = deepFreeze(
  labWorkflowDraftV2Schema.parse(serializedSilverChloride)
);
export const PRECIPITATION_V2_SOURCE_HASH = hashLabWorkflowSpec(
  PRECIPITATION_V2_DRAFT
);

/**
 * Validate the pinned precipitation draft against current registries.
 *
 * `checkedAt` is supplied by the caller as a fixed constant, never a clock
 * read, so the validation artifact stays deterministic across runs.
 */
export function validatePrecipitationV2(
  checkedAt: string
): Readonly<ValidatedLabWorkflowSpecV2> {
  const outcome = validateLabWorkflowSpecV2(PRECIPITATION_V2_DRAFT, {
    checkedAt
  });
  if (!outcome.schemaValid || !outcome.validation.runnable) {
    throw new Error(
      `The precipitation definition is not runnable: ${outcome.issues
        .map(({ code, path }) => `${code}@${path}`)
        .join(", ")}`
    );
  }
  return outcome.spec;
}
