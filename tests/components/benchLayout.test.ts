import { describe, expect, it } from "vitest";

import {
  BENCH_ALCOVE,
  BENCH_SINK,
  BENCH_VIEW,
  BURETTE,
  CAMERA_POSES,
  CLASSROOM_FIXTURES,
  EQUIPMENT_ANCHOR,
  FLASK,
  FLASK_RIM_Y,
  ISLAND,
  LOOK_LIMITS,
  ROOM,
  ROOM_SHELL,
  ROOM_TRIM,
  SHELF,
  SKY_DOME,
  STAND,
  TILE,
  WASH,
  WALLS,
  getBuretteLiquidTopY,
  getMeniscusCameraPose,
  overviewPoseForBenchContents,
  type BenchContentItem
} from "../../src/components/lab/three/benchLayout";

const degrees = (radians: number) => (radians * 180) / Math.PI;
const BURETTE_FOCUS_FOV_RAD = (42 * Math.PI) / 180;

function topFrustumYAtBackWall(
  pose: (typeof CAMERA_POSES)[keyof typeof CAMERA_POSES]
) {
  const forwardDelta = pose.target.map(
    (coordinate, index) => coordinate - pose.position[index]!
  );
  const forwardLength = Math.hypot(...forwardDelta);
  const forward = forwardDelta.map((coordinate) => coordinate / forwardLength);
  const rightLength = Math.hypot(forward[2]!, forward[0]!);
  const right = [-forward[2]! / rightLength, 0, forward[0]! / rightLength];
  const cameraUp = [
    right[1]! * forward[2]! - right[2]! * forward[1]!,
    right[2]! * forward[0]! - right[0]! * forward[2]!,
    right[0]! * forward[1]! - right[1]! * forward[0]!
  ];
  const halfFov = BURETTE_FOCUS_FOV_RAD / 2;
  const topRay = forward.map(
    (coordinate, index) =>
      coordinate * Math.cos(halfFov) + cameraUp[index]! * Math.sin(halfFov)
  );
  const distanceAlongRay = (ROOM.backWallZ - pose.position[2]) / topRay[2]!;

  return pose.position[1] + topRay[1]! * distanceAlongRay;
}

function verticalNdcForPose(
  point: readonly [number, number, number],
  pose: (typeof CAMERA_POSES)["burette"]
): number {
  const forwardDelta = pose.target.map(
    (coordinate, index) => coordinate - pose.position[index]!
  );
  const forwardLength = Math.hypot(...forwardDelta);
  const forward = forwardDelta.map((coordinate) => coordinate / forwardLength);
  const rightLength = Math.hypot(forward[2]!, forward[0]!);
  const right = [-forward[2]! / rightLength, 0, forward[0]! / rightLength];
  const cameraUp = [
    right[1]! * forward[2]! - right[2]! * forward[1]!,
    right[2]! * forward[0]! - right[0]! * forward[2]!,
    right[0]! * forward[1]! - right[1]! * forward[0]!
  ];
  const relative = point.map(
    (coordinate, index) => coordinate - pose.position[index]!
  );
  const depth = relative.reduce(
    (sum, coordinate, index) => sum + coordinate * forward[index]!,
    0
  );
  const vertical = relative.reduce(
    (sum, coordinate, index) => sum + coordinate * cameraUp[index]!,
    0
  );

  expect(depth).toBeGreaterThan(0);
  return vertical / (depth * Math.tan(BURETTE_FOCUS_FOV_RAD / 2));
}

