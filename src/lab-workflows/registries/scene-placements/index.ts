import { createSupportingRegistry } from "../actions";
import { VERIFIED_SCENE_PLACEMENT_ENTRIES } from "./entries";
import type {
  ResolvedEquipmentPose,
  ScenePlacementId,
  VerifiedScenePlacement
} from "./types";

export const SCENE_PLACEMENT_REGISTRY_SNAPSHOT_ID =
  "scene-placements.2.1.0" as const;

export const scenePlacementRegistry = createSupportingRegistry(
  "scene placement",
  SCENE_PLACEMENT_REGISTRY_SNAPSHOT_ID,
  VERIFIED_SCENE_PLACEMENT_ENTRIES
);

export function placementsForEquipment(
  equipmentDefinitionId: string
): readonly VerifiedScenePlacement[] {
  return scenePlacementRegistry
    .list()
    .filter((entry) => entry.equipmentDefinitionId === equipmentDefinitionId);
}

export function defaultPlacementForEquipment(
  equipmentDefinitionId: string
): Readonly<VerifiedScenePlacement> {
  const placement = placementsForEquipment(equipmentDefinitionId)
    .filter(
      ({ translation, rotationOrder }) =>
        translation.every((coordinate) => coordinate === 0) &&
        rotationOrder === 0
    )
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  if (!placement) {
    throw new Error(
      `No default scene placement is registered for ${equipmentDefinitionId}.`
    );
  }
  return placement;
}

export function rotationAlternatives(
  placementSlotId: ScenePlacementId
): readonly VerifiedScenePlacement[] {
  const placement = scenePlacementRegistry.get(placementSlotId);
  return placementsForEquipment(placement.equipmentDefinitionId)
    .filter((entry) => entry.anchorId === placement.anchorId)
    .sort((left, right) => left.rotationOrder - right.rotationOrder);
}

export function resolveEquipmentPose(input: {
  readonly equipmentInstanceId: string;
  readonly equipmentDefinitionId: string;
  readonly visualAdapterDefinitionId: string;
  readonly placementSlotId: string;
}): Readonly<ResolvedEquipmentPose> {
  const placement = scenePlacementRegistry.get(input.placementSlotId);
  if (
    placement.equipmentDefinitionId !== input.equipmentDefinitionId ||
    placement.visualAdapterDefinitionId !== input.visualAdapterDefinitionId
  ) {
    throw new Error(
      `Scene placement ${placement.id} is incompatible with ${input.equipmentDefinitionId}.`
    );
  }
  return Object.freeze({
    equipmentInstanceId: input.equipmentInstanceId,
    equipmentDefinitionId: placement.equipmentDefinitionId,
    visualAdapterDefinitionId: placement.visualAdapterDefinitionId,
    placementSlotId: placement.id,
    anchorId: placement.anchorId,
    assemblyId: placement.assemblyId,
    translation: placement.translation,
    yawRadians: placement.yawRadians,
    footprintCenterXZ: placement.footprintCenterXZ
  });
}

export function scenePlacementsOverlap(
  left: Readonly<VerifiedScenePlacement>,
  right: Readonly<VerifiedScenePlacement>
): boolean {
  const [leftX, leftZ] = left.footprintCenterXZ;
  const [rightX, rightZ] = right.footprintCenterXZ;
  const [leftHalfX, leftHalfZ] = left.footprintHalfExtentsXZ;
  const [rightHalfX, rightHalfZ] = right.footprintHalfExtentsXZ;
  return (
    Math.abs(leftX - rightX) < leftHalfX + rightHalfX &&
    Math.abs(leftZ - rightZ) < leftHalfZ + rightHalfZ
  );
}

export interface VerifiedLayoutEquipment {
  readonly instanceId: string;
  readonly equipmentDefinitionId: string;
  readonly visualAdapterDefinitionId: string;
}

export interface VerifiedLayoutPlacement {
  readonly equipmentInstanceId: string;
  readonly placementSlotId: string;
}

export type VerifiedLayoutMovePlan =
  | {
      readonly ok: true;
      readonly placements: readonly VerifiedLayoutPlacement[];
      readonly movedEquipmentInstanceIds: readonly string[];
    }
  | { readonly ok: false; readonly reason: string };

/**
 * Resolves a teacher gesture to exact registered placements. Linked equipment
 * shares one assembly anchor, and collision checks run before any command is
 * dispatched. No pointer coordinate is accepted or persisted here.
 */
