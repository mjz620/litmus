import { NextResponse } from "next/server";

import { evaluateReport } from "../../../lib/agent/evaluator";
import { evaluateRequestSchema } from "../../../lib/agent/evaluatorSchemas";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = evaluateRequestSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid evaluation request.", issues: parsed.error.issues },
      { status: 400 }
    );
  try {
    return NextResponse.json(await evaluateReport(parsed.data));
  } catch {
    return NextResponse.json(
      { error: "Evaluator unavailable." },
      { status: 503 }
    );
  }
}
