import type {
  ChemistryCapabilityId,
  EquipmentCapabilityId,
  LabCapabilityId
} from "./ids";

export type CapabilityAvailability = "declared" | "verified" | "restricted";

interface CapabilityDefinitionBase {
  readonly version: "1.0.0";
  readonly displayName: string;
  readonly description: string;
  readonly availability: CapabilityAvailability;
}

export interface EquipmentCapabilityDefinition extends CapabilityDefinitionBase {
  readonly kind: "equipment";
  readonly id: EquipmentCapabilityId;
}

export interface ChemistryCapabilityDefinition extends CapabilityDefinitionBase {
  readonly kind: "chemistry";
  readonly id: ChemistryCapabilityId;
  /** Phase 1 capabilities require exactly one verified provider when runnable. */
  readonly providerCardinality: "exclusive";
}

export type CapabilityDefinition =
  | EquipmentCapabilityDefinition
  | ChemistryCapabilityDefinition;

export interface CapabilityRegistrySnapshot {
  readonly snapshotId: "capabilities.1.1.0";
  readonly entries: readonly CapabilityDefinition[];
}

export type CapabilityRegistryErrorCode =
  | "capability_registry.duplicate_id"
  | "capability_registry.unknown_id";

export class CapabilityRegistryError extends Error {
  readonly code: CapabilityRegistryErrorCode;
  readonly registryId: string;

  constructor(code: CapabilityRegistryErrorCode, registryId: string) {
    super(
      code === "capability_registry.duplicate_id"
        ? `Duplicate capability registry ID: ${registryId}`
        : `Unknown capability registry ID: ${registryId}`
    );
    this.name = "CapabilityRegistryError";
    this.code = code;
    this.registryId = registryId;
  }
}

export interface CapabilityRegistry {
  readonly snapshotId: CapabilityRegistrySnapshot["snapshotId"];
  list(): readonly CapabilityDefinition[];
  listEquipment(): readonly EquipmentCapabilityDefinition[];
  listChemistry(): readonly ChemistryCapabilityDefinition[];
  has(id: string): id is LabCapabilityId;
  get(id: string): CapabilityDefinition;
  getEquipment(id: string): EquipmentCapabilityDefinition;
  getChemistry(id: string): ChemistryCapabilityDefinition;
}
