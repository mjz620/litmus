import type { SemanticEvent } from "../../../experiments/shared";
import type {
  ExecutedMaterialAction,
  MaterialLedger
} from "../material-ledger";
import type {
  ChemistryModelImplementationRegistration,
  ChemistryModelModule,
  ModelTransition
} from "../../registries/chemistry-models";
import type {
  CompiledEquipmentBinding,
  CompiledMaterialBinding,
  GenericEquipmentState,
  GenericObservable,
  GenericStateField,
  NormalizedLabAction
} from "../../runtime/generic/types";

/** Model initialization receives exact setup data, never workflow prose or family metadata. */
export interface GenericChemistryModuleInitializationContext {
  readonly equipmentBindings: readonly Readonly<CompiledEquipmentBinding>[];
  readonly materialBindings: readonly Readonly<CompiledMaterialBinding>[];
  readonly equipment: readonly Readonly<GenericEquipmentState>[];
  readonly materialLedger: Readonly<MaterialLedger>;
  /**
   * Simulated bench time already elapsed when a registered initialization
   * preset seeds a mid-procedure state. Absent (zero) on a fresh bench.
   */
  readonly simulatedElapsedSeconds?: number;
}

/**
 * Exact per-action context for coordinator-layer chemistry hooks. It carries
 * the normalized action so a module can respond to non-material actions, while
 * the framework-free base contract in the chemistry-model registry stays
 * unchanged.
 */
export interface GenericChemistryActionContext {
  readonly action: Readonly<NormalizedLabAction>;
  readonly materialAction: Readonly<ExecutedMaterialAction> | null;
  readonly equipment: readonly Readonly<GenericEquipmentState>[];
  readonly materialLedger: Readonly<MaterialLedger>;
}

/**
 * Coordinator-layer module contract: the registry base contract intersected
 * with optional action-aware hooks.
 *
 * - `applyActionTransition`, when present, replaces `applyMaterialAction` for
 *   every dispatched action (including actions with no material transfer).
 * - `annotateEvents` receives the module's post-transition state and must
 *   return the same events (same count, same types, same order), optionally
 *   with chemistry observations, flags, and skill evidence added.
 * - `deriveGroundTruthValues` contributes deterministic numeric ground truth
 *   merged into the projection; key collisions are a coordinator error.
 * - `deriveGroundTruthNotes` contributes deterministic ground-truth prose
 *   notes, appended in model order.
 */
export type GenericChemistryModule = ChemistryModelModule<
  readonly GenericStateField[],
  GenericChemistryModuleInitializationContext,
  ExecutedMaterialAction,
  readonly GenericObservable[]
> & {
  readonly applyActionTransition?: (
    context: Readonly<GenericChemistryActionContext>,
    state: readonly GenericStateField[]
  ) => ModelTransition<readonly GenericStateField[]>;
  readonly annotateEvents?: (
    context: Readonly<GenericChemistryActionContext>,
    state: readonly GenericStateField[],
    events: readonly SemanticEvent[]
  ) => readonly SemanticEvent[];
  readonly deriveGroundTruthValues?: (
    state: readonly GenericStateField[]
  ) => Readonly<Record<string, number>>;
  readonly deriveGroundTruthNotes?: (
    state: readonly GenericStateField[]
  ) => readonly string[];
};

export type GenericChemistryModuleRegistration =
  ChemistryModelImplementationRegistration<
    readonly GenericStateField[],
    GenericChemistryModuleInitializationContext,
    ExecutedMaterialAction,
    readonly GenericObservable[]
  > & {
    readonly module: GenericChemistryModule;
  };

export interface CreateChemistryModelCoordinatorOptions {
  readonly registrations: readonly GenericChemistryModuleRegistration[];
}
