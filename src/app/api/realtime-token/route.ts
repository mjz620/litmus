import { NextResponse } from "next/server";

import {
  LLM_ROUTE_LIMITERS,
  guardLlmRoute
} from "../../../lib/api/llmRouteGuard";
import {
  mintRealtimeToken,
  realtimeTokenRequestSchema
} from "../../../lib/voice/token";

export async function POST(request: Request) {
  /*
   * Mints a realtime session token against the project's OpenAI account. This
   * was previously unauthenticated, which handed anonymous callers a usable
   * voice session on the project's billing.
   */
  const guard = await guardLlmRoute({
    limiter: LLM_ROUTE_LIMITERS.realtimeToken
  });
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = realtimeTokenRequestSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid voice session." },
      { status: 400 }
    );
  try {
    return NextResponse.json(await mintRealtimeToken(parsed.data.sessionId));
  } catch {
    return NextResponse.json(
      { error: "Voice session unavailable." },
      { status: 503 }
    );
  }
}
