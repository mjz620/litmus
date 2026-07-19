import { CHEMISTRY_MODEL_REGISTRY_ENTRIES } from "./entries";
import {
  CHEMISTRY_MODEL_REGISTRY_ERROR_CODES,
  ChemistryModelRegistryError
} from "./errors";
import type {
  ChemistryModelId,
  ChemistryModelMetadataEntry,
  ChemistryModelRegistry,
  ChemistryModelRegistrySnapshot
} from "./types";

const SNAPSHOT_ID: ChemistryModelRegistrySnapshot["snapshotId"] =
  "chemistry-models.2.0.0";

function freezeEntry(
  entry: ChemistryModelMetadataEntry
): ChemistryModelMetadataEntry {
  return Object.freeze({
    ...entry,
    ...(entry.compatibilityRuntimeAdapterId
      ? {
          compatibilityRuntimeAdapterId: entry.compatibilityRuntimeAdapterId
        }
      : {}),
    providedCapabilityIds: Object.freeze([...entry.providedCapabilityIds]),
    requiredCapabilityIds: Object.freeze([...entry.requiredCapabilityIds])
  });
}

export function createChemistryModelRegistry(
  entries: readonly ChemistryModelMetadataEntry[]
): ChemistryModelRegistry {
  const frozenEntries = Object.freeze(entries.map(freezeEntry));
  const byId = new Map<string, ChemistryModelMetadataEntry>();

  for (const entry of frozenEntries) {
    if (byId.has(entry.id)) {
      throw new ChemistryModelRegistryError(
        CHEMISTRY_MODEL_REGISTRY_ERROR_CODES.duplicateId,
        entry.id
      );
    }
    byId.set(entry.id, entry);
  }

  return Object.freeze({
    snapshotId: SNAPSHOT_ID,
    list: () => frozenEntries,
    has: (id: string): id is ChemistryModelId => byId.has(id),
    get: (id: string) => {
      const entry = byId.get(id);
      if (!entry) {
        throw new ChemistryModelRegistryError(
          CHEMISTRY_MODEL_REGISTRY_ERROR_CODES.unknownId,
          id
        );
      }
      return entry;
    }
  });
}

export const chemistryModelRegistry = createChemistryModelRegistry(
  CHEMISTRY_MODEL_REGISTRY_ENTRIES
);

export const chemistryModelRegistrySnapshot: ChemistryModelRegistrySnapshot =
  Object.freeze({
    snapshotId: chemistryModelRegistry.snapshotId,
    entries: chemistryModelRegistry.list()
  });
