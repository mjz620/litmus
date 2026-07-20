import serializedNativeFullTitration from "./native-full-titration.v2.json";

import { hashLabWorkflowSpec } from "../../hash";
import {
  labWorkflowDraftV2Schema,
  type ValidatedLabWorkflowSpecV2
} from "../../schema/v2";
import { validateLabWorkflowSpecV2 } from "../../validation";
import { NATIVE_FULL_TITRATION_WORKFLOW_ID } from "./nativeFullTitrationAuthoring";

export { NATIVE_FULL_TITRATION_WORKFLOW_ID };

export const NATIVE_FULL_TITRATION_V2_EXPECTED_HASH =
  "sha256:e0efdcab04a9ff5811f6a5b0e526d58c09c30cf37bb19eb3d3d77242ab1d3dc3" as const;

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/**
 * Capability-native full titration: the exact authored procedure of
 * `workflow.acid_base_titration.full.v2` with no legacy compatibility
 * descriptor. It executes on the generic capability runtime — liquid
 * mechanical adapters plus the acid-base chemistry model — and must reproduce
 * the legacy parity oracle exactly (see nativeTitrationParity.test.ts).
 */
export const NATIVE_FULL_TITRATION_V2_DRAFT = deepFreeze(
  labWorkflowDraftV2Schema.parse(serializedNativeFullTitration)
);

export const NATIVE_FULL_TITRATION_V2_SOURCE_HASH = hashLabWorkflowSpec(
  NATIVE_FULL_TITRATION_V2_DRAFT
);

export function validateNativeFullTitrationV2(
  checkedAt: string
): Readonly<ValidatedLabWorkflowSpecV2> {
  const outcome = validateLabWorkflowSpecV2(NATIVE_FULL_TITRATION_V2_DRAFT, {
    checkedAt
  });
  if (
    !outcome.schemaValid ||
    !outcome.validation.runnable ||
    outcome.validation.canonicalSpecHash !==
      NATIVE_FULL_TITRATION_V2_EXPECTED_HASH
  ) {
    const issueCodes = outcome.issues.map(({ code }) => code).join(", ");
    throw new Error(
      `The native full titration v2 definition is not current and runnable${
        issueCodes.length > 0 ? `: ${issueCodes}` : "."
      }`
    );
  }
  return outcome.spec;
}
