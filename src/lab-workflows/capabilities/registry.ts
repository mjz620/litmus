import { CAPABILITY_REGISTRY_ENTRIES } from "./entries";
import type { LabCapabilityId } from "./ids";
import {
  CapabilityRegistryError,
  type CapabilityDefinition,
  type CapabilityRegistry,
  type CapabilityRegistrySnapshot,
  type ChemistryCapabilityDefinition,
  type EquipmentCapabilityDefinition
} from "./types";

const SNAPSHOT_ID: CapabilityRegistrySnapshot["snapshotId"] =
  "capabilities.2.3.0";

export function createCapabilityRegistry(
  entries: readonly CapabilityDefinition[]
): CapabilityRegistry {
  const frozenEntries = Object.freeze(
    entries.map((entry) => Object.freeze({ ...entry }))
  );
  const byId = new Map<string, CapabilityDefinition>();

  for (const entry of frozenEntries) {
    if (byId.has(entry.id)) {
      throw new CapabilityRegistryError(
        "capability_registry.duplicate_id",
        entry.id
      );
    }
    byId.set(entry.id, entry);
  }

  const equipmentEntries = Object.freeze(
    frozenEntries.filter(
      (entry): entry is EquipmentCapabilityDefinition =>
        entry.kind === "equipment"
    )
  );
  const chemistryEntries = Object.freeze(
    frozenEntries.filter(
      (entry): entry is ChemistryCapabilityDefinition =>
        entry.kind === "chemistry"
    )
  );

  function get(id: string): CapabilityDefinition {
    const entry = byId.get(id);
    if (!entry) {
      throw new CapabilityRegistryError("capability_registry.unknown_id", id);
    }
    return entry;
  }

  return Object.freeze({
    snapshotId: SNAPSHOT_ID,
    list: () => frozenEntries,
    listEquipment: () => equipmentEntries,
    listChemistry: () => chemistryEntries,
    has: (id: string): id is LabCapabilityId => byId.has(id),
    get,
    getEquipment: (id: string) => {
      const entry = get(id);
      if (entry.kind !== "equipment") {
        throw new CapabilityRegistryError("capability_registry.unknown_id", id);
      }
      return entry;
    },
    getChemistry: (id: string) => {
      const entry = get(id);
      if (entry.kind !== "chemistry") {
        throw new CapabilityRegistryError("capability_registry.unknown_id", id);
      }
      return entry;
    }
  });
}

export const capabilityRegistry = createCapabilityRegistry(
  CAPABILITY_REGISTRY_ENTRIES
);

export const capabilityRegistrySnapshot: CapabilityRegistrySnapshot =
  Object.freeze({
    snapshotId: capabilityRegistry.snapshotId,
    entries: capabilityRegistry.list()
  });
