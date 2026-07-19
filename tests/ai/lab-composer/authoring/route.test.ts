import { describe, expect, it } from "vitest";

import { GET, POST } from "../../../../src/app/api/lab-composer/author/route";

describe("POST /api/lab-composer/author (retired)", () => {
  it("returns 410 Gone and points callers at the capability route", async () => {
    const response = await POST(
      new Request("http://localhost/api/lab-composer/author", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}"
      })
    );
    const json = await response.json();
    expect(response.status).toBe(410);
    expect(json).toMatchObject({
      ok: false,
      error: "authoring.route_retired.v1"
    });
    expect(String(json.message)).toContain("author/capability");
  });

  it("also retires GET", async () => {
    const response = await GET();
    expect(response.status).toBe(410);
  });
});
