import { useMemo } from "react";
import {
  CanvasTexture,
  MeshStandardMaterial,
  SRGBColorSpace
} from "three";

import { GlassMaterial, type GlassQuality } from "./glassMaterials";
import { LAB_PALETTE } from "./labPalette";

const spoutMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.fixtureMetal,
  roughness: 0.42,
  metalness: 0.68
});

let cachedWaterLabel: CanvasTexture | null = null;

function getWaterLabelTexture(): CanvasTexture | null {
  if (cachedWaterLabel) return cachedWaterLabel;
  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.fillStyle = LAB_PALETTE.ceramic;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = LAB_PALETTE.selectionTeal;
  context.lineWidth = 10;
  context.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);
  context.fillStyle = LAB_PALETTE.graduationInk;
  context.font = "700 58px system-ui, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("Distilled water", canvas.width / 2, canvas.height / 2);

  cachedWaterLabel = new CanvasTexture(canvas);
  cachedWaterLabel.colorSpace = SRGBColorSpace;
  cachedWaterLabel.anisotropy = 4;
  return cachedWaterLabel;
}

export interface WashSqueezeBottleProps {
  /** Show the distilled-water canvas label (titration station default). */
  readonly showLabel?: boolean;
  /** Optional fill fraction for translucent water level (native labs). */
  readonly fillFraction?: number;
  /** Shared laboratory-glass tier; matches the titration flask. */
  readonly quality?: GlassQuality;
}

/**
 * Shared distilled-water squeeze bottle used by the titration wash station and
 * setup-driven wash-bottle placements. Local origin sits on the bench contact.
 */
export function WashSqueezeBottle({
  showLabel = true,
  fillFraction,
  quality = "high"
}: WashSqueezeBottleProps) {
  const waterLabel = useMemo(() => getWaterLabelTexture(), []);
  /*
   * Native labs project the engine-owned level; the titration station's
   * bottle is a decorative fixture with no engine state, so with the body now
   * transparent glass it renders a fixed presentation-only water level
   * instead of standing empty.
   */
  const clamped =
    fillFraction === undefined
      ? 0.75
      : Math.max(0, Math.min(1, fillFraction));

  return (
    <group>
      <mesh position={[0, 0.095, 0]}>
        <cylinderGeometry args={[0.045, 0.052, 0.15, 14]} />
        <GlassMaterial quality={quality} thickness={0.003} />
      </mesh>
      {clamped > 0 && (
        <mesh position={[0, 0.02 + clamped * 0.055, 0]}>
          <cylinderGeometry args={[0.04, 0.045, clamped * 0.12, 14]} />
          <meshStandardMaterial color="#8fc9df" transparent opacity={0.68} />
        </mesh>
      )}
      <mesh position={[0, 0.178, 0]}>
        <cylinderGeometry args={[0.025, 0.042, 0.035, 14]} />
        <GlassMaterial quality={quality} thickness={0.003} />
      </mesh>
      <mesh
        position={[0.026, 0.212, 0]}
        rotation={[0, 0, -Math.PI / 3]}
        material={spoutMaterial}
      >
        <cylinderGeometry args={[0.009, 0.014, 0.095, 10]} />
      </mesh>
      {showLabel && waterLabel && (
        <mesh position={[0, 0.1, 0.051]}>
          <planeGeometry args={[0.082, 0.032]} />
          <meshBasicMaterial map={waterLabel} />
        </mesh>
      )}
    </group>
  );
}

/**
 * Bounding shell for Interactable hover / hit targeting. Sized to contain the
 * angled spout, whose tip reaches x ≈ 0.067 and y ≈ 0.236 and previously sat
 * outside the hit volume on both axes.
 */
export const WASH_SQUEEZE_BOTTLE_HIT = {
  radius: 0.075,
  height: 0.26,
  centerY: 0.12,
  labelY: 0.29
} as const;

/**
 * Local-space spout tip, so a pour can be aligned by the nozzle rather than by
 * the bottle's bench origin.
 */
export const WASH_SQUEEZE_BOTTLE_SPOUT_TIP = [0.067, 0.236, 0] as const;
