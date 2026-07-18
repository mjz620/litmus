import serializedEndpointControl from "./endpoint-control.v2.json";

import { hashLabWorkflowSpec } from "../../hash";
import {
  labWorkflowDraftV2Schema,
  type ValidatedLabWorkflowSpecV2
} from "../../schema/v2";
import { validateLabWorkflowSpecV2 } from "../../validation";

export const TITRATION_V2_SOURCE_MIGRATION_VERSION = "1.0.0" as const;
export const TITRATION_V2_SOURCE_V1_VALIDATED_HASH =
  "sha256:372b69f6855ce4fe2221f0b9ea839d3907f44f58701b7b938c7a28b7f36761c9" as const;
export const TITRATION_V2_SOURCE_V1_CONTENT_HASH =
  "sha256:5c5994100e9e6c3467b87da4554f06ed61490c39b1bd6e134b7b5b32ed84e863" as const;
export const TITRATION_V2_EXPECTED_HASH =
  "sha256:4acc1b11ac2dff4978dcd7544717ac81c0d423d684e922d7ced36d13dd430444" as const;

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export const STRICT_MIGRATED_TITRATION_V2_DRAFT = deepFreeze(
  labWorkflowDraftV2Schema.parse(serializedEndpointControl)
);

export const TITRATION_V2_SOURCE_HASH = hashLabWorkflowSpec(
  STRICT_MIGRATED_TITRATION_V2_DRAFT
);

/**
 * Revalidates the serialized definition against current exact registries.
 * Callers must never treat the checked-in draft as a current approval artifact.
 */
export function validateStrictMigratedTitrationV2(
  checkedAt: string
): Readonly<ValidatedLabWorkflowSpecV2> {
  const outcome = validateLabWorkflowSpecV2(
    STRICT_MIGRATED_TITRATION_V2_DRAFT,
    { checkedAt }
  );
  if (
    !outcome.schemaValid ||
    !outcome.validation.runnable ||
    outcome.validation.canonicalSpecHash !== TITRATION_V2_EXPECTED_HASH
  ) {
    const issueCodes = outcome.issues.map(({ code }) => code).join(", ");
    throw new Error(
      `The serialized titration v2 definition is not current and runnable${
        issueCodes.length > 0 ? `: ${issueCodes}` : "."
      }`
    );
  }
  return outcome.spec;
}
