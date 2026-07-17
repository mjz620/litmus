import type { Side } from "three";
import { DoubleSide } from "three";

import { LAB_PALETTE } from "./labPalette";

/**
 * Rendering quality for laboratory glassware. "high" uses physically based
 * transmission so backgrounds stay visible through the glass; "low" is the
 * cheap transparent fallback for weak WebGL devices and reduced-graphics
 * mode. Vessel shapes, liquid levels, and markings are identical in both.
 */
export type GlassQuality = "high" | "low";

interface GlassMaterialProps {
  quality: GlassQuality;
  /** Wall thickness hint for refraction, in scene units. */
  thickness?: number;
  side?: Side;
}

/** Shared laboratory glass. */
export function GlassMaterial({
  quality,
  thickness = 0.004,
  side = DoubleSide
}: GlassMaterialProps) {
  if (quality === "high") {
    return (
      <meshPhysicalMaterial
        transmission={0.96}
        ior={1.5}
        thickness={thickness}
        roughness={0.08}
        metalness={0}
        specularIntensity={1}
        envMapIntensity={0.9}
        clearcoat={0.45}
        clearcoatRoughness={0.2}
        color={LAB_PALETTE.glass}
        attenuationColor={LAB_PALETTE.glassAttenuation}
        attenuationDistance={0.5}
        side={side}
      />
    );
  }

  return (
    <meshStandardMaterial
      color={LAB_PALETTE.glassFallback}
      transparent
      opacity={0.34}
      roughness={0.16}
      metalness={0}
      depthWrite={false}
      side={side}
    />
  );
}

interface LiquidMaterialProps {
  quality: GlassQuality;
  color: string;
  opacity?: number;
}

/** Contained liquid. Color is always the engine-observed projection. */
export function LiquidMaterial({
  quality,
  color,
  opacity = 0.85
}: LiquidMaterialProps) {
  if (quality === "high") {
    return (
      <meshPhysicalMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        depthTest={false}
        toneMapped={false}
        roughness={0.2}
        metalness={0}
        clearcoat={0.3}
        clearcoatRoughness={0.3}
        envMapIntensity={0.5}
      />
    );
  }

  return (
    <meshStandardMaterial
      color={color}
      transparent
      opacity={opacity}
      roughness={0.2}
      metalness={0}
    />
  );
}
