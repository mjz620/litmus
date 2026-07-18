import {
  volumeAt,
  type MaterialLedger
} from "../chemistry-models/material-ledger";
import type {
  CompiledEquipmentBinding,
  GenericEquipmentInitializationContext,
  GenericEquipmentState,
  GenericStateValue
} from "../runtime/generic/types";
import {
  LIQUID_MECHANICS_ERROR_CODES as ERROR,
  LiquidMechanicsError
} from "./errors";

function fail(message: string, equipmentInstanceId: string): never {
  throw new LiquidMechanicsError(ERROR.invalidEquipment, message, {
    equipmentInstanceId
  });
}

export function stateField(
  state: Readonly<GenericEquipmentState>,
  key: string
): GenericStateValue {
  const field = state.fields.find((candidate) => candidate.key === key);
  if (!field)
    fail(
      `Equipment ${state.instanceId} has no ${key} field.`,
      state.instanceId
    );
  return field.value;
}

export function numericStateField(
  state: Readonly<GenericEquipmentState>,
  key: string
): number {
  const value = stateField(state, key);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(
      `Equipment ${state.instanceId} has an invalid ${key} field.`,
      state.instanceId
    );
  }
  return value;
}

export function booleanStateField(
  state: Readonly<GenericEquipmentState>,
  key: string
): boolean {
  const value = stateField(state, key);
  if (typeof value !== "boolean") {
    fail(
      `Equipment ${state.instanceId} has an invalid ${key} field.`,
      state.instanceId
    );
  }
  return value;
}

export function withStateFields(
  state: Readonly<GenericEquipmentState>,
  values: Readonly<Record<string, GenericStateValue>>
): GenericEquipmentState {
  const known = new Set(state.fields.map(({ key }) => key));
  for (const key of Object.keys(values)) {
    if (!known.has(key))
      fail(
        `Equipment ${state.instanceId} has no ${key} field.`,
        state.instanceId
      );
  }
  return {
    ...state,
    fields: state.fields.map((field) =>
      Object.prototype.hasOwnProperty.call(values, field.key)
        ? { key: field.key, value: values[field.key]! }
        : { ...field }
    )
  };
}

function exactMaterialAt(
  ledger: Readonly<MaterialLedger>,
  equipmentInstanceId: string
): string {
  const materialIds = ledger.materials
    .filter((material) =>
      material.locations.some(
        (location) =>
          location.equipmentInstanceId === equipmentInstanceId &&
          location.amount > 0
      )
    )
    .map(({ materialInstanceId }) => materialInstanceId);
  if (materialIds.length !== 1) {
    fail(
      `Equipment ${equipmentInstanceId} requires one exact material binding.`,
      equipmentInstanceId
    );
  }
  return materialIds[0]!;
}

function createState(
  binding: Readonly<CompiledEquipmentBinding>,
  values: Readonly<Record<string, GenericStateValue>>
): GenericEquipmentState {
  return {
    instanceId: binding.instanceId,
    equipmentDefinitionId: binding.equipmentDefinitionId,
    stateSchemaId: binding.stateSchemaId,
    fields: binding.stateFields.map(({ key }) => {
      if (!Object.prototype.hasOwnProperty.call(values, key)) {
        fail(
          `Initializer omitted ${key} on ${binding.instanceId}.`,
          binding.instanceId
        );
      }
      return { key, value: values[key]! };
    })
  };
}

function capacity(binding: Readonly<CompiledEquipmentBinding>): number {
  const capacityML = binding.measurement?.capacityML;
  if (!capacityML || !Number.isFinite(capacityML) || capacityML <= 0) {
    fail(
      `Equipment ${binding.instanceId} lacks a verified capacity.`,
      binding.instanceId
    );
  }
  return capacityML;
}

export function initializeLiquidEquipmentState(
  context: Readonly<GenericEquipmentInitializationContext>
): GenericEquipmentState {
  const { binding, materialLedger } = context;
  const containedVolumeML = volumeAt(materialLedger, binding.instanceId);
  switch (binding.equipmentDefinitionId) {
    case "component.burette.v1": {
      const capacityML = capacity(binding);
      if (containedVolumeML > capacityML) {
        fail(
          `Initial volume exceeds ${binding.instanceId} capacity.`,
          binding.instanceId
        );
      }
      return createState(binding, {
        capacityML,
        availableML: containedVolumeML,
        deliveredML: 0,
        conditionedWith: null,
        filled: containedVolumeML > 0,
        stopcockDetent: "closed",
        meniscusReadingML: capacityML - containedVolumeML
      });
    }
    case "component.erlenmeyer_flask.v1": {
      const capacityML = capacity(binding);
      if (containedVolumeML > capacityML) {
        fail(
          `Initial volume exceeds ${binding.instanceId} capacity.`,
          binding.instanceId
        );
      }
      return createState(binding, {
        capacityML,
        totalVolumeML: containedVolumeML,
        observableColor: "unobserved",
        indicatorAdded: false
      });
    }
    case "component.reagent_bottle.v1":
      return createState(binding, {
        reagentInstanceId: exactMaterialAt(materialLedger, binding.instanceId),
        selected: false
      });
    case "component.indicator_bottle.v1":
      return createState(binding, {
        indicatorReagentInstanceId: exactMaterialAt(
          materialLedger,
          binding.instanceId
        ),
        selected: false,
        added: false
      });
    default:
      fail(
        `Equipment ${binding.equipmentDefinitionId} has no liquid initializer.`,
        binding.instanceId
      );
  }
}
