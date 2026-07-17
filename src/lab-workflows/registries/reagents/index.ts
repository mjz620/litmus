import { createSupportingRegistry } from "../actions";
import { REAGENT_REGISTRY_ENTRIES } from "./entries";

export const reagentRegistry = createSupportingRegistry(
  "reagent",
  "reagents.1.0.0",
  REAGENT_REGISTRY_ENTRIES
);

export { REAGENT_REGISTRY_ENTRIES } from "./entries";
export type { ReagentRegistryEntry, ReagentRegistryId } from "./types";
