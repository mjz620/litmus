import { assertIntegerQuantityConserved } from "../material-ledger";

/**
 * Deterministic 25 °C solubility-product truth for precipitation reactions.
 *
 * Concentrations are ideal molar concentrations. Activity coefficients,
 * complex-ion formation, and pH-coupled hydroxide speciation are intentionally
 * outside this AP/general-chemistry model; those approximations become poor in
 * concentrated electrolyte or strongly complexing solutions.
 */

export type SolutionId =
  | "silver_nitrate"
  | "sodium_chloride"
  | "barium_chloride"
  | "sodium_sulfate"
  | "sodium_nitrate"
  | "potassium_chloride"
  | "copper_sulfate"
  | "sodium_hydroxide"
  | "iron_iii_chloride"
  | "distilled_water";

export type PrecipitateId =
  | "silver_chloride"
  | "barium_sulfate"
  | "copper_ii_hydroxide"
  | "iron_iii_hydroxide";

export type IonFormula =
  | "Ag+"
  | "Ba2+"
  | "Cl-"
  | "Cu2+"
  | "Fe3+"
  | "K+"
  | "NO3-"
  | "Na+"
  | "OH-"
  | "SO4^2-";

export interface Ion {
  readonly formula: IonFormula;
  readonly charge: number;
  readonly coefficient: number;
}

export interface SolutionDefinition {
  readonly id: SolutionId;
  readonly label: string;
  readonly ions: readonly Ion[];
}

export interface SolubilityProductEntry {
  readonly precipitateId: PrecipitateId;
  readonly cation: IonFormula;
  readonly anion: IonFormula;
  readonly formula: string;
  readonly color: string;
  readonly cationCoefficient: number;
  readonly anionCoefficient: number;
  readonly ksp25C: number;
  readonly molarMassGPerMol: number;
  readonly source: string;
}

export interface PrecipitationResult {
  readonly formsPrecipitate: boolean;
  readonly precipitateId: PrecipitateId | null;
  readonly formula: string | null;
  readonly color: string;
  readonly netIonicEquation: string;
  readonly spectatorIons: readonly string[];
}

export interface IonInventoryInput {
  readonly volumeL: number;
  readonly ionMoles: Readonly<Partial<Record<IonFormula, number>>>;
}

export interface PrecipitationEquilibrium {
  readonly formsPrecipitate: boolean;
  readonly precipitateId: PrecipitateId | null;
  readonly formula: string | null;
  readonly color: string;
  readonly netIonicEquation: string;
  readonly spectatorIons: readonly string[];
  readonly totalVolumeL: number;
  readonly reactionQuotientBefore: number;
  readonly solubilityProduct: number | null;
  readonly saturationRatioBefore: number;
  readonly precipitateMoles: number;
  readonly precipitateMassG: number;
  readonly dissolvedIonConcentrationsM: Readonly<
    Partial<Record<IonFormula, number>>
  >;
  readonly conservedIonMoles: Readonly<Partial<Record<IonFormula, number>>>;
}

export interface SolutionPortion {
  readonly solutionId: SolutionId;
  readonly concentrationM: number;
  readonly volumeML: number;
}

/** Fixed count makes replay independent of platform timing or tolerance exits. */
export const PRECIPITATION_BISECTION_STEPS = 200;
/** Integer femtomoles retain 10^-9 M classroom dilution cases exactly enough. */
export const ION_AMOUNT_SCALE = 1_000_000_000_000_000;

function ion(formula: IonFormula, charge: number, coefficient: number): Ion {
  return { formula, charge, coefficient };
}

function solution(
  id: SolutionId,
  label: string,
  ions: readonly Ion[]
): SolutionDefinition {
  return { id, label, ions: Object.freeze([...ions]) };
}

function coefficient(value: number): string {
  return value === 1 ? "" : String(value);
}

