import { describe, expect, it } from "vitest";

import {
  executeComposerJudgeTraces,
  teachingReviewUnsupportedReason
} from "../../src/components/teacher/lab-composer/composerJudgeCycle";
import { validateCalorimetryV2 } from "../../src/lab-workflows/definitions/calorimetry";
import { validatePrecipitationV2 } from "../../src/lab-workflows/definitions/precipitation";
import { validateSolutionPreparationV2 } from "../../src/lab-workflows/definitions/solution-preparation";
import { validateNativeEndpointDrillV2 } from "../../src/lab-workflows/definitions/titration/native-endpoint-drill";

const CHECKED_AT = "2026-01-01T00:00:00.000Z";

/*
 * The authoring agent discovers registry entries itself, so it can propose a
 * lab from any supported capability — not only the solution preparation the
 * deterministic fallback covers. The teaching review therefore has to find
 * scenarios for each of those capabilities; replaying a lab against another
 * capability's scenarios, or declining a lab that has its own, are both ways
 * the judge would stop describing the draft in front of it.
 */
describe("composer judge trace plans", () => {
  const labs = [
    { name: "calorimetry", workflow: validateCalorimetryV2(CHECKED_AT) },
    { name: "precipitation", workflow: validatePrecipitationV2(CHECKED_AT) },
    {
      name: "solution preparation",
      workflow: validateSolutionPreparationV2(CHECKED_AT)
    },
    {
      name: "titration endpoint drill",
      workflow: validateNativeEndpointDrillV2(CHECKED_AT)
    }
  ] as const;

  for (const { name, workflow } of labs) {
    it(`replays scenarios for ${name}`, () => {
      expect(teachingReviewUnsupportedReason(workflow)).toBeNull();
      const traces = executeComposerJudgeTraces(workflow, 1);
      expect(traces.length).toBeGreaterThan(0);
      expect(traces.every(({ passed }) => passed)).toBe(true);
    });
  }

  it("declines a lab whose permissions match no scenario set", () => {
    const workflow = validateNativeEndpointDrillV2(CHECKED_AT);
    const stripped = {
      ...workflow,
      permittedActions: workflow.permittedActions.filter(
        ({ id }) => id !== "migration.permission.s2.a1"
      )
    } as typeof workflow;
    expect(teachingReviewUnsupportedReason(stripped)).toMatch(
      /do not match a set of teaching-review scenarios/i
    );
    expect(() => executeComposerJudgeTraces(stripped, 1)).toThrow();
  });
});
