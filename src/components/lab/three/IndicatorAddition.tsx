import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { type Group, type Mesh, MeshStandardMaterial } from "three";

import type { IndicatorId } from "../../../experiments/titration/titration";
import { FLASK, FLASK_RIM_Y, SHELF } from "./benchLayout";
import { LAB_PALETTE } from "./labPalette";

const TRAVEL_FRACTION = 0.48;
const POUR_END_FRACTION = 0.78;
const ANIMATION_DURATION_S = 2.1;

const bottleMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.ceramic,
  roughness: 0.72,
  metalness: 0
});

const INDICATOR_COLORS: Record<IndicatorId, string> = {
  phenolphthalein: LAB_PALETTE.phenolphthalein,
  bromothymol_blue: LAB_PALETTE.bromothymolBlue,
  methyl_orange: LAB_PALETTE.methylOrange
};

export const INDICATOR_BOTTLE_ORDER: readonly IndicatorId[] = [
  "phenolphthalein",
  "bromothymol_blue",
  "methyl_orange"
];

export function getIndicatorBottleStart(
  indicator: IndicatorId
): readonly [number, number, number] {
  const index = INDICATOR_BOTTLE_ORDER.indexOf(indicator);
  return [
    SHELF.x + (index - 1) * SHELF.bottleSpacing,
    SHELF.baseY + SHELF.totalHeight * 0.68,
    SHELF.z
  ];
}

interface IndicatorAdditionProps {
  indicator: IndicatorId;
  sequence: number;
  shelfTranslation?: readonly [number, number, number];
  flaskTranslation?: readonly [number, number, number];
  onComplete: (sequence: number) => void;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * A gesture-only projection: the chosen dropper travels from the shelf,
 * tips over the flask, releases visible drops, and returns. Chemistry state
 * remains owned by the experiment action dispatched from the scene shell.
 */
export function IndicatorAddition({
  indicator,
  sequence,
  shelfTranslation = [0, 0, 0],
  flaskTranslation = [0, 0, 0],
  onComplete
}: IndicatorAdditionProps) {
  const groupRef = useRef<Group>(null);
  const dropRefs = useRef<Array<Mesh | null>>([]);
  const elapsedRef = useRef(0);
  const completedRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const invalidate = useThree((state) => state.invalidate);
  const color = INDICATOR_COLORS[indicator];
  const registeredStart = getIndicatorBottleStart(indicator);
  const start: readonly [number, number, number] = [
    registeredStart[0] + shelfTranslation[0],
    registeredStart[1] + shelfTranslation[1],
    registeredStart[2] + shelfTranslation[2]
  ];
  const pour: readonly [number, number, number] = [
    FLASK.x + 0.045 + flaskTranslation[0],
    FLASK_RIM_Y + 0.085 + flaskTranslation[1],
    FLASK.z + flaskTranslation[2]
  ];

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    invalidate();
  }, [invalidate]);

  useFrame((_, deltaS) => {
    const group = groupRef.current;
    if (!group || completedRef.current) return;

    elapsedRef.current += reducedMotionRef.current ? deltaS * 4 : deltaS;
    const progress = Math.min(1, elapsedRef.current / ANIMATION_DURATION_S);

    let travelProgress: number;
    if (progress <= TRAVEL_FRACTION) {
      travelProgress = easeInOut(progress / TRAVEL_FRACTION);
    } else if (progress <= POUR_END_FRACTION) {
      travelProgress = 1;
    } else {
      travelProgress =
        1 - easeInOut((progress - POUR_END_FRACTION) / (1 - POUR_END_FRACTION));
    }

    group.position.set(
      start[0] + (pour[0] - start[0]) * travelProgress,
      start[1] +
        (pour[1] - start[1]) * travelProgress +
        Math.sin(travelProgress * Math.PI) * 0.18,
      start[2] + (pour[2] - start[2]) * travelProgress
    );

    const pouring = progress > TRAVEL_FRACTION && progress < POUR_END_FRACTION;
    const pourProgress = pouring
      ? (progress - TRAVEL_FRACTION) / (POUR_END_FRACTION - TRAVEL_FRACTION)
      : 0;
    group.rotation.z = pouring
      ? -Math.min(1, pourProgress * 3) * Math.PI * 0.67
      : 0;

    dropRefs.current.forEach((drop, index) => {
      if (!drop) return;
      const staggered = pourProgress * 2.2 - index * 0.34;
      const active = pouring && staggered > 0 && staggered < 1;
      drop.visible = active;
      if (!active) return;

      drop.position.set(
        FLASK.x + flaskTranslation[0],
        FLASK_RIM_Y + flaskTranslation[1] + 0.075 * (1 - staggered),
        FLASK.z + flaskTranslation[2]
      );
    });

    if (progress >= 1) {
      completedRef.current = true;
      onComplete(sequence);
      return;
    }
    invalidate();
  });

  return (
    <>
      <group ref={groupRef} position={[...start]} scale={0.58}>
        <mesh material={bottleMaterial}>
          <cylinderGeometry args={[0.029, 0.034, 0.1, 12]} />
        </mesh>
        <mesh position={[0, 0.065, 0]}>
          <coneGeometry args={[0.026, 0.042, 12]} />
          <meshStandardMaterial color={color} roughness={0.72} metalness={0} />
        </mesh>
        <mesh position={[0, 0, 0.031]}>
          <boxGeometry args={[0.043, 0.028, 0.003]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>
      {[0, 1, 2].map((index) => (
        <mesh
          key={index}
          ref={(mesh) => {
            dropRefs.current[index] = mesh;
          }}
          visible={false}
        >
          <sphereGeometry args={[0.006, 10, 10]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}
