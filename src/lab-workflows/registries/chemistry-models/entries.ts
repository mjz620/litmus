import type { ChemistryModelMetadataEntry } from "./types";

/**
 * LC2-103 intentionally registers no production provider. Existing titration
 * chemistry remains behind its legacy ExperimentDefinition until LC2-300.
 */
export const CHEMISTRY_MODEL_REGISTRY_ENTRIES = Object.freeze(
  [] as const satisfies readonly ChemistryModelMetadataEntry[]
);
