export const GENERIC_LAB_RUNTIME_ERROR_CODES = Object.freeze({
  workflowIneligible: "generic-runtime.workflow_ineligible.v1",
  invalidConfig: "generic-runtime.invalid_config.v1",
  invalidState: "generic-runtime.invalid_state.v1",
  invalidAction: "generic-runtime.invalid_action.v1",
  permissionUnavailable: "generic-runtime.permission_unavailable.v1",
  permissionMismatch: "generic-runtime.permission_mismatch.v1",
  capabilityMismatch: "generic-runtime.capability_mismatch.v1",
  parameterInvalid: "generic-runtime.parameter_invalid.v1",
  attemptLimitExceeded: "generic-runtime.attempt_limit_exceeded.v1",
  preconditionFailed: "generic-runtime.precondition_failed.v1",
  safetyRejected: "generic-runtime.safety_rejected.v1",
  portUnavailable: "generic-runtime.port_unavailable.v1",
  portContractMismatch: "generic-runtime.port_contract_mismatch.v1",
  transitionRejected: "generic-runtime.transition_rejected.v1"
} as const);

export type GenericLabRuntimeErrorCode =
  (typeof GENERIC_LAB_RUNTIME_ERROR_CODES)[keyof typeof GENERIC_LAB_RUNTIME_ERROR_CODES];

export type GenericLabRuntimeErrorDetail =
  | boolean
  | number
  | string
  | readonly string[];

export class GenericLabRuntimeError extends Error {
  readonly code: GenericLabRuntimeErrorCode;
  readonly details: Readonly<Record<string, GenericLabRuntimeErrorDetail>>;

  constructor(
    code: GenericLabRuntimeErrorCode,
    message: string,
    details: Readonly<Record<string, GenericLabRuntimeErrorDetail>> = {}
  ) {
    super(message);
    this.name = "GenericLabRuntimeError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}
