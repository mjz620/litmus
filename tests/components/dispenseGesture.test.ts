import { describe, expect, it } from "vitest";

import {
  type DispenseCommit,
  type DispenseEndReason,
  type DispenseGestureEvent,
  type DispenseGestureState,
  FLOW_RATES_ML_PER_S,
  createDispenseGestureState,
  reduceDispenseGesture
} from "../../src/components/lab/titration/useDispenseGesture";
import {
  EXAMPLE_STRONG,
  titration
} from "../../src/experiments/titration/titration";

interface TimelineResult {
  state: DispenseGestureState;
  commits: DispenseCommit[];
}

function runTimeline(
  initialState: DispenseGestureState,
  events: readonly DispenseGestureEvent[]
): TimelineResult {
  let state = initialState;
  const commits: DispenseCommit[] = [];

  for (const event of events) {
    const transition = reduceDispenseGesture(state, event);
    state = transition.state;
    commits.push(...transition.commits);
  }

  return { state, commits };
}

function stateForDetent(
  detent: "dropwise" | "slow" | "open",
  availableML = 10,
  minimumCommitML = 0.005
): DispenseGestureState {
  return createDispenseGestureState(detent, availableML, minimumCommitML);
}

describe("dispense gesture reducer", () => {
  it.each([
    ["dropwise", 0.05],
    ["slow", 0.2],
    ["open", 1]
  ] as const)(
    "preserves the %s detent rate in every segment",
    (detent, rate) => {
      const result = runTimeline(stateForDetent(detent), [
        { type: "start", nowMS: 0, availableML: 10 },
        { type: "tick", nowMS: 1_000 },
        { type: "end", nowMS: 1_000, reason: "pointer_up" }
      ]);

      expect(result.commits.length).toBeGreaterThan(0);
      for (const commit of result.commits) {
        expect(commit.detent).toBe(detent);
        expect(commit.volumeML / commit.durationS).toBeCloseTo(rate, 10);
      }
    }
  );

  it("conserves volume across threshold and gesture-end commits", () => {
    const initialAvailableML = 10;
    const result = runTimeline(stateForDetent("open", initialAvailableML), [
      { type: "start", nowMS: 0, availableML: initialAvailableML },
      { type: "tick", nowMS: 600 },
      { type: "tick", nowMS: 900 },
      { type: "end", nowMS: 1_000, reason: "pointer_up" }
    ]);
    const committedML = result.commits.reduce(
      (total, commit) => total + commit.volumeML,
      0
    );

    expect(result.commits.map(({ reason }) => reason)).toEqual([
      "threshold",
      "gesture_end"
    ]);
    expect(committedML).toBeCloseTo(1, 10);
    expect(result.state.remainingML).toBeCloseTo(
      initialAvailableML - committedML,
      10
    );
    expect(result.state.pendingML).toBe(0);
    expect(result.state.isHolding).toBe(false);
  });

  it("commits the old rate before accepting a debounced detent change", () => {
    const result = runTimeline(stateForDetent("slow"), [
      { type: "start", nowMS: 0, availableML: 10 },
      { type: "tick", nowMS: 500 },
      { type: "select_detent", detent: "open", nowMS: 500 },
      { type: "select_detent", detent: "dropwise", nowMS: 550 },
      { type: "tick", nowMS: 1_000 },
      { type: "end", nowMS: 1_000, reason: "pointer_up" }
    ]);

    expect(result.commits).toHaveLength(2);
    expect(result.commits[0]).toMatchObject({
      volumeML: 0.1,
      durationS: 0.5,
      detent: "slow",
      reason: "detent_change"
    });
    expect(result.commits[1]).toMatchObject({
      volumeML: 0.5,
      durationS: 0.5,
      detent: "open",
      reason: "threshold"
    });
    expect(result.state.selectedDetent).toBe("open");
  });

  it("clamps to available volume and auto-closes at empty", () => {
    const result = runTimeline(stateForDetent("open", 0.3), [
      { type: "start", nowMS: 0, availableML: 0.3 },
      { type: "tick", nowMS: 1_000 }
    ]);

    expect(result.commits).toEqual([
      {
        volumeML: 0.3,
        durationS: 0.3,
        detent: "open",
        reason: "empty"
      }
    ]);
    expect(result.state.remainingML).toBe(0);
    expect(result.state.activeDetent).toBe("closed");
    expect(result.state.isHolding).toBe(false);
  });

  it("carries a sub-minimum detent fragment until it forms a valid action", () => {
    const result = runTimeline(stateForDetent("dropwise", 0.5, 0.01), [
      { type: "start", nowMS: 0, availableML: 0.5, minimumCommitML: 0.01 },
      { type: "select_detent", detent: "slow", nowMS: 110 },
      { type: "tick", nowMS: 140 },
      { type: "end", nowMS: 140, reason: "pointer_up" }
    ]);

    expect(result.commits).toHaveLength(1);
    expect(result.commits[0]!.volumeML).toBeGreaterThanOrEqual(0.01);
    expect(result.commits[0]!.volumeML).toBeLessThanOrEqual(0.5);
    expect(result.commits[0]!.durationS).toBeGreaterThan(0);
    expect(result.state.remainingML).toBeCloseTo(
      0.5 - result.commits[0]!.volumeML,
      6
    );
  });

  it("never emits above the exact per-action allowance across frame partitions", () => {
    const events: DispenseGestureEvent[] = [
      { type: "start", nowMS: 0, availableML: 0.5, minimumCommitML: 0.01 }
    ];
    for (let frame = 1; frame <= 40; frame += 1) {
      events.push({ type: "tick", nowMS: frame * 16.67 });
    }
    const result = runTimeline(stateForDetent("open", 0.5, 0.01), events);

    expect(result.commits).toHaveLength(1);
    expect(result.commits[0]!.volumeML).toBe(0.5);
    expect(result.commits[0]!.volumeML).toBeLessThanOrEqual(0.5);
    expect(result.state.remainingML).toBe(0);
    expect(result.state.isHolding).toBe(false);
  });

  it("cancels pending delivery without emitting an action", () => {
    const result = runTimeline(stateForDetent("open", 0.5, 0.01), [
      { type: "start", nowMS: 0, availableML: 0.5, minimumCommitML: 0.01 },
      { type: "tick", nowMS: 100 },
      { type: "cancel", reason: "permission_change" }
    ]);

    expect(result.commits).toEqual([]);
    expect(result.state.isHolding).toBe(false);
    expect(result.state.pendingML).toBe(0);
    expect(result.state.remainingML).toBeCloseTo(0.5, 10);
  });

  it("drops sub-0.005 mL numerical residues without consuming volume", () => {
    const result = runTimeline(stateForDetent("slow", 1), [
      { type: "start", nowMS: 0, availableML: 1 },
      { type: "end", nowMS: 20, reason: "pointer_up" }
    ]);

    expect(result.commits).toEqual([]);
    expect(result.state.remainingML).toBeCloseTo(1, 10);
    expect(result.state.pendingML).toBe(0);
  });

  it("turns a dropwise click into one 0.05 mL, 1 second drop", () => {
    const result = runTimeline(stateForDetent("dropwise", 1), [
      { type: "start", nowMS: 0, availableML: 1 },
      { type: "end", nowMS: 50, reason: "pointer_up" }
    ]);

    expect(result.commits).toEqual([
      {
        volumeML: 0.05,
        durationS: 1,
        detent: "dropwise",
        reason: "gesture_end"
      }
    ]);
    expect(result.state.remainingML).toBeCloseTo(0.95, 10);
  });

  it.each([
    "pointer_up",
    "escape",
    "blur",
    "pointer_cancel",
    "visibility_change"
  ] satisfies readonly DispenseEndReason[])(
    "closes and commits on %s",
    (reason) => {
      const result = runTimeline(stateForDetent("slow"), [
        { type: "start", nowMS: 0, availableML: 10 },
        { type: "end", nowMS: 1_000, reason }
      ]);

      expect(result.commits).toEqual([
        {
          volumeML: 0.2,
          durationS: 1,
          detent: "slow",
          reason: "gesture_end"
        }
      ]);
      expect(result.state.activeDetent).toBe("closed");
      expect(result.state.isHolding).toBe(false);
      expect(result.state.pendingML).toBe(0);
    }
  );

  it("does not start while the selected detent is closed", () => {
    const result = runTimeline(createDispenseGestureState("closed", 10), [
      { type: "start", nowMS: 0, availableML: 10 },
      { type: "tick", nowMS: 2_000 }
    ]);

    expect(result.commits).toEqual([]);
    expect(result.state.isHolding).toBe(false);
    expect(result.state.remainingML).toBe(10);
  });
});

