// Single source of spatial truth for the 3D chemistry lab. Every scene
// component reads its position and dimensions from here, and the geometry
// tests assert the physical invariants (burette tip above the flask mouth,
// equipment resting on surfaces, graduations inside the tube) against these
// same numbers. Units are approximately meters.

export type Vec3 = readonly [number, number, number];

export interface CameraPose {
  readonly position: Vec3;
  readonly target: Vec3;
}

/** Room shell. */
export const ROOM = {
  floorY: 0,
  ceilingY: 3.1,
  backWallZ: -1.7,
  frontWallZ: 2.8,
  sideWallX: 2.6,
  width: 5.2,
  depth: 4.5
} as const;

/** Open-top diorama walls, including their contrasting cap trim. */
export const WALLS = (() => {
  const height = 3;
  const trimHeight = 0.04;

  return {
    height,
    thickness: 0.08,
    bodyHeight: height - trimHeight,
    trimHeight,
    trimDepth: 0.12,
    ceilingThickness: 0.2,
    baseboardHeight: 0.09,
    baseboardDepth: 0.035,
    fixtureTopY: height - trimHeight - 0.08
  } as const;
})();

export type RoomShellSurfaceId =
  | "floor"
  | "ceiling"
  | "back-wall"
  | "front-wall"
  | "left-wall"
  | "right-wall";

export interface RoomShellSurface {
  readonly id: RoomShellSurfaceId;
  readonly material: "floor" | "wall" | "ceiling";
  readonly position: Vec3;
  readonly size: Vec3;
}

/** Six physical planes close the room; the sky remains only a world fallback. */
export const ROOM_SHELL: readonly RoomShellSurface[] = [
  {
    id: "floor",
    material: "floor",
    position: [0, -0.03, ROOM.backWallZ + ROOM.depth / 2],
    size: [ROOM.width, 0.06, ROOM.depth]
  },
  {
    id: "ceiling",
    material: "ceiling",
    position: [
      0,
      WALLS.height + WALLS.ceilingThickness / 2,
      ROOM.backWallZ + ROOM.depth / 2
    ],
    size: [ROOM.width, WALLS.ceilingThickness, ROOM.depth]
  },
  {
    id: "back-wall",
    material: "wall",
    position: [0, WALLS.bodyHeight / 2, ROOM.backWallZ],
    size: [ROOM.width, WALLS.bodyHeight, WALLS.thickness]
  },
  {
    id: "front-wall",
    material: "wall",
    position: [0, WALLS.bodyHeight / 2, ROOM.frontWallZ],
    size: [ROOM.width, WALLS.bodyHeight, WALLS.thickness]
  },
  {
    id: "left-wall",
    material: "wall",
    position: [
      -ROOM.sideWallX,
      WALLS.bodyHeight / 2,
      ROOM.backWallZ + ROOM.depth / 2
    ],
    size: [WALLS.thickness, WALLS.bodyHeight, ROOM.depth]
  },
  {
    id: "right-wall",
    material: "wall",
    position: [
      ROOM.sideWallX,
      WALLS.bodyHeight / 2,
      ROOM.backWallZ + ROOM.depth / 2
    ],
    size: [WALLS.thickness, WALLS.bodyHeight, ROOM.depth]
  }
] as const;

export interface RoomTrimSegment {
  readonly id: string;
  readonly kind: "cap" | "baseboard";
  readonly position: Vec3;
  readonly size: Vec3;
}

/** Continuous cap trim and baseboards make every room junction intentional. */
export const ROOM_TRIM: readonly RoomTrimSegment[] = (() => {
  const centerZ = ROOM.backWallZ + ROOM.depth / 2;
  const capY = WALLS.height - WALLS.trimHeight / 2;
  const baseY = WALLS.baseboardHeight / 2;
  const inset = WALLS.thickness / 2 + WALLS.baseboardDepth / 2;

  return [
    {
      id: "back-cap",
      kind: "cap",
      position: [0, capY, ROOM.backWallZ],
      size: [ROOM.width, WALLS.trimHeight, WALLS.trimDepth]
    },
    {
      id: "front-cap",
      kind: "cap",
      position: [0, capY, ROOM.frontWallZ],
      size: [ROOM.width, WALLS.trimHeight, WALLS.trimDepth]
    },
    {
      id: "left-cap",
      kind: "cap",
      position: [-ROOM.sideWallX, capY, centerZ],
      size: [WALLS.trimDepth, WALLS.trimHeight, ROOM.depth]
    },
    {
      id: "right-cap",
      kind: "cap",
      position: [ROOM.sideWallX, capY, centerZ],
      size: [WALLS.trimDepth, WALLS.trimHeight, ROOM.depth]
    },
    {
      id: "back-baseboard",
      kind: "baseboard",
      position: [0, baseY, ROOM.backWallZ + inset],
      size: [ROOM.width, WALLS.baseboardHeight, WALLS.baseboardDepth]
    },
    {
      id: "front-baseboard",
      kind: "baseboard",
      position: [0, baseY, ROOM.frontWallZ - inset],
      size: [ROOM.width, WALLS.baseboardHeight, WALLS.baseboardDepth]
    },
    {
      id: "left-baseboard",
      kind: "baseboard",
      position: [-ROOM.sideWallX + inset, baseY, centerZ],
      size: [WALLS.baseboardDepth, WALLS.baseboardHeight, ROOM.depth]
    },
    {
      id: "right-baseboard",
      kind: "baseboard",
      position: [ROOM.sideWallX - inset, baseY, centerZ],
      size: [WALLS.baseboardDepth, WALLS.baseboardHeight, ROOM.depth]
    }
  ] as const;
})();

