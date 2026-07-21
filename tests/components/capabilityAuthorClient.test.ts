import { describe, expect, it, vi } from "vitest";

import { requestCapabilityAuthorProposal } from "../../src/components/teacher/lab-composer/capabilityAuthorClient";
import { POST } from "../../src/app/api/lab-composer/author/capability/route";

/*
 * These routes reach a paid model and now authenticate first. The guard is
 * stubbed here so each test still exercises the handler it is about; the
 * 401/403 behaviour itself is covered in tests/api/llmRouteGuard.test.ts.
 */
vi.mock("../../src/lib/persistence/labDefinitionApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/lib/persistence/labDefinitionApi")>()),
  authenticateComposerPrincipal: vi.fn(async () => ({
    userId: "00000000-0000-4000-8000-0000000000aa",
    role: "teacher" as const
  }))
}));


const requestBody = {
  contractVersion: "2.0.0" as const,
  teacherRequest:
    "Create a sodium chloride dilution using a volumetric pipette and flask.",
  gradeBand: "mixed_high_school" as const,
  targetMinutes: 12,
  deviceProfileId: "device.chromebook_core.v1"
};

describe("capability author Composer client", () => {
  it("accepts only the strict bounded capability-author response", async () => {
    let requestedPath = "";
    const progressStages: string[] = [];
    const proposal = await requestCapabilityAuthorProposal(
      requestBody,
      async (input, init) => {
        requestedPath = String(input);
        return POST(
          new Request("http://localhost/api/lab-composer/author/capability", {
            ...init,
            headers: {
              ...Object.fromEntries(new Headers(init?.headers).entries()),
              "x-forwarded-for": "composer-client-success-203.0.113.70"
            }
          })
        );
      },
      (progress) => progressStages.push(progress.stage)
    );

    expect(requestedPath).toBe("/api/lab-composer/author/capability");
    expect(proposal.result).toMatchObject({
      outcome: "runnable",
      validation: { runnable: true, previewEligible: true }
    });
    expect(proposal.result.traces).toHaveLength(5);
    expect(progressStages).toEqual([
      "understanding_request",
      "checking_available_parts",
      "building_draft",
      "checking_lab",
      "testing_student_paths",
      "finalizing"
    ]);
  });

  it("fails closed for malformed success data", async () => {
    await expect(
      requestCapabilityAuthorProposal(requestBody, async () =>
        Response.json({ ok: true }, { status: 200 })
      )
    ).rejects.toMatchObject({
      name: "CapabilityAuthorClientError",
      retryable: false
    });
  });

  it("fails closed for a malformed streamed progress event", async () => {
    await expect(
      requestCapabilityAuthorProposal(
        requestBody,
        async () =>
          new Response(
            `${JSON.stringify({ type: "progress", progress: { stage: "thinking", message: "Secret internals" } })}\n`,
            { headers: { "content-type": "application/x-ndjson" } }
          )
      )
    ).rejects.toMatchObject({
      name: "CapabilityAuthorClientError",
      retryable: true
    });
  });

  it("preserves safe retry guidance without exposing response internals", async () => {
    await expect(
      requestCapabilityAuthorProposal(requestBody, async () =>
        Response.json(
          {
            ok: false,
            metadata: {
              contractVersion: "2.0.0",
              promptVersion: "lab-author-capability-v2",
              toolContractVersion: "lab-author-capability-tools-v1"
            },
            error: {
              code: "authoring.rate_limited.v2",
              message: "Try again shortly.",
              retryable: true,
              fieldPaths: []
            }
          },
          { status: 429 }
        )
      )
    ).rejects.toMatchObject({
      message: "Try again shortly.",
      retryable: true,
      code: "authoring.rate_limited.v2"
    });
  });
});
