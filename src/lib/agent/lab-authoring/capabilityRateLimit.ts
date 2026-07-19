import { CAPABILITY_AUTHOR_LIMITS } from "./capabilityAuthorSchemas";

interface RateBucket {
  count: number;
  windowStartedAt: number;
}

export interface CapabilityAuthorRateLimitDecision {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
}

const buckets = new Map<string, RateBucket>();
const MAX_BUCKETS = 10_000;

function removeExpiredBuckets(now: number): void {
  for (const [key, bucket] of buckets) {
    if (
      now - bucket.windowStartedAt >=
      CAPABILITY_AUTHOR_LIMITS.rateLimitWindowMs
    ) {
      buckets.delete(key);
    }
  }
  while (buckets.size > MAX_BUCKETS) {
    const oldestKey = buckets.keys().next().value as string | undefined;
    if (!oldestKey) break;
    buckets.delete(oldestKey);
  }
}

export function checkCapabilityAuthorRateLimit(
  key: string,
  now = Date.now()
): CapabilityAuthorRateLimitDecision {
  removeExpiredBuckets(now);
  const normalizedKey = key.trim().slice(0, 240) || "anonymous";
  let bucket = buckets.get(normalizedKey);
  if (
    !bucket ||
    now - bucket.windowStartedAt >= CAPABILITY_AUTHOR_LIMITS.rateLimitWindowMs
  ) {
    bucket = { count: 0, windowStartedAt: now };
    buckets.set(normalizedKey, bucket);
  }
  if (bucket.count >= CAPABILITY_AUTHOR_LIMITS.rateLimitRequests) {
    return Object.freeze({
      allowed: false,
      limit: CAPABILITY_AUTHOR_LIMITS.rateLimitRequests,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil(
          (CAPABILITY_AUTHOR_LIMITS.rateLimitWindowMs -
            (now - bucket.windowStartedAt)) /
            1_000
        )
      )
    });
  }
  bucket.count += 1;
  return Object.freeze({
    allowed: true,
    limit: CAPABILITY_AUTHOR_LIMITS.rateLimitRequests,
    remaining: CAPABILITY_AUTHOR_LIMITS.rateLimitRequests - bucket.count,
    retryAfterSeconds: 0
  });
}
