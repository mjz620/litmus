import {
  applyLabDraftTransaction,
  type LabDraftCommand
} from "../../authoring";
import { createBlankLabDraftV2 } from "../blank-lab";
import {
  labWorkflowDraftV2Schema,
  type LabWorkflowDraftV2
} from "../../schema/v2";

export const FULL_TITRATION_WORKFLOW_ID =
  "workflow.acid_base_titration.full.v2" as const;

/**
 * The exact shared-domain command sequence a teacher would run in Composer to
 * produce the full titration. The shipped JSON must be reconstructible from
 * these commands, so the definition can never encode something the authoring
 * surface cannot express.
 *
 * Chemistry capabilities, safety, and the legacy compatibility descriptor are
 * applied after the transaction: the command layer has no verbs for them, the
 * same way the calorimetry definition post-sets its capabilities.
 */
export const FULL_TITRATION_AUTHORING_COMMANDS = Object.freeze([
  {
    type: "update_metadata",
    metadata: {
      title: "Acid\u2013Base Titration",
      learningObjective:
        "Carry out a full strong acid/strong base titration: condition and fill the burette, add an indicator, deliver titrant under control, and read the burette accurately.",
      studentSummary:
        "Start from a clean bench. Rinse and fill the burette, add your indicator, then titrate to the endpoint and record the volume delivered.",
      gradeBand: "mixed_high_school",
      estimatedMinutes: 20,
      difficulty: "intermediate",
      tags: ["titration", "volumetric analysis", "endpoint"],
      accessibilityNotes: [
        "Keyboard-operable precision controls are available."
      ],
      deviceProfileId: "device.chromebook_core.v1"
    }
  },
  { type: "add_objective", objectiveId: "burette_conditioning" },
  { type: "add_objective", objectiveId: "meniscus_reading" },
  { type: "add_objective", objectiveId: "endpoint_control" },
  {
    type: "add_equipment",
    equipment: {
      instanceId: "titrant_burette",
      equipmentDefinitionId: "component.burette.v1",
      configurationPresetId: "component_config.burette.50ml.v1",
      label: "Titrant burette",
      required: true
    }
  },
  {
    type: "add_equipment",
    equipment: {
      instanceId: "analyte_flask",
      equipmentDefinitionId: "component.erlenmeyer_flask.v1",
      configurationPresetId: "component_config.erlenmeyer.125ml.v1",
      label: "Analyte flask",
      required: true
    }
  },
  {
    type: "add_equipment",
    equipment: {
      instanceId: "indicator_source",
      equipmentDefinitionId: "component.indicator_bottle.v1",
      configurationPresetId: "component_config.indicator_dropper.v1",
      label: "Phenolphthalein",
      required: true
    }
  },
  {
    type: "add_equipment",
    equipment: {
      instanceId: "titrant_bottle",
      equipmentDefinitionId: "component.reagent_bottle.v1",
      configurationPresetId:
        "component_config.reagent_bottle.titrant_source.v1",
      label: "0.100 M sodium hydroxide",
      required: true
    }
  },
  {
    type: "set_layout",
    layout: {
      configurationSchemaId: "schema.layout_configuration.titration_bench.v1",
      placements: [
        {
          equipmentInstanceId: "titrant_burette",
          placementSlotId: "placement.bench_center_stand.v1"
        },
        {
          equipmentInstanceId: "analyte_flask",
          placementSlotId: "placement.under_burette.v1"
        },
        {
          equipmentInstanceId: "indicator_source",
          placementSlotId: "placement.indicator_shelf.v1"
        },
        {
          equipmentInstanceId: "titrant_bottle",
          placementSlotId: "placement.reagent_station.v1"
        }
      ]
    }
  },
  {
    type: "bind_material",
    binding: {
      instanceId: "titrant",
      materialProfileId: "reagent.sodium_hydroxide_0_100m.v1",
      containerInstanceId: "titrant_bottle",
      quantityPresetId: "quantity-preset.sodium_hydroxide_0_100m_50ml.v1"
    }
  },
  {
    type: "bind_material",
    binding: {
      instanceId: "analyte",
      materialProfileId: "reagent.hydrochloric_acid_0_100m.v1",
      containerInstanceId: "analyte_flask",
      quantityPresetId: "quantity-preset.hydrochloric_acid_0_100m_25ml.v1"
    }
  },
  {
    type: "bind_material",
    binding: {
      instanceId: "indicator",
      materialProfileId: "reagent.phenolphthalein.v1",
      containerInstanceId: "indicator_source",
      quantityPresetId: "quantity-preset.phenolphthalein_2_drops.v1"
    }
  },
  {
    type: "add_rule",
    rule: {
      id: "rule.burette_conditioned",
      kind: "required",
      condition: {
        kind: "action_observed",
        actionId: "action.rinse.v1",
        sourceEquipmentInstanceId: "titrant_bottle",
        targetEquipmentInstanceIds: ["titrant_burette"]
      },
      severity: "procedural",
      recoverable: true,
      terminal: false,
      objectiveIds: ["burette_conditioning"]
    }
  },
  {
    type: "add_rule",
    rule: {
      id: "rule.burette_filled",
      kind: "required",
      condition: {
        kind: "action_observed",
        actionId: "action.fill.v1",
        sourceEquipmentInstanceId: "titrant_bottle",
        targetEquipmentInstanceIds: ["titrant_burette"]
      },
      severity: "procedural",
      recoverable: true,
      terminal: false,
      objectiveIds: ["burette_conditioning"]
    }
  },
  {
    type: "add_rule",
    rule: {
      id: "rule.indicator_added",
      kind: "required",
      condition: {
        kind: "action_observed",
        actionId: "action.add_indicator.v1",
        sourceEquipmentInstanceId: "analyte_flask",
        targetEquipmentInstanceIds: ["analyte_flask"]
      },
      severity: "procedural",
      recoverable: true,
      terminal: false,
      objectiveIds: ["endpoint_control"]
    }
  },
  {
    type: "add_rule",
    rule: {
      id: "rule.initial_reading",
      kind: "required",
      condition: {
        kind: "observation_recorded",
        observationKeyId: "observation.reported_volume_ml.v1",
        eventTypeId: "event.read_meniscus.v1",
        expectedValueSourceId: "observable.burette_reading_ml.v1"
      },
      severity: "procedural",
      recoverable: true,
      terminal: false,
      objectiveIds: ["meniscus_reading"]
    }
  },
  {
    type: "add_rule",
    rule: {
      id: "rule.controlled_delivery",
      kind: "required",
      condition: {
        kind: "event_flag",
        flagId: "flag.endpoint_overshoot.v1",
        presence: "absent",
        eventTypeId: "event.add_titrant.v1"
      },
      severity: "procedural",
      recoverable: true,
      terminal: false,
      objectiveIds: ["endpoint_control"]
    }
  },
  {
    type: "add_rule",
    rule: {
      id: "rule.condition_before_fill",
      kind: "ordering",
      condition: {
        kind: "rule_satisfied_before",
        predecessorRuleId: "rule.burette_conditioned",
        successorRuleId: "rule.burette_filled"
      },
      severity: "procedural",
      recoverable: true,
      terminal: false,
      objectiveIds: ["burette_conditioning"]
    }
  },
  {
    type: "add_rule",
    rule: {
      id: "rule.fill_before_reading",
      kind: "ordering",
      condition: {
        kind: "rule_satisfied_before",
        predecessorRuleId: "rule.burette_filled",
        successorRuleId: "rule.initial_reading"
      },
      severity: "procedural",
      recoverable: true,
      terminal: false,
      objectiveIds: ["meniscus_reading"]
    }
  },
  {
    type: "add_rule",
    rule: {
      id: "rule.endpoint_reached",
      kind: "success",
      condition: {
        kind: "registered_completion_policy_satisfied",
        completionPolicyId: "completion.engine_endpoint_observed.v1",
        evidenceRuleIds: [
          "rule.burette_conditioned",
          "rule.burette_filled",
          "rule.indicator_added",
          "rule.initial_reading",
          "rule.controlled_delivery"
        ]
      },
      severity: "procedural",
      recoverable: true,
      terminal: false,
      objectiveIds: ["endpoint_control"]
    }
  },
  {
    type: "permit_action",
    action: {
      id: "permission.condition_burette",
      actionId: "action.rinse.v1",
      sourceEquipmentInstanceId: "titrant_bottle",
      targetEquipmentInstanceIds: ["titrant_burette"],
      maxAttempts: 5,
      availability: {
        allSatisfiedRuleIds: [],
        allUnsatisfiedRuleIds: ["rule.burette_filled"]
      }
    }
  },
  {
    type: "permit_action",
    action: {
      id: "permission.fill_burette",
      actionId: "action.fill.v1",
      sourceEquipmentInstanceId: "titrant_bottle",
      targetEquipmentInstanceIds: ["titrant_burette"],
      maxAttempts: 5,
      availability: {
        allSatisfiedRuleIds: ["rule.burette_conditioned"],
        allUnsatisfiedRuleIds: []
      }
    }
  },
  {
    type: "permit_action",
    action: {
      id: "permission.add_indicator",
      actionId: "action.add_indicator.v1",
      sourceEquipmentInstanceId: "analyte_flask",
      targetEquipmentInstanceIds: ["analyte_flask"],
      maxAttempts: 3,
      availability: {
        allSatisfiedRuleIds: [],
        allUnsatisfiedRuleIds: ["rule.indicator_added"]
      }
    }
  },
  {
    type: "permit_action",
    action: {
      id: "permission.read_burette",
      actionId: "action.read_volume.v1",
      sourceEquipmentInstanceId: "titrant_burette",
      targetEquipmentInstanceIds: [],
      parameterPresetId: "action_params.burette_reading.v1",
      maxAttempts: 10,
      availability: {
        allSatisfiedRuleIds: ["rule.burette_filled"],
        allUnsatisfiedRuleIds: []
      }
    }
  },
  {
    type: "permit_action",
    action: {
      id: "permission.dispense",
      actionId: "action.dispense.v1",
      sourceEquipmentInstanceId: "titrant_burette",
      targetEquipmentInstanceIds: ["analyte_flask"],
      parameterPresetId: "action_params.titration_dropwise_or_slow.v1",
      authoredLimits: {
        maxVolumeMLPerAction: 0.5
      },
      maxAttempts: 200,
      availability: {
        allSatisfiedRuleIds: ["rule.indicator_added", "rule.initial_reading"],
        allUnsatisfiedRuleIds: ["rule.endpoint_reached"]
      }
    }
  },
  {
    type: "add_instruction",
    instruction: {
      id: "prepare_burette",
      title: "Condition and fill the burette",
      guidance:
        "Rinse the burette with titrant so no water dilutes it, then fill above the zero mark and run the tip clear of air.",
      relatedRuleIds: [
        "rule.burette_conditioned",
        "rule.burette_filled",
        "rule.condition_before_fill"
      ]
    }
  },
  {
    type: "add_instruction",
    instruction: {
      id: "add_indicator",
      title: "Add the indicator",
      guidance:
        "Choose an indicator whose transition range brackets the equivalence pH, then add it to the flask.",
      relatedRuleIds: ["rule.indicator_added"]
    }
  },
  {
    type: "add_instruction",
    instruction: {
      id: "read_initial_burette",
      title: "Read the burette",
      guidance:
        "At eye level, record the bottom of the concave meniscus before delivering any titrant.",
      relatedRuleIds: ["rule.initial_reading", "rule.fill_before_reading"]
    }
  },
  {
    type: "add_instruction",
    instruction: {
      id: "approach_endpoint",
      title: "Titrate to the endpoint",
      guidance:
        "Add titrant steadily while swirling, switching to dropwise control as the colour starts to persist.",
      relatedRuleIds: ["rule.controlled_delivery", "rule.endpoint_reached"]
    }
  },
  {
    type: "add_rubric_criterion",
    criterion: {
      id: "criterion.preparation",
      objectiveIds: ["burette_conditioning"],
      ruleIds: [
        "rule.burette_conditioned",
        "rule.burette_filled",
        "rule.condition_before_fill"
      ],
      description: "Conditions the burette with titrant before filling it.",
      maxPoints: 4,
      scoringGuide: [
        "0: burette never prepared",
        "2: filled without conditioning",
        "4: conditioned then filled"
      ],
      assessmentModeId: "assessment.event_performance.v1",
      evidenceMappings: [
        {
          kind: "rule_diagnosis",
          ruleId: "rule.burette_conditioned",
          required: true
        }
      ]
    }
  },
  {
    type: "add_rubric_criterion",
    criterion: {
      id: "criterion.meniscus",
      objectiveIds: ["meniscus_reading"],
      ruleIds: ["rule.initial_reading", "rule.fill_before_reading"],
      description:
        "Reads and records the bottom of the meniscus to burette precision.",
      maxPoints: 3,
      scoringGuide: [
        "0: no reading recorded",
        "3: reading recorded to burette precision"
      ],
      assessmentModeId: "assessment.event_plus_entry.v1",
      evidenceMappings: [
        {
          kind: "semantic_event",
          eventTypeId: "event.read_meniscus.v1",
          required: true
        },
        {
          kind: "semantic_event_observation",
          observationKeyId: "observation.reported_volume_ml.v1",
          required: true
        }
      ]
    }
  },
  {
    type: "add_rubric_criterion",
    criterion: {
      id: "criterion.endpoint",
      objectiveIds: ["endpoint_control"],
      ruleIds: [
        "rule.indicator_added",
        "rule.controlled_delivery",
        "rule.endpoint_reached"
      ],
      description:
        "Adds an indicator and reaches the endpoint without overshooting.",
      maxPoints: 5,
      scoringGuide: [
        "0: endpoint not reached",
        "3: endpoint reached with overshoot",
        "5: endpoint reached under dropwise control"
      ],
      assessmentModeId: "assessment.event_performance.v1",
      evidenceMappings: [
        {
          kind: "semantic_event",
          eventTypeId: "event.add_titrant.v1",
          required: true
        }
      ]
    }
  }
] as const satisfies readonly LabDraftCommand[]) as readonly LabDraftCommand[];

