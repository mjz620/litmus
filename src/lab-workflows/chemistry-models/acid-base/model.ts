import type { SemanticEvent, SkillEvidence } from "../../../experiments/shared";
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
  GenericEquipmentState,
  GenericObservable,
  GenericStateField,
  NormalizedLabAction
} from "../../runtime/generic";

export const ACID_BASE_TITRATION_MODEL_ID =
  "chemistry-model.acid_base_titration.v1" as const;

export const ACID_BASE_TITRATION_OBSERVABLE_IDS = Object.freeze({
  pH: "observable.solution_ph.v1",
  observedColor: "observable.observed_color.v1",
  endpointObserved: "observable.endpoint_observed.v1"
} as const);

export const ACID_BASE_TITRATION_ERROR_CODES = Object.freeze({
  unsupportedSetup: "acid_base_titration.unsupported_setup",
  unsupportedMaterial: "acid_base_titration.unsupported_material",
  invalidState: "acid_base_titration.invalid_state",
  invalidTransition: "acid_base_titration.invalid_transition",
  materialActionPathUnsupported:
    "acid_base_titration.material_action_path_unsupported"
} as const);

export type AcidBaseTitrationErrorCode =
  (typeof ACID_BASE_TITRATION_ERROR_CODES)[keyof typeof ACID_BASE_TITRATION_ERROR_CODES];

export class AcidBaseTitrationModelError extends Error {
  readonly code: AcidBaseTitrationErrorCode;

  constructor(code: AcidBaseTitrationErrorCode, message: string) {
    super(message);
    this.name = "AcidBaseTitrationModelError";
    this.code = code;
  }
}

/*
 * ----------------------------------------------------------------------------
 * Pure acid-base titration chemistry, relocated verbatim from
 * src/experiments/titration/titration.ts (which re-exports these names so
 * existing call sites remain source-compatible). The float formulas are
 * byte-identical to the legacy source; the parity oracle pins values such as
 * equivalenceVolumeML = 25.000000000000004 for the 0.100 M / 25 mL bench.
 * ----------------------------------------------------------------------------
 */

export type IndicatorId =
  | "phenolphthalein"
  | "bromothymol_blue"
  | "methyl_orange";
export type AnalyteType = "strong_acid" | "weak_acid";

/**
 * Minimal chemistry configuration for the relocated pure functions. The legacy
 * TitrationConfig is a structural superset, so legacy call sites compile
 * unchanged and produce identical floats.
 */
export interface AcidBaseTitrationChemistryConfig {
  analyte: {
    type: AnalyteType;
    concentrationM: number;
    volumeML: number;
    pKa?: number;
  };
  titrant: {
    concentrationM: number;
  };
}

const KW = 1e-14;

/**
 * Calculate pH as a deterministic function of total titrant added.
 *
 * This uses the source contract's AP/general-chemistry approximations:
 * monoprotic analyte, strong-base titrant, 25 °C, and activity approximately
 * equal to concentration.
 */
export function computePH(
  config: AcidBaseTitrationChemistryConfig,
  totalTitrantML: number,
  dilutionFactor: number
): number {
  const { analyte, titrant } = config;
  const analyteConcentration = analyte.concentrationM;
  const analyteVolumeL = analyte.volumeML / 1000;
  const titrantConcentration = titrant.concentrationM * dilutionFactor;
  const titrantVolumeL = totalTitrantML / 1000;

  const acidMoles = analyteConcentration * analyteVolumeL;
  const baseMoles = titrantConcentration * titrantVolumeL;
  const totalVolumeL = analyteVolumeL + titrantVolumeL;

  if (analyte.type === "strong_acid") {
    if (baseMoles < acidMoles) {
      return -Math.log10((acidMoles - baseMoles) / totalVolumeL);
    }
    if (baseMoles > acidMoles) {
      return 14 + Math.log10((baseMoles - acidMoles) / totalVolumeL);
    }
    return 7;
  }

  const acidDissociationConstant = Math.pow(10, -(analyte.pKa ?? 4.76));
  const pKa = -Math.log10(acidDissociationConstant);

  if (baseMoles <= 0) {
    const hydrogenConcentration =
      (-acidDissociationConstant +
        Math.sqrt(
          acidDissociationConstant * acidDissociationConstant +
            4 * acidDissociationConstant * analyteConcentration
        )) /
      2;
    return -Math.log10(hydrogenConcentration);
  }

  if (baseMoles < acidMoles) {
    return pKa + Math.log10(baseMoles / (acidMoles - baseMoles));
  }

  if (baseMoles === acidMoles) {
    const conjugateBaseConcentration = acidMoles / totalVolumeL;
    const hydroxideConcentration = Math.sqrt(
      (KW / acidDissociationConstant) * conjugateBaseConcentration
    );
    return 14 + Math.log10(hydroxideConcentration);
  }

  return 14 + Math.log10((baseMoles - acidMoles) / totalVolumeL);
}

