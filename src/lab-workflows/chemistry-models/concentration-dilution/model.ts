import { THERMAL_ENERGY_MODEL_ID, THERMAL_ENERGY_MODULE } from "../thermal-energy";
import { PRECIPITATION_MODEL_ID, PRECIPITATION_MODULE } from "../precipitation";
import type { ExecutedMaterialAction } from "../material-ledger";
import {
  integerUnitsToQuantity,
  quantityToIntegerUnits
} from "../material-ledger";
import type {
  GenericChemistryModule,
  GenericChemistryModuleInitializationContext,
  GenericChemistryModuleRegistration
} from "../coordinator";
import type {
  GenericObservable,
  GenericStateField
} from "../../runtime/generic";

export const SHARED_LIQUID_FOUNDATION_MODEL_ID =
  "chemistry-model.shared_liquid_foundation.v1" as const;
export const CONCENTRATION_DILUTION_MODEL_ID =
  "chemistry-model.concentration_dilution.v1" as const;

export const CONCENTRATION_DILUTION_OBSERVABLE_IDS = Object.freeze({
  concentration: "observable.solution_concentration_m.v1",
  volume: "observable.solution_volume_ml.v1"
} as const);

export const CONCENTRATION_DILUTION_ERROR_CODES = Object.freeze({
  unsupportedSetup: "concentration_dilution.unsupported_setup",
  unsupportedMaterial: "concentration_dilution.unsupported_material",
  invalidState: "concentration_dilution.invalid_state",
  invalidTransition: "concentration_dilution.invalid_transition"
} as const);

export type ConcentrationDilutionErrorCode =
  (typeof CONCENTRATION_DILUTION_ERROR_CODES)[keyof typeof CONCENTRATION_DILUTION_ERROR_CODES];

export class ConcentrationDilutionModelError extends Error {
  readonly code: ConcentrationDilutionErrorCode;

  constructor(code: ConcentrationDilutionErrorCode, message: string) {
    super(message);
    this.name = "ConcentrationDilutionModelError";
    this.code = code;
  }
}

const WATER_PROFILE_ID = "reagent.distilled_water.v1";
const FLASK_COMPONENT_ID = "component.volumetric_flask.v1";
const DILUTION_CAPABILITY_ID = "chemistry.concentration_dilution.v1";
const CONCENTRATION_SCALE = 1_000_000;

const FIELD = Object.freeze({
  targetEquipmentInstanceId: "targetEquipmentInstanceId",
  stockMaterialInstanceId: "stockMaterialInstanceId",
  stockMaterialProfileId: "stockMaterialProfileId",
  supportedMaterialInstanceIds: "supportedMaterialInstanceIds",
  stockConcentrationMicromolar: "stockConcentrationMicromolar",
  targetVolumeUnits: "targetVolumeUnits",
  targetSoluteProductUnits: "targetSoluteProductUnits"
} as const);

function fail(code: ConcentrationDilutionErrorCode, message: string): never {
  throw new ConcentrationDilutionModelError(code, message);
}

function field(
  fields: readonly GenericStateField[],
  key: string
): GenericStateField["value"] {
  const match = fields.find((candidate) => candidate.key === key);
  if (!match)
    fail(CONCENTRATION_DILUTION_ERROR_CODES.invalidState, `Missing ${key}.`);
  return match.value;
}

function stringField(
  fields: readonly GenericStateField[],
  key: string
): string {
  const value = field(fields, key);
  if (typeof value !== "string")
    fail(
      CONCENTRATION_DILUTION_ERROR_CODES.invalidState,
      `${key} must be text.`
    );
  return value;
}

function numberField(
  fields: readonly GenericStateField[],
  key: string
): number {
  const value = field(fields, key);
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    fail(
      CONCENTRATION_DILUTION_ERROR_CODES.invalidState,
      `${key} must be a non-negative safe integer.`
    );
  return value;
}

