import { describe, expect, it, vi } from "vitest";

import { POST } from "../../src/app/api/realtime-token/route";

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


describe("POST /api/realtime-token", () => {
  it("validates the session and returns a secret-shaped mock without a long-lived key", async () => {
    const bad = await POST(
      new Request("http://localhost/api/realtime-token", {
        method: "POST",
        body: "{}"
      })
    );
    expect(bad.status).toBe(400);
    const response = await POST(
      new Request("http://localhost/api/realtime-token", {
        method: "POST",
        body: JSON.stringify({
          sessionId: "11111111-1111-4111-8111-111111111111"
        })
      })
    );
    const body = await response.json();
    expect(body).toMatchObject({ mock: true, model: "gpt-realtime-whisper" });
    expect(JSON.stringify(body)).not.toContain(
      process.env.OPENAI_API_KEY ?? "not-present"
    );
  });
});
