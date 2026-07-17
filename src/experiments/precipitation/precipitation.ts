import type {
  ExperimentDefinition,
  GroundTruth,
  RubricCriterion,
  SemanticEvent,
  SkillDefinition
} from "../shared";

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

interface Ion {
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

export interface PrecipitationConfig {
  availableSolutionIds: SolutionId[];
}

export interface PrecipitationState {
  config: PrecipitationConfig;
  sessionSeed: string | null;
  solutionA: SolutionId | null;
  solutionB: SolutionId | null;
  result: PrecipitationResult | null;
  tSim: number;
  submitted: boolean;
}

export type PrecipitationAction =
  | { type: "select_solution"; slot: "A" | "B"; solutionId: SolutionId }
  | { type: "mix_solutions" }
  | {
      type: "submit_precipitate_prediction";
      precipitateId: PrecipitateId | "none";
    }
  | { type: "submit_net_ionic_equation"; equation: string };

export const DEFAULT_PRECIPITATION_CONFIG: PrecipitationConfig = {
  availableSolutionIds: [
    "silver_nitrate",
    "sodium_chloride",
    "barium_chloride",
    "sodium_sulfate",
    "sodium_nitrate",
    "potassium_chloride",
    "copper_sulfate",
    "sodium_hydroxide",
    "iron_iii_chloride"
  ]
};

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

interface InsolubleRule {
  precipitateId: PrecipitateId;
  cation: string;
  anion: string;
  formula: string;
  color: string;
  cationCoefficient: number;
  anionCoefficient: number;
}

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

const SKILLS: SkillDefinition[] = [
  {
    id: "ion_dissociation",
    label: "Ion dissociation",
    description: "Represent soluble ionic compounds as aqueous ions."
  },
  {
    id: "solubility_rules",
    label: "Solubility rules",
    description: "Predict whether an ion pair forms a precipitate."
  },
  {
    id: "net_ionic_equation",
    label: "Net ionic equation",
    description: "Write a balanced equation without spectator ions."
  },
  {
    id: "spectator_ions",
    label: "Spectator ions",
    description: "Identify ions unchanged by the reaction."
  }
];

const RUBRIC: RubricCriterion[] = [
  {
    id: "prediction",
    label: "Precipitate prediction",
    description: "Uses verified solubility rules."
  },
  {
    id: "ions",
    label: "Ionic representation",
    description: "Dissociates soluble compounds correctly."
  },
  {
    id: "net_ionic",
    label: "Net ionic equation",
    description: "Balances mass and charge and omits spectators."
  }
];

export function listSolutions(): readonly SolutionDefinition[] {
  return Object.values(SOLUTIONS);
}

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

export const precipitation: ExperimentDefinition<
  PrecipitationConfig,
  PrecipitationState,
  PrecipitationAction
> = {
  id: "precipitation_solubility",
  title: "Precipitation & Solubility",
  skills: SKILLS,
  reportRubric: RUBRIC,

  createInitialState(config, seed) {
    const state: PrecipitationState = {
      sessionSeed: null,
      solutionA: null,
      solutionB: null,
      result: null,
      tSim: 0,
      submitted: false,
      ...seed,
      config
    };
    if (
      state.solutionA &&
      !config.availableSolutionIds.includes(state.solutionA)
    )
      throw new RangeError("Seed solution A is unavailable.");
    if (
      state.solutionB &&
      !config.availableSolutionIds.includes(state.solutionB)
    )
      throw new RangeError("Seed solution B is unavailable.");
    return state;
  },

  step(state, action) {
    switch (action.type) {
      case "select_solution": {
        if (!state.config.availableSolutionIds.includes(action.solutionId))
          throw new RangeError("Solution is unavailable.");
        const event = semanticEvent("select_solution", state.tSim, {
          slot: action.slot,
          solutionId: action.solutionId
        });
        return {
          state: {
            ...state,
            [action.slot === "A" ? "solutionA" : "solutionB"]:
              action.solutionId,
            result: null
          },
          events: [event]
        };
      }
      case "mix_solutions": {
        if (!state.solutionA || !state.solutionB)
          throw new RangeError("Select two solutions before mixing.");
        if (state.solutionA === state.solutionB)
          throw new RangeError("Select two different solutions.");
        const result = predictPrecipitation(state.solutionA, state.solutionB);
        const event = semanticEvent("mix_solutions", state.tSim + 1, {
          solutionA: state.solutionA,
          solutionB: state.solutionB,
          formsPrecipitate: result.formsPrecipitate,
          precipitateId: result.precipitateId ?? "none",
          observedColor: result.color,
          netIonicEquation: result.netIonicEquation
        });
        return {
          state: { ...state, result, tSim: state.tSim + 1 },
          events: [event]
        };
      }
      case "submit_precipitate_prediction": {
        if (!state.result)
          throw new RangeError(
            "Mix the solutions before submitting a prediction."
          );
        const expected = state.result.precipitateId ?? "none";
        const correct = action.precipitateId === expected;
        return {
          state,
          events: [
            {
              ...semanticEvent("submit_precipitate_prediction", state.tSim, {
                predicted: action.precipitateId,
                expected,
                correct
              }),
              flags: correct ? [] : ["incorrect_precipitate_prediction"],
              evidence: [
                {
                  skillId: "solubility_rules",
                  delta: correct ? 0.7 : -0.7,
                  reason: correct
                    ? "precipitate_prediction_correct"
                    : "incorrect_precipitate_prediction"
                }
              ]
            }
          ]
        };
      }
      case "submit_net_ionic_equation": {
        if (!state.result)
          throw new RangeError(
            "Mix the solutions before submitting an equation."
          );
        const correct =
          normalizeEquation(action.equation) ===
          normalizeEquation(state.result.netIonicEquation);
        return {
          state: { ...state, submitted: true },
          events: [
            {
              ...semanticEvent("submit_net_ionic_equation", state.tSim, {
                correct
              }),
              flags: correct ? [] : ["net_ionic_equation_incorrect"],
              evidence: [
                {
                  skillId: "net_ionic_equation",
                  delta: correct ? 0.8 : -0.8,
                  reason: correct
                    ? "net_ionic_equation_correct"
                    : "net_ionic_equation_incorrect"
                }
              ]
            }
          ]
        };
      }
    }
  },

  getGroundTruth(state): GroundTruth {
    return {
      values: { formsPrecipitate: state.result?.formsPrecipitate ? 1 : 0 },
      notes: state.result
        ? [
            `Precipitate: ${state.result.formula ?? "none"}.`,
            `Net ionic equation: ${state.result.netIonicEquation}.`
          ]
        : ["Solutions have not been mixed."]
    };
  }
};

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
function normalizeEquation(value: string): string {
  return value.toLowerCase().replaceAll(/\s+/g, "").replaceAll("->", "→");
}
function semanticEvent(
  type: string,
  tSim: number,
  observation: SemanticEvent["observation"]
): SemanticEvent {
  return { type, tSim, observation, flags: [], evidence: [] };
}