/** Volume of titrant in mL required to reach the equivalence point. */
export function equivalenceVolumeML(
  config: AcidBaseTitrationChemistryConfig,
  dilutionFactor = 1
): number {
  const acidMoles =
    config.analyte.concentrationM * (config.analyte.volumeML / 1000);
  const effectiveTitrantConcentration =
    config.titrant.concentrationM * dilutionFactor;
  return (acidMoles / effectiveTitrantConcentration) * 1000;
}

export interface IndicatorSpecification {
  low: string;
  mid: string;
  high: string;
  lowMax: number;
  highMin: number;
}

export const INDICATOR_SPECIFICATIONS: Readonly<
  Record<IndicatorId, IndicatorSpecification>
> = {
  phenolphthalein: {
    low: "colorless",
    mid: "faint pink",
    high: "pink",
    lowMax: 8.2,
    highMin: 10
  },
  bromothymol_blue: {
    low: "yellow",
    mid: "green",
    high: "blue",
    lowMax: 6,
    highMin: 7.6
  },
  methyl_orange: {
    low: "red",
    mid: "orange",
    high: "yellow",
    lowMax: 3.1,
    highMin: 4.4
  }
};

export function observedColor(indicator: IndicatorId, pH: number): string {
  const specification = INDICATOR_SPECIFICATIONS[indicator];
  if (pH < specification.lowMax) return specification.low;
  if (pH > specification.highMin) return specification.high;
  return specification.mid;
}

export const NEAR_ENDPOINT_ML = 2;
export const FAST_RATE_ML_PER_S = 0.5;
export const OVERSHOOT_TOLERANCE_ML = 0.3;
export const WATER_RINSE_DILUTION = 0.98;

/*
 * ----------------------------------------------------------------------------
 * Deterministic generic chemistry module.
 * ----------------------------------------------------------------------------
 */

const FLASK_COMPONENT_ID = "component.erlenmeyer_flask.v1";
const BURETTE_COMPONENT_ID = "component.burette.v1";
const WATER_PROFILE_ID = "reagent.distilled_water.v1";
const ACID_BASE_CAPABILITY_ID = "chemistry.acid_base_equilibrium.v1";
const INDICATOR_CAPABILITY_ID = "chemistry.indicator_response.v1";
const ML_UNIT_ID = "unit.ml.v1";
const CONCENTRATION_SCALE = 1_000_000;
const DILUTION_SCALE = 10_000;
const TIME_SCALE = 100;

export const INDICATOR_PROFILE_IDS: Readonly<Record<string, IndicatorId>> = {
  "reagent.phenolphthalein.v1": "phenolphthalein",
  "reagent.bromothymol_blue.v1": "bromothymol_blue",
  "reagent.methyl_orange.v1": "methyl_orange"
};

const FIELD = Object.freeze({
  flaskEquipmentInstanceId: "flaskEquipmentInstanceId",
  buretteEquipmentInstanceId: "buretteEquipmentInstanceId",
  titrantMaterialInstanceId: "titrantMaterialInstanceId",
  analyteConcentrationMicromolar: "analyteConcentrationMicromolar",
  analyteVolumeUnits: "analyteVolumeUnits",
  titrantConcentrationMicromolar: "titrantConcentrationMicromolar",
  deliveredTitrantUnits: "deliveredTitrantUnits",
  /*
   * Legacy-parity floating-point accumulation of delivered titrant. The
   * legacy engine accumulated raw double additions (before + volumeML), and
   * the parity oracle pins the knife-edge behavior of that arithmetic — for
   * example a pinned pH of -2.11 where exact accumulation lands on the
   * equivalence point. The integer-unit field stays the ledger-consistent
   * measure; these two fields reproduce the legacy float path exactly.
   */
  deliveredTitrantMLRaw: "deliveredTitrantMLRaw",
  deliveredTitrantMLRawBefore: "deliveredTitrantMLRawBefore",
  dilutionFactorPermyriad: "dilutionFactorPermyriad",
  conditioned: "conditioned",
  indicatorAdded: "indicatorAdded",
  indicatorId: "indicatorId",
  tSimCentiseconds: "tSimCentiseconds"
} as const);

