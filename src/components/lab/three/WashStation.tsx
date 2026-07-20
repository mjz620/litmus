import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent
} from "react";
import { MeshBasicMaterial, MeshStandardMaterial } from "three";

import { WASH } from "./benchLayout";
import { GlassMaterial, type GlassQuality } from "./glassMaterials";
import { LAB_PALETTE } from "./labPalette";
import { WashSqueezeBottle } from "./WashSqueezeBottle";

interface WashStationProps {
  focused: boolean;
  preparationEnabled: boolean;
  selectedLiquid: WashLiquid | null;
  funnelSelected: boolean;
  onWashBottleClick: () => void;
  onTitrantBottleClick: () => void;
  onFunnelClick: () => void;
  /** Shared laboratory-glass tier; matches the titration flask. */
  quality?: GlassQuality;
}

export type WashLiquid = "water" | "titrant";

const trayMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.muralBlue,
  roughness: 0.76,
  metalness: 0
});
const fixtureMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.fixtureMetal,
  roughness: 0.42,
  metalness: 0.68
});
const hotspotMaterial = new MeshBasicMaterial({
  transparent: true,
  opacity: 0,
  depthWrite: false,
  colorWrite: false
});

const HOTSPOT_LABEL_STYLE: CSSProperties = {
  padding: "0.3rem 0.48rem",
  borderRadius: "999px",
  background: "color-mix(in srgb, var(--lab-surface) 94%, transparent)",
  boxShadow: "var(--lab-floating-shadow)",
  color: "var(--lab-ink)",
  fontFamily: "var(--font-ui)",
  fontSize: "0.66rem",
  fontWeight: 750,
  lineHeight: 1,
  whiteSpace: "nowrap"
};

/**
 * Preparation station with a labeled water squeeze bottle, titrant reagent
 * bottle, and fill funnel. Hotspots report gesture facts upward only.
 */
