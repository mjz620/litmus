import { describe, expect, it } from "vitest";

import type { SemanticEvent } from "../../src/experiments/shared";
import { createMockCoachResponse } from "../../src/lib/agent/coach";
import type { CoachRequest } from "../../src/lib/agent/schemas";
import { decideCoachTrigger } from "../../src/lib/agent/triggerPolicy";

interface Scenario {
  name: string;
  events: SemanticEvent[];
  question?: string;
  expectResponse: boolean;
}

const scenarios: Scenario[] = [
  {
    name: "water rinse",
    events: [
      event(
        "rinse_burette",
        ["burette_not_conditioned"],
        "burette_conditioning",
        -0.9
      )
    ],
    expectResponse: true
  },
  {
    name: "endpoint overshoot",
    events: [
      event("add_titrant", ["endpoint_overshoot"], "endpoint_control", -0.9)
    ],
    expectResponse: true
  },
  {
    name: "meniscus misread",
    events: [
      event("read_meniscus", ["meniscus_misread"], "volumetric_reading", -0.6)
    ],
    expectResponse: true
  },
  {
    name: "controlled addition stays silent",
    events: [event("add_titrant", [], "endpoint_control", 0.5)],
    expectResponse: false
  },
  {
    name: "direct lab question",
    events: [],
    question: "Why does endpoint control matter?",
    expectResponse: true
  }
];

describe("coach eval harness", () => {
  it("meets deterministic catch-rate and false-intervention gates", () => {
    const results = scenarios.map((scenario) => {
      const decision = decideCoachTrigger({
        recentEvents: scenario.events,
        studentQuestion: scenario.question
      });
      const response = decision.shouldTrigger
        ? createMockCoachResponse(
            request(scenario, decision.source, decision.maxHintLevel)
          )
        : { shouldRespond: false, evidenceEventTypes: [] };
      return {
        ...scenario,
        actual: response.shouldRespond,
        linked:
          response.evidenceEventTypes.length > 0 || Boolean(scenario.question)
      };
    });
    const positives = results.filter(({ expectResponse }) => expectResponse);
    const negatives = results.filter(({ expectResponse }) => !expectResponse);
    const catchRate =
      positives.filter(({ actual }) => actual).length / positives.length;
    const falseInterventionRate =
      negatives.filter(({ actual }) => actual).length / negatives.length;
    const evidenceLinkRate =
      positives.filter(({ linked }) => linked).length / positives.length;

    console.table([
      { metric: "intervention recall", value: catchRate },
      { metric: "false intervention rate", value: falseInterventionRate },
      { metric: "evidence linkage rate", value: evidenceLinkRate }
    ]);

    expect(catchRate).toBe(1);
    expect(falseInterventionRate).toBe(0);
    expect(evidenceLinkRate).toBe(1);
  });
});

function event(
  type: string,
  flags: string[],
  skillId: string,
  delta: number
): SemanticEvent {
  return {
    type,
    tSim: 1,
    observation: {},
    flags,
    evidence: [
      {
        skillId,
        delta,
        reason: flags[0] ?? "controlled_addition_near_endpoint"
      }
    ]
  };
}

function request(
  scenario: Scenario,
  source: "event" | "question" | "retry",
  maxHintLevel: 0 | 1 | 2 | 3
): CoachRequest {
  return {
    sessionId: "eval-session",
    experimentId: "acid_base_titration",
    currentState: {},
    recentEvents: scenario.events,
    studentQuestion: scenario.question,
    studentModel: {
      sessionId: "eval-session",
      experimentId: "acid_base_titration",
      skills: {},
      activeFlags: []
    },
    triggerPolicy: { source, maxHintLevel }
  };
}
