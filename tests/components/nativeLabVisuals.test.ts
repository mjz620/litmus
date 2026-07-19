import { describe, expect, it } from "vitest";

import { worldPositionForEquipmentPose } from "../../src/components/lab/three/equipmentPose";
import { gestureForNativeAction } from "../../src/components/lab/three/gestures/nativeActionGestures";
import { resolveEquipmentPose } from "../../src/lab-workflows/registries/scene-placements";
import { validateCalorimetryV2 } from "../../src/lab-workflows/definitions/calorimetry";
import { createSetupDrivenNativeSession } from "../../src/stores/setupDrivenLabSession";
import { resolveTitrationSceneConfiguration } from "../../src/components/lab/titration/setupDrivenScene";
import { ISLAND } from "../../src/components/lab/three/benchLayout";

describe("native equipment pose seating", () => {
  it("resolves footprint centers so local-origin meshes sit under hitboxes", () => {
    const pose = resolveEquipmentPose({
      equipmentInstanceId: "coffee_cup",
      equipmentDefinitionId: "component.calorimeter.v1",
      visualAdapterDefinitionId: "visual-adapter.calorimeter.v1",
      placementSlotId: "placement.calorimeter_center.v1"
    });
    expect(pose.footprintCenterXZ).toEqual([0, 0.18]);
    expect(worldPositionForEquipmentPose(pose)).toEqual([
      0,
      ISLAND.topY,
      0.18
    ]);
  });

  it("maps calorimetry pour / mix / lid / probe actions to reusable gestures", () => {
    const workflow = validateCalorimetryV2("2026-07-19T12:00:00.000Z");
    const session = createSetupDrivenNativeSession({
      sessionId: "calorimetry-gesture-test",
      sessionSeed: "calorimetry-gesture-seed",
      selection: {
        workflowId: workflow.id,
        workflowHash: workflow.validation.canonicalSpecHash
      },
      workflow
    });
    const projection = session.getProjection();
    const poses =
      resolveTitrationSceneConfiguration(projection).equipmentPoses;
    const pour = projection.actions.find(
      ({ actionId }) => actionId === "action.pour_liquid.v1"
    );
    expect(pour).toBeDefined();
    expect(
      gestureForNativeAction({
        action: pour!,
        poses,
        sequence: 1,
        projection
      })?.kind
    ).toBe("pour");

    const mix = projection.actions.find(
      ({ actionId }) => actionId === "action.mix_calorimeter.v1"
    );
    if (mix) {
      expect(
        gestureForNativeAction({
          action: mix,
          poses,
          sequence: 2,
          projection
        })?.kind
      ).toBe("mix");
    }

    const lid = projection.actions.find(
      ({ actionId }) => actionId === "action.set_calorimeter_lid.v1"
    );
    if (lid) {
      expect(
        gestureForNativeAction({
          action: lid,
          poses,
          sequence: 3,
          projection
        })?.kind
      ).toBe("lid");
    }

    const probe = projection.actions.find(
      ({ actionId }) => actionId === "action.place_thermometer.v1"
    );
    if (probe) {
      expect(
        gestureForNativeAction({
          action: probe,
          poses,
          sequence: 4,
          projection
        })?.kind
      ).toBe("place_probe");
    }
  });
});
