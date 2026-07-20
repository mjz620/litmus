import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { PCFShadowMap, type WebGLRenderer } from "three";

import type { IndicatorId } from "../../../experiments/titration/titration";
import type { ResolvedEquipmentPose } from "../../../lab-workflows/registries/scene-placements";
import { EQUIPMENT, type EquipmentId } from "../titration/equipment";
import { BenchCameraControls } from "./BenchCameraControls";
import { Burette } from "./Burette";
import { ClassroomEnvironment } from "./ClassroomEnvironment";
import { ErlenmeyerFlask } from "./ErlenmeyerFlask";
import { IndicatorAddition } from "./IndicatorAddition";
import { IndicatorShelf } from "./IndicatorShelf";
import { Interactable } from "./Interactable";
import { SceneEnvironment } from "./SceneEnvironment";
import { SkyDome } from "./SkyDome";
import { BEAKER_HIT, Beaker } from "./Beaker";
import {
  CALORIMETER_HIT,
  Calorimeter,
  DISTILLED_WASH_BOTTLE_HIT,
  DistilledWaterWashBottle,
  REAGENT_BOTTLE_HIT,
  RegisteredReagentBottle,
  THERMOMETER_HIT,
  THERMOMETER_PLACED_DROP,
  THERMOMETER_SEATED_LIFT,
  Thermometer,
  VOLUMETRIC_FLASK_HIT,
  VOLUMETRIC_PIPETTE_HIT,
  VolumetricFlask,
  VolumetricPipette
} from "./SolutionPreparationEquipment";
import { type WashLiquid, WashStation } from "./WashStation";
import { worldPositionForEquipmentPose } from "./equipmentPose";
import {
  LabVisualGestureLayer,
  type LabVisualGesture
} from "./gestures/LabVisualGestures";
import {
  BURETTE,
  CAMERA_POSES,
  FLASK,
  FLASK_RIM_Y,
  ISLAND,
  SHELF,
  WASH,
  focusPoseForBenchItem,
  getBuretteLiquidTopY,
  getMeniscusCameraPose,
  overviewPoseForBenchContents,
  type BenchContentItem
} from "./benchLayout";
import type { GlassQuality } from "./glassMaterials";
import { LAB_PALETTE } from "./labPalette";

interface LabSceneProps {
  enabledEquipmentIds: readonly EquipmentId[];
  equipmentPoses?: readonly ResolvedEquipmentPose[];
  equipmentFillFractions?: Readonly<Record<string, number>>;
  calorimeterLidClosed?: boolean;
  /** Engine-owned appearance projected into the beaker contents. */
  beakerContentsColor?: string;
  thermometerPlaced?: boolean;
  hideCalorimeterLid?: boolean;
  hideThermometer?: boolean;
  hideWashBottle?: boolean;
  activeVisualGesture?: LabVisualGesture | null;
  onVisualGestureComplete?: (sequence: number) => void;
  buretteAvailableML: number;
  buretteCapacityML: number;
  flaskLiquidColor: string;
  selectedIndicator: IndicatorId | null;
  indicatorSelectionEnabled: boolean;
  indicatorAddition: { indicator: IndicatorId; sequence: number } | null;
  canPrepareBurette: boolean;
  selectedWashLiquid: WashLiquid | null;
  funnelSelected: boolean;
  quality: GlassQuality;
  selected: EquipmentId | null;
  hovered: EquipmentId | null;
  onHover: (equipment: EquipmentId | null) => void;
  onSelect: (equipment: EquipmentId) => void;
  onIndicatorBottleClick: (indicator: IndicatorId) => void;
  onIndicatorAdditionComplete: (sequence: number) => void;
  onWashBottleClick: () => void;
  onTitrantBottleClick: () => void;
  onFunnelClick: () => void;
}

function configureShadowMap(gl: WebGLRenderer, enabled: boolean) {
  gl.shadowMap.enabled = enabled;
  gl.shadowMap.type = PCFShadowMap;
  gl.shadowMap.needsUpdate = true;
}

