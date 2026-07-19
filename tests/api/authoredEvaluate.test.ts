import { describe, expect, it } from "vitest";

import { POST } from "../../src/app/api/evaluate/route";
import { createAuthoredEvaluationRequest } from "../../src/lib/agent/authoredEvaluator";
import {
  authoredEvaluationErrorResponseSchema,
  authoredEvaluationResponseSchema
} from "../../src/lib/agent/evaluatorSchemas";
import { validateSolutionPreparationV2 } from "../../src/lab-workflows/definitions/solution-preparation";
import {
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  assembleGenericLabRuntime,
  createCapabilityGenericRuntimePorts
} from "../../src/lab-workflows/runtime";

const workflow = validateSolutionPreparationV2("2026-07-18T22:30:00.000Z");
const sessionId = "authored-evaluate-route";
const runtime = assembleGenericLabRuntime(
  workflow,
  {
    schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
    sessionId,
    sessionSeed: "authored-evaluate-route-seed",
    workflowId: workflow.id,
    workflowRevision: workflow.revision,
    workflowHash: workflow.validation.canonicalSpecHash
  },
  createCapabilityGenericRuntimePorts(workflow)
);
const body = createAuthoredEvaluationRequest({
  sessionId,
  experimentId: "solution_preparation",
  assignedDefinition: workflow,
  runtimeState: runtime.getState(),
  report: {
    procedureSummary: "I described the registered preparation sequence.",
    dataAnalysis: "I tied my interpretation to the displayed evidence.",
    conceptExplanation: "I explained how the work relates to dilution.",
    sourcesOfError: "I identified a possible transfer error."
  }
});

function request(payload: unknown): Request {
  return new Request("http://localhost/api/evaluate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
}

describe("POST /api/evaluate authored-rubric v2", () => {
  it("returns a versioned deterministic fallback with exact provenance", async () => {
    const response = await POST(request(body));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(() => authoredEvaluationResponseSchema.parse(json)).not.toThrow();
    expect(json).toMatchObject({
      ok: true,
      contractVersion: "2.0.0",
      metadata: {
        mode: "deterministic_fallback",
        definitionHash: workflow.validation.canonicalSpecHash,
        rubricId: workflow.rubric.id
      }
    });
  });

  it("rejects malformed and stale v2 requests without falling into legacy", async () => {
    const malformed = await POST(
      request({ contractVersion: "2.0.0", sessionId })
    );
    const malformedJson = await malformed.json();
    expect(malformed.status).toBe(400);
    expect(() =>
      authoredEvaluationErrorResponseSchema.parse(malformedJson)
    ).not.toThrow();

    const stale = structuredClone(body);
    stale.runtimeState.provenance.workflowHash =
      "sha256:0000000000000000000000000000000000000000000000000000000000000000";
    const staleResponse = await POST(request(stale));
    expect(staleResponse.status).toBe(409);
    expect(await staleResponse.json()).toMatchObject({
      ok: false,
      error: { code: "evaluator.runtime_provenance_mismatch.v2" }
    });
  });
});
