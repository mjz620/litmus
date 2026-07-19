import type { ExecutedMaterialAction } from "../material-ledger";
import {
  integerUnitsToQuantity,
  quantityToIntegerUnits
} from "../material-ledger";
import type {
  GenericChemistryModule,
  GenericChemistryModuleInitializationContext
} from "../coordinator";
import type {
  GenericObservable,
  GenericStateField
} from "../../runtime/generic";

export const THERMAL_ENERGY_MODEL_ID =
  "chemistry-model.thermal_energy.v1" as const;

export const THERMAL_ENERGY_OBSERVABLE_IDS = Object.freeze({
  temperature: "observable.calorimeter_temperature_c.v1",
  heatContent: "observable.calorimeter_heat_content_j.v1",
  volume: "observable.calorimeter_volume_ml.v1"
} as const);

export const THERMAL_ENERGY_ERROR_CODES = Object.freeze({
  unsupportedSetup: "thermal_energy.unsupported_setup",
  unsupportedMaterial: "thermal_energy.unsupported_material",
  invalidState: "thermal_energy.invalid_state",
  invalidTransition: "thermal_energy.invalid_transition"
} as const);

export type ThermalEnergyErrorCode =
  (typeof THERMAL_ENERGY_ERROR_CODES)[keyof typeof THERMAL_ENERGY_ERROR_CODES];

export class ThermalEnergyModelError extends Error {
  readonly code: ThermalEnergyErrorCode;

  constructor(code: ThermalEnergyErrorCode, message: string) {
    super(message);
    this.name = "ThermalEnergyModelError";
    this.code = code;
  }
}

/** Code-owned water specific heat for the verified coffee-cup MVP. */
export const WATER_SPECIFIC_HEAT_J_PER_G_C = 4.184;
/** Code-owned density used to convert registered milliliters into mass. */
export const WATER_DENSITY_G_PER_ML = 1;
/**
 * Optional calorimeter constant (J/°C). MVP coffee-cup defaults to zero until a
 * registered non-zero configuration is authored in a later ticket.
 */
export const CALORIMETER_CONSTANT_J_PER_C = 0;

const CALORIMETER_COMPONENT_ID = "component.calorimeter.v1";
const THERMAL_CAPABILITY_ID = "chemistry.thermal_energy.v1";
const TEMP_MILLI_SCALE = 1_000;
const HEAT_MICRO_SCALE = 1_000_000;

const FIELD = Object.freeze({
  calorimeterInstanceId: "calorimeterInstanceId",
  materialTemperatureMilliCById: "materialTemperatureMilliCById",
  calorimeterVolumeUnits: "calorimeterVolumeUnits",
  calorimeterHeatMicroJ: "calorimeterHeatMicroJ",
  calorimeterConstantJPerCMicro: "calorimeterConstantJPerCMicro"
} as const);

function fail(code: ThermalEnergyErrorCode, message: string): never {
  throw new ThermalEnergyModelError(code, message);
}

function field(
  fields: readonly GenericStateField[],
  key: string
): GenericStateField["value"] {
  const match = fields.find((candidate) => candidate.key === key);
  if (!match) fail(THERMAL_ENERGY_ERROR_CODES.invalidState, `Missing ${key}.`);
  return match.value;
}

function stringField(
  fields: readonly GenericStateField[],
  key: string
): string {
  const value = field(fields, key);
  if (typeof value !== "string")
    fail(THERMAL_ENERGY_ERROR_CODES.invalidState, `${key} must be text.`);
  return value;
}

function numberField(
  fields: readonly GenericStateField[],
  key: string
): number {
  const value = field(fields, key);
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    fail(
      THERMAL_ENERGY_ERROR_CODES.invalidState,
      `${key} must be a non-negative safe integer.`
    );
  return value;
}

