import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  CanvasTexture,
  DoubleSide,
  type Group,
  type Mesh,
  type MeshStandardMaterial as MeshStandardMaterialType,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector2
} from "three";

import type {
  DispenseEndReason,
  DispenseGestureController,
  FlowDetent
} from "../titration/useDispenseGesture";
import { BURETTE, FLASK, STAND, getBuretteLiquidTopY } from "./benchLayout";
import {
  GlassMaterial,
  type GlassQuality,
  LiquidMaterial
} from "./glassMaterials";
import { LAB_PALETTE } from "./labPalette";

export type EquipmentHighlight = "none" | "hover" | "selected";

const standMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.fixtureDark,
  roughness: 0.68,
  metalness: 0
});
const rodMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.fixtureMetal,
  roughness: 0.42,
  metalness: 0.68
});
const clampMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.fixtureDark,
  roughness: 0.68,
  metalness: 0
});
const stopcockMaterial = new MeshStandardMaterial({
  color: LAB_PALETTE.stopcockHandle,
  emissive: LAB_PALETTE.stopcockHandle,
  emissiveIntensity: 0.16,
  roughness: 0.58,
  metalness: 0
});
const meniscusMaterial = new MeshBasicMaterial({
  color: LAB_PALETTE.graduationInk,
  transparent: true,
  opacity: 0.78,
  side: DoubleSide,
  depthTest: false,
  depthWrite: false,
  toneMapped: false
});

const TITRANT_COLOR = LAB_PALETTE.buretteLiquid;
const GRADUATION_ARC = 1.25;
const STOPCOCK_FULL_TRAVEL_PX = 120;
const STREAM_TARGET_Y = FLASK.baseY + 0.062;
const STREAM_HEIGHT = BURETTE.tipBottomY - STREAM_TARGET_Y;
const STREAM_CENTER_Y = STREAM_TARGET_Y + STREAM_HEIGHT / 2;
const MAX_STREAM_RADIUS = 0.0028;

/** Radial profile of the concave liquid surface, read at its center-bottom. */
export function createBuretteMeniscusProfile(): Vector2[] {
  return [
    new Vector2(0, 0),
    new Vector2(BURETTE.liquidRadius * 0.24, BURETTE.meniscusRise * 0.03),
    new Vector2(BURETTE.liquidRadius * 0.5, BURETTE.meniscusRise * 0.16),
    new Vector2(BURETTE.liquidRadius * 0.74, BURETTE.meniscusRise * 0.46),
    new Vector2(BURETTE.liquidRadius * 0.9, BURETTE.meniscusRise * 0.78),
    new Vector2(BURETTE.liquidRadius, BURETTE.meniscusRise)
  ];
}

const MENISCUS_PROFILE = createBuretteMeniscusProfile();

let cachedGraduationTexture: CanvasTexture | null = null;

export const STOPCOCK_DETENT_ANGLES: Readonly<Record<FlowDetent, number>> = {
  closed: 0,
  dropwise: Math.PI / 8,
  slow: Math.PI / 4,
  open: Math.PI / 2
};

export const DISPENSE_VISUAL_PROFILES = {
  dropwise: { streamRadius: 0.0009, opacity: 0.3, dripCyclesPerSecond: 2.1 },
  slow: { streamRadius: 0.0017, opacity: 0.62, dripCyclesPerSecond: 3.5 },
  open: {
    streamRadius: MAX_STREAM_RADIUS,
    opacity: 0.84,
    dripCyclesPerSecond: 5
  }
} as const;

interface BuretteDispenseContextValue {
  controller: DispenseGestureController;
  enabled: boolean;
}

interface BuretteDispenseProviderProps extends BuretteDispenseContextValue {
  children: ReactNode;
}

const BuretteDispenseContext =
  createContext<BuretteDispenseContextValue | null>(null);

export function BuretteDispenseProvider({
  controller,
  enabled,
  children
}: BuretteDispenseProviderProps) {
  return (
    <BuretteDispenseContext.Provider value={{ controller, enabled }}>
      {children}
    </BuretteDispenseContext.Provider>
  );
}

export function useBuretteDispense(): BuretteDispenseContextValue | null {
  return useContext(BuretteDispenseContext);
}

export function getStopcockDragAngle(deltaYPx: number): number {
  if (!Number.isFinite(deltaYPx)) return 0;

  return Math.min(
    STOPCOCK_DETENT_ANGLES.open,
    Math.max(0, (deltaYPx / STOPCOCK_FULL_TRAVEL_PX) * Math.PI * 0.5)
  );
}

