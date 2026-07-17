import { createSupportingRegistry } from "../actions";
import { ENGINE_REGISTRY_ENTRIES } from "./entries";

export const engineRegistry = createSupportingRegistry(
  "engine",
  "engines.1.0.0",
  ENGINE_REGISTRY_ENTRIES
);

export { ENGINE_REGISTRY_ENTRIES } from "./entries";
export type { EngineRegistryEntry, EngineRegistryId } from "./types";
