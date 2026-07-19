import { createSupportingRegistry } from "../actions";
import { ENGINE_REGISTRY_ENTRIES } from "./entries";

export const engineRegistry = createSupportingRegistry(
  "engine",
  "engines.1.2.0",
  ENGINE_REGISTRY_ENTRIES
);

export const LEGACY_ENGINE_REGISTRY_SNAPSHOT_IDS = Object.freeze([
  "engines.1.0.0",
  "engines.1.1.0"
] as const);

export { ENGINE_REGISTRY_ENTRIES } from "./entries";
export type { EngineRegistryEntry, EngineRegistryId } from "./types";