export function getStopcockDetent(angleRad: number): FlowDetent {
  const angle = Math.min(
    STOPCOCK_DETENT_ANGLES.open,
    Math.max(0, Number.isFinite(angleRad) ? angleRad : 0)
  );
  const closedDropwiseBoundary =
    (STOPCOCK_DETENT_ANGLES.closed + STOPCOCK_DETENT_ANGLES.dropwise) / 2;
  const dropwiseSlowBoundary =
    (STOPCOCK_DETENT_ANGLES.dropwise + STOPCOCK_DETENT_ANGLES.slow) / 2;
  const slowOpenBoundary =
    (STOPCOCK_DETENT_ANGLES.slow + STOPCOCK_DETENT_ANGLES.open) / 2;

  if (angle < closedDropwiseBoundary) return "closed";
  if (angle < dropwiseSlowBoundary) return "dropwise";
  if (angle < slowOpenBoundary) return "slow";
  return "open";
}

/**
 * Draw the 0–50 mL graduation strip once per session: minor ticks each 1 mL,
 * long ticks each 5 mL, and labels each 10 mL on a frosted backing so the
 * markings stay legible against liquid and background.
 */
function getGraduationTexture(): CanvasTexture | null {
  if (cachedGraduationTexture) return cachedGraduationTexture;
  if (typeof document === "undefined") return null;

  const width = 256;
  const height = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.clearRect(0, 0, width, height);
  context.globalAlpha = 0.5;
  context.fillStyle = LAB_PALETTE.ceramic;
  context.fillRect(0, 0, width, height);
  context.globalAlpha = 1;

  context.strokeStyle = LAB_PALETTE.graduationInk;
  context.fillStyle = LAB_PALETTE.graduationInk;
  context.textBaseline = "middle";
  context.font = "700 74px system-ui, sans-serif";

  const padY = 24;
  const usable = height - padY * 2;

  for (let ml = 0; ml <= 50; ml += 1) {
    const y = padY + (ml / 50) * usable;
    const isMajor = ml % 5 === 0;
    const tickLength = isMajor ? 96 : 52;

    context.lineWidth = isMajor ? 8 : 4;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(tickLength, y);
    context.stroke();

    if (ml % 10 === 0) {
      context.fillText(String(ml), tickLength + 18, y);
    }
  }

  cachedGraduationTexture = new CanvasTexture(canvas);
  cachedGraduationTexture.anisotropy = 4;
  return cachedGraduationTexture;
}

interface BuretteProps {
  availableML: number;
  capacityML: number;
  quality: GlassQuality;
  highlight?: EquipmentHighlight;
}

/**
 * Laboratory burette on its support stand: clamped glass tube with printed
 * graduations, stopcock, delivery tip, and an engine-projected liquid column
 * whose concave meniscus is read at its bottom and tracks remaining volume.
 */
