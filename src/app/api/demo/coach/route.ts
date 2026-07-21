import { createCoachHandler } from "../../coach/route";
import { DEMO_ROUTE_LIMITERS } from "../../../../lib/api/llmRouteGuard";

export const runtime = "nodejs";
export const maxDuration = 15;

/**
 * Coach for the judge demo. Same handler and same authored contract as the
 * student coach — the demo must rehearse the real product, not a scripted
 * stand-in — but on a demo-only budget so exploration here cannot exhaust the
 * allowance real classrooms depend on.
 */
export async function POST(request: Request) {
  return createCoachHandler(DEMO_ROUTE_LIMITERS.coach)(request);
}
