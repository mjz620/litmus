import { describe, expect, it } from "vitest";

import { POST } from "../../src/app/api/coach/route";

describe("POST /api/coach", () => {
  it("rejects invalid requests", async () => {
    const response = await POST(
      new Request("http://localhost/api/coach", {
        method: "POST",
        body: JSON.stringify({})
      })
    );
    expect(response.status).toBe(400);
  });

  it("returns a structured mock response", async () => {
    const response = await POST(
      new Request("http://localhost/api/coach", {
        method: "POST",
        body: JSON.stringify({
          sessionId: "session-1",
          experimentId: "acid_base_titration",
          currentState: {},
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
          ],
          studentModel: {
            sessionId: "session-1",
            experimentId: "acid_base_titration",
            skills: {},
            activeFlags: []
          },
          triggerPolicy: { source: "event", maxHintLevel: 2 }
        })
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      shouldRespond: true,
      evidenceEventTypes: ["add_titrant"]
    });
  });
});
