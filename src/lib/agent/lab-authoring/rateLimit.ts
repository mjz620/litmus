import { LAB_AUTHORING_LIMITS } from "./schemas";

interface RateBucket {
  count: number;
  windowStartedAt: number;
}

export interface LabAuthoringRateLimitDecision {
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
      LAB_AUTHORING_LIMITS.rateLimitWindowMs
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

/** Process-local guard; deployed gateways may layer a distributed limiter above it. */
export function checkLabAuthoringRateLimit(
  key: string,
  now = Date.now()
): LabAuthoringRateLimitDecision {
  removeExpiredBuckets(now);
  const normalizedKey = key.trim().slice(0, 240) || "anonymous";
  let bucket = buckets.get(normalizedKey);
  if (
    !bucket ||
    now - bucket.windowStartedAt >= LAB_AUTHORING_LIMITS.rateLimitWindowMs
  ) {
    bucket = { count: 0, windowStartedAt: now };
    buckets.set(normalizedKey, bucket);
  }

  if (bucket.count >= LAB_AUTHORING_LIMITS.rateLimitRequests) {
    return Object.freeze({
      allowed: false,
      limit: LAB_AUTHORING_LIMITS.rateLimitRequests,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil(
          (LAB_AUTHORING_LIMITS.rateLimitWindowMs -
            (now - bucket.windowStartedAt)) /
            1_000
        )
      )
    });
  }

  bucket.count += 1;
  return Object.freeze({
    allowed: true,
    limit: LAB_AUTHORING_LIMITS.rateLimitRequests,
    remaining: LAB_AUTHORING_LIMITS.rateLimitRequests - bucket.count,
    retryAfterSeconds: 0
  });
}
