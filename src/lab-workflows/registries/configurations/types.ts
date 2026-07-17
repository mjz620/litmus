export type ConfigurationCategory =
  | "action_parameters"
  | "assessment_mode"
  | "coach_trigger"
  | "completion_policy"
  | "component_configuration"
  | "device_profile"
  | "engine_configuration"
  | "evidence_reason"
  | "hint_strategy"
  | "observable"
  | "observation_key"
  | "passing_policy"
  | "placement"
  | "retry_template"
  | "seed_template"
  | "submission_field"
  | "unit";

export interface ConfigurationRegistryEntry {
  readonly id: string;
  readonly version: "1.0.0";
  readonly category: ConfigurationCategory;
  readonly description: string;
  readonly compatibleFamilyIds: readonly ["family.acid_base_titration.v1"];
  readonly compatibleActionIds: readonly string[];
  readonly compatibleComponentIds: readonly string[];
  readonly adapterKey: string | null;
  readonly availability: "verified";
}