function temperatureEntriesField(
  fields: readonly GenericStateField[],
  key: string
): ReadonlyMap<string, number> {
  const value = field(fields, key);
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    fail(
      THERMAL_ENERGY_ERROR_CODES.invalidState,
      `${key} must list exact material temperature bindings.`
    );
  }
  const entries = new Map<string, number>();
  for (const item of value) {
    const separator = item.lastIndexOf("=");
    if (separator <= 0) {
      fail(
        THERMAL_ENERGY_ERROR_CODES.invalidState,
        `${key} contains a malformed temperature binding.`
      );
    }
    const instanceId = item.slice(0, separator);
    const milliC = Number(item.slice(separator + 1));
    if (
      !instanceId ||
      !Number.isSafeInteger(milliC) ||
      entries.has(instanceId)
    ) {
      fail(
        THERMAL_ENERGY_ERROR_CODES.invalidState,
        `${key} contains an invalid temperature binding.`
      );
    }
    entries.set(instanceId, milliC);
  }
  return entries;
}

function encodeTemperatureEntries(
  temperatures: ReadonlyMap<string, number> | Readonly<Record<string, number>>
): readonly string[] {
  return Object.freeze(
    [...(temperatures instanceof Map
      ? temperatures.entries()
      : Object.entries(temperatures))]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([instanceId, milliC]) => `${instanceId}=${milliC}`)
  );
}

function scaledTemperatureMilliC(temperatureC: number): number {
  const scaled = Math.round(temperatureC * TEMP_MILLI_SCALE);
  if (
    !Number.isFinite(temperatureC) ||
    !Number.isSafeInteger(scaled) ||
    Math.abs(scaled / TEMP_MILLI_SCALE - temperatureC) > Number.EPSILON * 16
  ) {
    fail(
      THERMAL_ENERGY_ERROR_CODES.unsupportedMaterial,
      "The registered initial temperature is outside the exact supported precision."
    );
  }
  return scaled;
}

function calorimeterConstantMicro(): number {
  const factor = Math.round(CALORIMETER_CONSTANT_J_PER_C * HEAT_MICRO_SCALE);
  if (!Number.isSafeInteger(factor) || factor < 0) {
    fail(
      THERMAL_ENERGY_ERROR_CODES.unsupportedSetup,
      "The registered calorimeter constant is outside deterministic bounds."
    );
  }
  return factor;
}

function heatMicroJFor(volumeML: number, temperatureC: number): number {
  const heat = Math.round(
    volumeML *
      WATER_DENSITY_G_PER_ML *
      WATER_SPECIFIC_HEAT_J_PER_G_C *
      temperatureC *
      HEAT_MICRO_SCALE
  );
  if (
    !Number.isFinite(volumeML) ||
    volumeML < 0 ||
    !Number.isSafeInteger(heat) ||
    heat < 0
  ) {
    fail(
      THERMAL_ENERGY_ERROR_CODES.unsupportedSetup,
      "The thermal content exceeds deterministic numeric bounds."
    );
  }
  return heat;
}

function temperatureFromState(
  volumeML: number,
  heatMicroJ: number,
  constantMicro: number
): number | null {
  const heatCapacity =
    volumeML * WATER_DENSITY_G_PER_ML * WATER_SPECIFIC_HEAT_J_PER_G_C +
    constantMicro / HEAT_MICRO_SCALE;
  if (heatCapacity <= 0) return null;
  return (
    Math.round(
      ((heatMicroJ / HEAT_MICRO_SCALE) / heatCapacity) * TEMP_MILLI_SCALE
    ) / TEMP_MILLI_SCALE
  );
}

function heatContentJoules(
  volumeML: number,
  temperatureC: number | null
): number {
  if (temperatureC === null || volumeML <= 0) return 0;
  return (
    volumeML *
    WATER_DENSITY_G_PER_ML *
    WATER_SPECIFIC_HEAT_J_PER_G_C *
    temperatureC
  );
}

