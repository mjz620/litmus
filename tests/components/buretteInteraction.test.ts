import { describe, expect, it } from "vitest";

import {
  DISPENSE_VISUAL_PROFILES,
  STOPCOCK_DETENT_ANGLES,
  createBuretteMeniscusProfile,
  getStopcockDetent,
  getStopcockDragAngle
} from "../../src/components/lab/three/Burette";
import { BURETTE } from "../../src/components/lab/three/benchLayout";

describe("burette meniscus profile", () => {
  it("rises monotonically from the reading bottom to the tube wall", () => {
    const profile = createBuretteMeniscusProfile();

    expect(profile[0]!.x).toBe(0);
    expect(profile[0]!.y).toBe(0);
    expect(profile.at(-1)!.x).toBeCloseTo(BURETTE.liquidRadius, 10);
    expect(profile.at(-1)!.y).toBeCloseTo(BURETTE.meniscusRise, 10);
    expect(BURETTE.meniscusRise / BURETTE.liquidRadius).toBeGreaterThanOrEqual(
      0.3
    );

    for (let index = 1; index < profile.length; index += 1) {
      expect(profile[index]!.x).toBeGreaterThan(profile[index - 1]!.x);
      expect(profile[index]!.y).toBeGreaterThan(profile[index - 1]!.y);
    }
  });
});

describe("burette stopcock drag mapping", () => {
  it("clamps upward and excessive downward drags to physical travel", () => {
    expect(getStopcockDragAngle(-80)).toBe(0);
    expect(getStopcockDragAngle(Number.NaN)).toBe(0);
    expect(getStopcockDragAngle(120)).toBeCloseTo(Math.PI / 2, 10);
    expect(getStopcockDragAngle(400)).toBeCloseTo(Math.PI / 2, 10);
  });

  it("maps increasing drag travel monotonically across every detent", () => {
    expect([0, 30, 60, 120].map(getStopcockDragAngle)).toEqual([
      STOPCOCK_DETENT_ANGLES.closed,
      STOPCOCK_DETENT_ANGLES.dropwise,
      STOPCOCK_DETENT_ANGLES.slow,
      STOPCOCK_DETENT_ANGLES.open
    ]);

    expect(
      [0, 30, 60, 120].map((pixels) =>
        getStopcockDetent(getStopcockDragAngle(pixels))
      )
    ).toEqual(["closed", "dropwise", "slow", "open"]);
  });

  it("snaps angles to the nearest reducer detent", () => {
    const detents = ["closed", "dropwise", "slow", "open"] as const;

    for (const detent of detents) {
      expect(getStopcockDetent(STOPCOCK_DETENT_ANGLES[detent])).toBe(detent);
    }

    expect(getStopcockDetent(-1)).toBe("closed");
    expect(getStopcockDetent(Number.POSITIVE_INFINITY)).toBe("closed");
    expect(getStopcockDetent(Math.PI)).toBe("open");
  });
});

describe("dispense animation profiles", () => {
  it("makes stream weight and drip cadence increase with flow rate", () => {
    const profiles = [
      DISPENSE_VISUAL_PROFILES.dropwise,
      DISPENSE_VISUAL_PROFILES.slow,
      DISPENSE_VISUAL_PROFILES.open
    ];

    for (let index = 1; index < profiles.length; index += 1) {
      expect(profiles[index]!.streamRadius).toBeGreaterThan(
        profiles[index - 1]!.streamRadius
      );
      expect(profiles[index]!.opacity).toBeGreaterThan(
        profiles[index - 1]!.opacity
      );
      expect(profiles[index]!.dripCyclesPerSecond).toBeGreaterThan(
        profiles[index - 1]!.dripCyclesPerSecond
      );
    }
  });
});