function fail(code: AcidBaseTitrationErrorCode, message: string): never {
  throw new AcidBaseTitrationModelError(code, message);
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function field(
  fields: readonly GenericStateField[],
  key: string
): GenericStateField["value"] {
  const match = fields.find((candidate) => candidate.key === key);
  if (!match)
    fail(ACID_BASE_TITRATION_ERROR_CODES.invalidState, `Missing ${key}.`);
  return match.value;
}

function stringField(
  fields: readonly GenericStateField[],
  key: string
): string {
  const value = field(fields, key);
  if (typeof value !== "string")
    fail(ACID_BASE_TITRATION_ERROR_CODES.invalidState, `${key} must be text.`);
  return value;
}

function integerField(
  fields: readonly GenericStateField[],
  key: string
): number {
  const value = field(fields, key);
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    fail(
      ACID_BASE_TITRATION_ERROR_CODES.invalidState,
      `${key} must be a non-negative safe integer.`
    );
  return value;
}

function nonNegativeNumberField(
  fields: readonly GenericStateField[],
  key: string
): number {
  const value = field(fields, key);
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    fail(
      ACID_BASE_TITRATION_ERROR_CODES.invalidState,
      `${key} must be a non-negative finite number.`
    );
  return value;
}

function booleanField(
  fields: readonly GenericStateField[],
  key: string
): boolean {
  const value = field(fields, key);
  if (typeof value !== "boolean")
    fail(
      ACID_BASE_TITRATION_ERROR_CODES.invalidState,
      `${key} must be a boolean.`
    );
  return value;
}

function indicatorField(fields: readonly GenericStateField[]): IndicatorId {
  const value = stringField(fields, FIELD.indicatorId);
  if (!Object.hasOwn(INDICATOR_SPECIFICATIONS, value))
    fail(
      ACID_BASE_TITRATION_ERROR_CODES.invalidState,
      `${value} is not a registered indicator.`
    );
  return value as IndicatorId;
}

function equipmentStateField(
  equipment: readonly Readonly<GenericEquipmentState>[],
  instanceId: string,
  key: string
): GenericStateField["value"] | undefined {
  return equipment
    .find((candidate) => candidate.instanceId === instanceId)
    ?.fields.find((candidate) => candidate.key === key)?.value;
}

function numberParameter(
  action: Readonly<NormalizedLabAction>,
  key: string
): number {
  const parameter = action.parameters.find(
    (candidate) => candidate.key === key
  );
  if (!parameter || parameter.valueType !== "number")
    fail(
      ACID_BASE_TITRATION_ERROR_CODES.invalidTransition,
      `Action ${action.actionId} is missing numeric parameter ${key}.`
    );
  return parameter.value;
}

function stringParameter(
  action: Readonly<NormalizedLabAction>,
  key: string
): string {
  const parameter = action.parameters.find(
    (candidate) => candidate.key === key
  );
  if (
    !parameter ||
    (parameter.valueType !== "enum" && parameter.valueType !== "string")
  )
    fail(
      ACID_BASE_TITRATION_ERROR_CODES.invalidTransition,
      `Action ${action.actionId} is missing text parameter ${key}.`
    );
  return parameter.value;
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
      ACID_BASE_TITRATION_ERROR_CODES.unsupportedMaterial,
      "The solution concentration is outside the exact supported precision."
    );
  }
  return scaled;
}

function scaledCentiseconds(durationS: number): number {
  const scaled = Math.round(durationS * TIME_SCALE);
  const tolerance = Math.max(
    Number.EPSILON * 16,
    Math.abs(durationS) * Number.EPSILON * 16
  );
  if (
    !Number.isFinite(durationS) ||
    durationS <= 0 ||
    !Number.isSafeInteger(scaled) ||
    scaled <= 0 ||
    Math.abs(scaled / TIME_SCALE - durationS) > tolerance
  ) {
    fail(
      ACID_BASE_TITRATION_ERROR_CODES.invalidTransition,
      "Delivery duration must be a positive centisecond-exact number of seconds."
    );
  }
  return scaled;
}

interface AcidBaseModelView {
  readonly flaskEquipmentInstanceId: string;
  readonly buretteEquipmentInstanceId: string;
  readonly titrantMaterialInstanceId: string;
  readonly config: AcidBaseTitrationChemistryConfig;
  /** Legacy-parity raw float accumulation of delivered titrant. */
  readonly deliveredTitrantML: number;
  /** The raw accumulation before the most recent delivery. */
  readonly deliveredTitrantMLBefore: number;
  readonly deliveredTitrantUnits: number;
  readonly dilutionFactor: number;
  readonly conditioned: boolean;
  readonly indicatorAdded: boolean;
  readonly indicator: IndicatorId;
  readonly tSim: number;
}

