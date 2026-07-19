import serializedSolutionPreparation from "./solution-preparation.v2.json";
import serializedStock1mDilution from "./stock-1m-dilution.v2.json";
import serializedQuarterDilution from "./quarter-dilution.v2.json";

import { hashLabWorkflowSpec } from "../../hash";
import {
  labWorkflowDraftV2Schema,
  type ValidatedLabWorkflowSpecV2
} from "../../schema/v2";
import { validateLabWorkflowSpecV2 } from "../../validation";
import {
  createAuthoredSolutionPreparationDraft,
  createAuthoredSolutionPreparationQuarterDraft,
  createAuthoredSolutionPreparationStock1mDraft,
  SOLUTION_PREPARATION_AUTHORING_COMMANDS,
  SOLUTION_PREPARATION_QUARTER_AUTHORING_COMMANDS,
  SOLUTION_PREPARATION_QUARTER_WORKFLOW_ID,
  SOLUTION_PREPARATION_STOCK_1M_AUTHORING_COMMANDS,
  SOLUTION_PREPARATION_STOCK_1M_WORKFLOW_ID,
  SOLUTION_PREPARATION_WORKFLOW_ID
} from "./authoring";

export {
  createAuthoredSolutionPreparationDraft,
  createAuthoredSolutionPreparationQuarterDraft,
  createAuthoredSolutionPreparationStock1mDraft,
  SOLUTION_PREPARATION_AUTHORING_COMMANDS,
  SOLUTION_PREPARATION_QUARTER_AUTHORING_COMMANDS,
  SOLUTION_PREPARATION_QUARTER_WORKFLOW_ID,
  SOLUTION_PREPARATION_STOCK_1M_AUTHORING_COMMANDS,
  SOLUTION_PREPARATION_STOCK_1M_WORKFLOW_ID,
  SOLUTION_PREPARATION_WORKFLOW_ID
};
export {
  createSolutionPreparationTracePlan,
  type SolutionPreparationTracePlanCase
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
  label: string,
  checkedAt: string
): Readonly<ValidatedLabWorkflowSpecV2> {
  const outcome = validateLabWorkflowSpecV2(draft, { checkedAt });
  if (
    !outcome.schemaValid ||
    !outcome.validation.runnable ||
    outcome.validation.canonicalSpecHash !== expectedHash
  ) {
    throw new Error(
      `The ${label} definition is not runnable: ${outcome.issues
        .map(({ code, path }) => `${code}@${path}`)
        .join(", ")}`
    );
  }
  return outcome.spec;
}

export const SOLUTION_PREPARATION_V2_DRAFT = deepFreeze(
  labWorkflowDraftV2Schema.parse(serializedSolutionPreparation)
);
export const SOLUTION_PREPARATION_V2_EXPECTED_HASH =
  "sha256:5c6e6ad964e7738fc11b4184bb98eb9159f4c32601d9376fe0a98e4f2fc4dd1c" as const;
export const SOLUTION_PREPARATION_V2_SOURCE_HASH = hashLabWorkflowSpec(
  SOLUTION_PREPARATION_V2_DRAFT
);

export const SOLUTION_PREPARATION_STOCK_1M_V2_DRAFT = deepFreeze(
  labWorkflowDraftV2Schema.parse(serializedStock1mDilution)
);
export const SOLUTION_PREPARATION_STOCK_1M_V2_EXPECTED_HASH =
  "sha256:14c3d4074f5b7a2e11ad79900c2d4ca80b17f18f75d818cc702596cbb29d063d" as const;
export const SOLUTION_PREPARATION_STOCK_1M_V2_SOURCE_HASH = hashLabWorkflowSpec(
  SOLUTION_PREPARATION_STOCK_1M_V2_DRAFT
);

export const SOLUTION_PREPARATION_QUARTER_V2_DRAFT = deepFreeze(
  labWorkflowDraftV2Schema.parse(serializedQuarterDilution)
);
export const SOLUTION_PREPARATION_QUARTER_V2_EXPECTED_HASH =
  "sha256:f0ec3c1976165551ed88217980e8b546071e2f0b13e6ef479982ff3e87e8c8b0" as const;
export const SOLUTION_PREPARATION_QUARTER_V2_SOURCE_HASH = hashLabWorkflowSpec(
  SOLUTION_PREPARATION_QUARTER_V2_DRAFT
);

export function validateSolutionPreparationV2(
  checkedAt: string
): Readonly<ValidatedLabWorkflowSpecV2> {
  return validatePinnedDraft(
    SOLUTION_PREPARATION_V2_DRAFT,
    SOLUTION_PREPARATION_V2_EXPECTED_HASH,
    "solution-preparation",
    checkedAt
  );
}

export function validateSolutionPreparationStock1mV2(
  checkedAt: string
): Readonly<ValidatedLabWorkflowSpecV2> {
  return validatePinnedDraft(
    SOLUTION_PREPARATION_STOCK_1M_V2_DRAFT,
    SOLUTION_PREPARATION_STOCK_1M_V2_EXPECTED_HASH,
    "solution-preparation stock 1 M",
    checkedAt
  );
}

export function validateSolutionPreparationQuarterV2(
  checkedAt: string
): Readonly<ValidatedLabWorkflowSpecV2> {
  return validatePinnedDraft(
    SOLUTION_PREPARATION_QUARTER_V2_DRAFT,
    SOLUTION_PREPARATION_QUARTER_V2_EXPECTED_HASH,
    "solution-preparation quarter dilution",
    checkedAt
  );
}
