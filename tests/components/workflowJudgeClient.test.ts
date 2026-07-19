import { describe, expect, it } from "vitest";

import { validateSolutionPreparationV2 } from "../../src/lab-workflows/definitions/solution-preparation";
import { createWorkflowJudgeRequest } from "../../src/lib/agent/lab-workflow-judge/request";
import { judgeLabWorkflow } from "../../src/lib/agent/lab-workflow-judge/judge";
import { executeComposerJudgeTraces } from "../../src/components/teacher/lab-composer/composerJudgeCycle";
import {
  requestWorkflowJudgeReview,
  WorkflowJudgeClientError
} from "../../src/components/teacher/lab-composer/workflowJudgeClient";

const workflow = validateSolutionPreparationV2("2026-07-18T23:10:00.000Z");
const request = createWorkflowJudgeRequest({
  teacherRequest: "Create a solution preparation practice lab.",
  workflow,
  traces: executeComposerJudgeTraces(workflow, 1)
});

describe("Composer Workflow Judge client", () => {
  it("strictly parses a successful response", async () => {
    const serverResponse = await judgeLabWorkflow(request);
    const result = await requestWorkflowJudgeReview(
      request,
      async () => new Response(JSON.stringify(serverResponse), { status: 200 })
    );
    expect(result.authority).toBe("advisory_only");
  });

  it("surfaces structured errors and rejects malformed success bodies", async () => {
    await expect(
      requestWorkflowJudgeReview(
        request,
        async () =>
          new Response(
            JSON.stringify({
              ok: false,
              contractVersion: "2.0.0",
              error: {
                code: "judge.stale_hash.v2",
                message: "This review is out of date.",
                retryable: false,
                fieldPaths: ["workflow"]
              }
            }),
            { status: 409 }
          )
      )
    ).rejects.toMatchObject({
      name: "WorkflowJudgeClientError",
      code: "judge.stale_hash.v2"
    });

    await expect(
      requestWorkflowJudgeReview(
        request,
        async () => new Response(JSON.stringify({ ok: true }), { status: 200 })
      )
    ).rejects.toBeInstanceOf(WorkflowJudgeClientError);
  });

  it("aborts at its fixed client timeout without mutating anything", async () => {
    await expect(
      requestWorkflowJudgeReview(
        request,
        (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("aborted", "AbortError"));
            });
          }),
        5
      )
    ).rejects.toMatchObject({ retryable: true });
  });
});