function initialState(
  context: Readonly<GenericChemistryModuleInitializationContext>
): readonly GenericStateField[] {
  const calorimeters = context.equipmentBindings.filter(
    ({ equipmentDefinitionId }) =>
      equipmentDefinitionId === CALORIMETER_COMPONENT_ID
  );
  if (calorimeters.length !== 1) {
    fail(
      THERMAL_ENERGY_ERROR_CODES.unsupportedSetup,
      "Bounded thermal energy requires exactly one registered coffee-cup calorimeter."
    );
  }
  const calorimeterInstanceId = calorimeters[0]!.instanceId;

  const thermalBindings = context.materialBindings.filter(
    ({ providedChemistryCapabilityIds, initialTemperatureC }) =>
      providedChemistryCapabilityIds.includes(THERMAL_CAPABILITY_ID) &&
      initialTemperatureC !== null
  );
  if (
    thermalBindings.length === 0 ||
    thermalBindings.length !== context.materialBindings.length
  ) {
    fail(
      THERMAL_ENERGY_ERROR_CODES.unsupportedMaterial,
      "This model supports registered thermal aqueous water sources only."
    );
  }
  if (
    thermalBindings.some(
      (binding) =>
        binding.materialPhase !== "pure_liquid" ||
        binding.quantityUnitId !== "unit.ml.v1" ||
        binding.initialTemperatureC === null
    )
  ) {
    fail(
      THERMAL_ENERGY_ERROR_CODES.unsupportedMaterial,
      "Thermal sources must be pure liquids with registered Celsius temperatures."
    );
  }

  const materialIds = thermalBindings.map(({ instanceId }) => instanceId).sort();
  const ledgerIds = context.materialLedger.materials
    .map(({ materialInstanceId }) => materialInstanceId)
    .sort();
  if (
    materialIds.length !== ledgerIds.length ||
    materialIds.some((id, index) => id !== ledgerIds[index])
  ) {
    fail(
      THERMAL_ENERGY_ERROR_CODES.unsupportedSetup,
      "The material ledger does not match the compiled thermal material bindings."
    );
  }

  const materialTemperatureMilliCById = new Map<string, number>();
  for (const binding of thermalBindings) {
    materialTemperatureMilliCById.set(
      binding.instanceId,
      scaledTemperatureMilliC(binding.initialTemperatureC!)
    );
  }

  let calorimeterVolumeUnits = 0;
  let calorimeterHeatMicroJ = 0;
  for (const material of context.materialLedger.materials) {
    if (material.unitId !== "unit.ml.v1") {
      fail(
        THERMAL_ENERGY_ERROR_CODES.unsupportedMaterial,
        "Thermal energy accepts liquid-volume ledger entries only."
      );
    }
    const amount =
      material.locations.find(
        ({ equipmentInstanceId }) =>
          equipmentInstanceId === calorimeterInstanceId
      )?.amount ?? 0;
    const amountUnits = quantityToIntegerUnits(amount, material.unitId);
    const temperatureMilliC = materialTemperatureMilliCById.get(
      material.materialInstanceId
    );
    if (temperatureMilliC === undefined) {
      fail(
        THERMAL_ENERGY_ERROR_CODES.unsupportedMaterial,
        "A calorimeter liquid is missing a registered initial temperature."
      );
    }
    calorimeterVolumeUnits += amountUnits;
    calorimeterHeatMicroJ += heatMicroJFor(
      integerUnitsToQuantity(amountUnits, "unit.ml.v1"),
      temperatureMilliC / TEMP_MILLI_SCALE
    );
  }
  if (
    !Number.isSafeInteger(calorimeterVolumeUnits) ||
    !Number.isSafeInteger(calorimeterHeatMicroJ)
  ) {
    fail(
      THERMAL_ENERGY_ERROR_CODES.unsupportedSetup,
      "The initial calorimeter contents exceed deterministic numeric bounds."
    );
  }

  return [
    { key: FIELD.calorimeterInstanceId, value: calorimeterInstanceId },
    {
      key: FIELD.materialTemperatureMilliCById,
      value: encodeTemperatureEntries(materialTemperatureMilliCById)
    },
    { key: FIELD.calorimeterVolumeUnits, value: calorimeterVolumeUnits },
    { key: FIELD.calorimeterHeatMicroJ, value: calorimeterHeatMicroJ },
    {
      key: FIELD.calorimeterConstantJPerCMicro,
      value: calorimeterConstantMicro()
    }
  ];
}

