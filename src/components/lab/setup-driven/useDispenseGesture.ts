"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useLabStore } from "../../../stores/labStore";

export type FlowDetent = "closed" | "dropwise" | "slow" | "open";

export const FLOW_RATES_ML_PER_S: Readonly<Record<FlowDetent, number>> = {
  closed: 0,
  dropwise: 0.05,
  slow: 0.2,
  open: 1
};

export const DISPENSE_COMMIT_THRESHOLD_ML = 0.5;
export const DISPENSE_RESIDUE_ML = 0.005;
export const DISPENSE_ACTION_PRECISION_DECIMALS = 6;
export const DETENT_DEBOUNCE_MS = 100;

export type DispenseEndReason =
  | "pointer_up"
  | "escape"
  | "blur"
  | "pointer_cancel"
  | "visibility_change";

export type DispenseCommitReason =
  | "threshold"
  | "detent_change"
  | "gesture_end"
  | "empty";

export interface DispenseCommit {
  volumeML: number;
  durationS: number;
  detent: Exclude<FlowDetent, "closed">;
  reason: DispenseCommitReason;
}

export interface DispenseGestureState {
  selectedDetent: FlowDetent;
  activeDetent: FlowDetent;
  isHolding: boolean;
  pendingML: number;
  pendingDurationS: number;
  remainingML: number;
  lastTimestampMS: number | null;
  gestureStartedAtMS: number | null;
  lastDetentChangeMS: number | null;
  gestureCommittedML: number;
  gestureDetentChanges: number;
  minimumCommitML: number;
  /** Per-action ceiling from workflow authored limits; null means unlimited. */
  maximumCommitML: number | null;
}

export type DispenseGestureEvent =
  | { type: "select_detent"; detent: FlowDetent; nowMS: number }
  | {
      type: "start";
      nowMS: number;
      availableML: number;
      minimumCommitML?: number;
      maximumCommitML?: number | null;
    }
  | { type: "tick"; nowMS: number }
  | { type: "end"; nowMS: number; reason: DispenseEndReason }
  | { type: "cancel"; reason: "dispatch_rejected" | "permission_change" };

export interface DispenseTransition {
  state: DispenseGestureState;
  commits: DispenseCommit[];
}

export function createDispenseGestureState(
  selectedDetent: FlowDetent = "dropwise",
  availableML = 0,
  minimumCommitML = DISPENSE_RESIDUE_ML,
  maximumCommitML: number | null = null
): DispenseGestureState {
  return {
    selectedDetent,
    activeDetent: "closed",
    isHolding: false,
    pendingML: 0,
    pendingDurationS: 0,
    remainingML: sanitizeAvailableML(availableML),
    lastTimestampMS: null,
    gestureStartedAtMS: null,
    lastDetentChangeMS: null,
    gestureCommittedML: 0,
    gestureDetentChanges: 0,
    minimumCommitML: sanitizeMinimumCommitML(minimumCommitML),
    maximumCommitML: sanitizeMaximumCommitML(maximumCommitML)
  };
}

/** Pure time-driven dispense state machine. */
export function reduceDispenseGesture(
  state: DispenseGestureState,
  event: DispenseGestureEvent
): DispenseTransition {
  switch (event.type) {
    case "select_detent":
      return selectDetent(state, event.detent, event.nowMS);
    case "start":
      return startGesture(
        state,
        event.nowMS,
        event.availableML,
        event.minimumCommitML,
        event.maximumCommitML
      );
    case "tick":
      return advanceGesture(state, event.nowMS);
    case "end":
      return endGesture(state, event.nowMS);
    case "cancel":
      return cancelGesture(state);
  }
}

function selectDetent(
  state: DispenseGestureState,
  detent: FlowDetent,
  nowMS: number
): DispenseTransition {
  if (!state.isHolding) {
    return {
      state: { ...state, selectedDetent: detent },
      commits: []
    };
  }

  const advanced = advanceGesture(state, nowMS);
  if (!advanced.state.isHolding) return advanced;
  if (detent === advanced.state.activeDetent) {
    return {
      state: { ...advanced.state, selectedDetent: detent },
      commits: advanced.commits
    };
  }

  const lastChangeMS = advanced.state.lastDetentChangeMS;
  if (lastChangeMS !== null && nowMS - lastChangeMS < DETENT_DEBOUNCE_MS) {
    return advanced;
  }

  const flushed = flushPending(advanced.state, "detent_change");
  const commits = [...advanced.commits, ...flushed.commits];

  if (detent === "closed") {
    return {
      state: closeValve(
        { ...flushed.state, selectedDetent: "closed" },
        flushed.state.remainingML + flushed.state.pendingML
      ),
      commits
    };
  }

  return {
    state: {
      ...flushed.state,
      selectedDetent: detent,
      activeDetent: detent,
      lastTimestampMS: nowMS,
      lastDetentChangeMS: nowMS,
      gestureDetentChanges: flushed.state.gestureDetentChanges + 1
    },
    commits
  };
}

