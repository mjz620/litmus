import {
  migrateLabWorkflowV1ToV2,
  type LabWorkflowDraftV2
} from "../../../src/lab-workflows";
import { ENDPOINT_CONTROL_PRELAB_DRAFT } from "../../../src/lab-workflows/seeds";

/**
 * Small production-registry fixture for v2 hard-validation tests.
 *
 * It intentionally requires no chemistry model and carries no legacy runtime
 * compatibility descriptor. The fixture describes only a verified burette
 * reading mechanic, so tests can isolate validator behavior without inventing
 * model, adapter, material, or family IDs.
 */
export function createRunnableMechanicalV2Draft(): LabWorkflowDraftV2 {
  return {
    schemaVersion: "2.0.0",
    id: "workflow.meniscus_reading.validation_fixture.v2",
    revision: 1,
    sourceRequest:
      "Create a short mechanical lab that records one verified burette reading.",
    metadata: {
      title: "Burette reading check",
      learningObjective:
        "Read the bottom of a burette meniscus and record the value.",
      studentSummary:
        "Use the burette reading control to record one precise measurement.",
      gradeBand: "mixed_high_school",
      estimatedMinutes: 5,
      difficulty: "intro",
      tags: ["measurement", "meniscus"],
      accessibilityNotes: [
        "The reading control is keyboard operable and does not rely on color."
      ],
      deviceProfileId: "device.chromebook_core.v1"
    },
    objectiveIds: ["meniscus_reading"],
    equipment: [
      {
        instanceId: "measurement_burette",
        equipmentDefinitionId: "component.burette.v1",
        configurationPresetId: "component_config.burette.50ml.v1",
        label: "Measurement burette",
        required: true
      }
    ],
    materials: [],
    layout: {
      configurationSchemaId: "schema.layout_configuration.titration_bench.v1",
      placements: [
        {
          equipmentInstanceId: "measurement_burette",
          placementSlotId: "placement.bench_center_stand.v1"
        }
      ]
    },
    requiredChemistryCapabilityIds: [],
    permittedActions: [
      {
        id: "permission.read_measurement_burette",
        actionId: "action.read_volume.v1",
        sourceEquipmentInstanceId: "measurement_burette",
        targetEquipmentInstanceIds: [],
        parameterPresetId: "action_params.burette_reading.v1",
        maxAttempts: 3,
        availability: {
          allSatisfiedRuleIds: [],
          allUnsatisfiedRuleIds: ["rule.workflow_complete"]
        }
      }
    ],
    rules: [
      {
        id: "rule.meniscus_observed",
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
      },
      {
        id: "rule.workflow_complete",
        kind: "success",
        condition: {
          kind: "registered_completion_policy_satisfied",
          completionPolicyId: "completion.all_required_observations.v1",
          evidenceRuleIds: ["rule.meniscus_observed"]
        },
        severity: "procedural",
        recoverable: true,
        terminal: false,
        objectiveIds: ["meniscus_reading"]
      },
      {
        id: "rule.score_reading_event",
        kind: "scoring",
        condition: {
          kind: "semantic_event_observed",
          eventTypeId: "event.read_meniscus.v1"
        },
        severity: "info",
        recoverable: true,
        terminal: false,
        objectiveIds: ["meniscus_reading"]
      }
    ],
    instructions: [
      {
        id: "instruction.read_burette",
        title: "Read the burette",
        guidance: "At eye level, record the bottom of the concave meniscus.",
        relatedRuleIds: ["rule.meniscus_observed", "rule.workflow_complete"]
      }
    ],
    coachPolicy: {
      triggers: [],
      adaptiveRetries: []
    },
    rubric: {
      id: "rubric.meniscus_reading.validation_fixture.v2",
      version: "2.0.0",
      title: "Burette reading rubric",
      criteria: [
        {
          id: "criterion.reading_event",
          objectiveIds: ["meniscus_reading"],
          ruleIds: ["rule.score_reading_event"],
          description: "Records a burette reading through the verified action.",
          maxPoints: 2,
          assessmentModeId: "assessment.event_plus_entry.v1",
          evidenceMappings: [
            {
              kind: "semantic_event",
              eventTypeId: "event.read_meniscus.v1",
              required: true
            }
          ],
          scoringGuide: [
            "0: no supported reading event",
            "2: supported reading event recorded"
          ]
        }
      ],
      totalPoints: 2,
      passingPolicyId: "passing.percent_70.v1"
    },
    safetyPolicyIds: ["safety.virtual_titration_ppe_notice.v1"],
    safetyBindings: [
      {
        safetyPolicyId: "safety.virtual_titration_ppe_notice.v1",
        equipmentInstanceIds: ["measurement_burette"],
        materialInstanceIds: []
      }
    ],
    presentation: {
      instructionGuidance: [
        {
          instructionId: "instruction.read_burette",
          teacherRationale:
            "Produces deterministic evidence of apparatus-appropriate reading.",
          equipmentInstanceIds: ["measurement_burette"]
        }
      ],
      materialLabels: [],
      rulePrompts: [
        {
          ruleId: "rule.meniscus_observed",
          studentPrompt: "Record the burette reading to the correct precision."
        }
      ]
    },
    supportStatus: "draft_unvalidated",
    validation: null,
    judgeCritique: null
  };
}

