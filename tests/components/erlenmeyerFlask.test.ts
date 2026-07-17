import { describe, expect, it } from "vitest";

import {
  FLASK_GRADUATION_MARKS,
  FLASK_GRADUATION_SPAN,
  createErlenmeyerGlassProfile,
  getFlaskBodyRadiusAtHeight
} from "../../src/components/lab/three/ErlenmeyerFlask";
import { FLASK } from "../../src/components/lab/three/benchLayout";

describe("Erlenmeyer flask profile", () => {
  it("preserves the established silhouette extents", () => {
    const profile = createErlenmeyerGlassProfile();
    const radii = profile.map(({ x }) => x);
    const heights = profile.map(({ y }) => y);

    expect(Math.max(...radii)).toBeCloseTo(FLASK.baseRadius, 10);
    expect(heights[0]).toBeCloseTo(0, 10);
    expect(heights.at(-1)).toBeCloseTo(FLASK.bodyHeight + FLASK.neckHeight, 10);
    expect(radii.at(-1)).toBeCloseTo(FLASK.rimRadius, 10);
  });

  it("keeps profile points ordered without radius discontinuities", () => {
    const profile = createErlenmeyerGlassProfile();

    for (let index = 1; index < profile.length; index += 1) {
      const previous = profile[index - 1]!;
      const current = profile[index]!;

      expect(Number.isFinite(current.x)).toBe(true);
      expect(Number.isFinite(current.y)).toBe(true);
      expect(current.x).toBeGreaterThan(0);
      expect(current.y).toBeGreaterThanOrEqual(previous.y);

      if (current.y === previous.y) {
        expect(current.y).toBe(0);
      } else if (index >= 4) {
        const radialSlope =
          Math.abs(current.x - previous.x) / (current.y - previous.y);

        expect(radialSlope).toBeLessThan(0.9);
      }
    }
  });

  it("adds three ordered interpolation points through the shoulder blend", () => {
    const profile = createErlenmeyerGlassProfile();
    const shoulderPoints = profile.filter(
      ({ y }) => y >= FLASK.bodyHeight - 0.024 && y <= FLASK.bodyHeight + 0.004
    );

    expect(shoulderPoints).toHaveLength(4);

    for (let index = 1; index < shoulderPoints.length; index += 1) {
      expect(shoulderPoints[index]!.x).toBeLessThan(
        shoulderPoints[index - 1]!.x
      );
      expect(shoulderPoints[index]!.y).toBeGreaterThan(
        shoulderPoints[index - 1]!.y
      );
    }
  });

  it("keeps the conical body radius continuous and decreasing with height", () => {
    const sampleHeights = [0, 0.026, 0.052, 0.08, 0.108, FLASK.bodyHeight];
    const radii = sampleHeights.map(getFlaskBodyRadiusAtHeight);

    expect(radii[0]).toBeCloseTo(FLASK.baseRadius, 10);
    expect(radii.at(-1)).toBeCloseTo(FLASK.shoulderRadius, 10);

    for (let index = 1; index < radii.length; index += 1) {
      expect(radii[index]).toBeLessThan(radii[index - 1]!);
    }
  });
});

describe("Erlenmeyer flask graduations", () => {
  it("provides the requested labels in ascending physical height", () => {
    expect(FLASK_GRADUATION_MARKS.map(({ volumeML }) => volumeML)).toEqual([
      25, 50, 75, 100
    ]);

    for (let index = 1; index < FLASK_GRADUATION_MARKS.length; index += 1) {
      expect(FLASK_GRADUATION_MARKS[index]!.heightFraction).toBeGreaterThan(
        FLASK_GRADUATION_MARKS[index - 1]!.heightFraction
      );
    }
  });

  it("keeps the wrapped decal on the conical body below the shoulder", () => {
    expect(FLASK_GRADUATION_SPAN.bottomY).toBeGreaterThan(0);
    expect(FLASK_GRADUATION_SPAN.topY).toBeLessThan(FLASK.bodyHeight);
    expect(FLASK_GRADUATION_SPAN.topY).toBeGreaterThan(
      FLASK_GRADUATION_SPAN.bottomY
    );
    expect(
      getFlaskBodyRadiusAtHeight(FLASK_GRADUATION_SPAN.bottomY)
    ).toBeGreaterThan(getFlaskBodyRadiusAtHeight(FLASK_GRADUATION_SPAN.topY));
  });
});
