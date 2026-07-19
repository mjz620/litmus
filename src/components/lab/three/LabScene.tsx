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
import {
  CALORIMETER_HIT,
  Calorimeter,
  DISTILLED_WASH_BOTTLE_HIT,
  DistilledWaterWashBottle,
  REAGENT_BOTTLE_HIT,
  RegisteredReagentBottle,
  THERMOMETER_HIT,
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
  SHELF,
  WASH,
  getBuretteLiquidTopY,
  getMeniscusCameraPose
} from "./benchLayout";
import type { GlassQuality } from "./glassMaterials";
import { LAB_PALETTE } from "./labPalette";

interface LabSceneProps {
  enabledEquipmentIds: readonly EquipmentId[];
  equipmentPoses?: readonly ResolvedEquipmentPose[];
  equipmentFillFractions?: Readonly<Record<string, number>>;
  calorimeterLidClosed?: boolean;
  thermometerPlaced?: boolean;
  hideCalorimeterLid?: boolean;
  hideThermometer?: boolean;
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
  thermometerPlaced = false,
  hideCalorimeterLid = false,
  hideThermometer = false,
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
                ? CAMERA_POSES.overview
                : CAMERA_POSES.overview;
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
  const pose = selectedPose
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
          hovered={hovered === "meniscus"}
            selected={selected === "meniscus"}
          onHover={onHover}
          onSelect={onSelect}
        >
          <mesh>
            <sphereGeometry args={[0.05, 10, 10]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
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
            <DistilledWaterWashBottle
              fillFraction={fillOf("visual-adapter.wash_bottle.v1", 0.75)}
            />
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
          position={[...worldPositionForEquipmentPose(thermometerPose)]}
          rotation={[0, thermometerPose.yawRadians, 0]}
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
              position: [0, THERMOMETER_HIT.centerY, 0],
              labelPosition: [0, THERMOMETER_HIT.labelY, 0]
            }}
            hovered={hovered === "thermometer"}
            selected={selected === "thermometer"}
            onHover={onHover}
            onSelect={onSelect}
          >
            <Thermometer placed={thermometerPlaced} hidden={hideThermometer} />
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

      <BenchCameraControls pose={pose} />
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
