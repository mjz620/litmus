import { describe, expect, it } from "vitest";

import {
  computeEdgePanInput,
  isSettled,
  lookToTarget,
  stepLook,
  type EdgePanConfig,
  type LookInput,
  type LookState,
  type StepLookConfig
} from "../../src/components/lab/three/cameraMath";

const edgePanConfig: EdgePanConfig = {
  deadZoneRadius: 0.25,
  maxAngularSpeed: 1.2
};

const stepConfig: StepLookConfig = {
  acceleration: 8,
  damping: 4,
  minYaw: -0.5,
  maxYaw: 0.5,
  minPitch: -0.25,
  maxPitch: 0.25
};

const zeroInput: LookInput = { yaw: 0, pitch: 0 };

describe("edge-pan input", () => {
  it("returns zero throughout the central radial dead zone", () => {
    expect(computeEdgePanInput({ x: 0, y: 0 }, edgePanConfig)).toEqual(
      zeroInput
    );
    expect(computeEdgePanInput({ x: 0.2, y: 0.1 }, edgePanConfig)).toEqual(
      zeroInput
    );
    expect(computeEdgePanInput({ x: -0.25, y: 0 }, edgePanConfig)).toEqual(
      zeroInput
    );
  });

  it("increases speed monotonically from the dead zone to the edge", () => {
    const cursorDistances = [0.3, 0.45, 0.7, 1];
    const yawSpeeds = cursorDistances.map(
      (x) => computeEdgePanInput({ x, y: 0 }, edgePanConfig).yaw
    );

    for (let index = 1; index < yawSpeeds.length; index += 1) {
      expect(yawSpeeds[index]!).toBeGreaterThan(yawSpeeds[index - 1]!);
    }
    expect(yawSpeeds.at(-1)).toBeCloseTo(edgePanConfig.maxAngularSpeed, 10);
  });

  it("preserves direction while bounding diagonal angular speed", () => {
    const diagonalSpeeds = [0.2, 0.4, 0.7, 1].map((coordinate) => {
      const input = computeEdgePanInput(
        { x: coordinate, y: coordinate },
        edgePanConfig
      );
      return Math.hypot(input.yaw, input.pitch);
    });
    const input = computeEdgePanInput({ x: -1, y: 1 }, edgePanConfig);

    for (let index = 1; index < diagonalSpeeds.length; index += 1) {
      expect(diagonalSpeeds[index]!).toBeGreaterThan(
        diagonalSpeeds[index - 1]!
      );
    }
    expect(input.yaw).toBeLessThan(0);
    expect(input.pitch).toBeGreaterThan(0);
    expect(Math.hypot(input.yaw, input.pitch)).toBeCloseTo(
      edgePanConfig.maxAngularSpeed,
      10
    );
  });
});

describe("look integration", () => {
  it("accelerates angular velocity toward active input", () => {
    const next = stepLook(
      { yaw: 0, pitch: 0, yawVelocity: 0, pitchVelocity: 0 },
      { yaw: 1.2, pitch: -0.6 },
      0.1,
      stepConfig
    );

    expect(next.yawVelocity).toBeCloseTo(0.8, 10);
    expect(next.pitchVelocity).toBeCloseTo(-0.6, 10);
    expect(next.yaw).toBeCloseTo(0.08, 10);
    expect(next.pitch).toBeCloseTo(-0.06, 10);
  });

  it("hard-clamps yaw and pitch and clears outward velocity", () => {
    const next = stepLook(
      {
        yaw: stepConfig.maxYaw - 0.01,
        pitch: stepConfig.minPitch + 0.01,
        yawVelocity: 1,
        pitchVelocity: -1
      },
      { yaw: 1.2, pitch: -1.2 },
      0.1,
      stepConfig
    );

    expect(next).toEqual({
      yaw: stepConfig.maxYaw,
      pitch: stepConfig.minPitch,
      yawVelocity: 0,
      pitchVelocity: 0
    });
  });

  it("decays released momentum exponentially until settled", () => {
    let state: LookState = {
      yaw: 0,
      pitch: 0,
      yawVelocity: 1,
      pitchVelocity: -0.5
    };

    state = stepLook(state, zeroInput, 0.1, stepConfig);
    expect(state.yawVelocity).toBeCloseTo(Math.exp(-0.4), 10);
    expect(state.pitchVelocity).toBeCloseTo(-0.5 * Math.exp(-0.4), 10);
    expect(isSettled(state, zeroInput)).toBe(false);

    for (let step = 0; step < 30; step += 1) {
      state = stepLook(state, zeroInput, 0.1, stepConfig);
    }

    expect(isSettled(state, zeroInput)).toBe(true);
  });

  it("does not settle while input is still active", () => {
    const stoppedState: LookState = {
      yaw: 0,
      pitch: 0,
      yawVelocity: 0,
      pitchVelocity: 0
    };

    expect(isSettled(stoppedState, zeroInput)).toBe(true);
    expect(isSettled(stoppedState, { yaw: 0.01, pitch: 0 })).toBe(false);
  });
});

describe("look target", () => {
  it("faces down -Z at zero rotation and follows yaw and pitch", () => {
    expect(lookToTarget([1, 2, 3], 0, 0, 2)).toEqual([1, 2, 1]);

    const target = lookToTarget([0, 0, 0], Math.PI / 2, Math.PI / 6, 2);
    expect(target[0]).toBeCloseTo(Math.sqrt(3), 10);
    expect(target[1]).toBeCloseTo(1, 10);
    expect(target[2]).toBeCloseTo(0, 10);
  });
});
