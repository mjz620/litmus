import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { labWorkflowDraftV2Schema } from "../../../src/lab-workflows/schema/v2";
import { validateLabWorkflowSpecV2 } from "../../../src/lab-workflows/validation";

const CHECKED_AT = "2026-07-20T09:00:00.000Z";
const DRAFT = labWorkflowDraftV2Schema.parse(
  JSON.parse(
    readFileSync(
      "src/lab-workflows/definitions/titration/native-full-titration.v2.json",
      "utf8"
    )
  )
);

describe("native full titration definition", () => {
  it("is recreated atomically through the shared human command layer", async () => {
    const { createAuthoredNativeFullTitrationDraft } = await import(
      "../../../src/lab-workflows/definitions/titration/nativeFullTitrationAuthoring"
    );
    expect(createAuthoredNativeFullTitrationDraft()).toEqual(DRAFT);
  });

  it("validates as runnable at the pinned canonical hash without a compatibility block", async () => {
    const { NATIVE_FULL_TITRATION_V2_EXPECTED_HASH } = await import(
      "../../../src/lab-workflows/definitions/titration/native-full-titration"
    );
    const outcome = validateLabWorkflowSpecV2(DRAFT, { checkedAt: CHECKED_AT });
    if (!outcome.schemaValid || !outcome.validation.runnable) {
      throw new Error(
        JSON.stringify(
          outcome.issues.map(({ code, path, message }) => ({
            code,
            path,
            message
          })),
          null,
          2
        )
      );
    }
    expect(outcome.validation.status).toBe("runnable");
    expect(outcome.validation.canonicalSpecHash).toBe(
      NATIVE_FULL_TITRATION_V2_EXPECTED_HASH
    );
    expect(DRAFT.compatibility).toBeUndefined();
    expect(DRAFT.initialization).toBeUndefined();
    expect(DRAFT.requiredChemistryCapabilityIds).not.toContain(
      "chemistry.instrument_observables.v1"
    );
    expect(
      outcome.validation.resolvedChemistryModels.map(({ modelId }) => modelId)
    ).toContain("chemistry-model.acid_base_titration.v1");
  });

  it("still rejects engine endpoint completion without compatibility or the indicator capability", () => {
    const candidate = structuredClone(DRAFT) as {
      requiredChemistryCapabilityIds: string[];
    };
    candidate.requiredChemistryCapabilityIds =
      candidate.requiredChemistryCapabilityIds.filter(
        (id) => id !== "chemistry.indicator_response.v1"
      );
    const outcome = validateLabWorkflowSpecV2(candidate, {
      checkedAt: CHECKED_AT
    });
    expect(outcome.schemaValid).toBe(true);
    expect(
      outcome.issues.some(
        ({ code, path }) =>
          code === "validation.rule_condition_invalid.v2" &&
          path.endsWith("completionPolicyId")
      )
    ).toBe(true);
  });

  it("keeps the legacy definition's rule and permission identity for diagnosis parity", async () => {
    const { FULL_TITRATION_V2_DRAFT } = await import(
      "../../../src/lab-workflows/definitions/titration"
    );
    expect(DRAFT.rules).toEqual(FULL_TITRATION_V2_DRAFT.rules);
    expect(DRAFT.permittedActions).toEqual(
      FULL_TITRATION_V2_DRAFT.permittedActions
    );
  });
});

