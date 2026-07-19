import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  deserializeLabDraft,
  serializeLabDraft
} from "../../../src/lab-workflows/authoring";
import {
  SOLUTION_PREPARATION_AUTHORING_COMMANDS,
  SOLUTION_PREPARATION_V2_DRAFT,
  SOLUTION_PREPARATION_V2_EXPECTED_HASH,
  SOLUTION_PREPARATION_V2_SOURCE_HASH,
  createAuthoredSolutionPreparationDraft,
  validateSolutionPreparationV2
} from "../../../src/lab-workflows/definitions/solution-preparation";
import {
  createGenericLabActionTrace,
  replayGenericLabActionTrace,
  runGenericTraceSuite
} from "../../../src/lab-workflows/replay";
import {
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  createCapabilityGenericRuntimePorts,
  type NormalizedLabAction
} from "../../../src/lab-workflows/runtime";

const CHECKED_AT = "2026-07-18T14:00:00.000Z";
const SESSION_SEED = "solution-preparation-five-trace-suite";

function action(
  permissionId: string,
  actionId: string,
  sourceEquipmentInstanceId: string,
  targetEquipmentInstanceIds: readonly string[],
  parameters: NormalizedLabAction["parameters"] = []
): NormalizedLabAction {
  return {
    schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
    permissionId,
    actionId,
    sourceEquipmentInstanceId,
    targetEquipmentInstanceIds,
    parameters
  };
}

const condition = () =>
  action(
    "permission.condition_pipette",
    "action.rinse_transfer_device.v1",
    "stock_bottle",
    ["transfer_pipette"]
  );
const aspirate = (volumeML: number) =>
  action(
    "permission.aspirate_stock",
    "action.transfer_liquid.v1",
    "stock_bottle",
    ["transfer_pipette"],
    [{ key: "volumeML", valueType: "number", value: volumeML }]
  );
const deliver = (volumeML: number) =>
  action(
    "permission.deliver_aliquot",
    "action.transfer_liquid.v1",
    "transfer_pipette",
    ["preparation_flask"],
    [{ key: "volumeML", valueType: "number", value: volumeML }]
  );
const fill = (finalVolumeML: number) =>
  action(
    "permission.fill_to_mark",
    "action.fill_to_mark.v1",
    "water_bottle",
    ["preparation_flask"],
    [{ key: "finalVolumeML", valueType: "number", value: finalVolumeML }]
  );
const mix = (inversions = 10) =>
  action(
    "permission.mix_solution",
    "action.mix_solution.v1",
    "preparation_flask",
    [],
    [{ key: "inversions", valueType: "number", value: inversions }]
  );

const canonical = [condition(), aspirate(10), deliver(10), fill(100), mix()];
const alternate = [
  condition(),
  aspirate(5),
  deliver(5),
  aspirate(5),
  deliver(5),
  fill(100),
  mix()
];
const recoverable = [
  condition(),
  aspirate(10),
  deliver(10),
  fill(99.91),
  fill(100),
  mix()
];
const terminal = [fill(90)];
const boundary = [condition(), aspirate(10), deliver(10), fill(99.92), mix()];

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

