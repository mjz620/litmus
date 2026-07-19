"use client";

import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, type ThreeEvent, useThree } from "@react-three/fiber";
import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { Box3, type Group, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import {
  resolveEquipmentPose,
  type ResolvedEquipmentPose
} from "../../../lab-workflows/registries/scene-placements";
import type { SetupDrivenLabProjection } from "../../../stores/setupDrivenLabSession";
import { Burette } from "../three/Burette";
import { ClassroomEnvironment } from "../three/ClassroomEnvironment";
import { ErlenmeyerFlask } from "../three/ErlenmeyerFlask";
import { IndicatorShelf } from "../three/IndicatorShelf";
import {
  Calorimeter,
  DistilledWaterWashBottle,
  RegisteredReagentBottle,
  Thermometer,
  VolumetricFlask,
  VolumetricPipette
} from "../three/SolutionPreparationEquipment";
import { BURETTE, FLASK, SHELF } from "../three/benchLayout";
import { worldPositionForEquipmentPose } from "../three/equipmentPose";

import styles from "./SetupDrivenWorkspace.module.css";

const OVERVIEW_TARGET: readonly [number, number, number] = [0, 0.9, 0.16];

const LABEL_STYLE: CSSProperties = {
  padding: "0.32rem 0.56rem",
  border: "1px solid var(--lab-border, var(--color-border))",
  borderRadius: "var(--radius-sm)",
  background: "var(--lab-hud-surface, var(--color-surface))",
  boxShadow: "var(--lab-floating-shadow, var(--shadow-card))",
  color: "var(--lab-primary, var(--color-primary))",
  fontFamily: "var(--font-body)",
  fontSize: "0.72rem",
  fontWeight: 700,
  lineHeight: 1,
  pointerEvents: "none",
  whiteSpace: "nowrap"
};

function finiteField(
  equipment: SetupDrivenLabProjection["equipment"][number],
  key: string,
  fallback = 0
): number {
  const value = equipment.stateFields[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function fillFraction(
  equipment: SetupDrivenLabProjection["equipment"][number]
): number {
  const capacity = finiteField(equipment, "capacityML", 0);
  const available = finiteField(
    equipment,
    "availableML",
    finiteField(equipment, "totalVolumeML", 0)
  );
  return capacity > 0 ? available / capacity : available > 0 ? 0.7 : 0;
}

export function resolveSetupDrivenPoses(
  projection: Readonly<SetupDrivenLabProjection>
): readonly ResolvedEquipmentPose[] {
  return Object.freeze(
    projection.equipment.map((equipment) =>
      resolveEquipmentPose({
        equipmentInstanceId: equipment.instanceId,
        equipmentDefinitionId: equipment.equipmentDefinitionId,
        visualAdapterDefinitionId: equipment.visualAdapterDefinitionId,
        placementSlotId: equipment.placementSlotId
      })
    )
  );
}

/** Lets a teacher drag to orbit, scroll to zoom, and click equipment to
 * recenter — the bench is otherwise a fixed illustration nobody can explore. */
function ExploreControls({
  focusTarget
}: {
  readonly focusTarget: readonly [number, number, number] | null;
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.target.set(...(focusTarget ?? OVERVIEW_TARGET));
    controls.update();
    invalidate();
  }, [focusTarget, invalidate]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.12}
      minDistance={0.35}
      maxDistance={2.4}
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI / 2 - 0.02}
      target={OVERVIEW_TARGET}
      onChange={() => invalidate()}
    />
  );
}

function visualFor(equipment: SetupDrivenLabProjection["equipment"][number]) {
  switch (equipment.visualAdapterDefinitionId) {
    // The caller already wraps this in a group carrying the resolved pose's
    // translation and yaw, rotated about that group's own local origin — so
    // each case below only re-centers a component's baked-in absolute anchor
    // onto that origin. It must not translate or rotate a second time.
    case "visual-adapter.burette.v1":
      return (
        <group position={[-BURETTE.x, 0, -BURETTE.z]}>
          <Burette
            availableML={finiteField(equipment, "availableML")}
            capacityML={finiteField(equipment, "capacityML", 50)}
            quality="low"
          />
        </group>
      );
    case "visual-adapter.erlenmeyer_flask.v1":
      return (
        <group position={[-FLASK.x, 0, -FLASK.z]}>
          <ErlenmeyerFlask liquidColor="#dbe9e7" quality="low" />
        </group>
      );
    case "visual-adapter.indicator_bottle.v1":
      return (
        <group position={[SHELF.x, SHELF.baseY, SHELF.z]}>
          <IndicatorShelf
            focused={false}
            selectionEnabled={false}
            selectedIndicator={null}
            pouringIndicator={null}
            onBottleClick={() => undefined}
          />
        </group>
      );
    case "visual-adapter.reagent_bottle.v1":
      return <RegisteredReagentBottle fillFraction={0.7} />;
    case "visual-adapter.volumetric_pipette.v1":
      return <VolumetricPipette fillFraction={fillFraction(equipment)} />;
    case "visual-adapter.volumetric_flask.v1":
      return <VolumetricFlask fillFraction={fillFraction(equipment)} />;
    case "visual-adapter.wash_bottle.v1":
      return <DistilledWaterWashBottle fillFraction={0.75} />;
    case "visual-adapter.calorimeter.v1":
      return <Calorimeter fillFraction={fillFraction(equipment)} />;
    case "visual-adapter.thermometer.v1":
      return <Thermometer />;
    default:
      return null;
  }
}