function stringArrayField(
  fields: readonly GenericStateField[],
  key: string
): readonly string[] {
  const value = field(fields, key);
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    fail(
      CONCENTRATION_DILUTION_ERROR_CODES.invalidState,
      `${key} must be a list of exact IDs.`
    );
  return value;
}

function scaledConcentration(concentrationM: number): number {
  const scaled = Math.round(concentrationM * CONCENTRATION_SCALE);
  if (
    !Number.isFinite(concentrationM) ||
    concentrationM <= 0 ||
    !Number.isSafeInteger(scaled) ||
    Math.abs(scaled / CONCENTRATION_SCALE - concentrationM) >
      Number.EPSILON * 16
  ) {
    fail(
      CONCENTRATION_DILUTION_ERROR_CODES.unsupportedMaterial,
      "The stock concentration is outside the exact supported precision."
    );
  }
  return scaled;
}

function initialState(
  context: Readonly<GenericChemistryModuleInitializationContext>
): readonly GenericStateField[] {
  const flasks = context.equipmentBindings.filter(
    ({ equipmentDefinitionId }) => equipmentDefinitionId === FLASK_COMPONENT_ID
  );
  if (flasks.length !== 1) {
    fail(
      CONCENTRATION_DILUTION_ERROR_CODES.unsupportedSetup,
      "Bounded concentration/dilution requires exactly one registered volumetric flask."
    );
  }
  const targetEquipmentInstanceId = flasks[0]!.instanceId;
  const stockBindings = context.materialBindings.filter(
    ({ providedChemistryCapabilityIds, initialConcentrationM }) =>
      providedChemistryCapabilityIds.includes(DILUTION_CAPABILITY_ID) &&
      initialConcentrationM !== null
  );
  const waterBindings = context.materialBindings.filter(
    ({ materialProfileId }) => materialProfileId === WATER_PROFILE_ID
  );
  if (
    stockBindings.length !== 1 ||
    waterBindings.length < 1 ||
    stockBindings.length + waterBindings.length !==
      context.materialBindings.length
  ) {
    fail(
      CONCENTRATION_DILUTION_ERROR_CODES.unsupportedMaterial,
      "This model supports exactly one registered aqueous stock with concentration/dilution capability and distilled water only."
    );
  }
  const stock = stockBindings[0]!;
  if (
    stock.materialPhase !== "aqueous_solution" ||
    stock.quantityUnitId !== "unit.ml.v1" ||
    stock.initialConcentrationM === null
  ) {
    fail(
      CONCENTRATION_DILUTION_ERROR_CODES.unsupportedMaterial,
      "The registered stock initialization is not a supported aqueous concentration."
    );
  }
  if (
    waterBindings.some(
      (binding) =>
        binding.materialPhase !== "pure_liquid" ||
        binding.quantityUnitId !== "unit.ml.v1" ||
        binding.initialConcentrationM !== null
    )
  ) {
    fail(
      CONCENTRATION_DILUTION_ERROR_CODES.unsupportedMaterial,
      "The diluent must be registered distilled water without solute concentration."
    );
  }

  const supportedMaterialInstanceIds = context.materialBindings
    .map(({ instanceId }) => instanceId)
    .sort();
  const ledgerIds = context.materialLedger.materials
    .map(({ materialInstanceId }) => materialInstanceId)
    .sort();
  if (
    supportedMaterialInstanceIds.length !== ledgerIds.length ||
    supportedMaterialInstanceIds.some((id, index) => id !== ledgerIds[index])
  ) {
    fail(
      CONCENTRATION_DILUTION_ERROR_CODES.unsupportedSetup,
      "The material ledger does not match the compiled material bindings."
    );
  }

  const stockConcentrationMicromolar = scaledConcentration(
    stock.initialConcentrationM
  );
  let targetVolumeUnits = 0;
  let targetSoluteProductUnits = 0;
  for (const material of context.materialLedger.materials) {
    if (material.unitId !== "unit.ml.v1") {
      fail(
        CONCENTRATION_DILUTION_ERROR_CODES.unsupportedMaterial,
        "Concentration/dilution accepts liquid-volume ledger entries only."
      );
    }
    const amount =
      material.locations.find(
        ({ equipmentInstanceId }) =>
          equipmentInstanceId === targetEquipmentInstanceId
      )?.amount ?? 0;
    const amountUnits = quantityToIntegerUnits(amount, material.unitId);
    targetVolumeUnits += amountUnits;
    if (material.materialInstanceId === stock.instanceId)
      targetSoluteProductUnits += stockConcentrationMicromolar * amountUnits;
  }
  if (
    !Number.isSafeInteger(targetVolumeUnits) ||
    !Number.isSafeInteger(targetSoluteProductUnits)
  ) {
    fail(
      CONCENTRATION_DILUTION_ERROR_CODES.unsupportedSetup,
      "The initial solution exceeds deterministic numeric bounds."
    );
  }

  return [
    { key: FIELD.targetEquipmentInstanceId, value: targetEquipmentInstanceId },
    { key: FIELD.stockMaterialInstanceId, value: stock.instanceId },
    { key: FIELD.stockMaterialProfileId, value: stock.materialProfileId },
    {
      key: FIELD.supportedMaterialInstanceIds,
      value: supportedMaterialInstanceIds
    },
    {
      key: FIELD.stockConcentrationMicromolar,
      value: stockConcentrationMicromolar
    },
    { key: FIELD.targetVolumeUnits, value: targetVolumeUnits },
    { key: FIELD.targetSoluteProductUnits, value: targetSoluteProductUnits }
  ];
}

