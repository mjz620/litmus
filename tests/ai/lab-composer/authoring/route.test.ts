import { describe, expect, it } from "vitest";

import { POST } from "../../../../src/app/api/lab-composer/author/route";
import {
  createLabAuthoringErrorResponse,
  unavailableLabAuthoringError
} from "../../../../src/lib/agent/lab-authoring/errors";
import {
  labAuthoringErrorResponseSchema,
  labAuthoringSuccessResponseSchema
} from "../../../../src/lib/agent/lab-authoring/schemas";

const body = {
  teacherRequest:
    "Create a 7-minute acid-base titration pre-lab focused on endpoint control and meniscus reading.",
  gradeBand: "mixed_high_school",
  targetMinutes: 7,
  classContext: "One Chromebook per student.",
  deviceProfileId: "device.chromebook_core.v1"
};

function request(
  payload: string,
  ip: string,
  headers: Record<string, string> = {}
): Request {
  return new Request("http://localhost/api/lab-composer/author", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
      ...headers
    },
    body: payload
  });
}

describe("POST /api/lab-composer/author", () => {
  it("uses a deterministic fallback error without provider details", () => {
    const first = createLabAuthoringErrorResponse(
      unavailableLabAuthoringError()
    );
    const second = createLabAuthoringErrorResponse(
      unavailableLabAuthoringError()
    );
    expect(second).toEqual(first);
    expect(first).toEqual({
      ok: false,
      metadata: {
        promptVersion: "lab-author-v1",
        toolContractVersion: "lab-author-tools-v1"
      },
      error: {
        code: "authoring.model_unavailable.v1",
        message: "Lab authoring is temporarily unavailable.",
        retryable: true,
        fieldPaths: []
      }
    });
  });

  it("returns the bounded structured mock without exposing server secrets", async () => {
    const secret = process.env.OPENAI_API_KEY ?? "not-present-secret";
    const response = await POST(
      request(JSON.stringify(body), "authoring-success-203.0.113.10")
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("x-ratelimit-limit")).toBe("5");
    expect(response.headers.get("x-ratelimit-remaining")).toBe("4");
    expect(() => labAuthoringSuccessResponseSchema.parse(json)).not.toThrow();
    expect(json).toMatchObject({
      ok: true,
      metadata: { mode: "mock" },
      result: {
        claimedSupport: "candidate_runnable",
        proposedWorkflow: {
          supportStatus: "draft_unvalidated",
          validation: null
        }
      }
    });
    expect(JSON.stringify(json)).not.toContain(secret);
  });

  it("returns stable invalid-JSON and strict-request errors", async () => {
    const invalidJson = await POST(
      request("{not-json", "authoring-invalid-json-203.0.113.11")
    );
    const invalidJsonBody = await invalidJson.json();
    expect(invalidJson.status).toBe(400);
    expect(invalidJsonBody).toMatchObject({
      ok: false,
      error: {
        code: "authoring.invalid_json.v1",
        retryable: false,
        fieldPaths: []
      }
    });
    expect(() =>
      labAuthoringErrorResponseSchema.parse(invalidJsonBody)
    ).not.toThrow();

    const invalidRequest = await POST(
      request(
        JSON.stringify({
          ...body,
          registryToolResults: ["component.fake.v1"]
        }),
        "authoring-invalid-schema-203.0.113.12"
      )
    );
    expect(invalidRequest.status).toBe(400);
    expect(await invalidRequest.json()).toMatchObject({
      error: {
        code: "authoring.invalid_request.v1",
        fieldPaths: ["registryToolResults"]
      }
    });
  });

  it("rejects declared and actual oversized bodies before authoring", async () => {
    const declared = await POST(
      request(JSON.stringify(body), "authoring-declared-size-203.0.113.13", {
        "content-length": "12001"
      })
    );
    expect(declared.status).toBe(413);
    expect(await declared.json()).toMatchObject({
      error: { code: "authoring.request_too_large.v1" }
    });

    const actual = await POST(
      request(
        JSON.stringify({ ...body, padding: "x".repeat(12_100) }),
        "authoring-actual-size-203.0.113.14"
      )
    );
    expect(actual.status).toBe(413);
    expect(await actual.json()).toMatchObject({
      error: { code: "authoring.request_too_large.v1" }
    });
  });

  it("rate-limits repeated requests with a deterministic retry shape", async () => {
    const ip = "authoring-rate-limit-203.0.113.15";
    for (let index = 0; index < 5; index += 1) {
      const response = await POST(request(JSON.stringify(body), ip));
      expect(response.status).toBe(200);
    }
    const limited = await POST(request(JSON.stringify(body), ip));
    const json = await limited.json();
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(json).toMatchObject({
      ok: false,
      error: {
        code: "authoring.rate_limited.v1",
        retryable: true,
        fieldPaths: []
      }
    });
    expect(() => labAuthoringErrorResponseSchema.parse(json)).not.toThrow();
  });

  it("returns unsupported results as successful non-runnable authoring data", async () => {
    const response = await POST(
      request(
        JSON.stringify({
          ...body,
          teacherRequest:
            "Create a lab where students synthesize aspirin and calculate percent yield."
        }),
        "authoring-unsupported-203.0.113.16"
      )
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      result: {
        claimedSupport: "unsupported",
        proposedWorkflow: null,
        requestSummary: {
          ambiguities: [expect.stringContaining("organic synthesis")]
        },
        missingCapabilityIds: []
      }
    });
  });
});
