import {
  applyLabDraftTransaction,
  type LabDraftCommand
} from "../../authoring";
import { createBlankLabDraftV2 } from "../blank-lab";
import {
  labWorkflowDraftV2Schema,
  type LabWorkflowDraftV2
} from "../../schema/v2";

export const PRECIPITATION_WORKFLOW_ID =
  "workflow.silver_chloride_precipitation.native.v2" as const;

/**
 * The exact shared-domain command sequence a teacher would run in Composer to
 * produce this lab. The shipped JSON must be reconstructible from these
 * commands, so a definition can never encode something the authoring surface
 * cannot express.
 */
export const PRECIPITATION_AUTHORING_COMMANDS = Object.freeze([
  {
    type: "update_metadata",
    metadata: {
      title: "Silver chloride precipitation",
      learningObjective:
        "Predict and observe whether combining two aqueous ionic solutions produces an insoluble product, and identify the ions responsible.",
      studentSummary:
        "Pour silver nitrate and sodium chloride into the same beaker and watch what forms. Decide which ions combined and which stayed dissolved.",
      gradeBand: "11-12",
      estimatedMinutes: 15,
      difficulty: "intermediate",
      tags: ["precipitation", "solubility", "net ionic"],
      accessibilityNotes: [
        "Precipitate presence and colour are reported as text, never colour alone."
      ],
      deviceProfileId: "device.chromebook_core.v1"
    }
  },
  { type: "add_objective", objectiveId: "precipitate_observation" },
  {
    type: "add_equipment",
    equipment: {
      instanceId: "silver_bottle",
      equipmentDefinitionId: "component.reagent_bottle.v1",
      configurationPresetId:
        "component_config.reagent_bottle.stock_solution.v1",
      label: "0.100 M silver nitrate",
      required: true
    }
  },
  {
    type: "add_equipment",
    equipment: {
      instanceId: "chloride_bottle",
      equipmentDefinitionId: "component.reagent_bottle.v1",
      configurationPresetId:
        "component_config.reagent_bottle.stock_solution.v1",
      label: "0.100 M sodium chloride",
      required: true
    }
  },
  {
    type: "add_equipment",
    equipment: {
      instanceId: "mixing_beaker",
      equipmentDefinitionId: "component.beaker.v1",
      configurationPresetId: "component_config.beaker.250ml.v1",
      label: "Reaction beaker",
      required: true
    }
  },
  {
    type: "set_layout",
    layout: {
      configurationSchemaId:
        "schema.layout_configuration.precipitation_bench.v1",
      placements: [
        {
          equipmentInstanceId: "silver_bottle",
          placementSlotId: "placement.precipitation_stock_left.v1"
        },
        {
          equipmentInstanceId: "chloride_bottle",
          placementSlotId: "placement.precipitation_stock_right.v1"
        },
        {
          equipmentInstanceId: "mixing_beaker",
          placementSlotId: "placement.bench_vessel_center.v1"
        }
      ]
    }
  },
  {
    type: "bind_material",
    binding: {
      instanceId: "silver_stock",
      materialProfileId: "reagent.silver_nitrate_0_100m.v1",
      containerInstanceId: "silver_bottle",
      quantityPresetId: "quantity-preset.silver_nitrate_0_100m_50ml.v1"
    }
  },
  {
    type: "bind_material",
    binding: {
      instanceId: "chloride_stock",
      materialProfileId: "reagent.sodium_chloride_0_100m.v1",
      containerInstanceId: "chloride_bottle",
      quantityPresetId: "quantity-preset.sodium_chloride_0_100m_50ml.v1"
    }
  },
  {
    type: "permit_action",
    action: {
      id: "permission.pour_silver",
      actionId: "action.pour_liquid.v1",
      sourceEquipmentInstanceId: "silver_bottle",
      targetEquipmentInstanceIds: ["mixing_beaker"],
      authoredLimits: { maxPourVolumeML: 25 },
      maxAttempts: 3,
      availability: { allSatisfiedRuleIds: [], allUnsatisfiedRuleIds: [] }
    }
  },
  {
    type: "permit_action",
    action: {
      id: "permission.pour_chloride",
      actionId: "action.pour_liquid.v1",
      sourceEquipmentInstanceId: "chloride_bottle",
      targetEquipmentInstanceIds: ["mixing_beaker"],
      authoredLimits: { maxPourVolumeML: 25 },
      maxAttempts: 3,
      availability: { allSatisfiedRuleIds: [], allUnsatisfiedRuleIds: [] }
    }
  },
  {
    type: "add_rule",
    rule: {
      id: "rule.silver_poured",
      kind: "required",
      condition: {
        kind: "action_observed",
        actionId: "action.pour_liquid.v1",
        sourceEquipmentInstanceId: "silver_bottle",
        targetEquipmentInstanceIds: ["mixing_beaker"]
      },
      severity: "procedural",
      recoverable: true,
      terminal: false,
      objectiveIds: ["precipitate_observation"]
    }
  },
  {
    type: "add_rule",
    rule: {
      id: "rule.chloride_poured",
      kind: "required",
      condition: {
        kind: "action_observed",
        actionId: "action.pour_liquid.v1",
        sourceEquipmentInstanceId: "chloride_bottle",
        targetEquipmentInstanceIds: ["mixing_beaker"]
      },
      severity: "procedural",
      recoverable: true,
      terminal: false,
      objectiveIds: ["precipitate_observation"]
    }
  },
  {
    type: "add_rule",
    rule: {
      id: "rule.workflow_complete",
      kind: "success",
      condition: {
        kind: "registered_completion_policy_satisfied",
        completionPolicyId: "completion.all_required_observations.v1",
        evidenceRuleIds: ["rule.silver_poured", "rule.chloride_poured"]
      },
      severity: "procedural",
      recoverable: true,
      terminal: false,
      objectiveIds: ["precipitate_observation"]
    }
  },
  {
    type: "add_instruction",
    instruction: {
      id: "instruction.inspect_solutions",
      title: "Identify the ions in each bottle",
      guidance:
        "Read both labels and write down the cation and anion each solution contributes before you combine anything.",
      relatedRuleIds: ["rule.silver_poured"]
    }
  },
  {
    type: "add_instruction",
    instruction: {
      id: "instruction.combine",
      title: "Combine the solutions in the beaker",
      guidance:
        "Pour a measured volume of each solution into the same beaker. Watch the moment the second solution meets the first.",
      relatedRuleIds: ["rule.silver_poured", "rule.chloride_poured"]
    }
  },
  {
    type: "add_instruction",
    instruction: {
      id: "instruction.identify_product",
      title: "Identify the precipitate",
      guidance:
        "Note whether a solid appeared and what colour it is, then work out which pair of ions formed it and which stayed dissolved as spectators.",
      relatedRuleIds: ["rule.workflow_complete"]
    }
  },
  {
    type: "add_rubric_criterion",
    criterion: {
      id: "criterion.precipitate_observation",
      objectiveIds: ["precipitate_observation"],
      ruleIds: ["rule.silver_poured", "rule.chloride_poured"],
      description:
        "Combines both registered ionic solutions in one vessel and produces an observable precipitate.",
      maxPoints: 10,
      scoringGuide: [
        "0: the two solutions were never combined in one vessel",
        "5: only one solution reached the beaker",
        "10: both solutions combined and the precipitate observed"
      ],
      assessmentModeId: "assessment.event_performance.v1",
      evidenceMappings: [
        {
          kind: "semantic_event",
          eventTypeId: "event.pour_liquid.v1",
          required: true
        },
        {
          kind: "observable",
          observableId: "observable.precipitate_observed.v1",
          required: true
        },
        {
          kind: "observable",
          observableId: "observable.precipitate_color.v1",
          required: false
        }
      ]
    }
  }
] as const satisfies readonly LabDraftCommand[]) as readonly LabDraftCommand[];

