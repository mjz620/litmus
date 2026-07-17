# Lab Workflow Schema

> **Version note:** This document describes implemented `LabWorkflowSpec`
> `1.0.0`, where one family/engine and ordered steps are mandatory. Keep it as
> the v1 compatibility contract. The proposed v2 evolution, migration rules,
> and exact implementation tickets are in the
> [`capability contract blueprint`](../lab-composer/contract-blueprint.md) and
> [`LC2 Phase 1`](../lab-composer/tickets/phase-1-contracts.md).

## Contract goals

`LabWorkflowSpec` is a versioned data contract for a lesson assembled over one verified deterministic experiment family. It is not executable code and cannot define chemistry formulas, arbitrary component physics, new actions, or safety policy.

Every generated reference must resolve by exact registry ID before runtime. Preview and assignment require a validator-produced `runnable` result whose canonical spec hash matches the current spec.

## Field provenance legend

Every interface field below is marked with one or more owners:

- **`[AI-authored]`** — proposed by an LLM within schema/registry limits.
- **`[registry-backed]`** — an exact ID/value must resolve through a versioned registry.
- **`[deterministic-runtime-owned]`** — supplied, normalized, or consumed by deterministic application/engine code; not freeform LLM truth.
- **`[teacher-editable]`** — a teacher may edit it, followed by mandatory revalidation.
- **`[derived-by-validator]`** — only the hard validator may set the authoritative value.

Tags can combine. For example, an AI may select a component ID and a teacher may change it, but the exact value remains registry-backed and validator-checked.

## Core interfaces

