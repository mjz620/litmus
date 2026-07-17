import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { PCFShadowMap, type WebGLRenderer } from "three";

import type { IndicatorId } from "../../../experiments/titration/titration";
import { EQUIPMENT, type EquipmentId } from "../titration/equipment";
import { BenchCameraControls } from "./BenchCameraControls";
import { Burette } from "./Burette";
import { ClassroomEnvironment } from "./ClassroomEnvironment";
import { ErlenmeyerFlask } from "./ErlenmeyerFlask";
import { IndicatorShelf } from "./IndicatorShelf";
import { Interactable } from "./Interactable";
import { SceneEnvironment } from "./SceneEnvironment";
import { SkyDome } from "./SkyDome";
import { WashStation } from "./WashStation";
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
  buretteAvailableML: number;
  buretteCapacityML: number;
  flaskLiquidColor: string;
  selectedIndicator: IndicatorId;
  canPrepareBurette: boolean;
  quality: GlassQuality;
  selected: EquipmentId | null;
  hovered: EquipmentId | null;
  onHover: (equipment: EquipmentId | null) => void;
  onSelect: (equipment: EquipmentId) => void;
  onIndicatorBottleClick: (indicator: IndicatorId) => void;
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
  buretteAvailableML,
  buretteCapacityML,
  flaskLiquidColor,
  selectedIndicator,
  canPrepareBurette,
  quality,
  selected,
  hovered,
  onHover,
  onSelect,
  onIndicatorBottleClick,
  onWashBottleClick,
  onTitrantBottleClick,
  onFunnelClick
}: LabSceneProps) {
  const liquidTopY = getBuretteLiquidTopY(
    buretteAvailableML,
    buretteCapacityML
  );
  const meniscusY = liquidTopY ?? BURETTE.graduationBottomY;
  const buretteCenterY = (BURETTE.tipBottomY + BURETTE.tubeTopY) / 2;
  const buretteHighlightHeight = BURETTE.tubeTopY - BURETTE.tipBottomY + 0.03;
  const flaskCenterY = FLASK.baseY + (FLASK.bodyHeight + FLASK.neckHeight) / 2;
  const flaskHighlightHeight = FLASK.bodyHeight + FLASK.neckHeight + 0.03;
  const pose =
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
              : CAMERA_POSES.overview;

  return (
    <>
      <color attach="background" args={[LAB_PALETTE.sceneFallback]} />
      <LabLighting quality={quality} />

      <SceneEnvironment enabled={quality === "high"} />
      {quality === "high" && <SkyDome />}
      <ClassroomEnvironment />

      <group position={[BURETTE.x, buretteCenterY, BURETTE.z]}>
        <Interactable
          id="burette"
          label={EQUIPMENT.burette.name}
          highlightShape={{
            geometry: (
              <cylinderGeometry
                args={[0.034, 0.034, buretteHighlightHeight, 18, 1, true]}
              />
            ),
            labelPosition: [0, buretteHighlightHeight / 2 + 0.08, 0]
          }}
          hovered={hovered === "burette" && selected !== "burette"}
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

      <group position={[FLASK.x, flaskCenterY, FLASK.z]}>
        <Interactable
          id="flask"
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
          hovered={hovered === "flask" && selected !== "flask"}
          onHover={onHover}
          onSelect={onSelect}
        >
          <group position={[-FLASK.x, -flaskCenterY, -FLASK.z]}>
            <ErlenmeyerFlask liquidColor={flaskLiquidColor} quality={quality} />
          </group>
        </Interactable>
      </group>

      {/* Meniscus hotspot: an invisible hitbox at the liquid surface. */}
      <group position={[BURETTE.x, meniscusY, BURETTE.z]}>
        <Interactable
          id="meniscus"
          label={EQUIPMENT.meniscus.name}
          highlightShape={{
            geometry: <torusGeometry args={[0.026, 0.0022, 8, 24]} />,
            rotation: [Math.PI / 2, 0, 0],
            labelPosition: [0, 0.08, 0]
          }}
          hovered={hovered === "meniscus" && selected !== "meniscus"}
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

      <group position={[SHELF.x, SHELF.baseY, SHELF.z]}>
        <Interactable
          id="indicatorShelf"
          label={EQUIPMENT.indicatorShelf.name}
          highlightShape={{
            geometry: (
              <boxGeometry
                args={[
                  SHELF.width + 0.06,
                  SHELF.totalHeight + 0.04,
                  SHELF.depth + SHELF.selectedPullForwardZ + 0.06
                ]}
              />
            ),
            position: [0, SHELF.totalHeight / 2, 0.02],
            labelPosition: [0, SHELF.totalHeight + 0.08, 0]
          }}
          hovered={
            hovered === "indicatorShelf" && selected !== "indicatorShelf"
          }
          onHover={onHover}
          onSelect={onSelect}
        >
          <IndicatorShelf
            focused={selected === "indicatorShelf"}
            selectedIndicator={selectedIndicator}
            onBottleClick={onIndicatorBottleClick}
          />
        </Interactable>
      </group>

      <group position={[WASH.x, WASH.baseY, WASH.z]}>
        <Interactable
          id="washStation"
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
          hovered={hovered === "washStation" && selected !== "washStation"}
          onHover={onHover}
          onSelect={onSelect}
        >
          <WashStation
            focused={selected === "washStation"}
            preparationEnabled={canPrepareBurette}
            onWashBottleClick={onWashBottleClick}
            onTitrantBottleClick={onTitrantBottleClick}
            onFunnelClick={onFunnelClick}
          />
        </Interactable>
      </group>

      <BenchCameraControls pose={pose} />
    </>
  );
}