/** Procedural sky shell surrounding the open-top room. */
export const SKY_DOME = {
  radius: 30,
  widthSegments: 16,
  heightSegments: 12
} as const;

/** Main student lab island (black phenolic worktop on wood cabinets). */
export const ISLAND = {
  centerX: 0,
  centerZ: 0,
  topY: 0.92,
  topThickness: 0.06,
  topWidth: 3.1,
  topDepth: 1.5,
  cabinetWidth: 2.9,
  cabinetDepth: 1.34,
  /** Vertical center of the cabinet body under the worktop. */
  cabinetCenterY: (0.92 - 0.06) / 2
} as const;

/** Where the active glassware sits on the island. */
export const EQUIPMENT_ANCHOR = {
  x: 0.18,
  z: 0.32
} as const;

/** Fixed standing position and neutral target for the full-bench view. */
export const BENCH_VIEW: CameraPose = {
  position: [0.2, 1.58, 1.55],
  target: [EQUIPMENT_ANCHOR.x, 1.12, EQUIPMENT_ANCHOR.z]
};

/** Look offsets relative to BENCH_VIEW's neutral yaw and pitch. */
export const LOOK_LIMITS = {
  minYaw: (-55 * Math.PI) / 180,
  maxYaw: (55 * Math.PI) / 180,
  minPitch: (-35 * Math.PI) / 180,
  maxPitch: (20 * Math.PI) / 180
} as const;

/** White drip tile under the flask. */
export const TILE = {
  size: 0.2,
  thickness: 0.008,
  topY: ISLAND.topY + 0.008
} as const;

export const FLASK = {
  x: EQUIPMENT_ANCHOR.x,
  z: EQUIPMENT_ANCHOR.z,
  baseY: TILE.topY,
  baseRadius: 0.062,
  bodyHeight: 0.125,
  shoulderRadius: 0.03,
  neckRadius: 0.021,
  neckHeight: 0.062,
  rimRadius: 0.0245,
  /** Inner radius of the open mouth the titrant must fall through. */
  mouthRadius: 0.019,
  wallThickness: 0.0022
} as const;

export const FLASK_RIM_Y = FLASK.baseY + FLASK.bodyHeight + FLASK.neckHeight;

/**
 * The burette is derived bottom-up from the flask so its tip always clears
 * the mouth: tip bottom = flask rim + clearance, and everything above stacks
 * on top of that.
 */
