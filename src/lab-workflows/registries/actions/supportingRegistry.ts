export interface SupportingRegistryEntry {
  readonly id: string;
  readonly version: "1.0.0";
}

export interface SupportingRegistry<TEntry extends SupportingRegistryEntry> {
  readonly kind: string;
  readonly snapshotId: string;
  list(): readonly TEntry[];
  has(id: string): id is TEntry["id"];
  get(id: string): TEntry;
}

export type SupportingRegistryErrorCode =
  | "registry.duplicate_id"
  | "registry.unknown_id";

export class SupportingRegistryError extends Error {
  readonly code: SupportingRegistryErrorCode;
  readonly registryKind: string;
  readonly registryId: string;

  constructor(
    code: SupportingRegistryErrorCode,
    registryKind: string,
    registryId: string
  ) {
    super(
      `${code === "registry.duplicate_id" ? "Duplicate" : "Unknown"} ${registryKind} registry ID: ${registryId}`
    );
    this.name = "SupportingRegistryError";
    this.code = code;
    this.registryKind = registryKind;
    this.registryId = registryId;
  }
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export function createSupportingRegistry<
  TEntry extends SupportingRegistryEntry
>(
  kind: string,
  snapshotId: string,
  entries: readonly TEntry[]
): SupportingRegistry<TEntry> {
  const frozenEntries = entries.map(
    (entry) => deepFreeze({ ...entry }) as TEntry
  );
  const byId = new Map<string, TEntry>();

  for (const entry of frozenEntries) {
    if (byId.has(entry.id)) {
      throw new SupportingRegistryError(
        "registry.duplicate_id",
        kind,
        entry.id
      );
    }
    byId.set(entry.id, entry);
  }
  deepFreeze(frozenEntries);

  return Object.freeze({
    kind,
    snapshotId,
    list: () => frozenEntries,
    has: (id: string): id is TEntry["id"] => byId.has(id),
    get: (id: string) => {
      const entry = byId.get(id);
      if (!entry) {
        throw new SupportingRegistryError("registry.unknown_id", kind, id);
      }
      return entry;
    }
  });
}
