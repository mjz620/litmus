import { describe, expect, it } from "vitest";

import { composerLabTemplateCatalog } from "../../../src/components/teacher/lab-composer/catalog";
import {
  SOLUTION_PREPARATION_QUARTER_AUTHORING_COMMANDS,
  SOLUTION_PREPARATION_QUARTER_V2_DRAFT,
  SOLUTION_PREPARATION_QUARTER_V2_EXPECTED_HASH,
  SOLUTION_PREPARATION_QUARTER_V2_SOURCE_HASH,
  SOLUTION_PREPARATION_STOCK_1M_AUTHORING_COMMANDS,
  SOLUTION_PREPARATION_STOCK_1M_V2_DRAFT,
  SOLUTION_PREPARATION_STOCK_1M_V2_EXPECTED_HASH,
  SOLUTION_PREPARATION_STOCK_1M_V2_SOURCE_HASH,
  createAuthoredSolutionPreparationQuarterDraft,
  createAuthoredSolutionPreparationStock1mDraft,
  createSolutionPreparationTracePlan,
  validateSolutionPreparationQuarterV2,
  validateSolutionPreparationStock1mV2
} from "../../../src/lab-workflows/definitions/solution-preparation";
import {
  createGenericLabActionTrace,
  runGenericTraceSuite
} from "../../../src/lab-workflows/replay";
import { createCapabilityGenericRuntimePorts } from "../../../src/lab-workflows/runtime";

const CHECKED_AT = "2026-07-19T16:00:00.000Z";

describe("LC2-903 solution-prep template expansion", () => {
  it("exposes three Composer dilution templates with distinct targets", () => {
    const dilutionTemplates = composerLabTemplateCatalog.filter(({ id }) =>
      id.startsWith("solution_preparation")
    );
    expect(dilutionTemplates.map(({ id }) => id)).toEqual([
      "solution_preparation",
      "solution_preparation_stock_1m",
      "solution_preparation_quarter"
    ]);
    expect(new Set(dilutionTemplates.map(({ draft }) => draft.id)).size).toBe(
      3
    );
  });

  it.each([
    [
      "stock 1 M",
      createAuthoredSolutionPreparationStock1mDraft,
      SOLUTION_PREPARATION_STOCK_1M_AUTHORING_COMMANDS,
      SOLUTION_PREPARATION_STOCK_1M_V2_DRAFT,
      SOLUTION_PREPARATION_STOCK_1M_V2_EXPECTED_HASH,
      SOLUTION_PREPARATION_STOCK_1M_V2_SOURCE_HASH,
      validateSolutionPreparationStock1mV2,
      "1",
      0.1
    ],
    [
      "quarter",
      createAuthoredSolutionPreparationQuarterDraft,
      SOLUTION_PREPARATION_QUARTER_AUTHORING_COMMANDS,
      SOLUTION_PREPARATION_QUARTER_V2_DRAFT,
      SOLUTION_PREPARATION_QUARTER_V2_EXPECTED_HASH,
      SOLUTION_PREPARATION_QUARTER_V2_SOURCE_HASH,
      validateSolutionPreparationQuarterV2,
      "0.25",
      0.025
    ]
  ] as const)(
    "pins, recreates, and five-trace exercises the %s dilution seed",
    (
      _label,
      createDraft,
      commands,
      draft,
      expectedHash,
      sourceHash,
      validate,
      stockDecimal,
      productConcentrationM
    ) => {
      expect(commands.length).toBeGreaterThan(20);
      expect(createDraft()).toEqual(draft);
      expect(sourceHash).toBe(expectedHash);
      const workflow = validate(CHECKED_AT);
      expect(workflow.validation).toMatchObject({
        status: "runnable",
        runnable: true,
        previewEligible: true,
        canonicalSpecHash: expectedHash
      });
      expect(workflow.materials[0]).toMatchObject({
        materialProfileId: "reagent.sodium_chloride_aqueous.v1",
        initialization: {
          concentration: { decimalValue: stockDecimal }
        }
      });

      const plan = createSolutionPreparationTracePlan();
      const cases = plan.map((entry) => ({
        kind: entry.kind,
        trace: createGenericLabActionTrace({
          traceId: `trace.${workflow.id}.${entry.kind}`,
          sessionId: `session.${workflow.id}.${entry.kind}`,
          sessionSeed: "lc2-903-dilution-suite",
          workflow,
          actions: entry.actions
        })
      }));
      const results = runGenericTraceSuite(cases, () => ({
        workflow,
        ports: createCapabilityGenericRuntimePorts(workflow)
      }));
      expect(results.map(({ finalState }) => finalState.workflowStatus)).toEqual(
        ["completed", "completed", "completed", "failed", "completed"]
      );
      const concentration = results[0]!.finalState.chemistry.observables.find(
        ({ observableId }) =>
          observableId === "observable.solution_concentration_m.v1"
      );
      expect(concentration?.value).toBeCloseTo(productConcentrationM, 10);
    }
  );
});
