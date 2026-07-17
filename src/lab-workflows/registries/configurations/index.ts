import { createSupportingRegistry } from "../actions";
import { CONFIGURATION_REGISTRY_ENTRIES } from "./entries";

export const configurationRegistry = createSupportingRegistry(
  "configuration",
  "configurations.1.0.0",
  CONFIGURATION_REGISTRY_ENTRIES
);

export { CONFIGURATION_REGISTRY_ENTRIES } from "./entries";
export type {
  ConfigurationCategory,
  ConfigurationRegistryEntry
} from "./types";
