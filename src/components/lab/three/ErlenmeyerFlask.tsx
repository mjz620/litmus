interface ErlenmeyerFlaskProps {
  liquidColor: string;
}

export function ErlenmeyerFlask({ liquidColor }: ErlenmeyerFlaskProps) {
  return (
    <group position={[-1.45, 0.25, 0]}>
      <mesh position={[0, 0.48, 0]}>
        <cylinderGeometry args={[0.3, 0.88, 1.25, 18, 1, true]} />
        <meshStandardMaterial
          color="#dcebe8"
          transparent
          opacity={0.28}
          roughness={0.12}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 1.45, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.75, 18, 1, true]} />
        <meshStandardMaterial
          color="#dcebe8"
          transparent
          opacity={0.28}
          roughness={0.12}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.4, 0.72, 0.38, 18]} />
        <meshStandardMaterial
          color={liquidColor}
          transparent
          opacity={0.8}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}
