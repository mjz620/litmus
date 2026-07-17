import type { SemanticEvent } from "../shared";
import {
  titration,
  type TitrationAction,
  type TitrationConfig,
  type TitrationState
} from "./titration";

export interface TitrationReplayResult {
  state: TitrationState;
  events: SemanticEvent[];
}

/**
 * Rebuild a titration locally from its versioned configuration, optional seed,
 * and typed actions. The same step path is used by live and replay sessions.
 */
export function replayTitrationActions(
  config: TitrationConfig,
  actions: readonly TitrationAction[],
  seed?: Partial<TitrationState>
): TitrationReplayResult {
  let state = titration.createInitialState(config, seed);
  const events: SemanticEvent[] = [];

  for (const action of actions) {
    const result = titration.step(state, action);
    state = result.state;
    events.push(...result.events);
  }

  return { state, events };
}
