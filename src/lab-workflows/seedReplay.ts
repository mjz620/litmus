import {
  createTitrationRetryScenario,
  validateTitrationRetryScenario
} from "../experiments/titration/retry";
import { titration } from "../experiments/titration/titration";

const TITRATION_ENGINE_ID = "engine.titration.v1";
const ENDPOINT_CONTROL_SEED_ID = "seed.titration.near_endpoint_22ml.v1";
const REPLAY_SESSION_SEED = "lab-workflow-seed-replay-v1";

/**
 * Reconstructs registered seed state twice through the existing deterministic
 * engine adapter. Unknown engine/seed pairs fail closed; no fallback occurs.
 */
export function verifyRegisteredSeedReplay(
  engineId: string,
  seedTemplateId: string
): boolean {
  if (
    engineId !== TITRATION_ENGINE_ID ||
    seedTemplateId !== ENDPOINT_CONTROL_SEED_ID
  ) {
    return false;
  }

  try {
    const firstScenario = createTitrationRetryScenario(
      "endpoint_control",
      REPLAY_SESSION_SEED
    );
    const secondScenario = createTitrationRetryScenario(
      "endpoint_control",
      REPLAY_SESSION_SEED
    );
    if (
      !validateTitrationRetryScenario(firstScenario) ||
      !validateTitrationRetryScenario(secondScenario)
    ) {
      return false;
    }

    const first = titration.createInitialState(
      firstScenario.config,
      firstScenario.seed
    );
    const second = titration.createInitialState(
      secondScenario.config,
      secondScenario.seed
    );
    return (
      first.titrantAddedML === 22 &&
      first.buretteAvailableML === 28 &&
      first.buretteReadingML === 22 &&
      first.buretteConditioned &&
      first.indicatorAdded &&
      JSON.stringify(first) === JSON.stringify(second)
    );
  } catch {
    return false;
  }
}
