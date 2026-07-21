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
  endpointObserved: "observable.endpoint_observed.v1",
  indicatorSuitable: "observable.indicator_suitable.v1"
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
export type AcidBaseSpeciesType =
  | "strong_acid"
  | "weak_acid"
  | "strong_base"
  | "weak_base";
export type AnalyteType = AcidBaseSpeciesType;
export type TitrantType = AcidBaseSpeciesType;

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
    pKb?: number;
  };
  titrant: {
    /** Legacy configurations omit this because the original titrant was NaOH. */
    type?: TitrantType;
    concentrationM: number;
    pKa?: number;
    pKb?: number;
  };
}

const KW = 1e-14;

/*
 * Fixed iteration count for the weak-acid bisection. Chosen so the bracket
 * below collapses to well under float precision; a fixed count (rather than a
 * convergence tolerance) keeps the solve bit-identical across platforms, which
 * the replay/determinism contract requires.
 */
const CHARGE_BALANCE_BISECTION_STEPS = 200;
const H_BRACKET_LOW = 1e-20;
const H_BRACKET_HIGH = 10;

/**
 * Hydrogen-ion concentration from the charge balance, including water
 * autoionization and any registered weak acid/base pair.
 *
 * Strong acid, with `excess` the signed analytical excess of acid over added
 * strong base, solves [H+]^2 - excess*[H+] - Kw = 0 exactly. Both branches sum
 * positive quantities, so neither loses precision to cancellation, and they
 * agree at excess = 0 (giving [H+] = 1e-7, pH 7) without a float-equality test.
 *
 * Weak species solve the full balance
 *   [H+] + C(strong base) + Cb[H+]/([H+] + Ka_BH+)
 *     = Kw/[H+] + C(strong acid) + CaKa/(Ka + [H+])
 * whose left-minus-right is strictly increasing in [H+], so bisection converges
 * on the unique root. This is continuous across the whole titration — initial
 * point, buffer region, equivalence, and excess base — replacing the previous
 * piecewise branches whose seams were discontinuous.
 */
