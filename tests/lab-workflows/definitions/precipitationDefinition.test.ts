import { describe, expect, it } from "vitest";

import {
  PRECIPITATION_V2_DRAFT,
  validatePrecipitationV2
} from "../../../src/lab-workflows/definitions/precipitation";
import { validateLabWorkflowSpecV2 } from "../../../src/lab-workflows/validation";

const CHECKED_AT = "2026-07-19T15:00:00.000Z";

function observableOf(
  state: { chemistry: { observables: readonly { observableId: string; value: unknown }[] } },
  observableId: string
): unknown {
  return state.chemistry.observables.find(
    (observable) => observable.observableId === observableId
  )?.value;
}

describe("serialized precipitation v2 definition", () => {
  it("validates as runnable against current exact registries", () => {
    const outcome = validateLabWorkflowSpecV2(PRECIPITATION_V2_DRAFT, {
      checkedAt: CHECKED_AT
    });
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
    expect(outcome.validation.previewEligible).toBe(true);
  });

  it("loads through the pinned validator", () => {
    const workflow = validatePrecipitationV2(CHECKED_AT);
    expect(workflow.metadata.title).toBe("Silver chloride precipitation");
  });
});

describe("precipitation scene resolution", () => {
  it("resolves every placement to a renderable visual adapter", async () => {
    const { resolveEquipmentPose } = await import(
      "../../../src/lab-workflows/registries/scene-placements"
    );
    const { LAB_VISUAL_ADAPTERS } = await import(
      "../../../src/components/lab/titration/setupDrivenScene"
    );
    const { componentRegistry } = await import(
      "../../../src/lab-workflows/registries/components"
    );

    const workflow = validatePrecipitationV2(CHECKED_AT);
    for (const placement of workflow.layout.placements) {
      const equipment = workflow.equipment.find(
        ({ instanceId }) => instanceId === placement.equipmentInstanceId
      )!;
      const definition = componentRegistry.get(equipment.equipmentDefinitionId);
      const pose = resolveEquipmentPose({
        equipmentInstanceId: equipment.instanceId,
        equipmentDefinitionId: definition.id,
        visualAdapterDefinitionId: definition.visualAdapterDefinitionId,
        placementSlotId: placement.placementSlotId
      });
      // A missing adapter throws at scene resolution; a missing LabScene block
      // fails silently, so assert the registration explicitly.
      expect(LAB_VISUAL_ADAPTERS[pose.visualAdapterDefinitionId]).toBeDefined();
    }
  });
});

describe("precipitation authoring reproduction", () => {
  it("is recreated atomically through the shared human command layer", async () => {
    const { createAuthoredPrecipitationDraft } = await import(
      "../../../src/lab-workflows/definitions/precipitation/authoring"
    );
    expect(createAuthoredPrecipitationDraft()).toEqual(PRECIPITATION_V2_DRAFT);
  });
});

describe("precipitation runtime traces", () => {
  it("completes every valid pour sequence and forms the same product", async () => {
    const { createPrecipitationTracePlan } = await import(
      "../../../src/lab-workflows/definitions/precipitation"
    );
    const { createGenericLabActionTrace, runGenericTraceSuite } = await import(
      "../../../src/lab-workflows/replay"
    );
    const { createCapabilityGenericRuntimePorts } = await import(
      "../../../src/lab-workflows/runtime"
    );

    const workflow = validatePrecipitationV2(CHECKED_AT);
    const cases = createPrecipitationTracePlan().map((testCase, index) => ({
      kind: testCase.kind,
      trace: createGenericLabActionTrace({
        traceId: `trace.precipitation.${testCase.kind}.${index}`,
        sessionId: `precipitation-${index}`,
        sessionSeed: "precipitation-trace-seed",
        workflow,
        actions: testCase.actions
      })
    }));
    const results = runGenericTraceSuite(cases, () => ({
      workflow,
      ports: createCapabilityGenericRuntimePorts(workflow)
    }));

    for (const result of results) {
      expect(result.finalState.workflowStatus).toBe("completed");
      expect(
        observableOf(result.finalState, "observable.precipitate_observed.v1")
      ).toBe(true);
      expect(
        observableOf(result.finalState, "observable.precipitate_color.v1")
      ).toBe("white");
    }
  });

  it("does not complete or precipitate when only one solution is poured", async () => {
    const {
      createIncompletePrecipitationTrace,
      PRECIPITATION_V2_SOURCE_HASH
    } = await import("../../../src/lab-workflows/definitions/precipitation");
    const {
      assembleGenericLabRuntime,
      createCapabilityGenericRuntimePorts,
      GENERIC_LAB_RUNTIME_SCHEMA_VERSION
    } = await import("../../../src/lab-workflows/runtime");

    const workflow = validatePrecipitationV2(CHECKED_AT);
    const runtime = assembleGenericLabRuntime(
      workflow,
      {
        schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
        sessionId: "precipitation-incomplete",
        workflowId: workflow.id,
        workflowRevision: workflow.revision,
        workflowHash: PRECIPITATION_V2_SOURCE_HASH
      },
      createCapabilityGenericRuntimePorts(workflow)
    );

    let last;
    for (const action of createIncompletePrecipitationTrace()) {
      last = runtime.dispatch(action);
    }

    expect(last!.state.workflowStatus).not.toBe("completed");
    expect(
      observableOf(last!.state, "observable.precipitate_observed.v1")
    ).toBe(false);
    expect(observableOf(last!.state, "observable.precipitate_color.v1")).toBe(
      "clear"
    );
  });
});