```ts
type RegistryId = string;
type IsoDateTime = string;

export type WorkflowSupportStatus =
  | "draft_unvalidated" // [deterministic-runtime-owned]
  | "runnable" // [derived-by-validator]
  | "partially_supported" // [derived-by-validator]
  | "unsupported" // [derived-by-validator]
  | "rejected_for_safety"; // [derived-by-validator]

export interface LabWorkflowSpec {
  schemaVersion: "1.0.0"; // [registry-backed; deterministic-runtime-owned]
  id: string; // [deterministic-runtime-owned]
  revision: number; // [deterministic-runtime-owned]
  sourceRequest: string; // [teacher-editable]
  metadata: LabMetadata; // [AI-authored; teacher-editable]
  familyId: RegistryId; // [AI-authored; registry-backed; teacher-editable]
  engineId: RegistryId; // [AI-authored; registry-backed; teacher-editable]
  engineConfigId: RegistryId; // [AI-authored; registry-backed; teacher-editable]
  initializationPresetId: RegistryId; // [AI-authored; registry-backed; teacher-editable]
  skillIds: RegistryId[]; // [AI-authored; registry-backed; teacher-editable]
  components: LabComponentInstance[]; // [AI-authored; registry-backed; teacher-editable]
  reagents: LabReagentSpec[]; // [AI-authored; registry-backed; teacher-editable]
  steps: LabWorkflowStep[]; // [AI-authored; registry-backed; teacher-editable]
  coachTriggers: CoachTriggerSpec[]; // [AI-authored; registry-backed; teacher-editable]
  rubric: RubricSpec; // [AI-authored; registry-backed; teacher-editable]
  adaptiveRetries: AdaptiveRetryTemplate[]; // [AI-authored; registry-backed; teacher-editable]
  safetyConstraints: SafetyConstraint[]; // [registry-backed; deterministic-runtime-owned]
  supportStatus: WorkflowSupportStatus; // [deterministic-runtime-owned; derived-by-validator]
  validation: ValidationResult | null; // [derived-by-validator]
  judgeCritique: JudgeCritique | null; // [AI-authored]
}

export interface LabMetadata {
  title: string; // [AI-authored; teacher-editable]
  learningObjective: string; // [AI-authored; teacher-editable]
  studentSummary: string; // [AI-authored; teacher-editable]
  gradeBand: "9-10" | "11-12" | "mixed_high_school"; // [AI-authored; teacher-editable]
  estimatedMinutes: number; // [AI-authored; teacher-editable]
  difficulty: "intro" | "intermediate" | "advanced"; // [AI-authored; teacher-editable]
  tags: string[]; // [AI-authored; teacher-editable]
  accessibilityNotes: string[]; // [AI-authored; teacher-editable]
  deviceProfileId: RegistryId; // [AI-authored; registry-backed; teacher-editable]
}

export interface LabComponentInstance {
  instanceId: string; // [AI-authored; teacher-editable]
  componentId: RegistryId; // [AI-authored; registry-backed; teacher-editable]
  configurationPresetId: RegistryId; // [AI-authored; registry-backed; teacher-editable]
  role: string; // [AI-authored; registry-backed; teacher-editable]
  placementSlotId: RegistryId; // [AI-authored; registry-backed; teacher-editable]
  label: string; // [AI-authored; teacher-editable]
  required: boolean; // [AI-authored; teacher-editable]
}

export interface LabReagentSpec {
  instanceId: string; // [AI-authored; teacher-editable]
  reagentId: RegistryId; // [AI-authored; registry-backed; teacher-editable]
  containerInstanceId: string; // [AI-authored; teacher-editable]
  role: string; // [AI-authored; registry-backed; teacher-editable]
  requestedAmount: number; // [AI-authored; teacher-editable]
  amountUnitId: RegistryId; // [AI-authored; registry-backed; teacher-editable]
  displayLabel: string; // [registry-backed; deterministic-runtime-owned]
}

export interface LabWorkflowStep {
  id: string; // [AI-authored; teacher-editable]
  order: number; // [AI-authored; teacher-editable]
  title: string; // [AI-authored; teacher-editable]
  studentInstruction: string; // [AI-authored; teacher-editable]
  rationaleForTeacher: string; // [AI-authored; teacher-editable]
  skillIds: RegistryId[]; // [AI-authored; registry-backed; teacher-editable]
  componentInstanceIds: string[]; // [AI-authored; teacher-editable]
  allowedActions: AllowedActionSpec[]; // [AI-authored; registry-backed; teacher-editable]
  expectedObservations: ExpectedObservation[]; // [AI-authored; registry-backed; teacher-editable]
  completionPolicyId: RegistryId; // [AI-authored; registry-backed; teacher-editable]
  optional: boolean; // [AI-authored; teacher-editable]
}

export interface AllowedActionSpec {
  actionId: RegistryId; // [AI-authored; registry-backed; teacher-editable]
  actorComponentInstanceId: string; // [AI-authored; teacher-editable]
  targetComponentInstanceIds: string[]; // [AI-authored; teacher-editable]
  parameterPresetId: RegistryId; // [AI-authored; registry-backed; teacher-editable]
  authoredLimits?: Record<string, number>; // [AI-authored; teacher-editable]
  maxAttempts?: number; // [AI-authored; teacher-editable]
}

export interface ExpectedObservation {
  id: string; // [AI-authored; teacher-editable]
  eventTypeId: RegistryId; // [AI-authored; registry-backed; teacher-editable]
  observationKeyId?: RegistryId; // [AI-authored; registry-backed; teacher-editable]
  flagId?: RegistryId; // [AI-authored; registry-backed; teacher-editable]
  expectation: "event_present" | "flag_present" | "flag_absent" | "value_recorded"; // [AI-authored; teacher-editable]
  expectedValueSourceId?: RegistryId; // [registry-backed; deterministic-runtime-owned]
  studentPrompt: string; // [AI-authored; teacher-editable]
  requiredForCompletion: boolean; // [AI-authored; teacher-editable]
}

export interface CoachTriggerSpec {
  id: string; // [AI-authored; teacher-editable]
  skillId: RegistryId; // [AI-authored; registry-backed; teacher-editable]
  eventTypeIds: RegistryId[]; // [AI-authored; registry-backed; teacher-editable]
  flagIds: RegistryId[]; // [AI-authored; registry-backed; teacher-editable]
  triggerTypeId: RegistryId; // [AI-authored; registry-backed; teacher-editable]
  hintStrategyId: RegistryId; // [AI-authored; registry-backed; teacher-editable]
  maxHintLevel: 0 | 1 | 2 | 3; // [AI-authored; teacher-editable]
  cooldownEventCount: number; // [AI-authored; teacher-editable]
  staySilentOnEventReasonIds: RegistryId[]; // [AI-authored; registry-backed; teacher-editable]
}

export interface RubricSpec {
  id: string; // [deterministic-runtime-owned]
  version: string; // [deterministic-runtime-owned]
  title: string; // [AI-authored; teacher-editable]
  criteria: RubricCriterionSpec[]; // [AI-authored; registry-backed; teacher-editable]
  totalPoints: number; // [derived-by-validator]
  passingPolicyId: RegistryId; // [AI-authored; registry-backed; teacher-editable]
}

export interface RubricCriterionSpec {
  id: string; // [AI-authored; teacher-editable]
  skillIds: RegistryId[]; // [AI-authored; registry-backed; teacher-editable]
  description: string; // [AI-authored; teacher-editable]
  maxPoints: number; // [AI-authored; teacher-editable]
  assessmentModeId: RegistryId; // [AI-authored; registry-backed; teacher-editable]
  requiredEventTypeIds: RegistryId[]; // [AI-authored; registry-backed; teacher-editable]
  requiredObservationKeyIds: RegistryId[]; // [AI-authored; registry-backed; teacher-editable]
  studentSubmissionFieldIds: RegistryId[]; // [AI-authored; registry-backed; teacher-editable]
  scoringGuide: string[]; // [AI-authored; teacher-editable]
}

export interface AdaptiveRetryTemplate {
  id: string; // [AI-authored; teacher-editable]
  templateId: RegistryId; // [AI-authored; registry-backed; teacher-editable]
  targetSkillIds: RegistryId[]; // [AI-authored; registry-backed; teacher-editable]
  eligibleFlagIds: RegistryId[]; // [AI-authored; registry-backed; teacher-editable]
  seedTemplateId: RegistryId; // [AI-authored; registry-backed; teacher-editable]
  maxMinutes: number; // [AI-authored; teacher-editable]
  studentGoal: string; // [AI-authored; teacher-editable]
  successEvidenceReasonIds: RegistryId[]; // [AI-authored; registry-backed; teacher-editable]
}

export interface SafetyConstraint {
  id: RegistryId; // [registry-backed; deterministic-runtime-owned]
  appliesToInstanceIds: string[]; // [derived-by-validator]
  severity: "required" | "restricted" | "prohibited"; // [registry-backed; deterministic-runtime-owned]
  studentFacingText: string; // [registry-backed; deterministic-runtime-owned]
  teacherFacingText: string; // [registry-backed; deterministic-runtime-owned]
}

export interface ValidationIssue {
  code: RegistryId; // [registry-backed; deterministic-runtime-owned]
  severity: "error" | "warning" | "info"; // [derived-by-validator]
  path: string; // [derived-by-validator]
  message: string; // [derived-by-validator]
  registryId?: RegistryId; // [derived-by-validator]
  suggestedSupportedIds: RegistryId[]; // [derived-by-validator]
  safetyRelated: boolean; // [derived-by-validator]
}

export interface ValidationResult {
  validatorVersion: string; // [deterministic-runtime-owned]
  checkedAt: IsoDateTime; // [deterministic-runtime-owned]
  canonicalSpecHash: string; // [derived-by-validator]
  registrySnapshotIds: Record<string, string>; // [registry-backed; derived-by-validator]
  status: Exclude<WorkflowSupportStatus, "draft_unvalidated">; // [derived-by-validator]
  runnable: boolean; // [derived-by-validator]
  previewEligible: boolean; // [derived-by-validator]
  assignmentEligible: boolean; // [derived-by-validator]
  issues: ValidationIssue[]; // [derived-by-validator]
  passedCheckIds: RegistryId[]; // [registry-backed; derived-by-validator]
}

export type JudgeDimension =
  | "skill_alignment"
  | "pedagogical_quality"
  | "student_clarity"
  | "rubric_alignment"
  | "coach_trigger_relevance"
  | "safety_appropriateness"
  | "teacher_usability"
  | "under_resourced_school_suitability";

export interface JudgeCritique {
  critiqueVersion: string; // [deterministic-runtime-owned]
  specHash: string; // [deterministic-runtime-owned; derived-by-validator]
  scores: Record<JudgeDimension, JudgeDimensionScore>; // [AI-authored]
  issues: JudgeIssue[]; // [AI-authored]
  strengths: string[]; // [AI-authored]
  summary: string; // [AI-authored]
  recommendation: "approve" | "revise" | "mark_partially_supported" | "reject"; // [AI-authored]
}

export interface JudgeDimensionScore {
  score: 1 | 2 | 3 | 4 | 5; // [AI-authored]
  rationale: string; // [AI-authored]
}

export interface JudgeIssue {
  severity: "blocker" | "medium" | "low"; // [AI-authored]
  dimension: JudgeDimension; // [AI-authored]
  path: string; // [AI-authored]
  critique: string; // [AI-authored]
  suggestedRevision: string; // [AI-authored]
}
```

