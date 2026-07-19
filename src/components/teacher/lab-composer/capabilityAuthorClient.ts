import {
  capabilityAuthorErrorResponseSchema,
  capabilityAuthorStreamEventSchema,
  capabilityAuthorSuccessResponseSchema,
  type CapabilityAuthorErrorResponse,
  type CapabilityAuthorProgress,
  type CapabilityAuthorRequest,
  type CapabilityAuthorSuccessResponse
} from "../../../lib/agent/lab-authoring/capabilityAuthorSchemas";

export class CapabilityAuthorClientError extends Error {
  readonly retryable: boolean;
  readonly code: CapabilityAuthorErrorResponse["error"]["code"] | null;

  constructor(
    message: string,
    options: {
      readonly retryable?: boolean;
      readonly code?: CapabilityAuthorErrorResponse["error"]["code"];
    } = {}
  ) {
    super(message);
    this.name = "CapabilityAuthorClientError";
    this.retryable = options.retryable ?? false;
    this.code = options.code ?? null;
  }
}

export type CapabilityAuthorFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

function errorFromResponse(
  failure: CapabilityAuthorErrorResponse
): CapabilityAuthorClientError {
  return new CapabilityAuthorClientError(failure.error.message, {
    retryable: failure.error.retryable,
    code: failure.error.code
  });
}

async function readProgressStream(
  response: Response,
  onProgress: ((progress: CapabilityAuthorProgress) => void) | undefined
): Promise<CapabilityAuthorSuccessResponse> {
  if (!response.body) {
    throw new CapabilityAuthorClientError(
      "The draft helper returned an unreadable response. Your current lab was not changed.",
      { retryable: true }
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  let result: CapabilityAuthorSuccessResponse | null = null;

  const readLine = (line: string): void => {
    if (!line.trim()) return;
    let decoded: unknown;
    try {
      decoded = JSON.parse(line) as unknown;
    } catch {
      throw new CapabilityAuthorClientError(
        "The draft helper returned an unreadable progress update. Your current lab was not changed.",
        { retryable: true }
      );
    }
    const event = capabilityAuthorStreamEventSchema.safeParse(decoded);
    if (!event.success) {
      throw new CapabilityAuthorClientError(
        "The draft helper returned an unexpected progress update. Your current lab was not changed.",
        { retryable: true }
      );
    }
    if (event.data.type === "progress") {
      onProgress?.(event.data.progress);
    } else if (event.data.type === "result") {
      result = event.data.result;
    } else {
      throw errorFromResponse(event.data.error);
    }
  };

  while (true) {
    const chunk = await reader.read();
    buffered += decoder.decode(chunk.value, { stream: !chunk.done });
    const lines = buffered.split("\n");
    buffered = lines.pop() ?? "";
    lines.forEach(readLine);
    if (chunk.done) break;
  }
  readLine(buffered);

  if (result) return result;
  throw new CapabilityAuthorClientError(
    "The draft helper stopped before finishing. Your current lab was not changed.",
    { retryable: true }
  );
}

export async function requestCapabilityAuthorProposal(
  request: CapabilityAuthorRequest,
  fetcher: CapabilityAuthorFetch = fetch,
  onProgress?: (progress: CapabilityAuthorProgress) => void
): Promise<CapabilityAuthorSuccessResponse> {
  let response: Response;
  try {
    response = await fetcher("/api/lab-composer/author/capability", {
      method: "POST",
      headers: {
        accept: "application/x-ndjson",
        "content-type": "application/json"
      },
      body: JSON.stringify(request)
    });
  } catch {
    throw new CapabilityAuthorClientError(
      "The draft helper could not be reached. Your current lab was not changed.",
      { retryable: true }
    );
  }

  if (response.headers.get("content-type")?.includes("application/x-ndjson")) {
    return readProgressStream(response, onProgress);
  }

  let body: unknown;
  try {
    body = (await response.json()) as unknown;
  } catch {
    throw new CapabilityAuthorClientError(
      "The draft helper returned an unreadable response. Your current lab was not changed.",
      { retryable: response.status >= 500 }
    );
  }

  const success = capabilityAuthorSuccessResponseSchema.safeParse(body);
  if (response.ok && success.success) return success.data;

  const failure = capabilityAuthorErrorResponseSchema.safeParse(body);
  if (failure.success) {
    throw errorFromResponse(failure.data);
  }

  throw new CapabilityAuthorClientError(
    "The draft helper returned an unexpected response. Your current lab was not changed.",
    { retryable: response.status >= 500 }
  );
}
