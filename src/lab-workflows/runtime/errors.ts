export const LAB_WORKFLOW_RUNTIME_ERROR_CODES = Object.freeze({
  workflowIneligible: "runtime.workflow_ineligible.v1",
  invalidOptions: "runtime.invalid_options.v1",
  adapterNotFound: "runtime.adapter_not_found.v1",
  adapterContractMismatch: "runtime.adapter_contract_mismatch.v1",
  stepMismatch: "runtime.step_mismatch.v1",
  workflowComplete: "runtime.workflow_complete.v1",
  actionNotAllowed: "runtime.action_not_allowed.v1",
  actionAttemptLimitExceeded: "runtime.action_attempt_limit_exceeded.v1",
  actionParameterInvalid: "runtime.action_parameter_invalid.v1",
  engineActionRejected: "runtime.engine_action_rejected.v1"
} as const);

export type LabWorkflowRuntimeErrorCode =
  (typeof LAB_WORKFLOW_RUNTIME_ERROR_CODES)[keyof typeof LAB_WORKFLOW_RUNTIME_ERROR_CODES];

export type LabWorkflowRuntimeErrorDetail =
  | boolean
  | number
  | string
  | readonly string[];

/** Stable, serializable failure raised by the deterministic runtime boundary. */
export class LabWorkflowRuntimeError extends Error {
  readonly code: LabWorkflowRuntimeErrorCode;
  readonly details: Readonly<Record<string, LabWorkflowRuntimeErrorDetail>>;

  constructor(
    code: LabWorkflowRuntimeErrorCode,
    message: string,
    details: Readonly<Record<string, LabWorkflowRuntimeErrorDetail>> = {}
  ) {
    super(message);
    this.name = "LabWorkflowRuntimeError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}