`authoredLimits` can narrow a registered range but cannot widen it. `expectedValueSourceId` points to an engine-owned observable/ground-truth selector; it never contains a generated expected pH, temperature, mass, or chemical identity.

## Draft and assignment rules

- A newly authored object uses `supportStatus: "draft_unvalidated"` and `validation: null`.
- The hard validator writes the final status/result and canonical hash. Application code must not accept client- or LLM-supplied validator fields as authoritative.
- Judge critique is bound to the validated hash. It becomes stale after any revision.
- Teacher edits are allowed only on fields tagged `[teacher-editable]`; every edit returns the spec to `draft_unvalidated`.
- Preview and assignment require `runnable`, matching hashes, pinned registry snapshots, and `previewEligible`/`assignmentEligible`.
- Runtime state is absent from the schema. It is created by the selected engine/config/seed and changes only through typed `step()` actions.

## Example 1: endpoint-control titration pre-lab

This is the target checked-in seed for migrating the current static titration. Its illustrative `runnable` result becomes truthful only after the referenced registries and assembler have been implemented and tested.

```ts
const endpointControlPrelab: LabWorkflowSpec = {
  schemaVersion: "1.0.0",
  id: "workflow.endpoint_control_prelab.seed.v1",
  revision: 1,
  sourceRequest:
    "Create a 7-minute acid-base titration pre-lab focused on endpoint control and meniscus reading.",
  metadata: {
    title: "Endpoint Control and Meniscus Reading",
    learningObjective:
      "Read a burette correctly and use dropwise delivery near the endpoint.",
    studentSummary: "Practice the final stage of a strong acid/strong base titration.",
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
      studentInstruction: "At eye level, record the bottom of the concave meniscus.",
      rationaleForTeacher: "Establishes apparatus-appropriate reading before delivery.",
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
      studentInstruction: "Add titrant slowly, switching to dropwise control near the endpoint.",
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
      flagIds: ["flag.flow_rate_high_near_endpoint.v1", "flag.endpoint_overshoot.v1"],
      triggerTypeId: "coach_trigger.mistake_reflection.v1",
      hintStrategyId: "hint.endpoint_control_graduated.v1",
      maxHintLevel: 2,
      cooldownEventCount: 2,
      staySilentOnEventReasonIds: ["evidence.controlled_addition_near_endpoint.v1"]
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
        description: "Reads and records the bottom of the meniscus to burette precision.",
        maxPoints: 2,
        assessmentModeId: "assessment.event_plus_entry.v1",
        requiredEventTypeIds: ["event.read_meniscus.v1"],
        requiredObservationKeyIds: ["observation.reported_volume_ml.v1"],
        studentSubmissionFieldIds: ["submission.initial_burette_reading.v1"],
        scoringGuide: ["0: unsupported reading", "1: method or precision partly correct", "2: both correct"]
      },
      {
        id: "endpoint",
        skillIds: ["endpoint_control"],
        description: "Uses controlled additions near endpoint without overshoot.",
        maxPoints: 3,
        assessmentModeId: "assessment.event_performance.v1",
        requiredEventTypeIds: ["event.add_titrant.v1"],
        requiredObservationKeyIds: ["observation.observed_color.v1"],
        studentSubmissionFieldIds: ["submission.endpoint_reflection.v1"],
        scoringGuide: ["0: major overshoot", "1: inconsistent control", "2: controlled with prompting", "3: controlled independently"]
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
      eligibleFlagIds: ["flag.flow_rate_high_near_endpoint.v1", "flag.endpoint_overshoot.v1"],
      seedTemplateId: "seed.titration.near_endpoint_22ml.v1",
      maxMinutes: 3,
      studentGoal: "Reach the endpoint using controlled dropwise additions.",
      successEvidenceReasonIds: ["evidence.controlled_addition_near_endpoint.v1"]
    }
  ],
  safetyConstraints: [
    {
      id: "safety.virtual_titration_ppe_notice.v1",
      appliesToInstanceIds: ["titrant_burette", "analyte_flask", "indicator_source"],
      severity: "required",
      studentFacingText: "Wear assigned PPE and follow teacher instructions in a physical lab.",
      teacherFacingText: "Virtual completion does not replace local lab safety instruction."
    }
  ],
  supportStatus: "runnable",
  validation: {
    validatorVersion: "1.0.0",
    checkedAt: "2026-07-16T12:00:00Z",
    canonicalSpecHash: "sha256:example-endpoint-seed",
    registrySnapshotIds: { components: "1.0.0", actions: "1.0.0", engines: "1.0.0" },
    status: "runnable",
    runnable: true,
    previewEligible: true,
    assignmentEligible: true,
    issues: [],
    passedCheckIds: ["check.schema.v1", "check.registry_resolution.v1", "check.seed_replay.v1"]
  },
  judgeCritique: null
};
```

