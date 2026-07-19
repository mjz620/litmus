import { ISLAND } from "./benchLayout";
import { LAB_PALETTE } from "./labPalette";

interface LiquidFillProps {
  readonly fillFraction?: number;
}

/** Lightweight verified visual for the registered 10 mL volumetric pipette. */
export function VolumetricPipette({ fillFraction = 0 }: LiquidFillProps) {
  const clamped = Math.max(0, Math.min(1, fillFraction));
  return (
    <group position={[-0.55, ISLAND.topY, 0.18]}>
      <mesh position={[0, -0.39, 0]}>
        <cylinderGeometry args={[0.075, 0.09, 0.025, 20]} />
        <meshStandardMaterial color="#5b6663" roughness={0.55} />
      </mesh>
      <mesh position={[-0.06, -0.12, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.58, 12]} />
        <meshStandardMaterial color="#606b68" roughness={0.48} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.014, 0.009, 0.74, 16]} />
        <meshPhysicalMaterial
          color="#dcebea"
          transparent
          opacity={0.42}
          roughness={0.08}
          transmission={0.55}
          thickness={0.015}
        />
      </mesh>
      <mesh position={[0, 0.03, 0]} scale={[1, 1.5, 1]}>
        <sphereGeometry args={[0.032, 18, 12]} />
        <meshPhysicalMaterial
          color="#dcebea"
          transparent
          opacity={0.42}
          roughness={0.08}
          transmission={0.55}
          thickness={0.015}
        />
      </mesh>
      {clamped > 0 && (
        <mesh position={[0, -0.3 + clamped * 0.29, 0]}>
          <cylinderGeometry args={[0.009, 0.009, clamped * 0.58, 12]} />
          <meshStandardMaterial color="#8fc9df" transparent opacity={0.78} />
        </mesh>
      )}
      <mesh position={[0, 0.23, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.017, 0.0016, 6, 24]} />
        <meshStandardMaterial color="#2f4d4a" />
      </mesh>
    </group>
  );
}

/** Lightweight verified visual for the registered 100 mL volumetric flask. */
export function VolumetricFlask({ fillFraction = 0 }: LiquidFillProps) {
  const clamped = Math.max(0, Math.min(1, fillFraction));
  return (
    <group position={[0, ISLAND.topY, 0.2]}>
      <mesh position={[0, 0.06, 0]} scale={[1, 1.15, 1]}>
        <sphereGeometry args={[0.105, 24, 16]} />
        <meshPhysicalMaterial
          color="#dcebea"
          transparent
          opacity={0.42}
          roughness={0.08}
          transmission={0.55}
          thickness={0.02}
        />
      </mesh>
      {clamped > 0 && (
        <mesh position={[0, 0.015 + clamped * 0.035, 0]} scale={[1, 0.7, 1]}>
          <sphereGeometry args={[0.092 * Math.max(0.38, clamped), 20, 12]} />
          <meshStandardMaterial color="#8fc9df" transparent opacity={0.72} />
        </mesh>
      )}
      <mesh position={[0, 0.23, 0]}>
        <cylinderGeometry args={[0.025, 0.035, 0.28, 18, 1, true]} />
        <meshPhysicalMaterial
          color="#dcebea"
          transparent
          opacity={0.42}
          roughness={0.08}
          transmission={0.55}
          side={2}
        />
      </mesh>
      <mesh position={[0, 0.28, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.028, 0.0018, 6, 30]} />
        <meshStandardMaterial color={LAB_PALETTE.selectionTeal} />
      </mesh>
      <mesh position={[0, 0.39, 0]}>
        <cylinderGeometry args={[0.029, 0.032, 0.04, 16]} />
        <meshStandardMaterial color="#49615c" roughness={0.65} />
      </mesh>
    </group>
  );
}

/** Lightweight verified visual for the registered distilled-water bottle. */
export function DistilledWaterWashBottle({
  fillFraction = 0.75
}: LiquidFillProps) {
  const clamped = Math.max(0, Math.min(1, fillFraction));
  return (
    <group position={[-0.3, ISLAND.topY, -0.08]}>
      <mesh position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.07, 0.075, 0.22, 20]} />
        <meshStandardMaterial color="#eef5f2" roughness={0.5} />
      </mesh>
      {clamped > 0 && (
        <mesh position={[0, 0.0 + clamped * 0.08, 0]}>
          <cylinderGeometry args={[0.064, 0.067, clamped * 0.17, 18]} />
          <meshStandardMaterial color="#8fc9df" transparent opacity={0.68} />
        </mesh>
      )}
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.02, 0.035, 0.07, 14]} />
        <meshStandardMaterial color="#e6eeea" roughness={0.45} />
      </mesh>
      <mesh position={[0.055, 0.285, 0]} rotation={[0, 0, -0.72]}>
        <cylinderGeometry args={[0.008, 0.012, 0.16, 10]} />
        <meshStandardMaterial color="#e6eeea" roughness={0.45} />
      </mesh>
    </group>
  );
}

/** Reusable visual for one registered stock-solution reagent bottle. */
export function RegisteredReagentBottle({
  fillFraction = 0.7
}: LiquidFillProps) {
  const clamped = Math.max(0, Math.min(1, fillFraction));
  return (
    <group position={[0.55, ISLAND.topY, 0.15]}>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.062, 0.07, 0.24, 20]} />
        <meshPhysicalMaterial
          color="#dcebea"
          transparent
          opacity={0.54}
          roughness={0.16}
          transmission={0.38}
          thickness={0.02}
        />
      </mesh>
      {clamped > 0 && (
        <mesh position={[0, 0.005 + clamped * 0.085, 0]}>
          <cylinderGeometry args={[0.057, 0.062, clamped * 0.18, 18]} />
          <meshStandardMaterial color="#9ecbd4" transparent opacity={0.76} />
        </mesh>
      )}
      <mesh position={[0, 0.245, 0]}>
        <cylinderGeometry args={[0.035, 0.043, 0.07, 16]} />
        <meshStandardMaterial color="#263f3b" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.1, 0.063]}>
        <planeGeometry args={[0.082, 0.07]} />
        <meshStandardMaterial color="#f7f2df" roughness={0.85} />
      </mesh>
    </group>
  );
}
