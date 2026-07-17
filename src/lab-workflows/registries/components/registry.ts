import { COMPONENT_REGISTRY_ENTRIES } from "./entries";
import {
  ComponentRegistryError,
  type ComponentRegistry,
  type ComponentRegistryEntry,
  type ComponentRegistryId,
  type ComponentRegistrySnapshot
} from "./types";

const SNAPSHOT_ID: ComponentRegistrySnapshot["snapshotId"] = "components.2.0.0";

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export function createComponentRegistry(
  entries: readonly ComponentRegistryEntry[]
): ComponentRegistry {
  const frozenEntries = entries.map(
    (entry) =>
      deepFreeze({
        ...entry,
        capabilityIds: [...entry.capabilityIds],
        stateSchema: {
          ...entry.stateSchema,
          fields: entry.stateSchema.fields.map((field) => ({
            ...field,
            allowedValues: field.allowedValues
              ? [...field.allowedValues]
              : undefined
          }))
        },
        allowedActionIds: [...entry.allowedActionIds],
        allowedRoleIds: [...entry.allowedRoleIds],
        emittedEventTypes: [...entry.emittedEventTypes],
        measurement: entry.measurement ? { ...entry.measurement } : null,
        accessibilityRequirements: [...entry.accessibilityRequirements],
        safetyConstraintIds: [...entry.safetyConstraintIds],
        compatibleFamilyIds: [...entry.compatibleFamilyIds]
      }) as ComponentRegistryEntry
  );
  const byId = new Map<string, ComponentRegistryEntry>();

  for (const entry of frozenEntries) {
    if (byId.has(entry.id)) {
      throw new ComponentRegistryError(
        "component_registry.duplicate_id",
        entry.id
      );
    }
    byId.set(entry.id, entry);
  }

  deepFreeze(frozenEntries);

  return Object.freeze({
    snapshotId: SNAPSHOT_ID,
    list: () => frozenEntries,
    has: (id: string): id is ComponentRegistryId => byId.has(id),
    get: (id: string) => {
      const entry = byId.get(id);
      if (!entry) {
        throw new ComponentRegistryError("component_registry.unknown_id", id);
      }
      return entry;
    }
  });
}

export const componentRegistry = createComponentRegistry(
  COMPONENT_REGISTRY_ENTRIES
);

export const componentRegistrySnapshot: ComponentRegistrySnapshot =
  Object.freeze({
    snapshotId: componentRegistry.snapshotId,
    entries: componentRegistry.list()
  });