function startGesture(
  state: DispenseGestureState,
  nowMS: number,
  availableML: number,
  minimumCommitML = DISPENSE_RESIDUE_ML,
  maximumCommitML: number | null = null
): DispenseTransition {
  const remainingML = sanitizeAvailableML(availableML);
  const effectiveMinimumCommitML = sanitizeMinimumCommitML(minimumCommitML);
  const effectiveMaximumCommitML = sanitizeMaximumCommitML(maximumCommitML);
  const detent = state.selectedDetent;

  if (
    state.isHolding ||
    detent === "closed" ||
    remainingML < effectiveMinimumCommitML
  ) {
    return {
      state: {
        ...state,
        remainingML,
        minimumCommitML: effectiveMinimumCommitML,
        maximumCommitML: effectiveMaximumCommitML
      },
      commits: []
    };
  }

  return {
    state: {
      ...state,
      activeDetent: detent,
      isHolding: true,
      pendingML: 0,
      pendingDurationS: 0,
      remainingML,
      lastTimestampMS: nowMS,
      gestureStartedAtMS: nowMS,
      lastDetentChangeMS: nowMS,
      gestureCommittedML: 0,
      gestureDetentChanges: 0,
      minimumCommitML: effectiveMinimumCommitML,
      maximumCommitML: effectiveMaximumCommitML
    },
    commits: []
  };
}

function advanceGesture(
  state: DispenseGestureState,
  nowMS: number
): DispenseTransition {
  if (
    !state.isHolding ||
    state.activeDetent === "closed" ||
    state.lastTimestampMS === null
  ) {
    return { state, commits: [] };
  }

  const elapsedS = Math.max(0, (nowMS - state.lastTimestampMS) / 1000);
  const rateMLPerS = FLOW_RATES_ML_PER_S[state.activeDetent];
  let remainingRequestedML = rateMLPerS * elapsedS;
  let nextState: DispenseGestureState = {
    ...state,
    lastTimestampMS: nowMS
  };
  const commits: DispenseCommit[] = [];

  while (
    nextState.isHolding &&
    nextState.activeDetent !== "closed" &&
    remainingRequestedML > Number.EPSILON
  ) {
    const roomInPending = getPendingRoomML(nextState);
    const addedML = Math.min(
      remainingRequestedML,
      nextState.remainingML,
      roomInPending
    );
    if (addedML <= Number.EPSILON) break;

    const activeDurationS = rateMLPerS > 0 ? addedML / rateMLPerS : 0;
    remainingRequestedML = Math.max(0, remainingRequestedML - addedML);
    nextState = {
      ...nextState,
      pendingML: nextState.pendingML + addedML,
      pendingDurationS: nextState.pendingDurationS + activeDurationS,
      remainingML: Math.max(0, nextState.remainingML - addedML)
    };

    const exhausted = nextState.remainingML <= Number.EPSILON;
    if (exhausted) {
      const flushed = flushPending(nextState, "empty");
      commits.push(...flushed.commits);
      return {
        state: closeValve(flushed.state, flushed.state.remainingML),
        commits
      };
    }

    if (shouldFlushAtThreshold(nextState)) {
      const flushed = flushPending(nextState, "threshold");
      commits.push(...flushed.commits);
      nextState = flushed.state;
      continue;
    }

    break;
  }

  return { state: nextState, commits };
}

function endGesture(
  state: DispenseGestureState,
  nowMS: number
): DispenseTransition {
  if (!state.isHolding) return { state, commits: [] };

  const endingDetent = state.activeDetent;
  const advanced = advanceGesture(state, nowMS);
  if (!advanced.state.isHolding) return advanced;

  let nextState = advanced.state;
  const gestureDurationS =
    nextState.gestureStartedAtMS === null
      ? 0
      : Math.max(0, (nowMS - nextState.gestureStartedAtMS) / 1000);

  if (
    endingDetent === "dropwise" &&
    nextState.gestureDetentChanges === 0 &&
    nextState.gestureCommittedML === 0 &&
    gestureDurationS <= 1
  ) {
    const oneDropML = Math.min(
      FLOW_RATES_ML_PER_S.dropwise,
      nextState.pendingML + nextState.remainingML
    );
    const extraML = Math.max(0, oneDropML - nextState.pendingML);

    nextState = {
      ...nextState,
      pendingML: oneDropML,
      pendingDurationS: oneDropML / FLOW_RATES_ML_PER_S.dropwise,
      remainingML: Math.max(0, nextState.remainingML - extraML)
    };
  }

  const flushed = flushPending(nextState, "gesture_end");

  return {
    state: closeValve(flushed.state, flushed.state.remainingML),
    commits: [...advanced.commits, ...flushed.commits]
  };
}

