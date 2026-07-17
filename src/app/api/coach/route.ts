import { NextResponse } from "next/server";

import { generateCoachResponse } from "../../../lib/agent/coach";
import { coachRequestSchema } from "../../../lib/agent/schemas";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = coachRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid coach request.", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(await generateCoachResponse(parsed.data));
  } catch {
    return NextResponse.json(
      { error: "Coach response unavailable." },
      { status: 503 }
    );
  }
}