export function WashStation({
  focused,
  preparationEnabled,
  selectedLiquid,
  funnelSelected,
  onWashBottleClick,
  onTitrantBottleClick,
  onFunnelClick,
  quality = "high"
}: WashStationProps) {
  const hotspotsEnabled = focused && preparationEnabled;

  function clickHandler(callback: () => void) {
    return (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
      if (hotspotsEnabled) callback();
    };
  }

  return (
    <group>
      <mesh position={[0, 0.012, 0]} material={trayMaterial}>
        <boxGeometry args={[WASH.width, 0.024, WASH.depth]} />
      </mesh>

      <group
        position={[WASH.washBottleX, 0, 0]}
        scale={selectedLiquid === "water" ? 1.06 : 1}
        onClick={hotspotsEnabled ? clickHandler(onWashBottleClick) : undefined}
      >
        <WashSqueezeBottle showLabel quality={quality} />
        {focused && selectedLiquid === "water" && (
          <SelectionRing radius={0.063} />
        )}
        {/* Hotspot is widened to contain the angled spout, which reached
            past the old box on both the x and y axes. */}
        {hotspotsEnabled && (
          <mesh position={[0.008, 0.12, 0]} material={hotspotMaterial}>
            <boxGeometry args={[0.15, 0.26, 0.12]} />
          </mesh>
        )}
        {focused && (
          <HotspotLabel
            name="water"
            label="Distilled water"
            position={[0, 0.095, 0]}
            onActivate={hotspotsEnabled ? onWashBottleClick : undefined}
          />
        )}
      </group>

      <group
        position={[WASH.titrantBottleX, 0, 0]}
        scale={selectedLiquid === "titrant" ? 1.06 : 1}
        onClick={
          hotspotsEnabled ? clickHandler(onTitrantBottleClick) : undefined
        }
      >
        {/* Glass reagent bottle, matching the flask's material, with the
            titrant visible inside at a fixed decorative fixture level. */}
        <mesh position={[0, 0.09, 0]}>
          <cylinderGeometry args={[0.043, 0.05, 0.14, 14]} />
          <GlassMaterial quality={quality} thickness={0.003} />
        </mesh>
        <mesh position={[0, 0.065, 0]}>
          <cylinderGeometry args={[0.038, 0.045, 0.095, 14]} />
          <meshStandardMaterial
            color={LAB_PALETTE.buretteLiquid}
            transparent
            opacity={0.72}
            roughness={0.25}
          />
        </mesh>
        <mesh position={[0, 0.172, 0]}>
          <cylinderGeometry args={[0.025, 0.031, 0.035, 12]} />
          <GlassMaterial quality={quality} thickness={0.003} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.032, 0.032, 0.022, 12]} />
          <meshStandardMaterial
            color={LAB_PALETTE.wood}
            roughness={0.76}
            metalness={0}
          />
        </mesh>
        <mesh position={[0, 0.095, 0.049]}>
          <planeGeometry args={[0.072, 0.04]} />
          <meshBasicMaterial color={LAB_PALETTE.ceramic} />
        </mesh>
        {focused && selectedLiquid === "titrant" && (
          <SelectionRing radius={0.061} />
        )}
        {hotspotsEnabled && (
          <mesh position={[0, 0.105, 0]} material={hotspotMaterial}>
            <boxGeometry args={[0.105, 0.21, 0.115]} />
          </mesh>
        )}
        {focused && (
          <HotspotLabel
            name="titrant"
            label="Titrant"
            position={[0, 0.09, 0]}
            onActivate={hotspotsEnabled ? onTitrantBottleClick : undefined}
          />
        )}
      </group>

      <group
        position={[WASH.funnelX, 0, 0]}
        scale={funnelSelected ? 1.06 : 1}
        onClick={hotspotsEnabled ? clickHandler(onFunnelClick) : undefined}
      >
        <mesh position={[0, 0.15, 0]} material={fixtureMaterial}>
          <cylinderGeometry args={[0.052, 0.014, 0.085, 16, 1, true]} />
        </mesh>
        <mesh position={[0, 0.075, 0]} material={fixtureMaterial}>
          <cylinderGeometry args={[0.011, 0.011, 0.08, 10]} />
        </mesh>
        {focused && funnelSelected && <SelectionRing radius={0.064} />}
        {hotspotsEnabled && (
          <mesh position={[0, 0.115, 0]} material={hotspotMaterial}>
            <boxGeometry args={[0.09, 0.21, 0.11]} />
          </mesh>
        )}
        {focused && (
          <HotspotLabel
            name="funnel"
            label="Fill funnel"
            position={[0, 0.14, 0]}
            onActivate={hotspotsEnabled ? onFunnelClick : undefined}
          />
        )}
      </group>
    </group>
  );
}

function SelectionRing({ radius }: { radius: number }) {
  return (
    <group>
      <mesh position={[0, 0.029, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius * 1.05, 28]} />
        <meshBasicMaterial
          color={LAB_PALETTE.selectionTeal}
          transparent
          opacity={0.16}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0.031, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.005, 8, 28]} />
        <meshBasicMaterial
          color={LAB_PALETTE.selectionTeal}
          transparent
          opacity={0.95}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function HotspotLabel({
  name,
  label,
  position,
  onActivate
}: {
  name: string;
  label: string;
  position: [number, number, number];
  onActivate?: () => void;
}) {
  const interactive = Boolean(onActivate);

  return (
    <Html
      position={position}
      center
      pointerEvents={interactive ? "auto" : "none"}
      style={{ pointerEvents: interactive ? "auto" : "none" }}
      zIndexRange={[3, 0]}
      aria-hidden="true"
    >
      <span
        data-wash-station-hotspot={name}
        style={{
          ...HOTSPOT_LABEL_STYLE,
          cursor: interactive ? "pointer" : "default",
          pointerEvents: interactive ? "auto" : "none"
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event: ReactMouseEvent<HTMLSpanElement>) => {
          event.preventDefault();
          event.stopPropagation();
          onActivate?.();
        }}
      >
        {label}
      </span>
    </Html>
  );
}