interface HoverLabel {
  readonly instanceId: string;
  readonly label: string;
  readonly position: readonly [number, number, number];
}

function Scene({
  projection,
  poses,
  selectedId,
  onSelect
}: {
  readonly projection: Readonly<SetupDrivenLabProjection>;
  readonly poses: readonly ResolvedEquipmentPose[];
  readonly selectedId: string | null;
  readonly onSelect: (
    instanceId: string,
    focusTarget: readonly [number, number, number]
  ) => void;
}) {
  const groupRefs = useRef(new Map<string, Group>()).current;
  const [hover, setHover] = useState<HoverLabel | null>(null);
  const invalidate = useThree((state) => state.invalidate);

  function boundsOf(instanceId: string) {
    const group = groupRefs.get(instanceId);
    if (!group) return null;
    const box = new Box3().setFromObject(group);
    const center = box.getCenter(new Vector3());
    return { box, center };
  }

  function handlePointerOver(
    event: ThreeEvent<PointerEvent>,
    instanceId: string,
    label: string
  ) {
    event.stopPropagation();
    const bounds = boundsOf(instanceId);
    if (!bounds) return;
    setHover({
      instanceId,
      label,
      position: [bounds.center.x, bounds.box.max.y + 0.04, bounds.center.z]
    });
    invalidate();
  }

  function handlePointerOut(
    event: ThreeEvent<PointerEvent>,
    instanceId: string
  ) {
    event.stopPropagation();
    setHover((current) =>
      current?.instanceId === instanceId ? null : current
    );
    invalidate();
  }

  function handleClick(event: ThreeEvent<MouseEvent>, instanceId: string) {
    event.stopPropagation();
    const bounds = boundsOf(instanceId);
    if (!bounds) return;
    onSelect(instanceId, [bounds.center.x, bounds.center.y, bounds.center.z]);
  }

  return (
    <>
      <color attach="background" args={["#e8f0ec"]} />
      <ambientLight intensity={1.05} />
      <directionalLight position={[2.4, 3.2, 2]} intensity={1.65} />
      <ClassroomEnvironment />
      {poses.map((pose) => {
        const equipment = projection.equipment.find(
          ({ instanceId }) => instanceId === pose.equipmentInstanceId
        );
        if (!equipment) return null;
        const instanceId = pose.equipmentInstanceId;
        return (
          <group
            key={instanceId}
            ref={(node) => {
              if (node) groupRefs.set(instanceId, node);
              else groupRefs.delete(instanceId);
            }}
            position={[...worldPositionForEquipmentPose(pose)]}
            rotation={[0, pose.yawRadians, 0]}
            onPointerOver={(event) =>
              handlePointerOver(event, instanceId, equipment.label)
            }
            onPointerOut={(event) => handlePointerOut(event, instanceId)}
            onClick={(event) => handleClick(event, instanceId)}
            scale={selectedId === instanceId ? 1.04 : 1}
          >
            {visualFor(equipment)}
          </group>
        );
      })}
      {hover && (
        <Html
          position={hover.position}
          center
          pointerEvents="none"
          aria-hidden="true"
        >
          <span style={LABEL_STYLE}>{hover.label}</span>
        </Html>
      )}
    </>
  );
}

export function SetupDrivenBench({
  projection
}: {
  readonly projection: Readonly<SetupDrivenLabProjection>;
}) {
  const poses = useMemo(
    () => resolveSetupDrivenPoses(projection),
    [projection]
  );
  const [selection, setSelection] = useState<{
    readonly instanceId: string;
    readonly target: readonly [number, number, number];
  } | null>(null);
  return (
    <div
      className={styles.benchCanvas}
      data-testid="setup-driven-student-bench"
      role="img"
      aria-label="3D preview of the lab bench. Drag to look around, scroll to zoom, and click equipment for its name. Use the lab steps list to run the lab."
    >
      <Canvas
        camera={{ position: [0.82, 1.34, 1.48], fov: 28, near: 0.05, far: 80 }}
        dpr={[1, 1.35]}
        frameloop="demand"
        gl={{ antialias: false, alpha: false, powerPreference: "low-power" }}
        onPointerMissed={() => setSelection(null)}
      >
        <Scene
          projection={projection}
          poses={poses}
          selectedId={selection?.instanceId ?? null}
          onSelect={(instanceId, target) =>
            setSelection({ instanceId, target })
          }
        />
        <ExploreControls focusTarget={selection?.target ?? null} />
      </Canvas>
    </div>
  );
}
