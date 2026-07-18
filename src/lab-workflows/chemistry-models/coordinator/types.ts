import type {
  ExecutedMaterialAction,
  MaterialLedger
} from "../material-ledger";
import type {
  ChemistryModelImplementationRegistration,
  ChemistryModelModule
} from "../../registries/chemistry-models";
import type {
  CompiledEquipmentBinding,
  CompiledMaterialBinding,
  GenericEquipmentState,
  GenericObservable,
  GenericStateField
} from "../../runtime/generic/types";

/** Model initialization receives exact setup data, never workflow prose or family metadata. */
export interface GenericChemistryModuleInitializationContext {
  readonly equipmentBindings: readonly Readonly<CompiledEquipmentBinding>[];
  readonly materialBindings: readonly Readonly<CompiledMaterialBinding>[];
  readonly equipment: readonly Readonly<GenericEquipmentState>[];
  readonly materialLedger: Readonly<MaterialLedger>;
}

export type GenericChemistryModule = ChemistryModelModule<
  readonly GenericStateField[],
  GenericChemistryModuleInitializationContext,
  ExecutedMaterialAction,
  readonly GenericObservable[]
>;

export type GenericChemistryModuleRegistration =
  ChemistryModelImplementationRegistration<
    readonly GenericStateField[],
    GenericChemistryModuleInitializationContext,
    ExecutedMaterialAction,
    readonly GenericObservable[]
  >;

export interface CreateChemistryModelCoordinatorOptions {
  readonly registrations: readonly GenericChemistryModuleRegistration[];
}
