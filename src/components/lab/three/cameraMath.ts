export interface LookState {
  yaw: number;
  pitch: number;
  yawVelocity: number;
  pitchVelocity: number;
}

export interface LookInput {
  readonly yaw: number;
  readonly pitch: number;
}

export interface EdgePanConfig {
  readonly deadZoneRadius: number;
  readonly maxAngularSpeed: number;
}

export interface LookLimits {
  readonly minYaw: number;
  readonly maxYaw: number;
  readonly minPitch: number;
  readonly maxPitch: number;
}

export interface StepLookConfig extends LookLimits {
  /** Maximum angular-velocity change, in radians per second squared. */
  readonly acceleration: number;
  /** Exponential momentum damping coefficient, in inverse seconds. */
  readonly damping: number;
}

const SETTLED_EPSILON = 0.001;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(value: number): number {
  return value * value * (3 - 2 * value);
}

function moveTowards(
  current: number,
  target: number,
  maxDelta: number
): number {
  if (current < target) return Math.min(target, current + maxDelta);
  return Math.max(target, current - maxDelta);
}

function isNearlyZero(value: number): boolean {
  return Math.abs(value) <= SETTLED_EPSILON;
}

/**
 * Convert cursor NDC into a target yaw/pitch velocity. The central radial
 * dead zone is still, then speed eases to the configured maximum at an edge.
 */
export function computeEdgePanInput(
  ndc: { readonly x: number; readonly y: number },
  config: EdgePanConfig
): LookInput {
  const x = clamp(Number.isFinite(ndc.x) ? ndc.x : 0, -1, 1);
  const y = clamp(Number.isFinite(ndc.y) ? ndc.y : 0, -1, 1);
  const distance = Math.hypot(x, y);
  const deadZoneRadius = clamp(config.deadZoneRadius, 0, 1);
  const maxAngularSpeed = Math.max(0, config.maxAngularSpeed);

  if (distance <= deadZoneRadius || distance === 0) {
    return { yaw: 0, pitch: 0 };
  }

  const directionX = x / distance;
  const directionY = y / distance;
  const distanceToCanvasEdge =
    1 / Math.max(Math.abs(directionX), Math.abs(directionY));
  const edgeProgress = clamp(
    (distance - deadZoneRadius) / (distanceToCanvasEdge - deadZoneRadius),
    0,
    1
  );
  const speed = smoothstep(edgeProgress) * maxAngularSpeed;

  return {
    yaw: directionX * speed,
    pitch: directionY * speed
  };
}

/**
 * Advance look angles and angular velocity without mutating the prior state.
 * Active input is a target velocity; released axes decay exponentially.
 */
export function stepLook(
  state: LookState,
  input: LookInput,
  dtS: number,
  config: StepLookConfig
): LookState {
  const minYaw = Math.min(config.minYaw, config.maxYaw);
  const maxYaw = Math.max(config.minYaw, config.maxYaw);
  const minPitch = Math.min(config.minPitch, config.maxPitch);
  const maxPitch = Math.max(config.minPitch, config.maxPitch);
  const dt = Number.isFinite(dtS) ? Math.max(0, dtS) : 0;
  const acceleration = Math.max(0, config.acceleration);
  const damping = Math.max(0, config.damping);
  const targetYawVelocity = Number.isFinite(input.yaw) ? input.yaw : 0;
  const targetPitchVelocity = Number.isFinite(input.pitch) ? input.pitch : 0;
  const decay = Math.exp(-damping * dt);

  let yawVelocity = isNearlyZero(targetYawVelocity)
    ? state.yawVelocity * decay
    : moveTowards(state.yawVelocity, targetYawVelocity, acceleration * dt);
  let pitchVelocity = isNearlyZero(targetPitchVelocity)
    ? state.pitchVelocity * decay
    : moveTowards(state.pitchVelocity, targetPitchVelocity, acceleration * dt);

  const unclampedYaw = state.yaw + yawVelocity * dt;
  const unclampedPitch = state.pitch + pitchVelocity * dt;
  const yaw = clamp(unclampedYaw, minYaw, maxYaw);
  const pitch = clamp(unclampedPitch, minPitch, maxPitch);

  if (
    (yaw === minYaw && yawVelocity < 0) ||
    (yaw === maxYaw && yawVelocity > 0)
  ) {
    yawVelocity = 0;
  }
  if (
    (pitch === minPitch && pitchVelocity < 0) ||
    (pitch === maxPitch && pitchVelocity > 0)
  ) {
    pitchVelocity = 0;
  }

  return { yaw, pitch, yawVelocity, pitchVelocity };
}

/**
 * Convert yaw/pitch into a world-space look target. At zero rotation the
 * camera faces down the conventional Three.js forward axis (-Z).
 */
export function lookToTarget(
  position: readonly [number, number, number],
  yaw: number,
  pitch: number,
  distance: number
): [number, number, number] {
  const horizontalDistance = Math.cos(pitch) * distance;

  return [
    position[0] + Math.sin(yaw) * horizontalDistance,
    position[1] + Math.sin(pitch) * distance,
    position[2] - Math.cos(yaw) * horizontalDistance
  ];
}

export function isSettled(state: LookState, input: LookInput): boolean {
  return (
    isNearlyZero(state.yawVelocity) &&
    isNearlyZero(state.pitchVelocity) &&
    isNearlyZero(input.yaw) &&
    isNearlyZero(input.pitch)
  );
}