## Example 2: precipitation / solubility mini-lab

This example shows a structurally useful draft that must remain `partially_supported` until the precipitation engine, reagent pairs, events, and equation evaluator are implemented and verified.

```ts
const precipitationMiniLab: LabWorkflowSpec = {
  schemaVersion: "1.0.0",
  id: "workflow.precipitation_net_ionic.example.v1",
  revision: 1,
  sourceRequest: "Create a lab that helps students practice net ionic equations.",
  metadata: {
    title: "Observe, Then Write the Net Ionic Equation",
    learningObjective: "Connect a verified precipitate observation to a balanced net ionic equation.",
    studentSummary: "Mix two ionic solutions, record evidence, and identify spectator ions.",
    gradeBand: "mixed_high_school",
    estimatedMinutes: 10,
    difficulty: "intermediate",
    tags: ["precipitation", "equations"],
    accessibilityNotes: ["Color is paired with text and shape/solid-state labels."],
    deviceProfileId: "device.chromebook_core.v1"
  },
  familyId: "family.precipitation_solubility.v1",
  engineId: "engine.precipitation.v1",
  engineConfigId: "engine_config.precipitation.agno3_nacl.v1",
  initializationPresetId: "seed.precipitation.unmixed.v1",
  skillIds: ["precipitate_observation", "net_ionic_equations"],
  components: [
    { instanceId: "solution_a", componentId: "component.reagent_bottle.v1", configurationPresetId: "component_config.reagent_bottle.100ml.v1", role: "reactant_a_source", placementSlotId: "placement.bench_left.v1", label: "Solution A", required: true },
    { instanceId: "solution_b", componentId: "component.reagent_bottle.v1", configurationPresetId: "component_config.reagent_bottle.100ml.v1", role: "reactant_b_source", placementSlotId: "placement.bench_right.v1", label: "Solution B", required: true },
    { instanceId: "mixing_beaker", componentId: "component.beaker.v1", configurationPresetId: "component_config.beaker.100ml.v1", role: "reaction_vessel", placementSlotId: "placement.bench_center.v1", label: "Mixing beaker", required: true }
  ],
  reagents: [
    { instanceId: "silver_nitrate", reagentId: "reagent.silver_nitrate_0_100m.v1", containerInstanceId: "solution_a", role: "reactant_a", requestedAmount: 10, amountUnitId: "unit.ml.v1", displayLabel: "0.100 M silver nitrate" },
    { instanceId: "sodium_chloride", reagentId: "reagent.sodium_chloride_0_100m.v1", containerInstanceId: "solution_b", role: "reactant_b", requestedAmount: 10, amountUnitId: "unit.ml.v1", displayLabel: "0.100 M sodium chloride" }
  ],
  steps: [
    {
      id: "mix_and_observe",
      order: 1,
      title: "Mix and observe",
      studentInstruction: "Combine the registered portions and record visible evidence without naming a product yet.",
      rationaleForTeacher: "Separates observation from interpretation.",
      skillIds: ["precipitate_observation"],
      componentInstanceIds: ["solution_a", "solution_b", "mixing_beaker"],
      allowedActions: [{ actionId: "action.mix.v1", actorComponentInstanceId: "mixing_beaker", targetComponentInstanceIds: ["solution_a", "solution_b"], parameterPresetId: "action_params.mix_equal_10ml.v1", maxAttempts: 1 }],
      expectedObservations: [{ id: "solid_observed", eventTypeId: "event.mix_ionic_solutions.v1", observationKeyId: "observation.precipitate_appearance.v1", expectation: "value_recorded", expectedValueSourceId: "observable.precipitate_appearance.v1", studentPrompt: "Record the visible change.", requiredForCompletion: true }],
      completionPolicyId: "completion.all_required_observations.v1",
      optional: false
    },
    {
      id: "write_equation",
      order: 2,
      title: "Write the net ionic equation",
      studentInstruction: "Identify spectator ions, then submit a balanced net ionic equation.",
      rationaleForTeacher: "Assesses symbolic reasoning against engine-supplied reaction truth.",
      skillIds: ["net_ionic_equations"],
      componentInstanceIds: ["mixing_beaker"],
      allowedActions: [{ actionId: "action.submit_equation.v1", actorComponentInstanceId: "mixing_beaker", targetComponentInstanceIds: [], parameterPresetId: "action_params.net_ionic_equation_builder.v1", maxAttempts: 2 }],
      expectedObservations: [{ id: "equation_submitted", eventTypeId: "event.submit_net_ionic_equation.v1", expectation: "event_present", studentPrompt: "Submit your equation.", requiredForCompletion: true }],
      completionPolicyId: "completion.all_required_observations.v1",
      optional: false
    }
  ],
  coachTriggers: [{ id: "coach_spectator", skillId: "net_ionic_equations", eventTypeIds: ["event.submit_net_ionic_equation.v1"], flagIds: ["flag.spectator_ion_included.v1"], triggerTypeId: "coach_trigger.mistake_reflection.v1", hintStrategyId: "hint.spectator_ion_graduated.v1", maxHintLevel: 2, cooldownEventCount: 1, staySilentOnEventReasonIds: ["evidence.net_ionic_equation_correct.v1"] }],
  rubric: {
    id: "rubric.precipitation.example.v1",
    version: "1.0.0",
    title: "Precipitation evidence and equation",
    criteria: [
      { id: "observation", skillIds: ["precipitate_observation"], description: "Records visible evidence before interpreting it.", maxPoints: 2, assessmentModeId: "assessment.observation_entry.v1", requiredEventTypeIds: ["event.mix_ionic_solutions.v1"], requiredObservationKeyIds: ["observation.precipitate_appearance.v1"], studentSubmissionFieldIds: ["submission.precipitate_observation.v1"], scoringGuide: ["0: missing", "1: vague", "2: specific evidence"] },
      { id: "equation", skillIds: ["net_ionic_equations"], description: "Submits a balanced net ionic equation without spectator ions.", maxPoints: 3, assessmentModeId: "assessment.structured_equation.v1", requiredEventTypeIds: ["event.submit_net_ionic_equation.v1"], requiredObservationKeyIds: [], studentSubmissionFieldIds: ["submission.net_ionic_equation.v1"], scoringGuide: ["0: unsupported", "1: major errors", "2: minor error", "3: balanced/correct"] }
    ],
    totalPoints: 5,
    passingPolicyId: "passing.percent_70.v1"
  },
  adaptiveRetries: [{ id: "retry_spectator", templateId: "retry.net_ionic_alternate_pair.v1", targetSkillIds: ["net_ionic_equations"], eligibleFlagIds: ["flag.spectator_ion_included.v1"], seedTemplateId: "seed.precipitation.alternate_pair_unmixed.v1", maxMinutes: 4, studentGoal: "Remove spectator ions and balance charge.", successEvidenceReasonIds: ["evidence.net_ionic_equation_correct.v1"] }],
  safetyConstraints: [{ id: "safety.virtual_precipitation_ppe_notice.v1", appliesToInstanceIds: ["solution_a", "solution_b", "mixing_beaker"], severity: "required", studentFacingText: "Follow teacher PPE and disposal instructions in a physical lab.", teacherFacingText: "The virtual workflow does not authorize physical reagent use." }],
  supportStatus: "partially_supported",
  validation: {
    validatorVersion: "1.0.0",
    checkedAt: "2026-07-16T12:00:00Z",
    canonicalSpecHash: "sha256:example-precipitation-draft",
    registrySnapshotIds: { components: "design-only", engines: "not-implemented" },
    status: "partially_supported",
    runnable: false,
    previewEligible: false,
    assignmentEligible: false,
    issues: [{ code: "validation.engine_not_available.v1", severity: "error", path: "engineId", message: "The precipitation engine is planned but not registered as runnable.", registryId: "engine.precipitation.v1", suggestedSupportedIds: ["engine.titration.v1"], safetyRelated: false }],
    passedCheckIds: ["check.schema.v1"]
  },
  judgeCritique: null
};
```