function flushPending(
  state: DispenseGestureState,
  reason: DispenseCommitReason
): DispenseTransition {
  const pendingML = state.pendingML;
  const pendingDurationS = state.pendingDurationS;
  const cappedPendingML =
    state.maximumCommitML === null
      ? pendingML
      : Math.min(pendingML, state.maximumCommitML);
  const normalizedML = normalizeDispenseActionVolume(cappedPendingML);

  if (
    normalizedML < state.minimumCommitML ||
    pendingDurationS <= 0 ||
    state.activeDetent === "closed"
  ) {
    if (
      reason === "detent_change" &&
      pendingDurationS > 0 &&
      state.activeDetent !== "closed"
    ) {
      return { state, commits: [] };
    }
    return {
      state: {
        ...state,
        pendingML: 0,
        pendingDurationS: 0,
        remainingML: state.remainingML + pendingML
      },
      commits: []
    };
  }

  const normalizedDurationS = normalizeDispenseActionDuration(
    pendingML > 0 ? pendingDurationS * (normalizedML / pendingML) : 0
  );
  const returnedResidueML = Math.max(0, pendingML - normalizedML);

  return {
    state: {
      ...state,
      pendingML: 0,
      pendingDurationS: 0,
      remainingML: state.remainingML + returnedResidueML,
      gestureCommittedML: state.gestureCommittedML + normalizedML
    },
    commits: [
      {
        volumeML: normalizedML,
        durationS: normalizedDurationS,
        detent: state.activeDetent,
        reason
      }
    ]
  };
}

function cancelGesture(state: DispenseGestureState): DispenseTransition {
  return {
    state: closeValve(state, state.remainingML + state.pendingML),
    commits: []
  };
}

function closeValve(
  state: DispenseGestureState,
  remainingML: number
): DispenseGestureState {
  return {
    ...state,
    activeDetent: "closed",
    isHolding: false,
    pendingML: 0,
    pendingDurationS: 0,
    remainingML,
    lastTimestampMS: null,
    gestureStartedAtMS: null,
    lastDetentChangeMS: null,
    gestureCommittedML: 0,
    gestureDetentChanges: 0
  };
}

function getPendingRoomML(state: DispenseGestureState): number {
  if (state.maximumCommitML === null) {
    // Unlimited per-action mode may briefly overshoot the flush threshold in a
    // single frame; room is unbounded so volume is conserved.
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, state.maximumCommitML - state.pendingML);
}

function shouldFlushAtThreshold(state: DispenseGestureState): boolean {
  if (state.maximumCommitML !== null) {
    return state.pendingML + Number.EPSILON >= state.maximumCommitML;
  }
  return state.pendingML >= DISPENSE_COMMIT_THRESHOLD_ML;
}

function sanitizeAvailableML(availableML: number): number {
  return Number.isFinite(availableML) ? Math.max(0, availableML) : 0;
}

function sanitizeMinimumCommitML(minimumCommitML: number): number {
  return Number.isFinite(minimumCommitML)
    ? Math.max(DISPENSE_RESIDUE_ML, minimumCommitML)
    : DISPENSE_RESIDUE_ML;
}

function sanitizeMaximumCommitML(
  maximumCommitML: number | null | undefined
): number | null {
  if (
    maximumCommitML === null ||
    maximumCommitML === undefined ||
    !Number.isFinite(maximumCommitML) ||
    maximumCommitML <= 0
  ) {
    return null;
  }
  return maximumCommitML;
}

export function normalizeDispenseActionVolume(volumeML: number): number {
  if (!Number.isFinite(volumeML) || volumeML <= 0) return 0;
  const factor = 10 ** DISPENSE_ACTION_PRECISION_DECIMALS;
  return Math.floor((volumeML + Number.EPSILON) * factor) / factor;
}

/**
 * The chemistry model only accepts centisecond-exact delivery durations, but
 * a hold accumulates raw wall-clock time, so the release commit of any hold
 * longer than the one-drop shortcut carried an off-grid duration and the
 * whole dispense was rejected at pointer-up.
 */
export function normalizeDispenseActionDuration(durationS: number): number {
  if (!Number.isFinite(durationS) || durationS <= 0) return 0;
  return Math.max(0.01, Math.round(durationS * 100) / 100);
}

interface UseDispenseGestureOptions {
  availableML: number;
  minimumCommitML?: number;
  maximumCommitML?: number | null;
  enabled?: boolean;
  /**
   * Session sink for one normalized commit; return false when the runtime
   * rejected the action so the gesture closes the valve. Defaults to the
   * legacy/strangler lab store `add_titrant` dispatch — the native bench
   * supplies its own sink that dispatches `action.dispense.v1` through the
   * setup-driven native session.
   */
  dispatchCommit?: (commit: DispenseCommit) => boolean;
  onCommit?: (commit: DispenseCommit) => void;
  onDetentChange?: (detent: FlowDetent) => void;
  onGestureStart?: () => void;
  onGestureEnd?: () => void;
}

