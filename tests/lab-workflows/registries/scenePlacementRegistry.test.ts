import { describe, expect, it } from "vitest";

import { componentRegistry } from "../../../src/lab-workflows/registries/components";
import { configurationRegistry } from "../../../src/lab-workflows/registries/configurations";
import {
  SCENE_PLACEMENT_REGISTRY_SNAPSHOT_ID,
  defaultPlacementForEquipment,
  placementsForEquipment,
  planVerifiedLayoutMove,
  resolveEquipmentPose,
  rotationAlternatives,
  scenePlacementRegistry,
  scenePlacementsOverlap
} from "../../../src/lab-workflows/registries/scene-placements";

const EQUIPMENT = [
  {
    instanceId: "burette",
    equipmentDefinitionId: "component.burette.v1",
    visualAdapterDefinitionId: "visual-adapter.burette.v1"
  },
  {
    instanceId: "flask",
    equipmentDefinitionId: "component.erlenmeyer_flask.v1",
    visualAdapterDefinitionId: "visual-adapter.erlenmeyer_flask.v1"
  },
  {
    instanceId: "indicator",
    equipmentDefinitionId: "component.indicator_bottle.v1",
    visualAdapterDefinitionId: "visual-adapter.indicator_bottle.v1"
  }
] as const;

const CURRENT_LAYOUT = [
  {
    equipmentInstanceId: "burette",
    placementSlotId: "placement.bench_center_stand.v1"
  },
  {
    equipmentInstanceId: "flask",
    placementSlotId: "placement.under_burette.v1"
  },
  {
    equipmentInstanceId: "indicator",
    placementSlotId: "placement.indicator_shelf.v1"
  }
] as const;

describe("LC2-409 verified scene placement registry", () => {
  it("registers exact code-owned poses that cross-resolve to equipment and layout contracts", () => {
    expect(SCENE_PLACEMENT_REGISTRY_SNAPSHOT_ID).toBe("scene-placements.2.0.0");
    expect(Object.isFrozen(scenePlacementRegistry.list())).toBe(true);

    for (const pose of scenePlacementRegistry.list()) {
      const equipment = componentRegistry.get(pose.equipmentDefinitionId);
      const layout = configurationRegistry.get(pose.id);
      expect(equipment.visualAdapterDefinitionId).toBe(
        pose.visualAdapterDefinitionId
      );
      expect(layout).toMatchObject({
        category: "placement",
        availability: "verified"
      });
      expect(layout.compatibleComponentIds).toContain(
        pose.equipmentDefinitionId
      );
      expect(pose.translation).toHaveLength(3);
      expect(pose.footprintHalfExtentsXZ.every((value) => value > 0)).toBe(
        true
      );
    }
  });

  it("resolves the historical arrangement unchanged and exposes registered rotation only", () => {
    expect(
      resolveEquipmentPose({
        ...EQUIPMENT[0],
        equipmentInstanceId: EQUIPMENT[0].instanceId,
        placementSlotId: "placement.bench_center_stand.v1"
      })
    ).toMatchObject({ translation: [0, 0, 0], yawRadians: 0 });
    expect(
      rotationAlternatives("placement.bench_center_stand.v1").map(
        ({ id }) => id
      )
    ).toEqual([
      "placement.bench_center_stand.v1",
      "placement.bench_center_stand_reversed.v1"
    ]);
    expect(placementsForEquipment("component.burette.v1")).toHaveLength(4);
    expect(defaultPlacementForEquipment("component.burette.v1").id).toBe(
      "placement.bench_center_stand.v1"
    );
  });

  it("moves the burette and receiving flask as one atomic assembly plan", () => {
    const plan = planVerifiedLayoutMove({
      equipment: EQUIPMENT,
      placements: [
        CURRENT_LAYOUT[0],
        CURRENT_LAYOUT[1],
        {
          equipmentInstanceId: "indicator",
          placementSlotId: "placement.indicator_shelf_right.v1"
        }
      ],
      equipmentInstanceId: "burette",
      targetPlacementSlotId: "placement.bench_left_stand.v1"
    });

    expect(plan).toEqual({
      ok: true,
      placements: [
        {
          equipmentInstanceId: "burette",
          placementSlotId: "placement.bench_left_stand.v1"
        },
        {
          equipmentInstanceId: "flask",
          placementSlotId: "placement.under_left_burette.v1"
        },
        {
          equipmentInstanceId: "indicator",
          placementSlotId: "placement.indicator_shelf_right.v1"
        }
      ],
      movedEquipmentInstanceIds: ["burette", "flask"]
    });
  });

  it("rejects incompatible and colliding drops without returning a changed layout", () => {
    expect(
      planVerifiedLayoutMove({
        equipment: EQUIPMENT,
        placements: CURRENT_LAYOUT,
        equipmentInstanceId: "indicator",
        targetPlacementSlotId: "placement.bench_left_stand.v1"
      })
    ).toMatchObject({ ok: false });

    const collision = planVerifiedLayoutMove({
      equipment: EQUIPMENT,
      placements: CURRENT_LAYOUT,
      equipmentInstanceId: "burette",
      targetPlacementSlotId: "placement.bench_left_stand.v1"
    });
    expect(collision).toMatchObject({
      ok: false,
      reason: expect.stringContaining("overlap")
    });
  });

  it("uses footprints deterministically", () => {
    expect(
      scenePlacementsOverlap(
        scenePlacementRegistry.get("placement.bench_left_stand.v1"),
        scenePlacementRegistry.get("placement.indicator_shelf.v1")
      )
    ).toBe(true);
    expect(
      scenePlacementsOverlap(
        scenePlacementRegistry.get("placement.bench_center_stand.v1"),
        scenePlacementRegistry.get("placement.indicator_shelf.v1")
      )
    ).toBe(false);
  });
});
