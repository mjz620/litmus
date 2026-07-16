// Acid-base titration truth layer. Chemistry is deterministic and local; the
// tutoring layer consumes emitted SemanticEvents and never computes chemistry.

import type {
  ExperimentDefinition,
  GroundTruth,
  RubricCriterion,
  SemanticEvent,
  SkillDefinition,
  SkillEvidence,
  StepResult
} from "../shared";

export type IndicatorId =
  | "phenolphthalein"
  | "bromothymol_blue"
  | "methyl_orange";
export type AnalyteType = "strong_acid" | "weak_acid";

export interface TitrationConfig {
  analyte: {
    name: string;
    type: AnalyteType;
    concentrationM: number;
    volumeML: number;
    pKa?: number;
  };
  titrant: {
    name: string;
    concentrationM: number;
  };
  indicator: IndicatorId;
  buretteCapacityML: number;
}

export interface TitrationState {
  config: TitrationConfig;
  sessionSeed: string | null;
  titrantAddedML: number;
  buretteAvailableML: number;
  buretteConditioned: boolean;
  titrantDilutionFactor: number;
  tSim: number;
  curve: { volumeML: number; pH: number }[];
  submitted: boolean;
}

export type TitrationAction =
  | { type: "rinse_burette"; solvent: "water" | "titrant" }
  | { type: "fill_burette" }
  | { type: "select_indicator"; indicator: IndicatorId }
  | { type: "add_titrant"; volumeML: number; durationS: number }
  | { type: "read_meniscus"; reportedML: number }
  | {
      type: "submit_report";
      reportedMolarityM: number;
      explanation: string;
    };

const KW = 1e-14;

/**
 * Calculate pH as a deterministic function of total titrant added.
 *
 * This uses the source contract's AP/general-chemistry approximations:
 * monoprotic analyte, strong-base titrant, 25 °C, and activity approximately
 * equal to concentration.
 */
export function computePH(
  config: TitrationConfig,
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
  config: TitrationConfig,
  dilutionFactor = 1
): number {
  const acidMoles =
    config.analyte.concentrationM * (config.analyte.volumeML / 1000);
  const effectiveTitrantConcentration =
    config.titrant.concentrationM * dilutionFactor;
  return (acidMoles / effectiveTitrantConcentration) * 1000;
}

interface IndicatorSpec {
  low: string;
  mid: string;
  high: string;
  lowMax: number;
  highMin: number;
}

const INDICATORS: Record<IndicatorId, IndicatorSpec> = {
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
  const specification = INDICATORS[indicator];
  if (pH < specification.lowMax) return specification.low;
  if (pH > specification.highMin) return specification.high;
  return specification.mid;
}

const NEAR_ENDPOINT_ML = 2;
const FAST_RATE_ML_PER_S = 0.5;
const OVERSHOOT_TOLERANCE_ML = 0.3;
const WATER_RINSE_DILUTION = 0.98;

const SKILLS: SkillDefinition[] = [
  {
    id: "burette_conditioning",
    label: "Burette conditioning",
    description: "Rinse the burette with titrant, not water, before filling."
  },
  {
    id: "endpoint_control",
    label: "Endpoint control",
    description:
      "Slow to dropwise addition near the endpoint to avoid overshoot."
  },
  {
    id: "volumetric_reading",
    label: "Volumetric reading",
    description: "Read the meniscus at eye level to the burette's precision."
  },
  {
    id: "stoichiometry",
    label: "Stoichiometry & calculation",
    description:
      "Use endpoint volume and titrant molarity to compute analyte concentration."
  }
];

const RUBRIC: RubricCriterion[] = [
  {
    id: "procedure",
    label: "Procedure",
    description: "Correct conditioning and titration technique."
  },
  {
    id: "endpoint",
    label: "Endpoint identification",
    description:
      "Recognized the endpoint and related it to the equivalence point."
  },
  {
    id: "calculation",
    label: "Calculation",
    description: "Correct stoichiometric computation of analyte molarity."
  },
  {
    id: "sig_figs",
    label: "Significant figures",
    description:
      "Precision justified by the glassware (50 mL burette -> ±0.05 mL)."
  }
];

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function buildCurve(
  config: TitrationConfig,
  dilutionFactor: number,
  uptoML: number
): { volumeML: number; pH: number }[] {
  const points: { volumeML: number; pH: number }[] = [];

  for (let volumeML = 0; volumeML <= uptoML + 1e-9; volumeML += 0.5) {
    points.push({
      volumeML: round(volumeML, 2),
      pH: round(computePH(config, volumeML, dilutionFactor), 2)
    });
  }

  return points;
}

