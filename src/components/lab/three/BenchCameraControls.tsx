import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { type Camera, Vector3 } from "three";

import { useLabUiStore } from "../../../stores/labUiStore";
import { BENCH_VIEW, LOOK_LIMITS, type CameraPose } from "./benchLayout";
import {
  computeEdgePanInput,
  isSettled,
  lookToTarget,
  stepLook,
  type LookInput,
  type LookState,
  type StepLookConfig
} from "./cameraMath";

const FOCUS_DURATION_S = 0.65;
const KEYBOARD_STEP_RAD = (5 * Math.PI) / 180;
const LOOK_DISTANCE = Math.hypot(
  BENCH_VIEW.target[0] - BENCH_VIEW.position[0],
  BENCH_VIEW.target[1] - BENCH_VIEW.position[1],
  BENCH_VIEW.target[2] - BENCH_VIEW.position[2]
);
const NEUTRAL_YAW = Math.atan2(
  BENCH_VIEW.target[0] - BENCH_VIEW.position[0],
  BENCH_VIEW.position[2] - BENCH_VIEW.target[2]
);
const NEUTRAL_PITCH = Math.atan2(
  BENCH_VIEW.target[1] - BENCH_VIEW.position[1],
  Math.hypot(
    BENCH_VIEW.target[0] - BENCH_VIEW.position[0],
    BENCH_VIEW.target[2] - BENCH_VIEW.position[2]
  )
);
const ZERO_INPUT: LookInput = { yaw: 0, pitch: 0 };
const EDGE_PAN_CONFIG = {
  deadZoneRadius: 0.25,
  maxAngularSpeed: 1.2
} as const;
const STEP_LOOK_CONFIG: StepLookConfig = {
  ...LOOK_LIMITS,
  acceleration: 5,
  damping: 6
};
const BENCH_LOOK_TARGET = new Vector3();

export const LOOK_STEP_EVENT = "labbench:look-step";
export const LOOK_RECENTER_EVENT = "labbench:look-recenter";

export interface LookStepDetail {
  yaw: -1 | 0 | 1;
  pitch: -1 | 0 | 1;
}

interface BenchCameraControlsProps {
  pose: CameraPose;
}

interface ActiveTween {
  fromPosition: Vector3;
  fromTarget: Vector3;
  toPosition: Vector3;
  toTarget: Vector3;
  elapsedS: number;
}

