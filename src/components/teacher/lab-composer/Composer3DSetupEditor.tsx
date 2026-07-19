"use client";

import { Canvas, type ThreeEvent, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plane, Vector3 } from "three";

import type { IndicatorId } from "../../../experiments/titration/titration";
import type { LabWorkflowDraftV2 } from "../../../lab-workflows/schema/v2";
import {
  placementsForEquipment,
  planVerifiedLayoutMove,
  resolveEquipmentPose,
  rotationAlternatives,
  scenePlacementRegistry,
  type ResolvedEquipmentPose,
  type SceneVector3
} from "../../../lab-workflows/registries/scene-placements";
import { Burette } from "../../lab/three/Burette";
import { ClassroomEnvironment } from "../../lab/three/ClassroomEnvironment";
import { ErlenmeyerFlask } from "../../lab/three/ErlenmeyerFlask";
import { IndicatorShelf } from "../../lab/three/IndicatorShelf";
import {
  DistilledWaterWashBottle,
  RegisteredReagentBottle,
  VolumetricFlask,
  VolumetricPipette
} from "../../lab/three/SolutionPreparationEquipment";
import { BURETTE, FLASK, ISLAND, SHELF } from "../../lab/three/benchLayout";

import styles from "./LabComposer.module.css";

interface Composer3DSetupEditorProps {
  readonly draft: Readonly<LabWorkflowDraftV2>;
  readonly selectedEquipmentId: string;
  readonly onSelectEquipment: (instanceId: string) => void;
  readonly onMoveToSlot: (instanceId: string, slotId: string) => void;
}

interface DragState {
  readonly equipmentInstanceId: string;
  readonly startPoint: SceneVector3;
  readonly delta: SceneVector3;
  readonly linkedEquipmentInstanceIds: readonly string[];
}

const BENCH_PLANE = new Plane(new Vector3(0, 1, 0), -ISLAND.topY);
const DROP_DISTANCE_METERS = 0.32;

function CameraRig() {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    camera.lookAt(0.05, 1.14, 0.18);
    invalidate();
  }, [camera, invalidate]);
  return null;
}

function pointOnBench(event: ThreeEvent<PointerEvent>): SceneVector3 | null {
  const intersection = event.ray.intersectPlane(BENCH_PLANE, new Vector3());
  return intersection ? [intersection.x, intersection.y, intersection.z] : null;
}

const INDICATOR_ID_BY_REAGENT: Readonly<Record<string, IndicatorId>> = {
  "reagent.phenolphthalein.v1": "phenolphthalein",
  "reagent.bromothymol_blue.v1": "bromothymol_blue",
  "reagent.methyl_orange.v1": "methyl_orange"
};

/** The indicators actually bound into a given container instance. */
function indicatorsInContainer(
  draft: Readonly<LabWorkflowDraftV2>,
  containerInstanceId: string
): readonly IndicatorId[] {
  return draft.materials
    .filter((binding) => binding.containerInstanceId === containerInstanceId)
    .map((binding) => INDICATOR_ID_BY_REAGENT[binding.materialProfileId])
    .filter((id): id is IndicatorId => Boolean(id));
}

