import { describe, expect, it } from "vitest";

import { coachGuidanceLabel } from "../../src/components/coach/CoachPanel";
import type { AuthoredCoachResponse } from "../../src/lib/agent/authoredCoachSchemas";

function response(
  kind: NonNullable<AuthoredCoachResponse["guidance"]>["kind"]
): AuthoredCoachResponse {
  return {
    ok: true,
    contractVersion: "2.0.0",
    shouldRespond: true,
    interventionType: kind === "safety" ? "warning" : "hint",
    skillIds: [],
    hintLevel: 1,
    message: "Grounded guidance.",
    evidenceEventTypes: [],
    guidance: {
      kind,
      title: "Guidance",
      objectiveIds: [],
      ruleIds: [],
      instructionIds: [],
      evidenceEventIds: [],
      recoveryActionIds: []
    },
    safety: { refused: false, reason: null },
    authority: {
      kind: "advisory",
      simulationStateChanged: false,
      canResetCheckpoint: false,
      canChangeWorkflowRules: false
    },
    metadata: {
      outputVersion: "2.0.0",
      coachVersion: "test",
      promptVersion: "test",
      model: "test",
      mode: "deterministic_fallback",
      fallbackReason: "deterministic_configured",
      definitionId: "workflow.test",
      definitionRevision: 1,
      definitionHash:
        "sha256:0000000000000000000000000000000000000000000000000000000000000000"
    }
  };
}

describe("Coach guidance presentation", () => {
  it("uses plain-language labels for all four authority categories", () => {
    expect(coachGuidanceLabel(response("mandatory_procedure"))).toBe(
      "Required procedure"
    );
    expect(coachGuidanceLabel(response("safety"))).toBe("Safety");
    expect(coachGuidanceLabel(response("optional_context"))).toBe(
      "Optional context"
    );
    expect(coachGuidanceLabel(response("ai_guidance"))).toBe("AI guidance");
  });
});