function LabLighting({ quality }: { quality: GlassQuality }) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const highQuality = quality === "high";

  useEffect(() => {
    configureShadowMap(gl, highQuality);
    invalidate();
  }, [gl, highQuality, invalidate]);

  return (
    <>
      <ambientLight intensity={highQuality ? 0.7 : 0.88} />
      <directionalLight
        position={[2.6, 3, 2.2]}
        intensity={highQuality ? 1.55 : 1.6}
        castShadow={highQuality}
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-camera-left={-1.8}
        shadow-camera-right={1.8}
        shadow-camera-top={2.2}
        shadow-camera-bottom={-0.4}
        shadow-camera-near={0.1}
        shadow-camera-far={8}
        shadow-normalBias={0.015}
      />
      <directionalLight
        position={[-2.2, 2.4, -1.4]}
        intensity={highQuality ? 0.45 : 0.55}
      />
    </>
  );
}

/**
 * Composition of the classroom, equipment, camera, and lighting. The scene
 * projects engine state and reports pointer interest plus physical gesture
 * facts upward. It never computes chemistry or dispatches actions.
 */
export function LabScene({
  enabledEquipmentIds,
  equipmentPoses = [],
  equipmentFillFractions = {},
  calorimeterLidClosed = true,
  beakerContentsColor = "clear",
  thermometerPlaced = false,
  hideCalorimeterLid = false,
  hideThermometer = false,
  hideWashBottle = false,
  activeVisualGesture = null,
  onVisualGestureComplete,
  buretteAvailableML,
  buretteCapacityML,
  flaskLiquidColor,
  selectedIndicator,
  indicatorSelectionEnabled,
  indicatorAddition,
  canPrepareBurette,
  selectedWashLiquid,
  funnelSelected,
  quality,
  selected,
  hovered,
  onHover,
  onSelect,
  onIndicatorBottleClick,
  onIndicatorAdditionComplete,
  onWashBottleClick,
  onTitrantBottleClick,
  onFunnelClick
}: LabSceneProps) {
  const poseDriven = equipmentPoses.length > 0;
  const poseFor = (visualAdapterDefinitionId: string) =>
    equipmentPoses.find(
      (equipmentPose) =>
        equipmentPose.visualAdapterDefinitionId === visualAdapterDefinitionId
    );
  const show = (equipmentId: EquipmentId, adapterId?: string) => {
    if (!enabledEquipmentIds.includes(equipmentId)) return false;
    if (!poseDriven) return true;
    return adapterId ? poseFor(adapterId) != null : true;
  };
  const burettePose = poseFor("visual-adapter.burette.v1");
  const flaskPose = poseFor("visual-adapter.erlenmeyer_flask.v1");
  const shelfPose = poseFor("visual-adapter.indicator_bottle.v1");
  const washPose = poseFor("visual-adapter.reagent_bottle.v1");
  const pipettePose = poseFor("visual-adapter.volumetric_pipette.v1");
  const volumetricFlaskPose = poseFor("visual-adapter.volumetric_flask.v1");
  const washBottlePose = poseFor("visual-adapter.wash_bottle.v1");
  const calorimeterPose = poseFor("visual-adapter.calorimeter.v1");
  const thermometerPose = poseFor("visual-adapter.thermometer.v1");
  const beakerPose = poseFor("visual-adapter.beaker.v1");
  /* Probe seats inside the vessel it measures, rather than at its own stand. */
  const seatedInVessel = thermometerPlaced && calorimeterPose != null;
  const calorimeterWorldPosition = calorimeterPose
    ? worldPositionForEquipmentPose(calorimeterPose)
    : ([0, 0, 0] as const);
  const focusFor = (
    equipmentPose: ResolvedEquipmentPose | undefined,
    hit: { readonly height: number; readonly centerY: number }
  ) =>
    equipmentPose
      ? focusPoseForBenchItem(
          worldPositionForEquipmentPose(equipmentPose),
          hit.height,
          hit.centerY
        )
      : null;
  /*
   * Registry-placed equipment frames itself. Without this every native item
   * fell back to the overview pose, so selecting a calorimeter, beaker, probe
   * or bottle produced no zoom at all.
   */
  const derivedFocusPose =
    selected === "volumetricPipette"
      ? focusFor(pipettePose, VOLUMETRIC_PIPETTE_HIT)
      : selected === "volumetricFlask"
        ? focusFor(volumetricFlaskPose, VOLUMETRIC_FLASK_HIT)
        : selected === "washBottle"
          ? focusFor(washBottlePose, DISTILLED_WASH_BOTTLE_HIT)
          : selected === "reagentBottle"
            ? focusFor(washPose, REAGENT_BOTTLE_HIT)
            : selected === "calorimeter"
              ? focusFor(calorimeterPose, CALORIMETER_HIT)
              : selected === "thermometer"
                ? focusFor(thermometerPose, THERMOMETER_HIT)
                : selected === "beaker"
                  ? focusFor(beakerPose, BEAKER_HIT)
                  : null;
  const thermometerDrop =
    thermometerPlaced && !seatedInVessel ? THERMOMETER_PLACED_DROP : 0;
  const showBurette = show("burette", "visual-adapter.burette.v1");
  const showFlask = show("flask", "visual-adapter.erlenmeyer_flask.v1");
  const showMeniscus = showBurette && enabledEquipmentIds.includes("meniscus");
  const showShelf = show("indicatorShelf", "visual-adapter.indicator_bottle.v1");
  const showWashStation =
    enabledEquipmentIds.includes("washStation") &&
    (!poseDriven || washPose != null) &&
    !pipettePose;
  const showReagentBottle =
    enabledEquipmentIds.includes("reagentBottle") && washPose != null;
  const fillOf = (adapterId: string, fallback = 0.55) =>
    equipmentFillFractions[adapterId] ?? fallback;
  const buretteTranslation = burettePose?.translation ?? ([0, 0, 0] as const);
  const flaskTranslation = flaskPose?.translation ?? ([0, 0, 0] as const);
  const shelfTranslation = shelfPose?.translation ?? ([0, 0, 0] as const);
  const washTranslation = washPose?.translation ?? ([0, 0, 0] as const);
  const liquidTopY = getBuretteLiquidTopY(
    buretteAvailableML,
    buretteCapacityML
  );
  const meniscusY = liquidTopY ?? BURETTE.graduationBottomY;
  const buretteCenterY = (BURETTE.tipBottomY + BURETTE.tubeTopY) / 2;
  const buretteHighlightHeight = BURETTE.tubeTopY - BURETTE.tipBottomY + 0.03;
  const flaskCenterY = FLASK.baseY + (FLASK.bodyHeight + FLASK.neckHeight) / 2;
  const flaskHighlightHeight = FLASK.bodyHeight + FLASK.neckHeight + 0.03;
  /*
   * What this bench is holding, in world coordinates, so the overview can be
   * framed on it. Every entry is gated on the same flag that renders it: the
   * first cut keyed the reagent bottle off WASH.x while the bottle is actually
   * registry-placed, which dragged the framing centre toward a phantom item and
   * pushed the real glassware to the edge of the frame.
   */
  const benchContents: BenchContentItem[] = [];
  const addPlacedContent = (
    equipmentPose: ResolvedEquipmentPose | undefined,
    hit: {
      readonly radius: number;
      readonly height: number;
      readonly centerY: number;
    }
  ) => {
    if (!equipmentPose) return;
    const [x, baseY, z] = worldPositionForEquipmentPose(equipmentPose);
    benchContents.push({
      centerXZ: [x, z],
      radiusXZ: hit.radius,
      baseY,
      topY: baseY + hit.centerY + hit.height / 2
    });
  };
  const addFixedContent = (
    translation: readonly [number, number, number],
    x: number,
    z: number,
    radiusXZ: number,
    topY: number
  ) => {
    benchContents.push({
      centerXZ: [x + translation[0], z + translation[2]],
      radiusXZ,
      baseY: ISLAND.topY + translation[1],
      topY: topY + translation[1]
    });
  };

  if (pipettePose && enabledEquipmentIds.includes("volumetricPipette")) {
    addPlacedContent(pipettePose, VOLUMETRIC_PIPETTE_HIT);
  }
  if (volumetricFlaskPose && enabledEquipmentIds.includes("volumetricFlask")) {
    addPlacedContent(volumetricFlaskPose, VOLUMETRIC_FLASK_HIT);
  }
  if (washBottlePose && enabledEquipmentIds.includes("washBottle")) {
    addPlacedContent(washBottlePose, DISTILLED_WASH_BOTTLE_HIT);
  }
  if (calorimeterPose && enabledEquipmentIds.includes("calorimeter")) {
    addPlacedContent(calorimeterPose, CALORIMETER_HIT);
  }
  if (thermometerPose && enabledEquipmentIds.includes("thermometer")) {
    addPlacedContent(thermometerPose, THERMOMETER_HIT);
  }
  if (beakerPose && enabledEquipmentIds.includes("beaker")) {
    addPlacedContent(beakerPose, BEAKER_HIT);
  }
  if (showReagentBottle) {
    addPlacedContent(washPose, REAGENT_BOTTLE_HIT);
  }
  if (showBurette) {
    // The stand carries the burette, so the pair frames as one tall column.
    addFixedContent(buretteTranslation, BURETTE.x, BURETTE.z, 0.1, BURETTE.tubeTopY);
  }
  if (showFlask) {
    addFixedContent(flaskTranslation, FLASK.x, FLASK.z, FLASK.baseRadius, FLASK_RIM_Y);
  }
  if (showShelf) {
    addFixedContent(
      shelfTranslation,
      SHELF.x,
      SHELF.z,
      SHELF.width / 2,
      SHELF.baseY + SHELF.totalHeight
    );
  }
  if (showWashStation) {
    addFixedContent(
      washTranslation,
      WASH.x,
      WASH.z,
      WASH.width / 2,
      WASH.baseY + WASH.totalHeight
    );
  }

  const overviewPose = overviewPoseForBenchContents(benchContents);
  const basePose =
    selected === "burette"
      ? CAMERA_POSES.burette
      : selected === "flask"
        ? CAMERA_POSES.flask
        : selected === "meniscus"
          ? getMeniscusCameraPose(liquidTopY)
          : selected === "indicatorShelf"
            ? CAMERA_POSES.indicatorShelf
            : selected === "washStation"
              ? CAMERA_POSES.washStation
              : selected === "volumetricPipette" ||
                  selected === "volumetricFlask" ||
                  selected === "washBottle" ||
                  selected === "reagentBottle" ||
                  selected === "calorimeter" ||
                  selected === "thermometer"
                ? overviewPose
                : overviewPose;
  const selectedPose =
    selected === "burette" || selected === "meniscus"
      ? burettePose
      : selected === "flask"
        ? flaskPose
        : selected === "indicatorShelf"
          ? shelfPose
          : selected === "washStation" || selected === "reagentBottle"
            ? washPose
            : selected === "volumetricPipette"
              ? pipettePose
              : selected === "volumetricFlask"
                ? volumetricFlaskPose
                : selected === "washBottle"
                  ? washBottlePose
                  : selected === "calorimeter"
                    ? calorimeterPose
                    : selected === "thermometer"
                      ? thermometerPose
                      : undefined;
  const selectedPivot: readonly [number, number, number] =
    selected === "burette" || selected === "meniscus"
      ? [BURETTE.x, 0, BURETTE.z]
      : selected === "flask"
        ? [FLASK.x, 0, FLASK.z]
        : selected === "indicatorShelf"
          ? [SHELF.x, 0, SHELF.z]
          : selected === "washStation"
            ? [WASH.x, 0, WASH.z]
            : [0, 0, 0];
  const pose = derivedFocusPose
    ? derivedFocusPose
    : selectedPose
    ? transformCameraPose(
        basePose,
        selectedPose.translation,
        selectedPose.yawRadians,
        selectedPivot
      )
    : basePose;

  return (
    <>
      <color attach="background" args={[LAB_PALETTE.sceneFallback]} />
      <LabLighting quality={quality} />

      <SceneEnvironment enabled={quality === "high"} />
      {quality === "high" && <SkyDome />}
      <ClassroomEnvironment />

      {showBurette && (
      <group
        position={[
          BURETTE.x + buretteTranslation[0],
          buretteCenterY + buretteTranslation[1],
          BURETTE.z + buretteTranslation[2]
        ]}
        rotation={[0, burettePose?.yawRadians ?? 0, 0]}
      >
        <Interactable
          id="burette"
          enabled={enabledEquipmentIds.includes("burette")}
          label={EQUIPMENT.burette.name}
          highlightShape={{
            geometry: (
              <cylinderGeometry
                args={[0.034, 0.034, buretteHighlightHeight, 18, 1, true]}
              />
            ),
            labelPosition: [0, buretteHighlightHeight / 2 + 0.08, 0]
          }}
          hovered={hovered === "burette"}
            selected={selected === "burette"}
          onHover={onHover}
          onSelect={onSelect}
        >
          <group position={[-BURETTE.x, -buretteCenterY, -BURETTE.z]}>
            <Burette
              availableML={buretteAvailableML}
              capacityML={buretteCapacityML}
              quality={quality}
            />
          </group>
        </Interactable>
      </group>
      )}

      {showFlask && (
      <group
        position={[
          FLASK.x + flaskTranslation[0],
          flaskCenterY + flaskTranslation[1],
          FLASK.z + flaskTranslation[2]
        ]}
        rotation={[0, flaskPose?.yawRadians ?? 0, 0]}
      >
        <Interactable
          id="flask"
          enabled={enabledEquipmentIds.includes("flask")}
          label={EQUIPMENT.flask.name}
          highlightShape={{
            geometry: (
              <cylinderGeometry
                args={[
                  FLASK.baseRadius + 0.014,
                  FLASK.baseRadius + 0.014,
                  flaskHighlightHeight,
                  20,
                  1,
                  true
                ]}
              />
            ),
            labelPosition: [0, flaskHighlightHeight / 2 + 0.06, 0]
          }}
          hovered={hovered === "flask"}
            selected={selected === "flask"}
          onHover={onHover}
          onSelect={onSelect}
        >
          <group position={[-FLASK.x, -flaskCenterY, -FLASK.z]}>
            <ErlenmeyerFlask liquidColor={flaskLiquidColor} quality={quality} />
          </group>
        </Interactable>
      </group>
      )}

      {/* Meniscus hotspot: an invisible hitbox at the liquid surface. */}
      {showMeniscus && (
      <group
        position={[
          BURETTE.x + buretteTranslation[0],
          meniscusY + buretteTranslation[1],
          BURETTE.z + buretteTranslation[2]
        ]}
        rotation={[0, burettePose?.yawRadians ?? 0, 0]}
      >
        <Interactable
          id="meniscus"
          enabled={enabledEquipmentIds.includes("meniscus")}
          label={EQUIPMENT.meniscus.name}
          highlightShape={{
            geometry: <torusGeometry args={[0.026, 0.0022, 8, 24]} />,
            rotation: [Math.PI / 2, 0, 0],
            labelPosition: [0, 0.08, 0]
          }}
          /* A 2 mm ring is too thin to click; target the liquid surface disc
             instead, kept narrow enough not to steal the burette's tube. */
          hitShape={{
            geometry: (
              <cylinderGeometry args={[0.03, 0.03, 0.014, 16, 1, true]} />
            ),
            labelPosition: [0, 0.08, 0]
          }}
          hovered={hovered === "meniscus"}
            selected={selected === "meniscus"}
          onHover={onHover}
          onSelect={onSelect}
        >
          {/* No visual of its own — the hit volume above is the hotspot. */}
          {null}
        </Interactable>
        {selected === "meniscus" && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry
              args={[BURETTE.tubeRadius + 0.004, 0.00055, 6, 24]}
            />
            <meshBasicMaterial
              color={LAB_PALETTE.selectionTeal}
              transparent
              opacity={0.65}
              depthWrite={false}
            />
          </mesh>
        )}
      </group>
      )}

      {showShelf && (
      <group
        position={[
          SHELF.x + shelfTranslation[0],
          SHELF.baseY + shelfTranslation[1],
          SHELF.z + shelfTranslation[2]
        ]}
        rotation={[0, shelfPose?.yawRadians ?? 0, 0]}
      >
        <Interactable
          id="indicatorShelf"
          enabled={enabledEquipmentIds.includes("indicatorShelf")}
          label={EQUIPMENT.indicatorShelf.name}
          highlightShape={{
            geometry: (
              <boxGeometry
                args={[
                  SHELF.width + 0.06,
                  SHELF.totalHeight + 0.04,
                  SHELF.depth + 0.06
                ]}
              />
            ),
            position: [0, SHELF.totalHeight / 2, 0.02],
            labelPosition: [0, SHELF.totalHeight + 0.08, 0]
          }}
          hovered={hovered === "indicatorShelf"}
            selected={selected === "indicatorShelf"}
          onHover={onHover}
          onSelect={onSelect}
        >
          <IndicatorShelf
            focused={selected === "indicatorShelf"}
            selectionEnabled={indicatorSelectionEnabled}
            selectedIndicator={selectedIndicator}
            pouringIndicator={indicatorAddition?.indicator ?? null}
            onBottleClick={onIndicatorBottleClick}
            quality={quality}
          />
        </Interactable>
      </group>
      )}

      {showWashStation && (
      <group
        position={[
          WASH.x + washTranslation[0],
          WASH.baseY + washTranslation[1],
          WASH.z + washTranslation[2]
        ]}
        rotation={[0, washPose?.yawRadians ?? 0, 0]}
      >
        <Interactable
          id="washStation"
          enabled={enabledEquipmentIds.includes("washStation")}
          label={EQUIPMENT.washStation.name}
          highlightShape={{
            geometry: (
              <boxGeometry
                args={[
                  WASH.width + 0.05,
                  WASH.totalHeight + 0.04,
                  WASH.depth + 0.05
                ]}
              />
            ),
            position: [0, WASH.totalHeight / 2, 0],
            labelPosition: [0, WASH.totalHeight + 0.08, 0]
          }}
          hovered={hovered === "washStation"}
            selected={selected === "washStation"}
          onHover={onHover}
          onSelect={onSelect}
        >
          <WashStation
            focused={selected === "washStation"}
            preparationEnabled={canPrepareBurette}
            selectedLiquid={selectedWashLiquid}
            funnelSelected={funnelSelected}
            onWashBottleClick={onWashBottleClick}
            onTitrantBottleClick={onTitrantBottleClick}
            onFunnelClick={onFunnelClick}
            quality={quality}
          />
        </Interactable>
      </group>
      )}

      {pipettePose && enabledEquipmentIds.includes("volumetricPipette") && (
        <group
          position={[...worldPositionForEquipmentPose(pipettePose)]}
          rotation={[0, pipettePose.yawRadians, 0]}
        >
          <Interactable
            id="volumetricPipette"
            enabled
            label={EQUIPMENT.volumetricPipette.name}
            highlightShape={{
              geometry: (
                <cylinderGeometry
                  args={[
                    VOLUMETRIC_PIPETTE_HIT.radius,
                    VOLUMETRIC_PIPETTE_HIT.radius,
                    VOLUMETRIC_PIPETTE_HIT.height,
                    16,
                    1,
                    true
                  ]}
                />
              ),
              position: [0, VOLUMETRIC_PIPETTE_HIT.centerY, 0],
              labelPosition: [0, VOLUMETRIC_PIPETTE_HIT.labelY, 0]
            }}
            hovered={hovered === "volumetricPipette"}
            selected={selected === "volumetricPipette"}
            onHover={onHover}
            onSelect={onSelect}
          >
            <VolumetricPipette
              fillFraction={fillOf("visual-adapter.volumetric_pipette.v1")}
              quality={quality}
            />
          </Interactable>
        </group>
      )}

      {volumetricFlaskPose &&
        enabledEquipmentIds.includes("volumetricFlask") && (
          <group
            position={[...worldPositionForEquipmentPose(volumetricFlaskPose)]}
            rotation={[0, volumetricFlaskPose.yawRadians, 0]}
          >
            <Interactable
              id="volumetricFlask"
              enabled
              label={EQUIPMENT.volumetricFlask.name}
              highlightShape={{
                geometry: (
                  <cylinderGeometry
                    args={[
                      VOLUMETRIC_FLASK_HIT.radius,
                      VOLUMETRIC_FLASK_HIT.radius,
                      VOLUMETRIC_FLASK_HIT.height,
                      18,
                      1,
                      true
                    ]}
                  />
                ),
                position: [0, VOLUMETRIC_FLASK_HIT.centerY, 0],
                labelPosition: [0, VOLUMETRIC_FLASK_HIT.labelY, 0]
              }}
              hovered={hovered === "volumetricFlask"}
              selected={selected === "volumetricFlask"}
              onHover={onHover}
              onSelect={onSelect}
            >
              <VolumetricFlask
                fillFraction={fillOf("visual-adapter.volumetric_flask.v1")}
                quality={quality}
              />
            </Interactable>
          </group>
        )}

      {washBottlePose && enabledEquipmentIds.includes("washBottle") && (
        <group
          position={[...worldPositionForEquipmentPose(washBottlePose)]}
          rotation={[0, washBottlePose.yawRadians, 0]}
        >
          <Interactable
            id="washBottle"
            enabled
            label={EQUIPMENT.washBottle.name}
            highlightShape={{
              geometry: (
                <cylinderGeometry
                  args={[
                    DISTILLED_WASH_BOTTLE_HIT.radius,
                    DISTILLED_WASH_BOTTLE_HIT.radius,
                    DISTILLED_WASH_BOTTLE_HIT.height,
                    14,
                    1,
                    true
                  ]}
                />
              ),
              position: [0, DISTILLED_WASH_BOTTLE_HIT.centerY, 0],
              labelPosition: [0, DISTILLED_WASH_BOTTLE_HIT.labelY, 0]
            }}
            hovered={hovered === "washBottle"}
            selected={selected === "washBottle"}
            onHover={onHover}
            onSelect={onSelect}
          >
            {/* Hidden while a pour clip animates it, so the student sees one
                bottle in motion rather than a duplicate beside the original. */}
            {!hideWashBottle && (
              <DistilledWaterWashBottle
                fillFraction={fillOf("visual-adapter.wash_bottle.v1", 0.75)}
                quality={quality}
              />
            )}
          </Interactable>
        </group>
      )}

      {showReagentBottle && washPose && (
        <group
          position={[...worldPositionForEquipmentPose(washPose)]}
          rotation={[0, washPose.yawRadians, 0]}
        >
          <Interactable
            id="reagentBottle"
            enabled
            label={EQUIPMENT.reagentBottle.name}
            highlightShape={{
              geometry: (
                <cylinderGeometry
                  args={[
                    REAGENT_BOTTLE_HIT.radius,
                    REAGENT_BOTTLE_HIT.radius,
                    REAGENT_BOTTLE_HIT.height,
                    14,
                    1,
                    true
                  ]}
                />
              ),
              position: [0, REAGENT_BOTTLE_HIT.centerY, 0],
              labelPosition: [0, REAGENT_BOTTLE_HIT.labelY, 0]
            }}
            hovered={hovered === "reagentBottle"}
            selected={selected === "reagentBottle"}
            onHover={onHover}
            onSelect={onSelect}
          >
            <RegisteredReagentBottle
              fillFraction={fillOf("visual-adapter.reagent_bottle.v1", 0.7)}
              quality={quality}
            />
          </Interactable>
        </group>
      )}

      {beakerPose && enabledEquipmentIds.includes("beaker") && (
        <group
          position={[...worldPositionForEquipmentPose(beakerPose)]}
          rotation={[0, beakerPose.yawRadians, 0]}
        >
          <Interactable
            id="beaker"
            enabled
            label={EQUIPMENT.beaker.name}
            highlightShape={{
              geometry: (
                <cylinderGeometry
                  args={[
                    BEAKER_HIT.radius,
                    BEAKER_HIT.radius,
                    BEAKER_HIT.height,
                    20,
                    1,
                    true
                  ]}
                />
              ),
              position: [0, BEAKER_HIT.centerY, 0],
              labelPosition: [0, BEAKER_HIT.labelY, 0]
            }}
            hovered={hovered === "beaker"}
            selected={selected === "beaker"}
            onHover={onHover}
            onSelect={onSelect}
          >
            <Beaker
              fillFraction={fillOf("visual-adapter.beaker.v1", 0)}
              contentsColor={beakerContentsColor}
              quality={quality}
            />
          </Interactable>
        </group>
      )}

      {calorimeterPose && enabledEquipmentIds.includes("calorimeter") && (
        <group
          position={[...worldPositionForEquipmentPose(calorimeterPose)]}
          rotation={[0, calorimeterPose.yawRadians, 0]}
        >
          <Interactable
            id="calorimeter"
            enabled
            label={EQUIPMENT.calorimeter.name}
            highlightShape={{
              geometry: (
                <cylinderGeometry
                  args={[
                    CALORIMETER_HIT.radius,
                    CALORIMETER_HIT.radius,
                    CALORIMETER_HIT.height,
                    18,
                    1,
                    true
                  ]}
                />
              ),
              position: [0, CALORIMETER_HIT.centerY, 0],
              labelPosition: [0, CALORIMETER_HIT.labelY, 0]
            }}
            hovered={hovered === "calorimeter"}
            selected={selected === "calorimeter"}
            onHover={onHover}
            onSelect={onSelect}
          >
            <Calorimeter
              fillFraction={fillOf("visual-adapter.calorimeter.v1", 0)}
              lidClosed={calorimeterLidClosed}
              hideLid={hideCalorimeterLid}
            />
          </Interactable>
        </group>
      )}

      {thermometerPose && enabledEquipmentIds.includes("thermometer") && (
        <group
          /*
           * A placed probe stays in the vessel it is measuring. It used to keep
           * its bench-station position and merely drop 4 cm, so after the
           * place-probe clip animated it over to the cup it appeared to snap
           * straight back to the stand.
           */
          position={
            seatedInVessel
              ? [
                  calorimeterWorldPosition[0],
                  calorimeterWorldPosition[1] + THERMOMETER_SEATED_LIFT,
                  calorimeterWorldPosition[2]
                ]
              : [...worldPositionForEquipmentPose(thermometerPose)]
          }
          rotation={[
            0,
            seatedInVessel && calorimeterPose
              ? calorimeterPose.yawRadians
              : thermometerPose.yawRadians,
            0
          ]}
        >
          <Interactable
            id="thermometer"
            enabled
            label={EQUIPMENT.thermometer.name}
            highlightShape={{
              geometry: (
                <cylinderGeometry
                  args={[
                    THERMOMETER_HIT.radius,
                    THERMOMETER_HIT.radius,
                    THERMOMETER_HIT.height,
                    12,
                    1,
                    true
                  ]}
                />
              ),
              position: [0, THERMOMETER_HIT.centerY - thermometerDrop, 0],
              labelPosition: [0, THERMOMETER_HIT.labelY - thermometerDrop, 0]
            }}
            hovered={hovered === "thermometer"}
            selected={selected === "thermometer"}
            onHover={onHover}
            onSelect={onSelect}
          >
            <Thermometer
              placed={thermometerPlaced && !seatedInVessel}
              hidden={hideThermometer}
            />
          </Interactable>
        </group>
      )}

      {indicatorAddition && showShelf && showFlask && (
        <IndicatorAddition
          indicator={indicatorAddition.indicator}
          sequence={indicatorAddition.sequence}
          shelfTranslation={shelfTranslation}
          flaskTranslation={flaskTranslation}
          onComplete={onIndicatorAdditionComplete}
        />
      )}

      <LabVisualGestureLayer
        gesture={activeVisualGesture}
        onComplete={onVisualGestureComplete ?? (() => undefined)}
      />

      <BenchCameraControls pose={pose} isOverview={pose === overviewPose} />
    </>
  );
}

function transformCameraPose(
  pose: Readonly<{
    position: readonly [number, number, number];
    target: readonly [number, number, number];
  }>,
  translation: readonly [number, number, number],
  yawRadians: number,
  pivot: readonly [number, number, number]
) {
  const rotateAndTranslate = (
    value: readonly [number, number, number]
  ): readonly [number, number, number] => {
    const cosine = Math.cos(yawRadians);
    const sine = Math.sin(yawRadians);
    const relativeX = value[0] - pivot[0];
    const relativeZ = value[2] - pivot[2];
    return [
      relativeX * cosine + relativeZ * sine + pivot[0] + translation[0],
      value[1] + translation[1],
      -relativeX * sine + relativeZ * cosine + pivot[2] + translation[2]
    ];
  };
  return {
    position: rotateAndTranslate(pose.position),
    target: rotateAndTranslate(pose.target)
  } as const;
}