describe("LC2-502 serialized solution-preparation definition", () => {
  it("is recreated atomically through the shared human command layer", () => {
    const recreated = createAuthoredSolutionPreparationDraft();
    expect(SOLUTION_PREPARATION_AUTHORING_COMMANDS.length).toBeGreaterThan(20);
    expect(recreated).toEqual(SOLUTION_PREPARATION_V2_DRAFT);
    expect(SOLUTION_PREPARATION_V2_SOURCE_HASH).toBe(
      SOLUTION_PREPARATION_V2_EXPECTED_HASH
    );
    expect(recreated).toMatchObject({
      schemaVersion: "2.1.0",
      revision: 2,
      supportStatus: "draft_unvalidated",
      validation: null,
      judgeCritique: null
    });
    expect(deserializeLabDraft(serializeLabDraft(recreated))).toEqual(
      recreated
    );
  });

  it("validates exact equipment, materials, models, rules, safety, and rubric", () => {
    const workflow = validateSolutionPreparationV2(CHECKED_AT);
    expect(workflow.validation).toMatchObject({
      status: "runnable",
      runnable: true,
      previewEligible: true,
      canonicalSpecHash: SOLUTION_PREPARATION_V2_SOURCE_HASH
    });
    expect(
      workflow.validation.resolvedChemistryModels.map(({ modelId }) => modelId)
    ).toEqual([
      "chemistry-model.shared_liquid_foundation.v1",
      "chemistry-model.concentration_dilution.v1"
    ]);
    expect(workflow.compatibility).toBeUndefined();
    expect(workflow.catalog).toBeUndefined();
    expect(workflow.rubric.totalPoints).toBe(10);
  });

  it("executes canonical, alternate, recoverable, terminal, and tolerance traces", () => {
    const workflow = validateSolutionPreparationV2(CHECKED_AT);
    const trace = (
      traceId: string,
      sessionId: string,
      actions: readonly NormalizedLabAction[]
    ) =>
      createGenericLabActionTrace({
        traceId,
        sessionId,
        sessionSeed: SESSION_SEED,
        workflow,
        actions
      });
    const cases = [
      {
        kind: "valid" as const,
        trace: trace(
          "trace.solution.canonical",
          "solution-canonical",
          canonical
        )
      },
      {
        kind: "alternate_valid" as const,
        trace: trace(
          "trace.solution.alternate",
          "solution-alternate",
          alternate
        )
      },
      {
        kind: "recoverable_mistake" as const,
        trace: trace(
          "trace.solution.recoverable",
          "solution-recoverable",
          recoverable
        )
      },
      {
        kind: "terminal_mistake" as const,
        trace: trace("trace.solution.terminal", "solution-terminal", terminal)
      },
      {
        kind: "tolerance_boundary" as const,
        trace: trace("trace.solution.boundary", "solution-boundary", boundary)
      }
    ];
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
    for (const result of results.slice(0, 3)) {
      expect(
        observable(result!.finalState, "observable.solution_concentration_m.v1")
      ).toBe(0.05);
      expect(
        observable(result!.finalState, "observable.solution_volume_ml.v1")
      ).toBe(100);
    }
    expect(
      results[3]!.finalState.diagnoses.find(
        ({ ruleId }) => ruleId === "rule.deliver_before_fill"
      )
    ).toMatchObject({
      status: "violated",
      severity: "conceptual",
      recoverable: false
    });
    expect(
      results[2]!.states[4]!.diagnoses.find(
        ({ ruleId }) => ruleId === "rule.final_volume_tolerance"
      )
    ).toMatchObject({ status: "violated", recoverable: true });
    expect(
      results[2]!.finalState.diagnoses.find(
        ({ ruleId }) => ruleId === "rule.final_volume_tolerance"
      )
    ).toMatchObject({ status: "satisfied" });
    expect(
      results[4]!.finalState.diagnoses.find(
        ({ ruleId }) => ruleId === "rule.final_volume_tolerance"
      )
    ).toMatchObject({
      status: "satisfied",
      observed: { valueType: "number", value: 99.92, unitId: "unit.ml.v1" }
    });

    const replay = replayGenericLabActionTrace(cases[0]!.trace, {
      workflow,
      ports: createCapabilityGenericRuntimePorts(workflow)
    });
    expect(replay.finalState).toEqual(results[0]!.finalState);
    expect(replay.trace.provenance.compatibility).toBeNull();
    expect(replay.finalState.eventEnvelopes.length).toBeGreaterThan(0);
    expect(
      replay.finalState.eventEnvelopes.flatMap(
        ({ ruleEvidenceIds }) => ruleEvidenceIds
      )
    ).toContain("rule.aliquot_delivered");
  });

  it("uses inclusive tolerance at just-inside, equal, and just-outside values", () => {
    const workflow = validateSolutionPreparationV2(CHECKED_AT);
    const run = (sessionId: string, finalVolumeML: number) =>
      replayGenericLabActionTrace(
        createGenericLabActionTrace({
          traceId: `trace.${sessionId}`,
          sessionId,
          sessionSeed: SESSION_SEED,
          workflow,
          actions: [
            condition(),
            aspirate(10),
            deliver(10),
            fill(finalVolumeML),
            ...(finalVolumeML >= 99.92 ? [mix()] : [])
          ]
        }),
        { workflow, ports: createCapabilityGenericRuntimePorts(workflow) }
      );
    const inside = run("solution-inside", 99.93);
    const equal = run("solution-equal", 99.92);
    const outside = run("solution-outside", 99.91);
    const diagnosis = (
      result: ReturnType<typeof replayGenericLabActionTrace>
    ) =>
      result.finalState.diagnoses.find(
        ({ ruleId }) => ruleId === "rule.final_volume_tolerance"
      )?.status;

    expect(diagnosis(inside)).toBe("satisfied");
    expect(diagnosis(equal)).toBe("satisfied");
    expect(diagnosis(outside)).toBe("violated");
  });

  it("contains no family dispatch, UI chemistry, network, or alternate runtime", () => {
    const definition = readFileSync(
      new URL(
        "../../../src/lab-workflows/definitions/solution-preparation/authoring.ts",
        import.meta.url
      ),
      "utf8"
    );
    const ports = readFileSync(
      new URL(
        "../../../src/lab-workflows/runtime/generic/productionPorts.ts",
        import.meta.url
      ),
      "utf8"
    );
    expect(`${definition}\n${ports}`).not.toMatch(
      /familyId\s*===|switch\s*\(.*family|engine\.dilution|fetch\(|openai|react/i
    );
  });
});
