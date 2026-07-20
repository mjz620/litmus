import type { ResolvedEquipmentPose } from "../../../lab-workflows/registries/scene-placements";
import { BEAKER_MOUTH_Y } from "./Beaker";
import { ISLAND } from "./benchLayout";

const NATIVE_LOCAL_ORIGIN_ADAPTERS = new Set([
  "visual-adapter.volumetric_pipette.v1",
  "visual-adapter.volumetric_flask.v1",
  "visual-adapter.wash_bottle.v1",
  "visual-adapter.reagent_bottle.v1",
  "visual-adapter.calorimeter.v1",
  "visual-adapter.thermometer.v1",
  "visual-adapter.beaker.v1"
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

/**
 * Height of each vessel's opening above its own origin, measured from the
 * meshes in `SolutionPreparationEquipment`. Pours aim here so the stream meets
 * the rim; a single shared lift constant would land inside the glass on tall
 * equipment and hover above short equipment.
 */
const VESSEL_MOUTH_Y: Readonly<Record<string, number>> = Object.freeze({
  "visual-adapter.beaker.v1": BEAKER_MOUTH_Y,
  "visual-adapter.volumetric_flask.v1": 0.41,
  "visual-adapter.calorimeter.v1": 0.17,
  "visual-adapter.reagent_bottle.v1": 0.28,
  "visual-adapter.volumetric_pipette.v1": 0.63,
  "visual-adapter.wash_bottle.v1": 0.24
});

const DEFAULT_MOUTH_Y = 0.2;

/** World position of a vessel's opening — the point a pour should meet. */
export function mouthPositionForEquipmentPose(
  pose: Readonly<ResolvedEquipmentPose>
): readonly [number, number, number] {
  const [x, y, z] = worldPositionForEquipmentPose(pose);
  const mouthY = VESSEL_MOUTH_Y[pose.visualAdapterDefinitionId];
  return [x, y + (mouthY ?? DEFAULT_MOUTH_Y), z];
}