describe("bench layout geometry invariants", () => {
  it("keeps the burette tip strictly above the flask opening", () => {
    expect(BURETTE.tipBottomY).toBeGreaterThan(FLASK_RIM_Y);
    expect(BURETTE.tipBottomY - FLASK_RIM_Y).toBeCloseTo(
      BURETTE.tipClearance,
      10
    );
    expect(BURETTE.tipClearance).toBeGreaterThan(0);
  });

  it("aligns the burette tip over the flask mouth so titrant lands inside", () => {
    const horizontalOffset = Math.hypot(
      BURETTE.x - FLASK.x,
      BURETTE.z - FLASK.z
    );

    expect(horizontalOffset + BURETTE.tipRadius).toBeLessThan(
      FLASK.mouthRadius
    );
  });

  it("stacks every lower burette segment on an exact shared Y boundary", () => {
    expect(BURETTE.tipTopY).toBeGreaterThan(BURETTE.tipBottomY);
    expect(BURETTE.tipTopY).toBeCloseTo(BURETTE.stopcockHousingBottomY, 10);
    expect(BURETTE.stopcockHousingTopY).toBeCloseTo(
      BURETTE.junctionBottomY,
      10
    );
    expect(BURETTE.junctionTopY).toBeCloseTo(BURETTE.tubeBottomY, 10);
    expect(BURETTE.tubeTopY).toBeGreaterThan(BURETTE.tubeBottomY);
  });

  it("matches radii at every lower burette segment boundary", () => {
    expect(BURETTE.tipTopRadius).toBeCloseTo(BURETTE.stopcockHousingRadius, 10);
    expect(BURETTE.stopcockHousingRadius).toBeCloseTo(
      BURETTE.junctionBottomRadius,
      10
    );
    expect(BURETTE.junctionTopRadius).toBeCloseTo(BURETTE.tubeRadius, 10);
  });

  it("keeps every lower assembly segment physically non-zero", () => {
    expect(BURETTE.tipHeight).toBeGreaterThan(0);
    expect(BURETTE.stopcockHousingHeight).toBeGreaterThan(0);
    expect(BURETTE.junctionHeight).toBeGreaterThan(0);
    expect(BURETTE.stopcockHousingCenterY).toBeCloseTo(
      (BURETTE.stopcockHousingBottomY + BURETTE.stopcockHousingTopY) / 2,
      10
    );
    expect(BURETTE.junctionCenterY).toBeCloseTo(
      (BURETTE.junctionBottomY + BURETTE.junctionTopY) / 2,
      10
    );
  });

  it("preserves the established outlet, tube, and graduation coordinates", () => {
    expect(BURETTE.tipBottomY).toBeCloseTo(1.17, 10);
    expect(BURETTE.tubeBottomY).toBeCloseTo(1.26, 10);
    expect(BURETTE.tubeTopY).toBeCloseTo(1.9, 10);
    expect(BURETTE.graduationTopY).toBeCloseTo(1.83, 10);
    expect(BURETTE.graduationBottomY).toBeCloseTo(1.33, 10);
    expect(BURETTE.graduationLength).toBeCloseTo(0.5, 10);
  });

  it("keeps the compatibility stopcock aliases on the rebuilt housing", () => {
    expect(BURETTE.stopcockCenterY).toBeCloseTo(
      BURETTE.stopcockHousingCenterY,
      10
    );
    expect(BURETTE.stopcockHeight).toBeCloseTo(
      BURETTE.stopcockHousingHeight,
      10
    );
    expect(BURETTE.stopcockCenterY - BURETTE.stopcockHeight / 2).toBeCloseTo(
      BURETTE.tipTopY,
      10
    );
    expect(BURETTE.stopcockCenterY + BURETTE.stopcockHeight / 2).toBeCloseTo(
      BURETTE.junctionBottomY,
      10
    );
    expect(BURETTE.tubeBottomY).toBeCloseTo(BURETTE.junctionTopY, 10);
  });

  it("keeps the horizontal stopcock barrel inside its glass housing", () => {
    expect(BURETTE.stopcockBarrelRadius).toBeLessThan(
      BURETTE.stopcockHousingRadius
    );
    expect(BURETTE.stopcockBodyRadius).toBeCloseTo(
      BURETTE.stopcockBarrelRadius,
      10
    );
    expect(BURETTE.stopcockBarrelLength).toBeGreaterThan(
      BURETTE.stopcockHousingRadius * 2
    );
    expect(BURETTE.stopcockHandleLength).toBeGreaterThan(0);
  });

  it("fills the original lower-assembly reservation without a gap", () => {
    expect(
      BURETTE.tipHeight + BURETTE.stopcockHousingHeight + BURETTE.junctionHeight
    ).toBeCloseTo(BURETTE.tubeBottomY - BURETTE.tipBottomY, 10);
  });

  it("never lets the flask body intersect the burette tube", () => {
    expect(FLASK_RIM_Y).toBeLessThan(BURETTE.tipBottomY);
    expect(FLASK.baseY + FLASK.bodyHeight).toBeLessThan(BURETTE.tipBottomY);
  });

  it("rests the flask and stand on island surfaces", () => {
    expect(TILE.topY).toBeCloseTo(ISLAND.topY + TILE.thickness, 10);
    expect(FLASK.baseY).toBeCloseTo(TILE.topY, 10);
    expect(STAND.rodBottomY).toBeCloseTo(ISLAND.topY + STAND.baseThickness, 10);
    expect(STAND.baseTopY).toBeCloseTo(ISLAND.topY + STAND.baseThickness, 10);
  });

  it("keeps the indicator shelf and wash station on the island", () => {
    const islandMinX = ISLAND.centerX - ISLAND.topWidth / 2;
    const islandMaxX = ISLAND.centerX + ISLAND.topWidth / 2;
    const islandMinZ = ISLAND.centerZ - ISLAND.topDepth / 2;
    const islandMaxZ = ISLAND.centerZ + ISLAND.topDepth / 2;

    expect(SHELF.baseY).toBeCloseTo(ISLAND.topY, 10);
    expect(SHELF.x - SHELF.width / 2).toBeGreaterThan(islandMinX);
    expect(SHELF.x + SHELF.width / 2).toBeLessThan(islandMaxX);
    expect(SHELF.z - SHELF.depth / 2).toBeGreaterThan(islandMinZ);
    expect(SHELF.z + SHELF.depth / 2).toBeLessThan(islandMaxZ);

    expect(WASH.baseY).toBeCloseTo(ISLAND.topY, 10);
    expect(WASH.x - WASH.width / 2).toBeGreaterThan(islandMinX);
    expect(WASH.x + WASH.width / 2).toBeLessThan(islandMaxX);
    expect(WASH.z - WASH.depth / 2).toBeGreaterThan(islandMinZ);
    expect(WASH.z + WASH.depth / 2).toBeLessThan(islandMaxZ);
  });

  it("integrates the sink into the student island without crowding equipment", () => {
    const islandMinX = ISLAND.centerX - ISLAND.topWidth / 2;
    const islandMaxX = ISLAND.centerX + ISLAND.topWidth / 2;
    const islandMinZ = ISLAND.centerZ - ISLAND.topDepth / 2;
    const islandMaxZ = ISLAND.centerZ + ISLAND.topDepth / 2;
    const sinkMaxX = BENCH_SINK.x + BENCH_SINK.width / 2;
    const sinkMaxZ = BENCH_SINK.z + BENCH_SINK.depth / 2;

    expect(BENCH_SINK.baseY).toBeCloseTo(ISLAND.topY, 10);
    expect(BENCH_SINK.x - BENCH_SINK.width / 2).toBeGreaterThan(islandMinX);
    expect(sinkMaxX).toBeLessThan(islandMaxX);
    expect(BENCH_SINK.z - BENCH_SINK.depth / 2).toBeGreaterThan(islandMinZ);
    expect(sinkMaxZ).toBeLessThan(islandMaxZ);
    expect(sinkMaxX).toBeLessThan(SHELF.x - SHELF.width / 2);
    expect(sinkMaxZ).toBeLessThan(SHELF.z - SHELF.depth / 2);
  });

  it("keeps the close alcove dressing on its wall and island", () => {
    expect(
      BENCH_ALCOVE.muralCenterX - BENCH_ALCOVE.muralWidth / 2
    ).toBeGreaterThan(-ROOM.sideWallX);
    expect(
      BENCH_ALCOVE.muralCenterX + BENCH_ALCOVE.muralWidth / 2
    ).toBeLessThan(ROOM.sideWallX);
    expect(
      BENCH_ALCOVE.muralCenterY + BENCH_ALCOVE.muralHeight / 2
    ).toBeLessThan(WALLS.bodyHeight);
    expect(BENCH_ALCOVE.splashbackWidth).toBeLessThan(ISLAND.topWidth);
    expect(BENCH_ALCOVE.splashbackCenterZ).toBeGreaterThan(
      ISLAND.centerZ - ISLAND.topDepth / 2
    );
  });

  it("aims the new focus poses at their physical equipment", () => {
    expect(CAMERA_POSES.indicatorShelf.target[0]).toBeCloseTo(SHELF.x, 10);
    expect(CAMERA_POSES.indicatorShelf.target[2]).toBeCloseTo(SHELF.z, 10);
    expect(CAMERA_POSES.washStation.target[0]).toBeCloseTo(WASH.x, 10);
    expect(CAMERA_POSES.washStation.target[2]).toBeCloseTo(WASH.z, 10);
  });

  it("fits the burette tube top and flask base inside the 42 degree focus frustum", () => {
    const pose = CAMERA_POSES.burette;
    const tubeTopNdcY = verticalNdcForPose(
      [BURETTE.x, BURETTE.tubeTopY, BURETTE.z],
      pose
    );
    const flaskBaseNdcY = verticalNdcForPose(
      [FLASK.x, FLASK.baseY, FLASK.z],
      pose
    );

    expect(tubeTopNdcY).toBeGreaterThan(flaskBaseNdcY);
    expect(Math.abs(tubeTopNdcY)).toBeLessThan(0.95);
    expect(Math.abs(flaskBaseNdcY)).toBeLessThan(0.95);
  });

  it("keeps the stand rod tall enough to clamp the tube", () => {
    expect(STAND.rodTopY).toBeGreaterThan(STAND.clampY);
    expect(STAND.clampY).toBeGreaterThan(BURETTE.tubeBottomY);
    expect(STAND.clampY).toBeLessThan(BURETTE.tubeTopY);
  });

  it("keeps the graduated span inside the glass tube", () => {
    expect(BURETTE.graduationTopY).toBeLessThan(BURETTE.tubeTopY);
    expect(BURETTE.graduationBottomY).toBeGreaterThan(BURETTE.tubeBottomY);
    expect(BURETTE.graduationLength).toBeGreaterThan(0);
  });

  it("keeps equipment and every authored camera inside the sealed room", () => {
    expect(BURETTE.tubeTopY).toBeLessThan(ROOM.ceilingY);
    expect(STAND.rodTopY).toBeLessThan(ROOM.ceilingY);
    expect(EQUIPMENT_ANCHOR.z).toBeGreaterThan(ROOM.backWallZ);

    for (const pose of Object.values(CAMERA_POSES)) {
      expect(pose.position[0]).toBeGreaterThan(-ROOM.sideWallX);
      expect(pose.position[0]).toBeLessThan(ROOM.sideWallX);
      expect(pose.position[1]).toBeGreaterThan(ROOM.floorY);
      expect(pose.position[1]).toBeLessThan(ROOM.ceilingY);
      expect(pose.position[2]).toBeGreaterThan(ROOM.backWallZ);
      expect(pose.position[2]).toBeLessThan(ROOM.frontWallZ);
    }
  });

  it("joins the wall cap and ceiling at the shared wall height", () => {
    expect(WALLS.height).toBeCloseTo(3, 10);
    expect(WALLS.bodyHeight + WALLS.trimHeight).toBeCloseTo(WALLS.height, 10);
    expect(WALLS.fixtureTopY).toBeLessThan(WALLS.bodyHeight);
    expect(BURETTE.tubeTopY).toBeLessThanOrEqual(WALLS.height);
    expect(STAND.rodTopY).toBeLessThanOrEqual(WALLS.height);
    expect(WALLS.height).toBeLessThan(ROOM.ceilingY);
    const ceiling = ROOM_SHELL.find(({ id }) => id === "ceiling")!;
    expect(ceiling.position[1] - ceiling.size[1] / 2).toBeCloseTo(
      WALLS.height,
      10
    );
  });

  it("keeps every authored focus frustum on the wall below the ceiling", () => {
    for (const pose of Object.values(CAMERA_POSES)) {
      expect(topFrustumYAtBackWall(pose)).toBeLessThan(WALLS.bodyHeight);
    }
  });

  it("defines all six room boundaries including the formerly missing right wall", () => {
    expect(ROOM.frontWallZ).toBeCloseTo(ROOM.backWallZ + ROOM.depth, 10);
    expect(ROOM_SHELL.map(({ id }) => id).sort()).toEqual([
      "back-wall",
      "ceiling",
      "floor",
      "front-wall",
      "left-wall",
      "right-wall"
    ]);

    const leftWall = ROOM_SHELL.find(({ id }) => id === "left-wall")!;
    const rightWall = ROOM_SHELL.find(({ id }) => id === "right-wall")!;
    expect(leftWall.position[0]).toBeCloseTo(-ROOM.sideWallX, 10);
    expect(rightWall.position[0]).toBeCloseTo(ROOM.sideWallX, 10);
    expect(leftWall.size).toEqual(rightWall.size);
    expect(rightWall.size[2]).toBeCloseTo(ROOM.depth, 10);
  });

  it("runs continuous cap trim and baseboards around all four walls", () => {
    expect(ROOM_TRIM.filter(({ kind }) => kind === "cap")).toHaveLength(4);
    expect(ROOM_TRIM.filter(({ kind }) => kind === "baseboard")).toHaveLength(
      4
    );
    expect(ROOM_TRIM.map(({ id }) => id)).toContain("right-cap");
    expect(ROOM_TRIM.map(({ id }) => id)).toContain("right-baseboard");
  });

  it("keeps the secondary classroom fixtures inside the room shell", () => {
    const counter = CLASSROOM_FIXTURES.serviceCounter;
    const storage = CLASSROOM_FIXTURES.sideStorage;
    const safety = CLASSROOM_FIXTURES.safetyPanel;

    expect(counter.x - counter.width / 2).toBeGreaterThan(-ROOM.sideWallX);
    expect(counter.x + counter.width / 2).toBeLessThan(ROOM.sideWallX);
    expect(counter.z - counter.depth / 2).toBeGreaterThan(ROOM.backWallZ);
    expect(storage.x + storage.width / 2).toBeLessThanOrEqual(ROOM.sideWallX);
    expect(storage.height).toBeLessThan(WALLS.bodyHeight);
    expect(safety.x).toBeLessThan(ROOM.sideWallX);
    expect(safety.y + safety.height / 2).toBeLessThan(WALLS.bodyHeight);
  });

  it("keeps the sky dome well outside the room shell", () => {
    expect(SKY_DOME.radius).toBeGreaterThan(ROOM.width);
    expect(SKY_DOME.radius).toBeGreaterThan(ROOM.depth);
    expect(SKY_DOME.widthSegments).toBe(16);
    expect(SKY_DOME.heightSegments).toBe(12);
  });

  it("keeps the fixed standing bench view inside the room", () => {
    const roomFrontZ = ROOM.backWallZ + ROOM.depth;

    expect(BENCH_VIEW.position[0]).toBeGreaterThan(-ROOM.sideWallX);
    expect(BENCH_VIEW.position[0]).toBeLessThan(ROOM.sideWallX);
    expect(BENCH_VIEW.position[1]).toBeGreaterThan(ROOM.floorY);
    expect(BENCH_VIEW.position[1]).toBeLessThan(WALLS.height);
    expect(BENCH_VIEW.position[2]).toBeGreaterThan(ROOM.backWallZ);
    expect(BENCH_VIEW.position[2]).toBeLessThan(roomFrontZ);
    expect(CAMERA_POSES.overview).toBe(BENCH_VIEW);
  });

  it("aims the neutral bench target over the island", () => {
    const islandMinX = ISLAND.centerX - ISLAND.topWidth / 2;
    const islandMaxX = ISLAND.centerX + ISLAND.topWidth / 2;
    const islandMinZ = ISLAND.centerZ - ISLAND.topDepth / 2;
    const islandMaxZ = ISLAND.centerZ + ISLAND.topDepth / 2;

    expect(BENCH_VIEW.target[0]).toBeCloseTo(EQUIPMENT_ANCHOR.x, 10);
    expect(BENCH_VIEW.target[0]).toBeGreaterThan(islandMinX);
    expect(BENCH_VIEW.target[0]).toBeLessThan(islandMaxX);
    expect(BENCH_VIEW.target[1]).toBeGreaterThan(ISLAND.topY);
    expect(BENCH_VIEW.target[1]).toBeLessThan(WALLS.height);
    expect(BENCH_VIEW.target[2]).toBeCloseTo(EQUIPMENT_ANCHOR.z, 10);
    expect(BENCH_VIEW.target[2]).toBeGreaterThan(islandMinZ);
    expect(BENCH_VIEW.target[2]).toBeLessThan(islandMaxZ);
  });

  it("bounds look offsets within the sealed side walls", () => {
    const deltaX = BENCH_VIEW.target[0] - BENCH_VIEW.position[0];
    const deltaY = BENCH_VIEW.target[1] - BENCH_VIEW.position[1];
    const deltaZ = BENCH_VIEW.target[2] - BENCH_VIEW.position[2];
    const neutralYaw = Math.atan2(deltaX, -deltaZ);
    const neutralPitch = Math.atan2(deltaY, Math.hypot(deltaX, deltaZ));
    const highestPitch = neutralPitch + LOOK_LIMITS.maxPitch;
    const distanceToBackWall = BENCH_VIEW.position[2] - ROOM.backWallZ;

    expect(degrees(LOOK_LIMITS.minYaw)).toBeCloseTo(-55, 10);
    expect(degrees(LOOK_LIMITS.maxYaw)).toBeCloseTo(55, 10);
    expect(degrees(LOOK_LIMITS.minPitch)).toBeCloseTo(-35, 10);
    expect(degrees(LOOK_LIMITS.maxPitch)).toBeCloseTo(20, 10);

    for (const yawOffset of [LOOK_LIMITS.minYaw, LOOK_LIMITS.maxYaw]) {
      const yaw = neutralYaw + yawOffset;
      const pitch = highestPitch;
      const directionX = Math.sin(yaw) * Math.cos(pitch);
      const directionY = Math.sin(pitch);
      const directionZ = -Math.cos(yaw) * Math.cos(pitch);
      const sideX = directionX < 0 ? -ROOM.sideWallX : ROOM.sideWallX;
      const distanceToSide = (sideX - BENCH_VIEW.position[0]) / directionX;
      const sideIntersectionY =
        BENCH_VIEW.position[1] + directionY * distanceToSide;
      const sideIntersectionZ =
        BENCH_VIEW.position[2] + directionZ * distanceToSide;
      const distanceAlongRay = distanceToBackWall / Math.cos(yaw);
      const wallTopPitch = Math.atan2(
        WALLS.height - BENCH_VIEW.position[1],
        distanceAlongRay
      );

      expect(Math.abs(yaw)).toBeLessThan(Math.PI / 2);
      expect(highestPitch).toBeLessThan(wallTopPitch);
      expect(distanceToSide).toBeGreaterThan(0);
      expect(sideIntersectionY).toBeGreaterThan(ROOM.floorY);
      expect(sideIntersectionY).toBeLessThan(WALLS.height);
      expect(sideIntersectionZ).toBeGreaterThan(ROOM.backWallZ);
      expect(sideIntersectionZ).toBeLessThan(ROOM.frontWallZ);
    }
  });
});

