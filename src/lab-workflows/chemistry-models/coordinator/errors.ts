export const CHEMISTRY_MODEL_COORDINATOR_ERROR_CODES = Object.freeze({
  duplicateImplementation:
    "chemistry_model_coordinator.duplicate_implementation.v1",
  missingImplementation:
    "chemistry_model_coordinator.missing_implementation.v1",
  implementationVersionMismatch:
    "chemistry_model_coordinator.implementation_version_mismatch.v1",
  implementationContractMismatch:
    "chemistry_model_coordinator.implementation_contract_mismatch.v1",
  modelStateMissing: "chemistry_model_coordinator.model_state_missing.v1",
  modelStateDuplicate: "chemistry_model_coordinator.model_state_duplicate.v1",
  modelStateInvalid: "chemistry_model_coordinator.model_state_invalid.v1",
  observableUnregistered:
    "chemistry_model_coordinator.observable_unregistered.v1",
  observableDuplicate: "chemistry_model_coordinator.observable_duplicate.v1",
  initializationRejected:
    "chemistry_model_coordinator.initialization_rejected.v1",
  transitionRejected: "chemistry_model_coordinator.transition_rejected.v1",
  observableDerivationRejected:
    "chemistry_model_coordinator.observable_derivation_rejected.v1",
  groundTruthInvalid: "chemistry_model_coordinator.ground_truth_invalid.v1",
  groundTruthCollision:
    "chemistry_model_coordinator.ground_truth_collision.v1",
  eventAnnotationInvalid:
    "chemistry_model_coordinator.event_annotation_invalid.v1"
} as const);

export type ChemistryModelCoordinatorErrorCode =
  (typeof CHEMISTRY_MODEL_COORDINATOR_ERROR_CODES)[keyof typeof CHEMISTRY_MODEL_COORDINATOR_ERROR_CODES];

export class ChemistryModelCoordinatorError extends Error {
  readonly code: ChemistryModelCoordinatorErrorCode;
  readonly details: Readonly<Record<string, string>>;

  constructor(
    code: ChemistryModelCoordinatorErrorCode,
    message: string,
    details: Readonly<Record<string, string>> = {}
  ) {
    super(message);
    this.name = "ChemistryModelCoordinatorError";
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}
