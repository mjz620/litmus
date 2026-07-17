import type { ClassAnalyticsInput } from "./classAnalytics";

export const DEMO_CLASS_ID = "00000000-0000-4000-8000-000000000100";

export const demoAnalyticsFixture: ClassAnalyticsInput = {
  students: [
    { id: "00000000-0000-4000-8000-000000000201", name: "Avery Chen" },
    { id: "00000000-0000-4000-8000-000000000202", name: "Jordan Lee" },
    { id: "00000000-0000-4000-8000-000000000203", name: "Sam Rivera" }
  ],
  sessions: [
    {
      id: "00000000-0000-4000-8000-000000000301",
      studentId: "00000000-0000-4000-8000-000000000201",
      experimentId: "acid_base_titration",
      experimentVersion: "1.0.0",
      completedAt: "2026-07-16T15:00:00.000Z"
    },
    {
      id: "00000000-0000-4000-8000-000000000302",
      studentId: "00000000-0000-4000-8000-000000000202",
      experimentId: "acid_base_titration",
      experimentVersion: "1.0.0",
      completedAt: "2026-07-16T15:10:00.000Z"
    },
    {
      id: "00000000-0000-4000-8000-000000000303",
      studentId: "00000000-0000-4000-8000-000000000203",
      experimentId: "acid_base_titration",
      experimentVersion: "1.0.0"
    }
  ],
  skillEstimates: [
    {
      sessionId: "00000000-0000-4000-8000-000000000301",
      studentId: "00000000-0000-4000-8000-000000000201",
      skillId: "endpoint_control",
      mastery: 0.82,
      evidenceCount: 4,
      updatedAt: "2026-07-16T15:00:00.000Z"
    },
    {
      sessionId: "00000000-0000-4000-8000-000000000301",
      studentId: "00000000-0000-4000-8000-000000000201",
      skillId: "burette_conditioning",
      mastery: 0.78,
      evidenceCount: 2,
      updatedAt: "2026-07-16T15:00:00.000Z"
    },
    {
      sessionId: "00000000-0000-4000-8000-000000000302",
      studentId: "00000000-0000-4000-8000-000000000202",
      skillId: "endpoint_control",
      mastery: 0.34,
      evidenceCount: 3,
      updatedAt: "2026-07-16T15:10:00.000Z"
    },
    {
      sessionId: "00000000-0000-4000-8000-000000000302",
      studentId: "00000000-0000-4000-8000-000000000202",
      skillId: "burette_conditioning",
      mastery: 0.58,
      evidenceCount: 2,
      updatedAt: "2026-07-16T15:10:00.000Z"
    }
  ],
  events: [
    {
      sessionId: "00000000-0000-4000-8000-000000000302",
      type: "add_titrant",
      flags: ["endpoint_overshoot"],
      tSim: 40
    },
    {
      sessionId: "00000000-0000-4000-8000-000000000302",
      type: "add_titrant",
      flags: ["flow_rate_high_near_endpoint"],
      tSim: 36
    },
    {
      sessionId: "00000000-0000-4000-8000-000000000302",
      type: "read_meniscus",
      flags: ["meniscus_misread"],
      tSim: 42
    }
  ],
  readinessWeights: {
    burette_conditioning: 0.25,
    endpoint_control: 0.3,
    volumetric_reading: 0.2,
    stoichiometry: 0.25
  }
};