function applyTransferAction(
  action: Readonly<ExecutedMaterialAction>,
  state: readonly GenericStateField[]
): readonly GenericStateField[] {
  const calorimeterInstanceId = stringField(state, FIELD.calorimeterInstanceId);
  const temperatures = temperatureEntriesField(
    state,
    FIELD.materialTemperatureMilliCById
  );
  let calorimeterVolumeUnits = numberField(state, FIELD.calorimeterVolumeUnits);
  let calorimeterHeatMicroJ = numberField(state, FIELD.calorimeterHeatMicroJ);
  const constantMicro = numberField(state, FIELD.calorimeterConstantJPerCMicro);

  for (const transfer of action.transfers) {
    if (transfer.unitId !== "unit.ml.v1") {
      fail(
        THERMAL_ENERGY_ERROR_CODES.unsupportedMaterial,
        "The material transition is outside the bounded thermal model."
      );
    }
    const temperatureMilliC = temperatures.get(transfer.materialInstanceId);
    if (temperatureMilliC === undefined) {
      fail(
        THERMAL_ENERGY_ERROR_CODES.unsupportedMaterial,
        "The poured material has no registered thermal temperature."
      );
    }
    const amountUnits = quantityToIntegerUnits(
      transfer.amount,
      transfer.unitId,
      false
    );
    const amountML = integerUnitsToQuantity(amountUnits, "unit.ml.v1");
    const intoCalorimeter =
      transfer.targetEquipmentInstanceId === calorimeterInstanceId;
    const fromCalorimeter =
      transfer.sourceEquipmentInstanceId === calorimeterInstanceId;
    if (intoCalorimeter === fromCalorimeter) {
      continue;
    }
    if (intoCalorimeter) {
      calorimeterVolumeUnits += amountUnits;
      calorimeterHeatMicroJ += heatMicroJFor(
        amountML,
        temperatureMilliC / TEMP_MILLI_SCALE
      );
    } else {
      const currentTempC = temperatureFromState(
        integerUnitsToQuantity(calorimeterVolumeUnits, "unit.ml.v1"),
        calorimeterHeatMicroJ,
        constantMicro
      );
      if (currentTempC === null) {
        fail(
          THERMAL_ENERGY_ERROR_CODES.invalidTransition,
          "Cannot remove liquid from an empty calorimeter."
        );
      }
      calorimeterVolumeUnits -= amountUnits;
      calorimeterHeatMicroJ -= heatMicroJFor(amountML, currentTempC);
    }
    if (
      !Number.isSafeInteger(calorimeterVolumeUnits) ||
      !Number.isSafeInteger(calorimeterHeatMicroJ) ||
      calorimeterVolumeUnits < 0 ||
      calorimeterHeatMicroJ < 0
    ) {
      fail(
        THERMAL_ENERGY_ERROR_CODES.invalidTransition,
        "The material transition would produce invalid conserved thermal state."
      );
    }
  }

  return state.map((entry) => {
    if (entry.key === FIELD.calorimeterVolumeUnits)
      return { ...entry, value: calorimeterVolumeUnits };
    if (entry.key === FIELD.calorimeterHeatMicroJ)
      return { ...entry, value: calorimeterHeatMicroJ };
    return { ...entry };
  });
}

function observables(
  state: readonly GenericStateField[]
): readonly GenericObservable[] {
  const volumeUnits = numberField(state, FIELD.calorimeterVolumeUnits);
  const heatMicroJ = numberField(state, FIELD.calorimeterHeatMicroJ);
  const constantMicro = numberField(state, FIELD.calorimeterConstantJPerCMicro);
  const volumeML = integerUnitsToQuantity(volumeUnits, "unit.ml.v1");
  const temperatureC = temperatureFromState(
    volumeML,
    heatMicroJ,
    constantMicro
  );
  const heatJ = heatContentJoules(volumeML, temperatureC);

  return [
    {
      observableId: THERMAL_ENERGY_OBSERVABLE_IDS.temperature,
      value: temperatureC ?? 0,
      unitId: "unit.celsius.v1"
    },
    {
      observableId: THERMAL_ENERGY_OBSERVABLE_IDS.heatContent,
      value: heatJ,
      unitId: "unit.joule.v1"
    },
    {
      observableId: THERMAL_ENERGY_OBSERVABLE_IDS.volume,
      value: volumeML,
      unitId: "unit.ml.v1"
    }
  ];
}

export const THERMAL_ENERGY_MODULE: GenericChemistryModule = Object.freeze({
  id: THERMAL_ENERGY_MODEL_ID,
  version: "1.0.0",
  providedCapabilityIds: [THERMAL_CAPABILITY_ID] as const,
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