function applyTransferAction(
  action: Readonly<ExecutedMaterialAction>,
  state: readonly GenericStateField[]
): readonly GenericStateField[] {
  const targetEquipmentInstanceId = stringField(
    state,
    FIELD.targetEquipmentInstanceId
  );
  const stockMaterialInstanceId = stringField(
    state,
    FIELD.stockMaterialInstanceId
  );
  const stockMaterialProfileId = stringField(
    state,
    FIELD.stockMaterialProfileId
  );
  const supportedMaterialInstanceIds = stringArrayField(
    state,
    FIELD.supportedMaterialInstanceIds
  );
  const stockConcentrationMicromolar = numberField(
    state,
    FIELD.stockConcentrationMicromolar
  );
  let targetVolumeUnits = numberField(state, FIELD.targetVolumeUnits);
  let targetSoluteProductUnits = numberField(
    state,
    FIELD.targetSoluteProductUnits
  );

  for (const transfer of action.transfers) {
    if (
      transfer.unitId !== "unit.ml.v1" ||
      !supportedMaterialInstanceIds.includes(transfer.materialInstanceId)
    ) {
      fail(
        CONCENTRATION_DILUTION_ERROR_CODES.unsupportedMaterial,
        "The material transition is outside the bounded aqueous model."
      );
    }
    const isStock = transfer.materialInstanceId === stockMaterialInstanceId;
    const expectedProfileId = isStock
      ? stockMaterialProfileId
      : WATER_PROFILE_ID;
    if (transfer.materialProfileId !== expectedProfileId) {
      fail(
        CONCENTRATION_DILUTION_ERROR_CODES.unsupportedMaterial,
        "The material identity does not match its verified initialization."
      );
    }
    const amountUnits = quantityToIntegerUnits(
      transfer.amount,
      transfer.unitId,
      false
    );
    const direction =
      transfer.targetEquipmentInstanceId === targetEquipmentInstanceId
        ? 1
        : transfer.sourceEquipmentInstanceId === targetEquipmentInstanceId
          ? -1
          : 0;
    targetVolumeUnits += direction * amountUnits;
    if (isStock)
      targetSoluteProductUnits +=
        direction * stockConcentrationMicromolar * amountUnits;
    if (
      !Number.isSafeInteger(targetVolumeUnits) ||
      !Number.isSafeInteger(targetSoluteProductUnits) ||
      targetVolumeUnits < 0 ||
      targetSoluteProductUnits < 0
    ) {
      fail(
        CONCENTRATION_DILUTION_ERROR_CODES.invalidTransition,
        "The material transition would produce invalid conserved solution state."
      );
    }
  }

  return state.map((entry) => {
    if (entry.key === FIELD.targetVolumeUnits)
      return { ...entry, value: targetVolumeUnits };
    if (entry.key === FIELD.targetSoluteProductUnits)
      return { ...entry, value: targetSoluteProductUnits };
    return { ...entry };
  });
}

