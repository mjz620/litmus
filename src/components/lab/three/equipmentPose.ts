import type { ResolvedEquipmentPose } from "../../../lab-workflows/registries/scene-placements";
import { ISLAND } from "./benchLayout";

const NATIVE_LOCAL_ORIGIN_ADAPTERS = new Set([
  "visual-adapter.volumetric_pipette.v1",
  "visual-adapter.volumetric_flask.v1",
  "visual-adapter.wash_bottle.v1",
  "visual-adapter.reagent_bottle.v1",
  "visual-adapter.calorimeter.v1",
  "visual-adapter.thermometer.v1"
]);

/**
 * World position for equipment whose meshes are authored at a local origin.
 * Titration legacy adapters still bake absolute bench anchors and keep using
 * `pose.translation` offsets instead.
 */
export function worldPositionForEquipmentPose(
  pose: Readonly<ResolvedEquipmentPose>
): readonly [number, number, number] {
  if (NATIVE_LOCAL_ORIGIN_ADAPTERS.has(pose.visualAdapterDefinitionId)) {
    return [
      pose.footprintCenterXZ[0],
      ISLAND.topY,
      pose.footprintCenterXZ[1]
    ];
  }
  return pose.translation;
}

export function usesLocalOriginMesh(
  visualAdapterDefinitionId: string
): boolean {
  return NATIVE_LOCAL_ORIGIN_ADAPTERS.has(visualAdapterDefinitionId);
}
