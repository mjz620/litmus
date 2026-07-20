/**
 * Deterministic solubility truth for precipitation reactions.
 *
 * This is the single home for these rules. They were relocated here from the
 * legacy `src/experiments/precipitation` module — moved, not copied — which
 * has since been retired along with its 2D lab.
 *
 * Pure data and pure functions only: no React, no browser APIs, no clock, no
 * randomness. Chemistry truth is deterministic and local.
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
  | "iron_iii_chloride";

export type PrecipitateId =
  | "silver_chloride"
  | "barium_sulfate"
  | "copper_ii_hydroxide"
  | "iron_iii_hydroxide";

export interface Ion {
  formula: string;
  charge: number;
  coefficient: number;
}

export interface SolutionDefinition {
  id: SolutionId;
  label: string;
  cation: Ion;
  anion: Ion;
}

export interface PrecipitationResult {
  formsPrecipitate: boolean;
  precipitateId: PrecipitateId | null;
  formula: string | null;
  color: string;
  netIonicEquation: string;
  spectatorIons: string[];
}

interface InsolubleRule {
  precipitateId: PrecipitateId;
  cation: string;
  anion: string;
  formula: string;
  color: string;
  cationCoefficient: number;
  anionCoefficient: number;
}

function ion(formula: string, charge: number, coefficient: number): Ion {
  return { formula, charge, coefficient };
}

function solution(
  id: SolutionId,
  label: string,
  cation: Ion,
  anion: Ion
): SolutionDefinition {
  return { id, label, cation, anion };
}

function coefficient(value: number): string {
  return value === 1 ? "" : String(value);
}

const SOLUTIONS: Record<SolutionId, SolutionDefinition> = {
  silver_nitrate: solution(
    "silver_nitrate",
    "Silver nitrate",
    ion("Ag+", 1, 1),
    ion("NO3-", -1, 1)
  ),
  sodium_chloride: solution(
    "sodium_chloride",
    "Sodium chloride",
    ion("Na+", 1, 1),
    ion("Cl-", -1, 1)
  ),
  barium_chloride: solution(
    "barium_chloride",
    "Barium chloride",
    ion("Ba2+", 2, 1),
    ion("Cl-", -1, 2)
  ),
  sodium_sulfate: solution(
    "sodium_sulfate",
    "Sodium sulfate",
    ion("Na+", 1, 2),
    ion("SO4^2-", -2, 1)
  ),
  sodium_nitrate: solution(
    "sodium_nitrate",
    "Sodium nitrate",
    ion("Na+", 1, 1),
    ion("NO3-", -1, 1)
  ),
  potassium_chloride: solution(
    "potassium_chloride",
    "Potassium chloride",
    ion("K+", 1, 1),
    ion("Cl-", -1, 1)
  ),
  copper_sulfate: solution(
    "copper_sulfate",
    "Copper(II) sulfate",
    ion("Cu2+", 2, 1),
    ion("SO4^2-", -2, 1)
  ),
  sodium_hydroxide: solution(
    "sodium_hydroxide",
    "Sodium hydroxide",
    ion("Na+", 1, 1),
    ion("OH-", -1, 1)
  ),
  iron_iii_chloride: solution(
    "iron_iii_chloride",
    "Iron(III) chloride",
    ion("Fe3+", 3, 1),
    ion("Cl-", -1, 3)
  )
};

const INSOLUBLE_RULES: InsolubleRule[] = [
  {
    precipitateId: "silver_chloride",
    cation: "Ag+",
    anion: "Cl-",
    formula: "AgCl",
    color: "white",
    cationCoefficient: 1,
    anionCoefficient: 1
  },
  {
    precipitateId: "barium_sulfate",
    cation: "Ba2+",
    anion: "SO4^2-",
    formula: "BaSO4",
    color: "white",
    cationCoefficient: 1,
    anionCoefficient: 1
  },
  {
    precipitateId: "copper_ii_hydroxide",
    cation: "Cu2+",
    anion: "OH-",
    formula: "Cu(OH)2",
    color: "blue",
    cationCoefficient: 1,
    anionCoefficient: 2
  },
  {
    precipitateId: "iron_iii_hydroxide",
    cation: "Fe3+",
    anion: "OH-",
    formula: "Fe(OH)3",
    color: "rust brown",
    cationCoefficient: 1,
    anionCoefficient: 3
  }
];

export const SOLUTION_IDS: readonly SolutionId[] = Object.freeze(
  Object.keys(SOLUTIONS) as SolutionId[]
);

export function listSolutions(): readonly SolutionDefinition[] {
  return Object.values(SOLUTIONS);
}

export function isSolutionId(value: string): value is SolutionId {
  return value in SOLUTIONS;
}

/**
 * Cross-pair the two solutions' ions and report the insoluble product, if any.
 * Pure function of two solution IDs — no state, no seed, no ordering effect.
 */
export function predictPrecipitation(
  solutionAId: SolutionId,
  solutionBId: SolutionId
): PrecipitationResult {
  const solutionA = SOLUTIONS[solutionAId];
  const solutionB = SOLUTIONS[solutionBId];
  const candidatePairs = [
    { cation: solutionA.cation, anion: solutionB.anion },
    { cation: solutionB.cation, anion: solutionA.anion }
  ];

  for (const candidate of candidatePairs) {
    const rule = INSOLUBLE_RULES.find(
      (entry) =>
        entry.cation === candidate.cation.formula &&
        entry.anion === candidate.anion.formula
    );
    if (rule) {
      const spectatorIons = [
        solutionA.cation.formula,
        solutionA.anion.formula,
        solutionB.cation.formula,
        solutionB.anion.formula
      ]
        .filter((formula) => formula !== rule.cation && formula !== rule.anion)
        .filter((formula, index, values) => values.indexOf(formula) === index);
      return {
        formsPrecipitate: true,
        precipitateId: rule.precipitateId,
        formula: rule.formula,
        color: rule.color,
        netIonicEquation: `${coefficient(rule.cationCoefficient)}${rule.cation}(aq) + ${coefficient(rule.anionCoefficient)}${rule.anion}(aq) → ${rule.formula}(s)`,
        spectatorIons
      };
    }
  }

  return {
    formsPrecipitate: false,
    precipitateId: null,
    formula: null,
    color: "clear",
    netIonicEquation: "No reaction",
    spectatorIons: [
      solutionA.cation.formula,
      solutionA.anion.formula,
      solutionB.cation.formula,
      solutionB.anion.formula
    ].filter((value, index, values) => values.indexOf(value) === index)
  };
}

export function normalizeEquation(value: string): string {
  return value.toLowerCase().replaceAll(/\s+/g, "").replaceAll("->", "→");
}
