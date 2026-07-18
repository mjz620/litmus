import {
  CapabilityRegistryError,
  capabilityRegistry as productionCapabilityRegistry,
  type ChemistryCapabilityId
} from "../../capabilities";
import {
  CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES,
  ChemistryModelResolutionError
} from "./errors";
import { chemistryModelRegistry as productionModelRegistry } from "./registry";
import type {
  ChemistryModelId,
  ChemistryModelMetadataEntry,
  ChemistryModelResolution,
  ChemistryModelResolutionOptions
} from "./types";

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort(compareIds);
}

function canonicalizeCycle(
  cycle: readonly ChemistryModelId[]
): readonly ChemistryModelId[] {
  if (cycle.length < 2) return Object.freeze([...cycle]);
  let smallestIndex = 0;
  for (let index = 1; index < cycle.length; index += 1) {
    if (compareIds(cycle[index]!, cycle[smallestIndex]!) < 0) {
      smallestIndex = index;
    }
  }
  return Object.freeze([
    ...cycle.slice(smallestIndex),
    ...cycle.slice(0, smallestIndex)
  ]);
}

function findCycle(
  remainingIds: readonly ChemistryModelId[],
  adjacency: ReadonlyMap<ChemistryModelId, ReadonlySet<ChemistryModelId>>
): readonly ChemistryModelId[] {
  const remaining = new Set(remainingIds);
  const states = new Map<ChemistryModelId, "visiting" | "visited">();
  const stack: ChemistryModelId[] = [];

  function visit(
    modelId: ChemistryModelId
  ): readonly ChemistryModelId[] | null {
    states.set(modelId, "visiting");
    stack.push(modelId);

    const neighbours = [...(adjacency.get(modelId) ?? [])]
      .filter((id) => remaining.has(id))
      .sort(compareIds);
    for (const neighbour of neighbours) {
      const state = states.get(neighbour);
      if (state === "visiting") {
        return canonicalizeCycle(stack.slice(stack.indexOf(neighbour)));
      }
      if (!state) {
        const cycle = visit(neighbour);
        if (cycle) return cycle;
      }
    }

    stack.pop();
    states.set(modelId, "visited");
    return null;
  }

  for (const modelId of [...remainingIds].sort(compareIds)) {
    if (!states.has(modelId)) {
      const cycle = visit(modelId);
      if (cycle) return cycle;
    }
  }
  return Object.freeze([...remainingIds].sort(compareIds));
}

/**
 * Resolves exact verified metadata providers only. It does not import, execute,
 * or infer a chemistry implementation.
 */
