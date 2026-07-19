import { NextResponse } from "next/server";

import {
  AuthoredCoachInputError,
  generateAuthoredCoachResponse
} from "../../../lib/agent/authoredCoach";
import {
  AUTHORED_COACH_CONTRACT_VERSION,
  authoredCoachRequestSchema
} from "../../../lib/agent/authoredCoachSchemas";
import { generateCoachResponse } from "../../../lib/agent/coach";
import { coachRequestSchema } from "../../../lib/agent/schemas";

export const runtime = "nodejs";
export const maxDuration = 15;

function isAuthoredRequest(
  body: unknown
): body is { readonly contractVersion: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    "contractVersion" in body &&
    body.contractVersion === AUTHORED_COACH_CONTRACT_VERSION
  );
}

async function authoredResponse(body: unknown) {
  const parsed = authoredCoachRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        contractVersion: AUTHORED_COACH_CONTRACT_VERSION,
        error: {
          code: "coach.invalid_request.v2",
          message: "Authored Coach request failed validation.",
          fieldPaths: [
            ...new Set(
              parsed.error.issues.map(({ path }) => path.join(".") || "$")
            )
          ].slice(0, 64)
        }
      },
      { status: 400 }
    );
  }
  try {
    const model =
      process.env.OPENAI_MOCK_MODE === "1" ||
      process.env.NODE_ENV === "test" ||
      !process.env.OPENAI_API_KEY
        ? undefined
        : (
            await import("../../../lib/agent/authoredCoachOpenAi.server")
          ).createOpenAiAuthoredCoachModel();
    return NextResponse.json(
      await generateAuthoredCoachResponse(parsed.data, { model })
    );
  } catch (error) {
    if (error instanceof AuthoredCoachInputError) {
      return NextResponse.json(
        {
          ok: false,
          contractVersion: AUTHORED_COACH_CONTRACT_VERSION,
          error: {
            code: error.code,
            message: error.message,
            fieldPaths: error.fieldPaths
          }
        },
        { status: error.status }
      );
    }
    return NextResponse.json(
      {
        ok: false,
        contractVersion: AUTHORED_COACH_CONTRACT_VERSION,
        error: {
          code: "coach.invalid_request.v2",
          message: "Authored coaching could not be completed safely.",
          fieldPaths: ["$"]
        }
      },
      { status: 422 }
    );
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (isAuthoredRequest(body)) return authoredResponse(body);

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
