import { describe, expect, it, vi } from "vitest";

import { createDemoResetHandler } from "../../src/app/api/demo/reset/route";

describe("POST /api/demo/reset", () => {
  it("calls only the scoped demo resetter", async () => {
    const reset = vi.fn(async () => ({ clearedSessions: 1 }));
    const response = await createDemoResetHandler({ reset })();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      clearedSessions: 1
    });
    expect(reset).toHaveBeenCalledOnce();
  });
});