function visualForPose(
  pose: Readonly<ResolvedEquipmentPose>,
  draft: Readonly<LabWorkflowDraftV2>
) {
  switch (pose.visualAdapterDefinitionId) {
    case "visual-adapter.burette.v1":
      return (
        <group position={[BURETTE.x, 0, BURETTE.z]}>
          <group rotation={[0, pose.yawRadians, 0]}>
            <group position={[-BURETTE.x, 0, -BURETTE.z]}>
              <Burette availableML={28} capacityML={50} quality="low" />
            </group>
          </group>
        </group>
      );
    case "visual-adapter.erlenmeyer_flask.v1":
      return (
        <group position={[FLASK.x, 0, FLASK.z]}>
          <group rotation={[0, pose.yawRadians, 0]}>
            <group position={[-FLASK.x, 0, -FLASK.z]}>
              <ErlenmeyerFlask liquidColor="#f4dbe1" quality="low" />
            </group>
          </group>
        </group>
      );
    case "visual-adapter.indicator_bottle.v1":
      return (
        <group position={[SHELF.x, SHELF.baseY, SHELF.z]}>
          <group rotation={[0, pose.yawRadians, 0]}>
            <IndicatorShelf
              focused={false}
              selectionEnabled={false}
              selectedIndicator={null}
              pouringIndicator={null}
              onBottleClick={() => undefined}
              availableIndicators={indicatorsInContainer(
                draft,
                pose.equipmentInstanceId
              )}
            />
          </group>
        </group>
      );
    case "visual-adapter.reagent_bottle.v1":
      return <RegisteredReagentBottle fillFraction={0.7} />;
    case "visual-adapter.volumetric_pipette.v1":
      return <VolumetricPipette fillFraction={0.7} />;
    case "visual-adapter.volumetric_flask.v1":
      return <VolumetricFlask fillFraction={0.45} />;
    case "visual-adapter.wash_bottle.v1":
      return <DistilledWaterWashBottle fillFraction={0.75} />;
    default:
      return null;
  }
}

function snapPlan(
  draft: Readonly<LabWorkflowDraftV2>,
  instanceId: string,
  placementSlotId: string
) {
  return planVerifiedLayoutMove({
    equipment: draft.equipment.map((equipment) => {
      const definition = scenePlacementRegistry
        .list()
        .find(
          ({ equipmentDefinitionId }) =>
            equipmentDefinitionId === equipment.equipmentDefinitionId
        );
      return {
        instanceId: equipment.instanceId,
        equipmentDefinitionId: equipment.equipmentDefinitionId,
        visualAdapterDefinitionId:
          definition?.visualAdapterDefinitionId ?? "unsupported"
      };
    }),
    placements: draft.layout.placements,
    equipmentInstanceId: instanceId,
    targetPlacementSlotId: placementSlotId
  });
}

