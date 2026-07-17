import type { ChemistryModelId } from "./types";

export const CHEMISTRY_MODEL_REGISTRY_ERROR_CODES = Object.freeze({
  duplicateId: "chemistry_model_registry.duplicate_id",
  unknownId: "chemistry_model_registry.unknown_id"
} as const);

export type ChemistryModelRegistryErrorCode =
  (typeof CHEMISTRY_MODEL_REGISTRY_ERROR_CODES)[keyof typeof CHEMISTRY_MODEL_REGISTRY_ERROR_CODES];

export class ChemistryModelRegistryError extends Error {
  readonly code: ChemistryModelRegistryErrorCode;
  readonly registryId: string;

  constructor(code: ChemistryModelRegistryErrorCode, registryId: string) {
    super(
      code === CHEMISTRY_MODEL_REGISTRY_ERROR_CODES.duplicateId
        ? `Duplicate chemistry model registry ID: ${registryId}`
        : `Unknown chemistry model registry ID: ${registryId}`
    );
    this.name = "ChemistryModelRegistryError";
    this.code = code;
    this.registryId = registryId;
  }
}

export const CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES = Object.freeze({
  unknownCapability: "chemistry_model_resolution.unknown_capability",
  missingProvider: "chemistry_model_resolution.missing_provider",
  providerNotVerified: "chemistry_model_resolution.provider_not_verified",
  ambiguousExclusiveProvider:
    "chemistry_model_resolution.ambiguous_exclusive_provider",
  unmetDependency: "chemistry_model_resolution.unmet_dependency",
  dependencyCycle: "chemistry_model_resolution.dependency_cycle"
} as const);

export type ChemistryModelResolutionErrorCode =
  (typeof CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES)[keyof typeof CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES];

export interface ChemistryModelResolutionErrorDetails {
  readonly capabilityId?: string;
  readonly modelId?: ChemistryModelId;
  readonly modelIds?: readonly ChemistryModelId[];
  readonly cycleModelIds?: readonly ChemistryModelId[];
}

function resolutionMessage(
  code: ChemistryModelResolutionErrorCode,
  details: ChemistryModelResolutionErrorDetails
): string {
  const capability = details.capabilityId ?? "unknown";
  switch (code) {
    case CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES.unknownCapability:
      return `Unknown chemistry capability ID: ${capability}`;
    case CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES.missingProvider:
      return `No chemistry model provides required capability: ${capability}`;
    case CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES.providerNotVerified:
      return `Chemistry capability has no verified provider: ${capability}`;
    case CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES.ambiguousExclusiveProvider:
      return `Chemistry capability has multiple verified exclusive providers: ${capability}`;
    case CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES.unmetDependency:
      return `Chemistry model ${details.modelId ?? "unknown"} has no provider for dependency: ${capability}`;
    case CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES.dependencyCycle:
      return `Chemistry model dependency cycle: ${(details.cycleModelIds ?? []).join(" -> ")}`;
  }
}

export class ChemistryModelResolutionError extends Error {
  readonly code: ChemistryModelResolutionErrorCode;
  readonly capabilityId?: string;
  readonly modelId?: ChemistryModelId;
  readonly modelIds: readonly ChemistryModelId[];
  readonly cycleModelIds: readonly ChemistryModelId[];

  constructor(
    code: ChemistryModelResolutionErrorCode,
    details: ChemistryModelResolutionErrorDetails = {}
  ) {
    super(resolutionMessage(code, details));
    this.name = "ChemistryModelResolutionError";
    this.code = code;
    this.capabilityId = details.capabilityId;
    this.modelId = details.modelId;
    this.modelIds = Object.freeze([...(details.modelIds ?? [])]);
    this.cycleModelIds = Object.freeze([...(details.cycleModelIds ?? [])]);
  }
}
