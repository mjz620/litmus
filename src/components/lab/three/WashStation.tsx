import { Html } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  useMemo
} from "react";
import {
  CanvasTexture,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SRGBColorSpace
} from "three";

import { WASH } from "./benchLayout";
import { LAB_PALETTE } from "./labPalette";

interface WashStationProps {
  focused: boolean;
  preparationEnabled: boolean;
  selectedLiquid: WashLiquid | null;
  funnelSelected: boolean;
  onWashBottleClick: () => void;
  onTitrantBottleClick: () => void;
  onFunnelClick: () => void;
}

export type WashLiquid = "water" | "titrant";

const trayMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.muralBlue,
  roughness: 0.76,
  metalness: 0
});
const washBottleMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.glassFallback,
  roughness: 0.76,
  metalness: 0
});
const reagentBottleMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.woodDark,
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
  onFunnelClick
}: WashStationProps) {
  const waterLabel = useMemo(() => getWaterLabelTexture(), []);
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
        <mesh position={[0, 0.095, 0]} material={washBottleMaterial}>
          <cylinderGeometry args={[0.045, 0.052, 0.15, 14]} />
        </mesh>
        <mesh position={[0, 0.178, 0]} material={washBottleMaterial}>
          <cylinderGeometry args={[0.025, 0.042, 0.035, 14]} />
        </mesh>
        <mesh
          position={[0.026, 0.212, 0]}
          rotation={[0, 0, -Math.PI / 3]}
          material={fixtureMaterial}
        >
          <cylinderGeometry args={[0.009, 0.014, 0.095, 10]} />
        </mesh>
        {waterLabel && (
          <mesh position={[0, 0.1, 0.051]}>
            <planeGeometry args={[0.082, 0.032]} />
            <meshBasicMaterial map={waterLabel} />
          </mesh>
        )}
        {focused && selectedLiquid === "water" && (
          <SelectionRing radius={0.063} />
        )}
        {hotspotsEnabled && (
          <mesh position={[0, 0.11, 0]} material={hotspotMaterial}>
            <boxGeometry args={[0.11, 0.22, 0.12]} />
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
        <mesh position={[0, 0.09, 0]} material={reagentBottleMaterial}>
          <cylinderGeometry args={[0.043, 0.05, 0.14, 14]} />
        </mesh>
        <mesh position={[0, 0.172, 0]} material={reagentBottleMaterial}>
          <cylinderGeometry args={[0.025, 0.031, 0.035, 12]} />
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
