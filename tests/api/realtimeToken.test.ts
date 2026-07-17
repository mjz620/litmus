import { describe, expect, it } from "vitest";

import { POST } from "../../src/app/api/realtime-token/route";

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