function createInitialLookState(): LookState {
  return {
    yaw: 0,
    pitch: 0,
    yawVelocity: 0,
    pitchVelocity: 0
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function applyBenchLook(camera: Camera, state: LookState) {
  const target = lookToTarget(
    BENCH_VIEW.position,
    NEUTRAL_YAW + state.yaw,
    NEUTRAL_PITCH + state.pitch,
    LOOK_DISTANCE
  );

  BENCH_LOOK_TARGET.set(...target);
  camera.position.set(...BENCH_VIEW.position);
  camera.up.set(0, 1, 0);
  camera.lookAt(BENCH_LOOK_TARGET);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Frame the camera on the requested pose. Pose changes tween briefly on the
 * demand frameloop and snap instantly under prefers-reduced-motion. The full
 * bench has a fixed standing position; focused poses move position and target.
 */
export function BenchCameraControls({ pose }: BenchCameraControlsProps) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const lookActive = useLabUiStore((state) => state.lookActive);
  const targetRef = useRef(new Vector3(...BENCH_VIEW.target));
  const tweenRef = useRef<ActiveTween | null>(null);
  const pointerNdcRef = useRef({ x: 0, y: 0 });
  const lookStateRef = useRef<LookState>(createInitialLookState());
  const isFirstPose = useRef(true);
  const reducedMotionRef = useRef(false);
  const isOverview = pose === BENCH_VIEW;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => {
      reducedMotionRef.current = mediaQuery.matches;
    };

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!lookActive || !isOverview || reducedMotionRef.current) return;

      const bounds = gl.domElement.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) return;

      pointerNdcRef.current = {
        x: ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        y: 1 - ((event.clientY - bounds.top) / bounds.height) * 2
      };
      invalidate();
    };

    window.addEventListener("pointermove", handlePointerMove);
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [gl, invalidate, isOverview, lookActive]);

  useEffect(() => {
    const handleLookStep = (event: Event) => {
      if (!isOverview) return;

      const { yaw, pitch } = (event as CustomEvent<LookStepDetail>).detail;
      const current = lookStateRef.current;
      lookStateRef.current = {
        yaw: clamp(
          current.yaw + yaw * KEYBOARD_STEP_RAD,
          LOOK_LIMITS.minYaw,
          LOOK_LIMITS.maxYaw
        ),
        pitch: clamp(
          current.pitch + pitch * KEYBOARD_STEP_RAD,
          LOOK_LIMITS.minPitch,
          LOOK_LIMITS.maxPitch
        ),
        yawVelocity: 0,
        pitchVelocity: 0
      };
      applyBenchLook(camera, lookStateRef.current);
      invalidate();
    };
    const handleRecenter = () => {
      if (!isOverview) return;

      pointerNdcRef.current = { x: 0, y: 0 };
      lookStateRef.current = createInitialLookState();
      applyBenchLook(camera, lookStateRef.current);
      invalidate();
    };

    window.addEventListener(LOOK_STEP_EVENT, handleLookStep);
    window.addEventListener(LOOK_RECENTER_EVENT, handleRecenter);
    return () => {
      window.removeEventListener(LOOK_STEP_EVENT, handleLookStep);
      window.removeEventListener(LOOK_RECENTER_EVENT, handleRecenter);
    };
  }, [camera, invalidate, isOverview]);

  useEffect(() => {
    const toPosition = new Vector3(...pose.position);
    const toTarget = new Vector3(...pose.target);
    pointerNdcRef.current = { x: 0, y: 0 };
    lookStateRef.current = createInitialLookState();

    if (isFirstPose.current || prefersReducedMotion()) {
      isFirstPose.current = false;
      tweenRef.current = null;
      camera.position.copy(toPosition);
      targetRef.current.copy(toTarget);
      camera.up.set(0, 1, 0);
      camera.lookAt(toTarget);
      invalidate();
      return;
    }

    tweenRef.current = {
      fromPosition: camera.position.clone(),
      fromTarget: targetRef.current.clone(),
      toPosition,
      toTarget,
      elapsedS: 0
    };
    invalidate();
  }, [camera, invalidate, pose]);

  useFrame((_, deltaS) => {
    const tween = tweenRef.current;
    if (tween) {
      tween.elapsedS = Math.min(FOCUS_DURATION_S, tween.elapsedS + deltaS);
      const progress = easeInOutCubic(tween.elapsedS / FOCUS_DURATION_S);

      camera.position.lerpVectors(
        tween.fromPosition,
        tween.toPosition,
        progress
      );
      targetRef.current.lerpVectors(tween.fromTarget, tween.toTarget, progress);
      camera.up.set(0, 1, 0);
      camera.lookAt(targetRef.current);

      if (tween.elapsedS >= FOCUS_DURATION_S) {
        tweenRef.current = null;
        if (lookActive && isOverview && !reducedMotionRef.current) invalidate();
      } else {
        invalidate();
      }
      return;
    }

    if (!isOverview) return;

    const input =
      lookActive && !reducedMotionRef.current
        ? computeEdgePanInput(pointerNdcRef.current, EDGE_PAN_CONFIG)
        : ZERO_INPUT;
    const nextState = reducedMotionRef.current
      ? { ...lookStateRef.current, yawVelocity: 0, pitchVelocity: 0 }
      : stepLook(
          lookStateRef.current,
          input,
          Math.min(deltaS, 0.05),
          STEP_LOOK_CONFIG
        );

    lookStateRef.current = nextState;
    applyBenchLook(camera, nextState);

    if (!isSettled(nextState, input)) invalidate();
  });

  return null;
}