export function createAuthoredFullTitrationDraft(): Readonly<LabWorkflowDraftV2> {
  const blank = createBlankLabDraftV2();
  const scaffold = labWorkflowDraftV2Schema.parse({
    ...blank,
    id: FULL_TITRATION_WORKFLOW_ID,
    sourceRequest:
      "Create a complete strong acid/strong base titration starting from a clean bench: condition and fill the burette, add an indicator, titrate to the endpoint, and record the final reading.",
    rubric: {
      ...blank.rubric,
      id: "rubric.acid_base_titration.full.v2",
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
      `Full titration command ${result.failingCommandIndex ?? "?"} failed: ${result.error.code} at ${result.error.path}: ${result.error.message}`
    );
  }
  return labWorkflowDraftV2Schema.parse({
    ...result.draft,
    catalog: {
      familyId: "family.acid_base_titration.v1"
    },
    /*
     * Retry policy is retained from the migrated drill on purpose: a student
     * who overshoots the endpoint here is offered the endpoint-control
     * practice, which is what that mid-procedure definition exists for.
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
      "chemistry.indicator_response.v1",
      "chemistry.instrument_observables.v1"
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
    ],
    compatibility: {
      kind: "legacy_v1",
      runtimeAdapterId: "runtime-adapter.titration.v1",
      runtimeAdapterVersion: "1.0.0",
      engineId: "engine.titration.v1",
      engineConfigurationPresetId:
        "engine_config.titration.strong_acid_strong_base_25ml.v1",
      initializationPresetId: "seed.titration.fresh_bench.v1",
      equipmentRoleBindings: [
        {
          equipmentInstanceId: "titrant_burette",
          legacyRoleId: "titrant_delivery"
        },
        {
          equipmentInstanceId: "analyte_flask",
          legacyRoleId: "reaction_vessel"
        },
        {
          equipmentInstanceId: "indicator_source",
          legacyRoleId: "indicator_source"
        },
        {
          equipmentInstanceId: "titrant_bottle",
          legacyRoleId: "titrant_source"
        }
      ],
      materialRoleBindings: [
        {
          materialInstanceId: "titrant",
          legacyRoleId: "titrant"
        },
        {
          materialInstanceId: "analyte",
          legacyRoleId: "analyte"
        },
        {
          materialInstanceId: "indicator",
          legacyRoleId: "indicator"
        }
      ]
    }
  });
}