export interface DispenseGestureController {
  state: DispenseGestureState;
  setDetent: (detent: FlowDetent) => void;
  start: () => void;
  end: (reason: DispenseEndReason) => void;
}

/** Browser-event and animation-frame adapter around the pure reducer. */
export function useDispenseGesture({
  availableML,
  minimumCommitML = DISPENSE_RESIDUE_ML,
  maximumCommitML = null,
  enabled = true,
  dispatchCommit,
  onCommit,
  onDetentChange,
  onGestureStart,
  onGestureEnd
}: UseDispenseGestureOptions): DispenseGestureController {
  const dispatch = useLabStore((store) => store.dispatch);
  const callbacksRef = useRef({
    dispatchCommit,
    onCommit,
    onDetentChange,
    onGestureStart,
    onGestureEnd
  });
  useEffect(() => {
    callbacksRef.current = {
      dispatchCommit,
      onCommit,
      onDetentChange,
      onGestureStart,
      onGestureEnd
    };
  }, [dispatchCommit, onCommit, onDetentChange, onGestureEnd, onGestureStart]);
  const stateRef = useRef(
    createDispenseGestureState(
      "dropwise",
      availableML,
      minimumCommitML,
      maximumCommitML
    )
  );
  const [state, setState] = useState(() =>
    createDispenseGestureState(
      "dropwise",
      availableML,
      minimumCommitML,
      maximumCommitML
    )
  );

  const applyEvent = useCallback(
    (event: DispenseGestureEvent) => {
      const transition = reduceDispenseGesture(stateRef.current, event);
      stateRef.current = transition.state;
      setState(transition.state);

      for (const commit of transition.commits) {
        const accepted = callbacksRef.current.dispatchCommit
          ? callbacksRef.current.dispatchCommit(commit)
          : dispatch({
              type: "add_titrant",
              volumeML: commit.volumeML,
              durationS: commit.durationS
            });
        if (!accepted) {
          const cancelled = reduceDispenseGesture(stateRef.current, {
            type: "cancel",
            reason: "dispatch_rejected"
          });
          stateRef.current = cancelled.state;
          setState(cancelled.state);
          break;
        }
        callbacksRef.current.onCommit?.(commit);
      }
    },
    [dispatch]
  );

  const setDetent = useCallback(
    (detent: FlowDetent) => {
      const previous = stateRef.current.selectedDetent;
      applyEvent({
        type: "select_detent",
        detent,
        nowMS: performance.now()
      });
      if (stateRef.current.selectedDetent !== previous) {
        callbacksRef.current.onDetentChange?.(detent);
      }
    },
    [applyEvent]
  );

  const start = useCallback(() => {
    if (!enabled) return;
    const wasHolding = stateRef.current.isHolding;
    applyEvent({
      type: "start",
      nowMS: performance.now(),
      availableML,
      minimumCommitML,
      maximumCommitML
    });
    if (!wasHolding && stateRef.current.isHolding) {
      callbacksRef.current.onGestureStart?.();
    }
  }, [applyEvent, availableML, enabled, maximumCommitML, minimumCommitML]);

  const end = useCallback(
    (reason: DispenseEndReason) => {
      const wasHolding = stateRef.current.isHolding;
      applyEvent({ type: "end", nowMS: performance.now(), reason });
      if (wasHolding && !stateRef.current.isHolding) {
        callbacksRef.current.onGestureEnd?.();
      }
    },
    [applyEvent]
  );

  useEffect(() => {
    if (!state.isHolding) return;

    let animationFrame = 0;
    const frame = (nowMS: number) => {
      applyEvent({ type: "tick", nowMS });
      if (stateRef.current.isHolding) {
        animationFrame = requestAnimationFrame(frame);
      }
    };

    animationFrame = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animationFrame);
  }, [applyEvent, state.isHolding]);

  useEffect(() => {
    if (
      !stateRef.current.isHolding ||
      (enabled && availableML >= minimumCommitML)
    ) {
      return;
    }
    applyEvent({ type: "cancel", reason: "permission_change" });
  }, [applyEvent, availableML, enabled, minimumCommitML]);

  useEffect(() => {
    if (!state.isHolding) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      end("escape");
    };
    const handleBlur = () => end("blur");
    const handleVisibilityChange = () => {
      if (document.hidden) end("visibility_change");
    };

    window.addEventListener("keydown", handleEscape, true);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("keydown", handleEscape, true);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [end, state.isHolding]);

  return { state, setDetent, start, end };
}
