import { NextResponse } from "next/server";

import {
  mintRealtimeToken,
  realtimeTokenRequestSchema
} from "../../../lib/voice/token";

export async function POST(request: Request) {
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
