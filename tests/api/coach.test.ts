import { describe, expect, it, vi } from "vitest";

import { POST } from "../../src/app/api/coach/route";

/*
 * These routes reach a paid model and now authenticate first. The guard is
 * stubbed here so each test still exercises the handler it is about; the
 * 401/403 behaviour itself is covered in tests/api/llmRouteGuard.test.ts.
 */
vi.mock("../../src/lib/persistence/labDefinitionApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/lib/persistence/labDefinitionApi")>()),
  authenticateComposerPrincipal: vi.fn(async () => ({
    userId: "00000000-0000-4000-8000-0000000000aa",
    role: "teacher" as const
  }))
}));


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
