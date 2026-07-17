import { Html } from "@react-three/drei";
import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { type CSSProperties, type ReactNode, useEffect, useRef } from "react";
import type { Group } from "three";

import type { EquipmentId } from "../titration/equipment";
import { LAB_PALETTE } from "./labPalette";

type Vec3 = [number, number, number];

export interface InteractableHighlightShape {
  geometry: ReactNode;
  position?: Vec3;
  rotation?: Vec3;
  labelPosition: Vec3;
}

interface InteractableProps {
  id: EquipmentId;
  label: string;
  highlightShape: InteractableHighlightShape;
  children: ReactNode;
  hovered: boolean;
  onHover: (equipment: EquipmentId | null) => void;
  onSelect: (equipment: EquipmentId) => void;
}

const LABEL_STYLE: CSSProperties = {
  padding: "0.38rem 0.62rem",
  border: "1px solid var(--lab-border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--lab-hud-surface)",
  boxShadow: "var(--lab-floating-shadow)",
  color: "var(--lab-primary)",
  fontFamily: "var(--font-body)",
  fontSize: "0.76rem",
  fontWeight: 750,
  lineHeight: 1,
  pointerEvents: "none",
  whiteSpace: "nowrap"
};

const HOVER_SCALE = 1.04;
const SCALE_RESPONSE = 18;
const SCALE_EPSILON = 0.0005;

/**
 * Shared 3D equipment affordance. It reports pointer interest upward while
 * owning the visual hover pulse, emissive shell, and non-interactive HTML
 * label. The upward hover callback also drives the scene-frame cursor. It
 * never dispatches experiment actions.
 */
export function Interactable({
  id,
  label,
  highlightShape,
  children,
  hovered,
  onHover,
  onSelect
}: InteractableProps) {
  const pulseGroupRef = useRef<Group>(null);
  const pointerInsideRef = useRef(false);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(
    () => () => {
      if (pointerInsideRef.current) onHover(null);
    },
    [onHover]
  );

  useEffect(() => invalidate(), [hovered, invalidate]);

  useFrame((_, deltaS) => {
    const pulseGroup = pulseGroupRef.current;
    if (!pulseGroup) return;

    const targetScale = hovered ? HOVER_SCALE : 1;
    const currentScale = pulseGroup.scale.x;
    const blend = 1 - Math.exp(-SCALE_RESPONSE * deltaS);
    const nextScale =
      Math.abs(targetScale - currentScale) <= SCALE_EPSILON
        ? targetScale
        : currentScale + (targetScale - currentScale) * blend;

    pulseGroup.scale.setScalar(nextScale);
    if (nextScale !== targetScale) invalidate();
  });

  function handlePointerOver(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    if (pointerInsideRef.current) return;

    pointerInsideRef.current = true;
    onHover(id);
  }

  function handlePointerOut(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    if (!pointerInsideRef.current) return;

    pointerInsideRef.current = false;
    onHover(null);
  }

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    onSelect(id);
  }

  return (
    <group
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
      onClick={handleClick}
    >
      <group ref={pulseGroupRef}>
        {children}
        {hovered && (
          <>
            <mesh
              position={highlightShape.position}
              rotation={highlightShape.rotation}
            >
              {highlightShape.geometry}
              <meshStandardMaterial
                color={LAB_PALETTE.hoverMint}
                emissive={LAB_PALETTE.selectionTeal}
                emissiveIntensity={0.9}
                roughness={0.8}
                transparent
                opacity={0.24}
                depthWrite={false}
              />
            </mesh>
            <Html
              position={highlightShape.labelPosition}
              center
              pointerEvents="none"
              zIndexRange={[2, 0]}
              aria-hidden="true"
            >
              <span data-equipment-hover-label={id} style={LABEL_STYLE}>
                {label}
              </span>
            </Html>
          </>
        )}
      </group>
    </group>
  );
}
