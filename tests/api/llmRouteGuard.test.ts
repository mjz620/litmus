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
    expect(result.principal?.userId).toBe(STUDENT.userId);
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

/*
 * Guest practice is a product commitment: a student can run a whole lab
 * without an account, and the coach is part of that lab. Requiring a session
 * on the coach route silently disabled coaching for every guest — the client
 * caught the 401 and showed canned text labelled as AI guidance.
 */
describe("guest access", () => {
  it("admits a signed-out caller when the route allows guests", async () => {
    const result = await guardLlmRoute({
      limiter: wideOpen(),
      allowGuests: true,
      guestKey: "203.0.113.10",
      authenticate: async () => null
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.principal).toBeNull();
  });

  it("still refuses signed-out callers when guests are not allowed", async () => {
    const result = await guardLlmRoute({
      limiter: wideOpen(),
      authenticate: async () => null
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(401);
  });

  it("budgets guests per address so one cannot exhaust another", async () => {
    const limiter = new FixedWindowRateLimiter(1, 60_000);
    const now = () => 1_000;
    const guest = (guestKey: string) =>
      guardLlmRoute({
        limiter,
        now,
        allowGuests: true,
        guestKey,
        authenticate: async () => null
      });

    expect((await guest("203.0.113.10")).ok).toBe(true);
    expect((await guest("203.0.113.10")).ok).toBe(false);
    expect((await guest("203.0.113.11")).ok).toBe(true);
  });

  it("keeps guest and signed-in budgets separate", async () => {
    const limiter = new FixedWindowRateLimiter(1, 60_000);
    const now = () => 1_000;

    const guest = await guardLlmRoute({
      limiter,
      now,
      allowGuests: true,
      guestKey: TEACHER.userId,
      authenticate: async () => null
    });
    const signedIn = await guardLlmRoute({
      limiter,
      now,
      allowGuests: true,
      authenticate: async () => TEACHER
    });

    expect(guest.ok).toBe(true);
    // A guest keyed on a string equal to a user id must not consume that user's budget.
    expect(signedIn.ok).toBe(true);
  });
});
