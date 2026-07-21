import { createWorkflowJudgeHandler } from "../../../lab-composer/judge/route";
import { guestKeyFromRequest } from "../../../../../lib/api/llmRouteGuard";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Workflow Judge for the judge demo. Production is teacher-only because the
 * Composer is a teacher tool and its budget is keyed per user; an evaluator
 * has no account, and the author → check → review loop is the thing the demo
 * exists to show. Guests are admitted here and rate-limited by address on a
 * separate bucket from signed-in teachers. Judging itself is unchanged, and
 * the judge still cannot approve a simulation or turn on Preview.
 */
export async function POST(request: Request) {
  return createWorkflowJudgeHandler({
    allowGuests: true,
    guestKey: guestKeyFromRequest
  })(request);
}