export function resolveChemistryModelProviders(
  requiredCapabilityIds: readonly string[],
  options: ChemistryModelResolutionOptions = {}
): ChemistryModelResolution {
  const capabilities =
    options.capabilityRegistry ?? productionCapabilityRegistry;
  const models = options.modelRegistry ?? productionModelRegistry;
  const rootIds = sortedUnique(requiredCapabilityIds);

  const knownRoots: ChemistryCapabilityId[] = [];
  for (const capabilityId of rootIds) {
    try {
      knownRoots.push(capabilities.getChemistry(capabilityId).id);
    } catch (error) {
      if (error instanceof CapabilityRegistryError) {
        throw new ChemistryModelResolutionError(
          CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES.unknownCapability,
          { capabilityId }
        );
      }
      throw error;
    }
  }

  const modelEntries = models
    .list()
    .filter((model) =>
      options.compatibilityRuntimeAdapterId
        ? model.compatibilityRuntimeAdapterId === undefined ||
          model.compatibilityRuntimeAdapterId ===
            options.compatibilityRuntimeAdapterId
        : model.compatibilityRuntimeAdapterId === undefined
    )
    .sort((left, right) => compareIds(left.id, right.id));
  for (const model of modelEntries) {
    for (const capabilityId of sortedUnique([
      ...model.providedCapabilityIds,
      ...model.requiredCapabilityIds
    ])) {
      try {
        capabilities.getChemistry(capabilityId);
      } catch (error) {
        if (error instanceof CapabilityRegistryError) {
          throw new ChemistryModelResolutionError(
            CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES.unknownCapability,
            { capabilityId, modelId: model.id }
          );
        }
        throw error;
      }
    }
  }

  const providersByCapability = new Map<
    ChemistryCapabilityId,
    ChemistryModelMetadataEntry[]
  >();
  for (const model of modelEntries) {
    for (const capabilityId of sortedUnique(model.providedCapabilityIds)) {
      const providers = providersByCapability.get(capabilityId) ?? [];
      providers.push(model);
      providersByCapability.set(capabilityId, providers);
    }
  }

  const roots = new Set<ChemistryCapabilityId>(knownRoots);
  const bindings = new Map<
    ChemistryCapabilityId,
    ChemistryModelMetadataEntry
  >();
  const selectedModels = new Map<
    ChemistryModelId,
    ChemistryModelMetadataEntry
  >();
  const pending: {
    readonly capabilityId: ChemistryCapabilityId;
    readonly requiringModelId?: ChemistryModelId;
  }[] = knownRoots.map((capabilityId) => ({ capabilityId }));

  while (pending.length > 0) {
    pending.sort((left, right) => {
      const capabilityOrder = compareIds(left.capabilityId, right.capabilityId);
      if (capabilityOrder !== 0) return capabilityOrder;
      return compareIds(
        left.requiringModelId ?? "",
        right.requiringModelId ?? ""
      );
    });
    const request = pending.shift()!;
    if (bindings.has(request.capabilityId)) continue;

    const capability = capabilities.getChemistry(request.capabilityId);
    let candidates = [
      ...(providersByCapability.get(request.capabilityId) ?? [])
    ].sort((left, right) => compareIds(left.id, right.id));
    if (options.compatibilityRuntimeAdapterId) {
      const scoped = candidates.filter(
        ({ compatibilityRuntimeAdapterId }) =>
          compatibilityRuntimeAdapterId ===
          options.compatibilityRuntimeAdapterId
      );
      if (scoped.length > 0) candidates = scoped;
    }
    if (candidates.length === 0) {
      throw new ChemistryModelResolutionError(
        roots.has(request.capabilityId)
          ? CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES.missingProvider
          : CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES.unmetDependency,
        {
          capabilityId: request.capabilityId,
          modelId: request.requiringModelId
        }
      );
    }

    const verified = candidates.filter(
      ({ availability }) => availability === "verified"
    );
    if (verified.length === 0) {
      throw new ChemistryModelResolutionError(
        CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES.providerNotVerified,
        {
          capabilityId: request.capabilityId,
          modelId: request.requiringModelId,
          modelIds: candidates.map(({ id }) => id)
        }
      );
    }
    if (capability.providerCardinality === "exclusive" && verified.length > 1) {
      throw new ChemistryModelResolutionError(
        CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES.ambiguousExclusiveProvider,
        {
          capabilityId: request.capabilityId,
          modelIds: verified.map(({ id }) => id)
        }
      );
    }

    const provider = verified[0]!;
    bindings.set(request.capabilityId, provider);
    if (!selectedModels.has(provider.id)) {
      selectedModels.set(provider.id, provider);
      for (const requiredId of sortedUnique(provider.requiredCapabilityIds)) {
        pending.push({
          capabilityId: requiredId,
          requiringModelId: provider.id
        });
      }
    }
  }

  const adjacency = new Map<ChemistryModelId, Set<ChemistryModelId>>();
  const inDegree = new Map<ChemistryModelId, number>();
  for (const modelId of selectedModels.keys()) {
    adjacency.set(modelId, new Set());
    inDegree.set(modelId, 0);
  }
  for (const model of selectedModels.values()) {
    for (const capabilityId of sortedUnique(model.requiredCapabilityIds)) {
      const dependency = bindings.get(capabilityId);
      if (!dependency) {
        throw new ChemistryModelResolutionError(
          CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES.unmetDependency,
          { capabilityId, modelId: model.id }
        );
      }
      const dependants = adjacency.get(dependency.id)!;
      if (!dependants.has(model.id)) {
        dependants.add(model.id);
        inDegree.set(model.id, (inDegree.get(model.id) ?? 0) + 1);
      }
    }
  }

  const ready = [...selectedModels.keys()]
    .filter((modelId) => inDegree.get(modelId) === 0)
    .sort(compareIds);
  const orderedModelIds: ChemistryModelId[] = [];
  while (ready.length > 0) {
    const modelId = ready.shift()!;
    orderedModelIds.push(modelId);
    const dependants = [...(adjacency.get(modelId) ?? [])].sort(compareIds);
    for (const dependantId of dependants) {
      const nextDegree = (inDegree.get(dependantId) ?? 0) - 1;
      inDegree.set(dependantId, nextDegree);
      if (nextDegree === 0) {
        ready.push(dependantId);
        ready.sort(compareIds);
      }
    }
  }

  if (orderedModelIds.length !== selectedModels.size) {
    const remainingIds = [...selectedModels.keys()]
      .filter((modelId) => !orderedModelIds.includes(modelId))
      .sort(compareIds);
    throw new ChemistryModelResolutionError(
      CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES.dependencyCycle,
      {
        modelIds: remainingIds,
        cycleModelIds: findCycle(remainingIds, adjacency)
      }
    );
  }

  const capabilityProviders = Object.freeze(
    [...bindings.entries()]
      .sort(([left], [right]) => compareIds(left, right))
      .map(([capabilityId, model]) =>
        Object.freeze({ capabilityId, modelId: model.id })
      )
  );
  const frozenOrderedIds = Object.freeze([...orderedModelIds]);
  return Object.freeze({
    requiredCapabilityIds: Object.freeze([...knownRoots]),
    capabilityProviders,
    orderedModelIds: frozenOrderedIds,
    orderedModels: Object.freeze(
      frozenOrderedIds.map((modelId) => selectedModels.get(modelId)!)
    )
  });
}