/** Chemistry-free water transfer used to prove the generic material pipeline. */
export function createRunnableLiquidTransferV2Draft(): LabWorkflowDraftV2 {
  return {
    schemaVersion: "2.0.0",
    id: "workflow.water_transfer.validation_fixture.v2",
    revision: 1,
    sourceRequest: "Practice a bounded liquid transfer into a burette.",
    metadata: {
      title: "Water transfer check",
      learningObjective: "Transfer a bounded liquid volume into a burette.",
      studentSummary: "Fill the burette from the registered water source.",
      gradeBand: "mixed_high_school",
      estimatedMinutes: 5,
      difficulty: "intro",
      tags: ["measurement", "transfer"],
      accessibilityNotes: ["The fill control is keyboard operable."],
      deviceProfileId: "device.chromebook_core.v1"
    },
    objectiveIds: ["burette_conditioning"],
    equipment: [
      {
        instanceId: "water_source",
        equipmentDefinitionId: "component.reagent_bottle.v1",
        configurationPresetId:
          "component_config.reagent_bottle.titrant_source.v1",
        label: "Distilled water source",
        required: true
      },
      {
        instanceId: "transfer_burette",
        equipmentDefinitionId: "component.burette.v1",
        configurationPresetId: "component_config.burette.50ml.v1",
        label: "Transfer burette",
        required: true
      }
    ],
    materials: [
      {
        instanceId: "material.water",
        materialProfileId: "reagent.distilled_water.v1",
        containerInstanceId: "water_source",
        quantityPresetId: "quantity-preset.distilled_water_50ml.v1"
      }
    ],
    layout: {
      configurationSchemaId: "schema.layout_configuration.titration_bench.v1",
      placements: [
        {
          equipmentInstanceId: "water_source",
          placementSlotId: "placement.reagent_station.v1"
        },
        {
          equipmentInstanceId: "transfer_burette",
          placementSlotId: "placement.bench_center_stand.v1"
        }
      ]
    },
    requiredChemistryCapabilityIds: [],
    permittedActions: [
      {
        id: "permission.fill_transfer_burette",
        actionId: "action.fill.v1",
        sourceEquipmentInstanceId: "water_source",
        targetEquipmentInstanceIds: ["transfer_burette"],
        maxAttempts: 2,
        availability: {
          allSatisfiedRuleIds: [],
          allUnsatisfiedRuleIds: ["rule.workflow_complete"]
        }
      }
    ],
    rules: [
      {
        id: "rule.fill_observed",
        kind: "required",
        condition: {
          kind: "action_observed",
          actionId: "action.fill.v1",
          sourceEquipmentInstanceId: "water_source",
          targetEquipmentInstanceIds: ["transfer_burette"]
        },
        severity: "procedural",
        recoverable: true,
        terminal: false,
        objectiveIds: ["burette_conditioning"]
      },
      {
        id: "rule.workflow_complete",
        kind: "success",
        condition: {
          kind: "registered_completion_policy_satisfied",
          completionPolicyId: "completion.all_required_observations.v1",
          evidenceRuleIds: ["rule.fill_observed"]
        },
        severity: "procedural",
        recoverable: true,
        terminal: false,
        objectiveIds: ["burette_conditioning"]
      },
      {
        id: "rule.score_fill",
        kind: "scoring",
        condition: {
          kind: "action_observed",
          actionId: "action.fill.v1",
          sourceEquipmentInstanceId: "water_source",
          targetEquipmentInstanceIds: ["transfer_burette"]
        },
        severity: "info",
        recoverable: true,
        terminal: false,
        objectiveIds: ["burette_conditioning"],
        points: 2
      }
    ],
    instructions: [
      {
        id: "instruction.fill",
        title: "Fill the burette",
        guidance: "Transfer a bounded volume from the registered source.",
        relatedRuleIds: ["rule.fill_observed", "rule.workflow_complete"]
      }
    ],
    coachPolicy: { triggers: [], adaptiveRetries: [] },
    rubric: {
      id: "rubric.water_transfer.validation_fixture.v2",
      version: "2.0.0",
      title: "Water transfer rubric",
      criteria: [
        {
          id: "criterion.fill",
          objectiveIds: ["burette_conditioning"],
          ruleIds: ["rule.score_fill"],
          description: "Executes the bounded fill action.",
          maxPoints: 2,
          assessmentModeId: "assessment.event_performance.v1",
          evidenceMappings: [
            {
              kind: "rule_diagnosis",
              ruleId: "rule.score_fill",
              required: true
            }
          ],
          scoringGuide: ["0: no fill", "2: bounded fill completed"]
        }
      ],
      totalPoints: 2,
      passingPolicyId: "passing.percent_70.v1"
    },
    safetyPolicyIds: ["safety.virtual_titration_ppe_notice.v1"],
    safetyBindings: [
      {
        safetyPolicyId: "safety.virtual_titration_ppe_notice.v1",
        equipmentInstanceIds: ["water_source", "transfer_burette"],
        materialInstanceIds: []
      }
    ],
    presentation: {
      instructionGuidance: [
        {
          instructionId: "instruction.fill",
          teacherRationale: "Produces deterministic liquid-transfer evidence.",
          equipmentInstanceIds: ["water_source", "transfer_burette"]
        }
      ],
      materialLabels: [
        {
          materialInstanceId: "material.water",
          displayLabel: "Distilled water"
        }
      ],
      rulePrompts: [
        {
          ruleId: "rule.fill_observed",
          studentPrompt: "Transfer water into the burette."
        }
      ]
    },
    supportStatus: "draft_unvalidated",
    validation: null,
    judgeCritique: null
  };
}

/** Returns the deterministic canonical v1 migration used by v2 validator tests. */
export function createMigratedEndpointV2Draft(): LabWorkflowDraftV2 {
  return migrateLabWorkflowV1ToV2(ENDPOINT_CONTROL_PRELAB_DRAFT);
}
