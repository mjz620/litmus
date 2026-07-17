import type { ActionParameterSchemaId } from "../actions/types";
import type { ReagentRegistryId } from "../reagents/types";

export type LegacyConfigurationCategory =
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

export type ConfigurationCategory =
  | LegacyConfigurationCategory
  | "configuration_schema"
  | "quantity_preset";

export type ConfigurationAvailability = "declared" | "verified" | "restricted";

export type ConfigurationScope =
  | "action"
  | "equipment"
  | "layout"
  | "material_initialization"
  | "model"
  | "quantity";

export type ConfigurationSchemaId =
  | ActionParameterSchemaId
  | "schema.equipment_configuration.burette.v1"
  | "schema.equipment_configuration.erlenmeyer_flask.v1"
  | "schema.equipment_configuration.indicator_bottle.v1"
  | "schema.equipment_configuration.reagent_bottle.v1"
  | "schema.layout_configuration.titration_bench.v1"
  | "schema.material_initialization.aqueous_solution.v1"
  | "schema.material_initialization.indicator.v1"
  | "schema.material_initialization.pure_liquid.v1"
  | "schema.model_configuration.strong_acid_strong_base_25ml.v1"
  | "schema.quantity.drop_count.v1"
  | "schema.quantity.volume_ml.v1";

export type QuantityPresetId =
  | "quantity-preset.bromothymol_blue_1_drop.v1"
  | "quantity-preset.bromothymol_blue_2_drops.v1"
  | "quantity-preset.hydrochloric_acid_0_100m_25ml.v1"
  | "quantity-preset.methyl_orange_1_drop.v1"
  | "quantity-preset.methyl_orange_2_drops.v1"
  | "quantity-preset.phenolphthalein_1_drop.v1"
  | "quantity-preset.phenolphthalein_2_drops.v1"
  | "quantity-preset.sodium_hydroxide_0_100m_25ml.v1"
  | "quantity-preset.sodium_hydroxide_0_100m_50ml.v1";

interface ConfigurationRegistryEntryBase {
  readonly id: string;
  readonly version: "1.0.0";
  readonly description: string;
  /** V1 compatibility metadata. Reusable schema entries are family-neutral. */
  readonly compatibleFamilyIds: readonly string[];
  readonly compatibleActionIds: readonly string[];
  readonly compatibleComponentIds: readonly string[];
  readonly adapterKey: string | null;
  readonly availability: ConfigurationAvailability;
}

export interface LegacyConfigurationRegistryEntry extends ConfigurationRegistryEntryBase {
  readonly category: LegacyConfigurationCategory;
  readonly scope: ConfigurationScope | null;
  readonly schemaId: ConfigurationSchemaId | null;
}

export interface ConfigurationSchemaRegistryEntry extends ConfigurationRegistryEntryBase {
  readonly id: ConfigurationSchemaId;
  readonly category: "configuration_schema";
  readonly scope: ConfigurationScope;
  readonly schemaId: null;
  /** Metadata is strict and code-owned; it never contains authored code. */
  readonly strict: true;
}

export interface QuantityPresetRegistryEntry extends ConfigurationRegistryEntryBase {
  readonly id: QuantityPresetId;
  readonly category: "quantity_preset";
  readonly scope: "quantity";
  readonly schemaId:
    | "schema.quantity.drop_count.v1"
    | "schema.quantity.volume_ml.v1";
  readonly amount: number;
  readonly unitId: "unit.drop.v1" | "unit.ml.v1";
  readonly compatibleMaterialProfileIds: readonly ReagentRegistryId[];
}

export type ConfigurationRegistryEntry =
  | ConfigurationSchemaRegistryEntry
  | LegacyConfigurationRegistryEntry
  | QuantityPresetRegistryEntry;

export type ConfigurationMetadataErrorCode =
  | "configuration_registry.category_mismatch"
  | "configuration_registry.unavailable";

export class ConfigurationMetadataError extends Error {
  readonly code: ConfigurationMetadataErrorCode;
  readonly registryId: string;

  constructor(code: ConfigurationMetadataErrorCode, registryId: string) {
    super(
      code === "configuration_registry.category_mismatch"
        ? `Configuration registry category mismatch: ${registryId}`
        : `Configuration registry entry is not verified: ${registryId}`
    );
    this.name = "ConfigurationMetadataError";
    this.code = code;
    this.registryId = registryId;
  }
}