describe("dispense reducer with the titration engine", () => {
  it("emits the real high-flow near-endpoint flag for an open-valve timeline", () => {
    const gesture = runTimeline(stateForDetent("open", 26), [
      { type: "start", nowMS: 0, availableML: 26 },
      { type: "tick", nowMS: 1_000 },
      { type: "end", nowMS: 1_000, reason: "pointer_up" }
    ]);
    let engineState = titration.createInitialState(EXAMPLE_STRONG, {
      titrantAddedML: 24,
      buretteAvailableML: 26,
      buretteConditioned: true
    });
    const flags: string[] = [];

    for (const commit of gesture.commits) {
      const result = titration.step(engineState, {
        type: "add_titrant",
        volumeML: commit.volumeML,
        durationS: commit.durationS
      });
      engineState = result.state;
      flags.push(...result.events.flatMap((event) => event.flags));
    }

    expect(gesture.commits).toHaveLength(1);
    expect(gesture.commits[0]!.volumeML).toBeCloseTo(1, 10);
    expect(gesture.commits[0]!.durationS).toBeCloseTo(1, 10);
    expect(flags).toContain("flow_rate_high_near_endpoint");
    expect(engineState.titrantAddedML).toBeCloseTo(25, 10);
  });

  it("uses the documented rates for all non-closed detents", () => {
    expect(FLOW_RATES_ML_PER_S).toEqual({
      closed: 0,
      dropwise: 0.05,
      slow: 0.2,
      open: 1
    });
  });
});
