import type { ResolvedEquipmentPose } from "../../../../lab-workflows/registries/scene-placements";
import type { SetupDrivenLabProjection } from "../../../../stores/setupDrivenLabSession";
import {
  mouthPositionForEquipmentPose,
  worldPositionForEquipmentPose
} from "../equipmentPose";
import type { LabVisualGesture } from "./LabVisualGestures";

function poseForInstance(
  poses: readonly ResolvedEquipmentPose[],
  instanceId: string | null | undefined
): ResolvedEquipmentPose | null {
  if (!instanceId) return null;
  return (
    poses.find((pose) => pose.equipmentInstanceId === instanceId) ?? null
  );
}

function raised(pose: ResolvedEquipmentPose, lift = 0.18) {
  const [x, y, z] = worldPositionForEquipmentPose(pose);
  return [x, y + lift, z] as const;
}

function sourceKindFor(
  pose: ResolvedEquipmentPose
): "wash_bottle" | "generic" {
  return pose.visualAdapterDefinitionId === "visual-adapter.wash_bottle.v1"
    ? "wash_bottle"
    : "generic";
}

/**
 * Map a verified native-lab action onto a gesture-only visual clip. Returns
 * null when the action has no authored motion (still safe to dispatch).
 */
export function gestureForNativeAction(input: {
  readonly action: SetupDrivenLabProjection["actions"][number];
  readonly poses: readonly ResolvedEquipmentPose[];
  readonly sequence: number;
  readonly projection: Readonly<SetupDrivenLabProjection>;
}): LabVisualGesture | null {
  const { action, poses, sequence, projection } = input;
  const source = poseForInstance(poses, action.sourceEquipmentInstanceId);
  const targetId = action.targetEquipmentInstanceIds[0];
  const target = poseForInstance(poses, targetId);

  switch (action.actionId) {
    case "action.pour_liquid.v1":
    case "action.transfer_liquid.v1":
    case "action.rinse_transfer_device.v1":
    case "action.fill_to_mark.v1":
      if (!source || !target) return null;
      return {
        kind: "pour",
        sequence,
        from: worldPositionForEquipmentPose(source),
        // Aim at the receiving vessel's actual rim.
        to: mouthPositionForEquipmentPose(target),
        color: "#8fc9df",
        sourceInstanceId: source.equipmentInstanceId,
        sourceKind: sourceKindFor(source)
      };
    case "action.mix_solution.v1":
    case "action.mix_calorimeter.v1": {
      const vessel =
        target ??
        source ??
        poseForInstance(
          poses,
          projection.equipment.find(
            ({ equipmentDefinitionId }) =>
              equipmentDefinitionId === "component.calorimeter.v1" ||
              equipmentDefinitionId === "component.volumetric_flask.v1"
          )?.instanceId
        );
      if (!vessel) return null;
      return {
        kind: "mix",
        sequence,
        at: worldPositionForEquipmentPose(vessel)
      };
    }
    case "action.set_calorimeter_lid.v1": {
      const calorimeter =
        source ??
        poseForInstance(
          poses,
          projection.equipment.find(
            ({ equipmentDefinitionId }) =>
              equipmentDefinitionId === "component.calorimeter.v1"
          )?.instanceId
        );
      if (!calorimeter) return null;
      const closing = !Boolean(
        projection.equipment.find(
          ({ instanceId }) => instanceId === calorimeter.equipmentInstanceId
        )?.stateFields.lidClosed
      );
      return {
        kind: "lid",
        sequence,
        at: worldPositionForEquipmentPose(calorimeter),
        closing
      };
    }
    case "action.place_thermometer.v1": {
      const probe = source;
      const host = target;
      if (!probe || !host) return null;
      return {
        kind: "place_probe",
        sequence,
        from: raised(probe, 0.12),
        to: raised(host, 0.14)
      };
    }
    default:
      return null;
  }
}