export function Burette({
  availableML,
  capacityML,
  quality,
  highlight = "none"
}: BuretteProps) {
  const dispenseContext = useBuretteDispense();
  const invalidate = useThree((state) => state.invalidate);
  const graduationTexture = useMemo(() => getGraduationTexture(), []);
  const handleGroupRef = useRef<Group>(null);
  const streamRef = useRef<Mesh>(null);
  const streamMaterialRef = useRef<MeshStandardMaterialType>(null);
  const dripRef = useRef<Mesh>(null);
  const animationPhaseRef = useRef(0);
  const controllerRef = useRef(dispenseContext?.controller ?? null);
  const dragRef = useRef<{
    pointerId: number;
    startClientY: number;
    targetDetent: FlowDetent;
  } | null>(null);
  const detentRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragAngle, setDragAngle] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const meniscusBottomY = getBuretteLiquidTopY(availableML, capacityML);
  const liquidHeight =
    meniscusBottomY === null ? 0 : meniscusBottomY - BURETTE.tubeBottomY;
  const dispenseState = dispenseContext?.controller.state;
  const activeDetent = dispenseState?.activeDetent ?? "closed";
  const isDispensing = dispenseState?.isHolding ?? false;
  const dragEnabled = dispenseContext?.enabled ?? false;

  useEffect(() => {
    controllerRef.current = dispenseContext?.controller ?? null;
  }, [dispenseContext?.controller]);

  const clearDetentRetry = useCallback(() => {
    if (detentRetryRef.current === null) return;

    clearTimeout(detentRetryRef.current);
    detentRetryRef.current = null;
  }, []);

  const applyDragDetent = useCallback((detent: FlowDetent) => {
    const controller = controllerRef.current;
    if (!controller) return;

    if (detent === "closed") {
      controller.setDetent("closed");
      return;
    }

    if (controller.state.isHolding) {
      controller.setDetent(detent);
      return;
    }

    controller.setDetent(detent);
    controller.start();
  }, []);

  const queueDragDetent = useCallback(
    (detent: FlowDetent) => {
      clearDetentRetry();
      applyDragDetent(detent);

      // The reducer intentionally debounces rapid detent flapping. Retry the
      // settled drag position once so a fast sweep still lands on its final
      // physical detent after the debounce window.
      detentRetryRef.current = setTimeout(() => {
        if (dragRef.current?.targetDetent === detent) applyDragDetent(detent);
        detentRetryRef.current = null;
      }, 110);
    },
    [applyDragDetent, clearDetentRetry]
  );

  const finishDrag = useCallback(
    (reason: DispenseEndReason) => {
      clearDetentRetry();
      dragRef.current = null;
      setIsDragging(false);
      setDragAngle(0);
      controllerRef.current?.end(reason);
      invalidate();
    },
    [clearDetentRetry, invalidate]
  );

  useEffect(() => clearDetentRetry, [clearDetentRetry]);

  useEffect(() => {
    if (!isDragging) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") finishDrag("escape");
    };
    const handleBlur = () => finishDrag("blur");
    const handlePointerCancel = (event: PointerEvent) => {
      if (event.pointerId === dragRef.current?.pointerId) {
        finishDrag("pointer_cancel");
      }
    };
    const handleVisibilityChange = () => {
      if (document.hidden) finishDrag("visibility_change");
    };

    window.addEventListener("keydown", handleEscape, true);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("pointercancel", handlePointerCancel, true);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("keydown", handleEscape, true);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("pointercancel", handlePointerCancel, true);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [finishDrag, isDragging]);

  useEffect(() => invalidate(), [activeDetent, invalidate, isDispensing]);

  useFrame((_, deltaS) => {
    const handleGroup = handleGroupRef.current;
    if (handleGroup) {
      handleGroup.rotation.x = isDragging
        ? dragAngle
        : STOPCOCK_DETENT_ANGLES.closed;
    }

    if (
      !isDispensing ||
      activeDetent === "closed" ||
      !streamRef.current ||
      !streamMaterialRef.current ||
      !dripRef.current
    ) {
      return;
    }

    const visual = DISPENSE_VISUAL_PROFILES[activeDetent];
    animationPhaseRef.current += deltaS * visual.dripCyclesPerSecond;
    const dripProgress = animationPhaseRef.current % 1;
    const streamPulse = 0.92 + Math.sin(animationPhaseRef.current * 12) * 0.08;
    const streamRadiusScale = visual.streamRadius / MAX_STREAM_RADIUS;

    streamRef.current.scale.set(
      streamRadiusScale,
      streamPulse,
      streamRadiusScale
    );
    streamMaterialRef.current.opacity =
      visual.opacity * (0.88 + streamPulse * 0.12);
    dripRef.current.position.y =
      BURETTE.tipBottomY - STREAM_HEIGHT * dripProgress;
    dripRef.current.scale.setScalar(
      0.72 + Math.sin(dripProgress * Math.PI) * 0.4
    );

    invalidate();
  });

  function handleStopcockPointerDown(event: ThreeEvent<PointerEvent>) {
    if (!dragEnabled || !dispenseContext) return;

    event.stopPropagation();
    const captureTarget = event.target as Element | null;
    captureTarget?.setPointerCapture(event.pointerId);
    clearDetentRetry();
    dispenseContext.controller.setDetent("closed");
    dragRef.current = {
      pointerId: event.pointerId,
      startClientY: event.clientY,
      targetDetent: "closed"
    };
    setIsDragging(true);
    setDragAngle(0);
    invalidate();
  }

  function handleStopcockPointerMove(event: ThreeEvent<PointerEvent>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    event.stopPropagation();
    const angle = getStopcockDragAngle(event.clientY - drag.startClientY);
    const detent = getStopcockDetent(angle);
    setDragAngle(angle);
    invalidate();

    if (detent === drag.targetDetent) return;

    drag.targetDetent = detent;
    queueDragDetent(detent);
  }

  function handleStopcockPointerUp(event: ThreeEvent<PointerEvent>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;

    event.stopPropagation();
    const captureTarget = event.target as Element | null;
    if (captureTarget?.hasPointerCapture(event.pointerId)) {
      captureTarget.releasePointerCapture(event.pointerId);
    }
    finishDrag("pointer_up");
  }

  function handleStopcockPointerCancel(event: ThreeEvent<PointerEvent>) {
    if (dragRef.current?.pointerId !== event.pointerId) return;

    event.stopPropagation();
    finishDrag("pointer_cancel");
  }

  return (
    <group>
      {/* Support stand */}
      <mesh
        position={[
          STAND.baseCenterX,
          STAND.baseTopY - STAND.baseThickness / 2,
          STAND.baseCenterZ
        ]}
        material={standMaterial}
      >
        <boxGeometry
          args={[STAND.baseWidth, STAND.baseThickness, STAND.baseDepth]}
        />
      </mesh>
      <mesh
        position={[
          STAND.rodX,
          (STAND.rodBottomY + STAND.rodTopY) / 2,
          STAND.rodZ
        ]}
        material={rodMaterial}
      >
        <cylinderGeometry
          args={[
            STAND.rodRadius,
            STAND.rodRadius,
            STAND.rodTopY - STAND.rodBottomY,
            12
          ]}
        />
      </mesh>

      {/* Clamp arm and jaws */}
      <mesh
        position={[
          BURETTE.x - 0.02,
          STAND.clampY,
          (STAND.rodZ + BURETTE.z) / 2
        ]}
        material={clampMaterial}
      >
        <boxGeometry args={[0.018, 0.018, Math.abs(BURETTE.z - STAND.rodZ)]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[
            BURETTE.x + side * (BURETTE.tubeRadius + 0.006),
            STAND.clampY,
            BURETTE.z
          ]}
          material={clampMaterial}
        >
          <boxGeometry args={[0.01, 0.03, 0.026]} />
        </mesh>
      ))}
      <mesh
        position={[BURETTE.x - 0.02, STAND.clampY, STAND.rodZ]}
        rotation={[0, 0, Math.PI / 2]}
        material={clampMaterial}
      >
        <cylinderGeometry args={[0.012, 0.012, 0.03, 10]} />
      </mesh>

      {/* Glass tube */}
      <mesh
        castShadow={quality === "high"}
        position={[BURETTE.x, BURETTE.tubeCenterY, BURETTE.z]}
      >
        <cylinderGeometry
          args={[
            BURETTE.tubeRadius,
            BURETTE.tubeRadius,
            BURETTE.tubeHeight,
            24,
            1,
            true
          ]}
        />
        <GlassMaterial quality={quality} thickness={BURETTE.wallThickness} />
      </mesh>

      {/* Liquid column and meniscus */}
      {meniscusBottomY !== null && liquidHeight > 0.001 && (
        <>
          <mesh
            renderOrder={2}
            position={[
              BURETTE.x,
              BURETTE.tubeBottomY + liquidHeight / 2,
              BURETTE.z
            ]}
          >
            <cylinderGeometry
              args={[
                BURETTE.liquidRadius,
                BURETTE.liquidRadius,
                liquidHeight,
                18,
                1,
                true
              ]}
            />
            <LiquidMaterial quality={quality} color={TITRANT_COLOR} />
          </mesh>
          <mesh
            renderOrder={3}
            position={[BURETTE.x, meniscusBottomY, BURETTE.z]}
            material={meniscusMaterial}
          >
            <latheGeometry args={[MENISCUS_PROFILE, 24]} />
          </mesh>
        </>
      )}

      {/* Graduation strip facing the front camera poses */}
      {graduationTexture && (
        <mesh
          position={[
            BURETTE.x,
            (BURETTE.graduationTopY + BURETTE.graduationBottomY) / 2,
            BURETTE.z
          ]}
        >
          <cylinderGeometry
            args={[
              BURETTE.tubeRadius + 0.0009,
              BURETTE.tubeRadius + 0.0009,
              BURETTE.graduationLength,
              24,
              1,
              true,
              -GRADUATION_ARC / 2,
              GRADUATION_ARC
            ]}
          />
          <meshBasicMaterial
            map={graduationTexture}
            transparent
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Continuous glass lower assembly: tube junction, housing, then tip. */}
      <mesh
        castShadow={quality === "high"}
        position={[BURETTE.x, BURETTE.junctionCenterY, BURETTE.z]}
      >
        <cylinderGeometry
          args={[
            BURETTE.junctionTopRadius,
            BURETTE.junctionBottomRadius,
            BURETTE.junctionHeight,
            18
          ]}
        />
        <GlassMaterial quality={quality} thickness={0.0022} />
      </mesh>
      <mesh
        castShadow={quality === "high"}
        position={[BURETTE.x, BURETTE.stopcockHousingCenterY, BURETTE.z]}
      >
        <cylinderGeometry
          args={[
            BURETTE.stopcockHousingRadius,
            BURETTE.stopcockHousingRadius,
            BURETTE.stopcockHousingHeight,
            18
          ]}
        />
        <GlassMaterial quality={quality} thickness={0.0025} />
      </mesh>
      <mesh
        castShadow={quality === "high"}
        position={[
          BURETTE.x,
          BURETTE.tipBottomY + BURETTE.tipHeight / 2,
          BURETTE.z
        ]}
      >
        <cylinderGeometry
          args={[
            BURETTE.tipTopRadius,
            BURETTE.tipBottomRadius,
            BURETTE.tipHeight,
            16
          ]}
        />
        <GlassMaterial quality={quality} thickness={0.0015} />
      </mesh>

      {/* Horizontal stopcock barrel and distinct PTFE handle. */}
      <mesh
        castShadow={quality === "high"}
        position={[BURETTE.x, BURETTE.stopcockHousingCenterY, BURETTE.z]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry
          args={[
            BURETTE.stopcockBarrelRadius,
            BURETTE.stopcockBarrelRadius,
            BURETTE.stopcockBarrelLength,
            14
          ]}
        />
        <GlassMaterial quality={quality} thickness={0.003} />
      </mesh>
      <group
        ref={handleGroupRef}
        name="burette-stopcock-handle"
        position={[
          BURETTE.x + BURETTE.stopcockBarrelLength / 2,
          BURETTE.stopcockHousingCenterY,
          BURETTE.z
        ]}
        onPointerDown={handleStopcockPointerDown}
        onPointerMove={handleStopcockPointerMove}
        onPointerUp={handleStopcockPointerUp}
        onPointerCancel={handleStopcockPointerCancel}
        onLostPointerCapture={(event) => {
          if (dragRef.current?.pointerId === event.pointerId) {
            finishDrag("pointer_cancel");
          }
        }}
        onClick={(event) => {
          if (dragEnabled) event.stopPropagation();
        }}
      >
        <mesh
          position={[BURETTE.stopcockHandleLength / 2, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
          material={stopcockMaterial}
        >
          <cylinderGeometry
            args={[
              BURETTE.stopcockHandleRadius,
              BURETTE.stopcockHandleRadius,
              BURETTE.stopcockHandleLength,
              12
            ]}
          />
        </mesh>
        <mesh
          position={[BURETTE.stopcockHandleLength, 0, 0.02]}
          material={stopcockMaterial}
        >
          <boxGeometry
            args={[0.012, 0.008, BURETTE.stopcockHandlePaddleLength]}
          />
        </mesh>
        {dragEnabled && (
          <mesh position={[BURETTE.stopcockHandleLength * 0.7, 0, 0.012]}>
            <boxGeometry
              args={[
                BURETTE.stopcockHandleLength * 1.8,
                0.04,
                BURETTE.stopcockHandlePaddleLength + 0.025
              ]}
            />
            <meshBasicMaterial
              transparent
              opacity={0}
              depthWrite={false}
              colorWrite={false}
            />
          </mesh>
        )}
      </group>

      {/* Demand-driven titrant stream and falling drop. */}
      <mesh
        ref={streamRef}
        visible={isDispensing}
        position={[BURETTE.x, STREAM_CENTER_Y, BURETTE.z]}
      >
        <cylinderGeometry
          args={[MAX_STREAM_RADIUS, MAX_STREAM_RADIUS, STREAM_HEIGHT, 8]}
        />
        <meshStandardMaterial
          ref={streamMaterialRef}
          color={TITRANT_COLOR}
          emissive={LAB_PALETTE.graduationInk}
          emissiveIntensity={0.12}
          roughness={0.25}
          transparent
          opacity={0.7}
          depthWrite={false}
        />
      </mesh>
      <mesh
        ref={dripRef}
        visible={isDispensing}
        position={[BURETTE.x, BURETTE.tipBottomY, BURETTE.z]}
      >
        <sphereGeometry args={[0.0044, 10, 8]} />
        <meshStandardMaterial
          color={TITRANT_COLOR}
          roughness={0.2}
          transparent
          opacity={0.92}
          depthWrite={false}
        />
      </mesh>

      {/* Hover / selection highlight envelope */}
      {highlight !== "none" && (
        <mesh
          position={[
            BURETTE.x,
            (BURETTE.tipBottomY + BURETTE.tubeTopY) / 2,
            BURETTE.z
          ]}
        >
          <cylinderGeometry
            args={[
              0.034,
              0.034,
              BURETTE.tubeTopY - BURETTE.tipBottomY + 0.03,
              18,
              1,
              true
            ]}
          />
          <meshBasicMaterial
            color={
              highlight === "selected"
                ? LAB_PALETTE.selectionTeal
                : LAB_PALETTE.hoverMint
            }
            transparent
            opacity={highlight === "selected" ? 0.32 : 0.24}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
