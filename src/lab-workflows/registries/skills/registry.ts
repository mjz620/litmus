import { componentRegistry } from "../components";
import { engineRegistry } from "../engines";
import { SKILL_REGISTRY_DEFINITIONS } from "./entries";
import {
  type CanonicalSkillId,
  type SkillAvailability,
  type SkillRegistry,
  type SkillRegistryDefinition,
  type SkillRegistryEntry,
  SkillRegistryError,
  type SkillResolution,
  type SkillSearchResult
} from "./types";

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export function deriveSkillAvailability(
  definition: SkillRegistryDefinition
): SkillAvailability {
  if (definition.restricted) return "restricted";

  const familyVerified =
    definition.supportedFamilyIds.length === 0 ||
    definition.supportedFamilyIds.some((familyId) =>
      engineRegistry
        .list()
        .some(
          (engine) =>
            engine.familyId === familyId && engine.availability === "verified"
        )
    );
  const componentsVerified = definition.requiredComponentIds.every(
    (componentId) => componentRegistry.has(componentId)
  );

  return familyVerified && componentsVerified ? "verified" : "planned";
}

export function createSkillRegistry(
  definitions: readonly SkillRegistryDefinition[]
): SkillRegistry {
  const entries = definitions.map(
    (definition) =>
      deepFreeze({
        ...definition,
        availability: deriveSkillAvailability(definition)
      }) as SkillRegistryEntry
  );
  const byId = new Map<CanonicalSkillId, SkillRegistryEntry>();
  const aliases = new Map<string, CanonicalSkillId>();

  for (const entry of entries) {
    if (byId.has(entry.id)) {
      throw new SkillRegistryError("skill_registry.duplicate_id", entry.id);
    }
    byId.set(entry.id, entry);
  }

  for (const entry of entries) {
    for (const alias of entry.aliases) {
      if (byId.has(alias as CanonicalSkillId) || aliases.has(alias)) {
        throw new SkillRegistryError("skill_registry.alias_conflict", alias);
      }
      aliases.set(alias, entry.id);
    }
  }
  deepFreeze(entries);

  function get(id: CanonicalSkillId): SkillRegistryEntry {
    const entry = byId.get(id);
    if (!entry) throw new SkillRegistryError("skill_registry.unknown_id", id);
    return entry;
  }

  function resolve(id: string): SkillResolution {
    const canonicalEntry = byId.get(id as CanonicalSkillId);
    if (canonicalEntry) {
      return {
        status: "resolved",
        inputId: id,
        canonicalId: canonicalEntry.id,
        source: "canonical",
        entry: canonicalEntry
      };
    }
    const canonicalId = aliases.get(id);
    if (canonicalId) {
      return {
        status: "resolved",
        inputId: id,
        canonicalId,
        source: "alias",
        entry: get(canonicalId)
      };
    }
    return { status: "unknown", inputId: id };
  }

  function search(query: string): SkillSearchResult {
    const exact = resolve(query);
    if (exact.status === "resolved") {
      return { status: "single", query, matches: [exact.entry] };
    }

    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return { status: "none", query, matches: [] };
    const tokens = normalized.split(/\s+/).filter((token) => token.length > 2);
    const matches = entries.filter((entry) => {
      const searchable = [
        entry.id.replaceAll("_", " "),
        entry.description,
        ...entry.examplePrompts
      ]
        .join(" ")
        .toLocaleLowerCase();
      return (
        tokens.length > 0 && tokens.every((token) => searchable.includes(token))
      );
    });

    if (matches.length === 0) return { status: "none", query, matches: [] };
    if (matches.length === 1) {
      return {
        status: "single",
        query,
        matches: [matches[0]!]
      };
    }
    return { status: "ambiguous", query, matches };
  }

  return Object.freeze({
    snapshotId: "skills.2.2.0" as const,
    list: () => entries,
    get,
    resolve,
    search
  });
}

export const skillRegistry = createSkillRegistry(SKILL_REGISTRY_DEFINITIONS);
