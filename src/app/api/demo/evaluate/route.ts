import { createEvaluateHandler } from "../../evaluate/route";
import {
  DEMO_ROUTE_LIMITERS,
  guestKeyFromRequest
} from "../../../../lib/api/llmRouteGuard";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Report evaluation for the judge demo. Production requires a signed-in
 * student because a graded report belongs to someone; an evaluator has no
 * account, so the demo admits guests on its own budget and rate-limits them by
 * address. Scoring itself is the production evaluator, unchanged.
 */
export async function POST(request: Request) {
  return createEvaluateHandler({
    limiter: DEMO_ROUTE_LIMITERS.evaluate,
    allowGuests: true,
    guestKey: guestKeyFromRequest(request)
  })(request);
}