function computeGroundTruth(state: TitrationState): GroundTruth {
  const equivalenceML = equivalenceVolumeML(
    state.config,
    state.titrantDilutionFactor
  );
  const notes: string[] = [];

  if (state.config.analyte.type === "weak_acid") {
    notes.push(`Half-equivalence pH equals pKa (${state.config.analyte.pKa}).`);
    notes.push(
      "Equivalence pH is basic (>7) because the conjugate base hydrolyzes."
    );
  }

  if (!state.buretteConditioned) {
    notes.push(
      "Burette was conditioned with water, so the titrant is effectively dilute: the measured " +
        "endpoint volume runs long and the student's computed molarity will be biased high."
    );
  }

  return {
    values: {
      trueAnalyteMolarity: state.config.analyte.concentrationM,
      equivalenceVolumeML: equivalenceML,
      titrantDilutionFactor: state.titrantDilutionFactor
    },
    notes
  };
}

export const titration: ExperimentDefinition<
  TitrationConfig,
  TitrationState,
  TitrationAction
> = {
  id: "acid_base_titration",
  title: "Acid–Base Titration",
  skills: SKILLS,
  reportRubric: RUBRIC,

  createInitialState(config, seed) {
    const base: TitrationState = {
      config,
      sessionSeed: null,
      titrantAddedML: 0,
      buretteAvailableML: 0,
      buretteConditioned: false,
      titrantDilutionFactor: 1,
      tSim: 0,
      curve: [],
      submitted: false
    };
    const state: TitrationState = { ...base, ...seed, config };

    if (state.titrantAddedML > 0 && state.curve.length === 0) {
      state.curve = buildCurve(
        config,
        state.titrantDilutionFactor,
        state.titrantAddedML
      );
    }

    return state;
  },

  step(state, action): StepResult<TitrationState> {
    switch (action.type) {
      case "rinse_burette": {
        if (state.buretteAvailableML > 0) {
          throw new RangeError("Cannot rinse a filled burette.");
        }

        const conditioned = action.solvent === "titrant";
        const dilutionFactor = conditioned ? 1 : WATER_RINSE_DILUTION;
        const evidence: SkillEvidence[] = [
          {
            skillId: "burette_conditioning",
            delta: conditioned ? 0.8 : -0.9,
            reason: conditioned
              ? "conditioned_with_titrant"
              : "rinsed_with_water"
          }
        ];
        const event: SemanticEvent = {
          type: "rinse_burette",
          tSim: state.tSim,
          observation: { solvent: action.solvent },
          flags: conditioned ? [] : ["burette_not_conditioned"],
          evidence
        };

        return {
          state: {
            ...state,
            buretteConditioned: conditioned,
            titrantDilutionFactor: dilutionFactor
          },
          events: [event]
        };
      }

      case "fill_burette": {
        if (state.titrantAddedML > 0 || state.buretteAvailableML > 0) {
          throw new RangeError(
            "The burette can only be filled once before titrant delivery."
          );
        }

        const event: SemanticEvent = {
          type: "fill_burette",
          tSim: state.tSim,
          observation: {
            capacityML: state.config.buretteCapacityML,
            availableML: state.config.buretteCapacityML
          },
          flags: [],
          evidence: []
        };

        return {
          state: {
            ...state,
            buretteAvailableML: state.config.buretteCapacityML
          },
          events: [event]
        };
      }

      case "select_indicator": {
        const event: SemanticEvent = {
          type: "select_indicator",
          tSim: state.tSim,
          observation: { indicator: action.indicator },
          flags: [],
          evidence: []
        };

        return {
          state: {
            ...state,
            config: { ...state.config, indicator: action.indicator }
          },
          events: [event]
        };
      }

      case "add_titrant": {
        if (!Number.isFinite(action.volumeML) || action.volumeML <= 0) {
          throw new RangeError("Titrant volume must be a positive number.");
        }
        if (!Number.isFinite(action.durationS) || action.durationS <= 0) {
          throw new RangeError("Delivery time must be a positive number.");
        }
        if (state.buretteAvailableML <= 0) {
          throw new RangeError("Fill the burette before adding titrant.");
        }
        if (action.volumeML > state.buretteAvailableML) {
          throw new RangeError(
            "Cannot add more titrant than remains in the burette."
          );
        }

        const before = state.titrantAddedML;
        const after = before + action.volumeML;
        const equivalenceML = equivalenceVolumeML(
          state.config,
          state.titrantDilutionFactor
        );
        const rate =
          action.durationS > 0 ? action.volumeML / action.durationS : Infinity;
        const nearEndpoint =
          Math.abs(after - equivalenceML) <= NEAR_ENDPOINT_ML ||
          Math.abs(before - equivalenceML) <= NEAR_ENDPOINT_ML;

        const pH = computePH(state.config, after, state.titrantDilutionFactor);
        const color = observedColor(state.config.indicator, pH);
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

        if (!state.buretteConditioned) {
          flags.push("burette_not_conditioned");
        }

        const curve = [
          ...state.curve,
          { volumeML: round(after, 2), pH: round(pH, 2) }
        ];
        const event: SemanticEvent = {
          type: "add_titrant",
          tSim: state.tSim + action.durationS,
          observation: {
            addedML: round(action.volumeML, 2),
            totalML: round(after, 2),
            rateMlPerS: round(rate, 2),
            pH: round(pH, 2),
            observedColor: color,
            equivalenceML: round(equivalenceML, 2)
          },
          flags,
          evidence
        };

        return {
          state: {
            ...state,
            titrantAddedML: after,
            buretteAvailableML: state.buretteAvailableML - action.volumeML,
            tSim: state.tSim + action.durationS,
            curve
          },
          events: [event]
        };
      }

      case "read_meniscus": {
        const trueReading = state.titrantAddedML;
        const errorML = action.reportedML - trueReading;
        const withinTolerance = Math.abs(errorML) <= 0.05;
        const event: SemanticEvent = {
          type: "read_meniscus",
          tSim: state.tSim,
          observation: {
            reportedML: action.reportedML,
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

        return { state, events: [event] };
      }

      case "submit_report": {
        const groundTruth = computeGroundTruth(state);
        const trueMolarity = groundTruth.values.trueAnalyteMolarity;
        const relativeError =
          Math.abs(action.reportedMolarityM - trueMolarity) / trueMolarity;
        const withinTolerance = relativeError <= 0.05;
        const event: SemanticEvent = {
          type: "submit_report",
          tSim: state.tSim,
          observation: {
            reportedMolarityM: action.reportedMolarityM,
            trueMolarityM: round(trueMolarity, 4),
            relErr: round(relativeError, 3)
          },
          flags: withinTolerance ? [] : ["result_out_of_tolerance"],
          evidence: [
            {
              skillId: "stoichiometry",
              delta: withinTolerance ? 0.7 : -0.5,
              reason: withinTolerance
                ? "result_within_tolerance"
                : "result_out_of_tolerance"
            }
          ]
        };

        return {
          state: { ...state, submitted: true },
          events: [event]
        };
      }
    }
  },

  getGroundTruth(state) {
    return computeGroundTruth(state);
  }
};

export const EXAMPLE_STRONG: TitrationConfig = {
  analyte: {
    name: "HCl",
    type: "strong_acid",
    concentrationM: 0.1,
    volumeML: 25
  },
  titrant: { name: "NaOH", concentrationM: 0.1 },
  indicator: "phenolphthalein",
  buretteCapacityML: 50
};

export const EXAMPLE_WEAK: TitrationConfig = {
  analyte: {
    name: "CH3COOH",
    type: "weak_acid",
    concentrationM: 0.1,
    volumeML: 25,
    pKa: 4.76
  },
  titrant: { name: "NaOH", concentrationM: 0.1 },
  indicator: "phenolphthalein",
  buretteCapacityML: 50
};
