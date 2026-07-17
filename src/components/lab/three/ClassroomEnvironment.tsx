import { MeshStandardMaterial } from "three";

import { BENCH_ALCOVE, BENCH_SINK, ISLAND, ROOM, WALLS } from "./benchLayout";
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
  color: LAB_PALETTE.ceramic,
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
const muralMaterials = [
  new MeshStandardMaterial({
    color: LAB_PALETTE.skyHorizon,
    roughness: 0.76,
    metalness: 0
  }),
  new MeshStandardMaterial({
    color: LAB_PALETTE.skyMiddle,
    roughness: 0.76,
    metalness: 0
  }),
  new MeshStandardMaterial({
    color: LAB_PALETTE.skyZenith,
    roughness: 0.76,
    metalness: 0
  })
];

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
  return (
    <group position={[BENCH_SINK.x, 0, BENCH_SINK.z]}>
      <mesh
        position={[0, BENCH_SINK.baseY - 0.045, 0]}
        material={basinMaterial}
      >
        <boxGeometry
          args={[BENCH_SINK.width - 0.06, 0.09, BENCH_SINK.depth - 0.06]}
        />
      </mesh>
      <mesh
        position={[0, BENCH_SINK.baseY + 0.004, 0]}
        material={steelMaterial}
      >
        <boxGeometry args={[BENCH_SINK.width, 0.012, BENCH_SINK.depth]} />
      </mesh>
      <mesh
        position={[0, BENCH_SINK.baseY + 0.011, 0]}
        material={basinMaterial}
      >
        <boxGeometry
          args={[BENCH_SINK.width - 0.08, 0.008, BENCH_SINK.depth - 0.08]}
        />
      </mesh>
      <mesh
        position={[0, BENCH_SINK.baseY + 0.017, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        material={steelMaterial}
      >
        <torusGeometry args={[0.025, 0.004, 6, 12]} />
      </mesh>
      <group position={[0, BENCH_SINK.baseY, -BENCH_SINK.faucetBackOffset]}>
        <mesh position={[0, 0.12, 0]} material={steelMaterial}>
          <cylinderGeometry args={[0.014, 0.018, 0.24, 10]} />
        </mesh>
        <mesh position={[0, 0.24, 0.045]} material={steelMaterial}>
          <torusGeometry args={[0.09, 0.011, 8, 14, Math.PI]} />
        </mesh>
        <mesh position={[0, 0.2, 0.135]} material={steelMaterial}>
          <cylinderGeometry args={[0.01, 0.01, 0.08, 8]} />
        </mesh>
        <mesh
          position={[0.07, 0.1, 0]}
          rotation={[0, 0, Math.PI / 2]}
          material={steelMaterial}
        >
          <cylinderGeometry args={[0.009, 0.009, 0.07, 8]} />
        </mesh>
      </group>
    </group>
  );
}

/** Pastel molecule mural and scalloped trim make the open alcove intentional. */
function WhimsicalBackdrop() {
  const nodePositions = [
    [-0.7, 0.12, 0.12],
    [-0.18, -0.14, 0.15],
    [0.34, 0.15, 0.11],
    [0.78, -0.08, 0.14]
  ] as const;
  const bonds = [
    [-0.44, -0.01, -0.46],
    [0.08, 0.005, 0.5],
    [0.56, 0.035, -0.47]
  ] as const;
  const scallopCount = 12;

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
            material={muralMaterials[index % muralMaterials.length]}
          >
            <circleGeometry args={[radius, 18]} />
          </mesh>
        ))}
      </group>

      {Array.from({ length: scallopCount }, (_, index) => {
        const spacing = ROOM.width / scallopCount;
        const x = -ROOM.width / 2 + spacing * (index + 0.5);

        return (
          <mesh
            key={`scallop-${index}`}
            position={[
              x,
              BENCH_ALCOVE.scallopCenterY,
              ROOM.backWallZ + WALLS.thickness / 2 + 0.02
            ]}
            material={muralMaterials[index % muralMaterials.length]}
          >
            <circleGeometry args={[BENCH_ALCOVE.scallopRadius, 14]} />
          </mesh>
        );
      })}
    </>
  );
}

/**
 * High-school chemistry classroom set dressing: black phenolic islands on
 * warm wood cabinetry, an integrated sink, and a close pastel learning alcove.
 * Pure set dressing — it renders no experiment state.
 */
export function ClassroomEnvironment() {
  return (
    <group>
      <mesh
        position={[0, -0.03, ROOM.backWallZ + ROOM.depth / 2]}
        material={floorMaterial}
      >
        <boxGeometry args={[ROOM.width, 0.06, ROOM.depth]} />
      </mesh>

      <mesh
        position={[0, WALLS.bodyHeight / 2, ROOM.backWallZ]}
        material={wallMaterial}
      >
        <boxGeometry args={[ROOM.width, WALLS.bodyHeight, WALLS.thickness]} />
      </mesh>
      <mesh
        position={[
          -ROOM.sideWallX,
          WALLS.bodyHeight / 2,
          ROOM.backWallZ + ROOM.depth / 2
        ]}
        material={wallMaterial}
      >
        <boxGeometry args={[WALLS.thickness, WALLS.bodyHeight, ROOM.depth]} />
      </mesh>
      <mesh
        position={[0, WALLS.height - WALLS.trimHeight / 2, ROOM.backWallZ]}
        material={wallTrimMaterial}
      >
        <boxGeometry args={[ROOM.width, WALLS.trimHeight, WALLS.trimDepth]} />
      </mesh>
      <mesh
        position={[
          -ROOM.sideWallX,
          WALLS.height - WALLS.trimHeight / 2,
          ROOM.backWallZ + ROOM.depth / 2
        ]}
        material={wallTrimMaterial}
      >
        <boxGeometry args={[WALLS.trimDepth, WALLS.trimHeight, ROOM.depth]} />
      </mesh>
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
