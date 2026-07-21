import { createCapabilityAuthorHandler } from "../../../../lab-composer/author/capability/route";
import { guestKeyFromRequest } from "../../../../../../lib/api/llmRouteGuard";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Capability authoring for the judge demo. Production is teacher-only because
 * the Composer is a teacher tool budgeted per user; an evaluator has no
 * account, and "describe a lab and watch it get built and checked" is the
 * demo's central claim. Guests are admitted here on an address-keyed budget
 * separate from signed-in teachers. Every registry, safety, and simulation
 * check the production authoring path runs still applies.
 */
export async function POST(request: Request) {
  return createCapabilityAuthorHandler({
    allowGuests: true,
    guestKey: guestKeyFromRequest
  })(request);
}
