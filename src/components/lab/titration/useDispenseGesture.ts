/**
 * The dispense gesture now lives with the shared setup-driven bench so the
 * native workspace and the titration strangler host the same reducer and hook.
 * This module remains as a re-export for titration-era import sites
 * (TitrationScene, TitrationControls, Burette) until Phase 5 relocates them.
 */
export {
  DETENT_DEBOUNCE_MS,
  DISPENSE_ACTION_PRECISION_DECIMALS,
  DISPENSE_COMMIT_THRESHOLD_ML,
  DISPENSE_RESIDUE_ML,
  FLOW_RATES_ML_PER_S,
  createDispenseGestureState,
  normalizeDispenseActionVolume,
  reduceDispenseGesture,
  useDispenseGesture,
  type DispenseCommit,
  type DispenseCommitReason,
  type DispenseEndReason,
  type DispenseGestureController,
  type DispenseGestureEvent,
  type DispenseGestureState,
  type DispenseTransition,
  type FlowDetent
} from "../setup-driven/useDispenseGesture";