describe("burette liquid level projection", () => {
  it("places a full burette at the top graduation", () => {
    expect(getBuretteLiquidTopY(50, 50)).toBeCloseTo(
      BURETTE.graduationTopY,
      10
    );
  });

  it("keeps the existing midpoint projection unchanged", () => {
    expect(getBuretteLiquidTopY(25, 50)).toBeCloseTo(1.58, 10);
  });

  it("places a fully delivered burette at the bottom graduation", () => {
    expect(getBuretteLiquidTopY(1e-9, 50)).toBeCloseTo(
      BURETTE.graduationBottomY,
      6
    );
  });

  it("descends monotonically as titrant is delivered", () => {
    const levels = [50, 40, 25, 10, 1].map((available) =>
      getBuretteLiquidTopY(available, 50)
    );

    for (let index = 1; index < levels.length; index += 1) {
      expect(levels[index]!).toBeLessThan(levels[index - 1]!);
    }
  });

  it("hides the liquid column for empty or invalid volumes", () => {
    expect(getBuretteLiquidTopY(0, 50)).toBeNull();
    expect(getBuretteLiquidTopY(-1, 50)).toBeNull();
    expect(getBuretteLiquidTopY(Number.NaN, 50)).toBeNull();
    expect(getBuretteLiquidTopY(10, 0)).toBeNull();
  });
});

