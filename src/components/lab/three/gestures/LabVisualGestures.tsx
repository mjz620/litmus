import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { type Group, type Mesh } from "three";

import { LAB_PALETTE } from "../labPalette";

export type Vec3 = readonly [number, number, number];

export type LabVisualGesture =
  | {
      readonly kind: "pour";
      readonly sequence: number;
      readonly from: Vec3;
      readonly to: Vec3;
      readonly color?: string;
    }
  | {
      readonly kind: "mix";
      readonly sequence: number;
      readonly at: Vec3;
    }
  | {
      readonly kind: "lid";
      readonly sequence: number;
      readonly at: Vec3;
      readonly closing: boolean;
    }
  | {
      readonly kind: "place_probe";
      readonly sequence: number;
      readonly from: Vec3;
      readonly to: Vec3;
    };

export function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function useReducedMotionFlag(): { current: boolean } {
  const reducedMotionRef = useRef(false);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    reducedMotionRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    invalidate();
  }, [invalidate]);
  return reducedMotionRef;
}

/**
 * Reusable bottle pour: travel → tip → stream → return. Gesture-only; chemistry
 * remains owned by the runtime action that enqueued this clip.
 */
export function PourLiquidGesture({
  sequence,
  from,
  to,
  color = "#8fc9df",
  durationS = 1.65,
  onComplete
}: {
  readonly sequence: number;
  readonly from: Vec3;
  readonly to: Vec3;
  readonly color?: string;
  readonly durationS?: number;
  readonly onComplete: (sequence: number) => void;
}) {
  const groupRef = useRef<Group>(null);
  const streamRef = useRef<Mesh>(null);
  const elapsedRef = useRef(0);
  const completedRef = useRef(false);
  const reducedMotionRef = useReducedMotionFlag();
  const invalidate = useThree((state) => state.invalidate);
  const travelEnd = 0.42;
  const pourEnd = 0.72;

  useEffect(() => {
    elapsedRef.current = 0;
    completedRef.current = false;
    invalidate();
  }, [invalidate, sequence]);

  useFrame((_, deltaS) => {
    const group = groupRef.current;
    if (!group || completedRef.current) return;
    elapsedRef.current += reducedMotionRef.current ? deltaS * 4 : deltaS;
    const progress = Math.min(1, elapsedRef.current / durationS);

    let travel = 0;
    if (progress <= travelEnd) travel = easeInOut(progress / travelEnd);
    else if (progress <= pourEnd) travel = 1;
    else travel = 1 - easeInOut((progress - pourEnd) / (1 - pourEnd));

    group.position.set(
      from[0] + (to[0] - from[0]) * travel,
      from[1] + (to[1] - from[1]) * travel + Math.sin(travel * Math.PI) * 0.14,
      from[2] + (to[2] - from[2]) * travel
    );

    const pouring = progress > travelEnd && progress < pourEnd;
    const pourProgress = pouring
      ? (progress - travelEnd) / (pourEnd - travelEnd)
      : 0;
    group.rotation.z = pouring
      ? -Math.min(1, pourProgress * 2.6) * Math.PI * 0.55
      : 0;

    if (streamRef.current) {
      streamRef.current.visible = pouring;
      if (pouring) {
        const length = 0.04 + pourProgress * 0.12;
        streamRef.current.position.set(to[0], to[1] + 0.08 - length / 2, to[2]);
        streamRef.current.scale.set(1, length / 0.08, 1);
      }
    }

    if (progress >= 1) {
      completedRef.current = true;
      onComplete(sequence);
      return;
    }
    invalidate();
  });

  return (
    <>
      <group ref={groupRef} position={[...from]}>
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.04, 0.046, 0.13, 12]} />
          <meshStandardMaterial
            color={LAB_PALETTE.glassFallback}
            roughness={0.72}
          />
        </mesh>
        <mesh position={[0.02, 0.17, 0]} rotation={[0, 0, -0.9]}>
          <cylinderGeometry args={[0.008, 0.012, 0.08, 8]} />
          <meshStandardMaterial
            color={LAB_PALETTE.fixtureMetal}
            metalness={0.6}
            roughness={0.4}
          />
        </mesh>
      </group>
      <mesh ref={streamRef} visible={false}>
        <cylinderGeometry args={[0.006, 0.01, 0.08, 8]} />
        <meshStandardMaterial color={color} transparent opacity={0.78} />
      </mesh>
    </>
  );
}

