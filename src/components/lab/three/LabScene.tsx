import { OrbitControls } from "@react-three/drei";

import { Burette } from "./Burette";
import { ErlenmeyerFlask } from "./ErlenmeyerFlask";
import { LabBench } from "./LabBench";

interface LabSceneProps {
  buretteFillFraction: number;
  flaskLiquidColor: string;
}

export function LabScene({
  buretteFillFraction,
  flaskLiquidColor
}: LabSceneProps) {
  return (
    <>
      <color attach="background" args={["#dceae7"]} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[4, 7, 5]} intensity={2.2} />
      <directionalLight position={[-4, 3, -2]} intensity={0.7} />

      <LabBench />
      <Burette fillFraction={buretteFillFraction} />
      <ErlenmeyerFlask liquidColor={flaskLiquidColor} />

      <OrbitControls
        enablePan={false}
        enableDamping={false}
        minDistance={6.5}
        maxDistance={11}
        minPolarAngle={Math.PI / 3.6}
        maxPolarAngle={Math.PI / 2.15}
        minAzimuthAngle={-Math.PI / 3.5}
        maxAzimuthAngle={Math.PI / 3.5}
        target={[0, 1.35, 0]}
      />
    </>
  );
}
