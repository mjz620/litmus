import { useMemo } from "react";
import { CatmullRomCurve3, MeshStandardMaterial, Vector3 } from "three";

import {
  BENCH_ALCOVE,
  BENCH_SINK,
  CLASSROOM_FIXTURES,
  ISLAND,
  ROOM,
  ROOM_SHELL,
  ROOM_TRIM,
  WALLS
} from "./benchLayout";
import { LAB_PALETTE } from "./labPalette";

// Shared materials keep draw state small across the whole classroom.
const woodMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.wood,
  roughness: 0.78,
  metalness: 0
});
const woodDarkMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.woodDark,
  roughness: 0.78,
  metalness: 0
});
const phenolicTopMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.benchTop,
  roughness: 0.8,
  metalness: 0
});
const kickMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.benchEdge,
  roughness: 0.8,
  metalness: 0
});
const floorMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.floor,
  roughness: 0.9,
  metalness: 0
});
const wallMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.wall,
  roughness: 0.9,
  metalness: 0
});
const ceilingMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.ceiling,
  roughness: 0.92,
  metalness: 0
});
const wallTrimMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.wallTrim,
  roughness: 0.82,
  metalness: 0
});
const handleMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.fixtureMetal,
  roughness: 0.42,
  metalness: 0.68
});
const whiteboardMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.muralBoard,
  roughness: 0.72,
  metalness: 0
});
const steelMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.fixtureMetal,
  roughness: 0.42,
  metalness: 0.68
});
const basinMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.fixtureDark,
  roughness: 0.68,
  metalness: 0
});
const safetyRedMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.safetyRed,
  roughness: 0.78,
  metalness: 0
});
const safetyGreenMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.safetyGreen,
  roughness: 0.78,
  metalness: 0
});
const safetyPaperMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.safetyPaper,
  roughness: 0.82,
  metalness: 0
});
const muralBlueMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.muralBlue,
  roughness: 0.78,
  metalness: 0
});
const plantLeafMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.plantLeaf,
  roughness: 0.82,
  metalness: 0
});
const plantPotMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.plantPot,
  roughness: 0.82,
  metalness: 0
});
const lightPanelMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.ceramic,
  emissive: LAB_PALETTE.ceramic,
  emissiveIntensity: 0.24,
  roughness: 0.72,
  metalness: 0
});
const roomMaterials = {
  floor: floorMaterial,
  wall: wallMaterial,
  ceiling: ceilingMaterial
} as const;

interface IslandProps {
  x: number;
  z: number;
}

