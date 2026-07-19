import { WORKFLOW_JUDGE_LIMITS } from "./schemas";

interface RateBucket {
  count: number;
  windowStartedAt: number;
}

export interface WorkflowJudgeRateLimitDecision {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
}

const buckets = new Map<string, RateBucket>();
const MAX_BUCKETS = 10_000;

function prune(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStartedAt >= WORKFLOW_JUDGE_LIMITS.rateLimitWindowMs)
      buckets.delete(key);
  }
  while (buckets.size > MAX_BUCKETS) {
    const oldest = buckets.keys().next().value as string | undefined;
    if (!oldest) break;
    buckets.delete(oldest);
  }
}

export function checkWorkflowJudgeRateLimit(
  key: string,
  now = Date.now()
): WorkflowJudgeRateLimitDecision {
  prune(now);
  const normalized = key.trim().slice(0, 240) || "anonymous";
  let bucket = buckets.get(normalized);
  if (
    !bucket ||
    now - bucket.windowStartedAt >= WORKFLOW_JUDGE_LIMITS.rateLimitWindowMs
  ) {
    bucket = { count: 0, windowStartedAt: now };
    buckets.set(normalized, bucket);
  }
  if (bucket.count >= WORKFLOW_JUDGE_LIMITS.rateLimitRequests) {
    return {
      allowed: false,
      limit: WORKFLOW_JUDGE_LIMITS.rateLimitRequests,
      remaining: 0,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil(
          (WORKFLOW_JUDGE_LIMITS.rateLimitWindowMs -
            (now - bucket.windowStartedAt)) /
            1_000
        )
      )
    };
  }
  bucket.count += 1;
  return {
    allowed: true,
    limit: WORKFLOW_JUDGE_LIMITS.rateLimitRequests,
    remaining: WORKFLOW_JUDGE_LIMITS.rateLimitRequests - bucket.count,
    retryAfterSeconds: 0
  };
}
