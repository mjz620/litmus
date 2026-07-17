export type ComponentRegistryId =
  | "component.burette.v1"
  | "component.erlenmeyer_flask.v1"
  | "component.reagent_bottle.v1"
  | "component.indicator_bottle.v1";

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
  readonly purpose: string;
  readonly stateSchema: ComponentStateSchema;
  readonly allowedActionIds: readonly string[];
  readonly allowedRoleIds: readonly string[];
  readonly emittedEventTypes: readonly string[];
  readonly measurement: MeasurementCapability | null;
  /** Exact existing React/Three export name; this is not a registry ID. */
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
  readonly snapshotId: "components.1.0.0";
  readonly entries: readonly ComponentRegistryEntry[];
}

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
