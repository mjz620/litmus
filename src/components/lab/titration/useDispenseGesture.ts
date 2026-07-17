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
}

export type DispenseGestureEvent =
  | { type: "select_detent"; detent: FlowDetent; nowMS: number }
  | { type: "start"; nowMS: number; availableML: number }
  | { type: "tick"; nowMS: number }
  | { type: "end"; nowMS: number; reason: DispenseEndReason };

export interface DispenseTransition {
  state: DispenseGestureState;
  commits: DispenseCommit[];
}

export function createDispenseGestureState(
  selectedDetent: FlowDetent = "dropwise",
  availableML = 0
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
    gestureDetentChanges: 0
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
      return startGesture(state, event.nowMS, event.availableML);
    case "tick":
      return advanceGesture(state, event.nowMS);
    case "end":
      return endGesture(state, event.nowMS);
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
        flushed.state.remainingML
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
  availableML: number
): DispenseTransition {
  const remainingML = sanitizeAvailableML(availableML);
  const detent = state.selectedDetent;

  if (state.isHolding || detent === "closed" || remainingML <= 0) {
    return {
      state: { ...state, remainingML },
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
      gestureDetentChanges: 0
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
  const requestedML = rateMLPerS * elapsedS;
  const addedML = Math.min(requestedML, state.remainingML);
  const activeDurationS = rateMLPerS > 0 ? addedML / rateMLPerS : 0;
  const exhausted =
    state.remainingML > 0 && requestedML >= state.remainingML - Number.EPSILON;

  let nextState: DispenseGestureState = {
    ...state,
    pendingML: state.pendingML + addedML,
    pendingDurationS: state.pendingDurationS + activeDurationS,
    remainingML: Math.max(0, state.remainingML - addedML),
    lastTimestampMS: nowMS
  };

  if (exhausted) {
    const flushed = flushPending(nextState, "empty");
    return {
      state: closeValve(flushed.state, flushed.state.remainingML),
      commits: flushed.commits
    };
  }

  if (nextState.pendingML >= DISPENSE_COMMIT_THRESHOLD_ML) {
    const flushed = flushPending(nextState, "threshold");
    nextState = flushed.state;
    return { state: nextState, commits: flushed.commits };
  }

  return { state: nextState, commits: [] };
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

  if (
    pendingML < DISPENSE_RESIDUE_ML ||
    pendingDurationS <= 0 ||
    state.activeDetent === "closed"
  ) {
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

  return {
    state: {
      ...state,
      pendingML: 0,
      pendingDurationS: 0,
      gestureCommittedML: state.gestureCommittedML + pendingML
    },
    commits: [
      {
        volumeML: pendingML,
        durationS: pendingDurationS,
        detent: state.activeDetent,
        reason
      }
    ]
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

function sanitizeAvailableML(availableML: number): number {
  return Number.isFinite(availableML) ? Math.max(0, availableML) : 0;
}

interface UseDispenseGestureOptions {
  availableML: number;
}

export interface DispenseGestureController {
  state: DispenseGestureState;
  setDetent: (detent: FlowDetent) => void;
  start: () => void;
  end: (reason: DispenseEndReason) => void;
}

/** Browser-event and animation-frame adapter around the pure reducer. */
export function useDispenseGesture({
  availableML
}: UseDispenseGestureOptions): DispenseGestureController {
  const dispatch = useLabStore((store) => store.dispatch);
  const stateRef = useRef(createDispenseGestureState("dropwise", availableML));
  const [state, setState] = useState(() =>
    createDispenseGestureState("dropwise", availableML)
  );

  const applyEvent = useCallback(
    (event: DispenseGestureEvent) => {
      const transition = reduceDispenseGesture(stateRef.current, event);
      stateRef.current = transition.state;
      setState(transition.state);

      for (const commit of transition.commits) {
        dispatch({
          type: "add_titrant",
          volumeML: commit.volumeML,
          durationS: commit.durationS
        });
      }
    },
    [dispatch]
  );

  const setDetent = useCallback(
    (detent: FlowDetent) => {
      applyEvent({
        type: "select_detent",
        detent,
        nowMS: performance.now()
      });
    },
    [applyEvent]
  );

  const start = useCallback(() => {
    applyEvent({
      type: "start",
      nowMS: performance.now(),
      availableML
    });
  }, [applyEvent, availableML]);

  const end = useCallback(
    (reason: DispenseEndReason) => {
      applyEvent({ type: "end", nowMS: performance.now(), reason });
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