function view(state: readonly GenericStateField[]): AcidBaseModelView {
  const deliveredTitrantUnits = integerField(
    state,
    FIELD.deliveredTitrantUnits
  );
  return {
    flaskEquipmentInstanceId: stringField(
      state,
      FIELD.flaskEquipmentInstanceId
    ),
    buretteEquipmentInstanceId: stringField(
      state,
      FIELD.buretteEquipmentInstanceId
    ),
    titrantMaterialInstanceId: stringField(
      state,
      FIELD.titrantMaterialInstanceId
    ),
    config: {
      // Registered reagent profiles carry no weak-acid pKa metadata, so the
      // native model supports strong monoprotic analytes only; initialization
      // fails closed for anything else.
      analyte: {
        type: "strong_acid",
        concentrationM:
          integerField(state, FIELD.analyteConcentrationMicromolar) /
          CONCENTRATION_SCALE,
        volumeML: integerUnitsToQuantity(
          integerField(state, FIELD.analyteVolumeUnits),
          ML_UNIT_ID
        )
      },
      titrant: {
        concentrationM:
          integerField(state, FIELD.titrantConcentrationMicromolar) /
          CONCENTRATION_SCALE
      }
    },
    deliveredTitrantML: nonNegativeNumberField(
      state,
      FIELD.deliveredTitrantMLRaw
    ),
    deliveredTitrantMLBefore: nonNegativeNumberField(
      state,
      FIELD.deliveredTitrantMLRawBefore
    ),
    deliveredTitrantUnits,
    dilutionFactor:
      integerField(state, FIELD.dilutionFactorPermyriad) / DILUTION_SCALE,
    conditioned: booleanField(state, FIELD.conditioned),
    indicatorAdded: booleanField(state, FIELD.indicatorAdded),
    indicator: indicatorField(state),
    tSim: integerField(state, FIELD.tSimCentiseconds) / TIME_SCALE
  };
}

function withFields(
  state: readonly GenericStateField[],
  updates: Readonly<Record<string, GenericStateField["value"]>>
): readonly GenericStateField[] {
  return state.map((entry) =>
    Object.hasOwn(updates, entry.key)
      ? { key: entry.key, value: updates[entry.key]! }
      : { ...entry }
  );
}

