import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  deserializeLabDraft,
  serializeLabDraft
} from "../../../src/lab-workflows/authoring";
import {
  CALORIMETRY_AUTHORING_COMMANDS,
  CALORIMETRY_V2_DRAFT,
  CALORIMETRY_V2_EXPECTED_HASH,
  CALORIMETRY_V2_SOURCE_HASH,
  createAuthoredCalorimetryDraft,
  createCalorimetryTracePlan,
  validateCalorimetryV2
} from "../../../src/lab-workflows/definitions/calorimetry";
import {
  createGenericLabActionTrace,
  replayGenericLabActionTrace,
  runGenericTraceSuite
} from "../../../src/lab-workflows/replay";
import { createCapabilityGenericRuntimePorts } from "../../../src/lab-workflows/runtime";

const CHECKED_AT = "2026-07-19T12:00:00.000Z";
const SESSION_SEED = "calorimetry-five-trace-suite";

function observable(
  state: ReturnType<typeof replayGenericLabActionTrace>["finalState"],
  observableId: string
): number {
  const match = state.chemistry.observables.find(
    (entry) => entry.observableId === observableId
  );
  if (!match || typeof match.value !== "number")
    throw new Error(`Missing observable ${observableId}`);
  return match.value;
}

describe("LC2-912 serialized calorimetry definition", () => {
  it("is recreated atomically through the shared human command layer", () => {
    const recreated = createAuthoredCalorimetryDraft();
    expect(CALORIMETRY_AUTHORING_COMMANDS.length).toBeGreaterThan(20);
    expect(recreated).toEqual(CALORIMETRY_V2_DRAFT);
    expect(CALORIMETRY_V2_SOURCE_HASH).toBe(CALORIMETRY_V2_EXPECTED_HASH);
    expect(recreated).toMatchObject({
      schemaVersion: "2.0.0",
      revision: 2,
      supportStatus: "draft_unvalidated",
      validation: null,
      judgeCritique: null
    });
    expect(deserializeLabDraft(serializeLabDraft(recreated))).toEqual(
      recreated
    );
    expect(
      JSON.parse(
        readFileSync(
          "src/lab-workflows/definitions/calorimetry/hot-cold-water.v2.json",
          "utf8"
        )
      )
    ).toEqual(CALORIMETRY_V2_DRAFT);
  });

  it("validates exact equipment, materials, models, rules, safety, and rubric", () => {
    const workflow = validateCalorimetryV2(CHECKED_AT);
    expect(workflow.validation).toMatchObject({
      status: "runnable",
      runnable: true,
      previewEligible: true,
      canonicalSpecHash: CALORIMETRY_V2_SOURCE_HASH
    });
    expect(
      workflow.validation.resolvedChemistryModels.map(({ modelId }) => modelId)
    ).toEqual([
      "chemistry-model.shared_liquid_foundation.v1",
      "chemistry-model.thermal_energy.v1"
    ]);
    expect(workflow.compatibility).toBeUndefined();
    expect(workflow.catalog).toBeUndefined();
    expect(workflow.rubric.totalPoints).toBe(10);
  });

  it("executes canonical, alternate, recoverable, terminal, and tolerance traces", () => {
    const workflow = validateCalorimetryV2(CHECKED_AT);
    const plan = createCalorimetryTracePlan();
    const cases = plan.map((testCase, index) => ({
      kind: testCase.kind,
      trace: createGenericLabActionTrace({
        traceId: `trace.calorimetry.${testCase.kind}`,
        sessionId: `calorimetry-${index}`,
        sessionSeed: SESSION_SEED,
        workflow,
        actions: testCase.actions
      })
    }));
    const results = runGenericTraceSuite(cases, () => ({
      workflow,
      ports: createCapabilityGenericRuntimePorts(workflow)
    }));

    expect(results.map(({ finalState }) => finalState.workflowStatus)).toEqual([
      "completed",
      "completed",
      "completed",
      "failed",
      "completed"
    ]);
    for (const result of results.filter(
      ({ finalState }) => finalState.workflowStatus === "completed"
    )) {
      expect(
        observable(result.finalState, "observable.calorimeter_temperature_c.v1")
      ).toBe(39.268);
      expect(
        observable(result.finalState, "observable.calorimeter_volume_ml.v1")
      ).toBe(100);
    }
    expect(
      results[3]!.finalState.diagnoses.find(
        ({ ruleId }) => ruleId === "rule.hot_before_mix"
      )
    ).toMatchObject({
      status: "violated",
      severity: "conceptual",
      recoverable: false
    });
    expect(
      results[2]!.states[2]!.diagnoses.find(
        ({ ruleId }) => ruleId === "rule.final_volume_tolerance"
      )
    ).toMatchObject({ status: "violated", recoverable: true });
    expect(
      results[2]!.finalState.diagnoses.find(
        ({ ruleId }) => ruleId === "rule.final_volume_tolerance"
      )
    ).toMatchObject({ status: "satisfied" });

    const replay = replayGenericLabActionTrace(cases[0]!.trace, {
      workflow,
      ports: createCapabilityGenericRuntimePorts(workflow)
    });
    expect(replay.finalState).toEqual(results[0]!.finalState);
    expect(replay.trace.provenance.compatibility).toBeNull();
  });
});