export const BURETTE = (() => {
  const x = EQUIPMENT_ANCHOR.x;
  const z = EQUIPMENT_ANCHOR.z;
  const tipClearance = 0.055;
  const tipBottomY = FLASK_RIM_Y + tipClearance;
  const tipHeight = 0.04;
  const tipTopY = tipBottomY + tipHeight;
  const tipBottomRadius = 0.004;
  const tipTopRadius = 0.013;
  const stopcockHousingBottomY = tipTopY;
  const stopcockHousingHeight = 0.032;
  const stopcockHousingTopY = stopcockHousingBottomY + stopcockHousingHeight;
  const stopcockHousingCenterY =
    (stopcockHousingBottomY + stopcockHousingTopY) / 2;
  const stopcockHousingRadius = tipTopRadius;
  const junctionBottomY = stopcockHousingTopY;
  const junctionHeight = 0.018;
  const junctionTopY = junctionBottomY + junctionHeight;
  const junctionBottomRadius = stopcockHousingRadius;
  const tubeRadius = 0.017;
  const junctionTopRadius = tubeRadius;
  const tubeBottomY = junctionTopY;
  const tubeHeight = 0.64;
  const tubeTopY = tubeBottomY + tubeHeight;
  const graduationTopY = tubeTopY - 0.07;
  const graduationLength = 0.5;
  const liquidRadius = 0.0135;
  // Exaggerated just enough to remain visibly concave at the eye-level focus
  // pose while its center-bottom remains the exact volume-reading reference.
  const meniscusRise = 0.0045;

  return {
    x,
    z,
    tipClearance,
    tipBottomY,
    tipHeight,
    tipTopY,
    tipRadius: tipBottomRadius,
    tipBottomRadius,
    tipTopRadius,
    stopcockHousingBottomY,
    stopcockHousingHeight,
    stopcockHousingTopY,
    stopcockHousingCenterY,
    stopcockHousingRadius,
    stopcockCenterY: stopcockHousingCenterY,
    stopcockHeight: stopcockHousingHeight,
    stopcockBodyRadius: 0.008,
    stopcockBarrelRadius: 0.008,
    stopcockBarrelLength: 0.052,
    stopcockHandleLength: 0.024,
    stopcockHandleRadius: 0.01,
    stopcockHandlePaddleLength: 0.045,
    junctionBottomY,
    junctionHeight,
    junctionTopY,
    junctionCenterY: (junctionBottomY + junctionTopY) / 2,
    junctionBottomRadius,
    junctionTopRadius,
    tubeBottomY,
    tubeHeight,
    tubeTopY,
    tubeCenterY: tubeBottomY + tubeHeight / 2,
    tubeRadius,
    wallThickness: 0.0018,
    liquidRadius,
    meniscusRise,
    graduationTopY,
    graduationLength,
    graduationBottomY: graduationTopY - graduationLength
  } as const;
})();

/** Support stand holding the burette above the island. */
export const STAND = {
  baseCenterX: BURETTE.x - 0.02,
  baseCenterZ: BURETTE.z - 0.16,
  baseWidth: 0.24,
  baseDepth: 0.16,
  baseThickness: 0.02,
  baseTopY: ISLAND.topY + 0.02,
  rodX: BURETTE.x - 0.02,
  rodZ: BURETTE.z - 0.16,
  rodRadius: 0.0085,
  rodBottomY: ISLAND.topY + 0.02,
  rodTopY: WALLS.height,
  clampY: BURETTE.tubeCenterY + 0.08
} as const;

/** Raised indicator-bottle shelf at the back-left of the active island. */
export const SHELF = {
  x: -0.55,
  z: 0.05,
  baseY: ISLAND.topY,
  width: 0.58,
  depth: 0.18,
  riserHeight: 0.1,
  bottleSpacing: 0.17,
  bottleRadius: 0.036,
  bottleBodyHeight: 0.11,
  bottleCapHeight: 0.045,
  get topY() {
    return this.baseY + this.riserHeight;
  },
  get totalHeight() {
    return this.riserHeight + this.bottleBodyHeight + this.bottleCapHeight;
  }
} as const;

/** Burette-preparation supplies beside the support stand. */
export const WASH = {
  x: 0.72,
  z: 0.12,
  baseY: ISLAND.topY,
  width: 0.42,
  depth: 0.28,
  totalHeight: 0.27,
  washBottleX: -0.12,
  titrantBottleX: 0.015,
  funnelX: 0.145
} as const;

/** Built-in sink at the rear-left corner of the student's own worktop. */
export const BENCH_SINK = {
  x: -1.15,
  z: -0.38,
  baseY: ISLAND.topY,
  width: 0.54,
  depth: 0.4,
  faucetBackOffset: 0.22,
  faucetHeight: 0.3
} as const;

/** Close-range set dressing that turns the room into a focused lab alcove. */
export const BENCH_ALCOVE = {
  splashbackWidth: ISLAND.topWidth - 0.08,
  splashbackHeight: 0.12,
  splashbackCenterZ: ISLAND.centerZ - ISLAND.topDepth / 2 + 0.025,
  muralCenterX: 0.28,
  muralCenterY: 1.58,
  muralWidth: 2.5,
  muralHeight: 0.82,
  scallopCenterY: 2.34,
  scallopRadius: 0.11
} as const;

