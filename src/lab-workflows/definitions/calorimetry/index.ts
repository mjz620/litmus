import serializedHotColdWater from "./hot-cold-water.v2.json";
import serializedAmmoniumNitrateDissolution from "./ammonium-nitrate-dissolution.v2.json";

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
  "sha256:23aa604d9e6205f75cbc75f130d8ff8a033eb8ec9e33015f00d6d8bc12ce8daa" as const;
export const CALORIMETRY_V2_SOURCE_HASH =
  hashLabWorkflowSpec(CALORIMETRY_V2_DRAFT);
export const DISSOLUTION_CALORIMETRY_V2_DRAFT = deepFreeze(
  labWorkflowDraftV2Schema.parse(serializedAmmoniumNitrateDissolution)
);
export const DISSOLUTION_CALORIMETRY_V2_SOURCE_HASH = hashLabWorkflowSpec(
  DISSOLUTION_CALORIMETRY_V2_DRAFT
);

export function validateDissolutionCalorimetryV2(
  checkedAt: string
): Readonly<ValidatedLabWorkflowSpecV2> {
  const outcome = validateLabWorkflowSpecV2(DISSOLUTION_CALORIMETRY_V2_DRAFT, {
    checkedAt
  });
  if (!outcome.schemaValid || !outcome.validation.runnable) {
    throw new Error(
      `The dissolution calorimetry definition is not runnable: ${outcome.issues
        .map(({ code, path }) => `${code}@${path}`)
        .join(", ")}`
    );
  }
  return outcome.spec;
}

export function validateCalorimetryV2(
  checkedAt: string
): Readonly<ValidatedLabWorkflowSpecV2> {
  return validatePinnedDraft(
    CALORIMETRY_V2_DRAFT,
    CALORIMETRY_V2_EXPECTED_HASH,
    checkedAt
  );
}
