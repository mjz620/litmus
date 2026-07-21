import { describe, expect, it } from "vitest";
import { POST as coach } from "../../src/app/api/coach/route";
import { POST as evaluate } from "../../src/app/api/evaluate/route";
import { POST as realtime } from "../../src/app/api/realtime-token/route";
import { POST as judge } from "../../src/app/api/lab-composer/judge/route";
import { POST as capability } from "../../src/app/api/lab-composer/author/capability/route";
/*
 * Regression guard for the whole class of defect: these five routes reach a
 * paid model (or mint a realtime voice token) and were previously open to the
 * internet. No route here may ever answer 2xx without authentication — an auth
 * backend fault must fail closed (503), never admit the caller.
 */
const req = (u: string) => new Request(u, { method: "POST", headers: {"content-type":"application/json"}, body: "{}" });
type LlmRouteHandler = (request: Request) => Promise<Response>;

describe("unauthenticated LLM routes fail closed", () => {
  for (const [name, h, u] of [
    ["coach", coach, "http://localhost/api/coach"],
    ["evaluate", evaluate, "http://localhost/api/evaluate"],
    ["realtime-token", realtime, "http://localhost/api/realtime-token"],
    ["judge", judge, "http://localhost/api/lab-composer/judge"],
    ["capability", capability, "http://localhost/api/lab-composer/author/capability"]
  ] as readonly (readonly [string, LlmRouteHandler, string])[]) {
    it(`${name} refuses`, async () => {
      const r = await h(req(u));
      expect([401, 403, 503]).toContain(r.status);
    });
  }
});