/** Restrained secondary fixtures that establish a functioning classroom. */
export const CLASSROOM_FIXTURES = {
  serviceCounter: {
    x: 0.62,
    z: ROOM.backWallZ + 0.22,
    width: 3.35,
    depth: 0.36,
    topY: 0.88,
    topThickness: 0.055,
    cabinetHeight: 0.78,
    doorCount: 4
  },
  sideStorage: {
    x: ROOM.sideWallX - 0.2,
    z: -0.42,
    width: 0.32,
    depth: 1.12,
    height: 1.82,
    doorCount: 2
  },
  safetyPanel: {
    x: ROOM.sideWallX - WALLS.thickness / 2 - 0.018,
    y: 1.92,
    z: 0.48,
    width: 0.54,
    height: 0.7
  },
  ceilingLights: {
    y: WALLS.height - 0.018,
    z: 0.15,
    width: 0.72,
    depth: 0.28,
    xPositions: [-1.2, 1.2] as const
  }
} as const;

/** Camera poses for the full bench and each focused equipment view. */
export const CAMERA_POSES: Record<
  "overview" | "burette" | "flask" | "indicatorShelf" | "washStation",
  CameraPose
> = {
  overview: BENCH_VIEW,
  burette: {
    /*
     * Framed to keep the flask in shot, not just the burette. The target used
     * to sit at 1.4, which pushed the flask body (y 0.93–1.05) to the bottom
     * edge where the instruction bar covers it — and the endpoint colour
     * change is the thing being watched. Lowering the target alone drops the
     * tube top (y 1.9) out of frame, so the distance grows with it; the
     * frustum invariant in tests/components/benchLayout.test.ts pins both.
     */
    position: [BURETTE.x + 0.63, 1.46, BURETTE.z + 1.5],
    target: [BURETTE.x, 1.36, BURETTE.z]
  },
  flask: {
    position: [FLASK.x + 0.24, FLASK.baseY + 0.24, FLASK.z + 0.5],
    target: [FLASK.x, FLASK.baseY + 0.09, FLASK.z]
  },
  indicatorShelf: {
    position: [SHELF.x + 0.18, SHELF.baseY + 0.34, SHELF.z + 0.62],
    target: [SHELF.x, SHELF.baseY + SHELF.totalHeight * 0.58, SHELF.z]
  },
  washStation: {
    position: [WASH.x + 0.28, WASH.baseY + 0.34, WASH.z + 0.58],
    target: [WASH.x, WASH.baseY + WASH.totalHeight * 0.48, WASH.z]
  }
};

/**
 * Frame any bench item from its world position and hit volume.
 *
 * The static CAMERA_POSES map only covers titration-era apparatus, so every
 * registry-placed item (calorimeter, beaker, bottles, probes) fell through to
 * the overview pose and selecting it did nothing. Deriving the pose means new
 * equipment gets a working zoom without another hardcoded entry — the same
 * contract that makes glassware swappable.
 */
export function focusPoseForBenchItem(
  worldPosition: readonly [number, number, number],
  itemHeight: number,
  itemCenterY: number
): CameraPose {
  const [x, baseY, z] = worldPosition;
  const centerY = baseY + itemCenterY;
  // Tall items need to be viewed from further back to stay in frame.
  const distance = Math.max(0.42, itemHeight * 2.4);
  return {
    position: [
      x + distance * 0.42,
      centerY + Math.max(0.14, itemHeight * 0.55),
      z + distance
    ],
    target: [x, centerY, z]
  };
}

/**
 * Map remaining burette volume to the bottom of the concave meniscus. Reading
 * zero (full) sits at the top graduation; a full delivery reaches the bottom
 * graduation. Returns null when the burette is empty and no column should
 * render. The meniscus edge curves upward from this reading reference.
 */
export function getBuretteLiquidTopY(
  availableML: number,
  capacityML: number
): number | null {
  if (!Number.isFinite(availableML) || availableML <= 0) return null;
  if (!Number.isFinite(capacityML) || capacityML <= 0) return null;

  const dispensedFraction = Math.max(
    0,
    Math.min(1, (capacityML - availableML) / capacityML)
  );

  return BURETTE.graduationTopY - dispensedFraction * BURETTE.graduationLength;
}

/**
 * Eye-level camera pose for reading the meniscus. Follows the bottom of the
 * curved liquid surface and stays clamped to the graduated span so an empty
 * burette still frames a sensible close-up.
 */
export function getMeniscusCameraPose(liquidTopY: number | null): CameraPose {
  const focusY = Math.max(
    BURETTE.graduationBottomY,
    Math.min(BURETTE.graduationTopY, liquidTopY ?? BURETTE.graduationBottomY)
  );

  return {
    position: [BURETTE.x + 0.1, focusY, BURETTE.z + 0.3],
    target: [BURETTE.x, focusY, BURETTE.z]
  };
}
