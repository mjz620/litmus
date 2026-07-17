import type { TitrationAction } from "../../experiments/titration/titration";
import { labWorkflowDraftSchema, type LabWorkflowDraft } from "../schema";

export const ENDPOINT_CONTROL_PRELAB_WORKFLOW_ID =
  "workflow.endpoint_control_prelab.seed.v1" as const;
export const ENDPOINT_CONTROL_PRELAB_VALIDATION_TIME =
  "2026-07-17T12:00:00Z" as const;
export const ENDPOINT_CONTROL_PRELAB_REPLAY_SESSION_SEED =
  "workflow.endpoint_control_prelab.seed.v1:replay" as const;
export const ENDPOINT_CONTROL_PRELAB_EXPECTED_HASH =
  "sha256:372b69f6855ce4fe2221f0b9ea839d3907f44f58701b7b938c7a28b7f36761c9" as const;

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

const draft: LabWorkflowDraft = {
  schemaVersion: "1.0.0",
  id: ENDPOINT_CONTROL_PRELAB_WORKFLOW_ID,
  revision: 1,
  sourceRequest:
    "Create a 7-minute acid-base titration pre-lab focused on endpoint control and meniscus reading.",
  metadata: {
    title: "Endpoint Control and Meniscus Reading",
    learningObjective:
      "Read a burette correctly and use dropwise delivery near the endpoint.",
    studentSummary:
      "Practice the final stage of a strong acid/strong base titration.",
    gradeBand: "mixed_high_school",
    estimatedMinutes: 7,
    difficulty: "intermediate",
    tags: ["pre-lab", "titration", "measurement"],
    accessibilityNotes: ["Keyboard-operable precision controls are available."],
    deviceProfileId: "device.chromebook_core.v1"
  },
  familyId: "family.acid_base_titration.v1",
  engineId: "engine.titration.v1",
  engineConfigId: "engine_config.titration.strong_acid_strong_base_25ml.v1",
  initializationPresetId: "seed.titration.near_endpoint_22ml.v1",
  skillIds: ["endpoint_control", "meniscus_reading"],
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
    },
    {
      instanceId: "indicator_source",
      componentId: "component.indicator_bottle.v1",
      configurationPresetId: "component_config.indicator_dropper.v1",
      role: "indicator_source",
      placementSlotId: "placement.indicator_shelf.v1",
      label: "Phenolphthalein",
      required: true
    }
  ],
  reagents: [
    {
      instanceId: "titrant",
      reagentId: "reagent.sodium_hydroxide_0_100m.v1",
      containerInstanceId: "titrant_burette",
      role: "titrant",
      requestedAmount: 50,
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
    },
    {
      instanceId: "indicator",
      reagentId: "reagent.phenolphthalein.v1",
      containerInstanceId: "indicator_source",
      role: "indicator",
      requestedAmount: 2,
      amountUnitId: "unit.drop.v1",
      displayLabel: "Phenolphthalein indicator"
    }
  ],
  steps: [
    {
      id: "read_initial_burette",
      order: 1,
      title: "Read the burette",
      studentInstruction:
        "At eye level, record the bottom of the concave meniscus.",
      rationaleForTeacher:
        "Establishes apparatus-appropriate reading before delivery.",
      skillIds: ["meniscus_reading"],
      componentInstanceIds: ["titrant_burette"],
      allowedActions: [
        {
          actionId: "action.read_volume.v1",
          actorComponentInstanceId: "titrant_burette",
          targetComponentInstanceIds: [],
          parameterPresetId: "action_params.burette_reading.v1",
          maxAttempts: 3
        }
      ],
      expectedObservations: [
        {
          id: "initial_meniscus_recorded",
          eventTypeId: "event.read_meniscus.v1",
          observationKeyId: "observation.reported_volume_ml.v1",
          expectation: "value_recorded",
          expectedValueSourceId: "observable.burette_reading_ml.v1",
          studentPrompt: "Record the burette reading to the correct precision.",
          requiredForCompletion: true
        }
      ],
      completionPolicyId: "completion.all_required_observations.v1",
      optional: false
    },
    {
      id: "approach_endpoint",
      order: 2,
      title: "Approach the endpoint",
      studentInstruction:
        "Add titrant slowly, switching to dropwise control near the endpoint.",
      rationaleForTeacher: "Produces direct endpoint-control evidence.",
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
    id: "rubric.endpoint_control_prelab.seed.v1",
    version: "1.0.0",
    title: "Endpoint-control pre-lab rubric",
    criteria: [
      {
        id: "meniscus",
        skillIds: ["meniscus_reading"],
        description:
          "Reads and records the bottom of the meniscus to burette precision.",
        maxPoints: 2,
        assessmentModeId: "assessment.event_plus_entry.v1",
        requiredEventTypeIds: ["event.read_meniscus.v1"],
        requiredObservationKeyIds: ["observation.reported_volume_ml.v1"],
        studentSubmissionFieldIds: ["submission.initial_burette_reading.v1"],
        scoringGuide: [
          "0: unsupported reading",
          "1: method or precision partly correct",
          "2: both correct"
        ]
      },
      {
        id: "endpoint",
        skillIds: ["endpoint_control"],
        description:
          "Uses controlled additions near endpoint without overshoot.",
        maxPoints: 3,
        assessmentModeId: "assessment.event_performance.v1",
        requiredEventTypeIds: ["event.add_titrant.v1"],
        requiredObservationKeyIds: ["observation.observed_color.v1"],
        studentSubmissionFieldIds: ["submission.endpoint_reflection.v1"],
        scoringGuide: [
          "0: major overshoot",
          "1: inconsistent control",
          "2: controlled with prompting",
          "3: controlled independently"
        ]
      }
    ],
    totalPoints: 5,
    passingPolicyId: "passing.percent_70.v1"
  },
  adaptiveRetries: [
    {
      id: "retry_endpoint",
      templateId: "retry.endpoint_control_near_endpoint.v1",
      targetSkillIds: ["endpoint_control"],
      eligibleFlagIds: [
        "flag.flow_rate_high_near_endpoint.v1",
        "flag.endpoint_overshoot.v1"
      ],
      seedTemplateId: "seed.titration.near_endpoint_22ml.v1",
      maxMinutes: 3,
      studentGoal: "Reach the endpoint using controlled dropwise additions.",
      successEvidenceReasonIds: [
        "evidence.controlled_addition_near_endpoint.v1"
      ]
    }
  ],
  safetyConstraints: [
    {
      id: "safety.virtual_titration_ppe_notice.v1",
      appliesToInstanceIds: [
        "titrant_burette",
        "analyte_flask",
        "indicator_source"
      ],
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

export const ENDPOINT_CONTROL_PRELAB_DRAFT = deepFreeze(
  labWorkflowDraftSchema.parse(draft)
);

export interface EndpointControlPrelabReplayAction {
  readonly workflowStepId: "approach_endpoint" | "read_initial_burette";
  readonly action: TitrationAction;
}

export const ENDPOINT_CONTROL_PRELAB_REPLAY_ACTIONS = deepFreeze([
  {
    workflowStepId: "read_initial_burette",
    action: { type: "read_meniscus", reportedML: 22 }
  },
  ...Array.from({ length: 6 }, () => ({
    workflowStepId: "approach_endpoint" as const,
    action: { type: "add_titrant" as const, volumeML: 0.5, durationS: 5 }
  })),
  {
    workflowStepId: "approach_endpoint",
    action: { type: "add_titrant", volumeML: 0.1, durationS: 1 }
  }
] satisfies EndpointControlPrelabReplayAction[]);
