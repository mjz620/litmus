import { NextResponse } from "next/server";

import {
  authenticateComposerPrincipal,
  type ComposerAuthPrincipal
} from "../persistence/labDefinitionApi";

/**
 * Shared authentication and rate limiting for routes that reach a paid model.
 *
 * These routes were previously open to the internet: anyone who found the URL
 * could spend the project's model budget, and `realtime-token` would mint
 * realtime session tokens to anonymous callers. Authentication runs before any
 * request body is read, so an unauthenticated flood costs a 401 and nothing
 * else.
 *
 * The limiter is a fixed window held in process memory. On serverless hosting
 * each instance keeps its own counters, so the effective ceiling is
 * `limit × instances` rather than a hard global bound — this is a real
 * mitigation, not a guarantee. Swap `RateLimiter` for a shared store (Redis,
 * Upstash, or a Postgres table) when a hard cap is needed.
 */
export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
}

export interface RateLimiter {
  check(key: string, nowMs: number): RateLimitDecision;
}

interface RateBucket {
  count: number;
  windowStartedAt: number;
}

/** Bounds memory if a caller generates many distinct keys. */
const MAX_BUCKETS = 10_000;

export class FixedWindowRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, RateBucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number
  ) {}

  check(key: string, nowMs: number): RateLimitDecision {
    this.evictExpired(nowMs);
    const normalized = key.trim().slice(0, 240) || "anonymous";
    let bucket = this.buckets.get(normalized);
    if (!bucket || nowMs - bucket.windowStartedAt >= this.windowMs) {
      bucket = { count: 0, windowStartedAt: nowMs };
      this.buckets.set(normalized, bucket);
    }
    if (bucket.count >= this.limit) {
      return Object.freeze({
        allowed: false,
        limit: this.limit,
        remaining: 0,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((this.windowMs - (nowMs - bucket.windowStartedAt)) / 1_000)
        )
      });
    }
    bucket.count += 1;
    return Object.freeze({
      allowed: true,
      limit: this.limit,
      remaining: this.limit - bucket.count,
      retryAfterSeconds: 0
    });
  }

  private evictExpired(nowMs: number): void {
    for (const [key, bucket] of this.buckets) {
      if (nowMs - bucket.windowStartedAt >= this.windowMs) {
        this.buckets.delete(key);
      }
    }
    while (this.buckets.size > MAX_BUCKETS) {
      const oldest = this.buckets.keys().next().value as string | undefined;
      if (!oldest) break;
      this.buckets.delete(oldest);
    }
  }
}

export interface LlmRouteGuardOptions {
  readonly limiter: RateLimiter;
  /** Restrict to teachers. Composer authoring and judging are teacher tools. */
  readonly requireRole?: ComposerAuthPrincipal["role"];
  readonly authenticate?: () => Promise<ComposerAuthPrincipal | null>;
  readonly now?: () => number;
  /*
   * Allow signed-out callers, budgeted by address instead of by user.
   *
   * Guest practice is a product commitment, not an edge case — a student can
   * run a whole lab without an account, and the coach is part of that lab.
   * Requiring a session here silently disabled coaching for every guest, so
   * routes that guests legitimately reach opt in and accept an address-keyed
   * budget for them. Signed-in callers keep their own per-user budget.
   */
  readonly allowGuests?: boolean;
  /** Address-derived key for guest budgeting; ignored when allowGuests is off. */
  readonly guestKey?: string | null;
}

export type LlmRouteGuardResult =
  | {
      readonly ok: true;
      /** Null for an admitted guest on a route that allows them. */
      readonly principal: ComposerAuthPrincipal | null;
    }
  | { readonly ok: false; readonly response: NextResponse };

/** Best-effort caller address for guest budgeting. */
export function guestKeyFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0];
  return (
    forwarded?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "guest-unknown"
  );
}

function rateLimitHeaders(decision: RateLimitDecision): Record<string, string> {
  return {
    "RateLimit-Limit": String(decision.limit),
    "RateLimit-Remaining": String(decision.remaining),
    ...(decision.allowed
      ? {}
      : { "Retry-After": String(decision.retryAfterSeconds) })
  };
}

/**
 * Authenticate the caller and consume one unit of their rate budget.
 *
 * Returns the principal on success, or a ready-to-return error response.
 * The budget is keyed by user id rather than by IP so one signed-in account
 * cannot exhaust the budget from many addresses, and so users behind a shared
 * school NAT are not limited as a single caller — which matters here, since a
 * whole class sits behind one address.
 */
export async function guardLlmRoute(
  options: LlmRouteGuardOptions
): Promise<LlmRouteGuardResult> {
  const authenticate = options.authenticate ?? authenticateComposerPrincipal;
  const now = options.now ?? Date.now;

  let principal: ComposerAuthPrincipal | null;
  try {
    principal = await authenticate();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Authentication is unavailable." },
        { status: 503 }
      )
    };
  }

  if (!principal) {
    if (!options.allowGuests) {
      return {
        ok: false,
        response: NextResponse.json(
          { ok: false, error: "Authentication required." },
          { status: 401 }
        )
      };
    }
    // Guests share a budget per address rather than per account.
    const guestDecision = options.limiter.check(
      `guest:${options.guestKey ?? "guest-unknown"}`,
      now()
    );
    if (!guestDecision.allowed) {
      return {
        ok: false,
        response: NextResponse.json(
          { ok: false, error: "Rate limit exceeded. Try again shortly." },
          { status: 429, headers: rateLimitHeaders(guestDecision) }
        )
      };
    }
    return { ok: true, principal: null };
  }

  if (options.requireRole && principal.role !== options.requireRole) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Teacher access required." },
        { status: 403 }
      )
    };
  }

  const decision = options.limiter.check(principal.userId, now());
  if (!decision.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Rate limit exceeded. Try again shortly." },
        { status: 429, headers: rateLimitHeaders(decision) }
      )
    };
  }

  return { ok: true, principal };
}

const MINUTE_MS = 60_000;

/**
 * Per-user, per-minute budgets. Interactive coaching is called throughout a
 * lab session, so it gets the widest budget; authoring and judging run long
 * model calls and get tighter ones.
 */
export const LLM_ROUTE_LIMITERS = Object.freeze({
  coach: new FixedWindowRateLimiter(30, MINUTE_MS),
  evaluate: new FixedWindowRateLimiter(10, MINUTE_MS),
  realtimeToken: new FixedWindowRateLimiter(5, MINUTE_MS),
  author: new FixedWindowRateLimiter(10, MINUTE_MS),
  judge: new FixedWindowRateLimiter(10, MINUTE_MS)
});

/**
 * Separate budgets for the judge demo's mirrored endpoints. Distinct limiter
 * instances are the point: an evaluator working through the demo and a
 * classroom mid-lab draw from different allowances, so neither can rate-limit
 * the other.
 */
export const DEMO_ROUTE_LIMITERS = Object.freeze({
  coach: new FixedWindowRateLimiter(30, MINUTE_MS),
  evaluate: new FixedWindowRateLimiter(10, MINUTE_MS)
});
