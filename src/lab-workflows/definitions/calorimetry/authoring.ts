import {
  applyLabDraftTransaction,
  type LabDraftCommand
} from "../../authoring";
import { createBlankLabDraftV2 } from "../blank-lab";
import {
  labWorkflowDraftV2Schema,
  type LabWorkflowDraftV2
} from "../../schema/v2";

export const CALORIMETRY_WORKFLOW_ID =
  "workflow.hot_cold_water_calorimetry.native.v2" as const;

export const CALORIMETRY_AUTHORING_COMMANDS = Object.freeze([
  {
    type: "update_metadata",
    metadata: {
      title: "Mix hot and cold water in a coffee-cup calorimeter",
      learningObjective:
        "Pour equal volumes of registered hot and cold water, mix, and record the equilibrium temperature from deterministic heat conservation.",
      studentSummary:
        "Pour 50.00 mL of 20.0 °C water and 50.00 mL of 60.0 °C water into the coffee-cup calorimeter, mix, place the probe, and read the final temperature.",
      gradeBand: "mixed_high_school",
      estimatedMinutes: 10,
      difficulty: "intro",
      tags: ["calorimetry", "heat transfer", "thermal energy"],
      accessibilityNotes: [
        "Every apparatus action has a keyboard control and a text state summary.",
        "Temperature evidence is numeric and does not rely on color alone."
      ],
      deviceProfileId: "device.chromebook_core.v1"
    }
  },
  { type: "add_objective", objectiveId: "heat_transfer" },
  {
    type: "add_equipment",
    equipment: {
      instanceId: "cold_bottle",
      equipmentDefinitionId: "component.wash_bottle.v1",
      configurationPresetId: "component_config.wash_bottle.250ml.v1",
      label: "20.0 °C distilled water",
      required: true
    }
  },
  {
    type: "add_equipment",
    equipment: {
      instanceId: "hot_bottle",
      equipmentDefinitionId: "component.reagent_bottle.v1",
      configurationPresetId:
        "component_config.reagent_bottle.stock_solution.v1",
      label: "60.0 °C distilled water",
      required: true
    }
  },
  {
    type: "add_equipment",
    equipment: {
      instanceId: "calorimeter",
      equipmentDefinitionId: "component.calorimeter.v1",
      configurationPresetId:
        "component_config.calorimeter.coffee_cup_100ml.v1",
      label: "Coffee-cup calorimeter",
      required: true
    }
  },
  {
    type: "add_equipment",
    equipment: {
      instanceId: "thermometer",
      equipmentDefinitionId: "component.thermometer.v1",
      configurationPresetId: "component_config.thermometer.digital_0_1c.v1",
      label: "Digital thermometer",
      required: true
    }
  },
  {
    type: "set_layout",
    layout: {
      configurationSchemaId:
        "schema.layout_configuration.calorimetry_bench.v1",
      placements: [
        {
          equipmentInstanceId: "calorimeter",
          placementSlotId: "placement.calorimeter_center.v1"
        },
        {
          equipmentInstanceId: "thermometer",
          placementSlotId: "placement.calorimetry_thermometer.v1"
        },
        {
          equipmentInstanceId: "cold_bottle",
          placementSlotId: "placement.calorimetry_wash_left.v1"
        },
        {
          equipmentInstanceId: "hot_bottle",
          placementSlotId: "placement.calorimetry_stock_right.v1"
        }
      ]
    }
  },
  {
    type: "bind_material",
    binding: {
      instanceId: "cold_water",
      materialProfileId: "reagent.distilled_water_cold_20c.v1",
      containerInstanceId: "cold_bottle",
      quantityPresetId: "quantity-preset.distilled_water_cold_20c_100ml.v1"
    }
  },
  {
    type: "bind_material",
    binding: {
      instanceId: "hot_water",
      materialProfileId: "reagent.distilled_water_hot_60c.v1",
      containerInstanceId: "hot_bottle",
      quantityPresetId: "quantity-preset.distilled_water_hot_60c_100ml.v1"
    }
  },
  {
    type: "permit_action",
    action: {
      id: "permission.pour_cold",
      actionId: "action.pour_liquid.v1",
      sourceEquipmentInstanceId: "cold_bottle",
      targetEquipmentInstanceIds: ["calorimeter"],
      authoredLimits: { maxPourVolumeML: 50 },
      maxAttempts: 3,
      availability: { allSatisfiedRuleIds: [], allUnsatisfiedRuleIds: [] }
    }
  },
  {
    type: "permit_action",
    action: {
      id: "permission.pour_hot",
      actionId: "action.pour_liquid.v1",
      sourceEquipmentInstanceId: "hot_bottle",
      targetEquipmentInstanceIds: ["calorimeter"],
      authoredLimits: { maxPourVolumeML: 50 },
      maxAttempts: 3,
      availability: { allSatisfiedRuleIds: [], allUnsatisfiedRuleIds: [] }
    }
  },
  {
    type: "permit_action",
    action: {
      id: "permission.mix_calorimeter",
      actionId: "action.mix_calorimeter.v1",
      sourceEquipmentInstanceId: "calorimeter",
      targetEquipmentInstanceIds: [],
      maxAttempts: 2,
      availability: { allSatisfiedRuleIds: [], allUnsatisfiedRuleIds: [] }
    }
  },
  {
    type: "permit_action",
    action: {
      id: "permission.set_lid",
      actionId: "action.set_calorimeter_lid.v1",
      sourceEquipmentInstanceId: "calorimeter",
      targetEquipmentInstanceIds: [],
      maxAttempts: 4,
      availability: { allSatisfiedRuleIds: [], allUnsatisfiedRuleIds: [] }
    }
  },
  {
    type: "permit_action",
    action: {
      id: "permission.place_probe",
      actionId: "action.place_thermometer.v1",
      sourceEquipmentInstanceId: "thermometer",
      targetEquipmentInstanceIds: ["calorimeter"],
      maxAttempts: 2,
      availability: { allSatisfiedRuleIds: [], allUnsatisfiedRuleIds: [] }
    }
  },
  {
    type: "permit_action",
    action: {
      id: "permission.read_temperature",
      actionId: "action.read_temperature.v1",
      sourceEquipmentInstanceId: "thermometer",
      targetEquipmentInstanceIds: [],
      maxAttempts: 3,
      availability: { allSatisfiedRuleIds: [], allUnsatisfiedRuleIds: [] }
    }
  },
  {
    type: "add_rule",
    rule: {
      id: "rule.cold_poured",
      kind: "required",
      condition: {
        kind: "action_observed",
        actionId: "action.pour_liquid.v1",
        sourceEquipmentInstanceId: "cold_bottle",
        targetEquipmentInstanceIds: ["calorimeter"]
      },
      severity: "procedural",
      recoverable: true,
      terminal: false,
      objectiveIds: ["heat_transfer"]
    }
  },
  {
    type: "add_rule",
    rule: {
      id: "rule.hot_poured",
      kind: "required",
      condition: {
        kind: "action_observed",
        actionId: "action.pour_liquid.v1",
        sourceEquipmentInstanceId: "hot_bottle",
        targetEquipmentInstanceIds: ["calorimeter"]
      },
      severity: "procedural",
      recoverable: true,
      terminal: false,
      objectiveIds: ["heat_transfer"]
    }
  },
  {
    type: "add_rule",
    rule: {
      id: "rule.calorimeter_mixed",
      kind: "required",
      condition: {
        kind: "action_observed",
        actionId: "action.mix_calorimeter.v1",
        sourceEquipmentInstanceId: "calorimeter",
        targetEquipmentInstanceIds: []
      },
      severity: "procedural",
      recoverable: true,
      terminal: false,
      objectiveIds: ["heat_transfer"]
    }
  },
  {
    type: "add_rule",
    rule: {
      id: "rule.probe_placed",
      kind: "required",
      condition: {
        kind: "action_observed",
        actionId: "action.place_thermometer.v1",
        sourceEquipmentInstanceId: "thermometer",
        targetEquipmentInstanceIds: ["calorimeter"]
      },
      severity: "procedural",
      recoverable: true,
      terminal: false,
      objectiveIds: ["heat_transfer"]
    }
  },
  {
    type: "add_rule",
    rule: {
      id: "rule.temperature_read",
      kind: "required",
      condition: {
        kind: "action_observed",
        actionId: "action.read_temperature.v1",
        sourceEquipmentInstanceId: "thermometer",
        targetEquipmentInstanceIds: []
      },
      severity: "procedural",
      recoverable: true,
      terminal: false,
      objectiveIds: ["heat_transfer"]
    }
  },
  {
    type: "add_rule",
    rule: {
      id: "rule.final_volume_tolerance",
      kind: "required",
      condition: {
        kind: "observable_within_tolerance",
        observableId: "observable.calorimeter_volume_ml.v1",
        minimum: 99.5,
        maximum: 100,
        minimumInclusive: true,
        maximumInclusive: true,
        unitId: "unit.ml.v1"
      },
      severity: "procedural",
      recoverable: true,
      terminal: false,
      objectiveIds: ["heat_transfer"]
    }
  },
  {
    type: "add_rule",
    rule: {
      id: "rule.final_temperature_tolerance",
      kind: "required",
      condition: {
        kind: "observable_within_tolerance",
        observableId: "observable.calorimeter_temperature_c.v1",
        minimum: 39.9,
        maximum: 40.1,
        minimumInclusive: true,
        maximumInclusive: true,
        unitId: "unit.celsius.v1"
      },
      severity: "conceptual",
      recoverable: true,
      terminal: false,
      objectiveIds: ["heat_transfer"]
    }
  },
  {
    type: "add_rule",
    rule: {
      id: "rule.mix_count_best_practice",
      kind: "best_practice",
      condition: {
        kind: "equipment_state_equals",
        equipmentInstanceId: "calorimeter",
        stateFieldKey: "mixCount",
        expectedValue: { valueType: "number", value: 10 }
      },
      severity: "best-practice",
      recoverable: true,
      terminal: false,
      objectiveIds: ["heat_transfer"]
    }
  },
  {
    type: "add_rule",
    rule: {
      id: "rule.pours_before_mix",
      kind: "ordering",
      condition: {
        kind: "rule_satisfied_before",
        predecessorRuleId: "rule.cold_poured",
        successorRuleId: "rule.calorimeter_mixed"
      },
      severity: "procedural",
      recoverable: false,
      terminal: true,
      objectiveIds: ["heat_transfer"]
    }
  },
  {
    type: "add_rule",
    rule: {
      id: "rule.hot_before_mix",
      kind: "ordering",
      condition: {
        kind: "rule_satisfied_before",
        predecessorRuleId: "rule.hot_poured",
        successorRuleId: "rule.calorimeter_mixed"
      },
      severity: "conceptual",
      recoverable: false,
      terminal: true,
      objectiveIds: ["heat_transfer"]
    }
  },
  {
    type: "add_rule",
    rule: {
      id: "rule.mix_before_probe",
      kind: "ordering",
      condition: {
        kind: "rule_satisfied_before",
        predecessorRuleId: "rule.calorimeter_mixed",
        successorRuleId: "rule.probe_placed"
      },
      severity: "procedural",
      recoverable: false,
      terminal: false,
      objectiveIds: ["heat_transfer"]
    }
  },
  {
    type: "add_rule",
    rule: {
      id: "rule.probe_before_read",
      kind: "ordering",
      condition: {
        kind: "rule_satisfied_before",
        predecessorRuleId: "rule.probe_placed",
        successorRuleId: "rule.temperature_read"
      },
      severity: "procedural",
      recoverable: false,
      terminal: false,
      objectiveIds: ["heat_transfer"]
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
        evidenceRuleIds: [
          "rule.cold_poured",
          "rule.hot_poured",
          "rule.calorimeter_mixed",
          "rule.probe_placed",
          "rule.temperature_read",
          "rule.final_volume_tolerance",
          "rule.final_temperature_tolerance",
          "rule.pours_before_mix",
          "rule.hot_before_mix",
          "rule.mix_before_probe",
          "rule.probe_before_read"
        ]
      },
      severity: "procedural",
      recoverable: true,
      terminal: false,
      objectiveIds: ["heat_transfer"]
    }
  },
  {
    type: "add_instruction",
    instruction: {
      id: "instruction.pour_and_mix",
      title: "Pour equal hot and cold volumes, then mix",
      guidance:
        "With the lid open, pour 50.00 mL of cold water and 50.00 mL of hot water into the calorimeter, then mix thoroughly.",
      relatedRuleIds: [
        "rule.cold_poured",
        "rule.hot_poured",
        "rule.calorimeter_mixed",
        "rule.pours_before_mix",
        "rule.hot_before_mix",
        "rule.mix_count_best_practice"
      ]
    }
  },
  {
    type: "add_instruction",
    instruction: {
      id: "instruction.read_temperature",
      title: "Place the probe and read the temperature",
      guidance:
        "After mixing, insert the digital thermometer and record the equilibrium temperature evidence.",
      relatedRuleIds: [
        "rule.probe_placed",
        "rule.temperature_read",
        "rule.mix_before_probe",
        "rule.probe_before_read"
      ]
    }
  },
  {
    type: "add_instruction",
    instruction: {
      id: "instruction.check_result",
      title: "Check the thermal result",
      guidance:
        "Confirm that the calorimeter volume is near 100 mL and the equilibrium temperature is near 40.0 °C from conserved heat.",
      relatedRuleIds: [
        "rule.final_volume_tolerance",
        "rule.final_temperature_tolerance",
        "rule.workflow_complete"
      ]
    }
  },
  {
    type: "add_rubric_criterion",
    criterion: {
      id: "criterion.heat_transfer",
      objectiveIds: ["heat_transfer"],
      ruleIds: [
        "rule.cold_poured",
        "rule.hot_poured",
        "rule.calorimeter_mixed",
        "rule.probe_placed",
        "rule.temperature_read",
        "rule.final_volume_tolerance",
        "rule.final_temperature_tolerance",
        "rule.pours_before_mix",
        "rule.hot_before_mix",
        "rule.mix_before_probe",
        "rule.probe_before_read"
      ],
      description:
        "Pours equal registered hot and cold volumes, mixes, and records an in-tolerance equilibrium temperature in a valid order.",
      maxPoints: 10,
      assessmentModeId: "assessment.event_performance.v1",
      evidenceMappings: [
        {
          kind: "semantic_event",
          eventTypeId: "event.pour_liquid.v1",
          required: true
        },
        {
          kind: "semantic_event",
          eventTypeId: "event.mix_calorimeter.v1",
          required: true
        },
        {
          kind: "semantic_event",
          eventTypeId: "event.read_temperature.v1",
          required: true
        },
        {
          kind: "observable",
          observableId: "observable.calorimeter_temperature_c.v1",
          required: true
        },
        {
          kind: "observable",
          observableId: "observable.calorimeter_volume_ml.v1",
          required: true
        }
      ],
      scoringGuide: [
        "0: pours or temperature reading not completed",
        "5: procedure completed with a recoverable tolerance miss",
        "10: equal volumes mixed and equilibrium temperature is in tolerance"
      ]
    }
  }
] as const satisfies readonly LabDraftCommand[]) as readonly LabDraftCommand[];

