import { NextResponse } from "next/server";

import { checkpointRequestSchema } from "../../../../lib/persistence/contracts";

/**
 * Checkpoint sink for the judge demo.
 *
 * The production route authenticates the student and writes through a
 * service-role client, so a signed-out evaluator gets a 401 and the bench
 * shows "Save failed" — a storage boundary reading as a broken lab. The demo
 * is a controlled environment with no accounts and nothing worth keeping after
 * the session, so this validates the payload and acknowledges it without
 * persisting. The in-memory session stays authoritative, exactly as it is for
 * guest practice.
 */
export function createDemoCheckpointHandler() {
  return async function demoCheckpointHandler(request: Request) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    // Still validated: the demo must fail on a malformed checkpoint the same
    // way production does, or it stops being a faithful rehearsal of the app.
    const parsed = checkpointRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid checkpoint request.", issues: parsed.error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      persisted: false,
      sessionId: parsed.data.sessionId
    });
  };
}

export async function POST(request: Request) {
  return createDemoCheckpointHandler()(request);
}
