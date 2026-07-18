export const LAB_TRACE_ERROR_CODES = Object.freeze({
  schemaInvalid: "lab_trace.schema_invalid.v1",
  provenanceMismatch: "lab_trace.provenance_mismatch.v1",
  replayRejected: "lab_trace.replay_rejected.v1",
  suiteCaseInvalid: "lab_trace.suite_case_invalid.v1"
} as const);

export type LabTraceErrorCode =
  (typeof LAB_TRACE_ERROR_CODES)[keyof typeof LAB_TRACE_ERROR_CODES];

export class LabTraceError extends Error {
  readonly code: LabTraceErrorCode;
  readonly details: Readonly<Record<string, string>>;

  constructor(
    code: LabTraceErrorCode,
    message: string,
    details: Readonly<Record<string, string>> = {}
  ) {
    super(message);
    this.name = "LabTraceError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}
