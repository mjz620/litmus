import { NextResponse } from "next/server";

import {
  createWorkflowJudgeErrorResponse,
  judgeLabWorkflow,
  WorkflowJudgeInputError
} from "../../../../lib/agent/lab-workflow-judge/judge";
import { checkWorkflowJudgeRateLimit } from "../../../../lib/agent/lab-workflow-judge/rateLimit";
import {
  WORKFLOW_JUDGE_LIMITS,
  workflowJudgeRequestSchema
} from "../../../../lib/agent/lab-workflow-judge/schemas";

export const runtime = "nodejs";
export const maxDuration = 30;

function requesterKey(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "anonymous"
  );
}

function errorResponse(error: WorkflowJudgeInputError, headers?: HeadersInit) {
  return NextResponse.json(createWorkflowJudgeErrorResponse(error), {
    status: error.status,
    headers
  });
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > WORKFLOW_JUDGE_LIMITS.requestBytes
  ) {
    throw new WorkflowJudgeInputError(
      "judge.request_too_large.v2",
      "Workflow Judge request exceeds the body-size limit.",
      ["$"],
      413
    );
  }
  const text = await request.text();
  if (
    new TextEncoder().encode(text).byteLength >
    WORKFLOW_JUDGE_LIMITS.requestBytes
  ) {
    throw new WorkflowJudgeInputError(
      "judge.request_too_large.v2",
      "Workflow Judge request exceeds the body-size limit.",
      ["$"],
      413
    );
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new WorkflowJudgeInputError(
      "judge.invalid_json.v2",
      "Workflow Judge request must contain valid JSON.",
      ["$"],
      400
    );
  }
}

async function review(input: unknown) {
  const parsed = workflowJudgeRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new WorkflowJudgeInputError(
      "judge.invalid_request.v2",
      "Workflow Judge request failed strict validation.",
      parsed.error.issues.map(({ path }) => path.join(".") || "$"),
      400
    );
  }
  if (
    process.env.OPENAI_MOCK_MODE === "1" ||
    process.env.NODE_ENV === "test" ||
    !process.env.OPENAI_API_KEY
  ) {
    return judgeLabWorkflow(parsed.data);
  }
  const { createOpenAiWorkflowJudgeModel } =
    await import("../../../../lib/agent/lab-workflow-judge/openAi.server");
  return judgeLabWorkflow(parsed.data, {
    model: createOpenAiWorkflowJudgeModel()
  });
}

export async function POST(request: Request) {
  const rate = checkWorkflowJudgeRateLimit(requesterKey(request));
  const rateHeaders = {
    "X-RateLimit-Limit": String(rate.limit),
    "X-RateLimit-Remaining": String(rate.remaining)
  };
  if (!rate.allowed) {
    return errorResponse(
      new WorkflowJudgeInputError(
        "judge.rate_limited.v2",
        "Too many Workflow Judge requests. Try again shortly.",
        ["$"],
        429,
        true
      ),
      { ...rateHeaders, "Retry-After": String(rate.retryAfterSeconds) }
    );
  }
  try {
    return NextResponse.json(await review(await readBoundedJson(request)), {
      headers: rateHeaders
    });
  } catch (error) {
    return errorResponse(
      error instanceof WorkflowJudgeInputError
        ? error
        : new WorkflowJudgeInputError(
            "judge.internal_failure.v2",
            "Workflow Judge is temporarily unavailable.",
            ["$"],
            503,
            true
          ),
      rateHeaders
    );
  }
}