function ArrangementScene({
  draft,
  selectedEquipmentId,
  drag,
  onDragChange,
  onSelect,
  onDrop
}: {
  readonly draft: Readonly<LabWorkflowDraftV2>;
  readonly selectedEquipmentId: string;
  readonly drag: DragState | null;
  readonly onDragChange: (drag: DragState | null) => void;
  readonly onSelect: (instanceId: string) => void;
  readonly onDrop: (
    instanceId: string,
    slotId: string | null,
    message?: string
  ) => void;
}) {
  const placements = useMemo(
    () =>
      draft.layout.placements.flatMap((placement) => {
        const equipment = draft.equipment.find(
          ({ instanceId }) => instanceId === placement.equipmentInstanceId
        );
        if (!equipment) return [];
        const registered = scenePlacementRegistry
          .list()
          .find(
            ({ equipmentDefinitionId }) =>
              equipmentDefinitionId === equipment.equipmentDefinitionId
          );
        if (!registered) return [];
        try {
          return [
            resolveEquipmentPose({
              equipmentInstanceId: equipment.instanceId,
              equipmentDefinitionId: equipment.equipmentDefinitionId,
              visualAdapterDefinitionId: registered.visualAdapterDefinitionId,
              placementSlotId: placement.placementSlotId
            })
          ];
        } catch {
          return [];
        }
      }),
    [draft.equipment, draft.layout.placements]
  );
  const activePose = drag
    ? placements.find(
        ({ equipmentInstanceId }) =>
          equipmentInstanceId === drag.equipmentInstanceId
      )
    : undefined;
  const candidates = useMemo(
    () =>
      activePose
        ? placementsForEquipment(activePose.equipmentDefinitionId)
        : [],
    [activePose]
  );

  function beginDrag(
    event: ThreeEvent<PointerEvent>,
    pose: Readonly<ResolvedEquipmentPose>
  ) {
    if (event.button !== 0) return;
    const startPoint = pointOnBench(event);
    if (!startPoint) return;
    event.stopPropagation();
    const linkedEquipmentInstanceIds = placements
      .filter(
        (candidate) =>
          pose.assemblyId !== null &&
          candidate.assemblyId === pose.assemblyId &&
          candidate.anchorId === pose.anchorId
      )
      .map(({ equipmentInstanceId }) => equipmentInstanceId);
    onSelect(pose.equipmentInstanceId);
    onDragChange({
      equipmentInstanceId: pose.equipmentInstanceId,
      startPoint,
      delta: [0, 0, 0],
      linkedEquipmentInstanceIds
    });
  }

  function moveDrag(event: ThreeEvent<PointerEvent>) {
    if (!drag) return;
    const point = pointOnBench(event);
    if (!point) return;
    event.stopPropagation();
    onDragChange({
      ...drag,
      delta: [point[0] - drag.startPoint[0], 0, point[2] - drag.startPoint[2]]
    });
  }

  const commitDrag = useCallback(() => {
    if (!drag || !activePose) return;
    const current = scenePlacementRegistry.get(activePose.placementSlotId);
    const movedCenterX = current.footprintCenterXZ[0] + drag.delta[0];
    const movedCenterZ = current.footprintCenterXZ[1] + drag.delta[2];
    const closest = candidates
      .map((candidate) => ({
        candidate,
        distance: Math.hypot(
          candidate.footprintCenterXZ[0] - movedCenterX,
          candidate.footprintCenterXZ[1] - movedCenterZ
        )
      }))
      .sort((left, right) => left.distance - right.distance)[0];
    onDragChange(null);
    if (!closest || closest.distance > DROP_DISTANCE_METERS) {
      onDrop(
        drag.equipmentInstanceId,
        null,
        "Move canceled. Release equipment inside a highlighted safe position."
      );
      return;
    }
    const plan = snapPlan(
      draft,
      drag.equipmentInstanceId,
      closest.candidate.id
    );
    if (!plan.ok) {
      onDrop(drag.equipmentInstanceId, null, plan.reason);
      return;
    }
    onDrop(drag.equipmentInstanceId, closest.candidate.id);
  }, [activePose, candidates, draft, drag, onDragChange, onDrop]);

  useEffect(() => {
    if (!drag) return;
    const finish = () => commitDrag();
    const cancel = () => {
      onDragChange(null);
      onDrop(
        drag.equipmentInstanceId,
        null,
        "Move canceled. The saved arrangement was not changed."
      );
    };
    window.addEventListener("pointerup", finish, { once: true });
    window.addEventListener("pointercancel", cancel, { once: true });
    return () => {
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [commitDrag, drag, onDragChange, onDrop]);

  return (
    <>
      <color attach="background" args={["#e8f0ec"]} />
      <ambientLight intensity={1.05} />
      <directionalLight position={[2.4, 3.2, 2]} intensity={1.65} />
      <ClassroomEnvironment />
      <CameraRig />
      <mesh
        position={[0, ISLAND.topY + 0.01, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={moveDrag}
      >
        <planeGeometry args={[ISLAND.topWidth, ISLAND.topDepth]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {candidates.map((candidate) => {
        const plan = activePose
          ? snapPlan(draft, activePose.equipmentInstanceId, candidate.id)
          : null;
        return (
          <mesh
            key={candidate.id}
            position={[
              candidate.footprintCenterXZ[0],
              ISLAND.topY + 0.014,
              candidate.footprintCenterXZ[1]
            ]}
            onPointerMove={moveDrag}
          >
            <boxGeometry
              args={[
                candidate.footprintHalfExtentsXZ[0] * 2,
                0.006,
                candidate.footprintHalfExtentsXZ[1] * 2
              ]}
            />
            <meshBasicMaterial
              color={plan?.ok ? "#148478" : "#a94a51"}
              transparent
              opacity={0.48}
            />
          </mesh>
        );
      })}
      {placements.map((pose) => {
        const followsDrag =
          drag?.linkedEquipmentInstanceIds.includes(pose.equipmentInstanceId) ??
          false;
        const delta = followsDrag ? (drag?.delta ?? [0, 0, 0]) : [0, 0, 0];
        return (
          <group
            key={pose.equipmentInstanceId}
            position={[
              pose.translation[0] + delta[0],
              pose.translation[1] + delta[1],
              pose.translation[2] + delta[2]
            ]}
            onPointerDown={(event) => beginDrag(event, pose)}
            onPointerMove={moveDrag}
          >
            {visualForPose(pose, draft)}
            {selectedEquipmentId === pose.equipmentInstanceId && (
              <mesh
                position={[
                  scenePlacementRegistry.get(pose.placementSlotId)
                    .footprintCenterXZ[0] - pose.translation[0],
                  ISLAND.topY + 0.022,
                  scenePlacementRegistry.get(pose.placementSlotId)
                    .footprintCenterXZ[1] - pose.translation[2]
                ]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <torusGeometry args={[0.145, 0.009, 8, 40]} />
                <meshBasicMaterial color="#0b7068" />
              </mesh>
            )}
          </group>
        );
      })}
    </>
  );
}

export function Composer3DSetupEditor({
  draft,
  selectedEquipmentId,
  onSelectEquipment,
  onMoveToSlot
}: Composer3DSetupEditorProps) {
  const [canvasReady, setCanvasReady] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [message, setMessage] = useState(
    "Drag equipment to a highlighted safe position. Linked apparatus moves together."
  );
  const selectedPlacement = draft.layout.placements.find(
    ({ equipmentInstanceId }) => equipmentInstanceId === selectedEquipmentId
  );
  let rotationChoices: ReturnType<typeof rotationAlternatives> = [];
  if (selectedPlacement) {
    try {
      rotationChoices = rotationAlternatives(
        selectedPlacement.placementSlotId as Parameters<
          typeof rotationAlternatives
        >[0]
      );
    } catch {
      rotationChoices = [];
    }
  }
  const currentRotationIndex = rotationChoices.findIndex(
    ({ id }) => id === selectedPlacement?.placementSlotId
  );
  const nextRotation =
    rotationChoices.length > 1
      ? rotationChoices[(currentRotationIndex + 1) % rotationChoices.length]
      : undefined;

  useEffect(() => {
    if (!drag) return;
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setDrag(null);
      setMessage("Move canceled. The saved arrangement was not changed.");
    };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [drag]);

  return (
    <div className={styles.composer3dEditor}>
      <div
        className={styles.composer3dCanvas}
        data-testid="composer-3d-bench"
        data-render-ready={canvasReady ? "true" : "false"}
        aria-hidden="true"
      >
        <Canvas
          camera={{
            position: [0.18, 1.72, 1.72],
            fov: 38,
            near: 0.03,
            far: 40
          }}
          dpr={[1, 1.35]}
          frameloop="demand"
          gl={{ antialias: false, powerPreference: "high-performance" }}
          onCreated={({ invalidate }) => {
            invalidate();
            setCanvasReady(true);
          }}
          fallback={
            <div className={styles.composer3dLoading}>
              3D is unavailable. Use the Accessible list above.
            </div>
          }
        >
          <ArrangementScene
            draft={draft}
            selectedEquipmentId={selectedEquipmentId}
            drag={drag}
            onDragChange={setDrag}
            onSelect={onSelectEquipment}
            onDrop={(instanceId, slotId, errorMessage) => {
              if (!slotId) {
                setMessage(errorMessage ?? "Move canceled.");
                return;
              }
              onMoveToSlot(instanceId, slotId);
              setMessage(
                "Arrangement updated. Use Undo to restore the previous setup."
              );
            }}
          />
        </Canvas>
      </div>
      <div className={styles.composer3dHelp}>
        <p role="status" aria-live="polite">
          {canvasReady ? message : "Loading the 3D arrangement…"}
        </p>
        {nextRotation && selectedPlacement && (
          <button
            type="button"
            onClick={() =>
              onMoveToSlot(
                selectedPlacement.equipmentInstanceId,
                nextRotation.id
              )
            }
          >
            Rotate selected equipment
          </button>
        )}
      </div>
    </div>
  );
}
