import { zodResponsesFunction } from "openai/helpers/zod";
import { z } from "zod";

import { actionRegistry } from "../../../lab-workflows/registries/actions";
import { componentRegistry } from "../../../lab-workflows/registries/components";
import { configurationRegistry } from "../../../lab-workflows/registries/configurations";
import { engineRegistry } from "../../../lab-workflows/registries/engines";
import {
  eventFlagRegistry,
  eventTypeRegistry
} from "../../../lab-workflows/registries/event-flags";
import { reagentRegistry } from "../../../lab-workflows/registries/reagents";
import { safetyRegistry } from "../../../lab-workflows/registries/safety";
import { skillRegistry } from "../../../lab-workflows/registries/skills";
import type { SkillRegistryEntry } from "../../../lab-workflows/registries/skills";
import { LabAuthoringError } from "./errors";
import {
  labAuthoringToolNameSchema,
  type LabAuthoringToolName
} from "./schemas";

const searchSkillArgumentsSchema = z.strictObject({
  query: z.string().trim().min(1).max(240)
});

const listFamiliesArgumentsSchema = z.strictObject({
  skillIds: z.array(z.string().min(1).max(160)).min(1).max(16),
  runnableOnly: z.boolean()
});

const componentArgumentsSchema = z.strictObject({
  familyId: z.string().min(1).max(160),
  componentIds: z.array(z.string().min(1).max(160)).max(32)
});

const reagentArgumentsSchema = z.strictObject({
  familyId: z.string().min(1).max(160),
  reagentIds: z.array(z.string().min(1).max(160)).max(32)
});

const engineArgumentsSchema = z.strictObject({
  familyId: z.string().min(1).max(160)
});

function includesString(values: readonly string[], value: string): boolean {
  return values.includes(value);
}

/** The only tools exposed to the author model; every contract is read-only. */
export const LAB_AUTHORING_REGISTRY_TOOLS = Object.freeze([
  zodResponsesFunction({
    name: "searchSkillRegistry",
    description:
      "Search canonical skills and legacy aliases. Returns exact canonical IDs, availability, families, evidence, and registry snapshot metadata.",
    parameters: searchSkillArgumentsSchema
  }),
  zodResponsesFunction({
    name: "listSupportedLabFamilies",
    description:
      "Intersect exact canonical skill IDs with verified lab families. Never substitutes a different objective.",
    parameters: listFamiliesArgumentsSchema
  }),
  zodResponsesFunction({
    name: "getComponentRegistry",
    description:
      "Read exact verified component capabilities for one family. An empty componentIds list requests every compatible entry.",
    parameters: componentArgumentsSchema
  }),
  zodResponsesFunction({
    name: "getReagentRegistry",
    description:
      "Read exact verified reagent profiles and limits for one family. Freeform identities and concentrations are unavailable.",
    parameters: reagentArgumentsSchema
  }),
  zodResponsesFunction({
    name: "getEngineCapabilities",
    description:
      "Read exact engine, action, event, configuration, seed, completion, retry, and safety capabilities for one family.",
    parameters: engineArgumentsSchema
  })
]);

export const LAB_AUTHORING_TOOL_ALLOW_LIST = Object.freeze(
  LAB_AUTHORING_REGISTRY_TOOLS.map(({ name }) =>
    labAuthoringToolNameSchema.parse(name)
  )
);

export const LAB_AUTHORING_REGISTRY_SNAPSHOT_IDS = Object.freeze({
  actions: actionRegistry.snapshotId,
  components: componentRegistry.snapshotId,
  configurations: configurationRegistry.snapshotId,
  engines: engineRegistry.snapshotId,
  eventFlags: eventFlagRegistry.snapshotId,
  eventTypes: eventTypeRegistry.snapshotId,
  reagents: reagentRegistry.snapshotId,
  safety: safetyRegistry.snapshotId,
  skills: skillRegistry.snapshotId
});

function toolCallInvalid(name: string, message: string): never {
  throw new LabAuthoringError({
    code: "authoring.tool_call_invalid.v1",
    message,
    status: 502,
    retryable: true,
    fieldPaths: [`tools.${name}`]
  });
}

function searchSkillRegistry(argumentsValue: unknown) {
  const parsed = searchSkillArgumentsSchema.safeParse(argumentsValue);
  if (!parsed.success) {
    toolCallInvalid("searchSkillRegistry", "Invalid skill-search arguments.");
  }
  const result = skillRegistry.search(parsed.data.query);
  return Object.freeze({
    query: parsed.data.query,
    status: result.status,
    matches: result.matches,
    registrySnapshotId: skillRegistry.snapshotId
  });
}

function listSupportedLabFamilies(argumentsValue: unknown) {
  const parsed = listFamiliesArgumentsSchema.safeParse(argumentsValue);
  if (!parsed.success) {
    toolCallInvalid(
      "listSupportedLabFamilies",
      "Invalid supported-family arguments."
    );
  }

  const resolved: SkillRegistryEntry[] = [];
  const unsupportedSkillIds: string[] = [];
  for (const skillId of parsed.data.skillIds) {
    const resolution = skillRegistry.resolve(skillId);
    if (
      resolution.status !== "resolved" ||
      (parsed.data.runnableOnly && resolution.entry.availability !== "verified")
    ) {
      unsupportedSkillIds.push(skillId);
      continue;
    }
    resolved.push(resolution.entry);
  }

  const commonFamilyIds =
    resolved.length === 0 || unsupportedSkillIds.length > 0
      ? []
      : resolved[0]!.supportedFamilyIds.filter((familyId) =>
          resolved.every(({ supportedFamilyIds }) =>
            supportedFamilyIds.includes(familyId)
          )
        );
  const families = commonFamilyIds.flatMap((familyId) => {
    const engines = engineRegistry
      .list()
      .filter(
        (engine) =>
          engine.familyId === familyId && engine.availability === "verified"
      );
    if (parsed.data.runnableOnly && engines.length === 0) return [];
    return [
      Object.freeze({
        familyId,
        availability:
          engines.length > 0 ? ("verified" as const) : ("planned" as const),
        engineIds: engines.map(({ id }) => id),
        skillIds: resolved.map(({ id }) => id)
      })
    ];
  });

  return Object.freeze({
    families,
    unsupportedSkillIds: [...new Set(unsupportedSkillIds)].sort(),
    registrySnapshotIds: {
      engines: engineRegistry.snapshotId,
      skills: skillRegistry.snapshotId
    }
  });
}

