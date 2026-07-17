import {
  labAuthoringErrorResponseSchema,
  type LabAuthoringErrorCode,
  type LabAuthoringErrorResponse
} from "./schemas";
import {
  LAB_AUTHORING_PROMPT_VERSION,
  LAB_AUTHORING_TOOL_CONTRACT_VERSION
} from "./prompt";

export class LabAuthoringError extends Error {
  readonly code: LabAuthoringErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly fieldPaths: readonly string[];

  constructor(options: {
    readonly code: LabAuthoringErrorCode;
    readonly message: string;
    readonly status: number;
    readonly retryable: boolean;
    readonly fieldPaths?: readonly string[];
  }) {
    super(options.message);
    this.name = "LabAuthoringError";
    this.code = options.code;
    this.status = options.status;
    this.retryable = options.retryable;
    this.fieldPaths = Object.freeze([...(options.fieldPaths ?? [])].sort());
  }
}

export function createLabAuthoringErrorResponse(
  error: LabAuthoringError
): LabAuthoringErrorResponse {
  return labAuthoringErrorResponseSchema.parse({
    ok: false,
    metadata: {
      promptVersion: LAB_AUTHORING_PROMPT_VERSION,
      toolContractVersion: LAB_AUTHORING_TOOL_CONTRACT_VERSION
    },
    error: {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      fieldPaths: error.fieldPaths
    }
  });
}

export function unavailableLabAuthoringError(): LabAuthoringError {
  return new LabAuthoringError({
    code: "authoring.model_unavailable.v1",
    message: "Lab authoring is temporarily unavailable.",
    status: 503,
    retryable: true
  });
}
