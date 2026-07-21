import { hashLabWorkflowSpec } from "../../hash";
import {
  labWorkflowDraftV2Schema,
  type ValidatedLabWorkflowSpecV2
} from "../../schema/v2";
import { validateLabWorkflowSpecV2 } from "../../validation";
import { NATIVE_FULL_TITRATION_V2_DRAFT } from "./native-full-titration";

export const WEAK_ACID_TITRATION_WORKFLOW_ID =
  "workflow.acetic_acid_titration.full.native.v1" as const;
export const WEAK_ACID_TITRATION_V1_EXPECTED_HASH =
  "sha256:ef47e4e2ec7e34e89adadd1ce2b2781a4c7e577d6c00c850715c0b5bfbedc16c" as const;

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/**
 * Standard school vinegar analysis: an acetic-acid sample is titrated with
 * 0.100 M NaOH and phenolphthalein. The procedure follows ICIQ's high-school
 * "Acidity of vinegar" activity, including the named indicator and endpoint:
 * https://iciq.org/outreach/schools-and-high-schools/from-the-laboratory-to-the-classroom/the-acidity-of-vinegar/
 */
export const WEAK_ACID_TITRATION_V1_DRAFT = deepFreeze(
  labWorkflowDraftV2Schema.parse({
    ...NATIVE_FULL_TITRATION_V2_DRAFT,
    id: WEAK_ACID_TITRATION_WORKFLOW_ID,
    revision: 1,
    sourceRequest:
      "Create a high-school acetic-acid/NaOH titration using phenolphthalein, following ICIQ's Acidity of Vinegar procedure: https://iciq.org/outreach/schools-and-high-schools/from-the-laboratory-to-the-classroom/the-acidity-of-vinegar/",
    metadata: {
      ...NATIVE_FULL_TITRATION_V2_DRAFT.metadata,
      title: "Acetic acid titration",
      learningObjective:
        "Titrate a weak monoprotic acid with sodium hydroxide and identify the phenolphthalein endpoint appropriate to its basic equivalence region.",
      studentSummary:
        "Condition and fill the burette, add phenolphthalein to the acetic-acid sample, then approach the first persistent pale-pink endpoint dropwise.",
      tags: [
        "weak-acid titration",
        "vinegar analysis",
        "phenolphthalein endpoint"
      ]
    },
    equipment: NATIVE_FULL_TITRATION_V2_DRAFT.equipment.map((entry) =>
      entry.instanceId === "analyte_flask"
        ? { ...entry, label: "0.100 M acetic acid sample" }
        : entry
    ),
    materials: NATIVE_FULL_TITRATION_V2_DRAFT.materials.map((entry) =>
      entry.instanceId === "analyte"
        ? {
            ...entry,
            materialProfileId: "reagent.acetic_acid_0_100m.v1",
            quantityPresetId: "quantity-preset.acetic_acid_0_100m_25ml.v1"
          }
        : entry
    ),
    coachPolicy: {
      ...NATIVE_FULL_TITRATION_V2_DRAFT.coachPolicy,
      triggers: [
        ...NATIVE_FULL_TITRATION_V2_DRAFT.coachPolicy.triggers,
        {
          id: "coach_indicator_choice",
          objectiveIds: ["endpoint_control"],
          eventTypeIds: ["select_indicator"],
          flagIds: ["flag.indicator_unsuitable.v1"],
          triggerTypeId: "coach_trigger.mistake_reflection.v1",
          hintStrategyId: "hint.endpoint_control_graduated.v1",
          maxHintLevel: 2,
          cooldownEventCount: 2,
          staySilentOnEventReasonIds: ["evidence.indicator_suitable.v1"]
        }
      ]
    },
    rubric: {
      ...NATIVE_FULL_TITRATION_V2_DRAFT.rubric,
      id: "rubric.acetic_acid_titration.full.native.v1",
      version: "1.0.0",
      title: "Weak-acid titration"
    },
    supportStatus: "draft_unvalidated",
    validation: null,
    judgeCritique: null
  })
);

export const WEAK_ACID_TITRATION_V1_SOURCE_HASH = hashLabWorkflowSpec(
  WEAK_ACID_TITRATION_V1_DRAFT
);

export function validateWeakAcidTitrationV1(
  checkedAt: string
): Readonly<ValidatedLabWorkflowSpecV2> {
  const outcome = validateLabWorkflowSpecV2(WEAK_ACID_TITRATION_V1_DRAFT, {
    checkedAt
  });
  if (!outcome.schemaValid || !outcome.validation.runnable) {
    throw new Error(
      `The weak-acid titration definition is not current and runnable: ${outcome.issues
        .map(({ code, path }) => `${code}@${path}`)
        .join(", ")}`
    );
  }
  if (
    outcome.validation.canonicalSpecHash !==
    WEAK_ACID_TITRATION_V1_EXPECTED_HASH
  ) {
    throw new Error(
      `The weak-acid titration definition hash changed: ${outcome.validation.canonicalSpecHash}`
    );
  }
  return outcome.spec;
}
