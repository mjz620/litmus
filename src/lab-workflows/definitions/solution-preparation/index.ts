import serializedSolutionPreparation from "./solution-preparation.v2.json";

import { hashLabWorkflowSpec } from "../../hash";
import {
  labWorkflowDraftV2Schema,
  type ValidatedLabWorkflowSpecV2
} from "../../schema/v2";
import { validateLabWorkflowSpecV2 } from "../../validation";
import {
  createAuthoredSolutionPreparationDraft,
  SOLUTION_PREPARATION_AUTHORING_COMMANDS,
  SOLUTION_PREPARATION_WORKFLOW_ID
} from "./authoring";

export {
  createAuthoredSolutionPreparationDraft,
  SOLUTION_PREPARATION_AUTHORING_COMMANDS,
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

export const SOLUTION_PREPARATION_V2_DRAFT = deepFreeze(
  labWorkflowDraftV2Schema.parse(serializedSolutionPreparation)
);
export const SOLUTION_PREPARATION_V2_EXPECTED_HASH =
  "sha256:5c6e6ad964e7738fc11b4184bb98eb9159f4c32601d9376fe0a98e4f2fc4dd1c" as const;
export const SOLUTION_PREPARATION_V2_SOURCE_HASH = hashLabWorkflowSpec(
  SOLUTION_PREPARATION_V2_DRAFT
);

export function validateSolutionPreparationV2(
  checkedAt: string
): Readonly<ValidatedLabWorkflowSpecV2> {
  const outcome = validateLabWorkflowSpecV2(SOLUTION_PREPARATION_V2_DRAFT, {
    checkedAt
  });
  if (
    !outcome.schemaValid ||
    !outcome.validation.runnable ||
    outcome.validation.canonicalSpecHash !==
      SOLUTION_PREPARATION_V2_EXPECTED_HASH
  ) {
    throw new Error(
      `The solution-preparation definition is not runnable: ${outcome.issues
        .map(({ code, path }) => `${code}@${path}`)
        .join(", ")}`
    );
  }
  return outcome.spec;
}