export function createAuthoredPrecipitationDraft(): Readonly<LabWorkflowDraftV2> {
  const blank = createBlankLabDraftV2();
  const scaffold = labWorkflowDraftV2Schema.parse({
    ...blank,
    id: PRECIPITATION_WORKFLOW_ID,
    sourceRequest:
      "Create a precipitation lab where students combine silver nitrate and sodium chloride in a beaker and identify the insoluble product.",
    rubric: {
      ...blank.rubric,
      id: "rubric.silver_chloride_precipitation.v2",
      version: "2.0.0",
      title: "Precipitation and solubility"
    }
  });
  const result = applyLabDraftTransaction(
    scaffold,
    PRECIPITATION_AUTHORING_COMMANDS,
    scaffold.revision
  );
  if (!result.ok) {
    throw new Error(
      `Precipitation command ${result.failingCommandIndex ?? "?"} failed: ${result.error.code} at ${result.error.path}: ${result.error.message}`
    );
  }
  return labWorkflowDraftV2Schema.parse({
    ...result.draft,
    requiredChemistryCapabilityIds: [
      "chemistry.material_ledger.v1",
      "chemistry.volume_conservation.v1",
      "chemistry.solution_mixing.v1",
      "chemistry.precipitation_solubility.v1"
    ],
    safetyPolicyIds: ["safety.virtual_solution_preparation_ppe_notice.v1"],
    safetyBindings: [
      {
        safetyPolicyId: "safety.virtual_solution_preparation_ppe_notice.v1",
        equipmentInstanceIds: [
          "silver_bottle",
          "chloride_bottle",
          "mixing_beaker"
        ],
        materialInstanceIds: ["silver_stock", "chloride_stock"]
      }
    ]
  });
}