const SOLUTIONS: Readonly<Record<SolutionId, SolutionDefinition>> =
  Object.freeze({
    silver_nitrate: solution("silver_nitrate", "Silver nitrate", [
      ion("Ag+", 1, 1),
      ion("NO3-", -1, 1)
    ]),
    sodium_chloride: solution("sodium_chloride", "Sodium chloride", [
      ion("Na+", 1, 1),
      ion("Cl-", -1, 1)
    ]),
    barium_chloride: solution("barium_chloride", "Barium chloride", [
      ion("Ba2+", 2, 1),
      ion("Cl-", -1, 2)
    ]),
    sodium_sulfate: solution("sodium_sulfate", "Sodium sulfate", [
      ion("Na+", 1, 2),
      ion("SO4^2-", -2, 1)
    ]),
    sodium_nitrate: solution("sodium_nitrate", "Sodium nitrate", [
      ion("Na+", 1, 1),
      ion("NO3-", -1, 1)
    ]),
    potassium_chloride: solution("potassium_chloride", "Potassium chloride", [
      ion("K+", 1, 1),
      ion("Cl-", -1, 1)
    ]),
    copper_sulfate: solution("copper_sulfate", "Copper(II) sulfate", [
      ion("Cu2+", 2, 1),
      ion("SO4^2-", -2, 1)
    ]),
    sodium_hydroxide: solution("sodium_hydroxide", "Sodium hydroxide", [
      ion("Na+", 1, 1),
      ion("OH-", -1, 1)
    ]),
    iron_iii_chloride: solution("iron_iii_chloride", "Iron(III) chloride", [
      ion("Fe3+", 3, 1),
      ion("Cl-", -1, 3)
    ]),
    distilled_water: solution("distilled_water", "Distilled water", [])
  });

/**
 * 25 °C concentration-product values used in standard general chemistry.
 * Ksp values: CRC Handbook of Chemistry and Physics, 96th ed., section 8,
 * "Solubility Product Constants". Formula masses use NIST standard atomic
 * weights (AgCl 143.3212, BaSO4 233.389, Cu(OH)2 97.560, Fe(OH)3 106.867
 * g mol-1). Cu(OH)2 literature values vary substantially with solid age and
 * preparation; this registry deliberately pins the cited classroom value.
 */
export const KSP_REGISTRY: readonly SolubilityProductEntry[] = Object.freeze([
  Object.freeze({
    precipitateId: "silver_chloride",
    cation: "Ag+",
    anion: "Cl-",
    formula: "AgCl",
    color: "white",
    cationCoefficient: 1,
    anionCoefficient: 1,
    ksp25C: 1.77e-10,
    molarMassGPerMol: 143.3212,
    source: "CRC Handbook of Chemistry and Physics, 96th ed., section 8"
  }),
  Object.freeze({
    precipitateId: "barium_sulfate",
    cation: "Ba2+",
    anion: "SO4^2-",
    formula: "BaSO4",
    color: "white",
    cationCoefficient: 1,
    anionCoefficient: 1,
    ksp25C: 1.08e-10,
    molarMassGPerMol: 233.389,
    source: "CRC Handbook of Chemistry and Physics, 96th ed., section 8"
  }),
  Object.freeze({
    precipitateId: "copper_ii_hydroxide",
    cation: "Cu2+",
    anion: "OH-",
    formula: "Cu(OH)2",
    color: "blue",
    cationCoefficient: 1,
    anionCoefficient: 2,
    ksp25C: 2.2e-20,
    molarMassGPerMol: 97.56,
    source: "CRC Handbook of Chemistry and Physics, 96th ed., section 8"
  }),
  Object.freeze({
    precipitateId: "iron_iii_hydroxide",
    cation: "Fe3+",
    anion: "OH-",
    formula: "Fe(OH)3",
    color: "rust brown",
    cationCoefficient: 1,
    anionCoefficient: 3,
    ksp25C: 2.79e-39,
    molarMassGPerMol: 106.867,
    source: "CRC Handbook of Chemistry and Physics, 96th ed., section 8"
  })
]);

export const SOLUTION_IDS: readonly SolutionId[] = Object.freeze(
  Object.keys(SOLUTIONS) as SolutionId[]
);

export function listSolutions(): readonly SolutionDefinition[] {
  return Object.values(SOLUTIONS);
}

export function isSolutionId(value: string): value is SolutionId {
  return value in SOLUTIONS;
}

export function solutionDefinition(id: SolutionId): SolutionDefinition {
  return SOLUTIONS[id];
}

function equation(rule: SolubilityProductEntry): string {
  return `${coefficient(rule.cationCoefficient)}${rule.cation}(aq) + ${coefficient(rule.anionCoefficient)}${rule.anion}(aq) → ${rule.formula}(s)`;
}

function ionMoles(
  inventory: Readonly<Partial<Record<IonFormula, number>>>,
  formula: IonFormula
): number {
  return inventory[formula] ?? 0;
}

