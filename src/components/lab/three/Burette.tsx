interface BuretteProps {
  fillFraction: number;
}

const TUBE_HEIGHT = 4.4;
const TUBE_CENTER_Y = 2.7;

export function Burette({ fillFraction }: BuretteProps) {
  const liquidHeight = Math.max(0.02, TUBE_HEIGHT * fillFraction);
  const liquidY = TUBE_CENTER_Y - TUBE_HEIGHT / 2 + liquidHeight / 2;

  return (
    <group position={[-1.45, 0.1, 0]}>
      <mesh position={[-1.25, 0.05, 0]}>
        <cylinderGeometry args={[0.65, 0.8, 0.18, 16]} />
        <meshStandardMaterial color="#50645f" roughness={0.75} />
      </mesh>
      <mesh position={[-1.25, 2.35, 0]}>
        <cylinderGeometry args={[0.065, 0.065, 4.5, 10]} />
        <meshStandardMaterial
          color="#586c67"
          metalness={0.25}
          roughness={0.6}
        />
      </mesh>
      <mesh position={[-0.62, 3.5, 0]}>
        <boxGeometry args={[1.25, 0.12, 0.18]} />
        <meshStandardMaterial
          color="#586c67"
          metalness={0.2}
          roughness={0.65}
        />
      </mesh>

      <mesh position={[0, TUBE_CENTER_Y, 0]}>
        <cylinderGeometry args={[0.18, 0.18, TUBE_HEIGHT, 16, 1, true]} />
        <meshStandardMaterial
          color="#dcebe8"
          transparent
          opacity={0.3}
          roughness={0.1}
          metalness={0}
          depthWrite={false}
        />
      </mesh>

      {fillFraction > 0 && (
        <mesh position={[0, liquidY, 0]}>
          <cylinderGeometry args={[0.135, 0.135, liquidHeight, 14]} />
          <meshStandardMaterial
            color="#a6dce6"
            transparent
            opacity={0.82}
            roughness={0.25}
          />
        </mesh>
      )}

      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.045, 0.045, 0.65, 10]} />
        <meshStandardMaterial color="#c7ddda" roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[0.85, 0.1, 0.12]} />
        <meshStandardMaterial color="#263d38" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <coneGeometry args={[0.06, 0.3, 10]} />
        <meshStandardMaterial color="#c7ddda" roughness={0.2} />
      </mesh>
    </group>
  );
}
