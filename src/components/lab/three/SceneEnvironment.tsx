import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { PMREMGenerator } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * Give reflective/transmissive materials a neutral environment map using
 * three's built-in procedural RoomEnvironment. Generated once per renderer —
 * a tightly bounded cost with no network fetch, unlike drei's preset
 * environments which load HDRs from a CDN. Rendered declaratively so the
 * texture attaches to (and detaches from) the scene with the component.
 */
export function SceneEnvironment({ enabled }: { enabled: boolean }) {
  const gl = useThree((state) => state.gl);

  const renderTarget = useMemo(() => {
    if (!enabled) return null;

    const generator = new PMREMGenerator(gl);
    const target = generator.fromScene(new RoomEnvironment(), 0.04);
    generator.dispose();
    return target;
  }, [enabled, gl]);

  useEffect(() => {
    return () => {
      renderTarget?.texture.dispose();
      renderTarget?.dispose();
    };
  }, [renderTarget]);

  if (!renderTarget) return null;

  return <primitive object={renderTarget.texture} attach="environment" />;
}