function quotient(
  rule: SolubilityProductEntry,
  cationMoles: number,
  anionMoles: number,
  volumeL: number
): number {
  return (
    Math.pow(Math.max(0, cationMoles) / volumeL, rule.cationCoefficient) *
    Math.pow(Math.max(0, anionMoles) / volumeL, rule.anionCoefficient)
  );
}

function quantizeMoles(value: number): number {
  return Math.round(value * ION_AMOUNT_SCALE) / ION_AMOUNT_SCALE;
}

function spectatorIonsFor(
  inventory: Readonly<Partial<Record<IonFormula, number>>>,
  rule: SolubilityProductEntry | null
): readonly string[] {
  return Object.keys(inventory)
    .filter(
      (formula) =>
        ionMoles(inventory, formula as IonFormula) > 0 &&
        formula !== rule?.cation &&
        formula !== rule?.anion
    )
    .sort();
}

/**
 * Solve one insoluble product from conserved analytical ion inventories.
 * For extent x, Q(x) strictly decreases from Q(0) to zero on the
 * stoichiometric interval. Two hundred fixed bisection steps therefore select
 * the unique Q=Ksp root without a tolerance-dependent replay branch.
 */
export function solvePrecipitationEquilibrium(
  input: Readonly<IonInventoryInput>
): PrecipitationEquilibrium {
  if (!Number.isFinite(input.volumeL) || input.volumeL <= 0) {
    throw new RangeError("Precipitation equilibrium requires positive volume.");
  }
  const conservedIonMoles: Partial<Record<IonFormula, number>> = {};
  for (const [formula, amount] of Object.entries(input.ionMoles)) {
    if (!Number.isFinite(amount) || amount < 0) {
      throw new RangeError(`Ion inventory ${formula} must be non-negative.`);
    }
    if (amount > 0)
      conservedIonMoles[formula as IonFormula] = quantizeMoles(amount);
  }

  const candidates = KSP_REGISTRY.map((rule) => {
    const cation = ionMoles(conservedIonMoles, rule.cation);
    const anion = ionMoles(conservedIonMoles, rule.anion);
    const reactionQuotientBefore = quotient(rule, cation, anion, input.volumeL);
    return {
      rule,
      cation,
      anion,
      reactionQuotientBefore,
      saturationRatioBefore: reactionQuotientBefore / rule.ksp25C
    };
  })
    .filter(({ cation, anion }) => cation > 0 && anion > 0)
    .sort((left, right) => {
      if (left.saturationRatioBefore !== right.saturationRatioBefore) {
        return right.saturationRatioBefore - left.saturationRatioBefore;
      }
      return left.rule.precipitateId.localeCompare(right.rule.precipitateId);
    });

  const selected = candidates[0] ?? null;
  if (!selected) {
    return {
      formsPrecipitate: false,
      precipitateId: null,
      formula: null,
      color: "clear",
      netIonicEquation: "No reaction",
      spectatorIons: spectatorIonsFor(conservedIonMoles, null),
      totalVolumeL: input.volumeL,
      reactionQuotientBefore: 0,
      solubilityProduct: null,
      saturationRatioBefore: 0,
      precipitateMoles: 0,
      precipitateMassG: 0,
      dissolvedIonConcentrationsM: Object.fromEntries(
        Object.entries(conservedIonMoles).map(([formula, amount]) => [
          formula,
          amount! / input.volumeL
        ])
      ),
      conservedIonMoles
    };
  }

  const { rule, cation, anion, reactionQuotientBefore } = selected;
  let precipitateMoles = 0;
  if (reactionQuotientBefore > rule.ksp25C) {
    let lower = 0;
    let upper = Math.min(
      cation / rule.cationCoefficient,
      anion / rule.anionCoefficient
    );
    for (let step = 0; step < PRECIPITATION_BISECTION_STEPS; step += 1) {
      const midpoint = (lower + upper) / 2;
      const q = quotient(
        rule,
        cation - rule.cationCoefficient * midpoint,
        anion - rule.anionCoefficient * midpoint,
        input.volumeL
      );
      if (q > rule.ksp25C) lower = midpoint;
      else upper = midpoint;
    }
    precipitateMoles = quantizeMoles((lower + upper) / 2);
  }

  const initialCationUnits = Math.round(cation * ION_AMOUNT_SCALE);
  const initialAnionUnits = Math.round(anion * ION_AMOUNT_SCALE);
  const precipitateUnits = Math.min(
    Math.round(precipitateMoles * ION_AMOUNT_SCALE),
    Math.floor(initialCationUnits / rule.cationCoefficient),
    Math.floor(initialAnionUnits / rule.anionCoefficient)
  );
  precipitateMoles = precipitateUnits / ION_AMOUNT_SCALE;
  const dissolvedMoles = { ...conservedIonMoles };
  const dissolvedCationUnits =
    initialCationUnits - rule.cationCoefficient * precipitateUnits;
  const dissolvedAnionUnits =
    initialAnionUnits - rule.anionCoefficient * precipitateUnits;
  assertIntegerQuantityConserved({
    materialInstanceId: `${rule.precipitateId}:${rule.cation}`,
    initialUnits: initialCationUnits,
    allocatedUnits:
      dissolvedCationUnits + rule.cationCoefficient * precipitateUnits
  });
  assertIntegerQuantityConserved({
    materialInstanceId: `${rule.precipitateId}:${rule.anion}`,
    initialUnits: initialAnionUnits,
    allocatedUnits:
      dissolvedAnionUnits + rule.anionCoefficient * precipitateUnits
  });
  dissolvedMoles[rule.cation] =
    Math.max(0, dissolvedCationUnits) / ION_AMOUNT_SCALE;
  dissolvedMoles[rule.anion] =
    Math.max(0, dissolvedAnionUnits) / ION_AMOUNT_SCALE;
  const dissolvedIonConcentrationsM = Object.fromEntries(
    Object.entries(dissolvedMoles).map(([formula, amount]) => [
      formula,
      amount! / input.volumeL
    ])
  );

  return {
    formsPrecipitate: precipitateMoles > 0,
    precipitateId: precipitateMoles > 0 ? rule.precipitateId : null,
    formula: precipitateMoles > 0 ? rule.formula : null,
    color: precipitateMoles > 0 ? rule.color : "clear",
    netIonicEquation: precipitateMoles > 0 ? equation(rule) : "No reaction",
    spectatorIons: spectatorIonsFor(conservedIonMoles, rule),
    totalVolumeL: input.volumeL,
    reactionQuotientBefore,
    solubilityProduct: rule.ksp25C,
    saturationRatioBefore: selected.saturationRatioBefore,
    precipitateMoles,
    precipitateMassG: precipitateMoles * rule.molarMassGPerMol,
    dissolvedIonConcentrationsM,
    conservedIonMoles
  };
}

