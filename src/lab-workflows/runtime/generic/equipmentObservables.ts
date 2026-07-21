import type { CompiledGenericLabProgram } from "./types";
import type { GenericEquipmentState, GenericObservable } from "./types";
import {
  GENERIC_LAB_RUNTIME_ERROR_CODES as ERROR,
  GenericLabRuntimeError
} from "./errors";

/**
 * Registered equipment-owned observable sources.
 *
 * Some registered observables are measurement truth owned by an apparatus, not
 * solution chemistry: the burette's meniscus reading is equipment state, so no
 * chemistry model may own it. Each entry projects one registered observable
 * from one registered component state field. The runtime merges these into the
 * chemistry projection after model initialization/transition; a chemistry
 * model emitting the same observable id is a hard contract error.
 */
interface EquipmentObservableSource {
  readonly equipmentDefinitionId: string;
  readonly stateFieldKey: string;
  readonly observableId: string;
  readonly unitId: string;
}

const EQUIPMENT_OBSERVABLE_SOURCES: readonly EquipmentObservableSource[] =
  Object.freeze([
    Object.freeze({
      equipmentDefinitionId: "component.burette.v1",
      stateFieldKey: "meniscusReadingML",
      observableId: "observable.burette_reading_ml.v1",
      unitId: "unit.ml.v1"
    }),
    Object.freeze({
      equipmentDefinitionId: "component.balance.v1",
      stateFieldKey: "currentReadingG",
      observableId: "observable.balance_reading_g.v1",
      unitId: "unit.g.v1"
    })
  ]);

function fail(message: string, observableId: string): never {
  throw new GenericLabRuntimeError(ERROR.portContractMismatch, message, {
    observableId
  });
}

/**
 * Project every registered equipment-owned observable for this compiled
 * program from current equipment state. Only fires for components present in
 * the program whose observable is registered; a source matching more than one
 * equipment instance is rejected because the observable would be ambiguous.
 */
export function projectEquipmentObservables(
  program: Readonly<CompiledGenericLabProgram>,
  equipment: readonly Readonly<GenericEquipmentState>[]
): readonly GenericObservable[] {
  const observables: GenericObservable[] = [];
  for (const source of EQUIPMENT_OBSERVABLE_SOURCES) {
    if (!program.registeredObservableIds.includes(source.observableId)) {
      continue;
    }
    const owners = equipment.filter(
      ({ equipmentDefinitionId }) =>
        equipmentDefinitionId === source.equipmentDefinitionId
    );
    if (owners.length === 0) continue;
    if (owners.length > 1) {
      fail(
        `Observable ${source.observableId} resolves to more than one ${source.equipmentDefinitionId} instance.`,
        source.observableId
      );
    }
    const value = owners[0]!.fields.find(
      ({ key }) => key === source.stateFieldKey
    )?.value;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      fail(
        `Equipment ${owners[0]!.instanceId} carries no numeric ${source.stateFieldKey} for ${source.observableId}.`,
        source.observableId
      );
    }
    observables.push({
      observableId: source.observableId,
      value,
      unitId: source.unitId
    });
  }
  return observables;
}

/**
 * Merge equipment-owned observables into a chemistry-derived observable list,
 * keeping the canonical observableId sort order.
 *
 * Every observable keeps exactly one owner per step: when a resolved
 * chemistry-model port already projects an id (for example a coordinator
 * providing instrument observables), the equipment projection defers so the
 * validated model provenance stays authoritative; the equipment source only
 * fills ids no model claims. The coordinator separately rejects two models
 * claiming one id.
 */
export function mergeEquipmentObservables(
  chemistryObservables: readonly GenericObservable[],
  equipmentObservables: readonly GenericObservable[]
): readonly GenericObservable[] {
  const chemistryOwned = new Set(
    chemistryObservables.map(({ observableId }) => observableId)
  );
  const merged = [
    ...chemistryObservables,
    ...equipmentObservables.filter(
      ({ observableId }) => !chemistryOwned.has(observableId)
    )
  ];
  return merged.sort((left, right) =>
    left.observableId < right.observableId
      ? -1
      : left.observableId > right.observableId
        ? 1
        : 0
  );
}
