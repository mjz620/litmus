import { ACTION_REGISTRY_ENTRIES } from "./entries";
import { createSupportingRegistry } from "./supportingRegistry";

export const actionRegistry = createSupportingRegistry(
  "action",
  "actions.1.0.0",
  ACTION_REGISTRY_ENTRIES
);

export { ACTION_REGISTRY_ENTRIES } from "./entries";
export {
  createSupportingRegistry,
  SupportingRegistryError
} from "./supportingRegistry";
export type {
  SupportingRegistry,
  SupportingRegistryEntry,
  SupportingRegistryErrorCode
} from "./supportingRegistry";
export type {
  ActionParameterDefinition,
  ActionRegistryEntry,
  ActionRegistryId
} from "./types";
