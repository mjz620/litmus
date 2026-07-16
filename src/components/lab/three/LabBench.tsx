export function LabBench() {
  return (
    <group>
      <mesh position={[0, -0.25, 0]} receiveShadow>
        <boxGeometry args={[10, 0.45, 5.5]} />
        <meshStandardMaterial color="#9c7253" roughness={0.85} />
      </mesh>

      {[
        [-4.2, -2.1, -2.1],
        [4.2, -2.1, -2.1],
        [-4.2, -2.1, 2.1],
        [4.2, -2.1, 2.1]
      ].map((position) => (
        <mesh
          key={position.join("-")}
          position={position as [number, number, number]}
        >
          <boxGeometry args={[0.45, 3.8, 0.45]} />
          <meshStandardMaterial color="#4b5f5a" roughness={0.8} />
        </mesh>
      ))}

      <mesh position={[0, 2.4, -2.7]}>
        <boxGeometry args={[10, 5.3, 0.2]} />
        <meshStandardMaterial color="#d7e4e1" roughness={0.95} />
      </mesh>

      <mesh position={[3.6, 0.35, -1.75]}>
        <boxGeometry args={[2.1, 0.16, 1.45]} />
        <meshStandardMaterial color="#c7d4d1" roughness={0.85} />
      </mesh>
    </group>
  );
}