function getComponentRegistry(argumentsValue: unknown) {
  const parsed = componentArgumentsSchema.safeParse(argumentsValue);
  if (!parsed.success) {
    toolCallInvalid(
      "getComponentRegistry",
      "Invalid component-registry arguments."
    );
  }
  const requested = new Set(parsed.data.componentIds);
  const entries = componentRegistry
    .list()
    .filter(
      (entry) =>
        includesString(entry.compatibleFamilyIds, parsed.data.familyId) &&
        (requested.size === 0 || requested.has(entry.id))
    );
  const unknownComponentIds = parsed.data.componentIds.filter(
    (componentId) => !componentRegistry.has(componentId)
  );
  return Object.freeze({
    entries,
    unknownComponentIds,
    registrySnapshotId: componentRegistry.snapshotId
  });
}

function getReagentRegistry(argumentsValue: unknown) {
  const parsed = reagentArgumentsSchema.safeParse(argumentsValue);
  if (!parsed.success) {
    toolCallInvalid(
      "getReagentRegistry",
      "Invalid reagent-registry arguments."
    );
  }
  const requested = new Set(parsed.data.reagentIds);
  const entries = reagentRegistry
    .list()
    .filter(
      (entry) =>
        includesString(entry.compatibleFamilyIds, parsed.data.familyId) &&
        (requested.size === 0 || requested.has(entry.id))
    );
  const unknownReagentIds = parsed.data.reagentIds.filter(
    (reagentId) => !reagentRegistry.has(reagentId)
  );
  return Object.freeze({
    entries,
    unknownReagentIds,
    registrySnapshotId: reagentRegistry.snapshotId
  });
}

function getEngineCapabilities(argumentsValue: unknown) {
  const parsed = engineArgumentsSchema.safeParse(argumentsValue);
  if (!parsed.success) {
    toolCallInvalid(
      "getEngineCapabilities",
      "Invalid engine-capability arguments."
    );
  }
  const engines = engineRegistry
    .list()
    .filter(({ familyId }) => familyId === parsed.data.familyId);
  const engineIds = new Set<string>(engines.map(({ id }) => id));
  return Object.freeze({
    engines,
    actions: actionRegistry
      .list()
      .filter(
        (entry) =>
          includesString(entry.compatibleFamilyIds, parsed.data.familyId) &&
          entry.compatibleEngineIds.some((engineId) => engineIds.has(engineId))
      ),
    eventTypes: eventTypeRegistry
      .list()
      .filter((entry) =>
        entry.compatibleEngineIds.some((engineId) => engineIds.has(engineId))
      ),
    eventFlags: eventFlagRegistry
      .list()
      .filter((entry) =>
        entry.compatibleEngineIds.some((engineId) => engineIds.has(engineId))
      ),
    configurations: configurationRegistry
      .list()
      .filter((entry) =>
        includesString(entry.compatibleFamilyIds, parsed.data.familyId)
      ),
    safetyPolicies: safetyRegistry
      .list()
      .filter((entry) =>
        includesString(entry.compatibleFamilyIds, parsed.data.familyId)
      ),
    restrictedSafetyPolicies: safetyRegistry
      .list()
      .filter(({ availability }) => availability === "restricted"),
    registrySnapshotIds: LAB_AUTHORING_REGISTRY_SNAPSHOT_IDS
  });
}

export function executeLabAuthoringRegistryTool(
  name: string,
  argumentsValue: unknown
): unknown {
  if (!labAuthoringToolNameSchema.safeParse(name).success) {
    toolCallInvalid(name, `Tool ${name} is not allowed.`);
  }
  switch (name as LabAuthoringToolName) {
    case "searchSkillRegistry":
      return searchSkillRegistry(argumentsValue);
    case "listSupportedLabFamilies":
      return listSupportedLabFamilies(argumentsValue);
    case "getComponentRegistry":
      return getComponentRegistry(argumentsValue);
    case "getReagentRegistry":
      return getReagentRegistry(argumentsValue);
    case "getEngineCapabilities":
      return getEngineCapabilities(argumentsValue);
  }
}

const REGISTRY_VALUE_KEYS =
  /(?:^id$|Id$|Ids$|semanticEventTypes$|semanticFlags$)/;

/** Collect only ID-bearing fields from an executed tool response. */
export function collectToolReturnedRegistryIds(
  value: unknown,
  ids: Set<string> = new Set(),
  parentKey = ""
): Set<string> {
  if (typeof value === "string") {
    const isUnresolvedEcho =
      parentKey.startsWith("unknown") || parentKey.startsWith("unsupported");
    if (!isUnresolvedEcho && REGISTRY_VALUE_KEYS.test(parentKey)) {
      ids.add(value);
    }
    return ids;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectToolReturnedRegistryIds(item, ids, parentKey);
    }
    return ids;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      collectToolReturnedRegistryIds(child, ids, key);
    }
  }
  return ids;
}
