import { describe, expect, it } from "vitest";

import { resolveTitrationSceneConfiguration } from "../../src/components/lab/titration/setupDrivenScene";
import {
  createDispenseGestureState,
  reduceDispenseGesture
} from "../../src/components/lab/titration/useDispenseGesture";
import { EXAMPLE_STRONG } from "../../src/experiments/titration/titration";
import { createLabStore } from "../../src/stores/labStore";
import { STRICT_TITRATION_SETUP_SELECTION } from "../../src/stores/setupDrivenLabSession";

describe("setup-driven stopcock dispense", () => {
  it("keeps open-valve drag dispensing across multiple 0.5 mL workflow commits", async () => {
    const store = createLabStore();
    await store.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: "setup-driven-stopcock",
      config: EXAMPLE_STRONG,
      runtimeMode: "setup_driven_v2",
      setupDrivenSelection: STRICT_TITRATION_SETUP_SELECTION
    });

    const before = resolveTitrationSceneConfiguration(
      store.getState().runtimeProjection
    );
    expect(before.availableControlGroups).toEqual(["reading"]);

    store.getState().dispatch({ type: "read_meniscus", reportedML: 22 });
    const after = resolveTitrationSceneConfiguration(
      store.getState().runtimeProjection
    );
    expect(after.availableControlGroups).toEqual(["deliver"]);
    expect(after.maxDispenseVolumeML).toBe(0.5);

    const availableML = after.projectedState!.burette!.availableML;
    let state = createDispenseGestureState(
      "open",
      availableML,
      after.minDispenseVolumeML!,
      after.maxDispenseVolumeML
    );
    let transition = reduceDispenseGesture(state, {
      type: "start",
      nowMS: 0,
      availableML,
      minimumCommitML: after.minDispenseVolumeML!,
      maximumCommitML: after.maxDispenseVolumeML
    });
    state = transition.state;

    const commits: { volumeML: number; durationS: number }[] = [];
    for (let frame = 1; frame <= 120; frame += 1) {
      transition = reduceDispenseGesture(state, {
        type: "tick",
        nowMS: frame * 16.67
      });
      state = transition.state;
      for (const commit of transition.commits) {
        expect(commit.volumeML).toBeLessThanOrEqual(0.5);
        const ok = store.getState().dispatch({
          type: "add_titrant",
          volumeML: commit.volumeML,
          durationS: commit.durationS
        });
        expect(ok).toBe(true);
        commits.push(commit);
      }
    }

    expect(commits.length).toBeGreaterThanOrEqual(2);
    expect(state.isHolding).toBe(true);
    expect(
      (store.getState().state as { titrantAddedML: number }).titrantAddedML
    ).toBeGreaterThan(22.5);
  });

  it("does not fake-empty the gesture by treating maxVolumeMLPerAction as available volume", () => {
    let state = createDispenseGestureState("open", 28, 0.01, 0.5);
    let transition = reduceDispenseGesture(state, {
      type: "start",
      nowMS: 0,
      availableML: 28,
      minimumCommitML: 0.01,
      maximumCommitML: 0.5
    });
    state = transition.state;
    const commits = [];
    for (let frame = 1; frame <= 80; frame += 1) {
      transition = reduceDispenseGesture(state, {
        type: "tick",
        nowMS: frame * 16.67
      });
      state = transition.state;
      commits.push(...transition.commits);
    }

    const committedML = commits.reduce(
      (total, commit) => total + commit.volumeML,
      0
    );
    expect(commits.length).toBeGreaterThanOrEqual(2);
    expect(commits.every((commit) => commit.volumeML <= 0.5)).toBe(true);
    expect(state.isHolding).toBe(true);
    expect(committedML + state.pendingML + state.remainingML).toBeCloseTo(
      28,
      6
    );
  });
});
