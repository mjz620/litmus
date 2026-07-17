import { describe, expect, it } from "vitest";

import { POST } from "../../src/app/api/evaluate/route";

const validBody = {
  sessionId: "session-1",
  experimentId: "acid_base_titration",
  finalState: {},
  events: [
    {
      type: "add_titrant",
      tSim: 1,
      observation: {},
      flags: ["endpoint_overshoot"],
      evidence: [
        {
          skillId: "endpoint_control",
          delta: -0.9,
          reason: "endpoint_overshoot"
        }
      ]
    }
  ],
  studentModel: {
    sessionId: "session-1",
    experimentId: "acid_base_titration",
    skills: {},
    activeFlags: ["endpoint_overshoot"]
  },
  studentText: {
    procedureSummary: "I completed each preparation and titration step.",
    dataAnalysis: "I compared the recorded volume with the observed endpoint.",
    conceptExplanation:
      "The endpoint is the visible indicator response near equivalence.",
    sourcesOfError: "Parallax and adding too quickly can affect the result."
  }
};

describe("POST /api/evaluate", () => {
  it("rejects invalid payloads", async () => {
    expect(
      (
        await POST(
          new Request("http://localhost/api/evaluate", {
            method: "POST",
            body: "{}"
          })
        )
      ).status
    ).toBe(400);
  });
  it("returns four evidence-linked rubric dimensions", async () => {
    const response = await POST(
      new Request("http://localhost/api/evaluate", {
        method: "POST",
        body: JSON.stringify(validBody)
      })
    );
    const result = await response.json();
    expect(response.status).toBe(200);
    expect([
      result.concept_understanding,
      result.procedure,
      result.data_analysis,
      result.sig_figs
    ]).toHaveLength(4);
    expect(result.procedure.evidenceEventTypes).toContain("add_titrant");
    expect(result.recommended_retry.skillId).toBe("endpoint_control");
  });
});
