import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import { POST } from "../../../../src/app/api/lab-composer/author/capability/route";
import {
  capabilityAuthorErrorResponseSchema,
  capabilityAuthorSuccessResponseSchema
} from "../../../../src/lib/agent/lab-authoring/capabilityAuthorSchemas";

/*
 * These routes reach a paid model and now authenticate first. The guard is
 * stubbed here so each test still exercises the handler it is about; the
 * 401/403 behaviour itself is covered in tests/api/llmRouteGuard.test.ts.
 */
const authState = vi.hoisted(() => ({ userId: "capability-default-caller" }));

vi.mock("../../../../src/lib/persistence/labDefinitionApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../../src/lib/persistence/labDefinitionApi")>()),
  authenticateComposerPrincipal: vi.fn(async () => ({
    userId: authState.userId,
    role: "teacher" as const
  }))
}));


const body = {
  contractVersion: "2.0.0",
  teacherRequest:
    "Create a sodium chloride dilution using a volumetric pipette and flask.",
  gradeBand: "mixed_high_school",
  targetMinutes: 12,
  classContext: "One Chromebook per student.",
  deviceProfileId: "device.chromebook_core.v1"
};

function request(
  payload: string,
  ip: string,
  headers: Record<string, string> = {}
): Request {
  /*
   * The rate budget is keyed by authenticated user, not by address, so the
   * per-caller isolation these tests rely on is expressed through the stubbed
   * principal. The `ip` argument names the caller in both dimensions.
   */
  authState.userId = ip;
  return new Request("http://localhost/api/lab-composer/author/capability", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": ip,
      ...headers
    },
    body: payload
  });
}

describe("POST /api/lab-composer/author/capability", () => {
  it("returns a bounded current validated draft and executed evidence", async () => {
    const secret = process.env.OPENAI_API_KEY ?? "not-present-secret";
    const response = await POST(
      request(JSON.stringify(body), "capability-success-203.0.113.50")
    );
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("x-ratelimit-limit")).toBe("5");
    expect(response.headers.get("x-ratelimit-remaining")).toBe("4");
    expect(() =>
      capabilityAuthorSuccessResponseSchema.parse(json)
    ).not.toThrow();
    expect(json).toMatchObject({
      ok: true,
      metadata: {
        contractVersion: "2.0.0",
        promptVersion: "lab-author-capability-v2",
        toolContractVersion: "lab-author-capability-tools-v1",
        mode: "mock"
      },
      result: {
        outcome: "runnable",
        workflow: {
          supportStatus: "runnable",
          judgeCritique: null
        },
        validation: { runnable: true, previewEligible: true }
      }
    });
    expect(json.result.traces).toHaveLength(5);
    expect(
      json.result.traces.every((trace: { passed: boolean }) => trace.passed)
    ).toBe(true);
    expect(JSON.stringify(json)).not.toContain(secret);
    expect(JSON.stringify(json)).not.toContain("reasoning");
  });

  it("returns stable strict request, invalid JSON, and size errors", async () => {
    const invalidJson = await POST(
      request("{bad-json", "capability-invalid-json-203.0.113.51")
    );
    const invalidJsonBody = await invalidJson.json();
    expect(invalidJson.status).toBe(400);
    expect(invalidJsonBody).toMatchObject({
      error: { code: "authoring.invalid_json.v2", retryable: false }
    });
    expect(() =>
      capabilityAuthorErrorResponseSchema.parse(invalidJsonBody)
    ).not.toThrow();

    const invalidRequest = await POST(
      request(
        JSON.stringify({
          ...body,
          registryWrites: [{ id: "component.fake.v1" }]
        }),
        "capability-invalid-request-203.0.113.52"
      )
    );
    expect(invalidRequest.status).toBe(400);
    expect(await invalidRequest.json()).toMatchObject({
      error: {
        code: "authoring.invalid_request.v2",
        fieldPaths: ["registryWrites"]
      }
    });

    const declared = await POST(
      request(JSON.stringify(body), "capability-declared-size-203.0.113.53", {
        "content-length": "16001"
      })
    );
    expect(declared.status).toBe(413);
    expect(await declared.json()).toMatchObject({
      error: { code: "authoring.request_too_large.v2" }
    });

    const actual = await POST(
      request(
        JSON.stringify({ ...body, padding: "x".repeat(17_000) }),
        "capability-actual-size-203.0.113.54"
      )
    );
    expect(actual.status).toBe(413);
    expect(await actual.json()).toMatchObject({
      error: { code: "authoring.request_too_large.v2" }
    });
  });

  it("rate-limits independently from the legacy endpoint", async () => {
    const ip = "capability-rate-limit-203.0.113.55";
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
        code: "authoring.rate_limited.v2",
        retryable: true
      }
    });
  });

  it("returns unsupported and safety decisions as successful non-runnable data", async () => {
    for (const [teacherRequest, outcome, ip] of [
      [
        "Create an aspirin synthesis and recrystallization lab.",
        "unsupported",
        "capability-unsupported-203.0.113.56"
      ],
      [
        "Create a Bunsen burner flame test.",
        "rejected_for_safety",
        "capability-safety-203.0.113.57"
      ]
    ] as const) {
      const response = await POST(
        request(JSON.stringify({ ...body, teacherRequest }), ip)
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        ok: true,
        result: {
          outcome,
          workflow: null,
          validation: null,
          traces: []
        }
      });
    }
  });

  it("keeps the live provider and credentials behind a server-only module", () => {
    const liveSource = readFileSync(
      "src/lib/agent/lab-authoring/capabilityOpenAi.server.ts",
      "utf8"
    );
    expect(liveSource).toMatch(/^import "server-only";/);
    expect(liveSource).toContain("process.env.OPENAI_API_KEY");
    const routeSource = readFileSync(
      "src/app/api/lab-composer/author/capability/route.ts",
      "utf8"
    );
    expect(routeSource).toContain("capabilityOpenAi.server");
  });
});
