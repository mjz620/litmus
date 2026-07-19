import serializedHotColdWater from "./hot-cold-water.v2.json";

import { hashLabWorkflowSpec } from "../../hash";
import {
  labWorkflowDraftV2Schema,
  type ValidatedLabWorkflowSpecV2
} from "../../schema/v2";
import { validateLabWorkflowSpecV2 } from "../../validation";
import {
  CALORIMETRY_AUTHORING_COMMANDS,
  CALORIMETRY_WORKFLOW_ID,
  createAuthoredCalorimetryDraft
} from "./authoring";

export {
  CALORIMETRY_AUTHORING_COMMANDS,
  CALORIMETRY_WORKFLOW_ID,
  createAuthoredCalorimetryDraft
};
export {
  createCalorimetryTracePlan,
  type CalorimetryTracePlanCase
} from "./tracePlan";

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function validatePinnedDraft(
  draft: ReturnType<typeof labWorkflowDraftV2Schema.parse>,
  expectedHash: string,
  checkedAt: string
): Readonly<ValidatedLabWorkflowSpecV2> {
  const outcome = validateLabWorkflowSpecV2(draft, { checkedAt });
  if (
    !outcome.schemaValid ||
    !outcome.validation.runnable ||
    outcome.validation.canonicalSpecHash !== expectedHash
  ) {
    throw new Error(
      `The calorimetry definition is not runnable: ${outcome.issues
        .map(({ code, path }) => `${code}@${path}`)
        .join(", ")}`
    );
  }
  return outcome.spec;
}

export const CALORIMETRY_V2_DRAFT = deepFreeze(
  labWorkflowDraftV2Schema.parse(serializedHotColdWater)
);
export const CALORIMETRY_V2_EXPECTED_HASH =
  "sha256:09e15c68249e1c2bd4bba0bbc97dc16965850dafb5a45735f2eac3161881592d" as const;
export const CALORIMETRY_V2_SOURCE_HASH = hashLabWorkflowSpec(CALORIMETRY_V2_DRAFT);

export function validateCalorimetryV2(
  checkedAt: string
): Readonly<ValidatedLabWorkflowSpecV2> {
  return validatePinnedDraft(
    CALORIMETRY_V2_DRAFT,
    CALORIMETRY_V2_EXPECTED_HASH,
    checkedAt
  );
}
