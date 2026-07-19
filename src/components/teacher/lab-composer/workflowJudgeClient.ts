import {
  workflowJudgeErrorResponseSchema,
  workflowJudgeResponseSchema,
  type WorkflowJudgeErrorResponse,
  type WorkflowJudgeRequest,
  type WorkflowJudgeResponse
} from "../../../lib/agent/lab-workflow-judge/schemas";

export const COMPOSER_JUDGE_REQUEST_TIMEOUT_MS = 20_000;

export class WorkflowJudgeClientError extends Error {
  constructor(
    message: string,
    readonly code: WorkflowJudgeErrorResponse["error"]["code"] | null = null,
    readonly retryable = false
  ) {
    super(message);
    this.name = "WorkflowJudgeClientError";
  }
}

export type WorkflowJudgeFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export async function requestWorkflowJudgeReview(
  request: WorkflowJudgeRequest,
  fetcher: WorkflowJudgeFetch = fetch,
  timeoutMs = COMPOSER_JUDGE_REQUEST_TIMEOUT_MS
): Promise<WorkflowJudgeResponse> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetcher("/api/lab-composer/judge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal
    });
  } catch (error) {
    throw new WorkflowJudgeClientError(
      error instanceof DOMException && error.name === "AbortError"
        ? "The teaching review reached its fixed time limit. Your draft was not changed."
        : "The teaching review could not be reached. Your draft was not changed.",
      null,
      true
    );
  } finally {
    globalThis.clearTimeout(timer);
  }

  let body: unknown;
  try {
    body = (await response.json()) as unknown;
  } catch {
    throw new WorkflowJudgeClientError(
      "The teaching review returned an unreadable response. Your draft was not changed.",
      null,
      response.status >= 500
    );
  }
  const success = workflowJudgeResponseSchema.safeParse(body);
  if (response.ok && success.success) return success.data;
  const failure = workflowJudgeErrorResponseSchema.safeParse(body);
  if (failure.success) {
    throw new WorkflowJudgeClientError(
      failure.data.error.message,
      failure.data.error.code,
      failure.data.error.retryable
    );
  }
  throw new WorkflowJudgeClientError(
    "The teaching review returned an unexpected response. Your draft was not changed.",
    null,
    response.status >= 500
  );
}