function initialState(
  context: Readonly<GenericChemistryModuleInitializationContext>
): readonly GenericStateField[] {
  const flasks = context.equipmentBindings.filter(
    ({ equipmentDefinitionId }) => equipmentDefinitionId === FLASK_COMPONENT_ID
  );
  const burettes = context.equipmentBindings.filter(
    ({ equipmentDefinitionId }) =>
      equipmentDefinitionId === BURETTE_COMPONENT_ID
  );
  if (flasks.length !== 1 || burettes.length !== 1) {
    fail(
      ACID_BASE_TITRATION_ERROR_CODES.unsupportedSetup,
      "Acid-base titration requires exactly one registered flask and one registered burette."
    );
  }
  const flask = flasks[0]!;
  const burette = burettes[0]!;

  const acidBaseBindings = context.materialBindings.filter(
    ({ providedChemistryCapabilityIds }) =>
      providedChemistryCapabilityIds.includes(ACID_BASE_CAPABILITY_ID)
  );
  const analytes = acidBaseBindings.filter(
    ({ containerInstanceId }) => containerInstanceId === flask.instanceId
  );
  const titrants = acidBaseBindings.filter(
    ({ containerInstanceId }) => containerInstanceId !== flask.instanceId
  );
  const indicators = context.materialBindings.filter(
    ({ providedChemistryCapabilityIds }) =>
      providedChemistryCapabilityIds.includes(INDICATOR_CAPABILITY_ID)
  );
  const waters = context.materialBindings.filter(
    ({ materialProfileId }) => materialProfileId === WATER_PROFILE_ID
  );
  if (
    analytes.length !== 1 ||
    titrants.length !== 1 ||
    indicators.length !== 1 ||
    acidBaseBindings.length + indicators.length + waters.length !==
      context.materialBindings.length
  ) {
    fail(
      ACID_BASE_TITRATION_ERROR_CODES.unsupportedMaterial,
      "This model supports exactly one flask-bound analyte, one titrant, one indicator, and optional distilled water."
    );
  }
  const analyte = analytes[0]!;
  const titrant = titrants[0]!;
  const indicatorBinding = indicators[0]!;
  for (const solution of [analyte, titrant]) {
    if (
      solution.materialPhase !== "aqueous_solution" ||
      solution.quantityUnitId !== ML_UNIT_ID ||
      solution.initialConcentrationM === null
    ) {
      fail(
        ACID_BASE_TITRATION_ERROR_CODES.unsupportedMaterial,
        "The analyte and titrant must be registered aqueous solutions with exact concentrations."
      );
    }
  }
  if (
    waters.some(
      (binding) =>
        binding.materialPhase !== "pure_liquid" ||
        binding.quantityUnitId !== ML_UNIT_ID ||
        binding.initialConcentrationM !== null
    )
  ) {
    fail(
      ACID_BASE_TITRATION_ERROR_CODES.unsupportedMaterial,
      "The rinse solvent must be registered distilled water without solute concentration."
    );
  }
  const indicatorId = INDICATOR_PROFILE_IDS[indicatorBinding.materialProfileId];
  if (!indicatorId) {
    fail(
      ACID_BASE_TITRATION_ERROR_CODES.unsupportedMaterial,
      "The bound indicator profile has no registered indicator response."
    );
  }

  const analyteLedger = context.materialLedger.materials.find(
    ({ materialInstanceId }) => materialInstanceId === analyte.instanceId
  );
  const titrantLedger = context.materialLedger.materials.find(
    ({ materialInstanceId }) => materialInstanceId === titrant.instanceId
  );
  if (
    !analyteLedger ||
    !titrantLedger ||
    analyteLedger.unitId !== ML_UNIT_ID ||
    titrantLedger.unitId !== ML_UNIT_ID
  ) {
    fail(
      ACID_BASE_TITRATION_ERROR_CODES.unsupportedSetup,
      "The material ledger does not carry milliliter entries for the analyte and titrant."
    );
  }
  const analyteVolumeML =
    analyteLedger.locations.find(
      ({ equipmentInstanceId }) => equipmentInstanceId === flask.instanceId
    )?.amount ?? 0;
  const analyteVolumeUnits = quantityToIntegerUnits(
    analyteVolumeML,
    ML_UNIT_ID
  );
  if (analyteVolumeUnits <= 0) {
    fail(
      ACID_BASE_TITRATION_ERROR_CODES.unsupportedSetup,
      "The analyte must start inside the registered flask."
    );
  }
  const deliveredTitrantML =
    titrantLedger.locations.find(
      ({ equipmentInstanceId }) => equipmentInstanceId === flask.instanceId
    )?.amount ?? 0;
  const deliveredTitrantUnits = quantityToIntegerUnits(
    deliveredTitrantML,
    ML_UNIT_ID
  );

  /*
   * A seeded bench arrives through equipment truth: the burette's recorded
   * conditioning solvent and the flask's committed indicator addition are
   * runtime-owned mechanical state, so initialization reads them rather than
   * assuming a ground-state bench. A fresh bench reports null/false and keeps
   * the previous behavior exactly. Synthetic contexts without those equipment
   * states also fall back to the ground-state defaults.
   */
  const conditionedWith = equipmentStateField(
    context.equipment,
    burette.instanceId,
    "conditionedWith"
  );
  const conditioned = conditionedWith === "titrant";
  const indicatorAdded =
    equipmentStateField(
      context.equipment,
      flask.instanceId,
      "indicatorAdded"
    ) === true;
  const simulatedElapsedSeconds = context.simulatedElapsedSeconds ?? 0;
  const tSimCentiseconds =
    simulatedElapsedSeconds === 0
      ? 0
      : scaledCentiseconds(simulatedElapsedSeconds);

  return [
    { key: FIELD.flaskEquipmentInstanceId, value: flask.instanceId },
    { key: FIELD.buretteEquipmentInstanceId, value: burette.instanceId },
    { key: FIELD.titrantMaterialInstanceId, value: titrant.instanceId },
    {
      key: FIELD.analyteConcentrationMicromolar,
      value: scaledConcentration(analyte.initialConcentrationM!)
    },
    { key: FIELD.analyteVolumeUnits, value: analyteVolumeUnits },
    {
      key: FIELD.titrantConcentrationMicromolar,
      value: scaledConcentration(titrant.initialConcentrationM!)
    },
    { key: FIELD.deliveredTitrantUnits, value: deliveredTitrantUnits },
    { key: FIELD.deliveredTitrantMLRaw, value: deliveredTitrantML },
    { key: FIELD.deliveredTitrantMLRawBefore, value: deliveredTitrantML },
    {
      key: FIELD.dilutionFactorPermyriad,
      value:
        conditionedWith === "water"
          ? Math.round(WATER_RINSE_DILUTION * DILUTION_SCALE)
          : DILUTION_SCALE
    },
    { key: FIELD.conditioned, value: conditioned },
    { key: FIELD.indicatorAdded, value: indicatorAdded },
    { key: FIELD.indicatorId, value: indicatorId },
    { key: FIELD.tSimCentiseconds, value: tSimCentiseconds }
  ];
}

/**
 * Titrant units delivered by this dispense. Executed material transfers into
 * the flask are the ground truth; the authored volume parameter is only used
 * when the runtime supplied no material action (e.g. synthetic test contexts).
 */
