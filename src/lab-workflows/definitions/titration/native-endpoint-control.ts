import { hashLabWorkflowSpec } from "../../hash";
import {
  labWorkflowDraftV2Schema,
  type LabWorkflowDraftV2,
  type ValidatedLabWorkflowSpecV2
} from "../../schema/v2";
import { validateLabWorkflowSpecV2 } from "../../validation";
import { STRICT_MIGRATED_TITRATION_V2_DRAFT } from "./index";

export const NATIVE_TITRATION_V2_WORKFLOW_ID =
  "workflow.endpoint_control.native.v2" as const;
export const NATIVE_TITRATION_V2_EXPECTED_HASH =
  "sha256:d6f4f83fda25497242c0a63fc35c97ae8552bc896e170b35155ffeddc23947d0" as const;

function createDraft(): LabWorkflowDraftV2 {
  const candidate = structuredClone(
    STRICT_MIGRATED_TITRATION_V2_DRAFT
  ) as LabWorkflowDraftV2;
  candidate.id = NATIVE_TITRATION_V2_WORKFLOW_ID;
  candidate.sourceRequest =
    "Native v2 endpoint-control lab accepting meniscus reading and controlled delivery in either scientifically valid order.";
  candidate.metadata = {
    ...candidate.metadata,
    title: "Flexible endpoint control and meniscus reading"
  };
  delete candidate.provenance;
  candidate.permittedActions = candidate.permittedActions.map((permission) => ({
    ...permission,
    availability: {
      allSatisfiedRuleIds: [],
      allUnsatisfiedRuleIds:
        permission.actionId === "action.read_volume.v1"
          ? ["migration.rule.s1.completion"]
          : ["migration.rule.s2.completion"]
    }
  }));
  candidate.rules = [
    ...candidate.rules.filter(
      (rule) => rule.id !== "migration.rule.s1.before.s2"
    ),
    {
      id: "native.rule.endpoint_overshoot_terminal",
      kind: "forbidden",
      condition: {
        kind: "event_flag",
        flagId: "flag.endpoint_overshoot.v1",
        presence: "present",
        eventTypeId: "event.add_titrant.v1"
      },
      severity: "conceptual",
      recoverable: false,
      terminal: true,
      objectiveIds: ["endpoint_control"]
    },
    {
      id: "native.rule.endpoint_volume_tolerance",
      kind: "required",
      condition: {
        kind: "observable_within_tolerance",
        observableId: "observable.burette_reading_ml.v1",
        minimum: 25.1,
        maximum: 25.1,
        minimumInclusive: true,
        maximumInclusive: true,
        unitId: "unit.ml.v1"
      },
      severity: "procedural",
      recoverable: true,
      terminal: false,
      objectiveIds: ["endpoint_control"]
    }
  ];
  candidate.instructions = candidate.instructions.map((instruction) => ({
    ...instruction,
    guidance:
      instruction.id === "read_initial_burette"
        ? "Record the meniscus before or after endpoint delivery; both orders are valid when the reading is precise."
        : instruction.guidance
  }));
  return labWorkflowDraftV2Schema.parse(candidate);
}

export const NATIVE_TITRATION_V2_DRAFT = Object.freeze(createDraft());
export const NATIVE_TITRATION_V2_SOURCE_HASH = hashLabWorkflowSpec(
  NATIVE_TITRATION_V2_DRAFT
);

export function validateNativeTitrationV2(
  checkedAt: string
): Readonly<ValidatedLabWorkflowSpecV2> {
  const outcome = validateLabWorkflowSpecV2(NATIVE_TITRATION_V2_DRAFT, {
    checkedAt
  });
  if (
    !outcome.schemaValid ||
    !outcome.validation.runnable ||
    outcome.validation.canonicalSpecHash !== NATIVE_TITRATION_V2_EXPECTED_HASH
  ) {
    const issueCodes = outcome.issues.map(({ code }) => code).join(", ");
    throw new Error(
      `The native titration v2 definition is not current and runnable: ${outcome.validation?.canonicalSpecHash ?? "no hash"}${issueCodes ? `; ${issueCodes}` : ""}`
    );
  }
  return outcome.spec;
}
