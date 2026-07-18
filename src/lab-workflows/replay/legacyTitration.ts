import { replayTitrationActions } from "../../experiments/titration/replay";
import type {
  TitrationAction,
  TitrationConfig,
  TitrationState
} from "../../experiments/titration/titration";

/** Explicit compatibility adapter; the existing legacy action format is unchanged. */
export function replayLegacyTitrationActions(
  config: TitrationConfig,
  actions: readonly TitrationAction[],
  seed?: Partial<TitrationState>
) {
  return replayTitrationActions(config, actions, seed);
}
