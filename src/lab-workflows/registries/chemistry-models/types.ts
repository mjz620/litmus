import type {
  CapabilityRegistry,
  ChemistryCapabilityId
} from "../../capabilities";

/** Exactness is enforced by the closed registry; this type preserves the ID namespace. */
export type ChemistryModelId = `chemistry-model.${string}`;

export type ChemistryModelAvailability = "declared" | "verified" | "restricted";

/**
 * Serializable, inspectable provider metadata. The metadata registry never
 * imports or stores executable chemistry implementations.
 */
export interface ChemistryModelMetadataEntry {
  readonly id: ChemistryModelId;
  readonly version: "1.0.0";
  readonly displayName: string;
  readonly providedCapabilityIds: readonly ChemistryCapabilityId[];
  readonly requiredCapabilityIds: readonly ChemistryCapabilityId[];
  readonly availability: ChemistryModelAvailability;
  /** Restricts a legacy provider to one exact compatibility runtime seam. */
  readonly compatibilityRuntimeAdapterId?: string;
}

export interface ModelTransition<TState> {
  readonly state: TState;
}

/**
 * Framework-free contract for a future deterministic implementation. Generic
 * context/action/observable types keep LC2-103 from defining runtime payloads
 * before the coordinator tickets own those contracts.
 */
export interface ChemistryModelModule<
  TState,
  TInitializationContext,
  TMaterialAction,
  TObservables
> {
  readonly id: ChemistryModelId;
  readonly version: "1.0.0";
  readonly providedCapabilityIds: readonly ChemistryCapabilityId[];
  readonly requiredCapabilityIds: readonly ChemistryCapabilityId[];
  initialize(context: Readonly<TInitializationContext>): TState;
  applyMaterialAction(
    action: Readonly<TMaterialAction>,
    state: Readonly<TState>
  ): ModelTransition<TState>;
  deriveObservables(state: Readonly<TState>): Readonly<TObservables>;
}

/**
 * Executable registrations remain a separate trust boundary from metadata.
 * LC2-103 defines this contract but intentionally creates no production map.
 */
export interface ChemistryModelImplementationRegistration<
  TState,
  TInitializationContext,
  TMaterialAction,
  TObservables
> {
  readonly metadataId: ChemistryModelId;
  readonly module: ChemistryModelModule<
    TState,
    TInitializationContext,
    TMaterialAction,
    TObservables
  >;
}

export interface ChemistryModelRegistrySnapshot {
  readonly snapshotId: "chemistry-models.1.1.0";
  readonly entries: readonly ChemistryModelMetadataEntry[];
}

export interface ChemistryModelRegistry {
  readonly snapshotId: ChemistryModelRegistrySnapshot["snapshotId"];
  list(): readonly ChemistryModelMetadataEntry[];
  has(id: string): id is ChemistryModelId;
  get(id: string): ChemistryModelMetadataEntry;
}

export interface ChemistryModelResolutionOptions {
  readonly capabilityRegistry?: CapabilityRegistry;
  readonly modelRegistry?: ChemistryModelRegistry;
  readonly compatibilityRuntimeAdapterId?: string;
}

export interface ResolvedChemistryCapabilityProvider {
  readonly capabilityId: ChemistryCapabilityId;
  readonly modelId: ChemistryModelId;
}

export interface ChemistryModelResolution {
  /** Exact root requirements supplied by the definition, sorted as a set. */
  readonly requiredCapabilityIds: readonly ChemistryCapabilityId[];
  /** Root and transitive capability bindings, sorted by capability ID. */
  readonly capabilityProviders: readonly ResolvedChemistryCapabilityProvider[];
  /** Dependencies precede dependants; independent modules use exact ID order. */
  readonly orderedModelIds: readonly ChemistryModelId[];
  readonly orderedModels: readonly ChemistryModelMetadataEntry[];
}
