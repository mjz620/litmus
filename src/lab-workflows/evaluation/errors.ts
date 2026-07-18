export const WORKFLOW_EVALUATOR_ERROR_CODES = Object.freeze({
  ruleDuplicate: "workflow_evaluator.rule_duplicate.v1",
  ruleUnknown: "workflow_evaluator.rule_unknown.v1",
  registryContractMissing: "workflow_evaluator.registry_contract_missing.v1",
  contextMismatch: "workflow_evaluator.context_mismatch.v1"
} as const);

export type WorkflowEvaluatorErrorCode =
  (typeof WORKFLOW_EVALUATOR_ERROR_CODES)[keyof typeof WORKFLOW_EVALUATOR_ERROR_CODES];

export class WorkflowEvaluatorError extends Error {
  readonly code: WorkflowEvaluatorErrorCode;
  readonly details: Readonly<Record<string, string>>;

  constructor(
    code: WorkflowEvaluatorErrorCode,
    message: string,
    details: Readonly<Record<string, string>> = {}
  ) {
    super(message);
    this.name = "WorkflowEvaluatorError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}
