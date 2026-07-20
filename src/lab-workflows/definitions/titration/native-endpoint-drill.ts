import { hashLabWorkflowSpec } from "../../hash";
import {
  labWorkflowDraftV2Schema,
  type LabWorkflowDraftV2,
  type ValidatedLabWorkflowSpecV2
} from "../../schema/v2";
import { validateLabWorkflowSpecV2 } from "../../validation";
import { STRICT_MIGRATED_TITRATION_V2_DRAFT } from "./index";

export const NATIVE_ENDPOINT_DRILL_WORKFLOW_ID =
  "workflow.acid_base_titration.endpoint_drill.native.v2" as const;
export const NATIVE_ENDPOINT_DRILL_V2_EXPECTED_HASH =
  "sha256:b9389664c368d17790c0e8fd7d77aa292267b4eb2cfc7ed3f55c61fa8db115fd" as const;

/**
 * Capability-native endpoint-control drill.
 *
 * This is the fully native successor of the still-compatibility-bound
 * `workflow.endpoint_control.native.v2` draft: the same two-permission
 * structure (`migration.permission.s1.a1` read, `migration.permission.s2.a1`
 * dispense) and the same rules — completion s1/s2, the 25.1 mL endpoint
 * tolerance on `observable.burette_reading_ml.v1`, and the terminal
 * endpoint-overshoot flag rule — with identical rule IDs so diagnoses compare
 * directly against the legacy parity oracle. The mid-procedure bench (22 mL
 * already delivered, conditioned, indicator committed, thirty simulated
 * seconds in) comes from the registered native initialization preset instead
 * of a legacy engine seed.
 */
function createDraft(): LabWorkflowDraftV2 {
  const candidate = structuredClone(
    STRICT_MIGRATED_TITRATION_V2_DRAFT
  ) as LabWorkflowDraftV2;
  candidate.id = NATIVE_ENDPOINT_DRILL_WORKFLOW_ID;
  candidate.sourceRequest =
    "Capability-native endpoint-control drill accepting meniscus reading and controlled delivery in either scientifically valid order, seeded near the endpoint by a registered native initialization preset.";
  candidate.metadata = {
    ...candidate.metadata,
    title: "Flexible endpoint control and meniscus reading"
  };
  delete candidate.provenance;
  delete candidate.compatibility;
  candidate.initialization = {
    presetId: "seed.titration.near_endpoint_22ml.v1"
  };
  // Two exclusive verified providers exist for instrument observables; the
  // burette reading projects from equipment state, so the root requirement
  // stays with the acid-base and indicator capabilities only.
  candidate.requiredChemistryCapabilityIds =
    candidate.requiredChemistryCapabilityIds.filter(
      (id) => id !== "chemistry.instrument_observables.v1"
    );
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

export const NATIVE_ENDPOINT_DRILL_V2_DRAFT = Object.freeze(createDraft());
export const NATIVE_ENDPOINT_DRILL_V2_SOURCE_HASH = hashLabWorkflowSpec(
  NATIVE_ENDPOINT_DRILL_V2_DRAFT
);

export function validateNativeEndpointDrillV2(
  checkedAt: string
): Readonly<ValidatedLabWorkflowSpecV2> {
  const outcome = validateLabWorkflowSpecV2(NATIVE_ENDPOINT_DRILL_V2_DRAFT, {
    checkedAt
  });
  if (
    !outcome.schemaValid ||
    !outcome.validation.runnable ||
    outcome.validation.canonicalSpecHash !==
      NATIVE_ENDPOINT_DRILL_V2_EXPECTED_HASH
  ) {
    const issueCodes = outcome.issues.map(({ code }) => code).join(", ");
    throw new Error(
      `The native endpoint drill v2 definition is not current and runnable: ${outcome.validation?.canonicalSpecHash ?? "no hash"}${issueCodes ? `; ${issueCodes}` : ""}`
    );
  }
  return outcome.spec;
}