export function createAuthoredCalorimetryDraft(): Readonly<LabWorkflowDraftV2> {
  const blank = createBlankLabDraftV2();
  const scaffold = labWorkflowDraftV2Schema.parse({
    ...blank,
    id: CALORIMETRY_WORKFLOW_ID,
    sourceRequest:
      "Create a coffee-cup calorimetry lab that mixes equal hot and cold water and records the equilibrium temperature.",
    rubric: {
      ...blank.rubric,
      id: "rubric.hot_cold_water_calorimetry.v2",
      version: "2.0.0",
      title: "Hot/cold water calorimetry rubric"
    }
  });
  const result = applyLabDraftTransaction(
    scaffold,
    CALORIMETRY_AUTHORING_COMMANDS,
    scaffold.revision
  );
  if (!result.ok) {
    throw new Error(
      `Calorimetry command ${result.failingCommandIndex ?? "?"} failed: ${result.error.code} at ${result.error.path}: ${result.error.message}`
    );
  }
  return labWorkflowDraftV2Schema.parse({
    ...result.draft,
    requiredChemistryCapabilityIds: ["chemistry.thermal_energy.v1"],
    safetyPolicyIds: [
      "safety.virtual_calorimetry_ppe_notice.v1",
      "safety.virtual_solution_preparation_ppe_notice.v1"
    ],
    safetyBindings: [
      {
        safetyPolicyId: "safety.virtual_calorimetry_ppe_notice.v1",
        equipmentInstanceIds: ["calorimeter", "thermometer"],
        materialInstanceIds: ["cold_water", "hot_water"]
      },
      {
        safetyPolicyId: "safety.virtual_solution_preparation_ppe_notice.v1",
        equipmentInstanceIds: ["cold_bottle"],
        materialInstanceIds: []
      }
    ]
  });
}