function roundToScale(value: number, scale: number): number {
  return Math.round(value * scale) / scale;
}

function observables(
  state: readonly GenericStateField[]
): readonly GenericObservable[] {
  const volumeUnits = numberField(state, FIELD.targetVolumeUnits);
  const soluteProductUnits = numberField(state, FIELD.targetSoluteProductUnits);
  const volumeML = integerUnitsToQuantity(volumeUnits, "unit.ml.v1");
  const concentrationM =
    volumeUnits === 0
      ? 0
      : roundToScale(
          soluteProductUnits / volumeUnits / CONCENTRATION_SCALE,
          CONCENTRATION_SCALE
        );
  return [
    {
      observableId: CONCENTRATION_DILUTION_OBSERVABLE_IDS.concentration,
      value: concentrationM,
      unitId: "unit.mol_per_l.v1"
    },
    {
      observableId: CONCENTRATION_DILUTION_OBSERVABLE_IDS.volume,
      value: volumeML,
      unitId: "unit.ml.v1"
    }
  ];
}

export const SHARED_LIQUID_FOUNDATION_MODULE: GenericChemistryModule =
  Object.freeze({
    id: SHARED_LIQUID_FOUNDATION_MODEL_ID,
    version: "1.0.0",
    providedCapabilityIds: [
      "chemistry.material_ledger.v1",
      "chemistry.volume_conservation.v1",
      "chemistry.solution_mixing.v1"
    ] as const,
    requiredCapabilityIds: [] as const,
    initialize: () => [],
    applyMaterialAction: (
      _action: Readonly<ExecutedMaterialAction>,
      state: readonly GenericStateField[]
    ) => ({
      state: state.map((entry) => ({ ...entry }))
    }),
    deriveObservables: () => []
  });

export const CONCENTRATION_DILUTION_MODULE: GenericChemistryModule =
  Object.freeze({
    id: CONCENTRATION_DILUTION_MODEL_ID,
    version: "1.0.0",
    providedCapabilityIds: [
      "chemistry.concentration_dilution.v1",
      "chemistry.instrument_observables.v1"
    ] as const,
    requiredCapabilityIds: [
      "chemistry.material_ledger.v1",
      "chemistry.volume_conservation.v1",
      "chemistry.solution_mixing.v1"
    ] as const,
    initialize: initialState,
    applyMaterialAction: (
      action: Readonly<ExecutedMaterialAction>,
      state: readonly GenericStateField[]
    ) => ({
      state: applyTransferAction(action, state)
    }),
    deriveObservables: observables
  });

export const PRODUCTION_GENERIC_CHEMISTRY_MODEL_REGISTRATIONS = Object.freeze([
  {
    metadataId: SHARED_LIQUID_FOUNDATION_MODEL_ID,
    module: SHARED_LIQUID_FOUNDATION_MODULE
  },
  {
    metadataId: CONCENTRATION_DILUTION_MODEL_ID,
    module: CONCENTRATION_DILUTION_MODULE
  },
  {
    metadataId: THERMAL_ENERGY_MODEL_ID,
    module: THERMAL_ENERGY_MODULE
  },
  {
    metadataId: PRECIPITATION_MODEL_ID,
    module: PRECIPITATION_MODULE
  }
] as const satisfies readonly GenericChemistryModuleRegistration[]);
