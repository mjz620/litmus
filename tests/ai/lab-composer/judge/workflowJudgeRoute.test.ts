import { beforeAll, describe, expect, it } from "vitest";

import { POST } from "../../../../src/app/api/lab-composer/judge/route";
import { runCapabilityAuthoring } from "../../../../src/lib/agent/lab-authoring/capabilityAuthor";
import type { CapabilityAuthorRequest } from "../../../../src/lib/agent/lab-authoring/capabilityAuthorSchemas";
import { createWorkflowJudgeRequest } from "../../../../src/lib/agent/lab-workflow-judge/judge";
import { checkWorkflowJudgeRateLimit } from "../../../../src/lib/agent/lab-workflow-judge/rateLimit";
import {
  WORKFLOW_JUDGE_LIMITS,
  workflowJudgeErrorResponseSchema,
  workflowJudgeResponseSchema,
  type WorkflowJudgeRequest
} from "../../../../src/lib/agent/lab-workflow-judge/schemas";
import { validatedLabWorkflowSpecV2Schema } from "../../../../src/lab-workflows/schema/v2";

const AUTHOR_REQUEST: CapabilityAuthorRequest = {
  contractVersion: "2.0.0",
  teacherRequest:
    "Create a sodium chloride dilution lab using a volumetric pipette and flask.",
  gradeBand: "mixed_high_school",
  targetMinutes: 12,
  classContext: "One Chromebook per student.",
  deviceProfileId: "device.chromebook_core.v1"
};

let judgeRequest: WorkflowJudgeRequest;

beforeAll(async () => {
  const authored = await runCapabilityAuthoring(AUTHOR_REQUEST, {
    checkedAt: "2026-07-18T22:50:00.000Z"
  });
  if (!authored.result.workflow || authored.result.outcome !== "runnable")
    throw new Error("Expected runnable author fixture");
  const workflow = validatedLabWorkflowSpecV2Schema.parse(
    authored.result.workflow
  );
  judgeRequest = createWorkflowJudgeRequest({
    teacherRequest: AUTHOR_REQUEST.teacherRequest,
    workflow,
    traces: authored.result.traces
  });
});

function request(payload: unknown, key: string): Request {
  return new Request("http://localhost/api/lab-composer/judge", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": key
    },
    body: typeof payload === "string" ? payload : JSON.stringify(payload)
  });
}

describe("POST /api/lab-composer/judge", () => {
  it("returns a bounded exact-hash advisory critique", async () => {
    const response = await POST(request(judgeRequest, "judge-route-good"));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(() => workflowJudgeResponseSchema.parse(json)).not.toThrow();
    expect(json).toMatchObject({
      ok: true,
      authority: "advisory_only",
      metadata: {
        mode: "deterministic_fallback",
        workflowHash: judgeRequest.workflow.validation.canonicalSpecHash
      }
    });
  });

  it("returns stable errors for malformed JSON, invalid bodies, and stale evidence", async () => {
    const malformed = await POST(request("{not json", "judge-route-json"));
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({
      error: { code: "judge.invalid_json.v2" }
    });

    const invalid = await POST(
      request({ contractVersion: "2.0.0" }, "judge-route-invalid")
    );
    expect(invalid.status).toBe(400);
    const invalidJson = await invalid.json();
    expect(() =>
      workflowJudgeErrorResponseSchema.parse(invalidJson)
    ).not.toThrow();

    const stale = structuredClone(judgeRequest);
    stale.workflow.metadata.title = "Changed after validation";
    const staleResponse = await POST(request(stale, "judge-route-stale"));
    expect(staleResponse.status).toBe(409);
    expect(await staleResponse.json()).toMatchObject({
      error: { code: "judge.stale_hash.v2" }
    });
  });

  it("enforces fixed body and per-requester rate limits", async () => {
    const tooLarge = new Request("http://localhost/api/lab-composer/judge", {
      method: "POST",
      headers: {
        "content-length": String(WORKFLOW_JUDGE_LIMITS.requestBytes + 1),
        "x-forwarded-for": "judge-route-size"
      },
      body: "{}"
    });
    const response = await POST(tooLarge);
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      error: { code: "judge.request_too_large.v2" }
    });

    const key = `unit-rate-${Date.now()}`;
    const decisions = Array.from(
      { length: WORKFLOW_JUDGE_LIMITS.rateLimitRequests + 1 },
      () => checkWorkflowJudgeRateLimit(key, 1_000)
    );
    expect(decisions.at(-1)).toMatchObject({
      allowed: false,
      remaining: 0
    });
  });
});
