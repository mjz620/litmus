import type { ExecutedMaterialAction } from "../material-ledger";
import {
  integerUnitsToQuantity,
  quantityToIntegerUnits
} from "../material-ledger";
import type {
  GenericChemistryActionContext,
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
  volume: "observable.calorimeter_volume_ml.v1",
  reactedMoles: "observable.reacted_amount_mol.v1",
  reactionHeat: "observable.reaction_heat_j.v1",
  measuredMolarEnthalpy: "observable.measured_molar_enthalpy_kj_per_mol.v1"
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

/** CRC Handbook, 102nd ed.: liquid-water specific heat at 25 °C. */
export const WATER_SPECIFIC_HEAT_J_PER_G_C = 4.184;
/** AP/general-chemistry calorimetry approximation for dilute aqueous work. */
export const WATER_DENSITY_G_PER_ML = 1;
/**
 * Lansing Community College CHEM 161 Experiment 7 publishes 15.9 J/°C for
 * its doubled Styrofoam-cup calorimeter:
 * https://chem.libretexts.org/Courses/Lansing_Community_College/LCC%3A_CHEM_161_-_General_Chemistry_Lab_I/Experiment_7%3A_Calorimetry
 */
export const CALORIMETER_CONSTANT_J_PER_C = 15.9;
/** Registered ambient/start temperature for the insulated cup in this model. */
export const CALORIMETER_INITIAL_TEMPERATURE_C = 20;

/**
 * Standard 25 °C molar enthalpies used by registered reaction identities.
 * - HCl/NaOH: Ghana Ministry of Education Chemistry curriculum resource,
 *   −57.1 kJ/mol:
 *   https://curriculumresources.edu.gh/wp-content/uploads/2025/09/Chemistry_online.pdf
 * - NH4NO3: Purdue Chemistry demonstration sheet 21.3, +25.7 kJ/mol:
 *   https://chemed.chem.purdue.edu/genchem/demosheets/21.3.html
 * - anhydrous CaCl2: CK-12/LibreTexts Heat of Solution, −82.8 kJ/mol:
 *   https://chem.libretexts.org/Bookshelves/Introductory_Chemistry/Introductory_Chemistry_%28CK-12%29/17%3A_Thermochemistry/17.13%3A_Heat_of_Solution
 */
export const REACTION_ENTHALPY_KJ_PER_MOL = Object.freeze({
  "reaction.neutralization.hcl_naoh.v1": -57.1,
  "reagent.ammonium_nitrate_solid.v1": 25.7,
  "reagent.calcium_chloride_solid.v1": -82.8
} as const);

const CALORIMETER_COMPONENT_ID = "component.calorimeter.v1";
const THERMAL_CAPABILITY_ID = "chemistry.thermal_energy.v1";
const TEMP_MILLI_SCALE = 1_000;
const HEAT_MICRO_SCALE = 1_000_000;

const FIELD = Object.freeze({
  calorimeterInstanceId: "calorimeterInstanceId",
  materialTemperatureMilliCById: "materialTemperatureMilliCById",
  calorimeterVolumeUnits: "calorimeterVolumeUnits",
  calorimeterHeatMicroJ: "calorimeterHeatMicroJ",
  calorimeterConstantJPerCMicro: "calorimeterConstantJPerCMicro",
  solidMolarMassMicroById: "solidMolarMassMicroById",
  solidEnthalpyMilliById: "solidEnthalpyMilliById",
  lastReportedMassMicroG: "lastReportedMassMicroG",
  reactedMolesNano: "reactedMolesNano",
  reactionHeatMicroJ: "reactionHeatMicroJ",
  measuredMolarEnthalpyMilli: "measuredMolarEnthalpyMilli"
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
  if (typeof value !== "number" || !Number.isSafeInteger(value))
    fail(
      THERMAL_ENERGY_ERROR_CODES.invalidState,
      `${key} must be a safe integer.`
    );
  return value;
}

function nonNegativeNumberField(
  fields: readonly GenericStateField[],
  key: string
): number {
  const value = numberField(fields, key);
  if (value < 0)
    fail(
      THERMAL_ENERGY_ERROR_CODES.invalidState,
      `${key} must be non-negative.`
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
    [
      ...(temperatures instanceof Map
        ? temperatures.entries()
        : Object.entries(temperatures))
    ]
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
    !Number.isSafeInteger(heat)
  ) {
    fail(
      THERMAL_ENERGY_ERROR_CODES.unsupportedSetup,
      "The thermal content exceeds deterministic numeric bounds."
    );
  }
  return heat;
}

function calorimeterHeatMicroJFor(temperatureC: number): number {
  const heat = Math.round(
    CALORIMETER_CONSTANT_J_PER_C * temperatureC * HEAT_MICRO_SCALE
  );
  if (!Number.isSafeInteger(heat)) {
    fail(
      THERMAL_ENERGY_ERROR_CODES.unsupportedSetup,
      "The calorimeter heat content exceeds deterministic numeric bounds."
    );
  }
  return heat;
}

function temperatureFromState(
  volumeML: number,
  heatMicroJ: number,
  constantMicro: number
): number | null {
  if (volumeML <= 0) return null;
  const heatCapacity =
    volumeML * WATER_DENSITY_G_PER_ML * WATER_SPECIFIC_HEAT_J_PER_G_C +
    constantMicro / HEAT_MICRO_SCALE;
  if (heatCapacity <= 0) return null;
  return (
    Math.round(
      (heatMicroJ / HEAT_MICRO_SCALE / heatCapacity) * TEMP_MILLI_SCALE
    ) / TEMP_MILLI_SCALE
  );
}

function encodedIntegerEntries(
  entries: ReadonlyMap<string, number>
): readonly string[] {
  return Object.freeze(
    [...entries.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([id, value]) => `${id}=${value}`)
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
    ({ providedChemistryCapabilityIds }) =>
      providedChemistryCapabilityIds.includes(THERMAL_CAPABILITY_ID)
  );
  if (
    thermalBindings.length === 0 ||
    thermalBindings.length !== context.materialBindings.length
  ) {
    fail(
      THERMAL_ENERGY_ERROR_CODES.unsupportedMaterial,
      "This model supports registered thermal liquids and solids only."
    );
  }
  if (
    thermalBindings.some((binding) => {
      if (binding.materialPhase === "pure_liquid")
        return (
          binding.quantityUnitId !== "unit.ml.v1" ||
          binding.initialTemperatureC === null
        );
      if (binding.materialPhase === "solid")
        return (
          binding.quantityUnitId !== "unit.g.v1" ||
          binding.molarMassGPerMol == null
        );
      return true;
    })
  ) {
    fail(
      THERMAL_ENERGY_ERROR_CODES.unsupportedMaterial,
      "Thermal sources must be registered liquids or solids with formula mass."
    );
  }

  const materialIds = thermalBindings
    .map(({ instanceId }) => instanceId)
    .sort();
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
  const solidMolarMassMicroById = new Map<string, number>();
  const solidEnthalpyMilliById = new Map<string, number>();
  for (const binding of thermalBindings) {
    if (binding.materialPhase === "solid") {
      const enthalpy =
        REACTION_ENTHALPY_KJ_PER_MOL[
          binding.materialProfileId as keyof typeof REACTION_ENTHALPY_KJ_PER_MOL
        ];
      if (enthalpy === undefined || binding.molarMassGPerMol == null) {
        fail(
          THERMAL_ENERGY_ERROR_CODES.unsupportedMaterial,
          `Solid ${binding.materialProfileId} has no registered dissolution enthalpy.`
        );
      }
      solidMolarMassMicroById.set(
        binding.instanceId,
        Math.round(binding.molarMassGPerMol * 1_000_000)
      );
      solidEnthalpyMilliById.set(
        binding.instanceId,
        Math.round(enthalpy * 1_000)
      );
      continue;
    }
    materialTemperatureMilliCById.set(
      binding.instanceId,
      scaledTemperatureMilliC(binding.initialTemperatureC!)
    );
  }

  let calorimeterVolumeUnits = 0;
  let calorimeterHeatMicroJ = calorimeterHeatMicroJFor(
    CALORIMETER_INITIAL_TEMPERATURE_C
  );
  for (const material of context.materialLedger.materials) {
    if (material.unitId === "unit.g.v1") continue;
    if (material.unitId !== "unit.ml.v1")
      fail(
        THERMAL_ENERGY_ERROR_CODES.unsupportedMaterial,
        "Thermal energy accepts registered liquid volume or solid mass only."
      );
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
  if (calorimeterVolumeUnits > 0) {
    const volumeML = integerUnitsToQuantity(
      calorimeterVolumeUnits,
      "unit.ml.v1"
    );
    const liquidTemperatureC =
      calorimeterHeatMicroJ /
      HEAT_MICRO_SCALE /
      (volumeML * WATER_DENSITY_G_PER_ML * WATER_SPECIFIC_HEAT_J_PER_G_C);
    calorimeterHeatMicroJ =
      calorimeterHeatMicroJFor(liquidTemperatureC) +
      heatMicroJFor(volumeML, liquidTemperatureC);
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
    },
    {
      key: FIELD.solidMolarMassMicroById,
      value: encodedIntegerEntries(solidMolarMassMicroById)
    },
    {
      key: FIELD.solidEnthalpyMilliById,
      value: encodedIntegerEntries(solidEnthalpyMilliById)
    },
    { key: FIELD.lastReportedMassMicroG, value: 0 },
    { key: FIELD.reactedMolesNano, value: 0 },
    { key: FIELD.reactionHeatMicroJ, value: 0 },
    { key: FIELD.measuredMolarEnthalpyMilli, value: 0 }
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
  let calorimeterVolumeUnits = nonNegativeNumberField(
    state,
    FIELD.calorimeterVolumeUnits
  );
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
      calorimeterVolumeUnits < 0
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

function replaceStateValues(
  state: readonly GenericStateField[],
  values: Readonly<Record<string, number | readonly string[]>>
): readonly GenericStateField[] {
  return state.map((entry) =>
    Object.prototype.hasOwnProperty.call(values, entry.key)
      ? { ...entry, value: values[entry.key]! }
      : { ...entry }
  );
}

function applySolidTransfer(
  action: Readonly<ExecutedMaterialAction>,
  state: readonly GenericStateField[]
): readonly GenericStateField[] {
  const calorimeterInstanceId = stringField(state, FIELD.calorimeterInstanceId);
  const molarMasses = temperatureEntriesField(
    state,
    FIELD.solidMolarMassMicroById
  );
  const enthalpies = temperatureEntriesField(
    state,
    FIELD.solidEnthalpyMilliById
  );
  let heatMicroJ = numberField(state, FIELD.calorimeterHeatMicroJ);
  let reactedMolesNano = nonNegativeNumberField(state, FIELD.reactedMolesNano);
  let reactionHeatMicroJ = numberField(state, FIELD.reactionHeatMicroJ);
  let measuredMolarEnthalpyMilli = numberField(
    state,
    FIELD.measuredMolarEnthalpyMilli
  );
  const lastReportedMassMicroG = nonNegativeNumberField(
    state,
    FIELD.lastReportedMassMicroG
  );

  for (const transfer of action.transfers) {
    if (transfer.unitId !== "unit.g.v1") continue;
    if (transfer.targetEquipmentInstanceId !== calorimeterInstanceId) continue;
    const molarMassMicro = molarMasses.get(transfer.materialInstanceId);
    const enthalpyMilli = enthalpies.get(transfer.materialInstanceId);
    if (molarMassMicro === undefined || enthalpyMilli === undefined) {
      fail(
        THERMAL_ENERGY_ERROR_CODES.unsupportedMaterial,
        "The transferred solid has no registered thermochemical identity."
      );
    }
    const moles = transfer.amount / (molarMassMicro / 1_000_000);
    const qReactionJ = moles * (enthalpyMilli / 1_000) * 1_000;
    const qReactionMicroJ = Math.round(qReactionJ * HEAT_MICRO_SCALE);
    const molesNano = Math.round(moles * 1_000_000_000);
    if (
      !Number.isSafeInteger(qReactionMicroJ) ||
      !Number.isSafeInteger(molesNano)
    ) {
      fail(
        THERMAL_ENERGY_ERROR_CODES.invalidTransition,
        "Dissolution exceeds deterministic thermochemical bounds."
      );
    }
    // q_rxn = -q_solution+calorimeter: positive dissolution enthalpy cools.
    heatMicroJ -= qReactionMicroJ;
    reactionHeatMicroJ += qReactionMicroJ;
    reactedMolesNano += molesNano;
    if (lastReportedMassMicroG > 0) {
      const measuredMoles =
        lastReportedMassMicroG / 1_000_000 / (molarMassMicro / 1_000_000);
      measuredMolarEnthalpyMilli = Math.round(
        (qReactionJ / 1_000 / measuredMoles) * 1_000
      );
    }
  }

  return replaceStateValues(state, {
    [FIELD.calorimeterHeatMicroJ]: heatMicroJ,
    [FIELD.reactedMolesNano]: reactedMolesNano,
    [FIELD.reactionHeatMicroJ]: reactionHeatMicroJ,
    [FIELD.measuredMolarEnthalpyMilli]: measuredMolarEnthalpyMilli
  });
}

function applyActionTransition(
  context: Readonly<GenericChemistryActionContext>,
  state: readonly GenericStateField[]
): readonly GenericStateField[] {
  if (context.action.actionId === "action.read_balance.v1") {
    const balance = context.equipment.find(
      ({ equipmentDefinitionId }) =>
        equipmentDefinitionId === "component.balance.v1"
    );
    const reported = balance?.fields.find(
      ({ key }) => key === "lastReportedG"
    )?.value;
    if (
      typeof reported !== "number" ||
      !Number.isFinite(reported) ||
      reported < 0
    ) {
      fail(
        THERMAL_ENERGY_ERROR_CODES.invalidTransition,
        "A balance reading must be recorded before molar enthalpy can be measured."
      );
    }
    return replaceStateValues(state, {
      [FIELD.lastReportedMassMicroG]: Math.round(reported * 1_000_000)
    });
  }
  if (!context.materialAction) return state.map((entry) => ({ ...entry }));
  const hasLiquid = context.materialAction.transfers.some(
    ({ unitId }) => unitId === "unit.ml.v1"
  );
  const hasSolid = context.materialAction.transfers.some(
    ({ unitId }) => unitId === "unit.g.v1"
  );
  let next = state;
  if (hasLiquid) next = applyTransferAction(context.materialAction, next);
  if (hasSolid) next = applySolidTransfer(context.materialAction, next);
  return next;
}

function observables(
  state: readonly GenericStateField[]
): readonly GenericObservable[] {
  const volumeUnits = nonNegativeNumberField(
    state,
    FIELD.calorimeterVolumeUnits
  );
  const heatMicroJ = numberField(state, FIELD.calorimeterHeatMicroJ);
  const constantMicro = numberField(state, FIELD.calorimeterConstantJPerCMicro);
  const volumeML = integerUnitsToQuantity(volumeUnits, "unit.ml.v1");
  const temperatureC = temperatureFromState(
    volumeML,
    heatMicroJ,
    constantMicro
  );
  const heatJ = heatMicroJ / HEAT_MICRO_SCALE;
  const reactedMoles =
    nonNegativeNumberField(state, FIELD.reactedMolesNano) / 1_000_000_000;
  const reactionHeatJ =
    numberField(state, FIELD.reactionHeatMicroJ) / HEAT_MICRO_SCALE;
  const measuredMolarEnthalpy =
    numberField(state, FIELD.measuredMolarEnthalpyMilli) / 1_000;

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
    },
    {
      observableId: THERMAL_ENERGY_OBSERVABLE_IDS.reactedMoles,
      value: reactedMoles,
      unitId: "unit.mol.v1"
    },
    {
      observableId: THERMAL_ENERGY_OBSERVABLE_IDS.reactionHeat,
      value: reactionHeatJ,
      unitId: "unit.joule.v1"
    },
    {
      observableId: THERMAL_ENERGY_OBSERVABLE_IDS.measuredMolarEnthalpy,
      value: measuredMolarEnthalpy,
      unitId: "unit.kj_per_mol.v1"
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
  applyActionTransition: (
    context: Readonly<GenericChemistryActionContext>,
    state: readonly GenericStateField[]
  ) => ({
    state: applyActionTransition(context, state)
  }),
  deriveObservables: observables
});