function hydrogenConcentration(
  strongAcidM: number,
  strongBaseM: number,
  weakAcidM: number,
  weakAcidKa: number | null,
  weakBaseM: number,
  weakBaseConjugateAcidKa: number | null
): number {
  if (weakAcidKa === null && weakBaseConjugateAcidKa === null) {
    const excess = strongAcidM - strongBaseM;
    const root = Math.sqrt(excess * excess + 4 * KW);
    if (excess >= 0) return (excess + root) / 2;
    return KW / ((-excess + root) / 2);
  }

  const charge = (h: number): number =>
    strongBaseM +
    h -
    KW / h -
    strongAcidM +
    (weakBaseConjugateAcidKa === null
      ? 0
      : (weakBaseM * h) / (h + weakBaseConjugateAcidKa)) -
    (weakAcidKa === null ? 0 : (weakAcidM * weakAcidKa) / (weakAcidKa + h));

  let low = H_BRACKET_LOW;
  let high = H_BRACKET_HIGH;
  for (let step = 0; step < CHARGE_BALANCE_BISECTION_STEPS; step += 1) {
    const mid = (low + high) / 2;
    if (charge(mid) < 0) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/**
 * Calculate pH as a deterministic function of total titrant added.
 *
 * This uses the source contract's AP/general-chemistry approximations:
 * monoprotic analyte, strong-base titrant, 25 °C, and activity approximately
 * equal to concentration. Water autoionization is carried explicitly so the
 * curve stays finite and monotonic through the equivalence point.
 */
export function computePH(
  config: AcidBaseTitrationChemistryConfig,
  totalTitrantML: number,
  dilutionFactor: number
): number {
  const { analyte, titrant } = config;
  const analyteVolumeL = analyte.volumeML / 1000;
  const titrantConcentration = titrant.concentrationM * dilutionFactor;
  const titrantVolumeL = totalTitrantML / 1000;

  const analyteMoles = analyte.concentrationM * analyteVolumeL;
  const titrantMoles = titrantConcentration * titrantVolumeL;
  const totalVolumeL = analyteVolumeL + titrantVolumeL;

  const titrantType = titrant.type ?? "strong_base";
  const species = [
    {
      type: analyte.type,
      concentrationM: analyteMoles / totalVolumeL,
      pKa: analyte.pKa,
      pKb: analyte.pKb
    },
    {
      type: titrantType,
      concentrationM: titrantMoles / totalVolumeL,
      pKa: titrant.pKa,
      pKb: titrant.pKb
    }
  ] as const;
  let strongAcidM = 0;
  let strongBaseM = 0;
  let weakAcidM = 0;
  let weakAcidKa: number | null = null;
  let weakBaseM = 0;
  let weakBaseConjugateAcidKa: number | null = null;
  for (const entry of species) {
    switch (entry.type) {
      case "strong_acid":
        strongAcidM += entry.concentrationM;
        break;
      case "strong_base":
        strongBaseM += entry.concentrationM;
        break;
      case "weak_acid":
        if (entry.pKa === undefined)
          throw new Error("A weak acid requires a registered pKa.");
        weakAcidM += entry.concentrationM;
        weakAcidKa = 10 ** -entry.pKa;
        break;
      case "weak_base":
        if (entry.pKb === undefined)
          throw new Error("A weak base requires a registered pKb.");
        weakBaseM += entry.concentrationM;
        weakBaseConjugateAcidKa = KW / 10 ** -entry.pKb;
        break;
    }
  }

  return -Math.log10(
    hydrogenConcentration(
      strongAcidM,
      strongBaseM,
      weakAcidM,
      weakAcidKa,
      weakBaseM,
      weakBaseConjugateAcidKa
    )
  );
}

/** Volume of titrant in mL required to reach the equivalence point. */
export function equivalenceVolumeML(
  config: AcidBaseTitrationChemistryConfig,
  dilutionFactor = 1
): number {
  const analyteMoles =
    config.analyte.concentrationM * (config.analyte.volumeML / 1000);
  const effectiveTitrantConcentration =
    config.titrant.concentrationM * dilutionFactor;
  return (analyteMoles / effectiveTitrantConcentration) * 1000;
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

const INDICATOR_VOLUME_BISECTION_STEPS = 160;
export const INDICATOR_ENDPOINT_TOLERANCE_ML = OVERSHOOT_TOLERANCE_ML;

function analyteIsAcid(config: AcidBaseTitrationChemistryConfig): boolean {
  return config.analyte.type.endsWith("_acid");
}

function hasWeakSpecies(config: AcidBaseTitrationChemistryConfig): boolean {
  return (
    config.analyte.type.startsWith("weak_") ||
    (config.titrant.type ?? "strong_base").startsWith("weak_")
  );
}

/**
 * Locates the midpoint of an indicator transition on the deterministic
 * titration curve. The curve is monotonic for an opposing monoprotic pair, so
 * fixed-step bisection converges on its unique crossing without a tolerance or
 * wall-clock-dependent exit.
 */
export function indicatorTransitionVolumeML(
  config: AcidBaseTitrationChemistryConfig,
  indicator: IndicatorId,
  dilutionFactor = 1
): number | null {
  const targetPH =
    (INDICATOR_SPECIFICATIONS[indicator].lowMax +
      INDICATOR_SPECIFICATIONS[indicator].highMin) /
    2;
  let low = 0;
  let high = equivalenceVolumeML(config, dilutionFactor) * 2;
  const lowPH = computePH(config, low, dilutionFactor);
  const highPH = computePH(config, high, dilutionFactor);
  if (targetPH < Math.min(lowPH, highPH) || targetPH > Math.max(lowPH, highPH))
    return null;
  const increases = analyteIsAcid(config);
  for (let step = 0; step < INDICATOR_VOLUME_BISECTION_STEPS; step += 1) {
    const mid = (low + high) / 2;
    const pH = computePH(config, mid, dilutionFactor);
    if ((increases && pH < targetPH) || (!increases && pH > targetPH))
      low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

export function indicatorIsSuitable(
  config: AcidBaseTitrationChemistryConfig,
  indicator: IndicatorId,
  dilutionFactor = 1
): boolean {
  const transitionVolumeML = indicatorTransitionVolumeML(
    config,
    indicator,
    dilutionFactor
  );
  return (
    transitionVolumeML !== null &&
    Math.abs(
      transitionVolumeML - equivalenceVolumeML(config, dilutionFactor)
    ) <= INDICATOR_ENDPOINT_TOLERANCE_ML
  );
}

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
const PK_SCALE = 1_000;
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
  analyteSpeciesType: "analyteSpeciesType",
  analytePKMilli: "analytePKMilli",
  analyteConcentrationMicromolar: "analyteConcentrationMicromolar",
  analyteVolumeUnits: "analyteVolumeUnits",
  titrantSpeciesType: "titrantSpeciesType",
  titrantPKMilli: "titrantPKMilli",
  titrantConcentrationMicromolar: "titrantConcentrationMicromolar",
  deliveredTitrantUnits: "deliveredTitrantUnits",
  /*
   * Legacy-parity floating-point accumulation of delivered titrant. The
   * legacy engine accumulated raw double additions (before + volumeML), so
   * these fields reproduce that float path exactly while the integer-unit
   * field stays the ledger-consistent measure.
   *
   * The accumulated value lands near but rarely exactly on the equivalence
   * point (25.000000000000085 after 250 additions of 0.1 mL). computePH now
   * carries water autoionization through the charge balance, so that residue
   * resolves to pH 7 instead of diverging; the oracle previously pinned a pH
   * of -2.11 here, which was a defect in the solver rather than behavior
   * worth preserving.
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

function speciesTypeField(
  fields: readonly GenericStateField[],
  key: string
): AcidBaseSpeciesType {
  const value = stringField(fields, key);
  if (
    value !== "strong_acid" &&
    value !== "weak_acid" &&
    value !== "strong_base" &&
    value !== "weak_base"
  ) {
    fail(
      ACID_BASE_TITRATION_ERROR_CODES.invalidState,
      `${key} is not a registered acid/base species type.`
    );
  }
  return value;
}

function dissociationFields(
  type: AcidBaseSpeciesType,
  pKMilli: number
): { readonly pKa?: number; readonly pKb?: number } {
  if (type === "weak_acid") return { pKa: pKMilli / PK_SCALE };
  if (type === "weak_base") return { pKb: pKMilli / PK_SCALE };
  return {};
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

function scaledPK(value: number): number {
  const scaled = Math.round(value * PK_SCALE);
  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    !Number.isSafeInteger(scaled) ||
    Math.abs(scaled / PK_SCALE - value) > Number.EPSILON * 32
  ) {
    fail(
      ACID_BASE_TITRATION_ERROR_CODES.unsupportedMaterial,
      "The registered dissociation value is outside the exact supported precision."
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
  const analyteType = speciesTypeField(state, FIELD.analyteSpeciesType);
  const titrantType = speciesTypeField(state, FIELD.titrantSpeciesType);
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
      analyte: {
        type: analyteType,
        concentrationM:
          integerField(state, FIELD.analyteConcentrationMicromolar) /
          CONCENTRATION_SCALE,
        volumeML: integerUnitsToQuantity(
          integerField(state, FIELD.analyteVolumeUnits),
          ML_UNIT_ID
        ),
        ...dissociationFields(
          analyteType,
          integerField(state, FIELD.analytePKMilli)
        )
      },
      titrant: {
        type: titrantType,
        concentrationM:
          integerField(state, FIELD.titrantConcentrationMicromolar) /
          CONCENTRATION_SCALE,
        ...dissociationFields(
          titrantType,
          integerField(state, FIELD.titrantPKMilli)
        )
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
  const analyteDissociation = analyte.acidBaseDissociation;
  const titrantDissociation = titrant.acidBaseDissociation;
  if (!analyteDissociation || !titrantDissociation) {
    fail(
      ACID_BASE_TITRATION_ERROR_CODES.unsupportedMaterial,
      "The analyte and titrant must carry registered acid/base dissociation metadata."
    );
  }
  const analyteIsAcid = analyteDissociation.type.endsWith("_acid");
  const titrantIsAcid = titrantDissociation.type.endsWith("_acid");
  if (analyteIsAcid === titrantIsAcid) {
    fail(
      ACID_BASE_TITRATION_ERROR_CODES.unsupportedMaterial,
      "The registered analyte and titrant must be an opposing acid/base pair."
    );
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
      key: FIELD.analyteSpeciesType,
      value: analyteDissociation.type
    },
    {
      key: FIELD.analytePKMilli,
      value:
        analyteDissociation.type === "weak_acid"
          ? scaledPK(analyteDissociation.pKa25C)
          : analyteDissociation.type === "weak_base"
            ? scaledPK(analyteDissociation.pKb25C)
            : 0
    },
    {
      key: FIELD.analyteConcentrationMicromolar,
      value: scaledConcentration(analyte.initialConcentrationM!)
    },
    { key: FIELD.analyteVolumeUnits, value: analyteVolumeUnits },
    {
      key: FIELD.titrantSpeciesType,
      value: titrantDissociation.type
    },
    {
      key: FIELD.titrantPKMilli,
      value:
        titrantDissociation.type === "weak_acid"
          ? scaledPK(titrantDissociation.pKa25C)
          : titrantDissociation.type === "weak_base"
            ? scaledPK(titrantDissociation.pKb25C)
            : 0
    },
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
        const suitable = indicatorIsSuitable(
          model.config,
          model.indicator,
          model.dilutionFactor
        );
        return {
          type: event.type,
          tSim: model.tSim,
          observation: { indicator: model.indicator },
          flags: suitable ? [] : ["indicator_unsuitable"],
          evidence:
            suitable && !hasWeakSpecies(model.config)
              ? []
              : [
                  {
                    skillId: "endpoint_control",
                    delta: suitable ? 0.4 : -0.8,
                    reason: suitable
                      ? "indicator_suitable_for_equivalence"
                      : "indicator_unsuitable_for_equivalence"
                  }
                ]
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
        const trueReading = numericEquipmentField(burette, "meniscusReadingML");
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
  const transitionVolumeML = indicatorTransitionVolumeML(
    model.config,
    model.indicator,
    model.dilutionFactor
  );
  const indicatorSuitable = indicatorIsSuitable(
    model.config,
    model.indicator,
    model.dilutionFactor
  );
  const endpointObserved =
    delivered &&
    indicatorSuitable &&
    transitionVolumeML !== null &&
    model.deliveredTitrantML >= transitionVolumeML;
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
    ...(hasWeakSpecies(model.config)
      ? [
          {
            observableId: ACID_BASE_TITRATION_OBSERVABLE_IDS.indicatorSuitable,
            value: indicatorSuitable
          }
        ]
      : []),
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