function dispensedTitrantUnits(
  context: Readonly<GenericChemistryActionContext>,
  flaskEquipmentInstanceId: string,
  titrantMaterialInstanceId: string
): number {
  if (context.materialAction) {
    let units = 0;
    for (const transfer of context.materialAction.transfers) {
      if (
        transfer.materialInstanceId !== titrantMaterialInstanceId ||
        transfer.targetEquipmentInstanceId !== flaskEquipmentInstanceId
      ) {
        continue;
      }
      if (transfer.unitId !== ML_UNIT_ID) {
        fail(
          ACID_BASE_TITRATION_ERROR_CODES.invalidTransition,
          "Titrant delivery must be a milliliter transfer."
        );
      }
      units += quantityToIntegerUnits(transfer.amount, transfer.unitId, false);
    }
    return units;
  }
  return quantityToIntegerUnits(
    numberParameter(context.action, "volumeML"),
    ML_UNIT_ID,
    false
  );
}

/**
 * Raw milliliters delivered by this dispense for the legacy-parity float
 * accumulation. Executed transfers into the flask are the ground truth,
 * exactly as for the integer measure; without a material action the authored
 * volume parameter is used.
 */
function dispensedTitrantMLRaw(
  context: Readonly<GenericChemistryActionContext>,
  flaskEquipmentInstanceId: string,
  titrantMaterialInstanceId: string
): number {
  if (context.materialAction) {
    let amount = 0;
    for (const transfer of context.materialAction.transfers) {
      if (
        transfer.materialInstanceId !== titrantMaterialInstanceId ||
        transfer.targetEquipmentInstanceId !== flaskEquipmentInstanceId
      ) {
        continue;
      }
      amount += transfer.amount;
    }
    return amount;
  }
  return numberParameter(context.action, "volumeML");
}

function applyActionTransition(
  context: Readonly<GenericChemistryActionContext>,
  state: readonly GenericStateField[]
): { readonly state: readonly GenericStateField[] } {
  switch (context.action.actionId) {
    case "action.rinse.v1": {
      const solvent = stringParameter(context.action, "solvent");
      if (solvent !== "water" && solvent !== "titrant") {
        fail(
          ACID_BASE_TITRATION_ERROR_CODES.invalidTransition,
          `Unsupported rinse solvent ${solvent}.`
        );
      }
      const conditioned = solvent === "titrant";
      return {
        state: withFields(state, {
          [FIELD.conditioned]: conditioned,
          [FIELD.dilutionFactorPermyriad]: conditioned
            ? DILUTION_SCALE
            : Math.round(WATER_RINSE_DILUTION * DILUTION_SCALE)
        })
      };
    }
    case "action.dispense.v1": {
      const flaskEquipmentInstanceId = stringField(
        state,
        FIELD.flaskEquipmentInstanceId
      );
      const titrantMaterialInstanceId = stringField(
        state,
        FIELD.titrantMaterialInstanceId
      );
      const units = dispensedTitrantUnits(
        context,
        flaskEquipmentInstanceId,
        titrantMaterialInstanceId
      );
      const durationCentiseconds = scaledCentiseconds(
        numberParameter(context.action, "durationS")
      );
      const deliveredTitrantUnits =
        integerField(state, FIELD.deliveredTitrantUnits) + units;
      const tSimCentiseconds =
        integerField(state, FIELD.tSimCentiseconds) + durationCentiseconds;
      if (
        !Number.isSafeInteger(deliveredTitrantUnits) ||
        !Number.isSafeInteger(tSimCentiseconds)
      ) {
        fail(
          ACID_BASE_TITRATION_ERROR_CODES.invalidTransition,
          "The delivery exceeds deterministic numeric bounds."
        );
      }
      // Legacy raw double accumulation: before + volumeML, in action order.
      const deliveredTitrantMLRawBefore = nonNegativeNumberField(
        state,
        FIELD.deliveredTitrantMLRaw
      );
      const deliveredTitrantMLRaw =
        deliveredTitrantMLRawBefore +
        dispensedTitrantMLRaw(
          context,
          flaskEquipmentInstanceId,
          titrantMaterialInstanceId
        );
      return {
        state: withFields(state, {
          [FIELD.deliveredTitrantUnits]: deliveredTitrantUnits,
          [FIELD.deliveredTitrantMLRaw]: deliveredTitrantMLRaw,
          [FIELD.deliveredTitrantMLRawBefore]: deliveredTitrantMLRawBefore,
          [FIELD.tSimCentiseconds]: tSimCentiseconds
        })
      };
    }
    case "action.add_indicator.v1":
    case "action.select_indicator.v1": {
      const indicator = stringParameter(context.action, "indicator");
      if (!Object.hasOwn(INDICATOR_SPECIFICATIONS, indicator)) {
        fail(
          ACID_BASE_TITRATION_ERROR_CODES.invalidTransition,
          `Unsupported indicator ${indicator}.`
        );
      }
      return {
        state: withFields(state, {
          [FIELD.indicatorAdded]: true,
          [FIELD.indicatorId]: indicator
        })
      };
    }
    // Filling and reading change equipment, never solution chemistry. Other
    // adapters' actions may also flow through this program unchanged.
    default:
      return { state: state.map((entry) => ({ ...entry })) };
  }
}