## Example 3: calorimetry sign-convention mini-lab

This example is intentionally non-runnable until the calorimetry engine, thermometer/calorimeter components, heat-transfer events, and seed replay are verified.

```ts
const calorimetryMiniLab: LabWorkflowSpec = {
  schemaVersion: "1.0.0",
  id: "workflow.calorimetry_sign.example.v1",
  revision: 1,
  sourceRequest: "Create a calorimetry workflow focused on heat transfer sign conventions.",
  metadata: {
    title: "Which Way Does Heat Flow?",
    learningObjective: "Use a measured temperature change to explain heat flow and sign convention.",
    studentSummary: "Mix two verified samples, record temperature, and identify signs for system and surroundings.",
    gradeBand: "11-12",
    estimatedMinutes: 8,
    difficulty: "intermediate",
    tags: ["calorimetry", "energy"],
    accessibilityNotes: ["The temperature curve has a data-table alternative."],
    deviceProfileId: "device.chromebook_core.v1"
  },
  familyId: "family.calorimetry.v1",
  engineId: "engine.calorimetry.v1",
  engineConfigId: "engine_config.calorimetry.hot_cold_water.v1",
  initializationPresetId: "seed.calorimetry.before_mix.v1",
  skillIds: ["heat_transfer", "calorimetry_sign_convention", "data_recording"],
  components: [
    { instanceId: "calorimeter", componentId: "component.calorimeter.v1", configurationPresetId: "component_config.coffee_cup.100ml.v1", role: "calorimetry_vessel", placementSlotId: "placement.bench_center.v1", label: "Coffee-cup calorimeter", required: true },
    { instanceId: "probe", componentId: "component.thermometer.v1", configurationPresetId: "component_config.thermometer.digital_0_1c.v1", role: "temperature_probe", placementSlotId: "placement.calorimeter_probe.v1", label: "Digital thermometer", required: true },
    { instanceId: "water_cylinder", componentId: "component.graduated_cylinder.v1", configurationPresetId: "component_config.cylinder.50ml.v1", role: "volume_measurement", placementSlotId: "placement.bench_left.v1", label: "Graduated cylinder", required: true }
  ],
  reagents: [
    { instanceId: "warm_water", reagentId: "reagent.water_warm_profile.v1", containerInstanceId: "water_cylinder", role: "system_sample", requestedAmount: 40, amountUnitId: "unit.ml.v1", displayLabel: "Warm water sample" },
    { instanceId: "cool_water", reagentId: "reagent.water_cool_profile.v1", containerInstanceId: "calorimeter", role: "surroundings_sample", requestedAmount: 40, amountUnitId: "unit.ml.v1", displayLabel: "Cool water sample" }
  ],
  steps: [
    {
      id: "record_initial_temperatures",
      order: 1,
      title: "Record initial temperatures",
      studentInstruction: "Wait for a stable reading and record each sample to thermometer precision.",
      rationaleForTeacher: "Establishes trustworthy input data.",
      skillIds: ["data_recording"],
      componentInstanceIds: ["probe", "calorimeter", "water_cylinder"],
      allowedActions: [{ actionId: "action.read_temperature.v1", actorComponentInstanceId: "probe", targetComponentInstanceIds: ["calorimeter", "water_cylinder"], parameterPresetId: "action_params.wait_for_equilibrium.v1", maxAttempts: 4 }],
      expectedObservations: [{ id: "temperatures_recorded", eventTypeId: "event.read_temperature.v1", observationKeyId: "observation.temperature_c.v1", expectation: "value_recorded", expectedValueSourceId: "observable.temperature_c.v1", studentPrompt: "Record both initial temperatures.", requiredForCompletion: true }],
      completionPolicyId: "completion.two_stable_temperature_readings.v1",
      optional: false
    },
    {
      id: "mix_and_explain",
      order: 2,
      title: "Mix and explain heat flow",
      studentInstruction: "Mix the samples, observe the curve, and state the sign of heat for each defined system.",
      rationaleForTeacher: "Connects observed temperature change to sign convention.",
      skillIds: ["heat_transfer", "calorimetry_sign_convention"],
      componentInstanceIds: ["calorimeter", "probe", "water_cylinder"],
      allowedActions: [
        { actionId: "action.mix.v1", actorComponentInstanceId: "calorimeter", targetComponentInstanceIds: ["water_cylinder"], parameterPresetId: "action_params.calorimetry_mix.v1", maxAttempts: 1 },
        { actionId: "action.submit_sign_convention.v1", actorComponentInstanceId: "calorimeter", targetComponentInstanceIds: [], parameterPresetId: "action_params.system_surroundings_sign.v1", maxAttempts: 2 }
      ],
      expectedObservations: [{ id: "final_temperature", eventTypeId: "event.read_temperature.v1", observationKeyId: "observation.temperature_c.v1", expectation: "value_recorded", expectedValueSourceId: "observable.calorimetry_final_temperature_c.v1", studentPrompt: "Record the stable final temperature.", requiredForCompletion: true }],
      completionPolicyId: "completion.calorimetry_sign_response.v1",
      optional: false
    }
  ],
  coachTriggers: [{ id: "coach_sign", skillId: "calorimetry_sign_convention", eventTypeIds: ["event.submit_sign_convention.v1"], flagIds: ["flag.heat_sign_reversed.v1"], triggerTypeId: "coach_trigger.mistake_reflection.v1", hintStrategyId: "hint.system_boundary_graduated.v1", maxHintLevel: 2, cooldownEventCount: 1, staySilentOnEventReasonIds: ["evidence.sign_convention_correct.v1"] }],
  rubric: {
    id: "rubric.calorimetry_sign.example.v1",
    version: "1.0.0",
    title: "Heat transfer and sign convention",
    criteria: [
      { id: "data", skillIds: ["data_recording"], description: "Records stable temperatures to registered precision.", maxPoints: 2, assessmentModeId: "assessment.event_plus_entry.v1", requiredEventTypeIds: ["event.read_temperature.v1"], requiredObservationKeyIds: ["observation.temperature_c.v1"], studentSubmissionFieldIds: ["submission.temperature_table.v1"], scoringGuide: ["0: missing", "1: incomplete/precision issue", "2: complete"] },
      { id: "sign", skillIds: ["heat_transfer", "calorimetry_sign_convention"], description: "Explains transfer direction and applies consistent signs.", maxPoints: 3, assessmentModeId: "assessment.explanation.v1", requiredEventTypeIds: ["event.submit_sign_convention.v1"], requiredObservationKeyIds: [], studentSubmissionFieldIds: ["submission.heat_transfer_explanation.v1"], scoringGuide: ["0: unsupported", "1: major confusion", "2: one sign/reason issue", "3: consistent explanation"] }
    ],
    totalPoints: 5,
    passingPolicyId: "passing.percent_70.v1"
  },
  adaptiveRetries: [{ id: "retry_sign", templateId: "retry.calorimetry_sign_contrast.v1", targetSkillIds: ["calorimetry_sign_convention"], eligibleFlagIds: ["flag.heat_sign_reversed.v1"], seedTemplateId: "seed.calorimetry.contrasting_trace.v1", maxMinutes: 3, studentGoal: "Identify the system before assigning heat signs.", successEvidenceReasonIds: ["evidence.sign_convention_correct.v1"] }],
  safetyConstraints: [{ id: "safety.no_open_flame_mvp.v1", appliesToInstanceIds: ["calorimeter", "probe", "water_cylinder"], severity: "prohibited", studentFacingText: "This virtual workflow uses no open flame.", teacherFacingText: "Open-flame heating is outside the MVP safety/runtime capability." }],
  supportStatus: "unsupported",
  validation: {
    validatorVersion: "1.0.0",
    checkedAt: "2026-07-16T12:00:00Z",
    canonicalSpecHash: "sha256:example-calorimetry-draft",
    registrySnapshotIds: { components: "design-only", engines: "not-implemented" },
    status: "unsupported",
    runnable: false,
    previewEligible: false,
    assignmentEligible: false,
    issues: [
      { code: "validation.engine_not_available.v1", severity: "error", path: "engineId", message: "No verified calorimetry engine is registered.", registryId: "engine.calorimetry.v1", suggestedSupportedIds: ["engine.titration.v1"], safetyRelated: false },
      { code: "validation.component_not_available.v1", severity: "error", path: "components", message: "Calorimeter and thermometer entries are design contracts, not runnable components.", suggestedSupportedIds: [], safetyRelated: false }
    ],
    passedCheckIds: ["check.schema.v1", "check.no_open_flame.v1"]
  },
  judgeCritique: null
};
```

## Non-negotiable validation behavior

- Unknown or unavailable IDs are errors; similar names are not substituted silently.
- A safe-looking instruction does not compensate for an unsupported reagent or engine.
- A judge recommendation cannot change `ValidationResult`.
- `partially_supported`, `unsupported`, and `rejected_for_safety` examples cannot be previewed or assigned.
- The canonical titration migration fixture must replay through the existing engine and preserve its semantic event behavior before AI-authored variants are enabled.
