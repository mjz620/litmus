import { describe, expect, it } from "vitest";

import {
  createLabWorkflowConsumerContext,
  labWorkflowConsumerContextSchema
} from "../../../src/lab-workflows/consumers";
import { validateStrictMigratedTitrationV2 } from "../../../src/lab-workflows/definitions/titration";
import {
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  assembleGenericLabRuntime,
  createLegacyTitrationRuntimePorts
} from "../../../src/lab-workflows/runtime";

const CHECKED_AT = "2026-07-18T05:00:00.000Z";

describe("lab workflow consumer context", () => {
  it("projects one exact deterministic contract for every downstream consumer", () => {
    const workflow = validateStrictMigratedTitrationV2(CHECKED_AT);
    const runtime = assembleGenericLabRuntime(
      workflow,
      {
        schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
        sessionId: "consumer-context",
        sessionSeed: "consumer-context-seed",
        workflowId: workflow.id,
        workflowRevision: workflow.revision,
        workflowHash: workflow.validation.canonicalSpecHash
      },
      createLegacyTitrationRuntimePorts(workflow)
    );
    const context = createLabWorkflowConsumerContext(
      workflow,
      runtime.getState()
    );

    expect(context).toMatchObject({
      schemaVersion: "1.0.0",
      workflow: {
        id: workflow.id,
        revision: workflow.revision,
        canonicalSpecHash: workflow.validation.canonicalSpecHash,
        validatorVersion: workflow.validation.validatorVersion
      },
      objectiveIds: ["endpoint_control", "meniscus_reading"],
      rubric: { id: "rubric.endpoint_control_prelab.seed.v1" },
      diagnoses: expect.any(Array),
      eventEnvelopes: [],
      finalObservables: expect.arrayContaining([
        {
          observableId: "observable.burette_reading_ml.v1",
          value: 22,
          unitId: "unit.ml.v1"
        }
      ])
    });
    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context.rubric.criteria)).toBe(true);
    expect(labWorkflowConsumerContextSchema.parse(context)).toEqual(context);
  });

  it("rejects a runtime state with stale workflow provenance", () => {
    const workflow = validateStrictMigratedTitrationV2(CHECKED_AT);
    const runtime = assembleGenericLabRuntime(
      workflow,
      {
        schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
        sessionId: "consumer-context-stale",
        sessionSeed: "consumer-context-stale-seed",
        workflowId: workflow.id,
        workflowRevision: workflow.revision,
        workflowHash: workflow.validation.canonicalSpecHash
      },
      createLegacyTitrationRuntimePorts(workflow)
    );
    const staleState = {
      ...runtime.getState(),
      provenance: {
        ...runtime.getState().provenance,
        workflowHash: "sha256:stale"
      }
    };
    expect(() =>
      createLabWorkflowConsumerContext(workflow, staleState)
    ).toThrow("does not match");
  });
});