function equipmentById(
  context: Readonly<GenericChemistryActionContext>,
  instanceId: string
): Readonly<GenericEquipmentState> {
  const match = context.equipment.find(
    (candidate) => candidate.instanceId === instanceId
  );
  if (!match) {
    fail(
      ACID_BASE_TITRATION_ERROR_CODES.invalidTransition,
      `Equipment ${instanceId} is missing from the annotation context.`
    );
  }
  return match;
}

function numericEquipmentField(
  equipment: Readonly<GenericEquipmentState>,
  key: string
): number {
  const value = equipment.fields.find(
    (candidate) => candidate.key === key
  )?.value;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(
      ACID_BASE_TITRATION_ERROR_CODES.invalidTransition,
      `Equipment ${equipment.instanceId} is missing numeric field ${key}.`
    );
  }
  return value;
}

function annotateEvents(
  context: Readonly<GenericChemistryActionContext>,
  state: readonly GenericStateField[],
  events: readonly SemanticEvent[]
): readonly SemanticEvent[] {
  const model = view(state);
  return events.map((event): SemanticEvent => {
    switch (event.type) {
      case "rinse_burette": {
        const solvent = stringParameter(context.action, "solvent");
        const conditioned = solvent === "titrant";
        const evidence: SkillEvidence[] = [
          {
            skillId: "burette_conditioning",
            delta: conditioned ? 0.8 : -0.9,
            reason: conditioned
              ? "conditioned_with_titrant"
              : "rinsed_with_water"
          }
        ];
        return {
          type: event.type,
          tSim: model.tSim,
          observation: { solvent },
          flags: conditioned ? [] : ["burette_not_conditioned"],
          evidence
        };
      }
      case "fill_burette":
      case "refill_burette": {
        const burette = equipmentById(
          context,
          model.buretteEquipmentInstanceId
        );
        return {
          type: event.type,
          tSim: model.tSim,
          observation: {
            requestedML: round(numberParameter(context.action, "volumeML"), 2),
            resultingAvailableML: round(
              numericEquipmentField(burette, "availableML"),
              2
            ),
            currentReadingML: round(
              numericEquipmentField(burette, "meniscusReadingML"),
              2
            ),
            fillKind: event.type === "fill_burette" ? "initial" : "refill"
          },
          flags: [],
          evidence: []
        };
      }
      case "select_indicator": {
        return {
          type: event.type,
          tSim: model.tSim,
          observation: { indicator: model.indicator },
          flags: [],
          evidence: []
        };
      }
      case "add_titrant": {
        const burette = equipmentById(
          context,
          model.buretteEquipmentInstanceId
        );
        const volumeML = numberParameter(context.action, "volumeML");
        const durationS = numberParameter(context.action, "durationS");
        if (!(durationS > 0)) {
          fail(
            ACID_BASE_TITRATION_ERROR_CODES.invalidTransition,
            "Delivery time must be a positive number."
          );
        }
        // Legacy-parity raw accumulation, pinned by the parity oracle.
        const after = model.deliveredTitrantML;
        const before = model.deliveredTitrantMLBefore;
        const equivalenceML = equivalenceVolumeML(
          model.config,
          model.dilutionFactor
        );
        const rate = volumeML / durationS;
        const nearEndpoint =
          Math.abs(after - equivalenceML) <= NEAR_ENDPOINT_ML ||
          Math.abs(before - equivalenceML) <= NEAR_ENDPOINT_ML;
        const pH = computePH(model.config, after, model.dilutionFactor);
        const color = observedColor(model.indicator, pH);
        const flags: string[] = [];
        const evidence: SkillEvidence[] = [];

        if (nearEndpoint && rate > FAST_RATE_ML_PER_S) {
          flags.push("flow_rate_high_near_endpoint");
          evidence.push({
            skillId: "endpoint_control",
            delta: -0.7,
            reason: "flow_rate_high_near_endpoint",
            detail: { rateMlPerS: round(rate, 2) }
          });
        } else if (nearEndpoint) {
          evidence.push({
            skillId: "endpoint_control",
            delta: 0.5,
            reason: "controlled_addition_near_endpoint"
          });
        }

        if (
          after > equivalenceML + OVERSHOOT_TOLERANCE_ML &&
          before <= equivalenceML + OVERSHOOT_TOLERANCE_ML
        ) {
          flags.push("endpoint_overshoot");
          evidence.push({
            skillId: "endpoint_control",
            delta: -0.9,
            reason: "endpoint_overshoot",
            detail: { overshootML: round(after - equivalenceML, 2) }
          });
        }

        if (!model.conditioned) {
          flags.push("burette_not_conditioned");
        }

        return {
          type: event.type,
          tSim: model.tSim,
          observation: {
            addedML: round(volumeML, 2),
            totalML: round(after, 2),
            cumulativeDeliveredML: round(after, 2),
            currentReadingML: round(
              numericEquipmentField(burette, "meniscusReadingML"),
              2
            ),
            availableML: round(
              numericEquipmentField(burette, "availableML"),
              2
            ),
            rateMlPerS: round(rate, 2),
            pH: round(pH, 2),
            observedColor: color,
            equivalenceML: round(equivalenceML, 2)
          },
          flags,
          evidence
        };
      }
      case "read_meniscus": {
        const burette = equipmentById(
          context,
          model.buretteEquipmentInstanceId
        );
        const reportedML = numberParameter(context.action, "reportedML");
        const trueReading = numericEquipmentField(
          burette,
          "meniscusReadingML"
        );
        const errorML = reportedML - trueReading;
        const withinTolerance = Math.abs(errorML) <= 0.05;
        return {
          type: event.type,
          tSim: model.tSim,
          observation: {
            reportedML,
            trueML: round(trueReading, 2),
            errorML: round(errorML, 2)
          },
          flags: withinTolerance ? [] : ["meniscus_misread"],
          evidence: [
            {
              skillId: "volumetric_reading",
              delta: withinTolerance ? 0.6 : -0.6,
              reason: withinTolerance ? "meniscus_read_ok" : "meniscus_misread"
            }
          ]
        };
      }
      default:
        return {
          type: event.type,
          tSim: event.tSim,
          observation: { ...event.observation },
          flags: [...event.flags],
          evidence: event.evidence.map((entry) => ({
            ...entry,
            ...(entry.detail ? { detail: { ...entry.detail } } : {})
          }))
        };
    }
  });
}

