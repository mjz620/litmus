import { describe, expect, it } from "vitest";

import {
  getProcedureStage,
  getProcedureStageLabel
} from "../../src/components/lab/titration/procedureStage";
import type { SemanticEvent } from "../../src/experiments/shared";
import {
  EXAMPLE_STRONG,
  type TitrationState
} from "../../src/experiments/titration/titration";

function makeState(overrides: Partial<TitrationState> = {}): TitrationState {
  return {
    config: EXAMPLE_STRONG,
    sessionSeed: null,
    titrantAddedML: 0,
    buretteAvailableML: 0,
    buretteConditioned: false,
    titrantDilutionFactor: 1,
    tSim: 0,
    curve: [],
    submitted: false,
    ...overrides
  };
}

function makeEvent(type: string): SemanticEvent {
  return { type, tSim: 0, observation: {}, flags: [], evidence: [] };
}

describe("titration procedure stage projection", () => {
  it("starts at burette preparation before any fill", () => {
    expect(getProcedureStage(makeState(), [])).toBe("prepare_burette");
  });

  it("moves to titrant addition after a fill", () => {
    const state = makeState({ buretteAvailableML: 50 });
    expect(getProcedureStage(state, [makeEvent("fill_burette")])).toBe(
      "add_titrant"
    );
  });

  it("stays in titrant addition while deliveries continue", () => {
    const state = makeState({ buretteAvailableML: 40, titrantAddedML: 10 });
    const events = [
      makeEvent("fill_burette"),
      makeEvent("read_meniscus"),
      makeEvent("add_titrant")
    ];
    expect(getProcedureStage(state, events)).toBe("add_titrant");
  });

  it("moves to recording once a reading follows the last addition", () => {
    const state = makeState({ buretteAvailableML: 40, titrantAddedML: 10 });
    const events = [
      makeEvent("fill_burette"),
      makeEvent("add_titrant"),
      makeEvent("read_meniscus")
    ];
    expect(getProcedureStage(state, events)).toBe("record_results");
  });

  it("reports submission as the final stage", () => {
    const state = makeState({
      buretteAvailableML: 40,
      titrantAddedML: 10,
      submitted: true
    });
    expect(getProcedureStage(state, [])).toBe("report_submitted");
  });

  it("labels every stage with student-facing text", () => {
    expect(getProcedureStageLabel("prepare_burette")).toBe(
      "Prepare the burette"
    );
    expect(getProcedureStageLabel("add_titrant")).toBe(
      "Titrate toward the endpoint"
    );
    expect(getProcedureStageLabel("record_results")).toBe(
      "Record your readings"
    );
    expect(getProcedureStageLabel("report_submitted")).toBe("Report submitted");
  });
});