/** Black phenolic worktop over warm wood cabinet bases with door details. */
function CabinetIsland({ x, z }: IslandProps) {
  const doorCount = 4;
  const doorWidth = ISLAND.cabinetWidth / doorCount - 0.08;
  const doorCenters = Array.from(
    { length: doorCount },
    (_, index) =>
      -ISLAND.cabinetWidth / 2 +
      (index + 0.5) * (ISLAND.cabinetWidth / doorCount)
  );

  return (
    <group position={[x, 0, z]}>
      <mesh
        receiveShadow
        position={[0, ISLAND.topY - ISLAND.topThickness / 2, 0]}
        material={phenolicTopMaterial}
      >
        <boxGeometry
          args={[ISLAND.topWidth, ISLAND.topThickness, ISLAND.topDepth]}
        />
      </mesh>
      <mesh position={[0, ISLAND.cabinetCenterY, 0]} material={woodMaterial}>
        <boxGeometry
          args={[
            ISLAND.cabinetWidth,
            ISLAND.topY - ISLAND.topThickness,
            ISLAND.cabinetDepth
          ]}
        />
      </mesh>
      <mesh position={[0, 0.045, 0]} material={kickMaterial}>
        <boxGeometry
          args={[ISLAND.cabinetWidth - 0.12, 0.09, ISLAND.cabinetDepth - 0.1]}
        />
      </mesh>

      {doorCenters.map((doorX) => (
        <group key={doorX} position={[doorX, 0.46, ISLAND.cabinetDepth / 2]}>
          <mesh position={[0, 0, 0.006]} material={woodDarkMaterial}>
            <boxGeometry args={[doorWidth, 0.62, 0.012]} />
          </mesh>
          <mesh
            position={[doorWidth / 2 - 0.05, 0.18, 0.024]}
            material={handleMaterial}
          >
            <boxGeometry args={[0.016, 0.11, 0.016]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Counter-mounted sink basin with a gooseneck faucet. */
function SinkAndFaucet() {
  const faucetCurve = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0, 0.015, 0),
        new Vector3(0, BENCH_SINK.faucetHeight * 0.58, 0),
        new Vector3(0, BENCH_SINK.faucetHeight, 0.045),
        new Vector3(0, BENCH_SINK.faucetHeight * 1.06, 0.12),
        new Vector3(0, BENCH_SINK.faucetHeight * 0.82, 0.18),
        new Vector3(0, BENCH_SINK.faucetHeight * 0.63, 0.18)
      ]),
    []
  );
  const rimThickness = 0.025;

  return (
    <group position={[BENCH_SINK.x, 0, BENCH_SINK.z]}>
      <mesh
        position={[0, BENCH_SINK.baseY - 0.055, 0]}
        material={basinMaterial}
      >
        <boxGeometry
          args={[BENCH_SINK.width - 0.075, 0.08, BENCH_SINK.depth - 0.075]}
        />
      </mesh>

      {/* Four raised rails read as an open basin instead of a flat dark tile. */}
      <mesh
        position={[
          0,
          BENCH_SINK.baseY + 0.006,
          -(BENCH_SINK.depth - rimThickness) / 2
        ]}
        material={steelMaterial}
      >
        <boxGeometry args={[BENCH_SINK.width, 0.018, rimThickness]} />
      </mesh>
      <mesh
        position={[
          0,
          BENCH_SINK.baseY + 0.006,
          (BENCH_SINK.depth - rimThickness) / 2
        ]}
        material={steelMaterial}
      >
        <boxGeometry args={[BENCH_SINK.width, 0.018, rimThickness]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[
            (side * (BENCH_SINK.width - rimThickness)) / 2,
            BENCH_SINK.baseY + 0.006,
            0
          ]}
          material={steelMaterial}
        >
          <boxGeometry args={[rimThickness, 0.018, BENCH_SINK.depth]} />
        </mesh>
      ))}

      <mesh
        position={[0, BENCH_SINK.baseY - 0.012, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        material={steelMaterial}
      >
        <torusGeometry args={[0.025, 0.004, 8, 18]} />
      </mesh>

      {/* A single continuous tube prevents the disconnected faucet silhouette. */}
      <group position={[0, BENCH_SINK.baseY, -BENCH_SINK.faucetBackOffset]}>
        <mesh material={steelMaterial}>
          <tubeGeometry args={[faucetCurve, 28, 0.012, 10, false]} />
        </mesh>
        <mesh
          position={[0, BENCH_SINK.faucetHeight * 0.59, 0.18]}
          material={steelMaterial}
        >
          <cylinderGeometry args={[0.016, 0.012, 0.035, 10]} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.072, 0.035, 0]}>
            <mesh material={steelMaterial}>
              <cylinderGeometry args={[0.016, 0.02, 0.055, 10]} />
            </mesh>
            <mesh
              position={[0, 0.037, 0]}
              rotation={[0, 0, Math.PI / 2]}
              material={steelMaterial}
            >
              <cylinderGeometry args={[0.006, 0.006, 0.065, 8]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/**
 * A molecule diagram on the classroom whiteboard behind the bench.
 *
 * This used to also scatter confetti across the board and run a band of twelve
 * coloured circles along the back wall. Both were decoration with no referent,
 * and together they were the most cartoonish thing on screen — which undercuts
 * the brief: warmth is supposed to come from materials and clear affordances,
 * not from making the chemistry look less real. A structural formula on a
 * whiteboard is a real thing to find in a chemistry classroom, so it stays, in
 * a restrained two-colour treatment rather than four competing pastels.
 */
function WhimsicalBackdrop() {
  const nodePositions = [
    [-0.8, 0.12, 0.12],
    [-0.37, -0.15, 0.15],
    [0.1, 0.12, 0.11],
    [0.54, -0.1, 0.14],
    [0.9, 0.15, 0.09]
  ] as const;
  const bonds = [
    [-0.58, -0.015, -0.57],
    [-0.13, -0.01, 0.54],
    [0.33, 0.01, -0.52],
    [0.7, 0.025, 0.61]
  ] as const;

  return (
    <>
      <group
        position={[
          BENCH_ALCOVE.muralCenterX,
          BENCH_ALCOVE.muralCenterY,
          ROOM.backWallZ + WALLS.thickness / 2 + 0.025
        ]}
      >
        <mesh position={[0, 0, -0.008]} material={wallTrimMaterial}>
          <boxGeometry
            args={[
              BENCH_ALCOVE.muralWidth + 0.1,
              BENCH_ALCOVE.muralHeight + 0.1,
              0.025
            ]}
          />
        </mesh>
        <mesh material={whiteboardMaterial}>
          <boxGeometry
            args={[BENCH_ALCOVE.muralWidth, BENCH_ALCOVE.muralHeight, 0.03]}
          />
        </mesh>
        {bonds.map(([x, y, rotation], index) => (
          <mesh
            key={`bond-${index}`}
            position={[x, y, 0.03]}
            rotation={[0, 0, rotation]}
            material={wallTrimMaterial}
          >
            <boxGeometry args={[0.61, 0.035, 0.022]} />
          </mesh>
        ))}
        {nodePositions.map(([x, y, radius], index) => (
          <mesh
            key={`node-${index}`}
            position={[x, y, 0.05]}
            /*
             * One colour, so it reads as a marker diagram someone drew rather
             * than as decoration. The camera now frames the wall on tall
             * benches, which made four competing pastels the loudest thing
             * behind the apparatus.
             */
            material={muralBlueMaterial}
          >
            <circleGeometry args={[radius, 18]} />
          </mesh>
        ))}
      </group>
    </>
  );
}

/** Low-poly greenery breaks up the hard surfaces without entering the work zone. */
function ClassroomPlants() {
  const counter = CLASSROOM_FIXTURES.serviceCounter;
  const plants = [
    { x: -0.82, scale: 1 },
    { x: 1.8, scale: 0.84 }
  ] as const;

  return plants.map(({ x, scale }) => (
    <group
      key={x}
      position={[x, counter.topY, counter.z - counter.depth * 0.18]}
      scale={scale}
    >
      <mesh position={[0, 0.07, 0]} material={plantPotMaterial}>
        <cylinderGeometry args={[0.105, 0.075, 0.14, 8]} />
      </mesh>
      <mesh
        position={[-0.05, 0.22, 0]}
        rotation={[0.35, 0, -0.48]}
        material={plantLeafMaterial}
      >
        <sphereGeometry args={[0.065, 8, 6]} />
      </mesh>
      <mesh
        position={[0.035, 0.27, 0]}
        rotation={[-0.22, 0, 0.38]}
        material={plantLeafMaterial}
      >
        <sphereGeometry args={[0.07, 8, 6]} />
      </mesh>
      <mesh
        position={[0.075, 0.19, 0.005]}
        rotation={[0.18, 0, 0.86]}
        material={plantLeafMaterial}
      >
        <sphereGeometry args={[0.06, 8, 6]} />
      </mesh>
    </group>
  ));
}

/** Rear preparation counter gives the room a believable secondary work zone. */
function ServiceCounter() {
  const fixture = CLASSROOM_FIXTURES.serviceCounter;
  const cabinetCenterY = (fixture.topY - fixture.topThickness) / 2;
  const doorWidth = fixture.width / fixture.doorCount - 0.06;
  const doorCenters = Array.from(
    { length: fixture.doorCount },
    (_, index) =>
      -fixture.width / 2 + (index + 0.5) * (fixture.width / fixture.doorCount)
  );

  return (
    <group position={[fixture.x, 0, fixture.z]}>
      <mesh
        position={[0, fixture.topY - fixture.topThickness / 2, 0]}
        material={phenolicTopMaterial}
      >
        <boxGeometry
          args={[fixture.width, fixture.topThickness, fixture.depth]}
        />
      </mesh>
      <mesh position={[0, cabinetCenterY, 0]} material={woodMaterial}>
        <boxGeometry
          args={[
            fixture.width - 0.04,
            fixture.cabinetHeight,
            fixture.depth - 0.03
          ]}
        />
      </mesh>
      <mesh position={[0, 0.045, 0]} material={kickMaterial}>
        <boxGeometry
          args={[fixture.width - 0.14, 0.09, fixture.depth - 0.08]}
        />
      </mesh>
      {doorCenters.map((doorX) => (
        <group key={doorX} position={[doorX, 0.43, fixture.depth / 2]}>
          <mesh position={[0, 0, 0.008]} material={woodDarkMaterial}>
            <boxGeometry args={[doorWidth, 0.58, 0.012]} />
          </mesh>
          <mesh
            position={[doorWidth / 2 - 0.04, 0.16, 0.025]}
            material={handleMaterial}
          >
            <boxGeometry args={[0.014, 0.1, 0.014]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Tall side storage and a safety station complete the formerly open right edge. */
function SideStorageAndSafety() {
  const storage = CLASSROOM_FIXTURES.sideStorage;
  const panel = CLASSROOM_FIXTURES.safetyPanel;
  const doorDepth = storage.depth / storage.doorCount - 0.04;
  const doorCenters = Array.from(
    { length: storage.doorCount },
    (_, index) =>
      -storage.depth / 2 + (index + 0.5) * (storage.depth / storage.doorCount)
  );

  return (
    <>
      <group position={[storage.x, 0, storage.z]}>
        <mesh position={[0, storage.height / 2, 0]} material={woodMaterial}>
          <boxGeometry args={[storage.width, storage.height, storage.depth]} />
        </mesh>
        <mesh position={[0, 0.055, 0]} material={kickMaterial}>
          <boxGeometry
            args={[storage.width + 0.015, 0.11, storage.depth - 0.08]}
          />
        </mesh>
        {doorCenters.map((doorZ) => (
          <group
            key={doorZ}
            position={[-storage.width / 2, storage.height / 2, doorZ]}
          >
            <mesh position={[-0.008, 0, 0]} material={woodDarkMaterial}>
              <boxGeometry args={[0.012, storage.height - 0.12, doorDepth]} />
            </mesh>
            <mesh
              position={[-0.026, 0.16, doorDepth / 2 - 0.045]}
              material={handleMaterial}
            >
              <boxGeometry args={[0.014, 0.11, 0.014]} />
            </mesh>
          </group>
        ))}
      </group>

      <group position={[panel.x, panel.y, panel.z]}>
        <mesh material={wallTrimMaterial}>
          <boxGeometry
            args={[0.035, panel.height + 0.06, panel.width + 0.06]}
          />
        </mesh>
        <mesh position={[-0.024, 0, 0]} material={safetyPaperMaterial}>
          <boxGeometry args={[0.018, panel.height, panel.width]} />
        </mesh>
        <mesh
          position={[-0.037, panel.height * 0.34, 0]}
          material={safetyRedMaterial}
        >
          <boxGeometry args={[0.012, 0.12, panel.width - 0.08]} />
        </mesh>
        <group position={[-0.039, -0.1, 0]}>
          <mesh material={safetyGreenMaterial}>
            <boxGeometry args={[0.014, 0.24, 0.075]} />
          </mesh>
          <mesh material={safetyGreenMaterial}>
            <boxGeometry args={[0.014, 0.075, 0.24]} />
          </mesh>
        </group>
      </group>
    </>
  );
}

function CeilingFixtures() {
  const fixture = CLASSROOM_FIXTURES.ceilingLights;

  return fixture.xPositions.map((x) => (
    <mesh
      key={x}
      position={[x, fixture.y, fixture.z]}
      material={lightPanelMaterial}
    >
      <boxGeometry args={[fixture.width, 0.025, fixture.depth]} />
    </mesh>
  ));
}

/**
 * Complete high-school chemistry classroom shell and restrained set dressing.
 * Pure presentation: it renders no experiment state.
 */
export function ClassroomEnvironment() {
  return (
    <group>
      {ROOM_SHELL.map((surface) => (
        <mesh
          key={surface.id}
          position={[...surface.position]}
          material={roomMaterials[surface.material]}
        >
          <boxGeometry args={[...surface.size]} />
        </mesh>
      ))}
      {ROOM_TRIM.map((segment) => (
        <mesh
          key={segment.id}
          position={[...segment.position]}
          material={wallTrimMaterial}
        >
          <boxGeometry args={[...segment.size]} />
        </mesh>
      ))}
      <CeilingFixtures />
      <ServiceCounter />
      <SideStorageAndSafety />
      <ClassroomPlants />
      <CabinetIsland x={ISLAND.centerX} z={ISLAND.centerZ} />
      <mesh
        position={[
          ISLAND.centerX,
          ISLAND.topY + BENCH_ALCOVE.splashbackHeight / 2,
          BENCH_ALCOVE.splashbackCenterZ
        ]}
        material={whiteboardMaterial}
      >
        <boxGeometry
          args={[
            BENCH_ALCOVE.splashbackWidth,
            BENCH_ALCOVE.splashbackHeight,
            0.035
          ]}
        />
      </mesh>
      <SinkAndFaucet />
      <WhimsicalBackdrop />
    </group>
  );
}