function observables(
  state: readonly GenericStateField[]
): readonly GenericObservable[] {
  const model = view(state);
  const pH = computePH(
    model.config,
    model.deliveredTitrantML,
    model.dilutionFactor
  );
  const delivered = model.deliveredTitrantUnits > 0;
  const color = delivered
    ? observedColor(model.indicator, pH)
    : "not yet observed";
  const endpointObserved =
    delivered &&
    observedColor(model.indicator, pH) !==
      INDICATOR_SPECIFICATIONS[model.indicator].low;
  // observable.burette_reading_ml.v1 is deliberately not derived here: the
  // burette reading is equipment truth, not solution chemistry, and needs an
  // equipment-owned projection home in the native runtime (Phase 2/3).
  return [
    {
      observableId: ACID_BASE_TITRATION_OBSERVABLE_IDS.endpointObserved,
      value: endpointObserved
    },
    {
      observableId: ACID_BASE_TITRATION_OBSERVABLE_IDS.observedColor,
      value: color
    },
    {
      observableId: ACID_BASE_TITRATION_OBSERVABLE_IDS.pH,
      value: round(pH, 2)
    }
  ];
}

function deriveGroundTruthValues(
  state: readonly GenericStateField[]
): Readonly<Record<string, number>> {
  const model = view(state);
  return {
    trueAnalyteMolarity: model.config.analyte.concentrationM,
    equivalenceVolumeML: equivalenceVolumeML(
      model.config,
      model.dilutionFactor
    ),
    titrantDilutionFactor: model.dilutionFactor
  };
}

/**
 * Deterministic ground-truth notes, byte-identical to the legacy engine's
 * computeGroundTruth: an unconditioned burette biases the measured endpoint
 * volume long. The parity oracle pins this exact sentence for a water rinse.
 */
function deriveGroundTruthNotes(
  state: readonly GenericStateField[]
): readonly string[] {
  const model = view(state);
  if (model.conditioned) return [];
  return [
    "Burette was conditioned with water, so the titrant is effectively dilute: the measured " +
      "endpoint volume runs long and the student's computed molarity will be biased high."
  ];
}

export const ACID_BASE_TITRATION_MODULE: GenericChemistryModule = Object.freeze(
  {
    id: ACID_BASE_TITRATION_MODEL_ID,
    version: "1.0.0",
    providedCapabilityIds: [
      "chemistry.acid_base_equilibrium.v1",
      "chemistry.indicator_response.v1",
      "chemistry.instrument_observables.v1"
    ] as const,
    requiredCapabilityIds: [
      "chemistry.material_ledger.v1",
      "chemistry.volume_conservation.v1",
      "chemistry.solution_mixing.v1"
    ] as const,
    initialize: initialState,
    applyMaterialAction: () =>
      fail(
        ACID_BASE_TITRATION_ERROR_CODES.materialActionPathUnsupported,
        "The acid-base titration model transitions through applyActionTransition only."
      ),
    applyActionTransition,
    annotateEvents,
    deriveObservables: observables,
    deriveGroundTruthValues,
    deriveGroundTruthNotes
  }
);
