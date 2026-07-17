import type {
  CapabilityAvailability,
  EquipmentCapabilityId
} from "../../capabilities";

export type ComponentRegistryId =
  | "component.burette.v1"
  | "component.erlenmeyer_flask.v1"
  | "component.reagent_bottle.v1"
  | "component.indicator_bottle.v1";

export type EquipmentStateSchemaId =
  | "schema.equipment_state.burette.v1"
  | "schema.equipment_state.erlenmeyer_flask.v1"
  | "schema.equipment_state.reagent_bottle.v1"
  | "schema.equipment_state.indicator_bottle.v1";

export type ComponentConfigurationPresetId =
  | "component_config.burette.50ml.v1"
  | "component_config.erlenmeyer.125ml.v1"
  | "component_config.indicator_dropper.v1"
  | "component_config.reagent_bottle.titrant_source.v1";

export type VisualAdapterDefinitionId =
  | "visual-adapter.burette.v1"
  | "visual-adapter.erlenmeyer_flask.v1"
  | "visual-adapter.reagent_bottle.v1"
  | "visual-adapter.indicator_bottle.v1";

export type MechanicalAdapterId =
  | "mechanical-adapter.burette.v1"
  | "mechanical-adapter.erlenmeyer_flask.v1"
  | "mechanical-adapter.reagent_bottle.v1"
  | "mechanical-adapter.indicator_bottle.v1";

export type ComponentStateValueType =
  | "boolean"
  | "enum"
  | "number"
  | "string"
  | "string_array";

export interface ComponentStateField {
  readonly key: string;
  readonly valueType: ComponentStateValueType;
  readonly nullable: boolean;
  readonly runtimeOwned: true;
  readonly allowedValues?: readonly string[];
  readonly description: string;
}

/**
 * Serializable state metadata only. It describes the projection owned by the
 * existing runtime; authored workflows never provide values for these fields.
 */
export interface ComponentStateSchema {
  readonly schemaVersion: "1.0.0";
  readonly additionalProperties: false;
  readonly fields: readonly ComponentStateField[];
}

export interface MeasurementCapability {
  readonly kind: "approximate_volume" | "volumetric_delivery";
  readonly unitId: "unit.ml.v1";
  readonly capacityML: number;
  readonly graduationIncrementML: number;
  readonly reportIncrementML: number;
  readonly toleranceML: number;
  readonly quantitative: boolean;
  readonly description: string;
}

export type ComponentPerformanceTier = "core" | "enhanced" | "restricted";

export interface ComponentRegistryEntry {
  readonly id: ComponentRegistryId;
  readonly version: "1.0.0";
  readonly displayName: string;
  readonly capabilityIds: readonly EquipmentCapabilityId[];
  readonly stateSchemaId: EquipmentStateSchemaId;
  readonly stateSchemaAvailability: CapabilityAvailability;
  readonly defaultConfigurationPresetId: ComponentConfigurationPresetId;
  readonly defaultConfigurationPresetAvailability: CapabilityAvailability;
  readonly visualAdapterDefinitionId: VisualAdapterDefinitionId;
  readonly visualAdapterDefinitionAvailability: CapabilityAvailability;
  readonly mechanicalAdapterId: MechanicalAdapterId;
  readonly mechanicalAdapterAvailability: CapabilityAvailability;
  readonly purpose: string;
  readonly stateSchema: ComponentStateSchema;
  readonly allowedActionIds: readonly string[];
  readonly allowedRoleIds: readonly string[];
  readonly emittedEventTypes: readonly string[];
  readonly measurement: MeasurementCapability | null;
  /**
   * @deprecated V1 compatibility export name consumed by the titration adapter.
   * New contracts use visualAdapterDefinitionId, which is an exact registry ID.
   */
  readonly visualAdapterId:
    | "Burette"
    | "ErlenmeyerFlask"
    | "IndicatorShelf"
    | "WashStation";
  readonly accessibilityRequirements: readonly string[];
  readonly safetyConstraintIds: readonly string[];
  readonly compatibleFamilyIds: readonly string[];
  readonly performanceTier: ComponentPerformanceTier;
}

export interface ComponentRegistrySnapshot {
  readonly snapshotId: "components.2.0.0";
  readonly entries: readonly ComponentRegistryEntry[];
}

export const LEGACY_COMPONENT_REGISTRY_SNAPSHOT_IDS = Object.freeze([
  "components.1.0.0"
] as const);

export type ComponentRegistryErrorCode =
  | "component_registry.duplicate_id"
  | "component_registry.unknown_id";

export class ComponentRegistryError extends Error {
  readonly code: ComponentRegistryErrorCode;
  readonly registryId: string;

  constructor(code: ComponentRegistryErrorCode, registryId: string) {
    const message =
      code === "component_registry.duplicate_id"
        ? `Duplicate component registry ID: ${registryId}`
        : `Unknown component registry ID: ${registryId}`;
    super(message);
    this.name = "ComponentRegistryError";
    this.code = code;
    this.registryId = registryId;
  }
}

export interface ComponentRegistry {
  readonly snapshotId: ComponentRegistrySnapshot["snapshotId"];
  list(): readonly ComponentRegistryEntry[];
  has(id: string): id is ComponentRegistryId;
  get(id: string): ComponentRegistryEntry;
}
