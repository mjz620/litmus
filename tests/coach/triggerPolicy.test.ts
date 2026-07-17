import { describe, expect, it } from "vitest";

import type { SemanticEvent } from "../../src/experiments/shared";
import { decideCoachTrigger } from "../../src/lib/agent/triggerPolicy";

function event(overrides: Partial<SemanticEvent> = {}): SemanticEvent {
  return {
    type: "add_titrant",
    tSim: 1,
    observation: {},
    flags: [],
    evidence: [],
    ...overrides
  };
}

describe("decideCoachTrigger", () => {
  it("triggers on endpoint overshoot", () => {
    expect(
      decideCoachTrigger({
        recentEvents: [event({ flags: ["endpoint_overshoot"] })]
      })
    ).toMatchObject({ shouldTrigger: true, source: "event" });
  });

  it("stays silent on controlled routine success", () => {
    expect(
      decideCoachTrigger({
        recentEvents: [
          event({
            evidence: [
              {
                skillId: "endpoint_control",
                delta: 0.5,
                reason: "controlled_addition_near_endpoint"
              }
            ]
          })
        ]
      }).shouldTrigger
    ).toBe(false);
  });

  it("stays silent on a valid routine refill", () => {
    expect(
      decideCoachTrigger({
        recentEvents: [
          event({
            type: "refill_burette",
            observation: {
              requestedML: 20,
              resultingAvailableML: 40,
              currentReadingML: 10,
              fillKind: "refill"
            }
          })
        ]
      }).shouldTrigger
    ).toBe(false);
  });

  it("triggers on a direct question or repeated negative evidence", () => {
    expect(
      decideCoachTrigger({ recentEvents: [], studentQuestion: "Why?" }).source
    ).toBe("question");
    const failure = event({
      evidence: [{ skillId: "endpoint_control", delta: -0.2, reason: "miss" }]
    });
    expect(
      decideCoachTrigger({ recentEvents: [failure, failure] }).reasons
    ).toContain("repeated_failure:endpoint_control");
  });
});
