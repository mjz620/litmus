import { applyLabDraftTransaction } from "../../authoring";
import { createBlankLabDraftV2 } from "../blank-lab";
import {
  labWorkflowDraftV2Schema,
  type LabWorkflowDraftV2
} from "../../schema/v2";
import { FULL_TITRATION_AUTHORING_COMMANDS } from "./fullTitrationAuthoring";

export const NATIVE_FULL_TITRATION_WORKFLOW_ID =
  "workflow.acid_base_titration.full.native.v2" as const;

/**
 * Capability-native full titration: the same authored procedure as
 * `workflow.acid_base_titration.full.v2` — identical equipment, layout,
 * materials, permissions, rules (including their IDs, so diagnoses compare
 * directly against the legacy parity oracle), instructions, rubric, and coach
 * policy — with no legacy compatibility descriptor. Chemistry resolves through
 * registered capabilities: the acid-base equilibrium and indicator-response
 * models over the liquid foundation trio. `chemistry.instrument_observables.v1`
 * is deliberately not requested at the root: two exclusive verified providers
 * exist and the burette reading projects from equipment state instead.
 */
export function createAuthoredNativeFullTitrationDraft(): Readonly<LabWorkflowDraftV2> {
  const blank = createBlankLabDraftV2();
  const scaffold = labWorkflowDraftV2Schema.parse({
    ...blank,
    id: NATIVE_FULL_TITRATION_WORKFLOW_ID,
    sourceRequest:
      "Create a complete strong acid/strong base titration on the capability-native runtime: condition and fill the burette, add an indicator, titrate to the endpoint, and record the final reading.",
    rubric: {
      ...blank.rubric,
      id: "rubric.acid_base_titration.full.native.v2",
      version: "2.0.0",
      title: "Full titration"
    }
  });
  const result = applyLabDraftTransaction(
    scaffold,
    FULL_TITRATION_AUTHORING_COMMANDS,
    scaffold.revision
  );
  if (!result.ok) {
    throw new Error(
      `Native full titration command ${result.failingCommandIndex ?? "?"} failed: ${result.error.code} at ${result.error.path}: ${result.error.message}`
    );
  }
  return labWorkflowDraftV2Schema.parse({
    ...result.draft,
    catalog: {
      familyId: "family.acid_base_titration.v1"
    },
    /*
     * Same retry policy as the legacy-backed definition: an endpoint
     * overshoot routes to the endpoint-control practice drill.
     */
    coachPolicy: {
      triggers: [
        {
          id: "coach_high_flow",
          objectiveIds: ["endpoint_control"],
          eventTypeIds: ["event.add_titrant.v1"],
          flagIds: [
            "flag.flow_rate_high_near_endpoint.v1",
            "flag.endpoint_overshoot.v1"
          ],
          triggerTypeId: "coach_trigger.mistake_reflection.v1",
          hintStrategyId: "hint.endpoint_control_graduated.v1",
          maxHintLevel: 2,
          cooldownEventCount: 2,
          staySilentOnEventReasonIds: [
            "evidence.controlled_addition_near_endpoint.v1"
          ]
        }
      ],
      adaptiveRetries: [
        {
          id: "retry_endpoint",
          templateId: "retry.endpoint_control_near_endpoint.v1",
          targetObjectiveIds: ["endpoint_control"],
          eligibleFlagIds: [
            "flag.flow_rate_high_near_endpoint.v1",
            "flag.endpoint_overshoot.v1"
          ],
          initializationPresetId: "seed.titration.near_endpoint_22ml.v1",
          maxMinutes: 3,
          studentGoal:
            "Reach the endpoint using controlled dropwise additions.",
          successEvidenceReasonIds: [
            "evidence.controlled_addition_near_endpoint.v1"
          ]
        }
      ]
    },
    requiredChemistryCapabilityIds: [
      "chemistry.material_ledger.v1",
      "chemistry.volume_conservation.v1",
      "chemistry.solution_mixing.v1",
      "chemistry.acid_base_equilibrium.v1",
      "chemistry.indicator_response.v1"
    ],
    safetyPolicyIds: ["safety.virtual_titration_ppe_notice.v1"],
    safetyBindings: [
      {
        safetyPolicyId: "safety.virtual_titration_ppe_notice.v1",
        equipmentInstanceIds: [
          "titrant_burette",
          "analyte_flask",
          "indicator_source",
          "titrant_bottle"
        ],
        materialInstanceIds: []
      }
    ]
  });
}
