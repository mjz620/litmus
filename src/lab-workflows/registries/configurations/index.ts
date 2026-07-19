import { createSupportingRegistry } from "../actions";
import { CONFIGURATION_REGISTRY_ENTRIES } from "./entries";
import {
  ConfigurationMetadataError,
  type ConfigurationRegistryEntry,
  type ConfigurationSchemaRegistryEntry,
  type QuantityPresetRegistryEntry
} from "./types";

export const configurationRegistry = createSupportingRegistry(
  "configuration",
  "configurations.5.2.0",
  CONFIGURATION_REGISTRY_ENTRIES
);

export const LEGACY_CONFIGURATION_REGISTRY_SNAPSHOT_IDS = Object.freeze([
  "configurations.1.0.0",
  "configurations.2.0.0",
  "configurations.2.1.0",
  "configurations.2.2.0",
  "configurations.2.3.0",
  "configurations.2.4.0",
  "configurations.3.0.0",
  "configurations.3.1.0",
  "configurations.4.0.0",
  "configurations.5.0.0",
  "configurations.5.1.0"
] as const);

export function getConfigurationSchema(
  id: string
): ConfigurationSchemaRegistryEntry {
  const entry = configurationRegistry.get(id);
  if (entry.category !== "configuration_schema") {
    throw new ConfigurationMetadataError(
      "configuration_registry.category_mismatch",
      id
    );
  }
  return entry;
}

export function getQuantityPreset(id: string): QuantityPresetRegistryEntry {
  const entry = configurationRegistry.get(id);
  if (entry.category !== "quantity_preset") {
    throw new ConfigurationMetadataError(
      "configuration_registry.category_mismatch",
      id
    );
  }
  return entry;
}

export function requireVerifiedConfigurationEntry(
  id: string
): ConfigurationRegistryEntry {
  const entry = configurationRegistry.get(id);
  if (entry.availability !== "verified") {
    throw new ConfigurationMetadataError(
      "configuration_registry.unavailable",
      id
    );
  }
  return entry;
}

export { CONFIGURATION_REGISTRY_ENTRIES } from "./entries";
export { ConfigurationMetadataError } from "./types";
export type {
  ConfigurationAvailability,
  ConfigurationCategory,
  ConfigurationMetadataErrorCode,
  ConfigurationRegistryEntry,
  ConfigurationSchemaId,
  ConfigurationSchemaRegistryEntry,
  ConfigurationScope,
  LegacyConfigurationCategory,
  LegacyConfigurationRegistryEntry,
  QuantityPresetId,
  QuantityPresetRegistryEntry
} from "./types";
