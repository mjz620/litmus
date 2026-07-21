import { createSupportingRegistry } from "../actions";
import { SAFETY_REGISTRY_ENTRIES } from "./entries";

export const safetyRegistry = createSupportingRegistry(
  "safety",
  "safety.2.2.0",
  SAFETY_REGISTRY_ENTRIES
);

export { SAFETY_REGISTRY_ENTRIES } from "./entries";
export type { SafetyRegistryEntry, SafetyRegistryId } from "./types";
