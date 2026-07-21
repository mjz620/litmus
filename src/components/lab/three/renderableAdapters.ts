import { LAB_VISUAL_ADAPTERS } from "../titration/setupDrivenScene";
import { usesLocalOriginMesh } from "./equipmentPose";

/**
 * Visual adapters that `LabScene` actually draws.
 *
 * Adding equipment touches several maps, and two of them fail *silently*:
 * omit the LabScene render block and the equipment simply does not appear;
 * omit the local-origin pose entry and it renders at the world origin. Neither
 * throws. This list is the declaration of what LabScene renders, so a test can
 * assert the maps agree instead of a student finding an invisible beaker.
 *
 * Keep an entry here for every adapter with a render block in `LabScene`.
 */
export const RENDERABLE_VISUAL_ADAPTER_IDS: readonly string[] = Object.freeze([
  "visual-adapter.burette.v1",
  "visual-adapter.erlenmeyer_flask.v1",
  "visual-adapter.indicator_bottle.v1",
  "visual-adapter.reagent_bottle.v1",
  "visual-adapter.volumetric_pipette.v1",
  "visual-adapter.volumetric_flask.v1",
  "visual-adapter.wash_bottle.v1",
  "visual-adapter.calorimeter.v1",
  "visual-adapter.thermometer.v1",
  "visual-adapter.beaker.v1",
  "visual-adapter.balance.v1",
  "visual-adapter.weighing_boat.v1"
]);

export interface VisualAdapterWiringGap {
  readonly visualAdapterDefinitionId: string;
  readonly reason:
    | "missing_scene_registration"
    | "missing_render_block"
    | "missing_local_origin_pose";
}

/**
 * Report adapters whose wiring is incomplete. Returns an empty array when
 * every registered adapter is both selectable and drawable.
 */
export function findVisualAdapterWiringGaps(
  visualAdapterDefinitionIds: readonly string[]
): readonly VisualAdapterWiringGap[] {
  const gaps: VisualAdapterWiringGap[] = [];

  for (const visualAdapterDefinitionId of visualAdapterDefinitionIds) {
    if (!LAB_VISUAL_ADAPTERS[visualAdapterDefinitionId]) {
      gaps.push({
        visualAdapterDefinitionId,
        reason: "missing_scene_registration"
      });
      continue;
    }
    if (!RENDERABLE_VISUAL_ADAPTER_IDS.includes(visualAdapterDefinitionId)) {
      gaps.push({ visualAdapterDefinitionId, reason: "missing_render_block" });
    }
  }

  return gaps;
}

/**
 * Titration-era adapters that legitimately seat from `pose.translation`,
 * because their meshes bake absolute bench anchors rather than a local origin.
 */
const LEGACY_TRANSLATION_ADAPTER_IDS: readonly string[] = Object.freeze([
  "visual-adapter.burette.v1",
  "visual-adapter.erlenmeyer_flask.v1",
  "visual-adapter.indicator_bottle.v1"
]);

/**
 * Adapters that are neither local-origin nor a known legacy anchor. A new
 * adapter omitted from `NATIVE_LOCAL_ORIGIN_ADAPTERS` falls back to
 * `pose.translation`, which for a modern placement is [0, 0, 0] — so it
 * renders in the middle of the room instead of on its bench slot.
 */
export function findMisseatedAdapters(
  visualAdapterDefinitionIds: readonly string[]
): readonly string[] {
  return visualAdapterDefinitionIds.filter(
    (visualAdapterDefinitionId) =>
      RENDERABLE_VISUAL_ADAPTER_IDS.includes(visualAdapterDefinitionId) &&
      !LEGACY_TRANSLATION_ADAPTER_IDS.includes(visualAdapterDefinitionId) &&
      !usesLocalOriginMesh(visualAdapterDefinitionId)
  );
}
