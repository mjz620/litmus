import { describe, expect, it, vi } from "vitest";

import {
  COACH_SYSTEM_PROMPT,
  COACH_LIVE_RESPONSE_TIMEOUT_MS,
  createMockCoachResponse,
  generateCoachResponse
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

  it("uses bounded local guidance when a live Coach model is unavailable", async () => {
    const response = await generateCoachResponse(
      request({
        studentQuestion: "Why should I slow down near the endpoint?",
        triggerPolicy: { source: "question", maxHintLevel: 2 }
      }),
      {
        model: {
          model: "unavailable-test-model",
          respond: async () => {
            throw new Error("provider unavailable");
          }
        }
      }
    );

    expect(response).toMatchObject({
      shouldRespond: true,
      interventionType: "hint",
      safety: { refused: false }
    });
    expect(response.message).not.toMatch(/provider|503|unavailable/i);
  });

  it("uses bounded local guidance before a slow live Coach request reaches the route limit", async () => {
    vi.useFakeTimers();
    try {
      const response = generateCoachResponse(
        request({
          studentQuestion: "What should I observe next?",
          triggerPolicy: { source: "question", maxHintLevel: 2 }
        }),
        {
          model: {
            model: "slow-test-model",
            respond: async () => new Promise(() => undefined)
          }
        }
      );

      await vi.advanceTimersByTimeAsync(COACH_LIVE_RESPONSE_TIMEOUT_MS);
      await expect(response).resolves.toMatchObject({
        shouldRespond: true,
        interventionType: "hint",
        safety: { refused: false }
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
