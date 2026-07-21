import { describe, expect, it, vi } from "vitest";

import {
  FixedWindowRateLimiter,
  guardLlmRoute
} from "../../src/lib/api/llmRouteGuard";

const TEACHER = {
  userId: "00000000-0000-4000-8000-00000000000a",
  role: "teacher" as const
};
const STUDENT = {
  userId: "00000000-0000-4000-8000-00000000000b",
  role: "student" as const
};

const wideOpen = () => new FixedWindowRateLimiter(1_000, 60_000);

/*
 * These routes reach a paid model. Before this guard they were open to the
 * internet: anyone who found the URL could spend the project's model budget,
 * and the realtime endpoint minted voice session tokens to anonymous callers.
 */
describe("guardLlmRoute", () => {
  it("rejects an unauthenticated caller with 401", async () => {
    const result = await guardLlmRoute({
      limiter: wideOpen(),
      authenticate: async () => null
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(401);
  });

  it("does not consume rate budget for unauthenticated callers", async () => {
    // Otherwise an anonymous flood could exhaust a real user's budget.
    const limiter = new FixedWindowRateLimiter(1, 60_000);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await guardLlmRoute({ limiter, authenticate: async () => null });
    }

    const allowed = await guardLlmRoute({
      limiter,
      authenticate: async () => TEACHER
    });

    expect(allowed.ok).toBe(true);
  });

  it("rejects a student on a teacher-only route with 403", async () => {
    const result = await guardLlmRoute({
      limiter: wideOpen(),
      requireRole: "teacher",
      authenticate: async () => STUDENT
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(403);
  });

  it("admits an authenticated caller and returns the principal", async () => {
    const result = await guardLlmRoute({
      limiter: wideOpen(),
      authenticate: async () => STUDENT
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.principal.userId).toBe(STUDENT.userId);
  });

  it("returns 503 rather than admitting the caller when auth throws", async () => {
    const result = await guardLlmRoute({
      limiter: wideOpen(),
      authenticate: async () => {
        throw new Error("supabase unreachable");
      }
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(503);
  });

  it("rate-limits per user with 429 and a Retry-After header", async () => {
    const limiter = new FixedWindowRateLimiter(2, 60_000);
    const now = vi.fn(() => 1_000);
    const call = () =>
      guardLlmRoute({ limiter, now, authenticate: async () => TEACHER });

    expect((await call()).ok).toBe(true);
    expect((await call()).ok).toBe(true);

    const limited = await call();
    expect(limited.ok).toBe(false);
    if (limited.ok) return;
    expect(limited.response.status).toBe(429);
    expect(
      Number(limited.response.headers.get("Retry-After"))
    ).toBeGreaterThan(0);
  });

  it("budgets each user separately", async () => {
    const limiter = new FixedWindowRateLimiter(1, 60_000);
    const now = () => 1_000;

    const first = await guardLlmRoute({
      limiter,
      now,
      authenticate: async () => TEACHER
    });
    const second = await guardLlmRoute({
      limiter,
      now,
      authenticate: async () => STUDENT
    });

    expect(first.ok).toBe(true);
    // One user exhausting their budget must not lock everyone else out —
    // a whole class shares one school NAT, so an address-keyed budget would.
    expect(second.ok).toBe(true);
  });

  it("restores budget once the window rolls over", async () => {
    const limiter = new FixedWindowRateLimiter(1, 60_000);
    let clock = 1_000;
    const call = () =>
      guardLlmRoute({
        limiter,
        now: () => clock,
        authenticate: async () => TEACHER
      });

    expect((await call()).ok).toBe(true);
    expect((await call()).ok).toBe(false);

    clock += 60_001;
    expect((await call()).ok).toBe(true);
  });
});