describe("meniscus camera pose", () => {
  it("follows the bottom of the concave liquid surface at eye level", () => {
    const liquidY = getBuretteLiquidTopY(25, 50)!;
    const pose = getMeniscusCameraPose(liquidY);

    expect(BURETTE.meniscusRise).toBeGreaterThan(0);
    expect(liquidY + BURETTE.meniscusRise).toBeGreaterThan(liquidY);
    expect(pose.position[1]).toBeCloseTo(liquidY, 10);
    expect(pose.target[1]).toBeCloseTo(liquidY, 10);
    expect(pose.target[0]).toBeCloseTo(BURETTE.x, 10);
  });

  it("clamps to the graduated span even when the burette is empty", () => {
    const pose = getMeniscusCameraPose(null);

    expect(pose.target[1]).toBeGreaterThanOrEqual(BURETTE.graduationBottomY);
    expect(pose.target[1]).toBeLessThanOrEqual(BURETTE.graduationTopY);
  });
});

/*
 * Representative benches. The framing bug these guard against was not subtle —
 * a first attempt pitched the camera nearly level so the back wall replaced the
 * worktop behind the glassware, and a second sat so far back the flask was too
 * small to read a colour change in. Both looked reasonable in the source.
 */
const SHORT_WIDE_BENCH: readonly BenchContentItem[] = [
  { centerXZ: [-0.28, 0.2], radiusXZ: 0.06, baseY: 0.92, topY: 1.14 },
  { centerXZ: [0.16, 0.24], radiusXZ: 0.11, baseY: 0.92, topY: 1.21 },
  { centerXZ: [0.44, 0.22], radiusXZ: 0.04, baseY: 0.92, topY: 1.14 },
  { centerXZ: [0.78, 0.18], radiusXZ: 0.07, baseY: 0.92, topY: 1.19 }
];

