import { NextResponse } from "next/server";

import {
  AuthoredEvaluationInputError,
  evaluateAuthoredReport
} from "../../../lib/agent/authoredEvaluator";
import { evaluateReport } from "../../../lib/agent/evaluator";
import {
  AUTHORED_EVALUATOR_CONTRACT_VERSION,
  authoredEvaluateRequestSchema,
  evaluateRequestSchema
} from "../../../lib/agent/evaluatorSchemas";
import {
  LLM_ROUTE_LIMITERS,
  guardLlmRoute
} from "../../../lib/api/llmRouteGuard";

export const runtime = "nodejs";
export const maxDuration = 20;

function isAuthoredRequest(
  body: unknown
): body is { readonly contractVersion: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    "contractVersion" in body &&
    body.contractVersion === AUTHORED_EVALUATOR_CONTRACT_VERSION
  );
}

async function authoredResponse(body: unknown) {
  const parsed = authoredEvaluateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        contractVersion: AUTHORED_EVALUATOR_CONTRACT_VERSION,
        error: {
          code: "evaluator.invalid_request.v2",
          message: "Authored evaluation request failed validation.",
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
            await import("../../../lib/agent/authoredEvaluatorOpenAi.server")
          ).createOpenAiAuthoredEvaluatorModel();
    return NextResponse.json(
      await evaluateAuthoredReport(parsed.data, { model })
    );
  } catch (error) {
    if (error instanceof AuthoredEvaluationInputError) {
      return NextResponse.json(
        {
          ok: false,
          contractVersion: AUTHORED_EVALUATOR_CONTRACT_VERSION,
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
        contractVersion: AUTHORED_EVALUATOR_CONTRACT_VERSION,
        error: {
          code: "evaluator.invalid_request.v2",
          message: "Authored evaluation could not be completed safely.",
          fieldPaths: ["$"]
        }
      },
      { status: 422 }
    );
  }
}

export async function POST(request: Request) {
  // Reaches a paid model: authenticate and consume budget before reading a body.
  const guard = await guardLlmRoute({ limiter: LLM_ROUTE_LIMITERS.evaluate });
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (isAuthoredRequest(body)) return authoredResponse(body);
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
