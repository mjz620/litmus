import {
  resolveEquipmentPose,
  type ResolvedEquipmentPose
} from "../../../lab-workflows/registries/scene-placements";
import type { SetupDrivenLabProjection } from "../../../stores/setupDrivenLabSession";

/**
 * Resolve every projected equipment instance onto its registered bench pose.
 * Placement geometry is registry-owned; this only looks it up.
 */
export function resolveSetupDrivenPoses(
  projection: Readonly<SetupDrivenLabProjection>
): readonly ResolvedEquipmentPose[] {
  return Object.freeze(
    projection.equipment.map((equipment) =>
      resolveEquipmentPose({
        equipmentInstanceId: equipment.instanceId,
        equipmentDefinitionId: equipment.equipmentDefinitionId,
        visualAdapterDefinitionId: equipment.visualAdapterDefinitionId,
        placementSlotId: equipment.placementSlotId
      })
    )
  );
}