describe("native full titration runtime traces", () => {
  it("runs the full trace plan on the capability ports and blocks an unprepared bench", async () => {
    const { createFullTitrationTracePlan, createUnpreparedTitrationTrace } =
      await import(
        "../../../src/lab-workflows/definitions/titration/fullTitrationTracePlan"
      );
    const { createGenericLabActionTrace, runGenericTraceSuite } = await import(
      "../../../src/lab-workflows/replay"
    );
    const {
      assembleGenericLabRuntime,
      createCapabilityGenericRuntimePorts,
      GENERIC_LAB_RUNTIME_SCHEMA_VERSION
    } = await import("../../../src/lab-workflows/runtime");
    const { validateNativeFullTitrationV2, NATIVE_FULL_TITRATION_V2_EXPECTED_HASH } =
      await import(
        "../../../src/lab-workflows/definitions/titration/native-full-titration"
      );

    const workflow = validateNativeFullTitrationV2(CHECKED_AT);
    const cases = createFullTitrationTracePlan().map((testCase, index) => ({
      kind: testCase.kind,
      trace: createGenericLabActionTrace({
        traceId: `trace.native_full_titration.${testCase.kind}.${index}`,
        sessionId: `native-full-titration-${index}`,
        sessionSeed: "native-full-titration-trace-seed",
        workflow,
        actions: testCase.actions
      })
    }));

    const results = runGenericTraceSuite(cases, () => ({
      workflow,
      ports: createCapabilityGenericRuntimePorts(workflow)
    }));
    expect(results).toHaveLength(3);
    expect(
      results.every(({ finalState }) => finalState.compatibilityState === null)
    ).toBe(true);

    // An unprepared bench cannot deliver titrant, so it must not complete.
    const runtime = assembleGenericLabRuntime(
      workflow,
      {
        schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
        sessionId: "native-full-titration-unprepared",
        workflowId: workflow.id,
        workflowRevision: workflow.revision,
        workflowHash: NATIVE_FULL_TITRATION_V2_EXPECTED_HASH,
        sessionSeed: "native-full-titration-trace-seed"
      },
      createCapabilityGenericRuntimePorts(workflow)
    );
    let last;
    for (const action of createUnpreparedTitrationTrace()) {
      last = runtime.dispatch(action);
    }
    expect(last!.state.workflowStatus).not.toBe("completed");
  });
});

describe("native endpoint drill definition", () => {
  it("validates as runnable with the registered native initialization preset", async () => {
    const {
      NATIVE_ENDPOINT_DRILL_V2_EXPECTED_HASH,
      NATIVE_ENDPOINT_DRILL_V2_SOURCE_HASH,
      validateNativeEndpointDrillV2
    } = await import(
      "../../../src/lab-workflows/definitions/titration/native-endpoint-drill"
    );
    expect(NATIVE_ENDPOINT_DRILL_V2_SOURCE_HASH).toBe(
      NATIVE_ENDPOINT_DRILL_V2_EXPECTED_HASH
    );
    const workflow = validateNativeEndpointDrillV2(CHECKED_AT);
    expect(workflow.compatibility).toBeUndefined();
    expect(workflow.initialization).toEqual({
      presetId: "seed.titration.near_endpoint_22ml.v1"
    });
    expect(workflow.requiredChemistryCapabilityIds).not.toContain(
      "chemistry.instrument_observables.v1"
    );
    expect(workflow.permittedActions.map(({ id }) => id)).toEqual([
      "migration.permission.s1.a1",
      "migration.permission.s2.a1"
    ]);
    expect(workflow.rules.map(({ id }) => id)).toContain(
      "native.rule.endpoint_volume_tolerance"
    );
    expect(workflow.rules.map(({ id }) => id)).not.toContain(
      "migration.rule.s1.before.s2"
    );
  });

  it("rejects a native preset combined with a compatibility descriptor", async () => {
    const { STRICT_MIGRATED_TITRATION_V2_DRAFT } = await import(
      "../../../src/lab-workflows/definitions/titration"
    );
    const candidate = structuredClone(STRICT_MIGRATED_TITRATION_V2_DRAFT) as {
      initialization?: { presetId: string };
    };
    candidate.initialization = {
      presetId: "seed.titration.near_endpoint_22ml.v1"
    };
    const outcome = validateLabWorkflowSpecV2(candidate, {
      checkedAt: CHECKED_AT
    });
    expect(outcome.schemaValid).toBe(true);
    expect(
      outcome.issues.some(
        ({ code, path }) =>
          code === "validation.configuration_mismatch.v2" &&
          path === "initialization.presetId"
      )
    ).toBe(true);
  });

  it("rejects a native preset with no registered implementation", async () => {
    const { NATIVE_ENDPOINT_DRILL_V2_DRAFT } = await import(
      "../../../src/lab-workflows/definitions/titration/native-endpoint-drill"
    );
    const candidate = structuredClone(NATIVE_ENDPOINT_DRILL_V2_DRAFT) as {
      initialization?: { presetId: string };
    };
    candidate.initialization = { presetId: "seed.titration.fresh_bench.v1" };
    const outcome = validateLabWorkflowSpecV2(candidate, {
      checkedAt: CHECKED_AT
    });
    expect(outcome.schemaValid).toBe(true);
    expect(
      outcome.issues.some(
        ({ code, path }) =>
          code === "validation.registry_id_unavailable.v2" &&
          path === "initialization.presetId"
      )
    ).toBe(true);
  });
});
