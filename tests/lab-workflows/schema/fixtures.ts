import type { LabWorkflowDraft } from "../../../src/lab-workflows";

export function createSchemaValidWorkflowDraft(): LabWorkflowDraft {
  return {
    schemaVersion: "1.0.0",
    id: "workflow.endpoint_control.schema_fixture.v1",
    revision: 1,
    sourceRequest:
      "Create a short titration pre-lab focused on endpoint control.",
    metadata: {
      title: "Endpoint control",
      learningObjective: "Use controlled additions near a titration endpoint.",
      studentSummary: "Practice careful titrant delivery near the endpoint.",
      gradeBand: "mixed_high_school",
      estimatedMinutes: 7,
      difficulty: "intermediate",
      tags: ["pre-lab", "titration"],
      accessibilityNotes: [
        "Color observations are paired with text descriptions."
      ],
      deviceProfileId: "device.chromebook_core.v1"
    },
    familyId: "family.acid_base_titration.v1",
    engineId: "engine.titration.v1",
    engineConfigId: "engine_config.titration.strong_acid_strong_base_25ml.v1",
    initializationPresetId: "seed.titration.near_endpoint_22ml.v1",
    skillIds: ["endpoint_control"],
    components: [
      {
        instanceId: "titrant_burette",
        componentId: "component.burette.v1",
        configurationPresetId: "component_config.burette.50ml.v1",
        role: "titrant_delivery",
        placementSlotId: "placement.bench_center_stand.v1",
        label: "Titrant burette",
        required: true
      },
      {
        instanceId: "analyte_flask",
        componentId: "component.erlenmeyer_flask.v1",
        configurationPresetId: "component_config.erlenmeyer.125ml.v1",
        role: "reaction_vessel",
        placementSlotId: "placement.under_burette.v1",
        label: "Analyte flask",
        required: true
      }
    ],
    reagents: [
      {
        instanceId: "titrant",
        reagentId: "reagent.sodium_hydroxide_0_100m.v1",
        containerInstanceId: "titrant_burette",
        role: "titrant",
        requestedAmount: 25,
        amountUnitId: "unit.ml.v1",
        displayLabel: "0.100 M sodium hydroxide"
      },
      {
        instanceId: "analyte",
        reagentId: "reagent.hydrochloric_acid_0_100m.v1",
        containerInstanceId: "analyte_flask",
        role: "analyte",
        requestedAmount: 25,
        amountUnitId: "unit.ml.v1",
        displayLabel: "0.100 M hydrochloric acid"
      }
    ],
    steps: [
      {
        id: "approach_endpoint",
        order: 1,
        title: "Approach the endpoint",
        studentInstruction:
          "Deliver titrant slowly and stop at the first persistent endpoint color.",
        rationaleForTeacher:
          "The step produces direct evidence of endpoint control.",
        skillIds: ["endpoint_control"],
        componentInstanceIds: ["titrant_burette", "analyte_flask"],
        allowedActions: [
          {
            actionId: "action.dispense.v1",
            actorComponentInstanceId: "titrant_burette",
            targetComponentInstanceIds: ["analyte_flask"],
            parameterPresetId: "action_params.titration_dropwise_or_slow.v1",
            authoredLimits: { maxVolumeMLPerAction: 0.5 },
            maxAttempts: 20
          }
        ],
        expectedObservations: [
          {
            id: "controlled_endpoint_addition",
            eventTypeId: "event.add_titrant.v1",
            flagId: "flag.endpoint_overshoot.v1",
            expectation: "flag_absent",
            studentPrompt: "Stop at the first persistent endpoint color.",
            requiredForCompletion: true
          }
        ],
        completionPolicyId: "completion.engine_endpoint_observed.v1",
        optional: false
      }
    ],
    coachTriggers: [
      {
        id: "coach_high_flow",
        skillId: "endpoint_control",
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
    rubric: {
      id: "rubric.endpoint_control.schema_fixture.v1",
      version: "1.0.0",
      title: "Endpoint-control rubric",
      criteria: [
        {
          id: "endpoint",
          skillIds: ["endpoint_control"],
          description: "Uses controlled additions without overshooting.",
          maxPoints: 3,
          assessmentModeId: "assessment.event_performance.v1",
          requiredEventTypeIds: ["event.add_titrant.v1"],
          requiredObservationKeyIds: ["observation.observed_color.v1"],
          studentSubmissionFieldIds: ["submission.endpoint_reflection.v1"],
          scoringGuide: ["0: unsupported", "3: controlled endpoint"]
        }
      ],
      totalPoints: 3,
      passingPolicyId: "passing.percent_70.v1"
    },
    adaptiveRetries: [
      {
        id: "retry_endpoint_control",
        templateId: "retry.endpoint_control_near_endpoint.v1",
        targetSkillIds: ["endpoint_control"],
        eligibleFlagIds: [
          "flag.flow_rate_high_near_endpoint.v1",
          "flag.endpoint_overshoot.v1"
        ],
        seedTemplateId: "seed.titration.near_endpoint_22ml.v1",
        maxMinutes: 3,
        studentGoal: "Reach the endpoint with controlled additions.",
        successEvidenceReasonIds: [
          "evidence.controlled_addition_near_endpoint.v1"
        ]
      }
    ],
    safetyConstraints: [
      {
        id: "safety.virtual_titration_ppe_notice.v1",
        appliesToInstanceIds: ["titrant_burette", "analyte_flask"],
        severity: "required",
        studentFacingText:
          "Wear assigned PPE and follow teacher instructions in a physical lab.",
        teacherFacingText:
          "Virtual completion does not replace local lab safety instruction."
      }
    ],
    supportStatus: "draft_unvalidated",
    validation: null,
    judgeCritique: null
  };
}
