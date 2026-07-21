import { describe, expect, it, vi } from "vitest";

import { POST } from "../../src/app/api/coach/route";
import { createAuthoredCoachWorkflowContext } from "../../src/lib/agent/authoredCoach";
import { AUTHORED_COACH_CONTRACT_VERSION } from "../../src/lib/agent/authoredCoachSchemas";
import {
  SOLUTION_PREPARATION_V2_EXPECTED_HASH,
  validateSolutionPreparationV2
} from "../../src/lab-workflows/definitions/solution-preparation";
import { createSetupDrivenNativeSession } from "../../src/stores/setupDrivenLabSession";

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


function authoredBody() {
  const definition = validateSolutionPreparationV2("2026-07-18T15:00:00.000Z");
  const runtime = createSetupDrivenNativeSession({
    sessionId: "coach-route",
    sessionSeed: "coach-route-seed",
    selection: {
      workflowId: definition.id,
      workflowHash: SOLUTION_PREPARATION_V2_EXPECTED_HASH
    },
    workflow: definition
  });
  return {
    contractVersion: AUTHORED_COACH_CONTRACT_VERSION,
    sessionId: "coach-route",
    experimentId: "solution_preparation",
    workflowContext: createAuthoredCoachWorkflowContext(
      runtime.getWorkflow(),
      runtime.getGenericState()
    ),
    studentQuestion: "What should I do first?",
    triggerPolicy: {
      source: "question" as const,
      reasons: ["student_question"],
      maxHintLevel: 3 as const
    }
  };
}

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    })
  );
}

describe("POST /api/coach authored contract", () => {
  it("returns grounded advisory v2 guidance", async () => {
    const response = await post(authoredBody());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      contractVersion: "2.0.0",
      shouldRespond: true,
      guidance: { kind: "ai_guidance" },
      authority: {
        kind: "advisory",
        simulationStateChanged: false,
        canResetCheckpoint: false,
        canChangeWorkflowRules: false
      },
      metadata: {
        definitionHash: SOLUTION_PREPARATION_V2_EXPECTED_HASH,
        mode: "deterministic_fallback"
      }
    });
  });

  it("rejects stale exact-hash context", async () => {
    const body = structuredClone(authoredBody());
    body.workflowContext.definition.metadata.title = "Changed after validation";

    const response = await post(body);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: { code: "coach.stale_definition.v2" }
    });
  });

  it("keeps malformed authored and legacy requests on separate adapters", async () => {
    const malformed = await post({
      contractVersion: AUTHORED_COACH_CONTRACT_VERSION,
      sessionId: "missing-context"
    });
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toMatchObject({
      error: { code: "coach.invalid_request.v2" }
    });

    const legacy = await post({
      sessionId: "legacy-coach",
      experimentId: "acid_base_titration",
      currentState: {},
      recentEvents: [],
      studentModel: {
        sessionId: "legacy-coach",
        experimentId: "acid_base_titration",
        skills: {},
        activeFlags: []
      },
      studentQuestion: "What should I observe?",
      triggerPolicy: { source: "question", maxHintLevel: 3 }
    });
    expect(legacy.status).toBe(200);
    await expect(legacy.json()).resolves.toMatchObject({
      shouldRespond: true,
      interventionType: "hint"
    });
  });
});
