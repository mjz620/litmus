import { describe, expect, it } from "vitest";

import {
  applyEvidence,
  newStudentModel,
  type ExperimentDefinition,
  type SemanticEvent
} from "../../src/experiments/shared";

interface TestConfig {
  initialValue: number;
}

interface TestState {
  value: number;
}

type TestAction = { type: "increment"; amount: number };

const testExperiment = {
  id: "test_experiment",
  title: "Test Experiment",
  skills: [
    {
      id: "measurement",
      label: "Measurement",
      description: "Take a careful measurement."
    }
  ],
  reportRubric: [],
  createInitialState(config, seed) {
    return { value: seed?.value ?? config.initialValue };
  },
  step(state, action) {
    return {
      state: { value: state.value + action.amount },
      events: []
    };
  },
  getGroundTruth(state) {
    return { values: { value: state.value }, notes: [] };
  }
} satisfies ExperimentDefinition<TestConfig, TestState, TestAction>;

function event(
  evidence: SemanticEvent["evidence"],
  flags: string[] = []
): SemanticEvent {
  return {
    type: "measurement_recorded",
    tSim: 1,
    observation: { reading: 10 },
    flags,
    evidence
  };
}

describe("ExperimentDefinition", () => {
  it("supports typed initial state, actions, results, and ground truth", () => {
    const initial = testExperiment.createInitialState(
      { initialValue: 2 },
      undefined
    );
    const result = testExperiment.step(initial, {
      type: "increment",
      amount: 3
    });

    expect(result.state).toEqual({ value: 5 });
    expect(testExperiment.getGroundTruth(result.state).values.value).toBe(5);
  });
});

describe("StudentModel evidence reducer", () => {
  it("initializes declared skills at neutral mastery", () => {
    expect(newStudentModel("session-1", testExperiment)).toEqual({
      sessionId: "session-1",
      experimentId: "test_experiment",
      skills: {
        measurement: { mastery: 0.5, evidenceCount: 0 }
      },
      activeFlags: []
    });
  });

  it("raises mastery from positive evidence without mutating the prior model", () => {
    const before = newStudentModel("session-1", testExperiment);
    const after = applyEvidence(
      before,
      event([
        {
          skillId: "measurement",
          delta: 1,
          reason: "careful_measurement"
        }
      ])
    );

    expect(after.skills.measurement).toEqual({
      mastery: 0.65,
      evidenceCount: 1,
      lastReason: "careful_measurement"
    });
    expect(before.skills.measurement).toEqual({
      mastery: 0.5,
      evidenceCount: 0
    });
    expect(after).not.toBe(before);
  });

  it("lowers mastery from negative evidence and accumulates unique flags", () => {
    const before = {
      ...newStudentModel("session-1", testExperiment),
      activeFlags: ["needs_review"]
    };
    const after = applyEvidence(
      before,
      event(
        [
          {
            skillId: "measurement",
            delta: -1,
            reason: "meniscus_misread"
          }
        ],
        ["needs_review", "meniscus_misread"]
      )
    );

    expect(after.skills.measurement).toEqual({
      mastery: 0.35,
      evidenceCount: 1,
      lastReason: "meniscus_misread"
    });
    expect(after.activeFlags).toEqual(["needs_review", "meniscus_misread"]);
  });

  it("creates a neutral estimate when evidence names an undeclared skill", () => {
    const after = applyEvidence(
      newStudentModel("session-1", testExperiment),
      event([
        {
          skillId: "new_skill",
          delta: 0.5,
          reason: "new_evidence"
        }
      ])
    );

    expect(after.skills.new_skill).toEqual({
      mastery: 0.575,
      evidenceCount: 1,
      lastReason: "new_evidence"
    });
  });
});
