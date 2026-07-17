import type { ConfigurationRegistryEntry } from "./types";

const FAMILY = ["family.acid_base_titration.v1"] as const;

function entry(
  id: string,
  category: ConfigurationRegistryEntry["category"],
  description: string,
  options: {
    readonly adapterKey?: string;
    readonly compatibleActionIds?: readonly string[];
    readonly compatibleComponentIds?: readonly string[];
  } = {}
): ConfigurationRegistryEntry {
  return {
    id,
    version: "1.0.0",
    category,
    description,
    compatibleFamilyIds: FAMILY,
    compatibleActionIds: options.compatibleActionIds ?? [],
    compatibleComponentIds: options.compatibleComponentIds ?? [],
    adapterKey: options.adapterKey ?? null,
    availability: "verified"
  };
}

export const CONFIGURATION_REGISTRY_ENTRIES = [
  entry(
    "engine_config.titration.strong_acid_strong_base_25ml.v1",
    "engine_configuration",
    "Verified 25.0 mL strong-acid/strong-base titration profile.",
    { adapterKey: "EXAMPLE_STRONG" }
  ),
  entry(
    "seed.titration.near_endpoint_22ml.v1",
    "seed_template",
    "Verified endpoint-control seed with 22.00 mL already delivered.",
    { adapterKey: "createTitrationRetryScenario:endpoint_control" }
  ),
  entry(
    "component_config.burette.50ml.v1",
    "component_configuration",
    "Verified 50.00 mL burette presentation and measurement configuration.",
    { compatibleComponentIds: ["component.burette.v1"] }
  ),
  entry(
    "component_config.erlenmeyer.125ml.v1",
    "component_configuration",
    "Verified 125 mL Erlenmeyer flask presentation configuration.",
    { compatibleComponentIds: ["component.erlenmeyer_flask.v1"] }
  ),
  entry(
    "component_config.indicator_dropper.v1",
    "component_configuration",
    "Verified one-addition indicator dropper configuration.",
    { compatibleComponentIds: ["component.indicator_bottle.v1"] }
  ),
  entry(
    "placement.bench_center_stand.v1",
    "placement",
    "Burette stand placement backed by the current titration bench.",
    { compatibleComponentIds: ["component.burette.v1"] }
  ),
  entry(
    "placement.under_burette.v1",
    "placement",
    "Receiving-flask placement beneath the current burette.",
    { compatibleComponentIds: ["component.erlenmeyer_flask.v1"] }
  ),
  entry(
    "placement.indicator_shelf.v1",
    "placement",
    "Indicator shelf placement backed by the current titration bench.",
    { compatibleComponentIds: ["component.indicator_bottle.v1"] }
  ),
  entry(
    "action_params.burette_reading.v1",
    "action_parameters",
    "Burette reading entry bounded to the registered capacity and precision.",
    { compatibleActionIds: ["action.read_volume.v1"] }
  ),
  entry(
    "action_params.titration_dropwise_or_slow.v1",
    "action_parameters",
    "Existing dropwise-or-slow titrant delivery control profile.",
    { compatibleActionIds: ["action.dispense.v1"] }
  ),
  entry(
    "observable.burette_reading_ml.v1",
    "observable",
    "Engine-owned current burette reading in milliliters.",
    { adapterKey: "currentReadingML" }
  ),
  entry(
    "observation.reported_volume_ml.v1",
    "observation_key",
    "Student-reported burette volume observation.",
    { adapterKey: "reportedML" }
  ),
  entry(
    "observation.observed_color.v1",
    "observation_key",
    "Engine-owned indicator color observation.",
    { adapterKey: "observedColor" }
  ),
  entry(
    "completion.all_required_observations.v1",
    "completion_policy",
    "Complete after all required registered observations are present."
  ),
  entry(
    "completion.engine_endpoint_observed.v1",
    "completion_policy",
    "Complete from the titration engine's endpoint evidence."
  ),
  entry(
    "coach_trigger.mistake_reflection.v1",
    "coach_trigger",
    "Reflective coaching trigger for a registered mistake flag."
  ),
  entry(
    "hint.endpoint_control_graduated.v1",
    "hint_strategy",
    "Existing graduated endpoint-control reflection and hint strategy."
  ),
  entry(
    "assessment.event_plus_entry.v1",
    "assessment_mode",
    "Assess with deterministic event evidence plus a student entry."
  ),
  entry(
    "assessment.event_performance.v1",
    "assessment_mode",
    "Assess directly from deterministic event performance evidence."
  ),
  entry(
    "submission.initial_burette_reading.v1",
    "submission_field",
    "Structured initial burette-reading field."
  ),
  entry(
    "submission.endpoint_reflection.v1",
    "submission_field",
    "Short endpoint-control reflection field."
  ),
  entry(
    "passing.percent_70.v1",
    "passing_policy",
    "Deterministic seventy-percent rubric threshold."
  ),
  entry(
    "retry.endpoint_control_near_endpoint.v1",
    "retry_template",
    "Existing verified endpoint-control retry template.",
    { adapterKey: "createTitrationRetryScenario:endpoint_control" }
  ),
  entry(
    "evidence.controlled_addition_near_endpoint.v1",
    "evidence_reason",
    "Canonical workflow reference for controlled_addition_near_endpoint."
  ),
  entry(
    "device.chromebook_core.v1",
    "device_profile",
    "Demand-rendered core profile for Chromebook-class hardware."
  ),
  entry("unit.ml.v1", "unit", "Milliliter volume unit."),
  entry("unit.drop.v1", "unit", "Bounded indicator drop-count unit.")
] as const satisfies readonly ConfigurationRegistryEntry[];
