import { createSupportingRegistry, type SupportingRegistry } from "../actions";
import { REAGENT_REGISTRY_ENTRIES } from "./entries";
import type { ReagentRegistryEntry } from "./types";

export const reagentRegistry: SupportingRegistry<ReagentRegistryEntry> =
  createSupportingRegistry(
    "reagent",
    "reagents.5.4.0",
    REAGENT_REGISTRY_ENTRIES
  );

/** Material terminology is a facade over the same exact v1 reagent entries. */
export const materialRegistry = reagentRegistry;

export const LEGACY_REAGENT_REGISTRY_SNAPSHOT_IDS = Object.freeze([
  "reagents.1.0.0",
  "reagents.2.0.0",
  "reagents.2.1.0",
  "reagents.2.2.0",
  "reagents.3.0.0",
  "reagents.3.1.0",
  "reagents.4.0.0",
  "reagents.5.0.0",
  "reagents.5.1.0",
  "reagents.5.2.0",
  "reagents.5.3.0"
] as const);

export {
  ACID_BASE_DISSOCIATION_25C,
  REAGENT_REGISTRY_ENTRIES,
  SOLID_MOLAR_MASS_G_PER_MOL
} from "./entries";
export {
  materialIsVerified,
  materialSupportsContainerCapabilities
} from "./types";
export type {
  AcidBaseDissociationProfile,
  MaterialAvailability,
  MaterialPhase,
  MaterialProfile,
  MaterialProfileId,
  MaterialUsageMode,
  ReagentRegistryEntry,
  ReagentRegistryId
} from "./types";
