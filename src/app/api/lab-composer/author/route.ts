import { NextResponse } from "next/server";

import { generateLabAuthoringResponse } from "../../../../lib/agent/lab-authoring/author";
import {
  LabAuthoringError,
  createLabAuthoringErrorResponse,
  unavailableLabAuthoringError
} from "../../../../lib/agent/lab-authoring/errors";
import { checkLabAuthoringRateLimit } from "../../../../lib/agent/lab-authoring/rateLimit";
import {
  LAB_AUTHORING_LIMITS,
  labAuthoringRequestSchema
} from "../../../../lib/agent/lab-authoring/schemas";

export const runtime = "nodejs";
export const maxDuration = 30;

function requesterKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0];
  return (
    forwarded?.trim() || request.headers.get("x-real-ip")?.trim() || "anonymous"
  );
}

function errorResponse(error: LabAuthoringError, extraHeaders?: HeadersInit) {
  return NextResponse.json(createLabAuthoringErrorResponse(error), {
    status: error.status,
    headers: extraHeaders
  });
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > LAB_AUTHORING_LIMITS.requestBytes
  ) {
    throw new LabAuthoringError({
      code: "authoring.request_too_large.v1",
      message: "Lab authoring request exceeds the body-size limit.",
      status: 413,
      retryable: false
    });
  }

  const text = await request.text();
  if (
    new TextEncoder().encode(text).byteLength >
    LAB_AUTHORING_LIMITS.requestBytes
  ) {
    throw new LabAuthoringError({
      code: "authoring.request_too_large.v1",
      message: "Lab authoring request exceeds the body-size limit.",
      status: 413,
      retryable: false
    });
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new LabAuthoringError({
      code: "authoring.invalid_json.v1",
      message: "Lab authoring request must contain valid JSON.",
      status: 400,
      retryable: false
    });
  }
}

export async function POST(request: Request) {
  const rateLimit = checkLabAuthoringRateLimit(requesterKey(request));
  const rateHeaders = {
    "X-RateLimit-Limit": String(rateLimit.limit),
    "X-RateLimit-Remaining": String(rateLimit.remaining)
  };
  if (!rateLimit.allowed) {
    return errorResponse(
      new LabAuthoringError({
        code: "authoring.rate_limited.v1",
        message: "Too many lab authoring requests. Try again shortly.",
        status: 429,
        retryable: true
      }),
      {
        ...rateHeaders,
        "Retry-After": String(rateLimit.retryAfterSeconds)
      }
    );
  }

  try {
    const parsed = labAuthoringRequestSchema.safeParse(
      await readBoundedJson(request)
    );
    if (!parsed.success) {
      const fieldPaths = [
        ...new Set(
          parsed.error.issues.flatMap((issue) =>
            issue.code === "unrecognized_keys"
              ? issue.keys.map((key) => [...issue.path, key].join("."))
              : [issue.path.join(".") || "$"]
          )
        )
      ].sort();
      throw new LabAuthoringError({
        code: "authoring.invalid_request.v1",
        message: "Lab authoring request failed validation.",
        status: 400,
        retryable: false,
        fieldPaths
      });
    }

    return NextResponse.json(await generateLabAuthoringResponse(parsed.data), {
      headers: rateHeaders
    });
  } catch (error) {
    return errorResponse(
      error instanceof LabAuthoringError
        ? error
        : unavailableLabAuthoringError(),
      rateHeaders
    );
  }
}
