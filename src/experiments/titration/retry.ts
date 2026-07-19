import {
  EXAMPLE_STRONG,
  equivalenceVolumeML,
  titration,
  type TitrationConfig,
  type TitrationState
} from "./titration";

export type TitrationRetrySkillId = "endpoint_control" | "burette_conditioning";

export interface TitrationRetryScenario {
  skillId: TitrationRetrySkillId;
  title: string;
  goal: string;
  config: TitrationConfig;
  seed: Partial<TitrationState>;
}

/** Near-endpoint seed volume: three milliliters before equivalence, two-decimal mL. */
export function nearEndpointTitrantAddedML(
  config: TitrationConfig,
  dilutionFactor = 1
): number {
  const equivalence = equivalenceVolumeML(config, dilutionFactor);
  const candidate = Math.round((equivalence - 3) * 100) / 100;
  if (
    !Number.isFinite(candidate) ||
    candidate <= 0 ||
    candidate >= config.buretteCapacityML ||
    equivalence <= candidate ||
    equivalence - candidate > 5
  ) {
    throw new Error(
      "Authored titration concentrations do not support a near-endpoint seed within five milliliters of equivalence."
    );
  }
  return candidate;
}

/** Same predicate the hard validator and runtime seed builder share. */
export function isNearEndpointSeedSupported(
  config: TitrationConfig,
  dilutionFactor = 1
): boolean {
  try {
    nearEndpointTitrantAddedML(config, dilutionFactor);
    return true;
  } catch {
    return false;
  }
}

export function createEndpointControlSeed(
  config: TitrationConfig,
  sessionSeed: string
): Partial<TitrationState> {
  const titrantAddedML = nearEndpointTitrantAddedML(config);
  return {
    sessionSeed,
    titrantAddedML,
    buretteAvailableML: config.buretteCapacityML - titrantAddedML,
    buretteReadingML: titrantAddedML,
    fillCount: 1,
    fillHistory: [
      {
        requestedML: config.buretteCapacityML,
        resultingAvailableML: config.buretteCapacityML,
        currentReadingML: 0,
        kind: "initial",
        tSim: 0
      }
    ],
    buretteConditioned: true,
    titrantDilutionFactor: 1,
    tSim: 30
  };
}

export function createTitrationRetryScenario(
  skillId: TitrationRetrySkillId,
  sessionSeed: string,
  config: TitrationConfig = EXAMPLE_STRONG
): TitrationRetryScenario {
  const scenario: TitrationRetryScenario =
    skillId === "endpoint_control"
      ? {
          skillId,
          title: "Endpoint-control retry",
          goal: "Use controlled additions from near the equivalence region and avoid overshooting the endpoint.",
          config,
          seed: createEndpointControlSeed(config, sessionSeed)
        }
      : {
          skillId,
          title: "Burette-conditioning retry",
          goal: "Choose the correct conditioning liquid, then fill the burette.",
          config,
          seed: { sessionSeed }
        };

  if (!validateTitrationRetryScenario(scenario)) {
    throw new Error(`Invalid retry scenario: ${skillId}`);
  }
  return scenario;
}

export function validateTitrationRetryScenario(
  scenario: TitrationRetryScenario
): boolean {
  try {
    const state = titration.createInitialState(scenario.config, scenario.seed);
    const equivalence = equivalenceVolumeML(
      scenario.config,
      state.titrantDilutionFactor
    );
    if (!Number.isFinite(equivalence) || equivalence <= 0) return false;
    if (
      state.titrantAddedML < 0 ||
      state.buretteAvailableML < 0 ||
      state.buretteAvailableML > scenario.config.buretteCapacityML
    )
      return false;

    if (scenario.skillId === "endpoint_control") {
      return (
        state.titrantAddedML > 0 &&
        equivalence > state.titrantAddedML &&
        equivalence - state.titrantAddedML <= 5
      );
    }
    return state.titrantAddedML === 0 && state.buretteAvailableML === 0;
  } catch {
    return false;
  }
}

export function isTitrationRetrySkillId(
  value: string | undefined
): value is TitrationRetrySkillId {
  return value === "endpoint_control" || value === "burette_conditioning";
}
