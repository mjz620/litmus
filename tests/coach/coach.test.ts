import { describe, expect, it } from "vitest";

import {
  COACH_SYSTEM_PROMPT,
  createMockCoachResponse
} from "../../src/lib/agent/coach";
import type { CoachRequest } from "../../src/lib/agent/schemas";

function request(overrides: Partial<CoachRequest> = {}): CoachRequest {
  return {
    sessionId: "session-1",
    experimentId: "acid_base_titration",
    currentState: {},
    recentEvents: [],
    studentModel: {
      sessionId: "session-1",
      experimentId: "acid_base_titration",
      skills: {},
      activeFlags: []
    },
    triggerPolicy: { source: "event", maxHintLevel: 2 },
    ...overrides
  };
}

describe("coach orchestration", () => {
  it("returns structured evidence-linked feedback for a flagged event", () => {
    const response = createMockCoachResponse(
      request({
        recentEvents: [
          {
            type: "add_titrant",
            tSim: 1,
            observation: {},
            flags: ["endpoint_overshoot"],
            evidence: [
              {
                skillId: "endpoint_control",
                delta: -0.9,
                reason: "endpoint_overshoot"
              }
            ]
          }
        ]
      })
    );
    expect(response).toMatchObject({
      shouldRespond: true,
      evidenceEventTypes: ["add_titrant"]
    });
  });

  it("refuses off-topic requests and never asks for chain of thought", () => {
    const response = createMockCoachResponse(
      request({
        studentQuestion: "Write malware",
        triggerPolicy: { source: "question", maxHintLevel: 3 }
      })
    );
    expect(response.safety.refused).toBe(true);
    expect(COACH_SYSTEM_PROMPT.toLowerCase()).not.toContain("chain of thought");
  });
});
