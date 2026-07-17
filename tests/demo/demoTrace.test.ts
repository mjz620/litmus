import { describe, expect, it } from "vitest";

import { computeClassAnalytics } from "../../src/lib/analytics/classAnalytics";
import { demoAnalyticsFixture } from "../../src/lib/analytics/demoFixture";
import {
  extendAnalyticsWithDemoTrace,
  type DemoTrace
} from "../../src/lib/demo/demoTrace";

describe("demo live insertion", () => {
  it("derives a highlighted live row from real runtime objects", () => {
    const trace = {
      schemaVersion: "1",
      recordedAt: "2026-07-17T00:00:00Z",
      sessionId: "11111111-1111-4111-8111-111111111111",
      state: {
        config: {
          analyte: {
            name: "HCl",
            type: "strong_acid",
            concentrationM: 0.1,
            volumeML: 25
          },
          titrant: { name: "NaOH", concentrationM: 0.1 },
          indicator: "phenolphthalein",
          buretteCapacityML: 50
        },
        sessionSeed: "demo",
        indicatorAdded: true,
        titrantAddedML: 24,
        buretteAvailableML: 26,
        buretteReadingML: 24,
        fillCount: 1,
        fillHistory: [
          {
            requestedML: 50,
            resultingAvailableML: 50,
            currentReadingML: 0,
            kind: "initial",
            tSim: 0
          }
        ],
        buretteConditioned: true,
        titrantDilutionFactor: 1,
        tSim: 40,
        curve: [],
        submitted: false
      },
      events: [],
      studentModel: {
        sessionId: "x",
        experimentId: "acid_base_titration",
        skills: { endpoint_control: { mastery: 0.4, evidenceCount: 2 } },
        activeFlags: []
      },
      coachMessages: [],
      lastCoachRequest: null,
      lastCheckpoint: null
    } satisfies DemoTrace;
    const analytics = computeClassAnalytics(
      extendAnalyticsWithDemoTrace(demoAnalyticsFixture, trace)
    );
    expect(analytics.students.at(-1)?.name).toBe("Your demo session");
    expect(analytics.studentCount).toBe(4);
  });
});
