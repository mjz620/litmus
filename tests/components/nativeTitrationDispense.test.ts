import { describe, expect, it } from "vitest";

import {
  createDispenseGestureState,
  reduceDispenseGesture
} from "../../src/components/lab/setup-driven/useDispenseGesture";
import { resolveLabSceneConfiguration } from "../../src/components/lab/titration/setupDrivenScene";
import { EXAMPLE_STRONG } from "../../src/experiments/titration/titration";
import { createLabStore } from "../../src/stores/labStore";
import { NATIVE_ENDPOINT_DRILL_SETUP_SELECTION } from "../../src/stores/setupDrivenLabSession";

describe("native stopcock dispense", () => {
  it("keeps open-valve drag dispensing across multiple 0.5 mL commits through the native session", async () => {
    const store = createLabStore();
    await store.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: "native-stopcock",
      config: EXAMPLE_STRONG,
      seed: { sessionSeed: "native-stopcock-seed" },
      runtimeMode: "native_v2"
    });

    expect(store.getState().runtimeMode).toBe("native_v2");
    expect(store.getState().runtimeInspection?.executionKind).toBe(
      "native_generic"
    );

    // Complete preparation from the keyboard path before delivering.
    store.getState().dispatch({ type: "rinse_burette", solvent: "titrant" });
    store.getState().dispatch({ type: "fill_burette", volumeML: 50 });
    store
      .getState()
      .dispatch({ type: "select_indicator", indicator: "phenolphthalein" });
    store.getState().dispatch({ type: "read_meniscus", reportedML: 0 });

    const configuration = resolveLabSceneConfiguration(
      store.getState().runtimeProjection
    );
    expect(configuration.availableActionIds).toContain("action.dispense.v1");
    expect(configuration.maxDispenseVolumeML).toBe(0.5);

    const availableML = configuration.projectedState!.burette!.availableML;
    expect(availableML).toBe(50);
    let state = createDispenseGestureState(
      "open",
      availableML,
      configuration.minDispenseVolumeML!,
      configuration.maxDispenseVolumeML
    );
    let transition = reduceDispenseGesture(state, {
      type: "start",
      nowMS: 0,
      availableML,
      minimumCommitML: configuration.minDispenseVolumeML!,
      maximumCommitML: configuration.maxDispenseVolumeML
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

    const total = commits.reduce((sum, { volumeML }) => sum + volumeML, 0);
    const finalState = store.getState().state as {
      titrantAddedML: number;
      curve: { volumeML: number; pH: number }[];
    };
    expect(finalState.titrantAddedML).toBeCloseTo(total, 6);

    // Every commit went through the native runtime as a normalized
    // action.dispense.v1 and emitted a pH observation for the curve.
    const trace = store.getState().runtimeActionTrace!;
    const dispenses = trace.actions.filter(
      ({ actionId }) => actionId === "action.dispense.v1"
    );
    expect(dispenses).toHaveLength(commits.length);
    expect(finalState.curve).toHaveLength(commits.length);
  });

  it("seeds the native endpoint drill mid-titration with an intentionally empty curve prefix", async () => {
    const store = createLabStore();
    await store.getState().loadExperiment({
      experimentId: "acid_base_titration",
      sessionId: "native-drill",
      config: EXAMPLE_STRONG,
      seed: { sessionSeed: "native-drill-seed" },
      runtimeMode: "native_v2",
      setupDrivenSelection: NATIVE_ENDPOINT_DRILL_SETUP_SELECTION
    });

    const initial = store.getState().state as {
      titrantAddedML: number;
      indicatorAdded: boolean;
      curve: { volumeML: number; pH: number }[];
    };
    expect(initial.titrantAddedML).toBe(22);
    expect(initial.indicatorAdded).toBe(true);
    // Known gap, documented for Phase 4: the seeded 0–22 mL prefix has no
    // emitted add_titrant events, so the chart intentionally starts at the
    // first native measurement instead of back-filling the preset prefix.
    expect(initial.curve).toEqual([]);

    store.getState().dispatch({ type: "read_meniscus", reportedML: 22 });
    const configuration = resolveLabSceneConfiguration(
      store.getState().runtimeProjection
    );
    expect(configuration.availableControlGroups).toContain("deliver");
    expect(configuration.maxDispenseVolumeML).toBe(0.5);

    const ok = store.getState().dispatch({
      type: "add_titrant",
      volumeML: 0.5,
      durationS: 4
    });
    expect(ok).toBe(true);
    const after = store.getState().state as {
      titrantAddedML: number;
      curve: { volumeML: number; pH: number }[];
    };
    expect(after.titrantAddedML).toBeCloseTo(22.5, 9);
    expect(after.curve).toHaveLength(1);
    expect(after.curve[0]!.volumeML).toBeCloseTo(22.5, 9);
  });
});
