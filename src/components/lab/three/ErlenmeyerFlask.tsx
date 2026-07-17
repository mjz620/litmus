import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  CanvasTexture,
  type Mesh,
  type MeshBasicMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  Vector2
} from "three";

import { type EquipmentHighlight, useBuretteDispense } from "./Burette";
import { FLASK, TILE } from "./benchLayout";
import {
  GlassMaterial,
  type GlassQuality,
  LiquidMaterial
} from "./glassMaterials";
import { LAB_PALETTE } from "./labPalette";

const tileMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.ceramic,
  roughness: 0.72,
  metalness: 0
});

/** Liquid fills the cone to this height above the flask base. */
const LIQUID_HEIGHT = 0.052;
const FLASK_GRADUATION_ARC = 1.45;
const FLASK_GRADUATION_OFFSET = 0.0012;
const RIPPLE_COLOR = LAB_PALETTE.selectionTeal;

export const FLASK_GRADUATION_MARKS = [
  { volumeML: 25, heightFraction: 0.18 },
  { volumeML: 50, heightFraction: 0.4 },
  { volumeML: 75, heightFraction: 0.62 },
  { volumeML: 100, heightFraction: 0.84 }
] as const;

export const FLASK_GRADUATION_SPAN = {
  bottomY: 0.026,
  topY: 0.108
} as const;

let cachedGraduationTexture: CanvasTexture | null = null;

export function getFlaskBodyRadiusAtHeight(height: number): number {
  const slope = (FLASK.shoulderRadius - FLASK.baseRadius) / FLASK.bodyHeight;
  return FLASK.baseRadius + slope * height;
}

export function createErlenmeyerGlassProfile(): Vector2[] {
  const {
    baseRadius,
    bodyHeight,
    shoulderRadius,
    neckRadius,
    neckHeight,
    rimRadius
  } = FLASK;

  return [
    new Vector2(0.0001, 0),
    new Vector2(baseRadius * 0.86, 0),
    new Vector2(baseRadius, 0.007),
    new Vector2(baseRadius, 0.02),
    new Vector2(
      getFlaskBodyRadiusAtHeight(bodyHeight * 0.55),
      0.02 + bodyHeight * 0.53
    ),
    new Vector2(shoulderRadius + 0.009, bodyHeight - 0.024),
    new Vector2(shoulderRadius + 0.004, bodyHeight - 0.008),
    new Vector2(shoulderRadius, bodyHeight - 0.002),
    new Vector2(neckRadius + 0.0045, bodyHeight + 0.004),
    new Vector2(neckRadius, bodyHeight + 0.01),
    new Vector2(neckRadius, bodyHeight + neckHeight - 0.008),
    new Vector2(rimRadius, bodyHeight + neckHeight - 0.003),
    new Vector2(rimRadius, bodyHeight + neckHeight)
  ];
}

/**
 * Draw four approximate-volume markings once per session. The frosted backing
 * and dark ticks mirror the burette texture pattern while remaining readable
 * through either glass quality tier.
 */
function getFlaskGraduationTexture(): CanvasTexture | null {
  if (cachedGraduationTexture) return cachedGraduationTexture;
  if (typeof document === "undefined") return null;

  const width = 512;
  const height = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.clearRect(0, 0, width, height);
  context.globalAlpha = 0.68;
  context.fillStyle = LAB_PALETTE.ceramic;
  context.fillRect(0, 0, width, height);
  context.globalAlpha = 1;
  context.strokeStyle = LAB_PALETTE.graduationInk;
  context.fillStyle = LAB_PALETTE.graduationInk;
  context.lineCap = "round";
  context.textBaseline = "middle";
  context.font = "700 76px system-ui, sans-serif";

  const padY = 48;
  const usableHeight = height - padY * 2;

  for (const mark of FLASK_GRADUATION_MARKS) {
    const y = height - padY - mark.heightFraction * usableHeight;

    context.lineWidth = 11;
    context.beginPath();
    context.moveTo(26, y);
    context.lineTo(260, y);
    context.stroke();
    context.fillText(String(mark.volumeML), 286, y);
  }

  context.font = "700 58px system-ui, sans-serif";
  context.fillText("mL", 376, 66);

  cachedGraduationTexture = new CanvasTexture(canvas);
  cachedGraduationTexture.colorSpace = SRGBColorSpace;
  cachedGraduationTexture.anisotropy = 4;
  return cachedGraduationTexture;
}

interface ErlenmeyerFlaskProps {
  liquidColor: string;
  quality: GlassQuality;
  highlight?: EquipmentHighlight;
}

/**
 * Erlenmeyer flask on its drip tile: lathe-profiled glass with a distinct
 * conical body, neck, and rim lip. Liquid color is the engine-observed
 * indicator projection.
 */