export function inventoryFromSolutionPortions(
  portions: readonly Readonly<SolutionPortion>[]
): IonInventoryInput {
  const ionMoles: Partial<Record<IonFormula, number>> = {};
  let volumeML = 0;
  for (const portion of portions) {
    if (
      !Number.isFinite(portion.concentrationM) ||
      portion.concentrationM < 0 ||
      !Number.isFinite(portion.volumeML) ||
      portion.volumeML < 0
    ) {
      throw new RangeError(
        "Solution portions require non-negative finite values."
      );
    }
    volumeML += portion.volumeML;
    const formulaMoles = (portion.concentrationM * portion.volumeML) / 1_000;
    for (const species of SOLUTIONS[portion.solutionId].ions) {
      ionMoles[species.formula] = quantizeMoles(
        (ionMoles[species.formula] ?? 0) + formulaMoles * species.coefficient
      );
    }
  }
  return { volumeL: volumeML / 1_000, ionMoles };
}

/** Identity-only compatibility helper; quantitative runtime code does not use it. */
export function predictPrecipitation(
  solutionAId: SolutionId,
  solutionBId: SolutionId
): PrecipitationResult {
  const inventory = inventoryFromSolutionPortions([
    { solutionId: solutionAId, concentrationM: 1, volumeML: 1 },
    { solutionId: solutionBId, concentrationM: 1, volumeML: 1 }
  ]);
  const equilibrium = solvePrecipitationEquilibrium(inventory);
  return {
    formsPrecipitate: equilibrium.formsPrecipitate,
    precipitateId: equilibrium.precipitateId,
    formula: equilibrium.formula,
    color: equilibrium.color,
    netIonicEquation: equilibrium.netIonicEquation,
    spectatorIons: [...equilibrium.spectatorIons]
  };
}

export function normalizeEquation(value: string): string {
  return value.toLowerCase().replaceAll(/\s+/g, "").replaceAll("->", "→");
}
