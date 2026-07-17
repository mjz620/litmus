import { describe, expect, it } from "vitest";

import { computeClassAnalytics } from "../../src/lib/analytics/classAnalytics";
import { demoAnalyticsFixture } from "../../src/lib/analytics/demoFixture";

describe("teacher class analytics", () => {
  it("computes fixed completion, readiness, misconception, and attention metrics", () => {
    const analytics = computeClassAnalytics(demoAnalyticsFixture);
    expect(analytics.studentCount).toBe(3);
    expect(analytics.completedSessions).toBe(2);
    expect(analytics.completionRate).toBeCloseTo(2 / 3);
    expect(analytics.misconceptions[0]).toEqual({
      flag: "endpoint_overshoot",
      count: 1
    });
    expect(
      analytics.students.find(({ name }) => name === "Jordan Lee")
        ?.needsAttention
    ).toBe(true);
    expect(analytics.averageReadiness).toBeGreaterThan(0);
  });

  it("counts each flag once per semantic event", () => {
    const analytics = computeClassAnalytics({
      ...demoAnalyticsFixture,
      events: [
        {
          ...demoAnalyticsFixture.events[0]!,
          flags: ["endpoint_overshoot", "endpoint_overshoot"]
        }
      ]
    });
    expect(analytics.misconceptions).toEqual([
      { flag: "endpoint_overshoot", count: 1 }
    ]);
  });
});
