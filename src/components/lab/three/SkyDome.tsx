import { BackSide, Color } from "three";

import { SKY_DOME } from "./benchLayout";
import { LAB_PALETTE } from "./labPalette";

const skyUniforms = {
  horizonColor: { value: new Color(LAB_PALETTE.skyHorizon) },
  middleColor: { value: new Color(LAB_PALETTE.skyMiddle) },
  zenithColor: { value: new Color(LAB_PALETTE.skyZenith) }
};

const vertexShader = `
  varying float vWorldY;

  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldY = worldPosition.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision mediump float;

  varying float vWorldY;
  uniform vec3 horizonColor;
  uniform vec3 middleColor;
  uniform vec3 zenithColor;

  void main() {
    float normalizedY = clamp(
      (vWorldY / ${SKY_DOME.radius.toFixed(1)} + 1.0) * 0.5,
      0.0,
      1.0
    );
    vec3 color = mix(
      horizonColor,
      middleColor,
      smoothstep(0.48, 0.68, normalizedY)
    );
    color = mix(color, zenithColor, smoothstep(0.62, 1.0, normalizedY));
    gl_FragColor = vec4(color, 1.0);
  }
`;

/** Low-segment procedural sky shell compatible with WebGL1 / GLSL ES 1.00. */
export function SkyDome() {
  return (
    <mesh frustumCulled={false}>
      <sphereGeometry
        args={[
          SKY_DOME.radius,
          SKY_DOME.widthSegments,
          SKY_DOME.heightSegments
        ]}
      />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={skyUniforms}
        side={BackSide}
        depthWrite={false}
      />
    </mesh>
  );
}
