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
  "sha256:cf5af9bb59126f440ea71db27a72d17c35cee6afe0d6882d0d6d1c00b2bebe3b" as const;
export const SOLUTION_PREPARATION_V2_SOURCE_HASH = hashLabWorkflowSpec(
  SOLUTION_PREPARATION_V2_DRAFT
);

export const SOLUTION_PREPARATION_STOCK_1M_V2_DRAFT = deepFreeze(
  labWorkflowDraftV2Schema.parse(serializedStock1mDilution)
);
export const SOLUTION_PREPARATION_STOCK_1M_V2_EXPECTED_HASH =
  "sha256:2f474b9d266c7c1188b5ec113cf9b6ec8341268124e25c0045a58c45ff312309" as const;
export const SOLUTION_PREPARATION_STOCK_1M_V2_SOURCE_HASH = hashLabWorkflowSpec(
  SOLUTION_PREPARATION_STOCK_1M_V2_DRAFT
);

export const SOLUTION_PREPARATION_QUARTER_V2_DRAFT = deepFreeze(
  labWorkflowDraftV2Schema.parse(serializedQuarterDilution)
);
export const SOLUTION_PREPARATION_QUARTER_V2_EXPECTED_HASH =
  "sha256:e3cf8ddc5eea659d881be4237e0ecef747c8791f37e98272884c23b575bbe7f4" as const;
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