const TALL_BENCH: readonly BenchContentItem[] = [
  { centerXZ: [-0.55, 0.05], radiusXZ: 0.29, baseY: 0.92, topY: 1.18 },
  { centerXZ: [0.18, 0.32], radiusXZ: 0.1, baseY: 0.92, topY: BURETTE.tubeTopY },
  { centerXZ: [0.18, 0.32], radiusXZ: 0.062, baseY: 0.928, topY: FLASK_RIM_Y }
];

function framesEveryItem(items: readonly BenchContentItem[]) {
  const pose = overviewPoseForBenchContents(items);

  for (const item of items) {
    for (const y of [item.baseY, item.topY]) {
      for (const dx of [-item.radiusXZ, item.radiusXZ]) {
        const ndcY = verticalNdcForPose(
          [item.centerXZ[0] + dx, y, item.centerXZ[1]],
          pose
        );
        expect(Math.abs(ndcY)).toBeLessThan(1);
      }
    }
  }

  return pose;
}

describe("content-derived bench overview framing", () => {
  it("falls back to the authored bench view when nothing is placed", () => {
    expect(overviewPoseForBenchContents([])).toBe(BENCH_VIEW);
  });

  it("keeps every item on a short wide bench inside the frame", () => {
    framesEveryItem(SHORT_WIDE_BENCH);
  });

  it("keeps every item on a tall bench inside the frame", () => {
    framesEveryItem(TALL_BENCH);
  });

  it("stands closer to a small bench than a large one", () => {
    const near = overviewPoseForBenchContents(SHORT_WIDE_BENCH);
    const far = overviewPoseForBenchContents(TALL_BENCH);
    const distanceOf = (pose: typeof near) =>
      Math.hypot(
        pose.target[0] - pose.position[0],
        pose.target[1] - pose.position[1],
        pose.target[2] - pose.position[2]
      );

    expect(distanceOf(near)).toBeLessThan(distanceOf(far));
  });

  it("keeps the worktop behind short benches by pitching further down", () => {
    /*
     * A level camera puts the back wall behind the apparatus instead of the
     * bench. Short benches must look down harder than tall ones, where the same
     * angle would climb over the burette and stare down the tube.
     */
    const pitchOf = (items: readonly BenchContentItem[]) => {
      const pose = overviewPoseForBenchContents(items);
      const rise = pose.position[1] - pose.target[1];
      const run = Math.hypot(
        pose.target[0] - pose.position[0],
        pose.target[2] - pose.position[2]
      );
      return Math.atan2(rise, run);
    };

    expect(degrees(pitchOf(SHORT_WIDE_BENCH))).toBeGreaterThan(
      degrees(pitchOf(TALL_BENCH))
    );
    expect(degrees(pitchOf(TALL_BENCH))).toBeGreaterThan(0);
  });

  it("stays inside the sealed room", () => {
    for (const items of [SHORT_WIDE_BENCH, TALL_BENCH]) {
      const pose = overviewPoseForBenchContents(items);
      expect(pose.position[1]).toBeGreaterThan(ISLAND.topY);
      expect(pose.position[1]).toBeLessThan(WALLS.height);
      expect(pose.position[2]).toBeLessThan(ROOM.frontWallZ);
      expect(Math.abs(pose.position[0])).toBeLessThan(ROOM.sideWallX);
    }
  });
});
