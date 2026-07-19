import { describe, expect, it } from "vitest";

import { requestCapabilityAuthorProposal } from "../../src/components/teacher/lab-composer/capabilityAuthorClient";
import { POST } from "../../src/app/api/lab-composer/author/capability/route";

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
              promptVersion: "lab-author-capability-v1",
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
