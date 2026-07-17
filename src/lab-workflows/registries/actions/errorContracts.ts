import { createSupportingRegistry } from "./supportingRegistry";
import type { LabActionErrorContractEntry } from "./types";

export const LAB_ACTION_ERROR_CONTRACT_ENTRIES = [
  {
    id: "action-error.parameters_invalid.v1",
    version: "1.0.0",
    description:
      "Action parameters do not satisfy the exact registered schema.",
    failurePhase: "parameter_parse"
  },
  {
    id: "action-error.source_capability_missing.v1",
    version: "1.0.0",
    description: "The selected source equipment lacks a required capability.",
    failurePhase: "capability_check"
  },
  {
    id: "action-error.target_capability_missing.v1",
    version: "1.0.0",
    description: "Selected target equipment lacks a required capability.",
    failurePhase: "capability_check"
  },
  {
    id: "action-error.precondition_failed.v1",
    version: "1.0.0",
    description: "A registered equipment-state precondition is not satisfied.",
    failurePhase: "precondition_check"
  },
  {
    id: "action-error.mechanical_adapter_unavailable.v1",
    version: "1.0.0",
    description: "The exact registered mechanical adapter cannot be resolved.",
    failurePhase: "adapter_resolution"
  }
] as const satisfies readonly LabActionErrorContractEntry[];

export const labActionErrorContractRegistry = createSupportingRegistry(
  "action error contract",
  "action-errors.1.0.0",
  LAB_ACTION_ERROR_CONTRACT_ENTRIES
);
