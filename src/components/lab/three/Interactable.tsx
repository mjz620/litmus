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
  /**
   * Hit volume, when the shape a student should be able to click differs from
   * the shape worth drawing (a thin ring, say). Defaults to `highlightShape`.
   */
  hitShape?: InteractableHighlightShape;
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
  hitShape,
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
  /*
   * The emissive shell is a hover affordance only. Keeping it on while an item
   * is selected washed the whole viewport teal once the camera zoomed inside
   * the shell, hiding the very controls the zoom exists to reach. Selection is
   * already communicated by the camera move and the floating label.
   */
  const showHighlightShell = enabled && hovered && !selected;

  /*
   * Held in a ref so the effects below do not depend on the callback's
   * identity. Callers pass an inline arrow, so its identity changes on every
   * parent render — and hovering causes a parent render. Depending on it made
   * the unmount cleanup re-run immediately after each hover and call
   * onHover(null), clearing the hover that had just been set. Equipment fired
   * pointerover correctly and then appeared completely unhoverable.
   */
  const onHoverRef = useRef(onHover);
  // Kept current in an effect: assigning during render is impure.
  useEffect(() => {
    onHoverRef.current = onHover;
  });

  useEffect(
    () => () => {
      if (pointerInsideRef.current) onHoverRef.current(null);
    },
    []
  );

  useEffect(() => {
    if (!enabled && pointerInsideRef.current) {
      pointerInsideRef.current = false;
      onHoverRef.current(null);
    }
    invalidate();
  }, [enabled, highlighted, invalidate]);

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

  const hit = hitShape ?? highlightShape;

  /*
   * Handlers sit on the wrapping group so the whole visible object is
   * targetable. Scoping them to the collider alone was a regression: the
   * colliders are far smaller than the meshes they stand in for, so only a
   * few pixels of each item responded and hovering appeared not to work.
   * The collider below still widens thin glassware; it is additive.
   */
  return (
    <group
      onPointerOver={enabled ? handlePointerOver : undefined}
      onPointerOut={enabled ? handlePointerOut : undefined}
      onClick={enabled ? handleClick : undefined}
    >
      <group ref={pulseGroupRef}>
        {children}
        {/*
         * Additive hit volume so thin glassware stays targetable. Kept exactly
         * as it was: making it a rendered, double-sided mesh let it intercept
         * rays it used to pass through, which risks stealing pointerdown from
         * nested controls such as the burette stopcock handle.
         */}
        <mesh
          position={hit.position}
          rotation={hit.rotation}
          visible={false}
        >
          {isValidElement(hit.geometry)
            ? cloneElement(hit.geometry as ReactElement)
            : hit.geometry}
          <meshBasicMaterial />
        </mesh>
        {showHighlightShell && (
          <mesh
            position={highlightShape.position}
            rotation={highlightShape.rotation}
          >
            {isValidElement(highlightShape.geometry)
              ? cloneElement(highlightShape.geometry as ReactElement)
              : highlightShape.geometry}
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
        )}
        {highlighted && (
          <Html
            position={highlightShape.labelPosition}
            center
            /*
             * The wrapper must ignore the pointer, not just the span. When the
             * label mounts under the cursor it otherwise covers the canvas,
             * the browser fires pointerout, hover clears, the label unmounts,
             * and the pointer is back over the canvas — a flicker that leaves
             * equipment looking completely unhoverable.
             */
            pointerEvents="none"
            style={{ pointerEvents: "none" }}
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
        )}
      </group>
    </group>
  );
}
