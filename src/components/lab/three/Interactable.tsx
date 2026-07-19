import { Html } from "@react-three/drei";
import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import {
  type CSSProperties,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef
} from "react";
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
  enabled?: boolean;
  /** Pointer is over this equipment (and it is not the reason for focus alone). */
  hovered: boolean;
  /** Equipment is the current camera/focus selection. */
  selected?: boolean;
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
 * owning the visual hover/selection pulse, emissive shell, and non-interactive
 * HTML label. An invisible hit mesh keeps thin glassware reliably targetable.
 * The upward hover callback also drives the scene-frame cursor. It never
 * dispatches experiment actions.
 */
export function Interactable({
  id,
  label,
  highlightShape,
  children,
  enabled = true,
  hovered,
  selected = false,
  onHover,
  onSelect
}: InteractableProps) {
  const pulseGroupRef = useRef<Group>(null);
  const pointerInsideRef = useRef(false);
  const invalidate = useThree((state) => state.invalidate);
  const highlighted = enabled && (hovered || selected);

  useEffect(
    () => () => {
      if (pointerInsideRef.current) onHover(null);
    },
    [onHover]
  );

  useEffect(() => {
    if (!enabled && pointerInsideRef.current) {
      pointerInsideRef.current = false;
      onHover(null);
    }
    invalidate();
  }, [enabled, highlighted, invalidate, onHover]);

  useFrame((_, deltaS) => {
    const pulseGroup = pulseGroupRef.current;
    if (!pulseGroup) return;

    const targetScale = highlighted ? HOVER_SCALE : 1;
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
    if (!enabled) return;
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
    if (!enabled) return;
    event.stopPropagation();
    onSelect(id);
  }

  return (
    <group
      onPointerOver={enabled ? handlePointerOver : undefined}
      onPointerOut={enabled ? handlePointerOut : undefined}
      onClick={enabled ? handleClick : undefined}
    >
      <group ref={pulseGroupRef}>
        {children}
        {/* Invisible hit volume so thin glassware remains easy to target. */}
        <mesh
          position={highlightShape.position}
          rotation={highlightShape.rotation}
          visible={false}
        >
          {isValidElement(highlightShape.geometry)
            ? cloneElement(highlightShape.geometry as ReactElement)
            : highlightShape.geometry}
          <meshBasicMaterial />
        </mesh>
        {highlighted && (
          <>
            <mesh
              position={highlightShape.position}
              rotation={highlightShape.rotation}
            >
              {isValidElement(highlightShape.geometry)
                ? cloneElement(highlightShape.geometry as ReactElement)
                : highlightShape.geometry}
              <meshStandardMaterial
                color={
                  selected ? LAB_PALETTE.selectionTeal : LAB_PALETTE.hoverMint
                }
                emissive={LAB_PALETTE.selectionTeal}
                emissiveIntensity={selected ? 1.15 : 0.9}
                roughness={0.8}
                transparent
                opacity={selected ? 0.34 : 0.24}
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
              <span
                data-equipment-hover-label={id}
                data-equipment-selected={selected ? "true" : "false"}
                style={LABEL_STYLE}
              >
                {label}
              </span>
            </Html>
          </>
        )}
      </group>
    </group>
  );
}
