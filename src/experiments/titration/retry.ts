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

export function createTitrationRetryScenario(
  skillId: TitrationRetrySkillId,
  sessionSeed: string
): TitrationRetryScenario {
  const scenario: TitrationRetryScenario =
    skillId === "endpoint_control"
      ? {
          skillId,
          title: "Endpoint-control retry",
          goal: "Use controlled additions from 22.00 mL and avoid overshooting the endpoint region.",
          config: EXAMPLE_STRONG,
          seed: {
            sessionSeed,
            titrantAddedML: 22,
            buretteAvailableML: EXAMPLE_STRONG.buretteCapacityML - 22,
            buretteReadingML: 22,
            fillCount: 1,
            fillHistory: [
              {
                requestedML: EXAMPLE_STRONG.buretteCapacityML,
                resultingAvailableML: EXAMPLE_STRONG.buretteCapacityML,
                currentReadingML: 0,
                kind: "initial",
                tSim: 0
              }
            ],
            buretteConditioned: true,
            titrantDilutionFactor: 1,
            tSim: 30
          }
        }
      : {
          skillId,
          title: "Burette-conditioning retry",
          goal: "Choose the correct conditioning liquid, then fill the burette.",
          config: EXAMPLE_STRONG,
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
        state.titrantAddedML === 22 &&
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
