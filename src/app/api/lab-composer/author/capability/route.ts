import { NextResponse } from "next/server";

import {
  CapabilityAuthoringError,
  createCapabilityAuthoringErrorResponse,
  runCapabilityAuthoring,
  runCapabilityAuthoringWithDeterministicFallback
} from "../../../../../lib/agent/lab-authoring/capabilityAuthor";
import {
  CAPABILITY_AUTHOR_LIMITS,
  capabilityAuthorRequestSchema,
  type CapabilityAuthorProgress,
  type CapabilityAuthorRequest,
  type CapabilityAuthorStreamEvent
} from "../../../../../lib/agent/lab-authoring/capabilityAuthorSchemas";
import { checkCapabilityAuthorRateLimit } from "../../../../../lib/agent/lab-authoring/capabilityRateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const CAPABILITY_AUTHOR_STREAM_TYPE = "application/x-ndjson";

function requesterKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0];
  return (
    forwarded?.trim() || request.headers.get("x-real-ip")?.trim() || "anonymous"
  );
}

function errorResponse(
  error: CapabilityAuthoringError,
  extraHeaders?: HeadersInit
) {
  return NextResponse.json(createCapabilityAuthoringErrorResponse(error), {
    status: error.status,
    headers: extraHeaders
  });
}

async function readBoundedJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > CAPABILITY_AUTHOR_LIMITS.requestBytes
  ) {
    throw new CapabilityAuthoringError(
      "authoring.request_too_large.v2",
      "Capability authoring request exceeds the body-size limit.",
      413,
      false
    );
  }
  const text = await request.text();
  if (
    new TextEncoder().encode(text).byteLength >
    CAPABILITY_AUTHOR_LIMITS.requestBytes
  ) {
    throw new CapabilityAuthoringError(
      "authoring.request_too_large.v2",
      "Capability authoring request exceeds the body-size limit.",
      413,
      false
    );
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new CapabilityAuthoringError(
      "authoring.invalid_json.v2",
      "Capability authoring request must contain valid JSON.",
      400,
      false
    );
  }
}

async function generate(
  request: CapabilityAuthorRequest,
  onProgress?: (progress: CapabilityAuthorProgress) => void
) {
  if (
    process.env.OPENAI_MOCK_MODE === "1" ||
    process.env.NODE_ENV === "test" ||
    !process.env.OPENAI_API_KEY
  ) {
    return runCapabilityAuthoring(request, { onProgress });
  }
  const { createOpenAiCapabilityAuthorPlanner } =
    await import("../../../../../lib/agent/lab-authoring/capabilityOpenAi.server");
  return runCapabilityAuthoringWithDeterministicFallback(request, {
    planner: createOpenAiCapabilityAuthorPlanner(),
    onProgress
  });
}

function publicError(error: unknown): CapabilityAuthoringError {
  return error instanceof CapabilityAuthoringError
    ? error
    : new CapabilityAuthoringError(
        "authoring.model_unavailable.v2",
        "Capability authoring is temporarily unavailable.",
        503,
        true
      );
}

function streamedGeneration(
  request: CapabilityAuthorRequest,
  headers: HeadersInit
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (event: CapabilityAuthorStreamEvent): void => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          closed = true;
        }
      };

      void generate(request, (progress) => send({ type: "progress", progress }))
        .then((result) => send({ type: "result", result }))
        .catch((error: unknown) =>
          send({
            type: "error",
            error: createCapabilityAuthoringErrorResponse(publicError(error))
          })
        )
        .finally(() => {
          if (closed) return;
          closed = true;
          controller.close();
        });
    }
  });

  return new Response(stream, {
    headers: {
      ...headers,
      "Cache-Control": "no-store",
      "Content-Type": `${CAPABILITY_AUTHOR_STREAM_TYPE}; charset=utf-8`,
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export async function POST(request: Request) {
  const rateLimit = checkCapabilityAuthorRateLimit(requesterKey(request));
  const rateHeaders = {
    "X-RateLimit-Limit": String(rateLimit.limit),
    "X-RateLimit-Remaining": String(rateLimit.remaining)
  };
  if (!rateLimit.allowed) {
    return errorResponse(
      new CapabilityAuthoringError(
        "authoring.rate_limited.v2",
        "Too many capability authoring requests. Try again shortly.",
        429,
        true
      ),
      {
        ...rateHeaders,
        "Retry-After": String(rateLimit.retryAfterSeconds)
      }
    );
  }

  try {
    const parsed = capabilityAuthorRequestSchema.safeParse(
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
      throw new CapabilityAuthoringError(
        "authoring.invalid_request.v2",
        "Capability authoring request failed validation.",
        400,
        false,
        fieldPaths
      );
    }
    if (
      request.headers.get("accept")?.includes(CAPABILITY_AUTHOR_STREAM_TYPE)
    ) {
      return streamedGeneration(parsed.data, rateHeaders);
    }
    return NextResponse.json(await generate(parsed.data), {
      headers: rateHeaders
    });
  } catch (error) {
    return errorResponse(publicError(error), rateHeaders);
  }
}
