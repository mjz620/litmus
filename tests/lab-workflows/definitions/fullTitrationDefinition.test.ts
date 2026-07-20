import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { labWorkflowDraftV2Schema } from "../../../src/lab-workflows/schema/v2";
import { validateLabWorkflowSpecV2 } from "../../../src/lab-workflows/validation";

const CHECKED_AT = "2026-07-19T17:00:00.000Z";
const DRAFT = labWorkflowDraftV2Schema.parse(
  JSON.parse(
    readFileSync(
      "src/lab-workflows/definitions/titration/full-titration.v2.json",
      "utf8"
    )
  )
);

describe("full titration definition", () => {
  it("is recreated atomically through the shared human command layer", async () => {
    const { createAuthoredFullTitrationDraft } = await import(
      "../../../src/lab-workflows/definitions/titration/fullTitrationAuthoring"
    );
    expect(createAuthoredFullTitrationDraft()).toEqual(DRAFT);
  });

  it("validates as runnable", () => {
    const outcome = validateLabWorkflowSpecV2(DRAFT, { checkedAt: CHECKED_AT });
    if (!outcome.schemaValid || !outcome.validation.runnable) {
      throw new Error(
        JSON.stringify(
          outcome.issues.map(({ code, path, message }) => ({ code, path, message })),
          null,
          2
        )
      );
    }
    expect(outcome.validation.status).toBe("runnable");
  });

  it("starts from a ground-state bench", () => {
    expect(DRAFT.compatibility?.initializationPresetId).toBe(
      "seed.titration.fresh_bench.v1"
    );
  });
});

describe("full titration runtime traces", () => {
  it("separates a completed procedure from an unprepared one", async () => {
    const { createFullTitrationTracePlan, createUnpreparedTitrationTrace } =
      await import(
        "../../../src/lab-workflows/definitions/titration/fullTitrationTracePlan"
      );
    const { createGenericLabActionTrace, runGenericTraceSuite } = await import(
      "../../../src/lab-workflows/replay"
    );
    const { assembleGenericLabRuntime, GENERIC_LAB_RUNTIME_SCHEMA_VERSION } =
      await import("../../../src/lab-workflows/runtime");
    const { createLegacyTitrationRuntimePorts } = await import(
      "../../../src/lab-workflows/runtime/legacy"
    );
    const { validateFullTitrationV2, FULL_TITRATION_V2_SOURCE_HASH } =
      await import("../../../src/lab-workflows/definitions/titration");

    const workflow = validateFullTitrationV2(CHECKED_AT);
    const cases = createFullTitrationTracePlan().map((testCase, index) => ({
      kind: testCase.kind,
      trace: createGenericLabActionTrace({
        traceId: `trace.full_titration.${testCase.kind}.${index}`,
        sessionId: `full-titration-${index}`,
        sessionSeed: "full-titration-trace-seed",
        workflow,
        actions: testCase.actions
      })
    }));

    const results = runGenericTraceSuite(cases, () => ({
      workflow,
      ports: createLegacyTitrationRuntimePorts(workflow)
    }));
    expect(results).toHaveLength(3);

    // An unprepared bench cannot deliver titrant, so it must not complete.
    const runtime = assembleGenericLabRuntime(
      workflow,
      {
        schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
        sessionId: "full-titration-unprepared",
        workflowId: workflow.id,
        workflowRevision: workflow.revision,
        workflowHash: FULL_TITRATION_V2_SOURCE_HASH,
        sessionSeed: "full-titration-trace-seed"
      },
      createLegacyTitrationRuntimePorts(workflow)
    );
    let last;
    for (const action of createUnpreparedTitrationTrace()) {
      last = runtime.dispatch(action);
    }
    expect(last!.state.workflowStatus).not.toBe("completed");
  });
});