/** Brief swirl / ripple over a vessel after mixing. */
export function MixSwirlGesture({
  sequence,
  at,
  durationS = 1.05,
  onComplete
}: {
  readonly sequence: number;
  readonly at: Vec3;
  readonly durationS?: number;
  readonly onComplete: (sequence: number) => void;
}) {
  const ringRef = useRef<Mesh>(null);
  const elapsedRef = useRef(0);
  const completedRef = useRef(false);
  const reducedMotionRef = useReducedMotionFlag();
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    elapsedRef.current = 0;
    completedRef.current = false;
    invalidate();
  }, [invalidate, sequence]);

  useFrame((_, deltaS) => {
    const ring = ringRef.current;
    if (!ring || completedRef.current) return;
    elapsedRef.current += reducedMotionRef.current ? deltaS * 4 : deltaS;
    const progress = Math.min(1, elapsedRef.current / durationS);
    const pulse = Math.sin(progress * Math.PI);
    ring.scale.setScalar(0.7 + pulse * 0.55);
    ring.rotation.z = progress * Math.PI * 2.4;
    const material = ring.material as { opacity?: number };
    if (typeof material.opacity === "number") {
      material.opacity = 0.55 * (1 - progress);
    }
    if (progress >= 1) {
      completedRef.current = true;
      onComplete(sequence);
      return;
    }
    invalidate();
  });

  return (
    <mesh
      ref={ringRef}
      position={[at[0], at[1] + 0.12, at[2]]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <torusGeometry args={[0.08, 0.008, 8, 28]} />
      <meshBasicMaterial
        color={LAB_PALETTE.selectionTeal}
        transparent
        opacity={0.55}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Lid lift / drop over the calorimeter cup. */
export function LidMotionGesture({
  sequence,
  at,
  closing,
  durationS = 0.85,
  onComplete
}: {
  readonly sequence: number;
  readonly at: Vec3;
  readonly closing: boolean;
  readonly durationS?: number;
  readonly onComplete: (sequence: number) => void;
}) {
  const lidRef = useRef<Mesh>(null);
  const elapsedRef = useRef(0);
  const completedRef = useRef(false);
  const reducedMotionRef = useReducedMotionFlag();
  const invalidate = useThree((state) => state.invalidate);
  const startY = closing ? at[1] + 0.28 : at[1] + 0.155;
  const endY = closing ? at[1] + 0.155 : at[1] + 0.28;

  useEffect(() => {
    elapsedRef.current = 0;
    completedRef.current = false;
    invalidate();
  }, [invalidate, sequence]);

  useFrame((_, deltaS) => {
    const lid = lidRef.current;
    if (!lid || completedRef.current) return;
    elapsedRef.current += reducedMotionRef.current ? deltaS * 4 : deltaS;
    const progress = Math.min(1, elapsedRef.current / durationS);
    const t = easeInOut(progress);
    lid.position.y = startY + (endY - startY) * t;
    if (progress >= 1) {
      completedRef.current = true;
      onComplete(sequence);
      return;
    }
    invalidate();
  });

  return (
    <mesh ref={lidRef} position={[at[0], startY, at[2]]}>
      <cylinderGeometry args={[0.1, 0.1, 0.018, 24]} />
      <meshStandardMaterial color="#d9d3c7" roughness={0.7} />
    </mesh>
  );
}

/** Thermometer probe travels from rest into the calorimeter. */
export function PlaceProbeGesture({
  sequence,
  from,
  to,
  durationS = 1.15,
  onComplete
}: {
  readonly sequence: number;
  readonly from: Vec3;
  readonly to: Vec3;
  readonly durationS?: number;
  readonly onComplete: (sequence: number) => void;
}) {
  const groupRef = useRef<Group>(null);
  const elapsedRef = useRef(0);
  const completedRef = useRef(false);
  const reducedMotionRef = useReducedMotionFlag();
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    elapsedRef.current = 0;
    completedRef.current = false;
    invalidate();
  }, [invalidate, sequence]);

  useFrame((_, deltaS) => {
    const group = groupRef.current;
    if (!group || completedRef.current) return;
    elapsedRef.current += reducedMotionRef.current ? deltaS * 4 : deltaS;
    const progress = Math.min(1, elapsedRef.current / durationS);
    const t = easeInOut(progress);
    group.position.set(
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t + Math.sin(t * Math.PI) * 0.08,
      from[2] + (to[2] - from[2]) * t
    );
    if (progress >= 1) {
      completedRef.current = true;
      onComplete(sequence);
      return;
    }
    invalidate();
  });

  return (
    <group ref={groupRef} position={[...from]}>
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[0.045, 0.09, 0.02]} />
        <meshStandardMaterial color="#2f3d3a" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 0.22, 10]} />
        <meshStandardMaterial
          color="#c5d0cc"
          metalness={0.35}
          roughness={0.35}
        />
      </mesh>
    </group>
  );
}

export function LabVisualGestureLayer({
  gesture,
  onComplete
}: {
  readonly gesture: LabVisualGesture | null;
  readonly onComplete: (sequence: number) => void;
}) {
  if (!gesture) return null;
  switch (gesture.kind) {
    case "pour":
      return (
        <PourLiquidGesture
          sequence={gesture.sequence}
          from={gesture.from}
          to={gesture.to}
          color={gesture.color}
          onComplete={onComplete}
        />
      );
    case "mix":
      return (
        <MixSwirlGesture
          sequence={gesture.sequence}
          at={gesture.at}
          onComplete={onComplete}
        />
      );
    case "lid":
      return (
        <LidMotionGesture
          sequence={gesture.sequence}
          at={gesture.at}
          closing={gesture.closing}
          onComplete={onComplete}
        />
      );
    case "place_probe":
      return (
        <PlaceProbeGesture
          sequence={gesture.sequence}
          from={gesture.from}
          to={gesture.to}
          onComplete={onComplete}
        />
      );
    default:
      return null;
  }
}