export function planVerifiedLayoutMove(input: {
  readonly equipment: readonly VerifiedLayoutEquipment[];
  readonly placements: readonly VerifiedLayoutPlacement[];
  readonly equipmentInstanceId: string;
  readonly targetPlacementSlotId: string;
}): VerifiedLayoutMovePlan {
  const subject = input.equipment.find(
    ({ instanceId }) => instanceId === input.equipmentInstanceId
  );
  if (!subject)
    return { ok: false, reason: "That equipment is no longer available." };

  let target: VerifiedScenePlacement;
  try {
    target = scenePlacementRegistry.get(input.targetPlacementSlotId);
  } catch {
    return { ok: false, reason: "That bench position is not supported." };
  }
  if (
    target.equipmentDefinitionId !== subject.equipmentDefinitionId ||
    target.visualAdapterDefinitionId !== subject.visualAdapterDefinitionId
  ) {
    return {
      ok: false,
      reason: "That equipment cannot be used in this bench position."
    };
  }

  const currentByInstance = new Map(
    input.placements.map((placement) => [
      placement.equipmentInstanceId,
      placement
    ])
  );
  const currentSubject = currentByInstance.get(subject.instanceId);
  let currentSubjectPose: VerifiedScenePlacement | null = null;
  if (currentSubject) {
    try {
      currentSubjectPose = scenePlacementRegistry.get(
        currentSubject.placementSlotId
      );
    } catch {
      currentSubjectPose = null;
    }
  }

  const moved = new Map<string, string>([[subject.instanceId, target.id]]);
  if (
    target.assemblyId &&
    currentSubjectPose?.assemblyId === target.assemblyId
  ) {
    for (const equipment of input.equipment) {
      if (equipment.instanceId === subject.instanceId) continue;
      const placement = currentByInstance.get(equipment.instanceId);
      if (!placement) continue;
      let currentPose: VerifiedScenePlacement;
      try {
        currentPose = scenePlacementRegistry.get(placement.placementSlotId);
      } catch {
        continue;
      }
      if (
        currentPose.assemblyId !== target.assemblyId ||
        currentPose.anchorId !== currentSubjectPose.anchorId
      ) {
        continue;
      }
      const linkedTarget = scenePlacementRegistry
        .list()
        .find(
          (candidate) =>
            candidate.equipmentDefinitionId ===
              equipment.equipmentDefinitionId &&
            candidate.visualAdapterDefinitionId ===
              equipment.visualAdapterDefinitionId &&
            candidate.assemblyId === target.assemblyId &&
            candidate.anchorId === target.anchorId
        );
      if (!linkedTarget) {
        return {
          ok: false,
          reason:
            "The linked equipment has no safe position at that workstation."
        };
      }
      moved.set(equipment.instanceId, linkedTarget.id);
    }
  }

  const placements = input.placements.map((placement) => ({
    equipmentInstanceId: placement.equipmentInstanceId,
    placementSlotId:
      moved.get(placement.equipmentInstanceId) ?? placement.placementSlotId
  }));
  const resolved = placements.map((placement) => ({
    ...placement,
    pose: scenePlacementRegistry.get(placement.placementSlotId)
  }));
  for (let leftIndex = 0; leftIndex < resolved.length; leftIndex += 1) {
    const left = resolved[leftIndex]!;
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < resolved.length;
      rightIndex += 1
    ) {
      const right = resolved[rightIndex]!;
      const alignedAssembly =
        left.pose.assemblyId !== null &&
        left.pose.assemblyId === right.pose.assemblyId &&
        left.pose.anchorId === right.pose.anchorId &&
        left.pose.equipmentDefinitionId !== right.pose.equipmentDefinitionId;
      if (!alignedAssembly && scenePlacementsOverlap(left.pose, right.pose)) {
        return {
          ok: false,
          reason: `${right.pose.displayName} would overlap ${left.pose.displayName}.`
        };
      }
    }
  }

  return {
    ok: true,
    placements: Object.freeze(placements),
    movedEquipmentInstanceIds: Object.freeze([...moved.keys()])
  };
}

export { VERIFIED_SCENE_PLACEMENT_ENTRIES } from "./entries";
export type {
  ResolvedEquipmentPose,
  SceneAnchorId,
  SceneAssemblyId,
  ScenePlacementId,
  SceneVector2,
  SceneVector3,
  VerifiedScenePlacement
} from "./types";
