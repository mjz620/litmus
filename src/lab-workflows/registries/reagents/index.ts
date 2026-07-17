import { createSupportingRegistry } from "../actions";
import { REAGENT_REGISTRY_ENTRIES } from "./entries";

export const reagentRegistry = createSupportingRegistry(
  "reagent",
  "reagents.2.0.0",
  REAGENT_REGISTRY_ENTRIES
);

/** Material terminology is a facade over the same exact v1 reagent entries. */
export const materialRegistry = reagentRegistry;

export const LEGACY_REAGENT_REGISTRY_SNAPSHOT_IDS = Object.freeze([
  "reagents.1.0.0"
] as const);

export { REAGENT_REGISTRY_ENTRIES } from "./entries";
export {
  materialIsVerified,
  materialSupportsContainerCapabilities
} from "./types";
export type {
  MaterialAvailability,
  MaterialPhase,
  MaterialProfile,
  MaterialProfileId,
  ReagentRegistryEntry,
  ReagentRegistryId
} from "./types";