export function ErlenmeyerFlask({
  liquidColor,
  quality,
  highlight = "none"
}: ErlenmeyerFlaskProps) {
  const dispenseContext = useBuretteDispense();
  const invalidate = useThree((state) => state.invalidate);
  const profile = useMemo(() => createErlenmeyerGlassProfile(), []);
  const graduationTexture = useMemo(() => getFlaskGraduationTexture(), []);
  const rippleRef = useRef<Mesh>(null);
  const rippleMaterialRef = useRef<MeshBasicMaterial>(null);
  const ripplePhaseRef = useRef(0);
  const liquidTopRadius =
    getFlaskBodyRadiusAtHeight(LIQUID_HEIGHT) - FLASK.wallThickness;
  const liquidBottomRadius = FLASK.baseRadius - FLASK.wallThickness;
  const graduationHeight =
    FLASK_GRADUATION_SPAN.topY - FLASK_GRADUATION_SPAN.bottomY;
  const graduationBottomRadius =
    getFlaskBodyRadiusAtHeight(FLASK_GRADUATION_SPAN.bottomY) +
    FLASK_GRADUATION_OFFSET;
  const graduationTopRadius =
    getFlaskBodyRadiusAtHeight(FLASK_GRADUATION_SPAN.topY) +
    FLASK_GRADUATION_OFFSET;
  const isDispensing = dispenseContext?.controller.state.isHolding ?? false;

  useEffect(() => {
    if (!isDispensing) ripplePhaseRef.current = 0;
    invalidate();
  }, [invalidate, isDispensing]);

  useFrame((_, deltaS) => {
    if (!isDispensing || !rippleRef.current || !rippleMaterialRef.current) {
      return;
    }

    ripplePhaseRef.current = (ripplePhaseRef.current + deltaS * 2.8) % 1;
    const phase = ripplePhaseRef.current;
    rippleRef.current.scale.setScalar(0.65 + phase * 0.9);
    rippleMaterialRef.current.opacity = (1 - phase) * 0.76;
  });

  return (
    <group position={[FLASK.x, 0, FLASK.z]}>
      <mesh
        receiveShadow={quality === "high"}
        position={[0, TILE.topY - TILE.thickness / 2, 0]}
        material={tileMaterial}
      >
        <boxGeometry args={[TILE.size, TILE.thickness, TILE.size]} />
      </mesh>

      <mesh castShadow={quality === "high"} position={[0, FLASK.baseY, 0]}>
        <latheGeometry args={[profile, 28]} />
        <GlassMaterial quality={quality} thickness={FLASK.wallThickness} />
      </mesh>

      {/* Contained liquid: truncated cone matching the body slope. */}
      <mesh
        renderOrder={2}
        position={[0, FLASK.baseY + 0.004 + LIQUID_HEIGHT / 2, 0]}
      >
        <cylinderGeometry
          args={[liquidTopRadius, liquidBottomRadius, LIQUID_HEIGHT, 24]}
        />
        <LiquidMaterial
          quality={quality}
          color={liquidColor}
          opacity={quality === "high" ? 0.96 : 0.82}
        />
      </mesh>
      <mesh
        renderOrder={2}
        position={[0, FLASK.baseY + 0.004 + LIQUID_HEIGHT, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[liquidTopRadius, 24]} />
        <LiquidMaterial
          quality={quality}
          color={liquidColor}
          opacity={quality === "high" ? 1 : 0.95}
        />
      </mesh>

      <mesh
        ref={rippleRef}
        renderOrder={3}
        visible={isDispensing}
        position={[0, FLASK.baseY + 0.005 + LIQUID_HEIGHT, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <torusGeometry args={[liquidTopRadius * 0.45, 0.0018, 8, 28]} />
        <meshBasicMaterial
          ref={rippleMaterialRef}
          color={RIPPLE_COLOR}
          transparent
          opacity={0.76}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </mesh>

      {graduationTexture && (
        <mesh
          renderOrder={4}
          position={[
            0,
            FLASK.baseY +
              (FLASK_GRADUATION_SPAN.bottomY + FLASK_GRADUATION_SPAN.topY) / 2,
            0
          ]}
        >
          <cylinderGeometry
            args={[
              graduationTopRadius,
              graduationBottomRadius,
              graduationHeight,
              28,
              1,
              true,
              -FLASK_GRADUATION_ARC / 2,
              FLASK_GRADUATION_ARC
            ]}
          />
          <meshBasicMaterial
            map={graduationTexture}
            transparent
            depthWrite={false}
            depthTest={false}
            toneMapped={false}
          />
        </mesh>
      )}

      {highlight !== "none" && (
        <mesh
          position={[
            0,
            FLASK.baseY + (FLASK.bodyHeight + FLASK.neckHeight) / 2,
            0
          ]}
        >
          <cylinderGeometry
            args={[
              FLASK.baseRadius + 0.014,
              FLASK.baseRadius + 0.014,
              FLASK.bodyHeight + FLASK.neckHeight + 0.03,
              20,
              1,
              true
            ]}
          />
          <meshBasicMaterial
            color={
              highlight === "selected"
                ? LAB_PALETTE.selectionTeal
                : LAB_PALETTE.hoverMint
            }
            transparent
            opacity={highlight === "selected" ? 0.32 : 0.24}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
