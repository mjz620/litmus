import { describe, expect, it } from "vitest";

import { createAuthoredEvaluationRequest } from "../../src/lib/agent/authoredEvaluator";
import { evaluateAuthoredReport } from "../../src/lib/agent/authoredEvaluator";
import { validateDissolutionCalorimetryV2 } from "../../src/lab-workflows/definitions/calorimetry";
import { validatePrecipitationV2 } from "../../src/lab-workflows/definitions/precipitation";
import { validateNativeFullTitrationV2 } from "../../src/lab-workflows/definitions/titration/native-full-titration";
import { createSetupDrivenNativeSession } from "../../src/stores/setupDrivenLabSession";

const CHECKED_AT = "2026-07-19T12:00:00.000Z";

const REPORT = {
  procedureSummary: "Weighed the solid, added it to water, and recorded the temperature change.",
  dataAnalysis: "The temperature fell, so the dissolution absorbed energy.",
  conceptExplanation: "Breaking the lattice costs more energy than hydration releases.",
  sourcesOfError: "Heat leaked through the cup and the balance reads to 0.01 g."
};

function sessionFor(
  workflow: ReturnType<typeof validateDissolutionCalorimetryV2>,
  id: string
) {
  // Session ids and seeds are registry-shaped; spaces are rejected.
  const safeId = id.replace(/[^a-z0-9-]+/gi, "-");
  return createSetupDrivenNativeSession({
    sessionId: safeId,
    sessionSeed: `${safeId}-seed`,
    selection: {
      workflowId: workflow.id,
      workflowHash: workflow.validation.canonicalSpecHash
    },
    workflow
  });
}

/*
 * Report submission used to be wired only to titration — the route 404'd for
 * every other experiment — even though each workflow already carries a rubric
 * and the v2 evaluator grades against whatever definition it is handed.
 */
describe("every native lab can be reported on and graded", () => {
  const labs = [
    ["dissolution calorimetry", validateDissolutionCalorimetryV2],
    ["precipitation", validatePrecipitationV2],
    ["full titration", validateNativeFullTitrationV2]
  ] as const;

  it.each(labs)("%s carries gradable rubric criteria", (_name, validate) => {
    const workflow = validate(CHECKED_AT);
    expect(workflow.rubric.criteria.length).toBeGreaterThan(0);
    for (const criterion of workflow.rubric.criteria) {
      expect(criterion.maxPoints).toBeGreaterThan(0);
      expect(criterion.description.length).toBeGreaterThan(0);
    }
  });

  it.each(labs)(
    "%s builds a valid evaluation request from a live session",
    (name, validate) => {
      const workflow = validate(CHECKED_AT);
      const session = sessionFor(workflow, `report-${name}`);

      const request = createAuthoredEvaluationRequest({
        sessionId: `report-${name}`.replace(/[^a-z0-9-]+/gi, "-"),
        experimentId: workflow.id,
        assignedDefinition: workflow,
        runtimeState: session.getGenericState(),
        report: REPORT
      });

      expect(request.assignedDefinition.id).toBe(workflow.id);
      expect(request.report.procedureSummary.text).toBe(
        REPORT.procedureSummary
      );
    }
  );

  it.each(labs)("%s grades against its own rubric", async (name, validate) => {
    const workflow = validate(CHECKED_AT);
    const session = sessionFor(workflow, `grade-${name}`);

    const evaluation = await evaluateAuthoredReport(
      createAuthoredEvaluationRequest({
        sessionId: `grade-${name}`.replace(/[^a-z0-9-]+/gi, "-"),
        experimentId: workflow.id,
        assignedDefinition: workflow,
        runtimeState: session.getGenericState(),
        report: REPORT
      })
    );

    expect(evaluation.ok).toBe(true);
    if (!evaluation.ok) return;
    // Scored criteria must be exactly the workflow's own, not titration's.
    expect(evaluation.result.criteria.map(({ criterionId }) => criterionId).sort()).toEqual(
      workflow.rubric.criteria.map(({ id }) => id).sort()
    );
    expect(evaluation.result.possiblePoints).toBe(
      workflow.rubric.criteria.reduce(
        (total, criterion) => total + criterion.maxPoints,
        0
      )
    );
    expect(evaluation.metadata.rubricId).toBe(workflow.rubric.id);
  });
});
