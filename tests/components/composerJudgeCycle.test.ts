import { describe, expect, it } from "vitest";

import type { LabDraftCommand } from "../../src/lab-workflows/authoring";
import { SOLUTION_PREPARATION_V2_DRAFT } from "../../src/lab-workflows/definitions/solution-preparation";
import { validateNativeTitrationV2 } from "../../src/lab-workflows/definitions/titration/native-endpoint-control";
import {
  labWorkflowDraftV2Schema,
  type LabWorkflowDraftV2,
  type ValidatedLabWorkflowSpecV2
} from "../../src/lab-workflows/schema/v2";
import { validateLabWorkflowSpecV2 } from "../../src/lab-workflows/validation";
import { judgeLabWorkflow } from "../../src/lib/agent/lab-workflow-judge/judge";
import {
  applyComposerJudgeSuggestion,
  COMPOSER_JUDGE_CALL_LIMIT,
  COMPOSER_JUDGE_REVISION_LIMIT,
  createComposerJudgeSuggestions,
  executeComposerJudgeTraces,
  reviewComposerWorkflow,
  type ComposerJudgeSuggestion
} from "../../src/components/teacher/lab-composer/composerJudgeCycle";
import type { WorkflowJudgeFetch } from "../../src/components/teacher/lab-composer/workflowJudgeClient";

const CHECKED_AT = "2026-07-18T23:00:00.000Z";
const TEACHER_REQUEST = "Create a flexible dilution practice lab.";

const judgeFetch: WorkflowJudgeFetch = async (_input, init) => {
  const request = JSON.parse(String(init?.body)) as unknown;
  const response = await judgeLabWorkflow(request, {
    judgedAt: "2026-07-18T23:01:00.000Z"
  });
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
};

function validate(
  draft: Readonly<LabWorkflowDraftV2>
): ValidatedLabWorkflowSpecV2 {
  const result = validateLabWorkflowSpecV2(draft, { checkedAt: CHECKED_AT });
  if (!result.schemaValid || !result.validation.runnable)
    throw new Error("Expected runnable Composer Judge fixture");
  return structuredClone(result.spec);
}

function editableDraft(): LabWorkflowDraftV2 {
  return labWorkflowDraftV2Schema.parse(
    structuredClone(SOLUTION_PREPARATION_V2_DRAFT)
  );
}

function suggestion(
  id: string,
  commands: readonly LabDraftCommand[]
): ComposerJudgeSuggestion {
  return {
    id,
    issueId: id,
    label: "Test suggestion",
    explanation: "A bounded shared-command test suggestion.",
    commands
  };
}

describe("LC2-702 bounded Judge revision cycle", () => {
  it("approves on the first pass after current validation and five fresh traces", async () => {
    const workflow = validate(editableDraft());
    const result = await reviewComposerWorkflow({
      teacherRequest: TEACHER_REQUEST,
      workflow,
      attempt: 1,
      fetcher: judgeFetch
    });
    expect(result.traces).toHaveLength(5);
    expect(result.traces.every(({ passed }) => passed)).toBe(true);
    expect(result.review).toMatchObject({
      authority: "advisory_only",
      critique: { recommendation: "approve" }
    });
    expect(workflow.validation.previewEligible).toBe(true);
  });

  it("repairs an unfair rubric only through shared commands, revalidation, retrace, and rejudge", async () => {
    const draft = editableDraft();
    draft.rubric.criteria[0]!.maxPoints = 9;
    draft.rubric.criteria[1]!.maxPoints = 1;
    const workflow = validate(draft);
    const first = await reviewComposerWorkflow({
      teacherRequest: TEACHER_REQUEST,
      workflow,
      attempt: 1,
      fetcher: judgeFetch
    });
    expect(first.review.critique.recommendation).toBe("revise");
    const suggestions = createComposerJudgeSuggestions(
      draft,
      first.review,
      first.traces
    );
    const rubricSuggestion = suggestions.find(({ issueId }) =>
      issueId.includes("rubric")
    );
    expect(
      rubricSuggestion?.commands.every(
        ({ type }) => type === "replace_rubric_criterion"
      )
    ).toBe(true);
    if (!rubricSuggestion) throw new Error("Expected rubric suggestion");

    const repaired = await applyComposerJudgeSuggestion({
      draft,
      suggestion: rubricSuggestion,
      teacherRequest: TEACHER_REQUEST,
      attempt: 2,
      checkedAt: CHECKED_AT,
      fetcher: judgeFetch
    });
    expect(repaired.ok).toBe(true);
    if (!repaired.ok) throw new Error(repaired.message);
    expect(repaired.draft.revision).toBe(draft.revision + 1);
    expect(
      repaired.draft.rubric.criteria.map(({ maxPoints }) => maxPoints)
    ).toEqual([5, 5]);
    expect(repaired.traces).toHaveLength(5);
    expect(repaired.review.critique.recommendation).toBe("approve");
    expect(repaired.validation.validation.previewEligible).toBe(true);
  });

  it("rejects a command revision that fails hard validation without changing the source draft", async () => {
    const draft = editableDraft();
    const successRule = draft.rules.find(({ kind }) => kind === "success");
    if (!successRule) throw new Error("Missing success rule fixture");
    const before = structuredClone(draft);
    const result = await applyComposerJudgeSuggestion({
      draft,
      suggestion: suggestion("invalid-success", [
        {
          type: "replace_rule",
          ruleId: successRule.id,
          rule: { ...successRule, kind: "required" }
        }
      ]),
      teacherRequest: TEACHER_REQUEST,
      attempt: 2,
      fetcher: judgeFetch
    });
    expect(result).toMatchObject({ ok: false, stage: "validation" });
    expect(draft).toEqual(before);
  });

  it("rejects a validator-passing revision when a required real trace no longer demonstrates its case", async () => {
    const draft = editableDraft();
    const terminalRule = draft.rules.find(({ terminal }) => terminal);
    if (!terminalRule) throw new Error("Missing terminal rule fixture");
    const result = await applyComposerJudgeSuggestion({
      draft,
      suggestion: suggestion("break-terminal-trace", [
        {
          type: "replace_rule",
          ruleId: terminalRule.id,
          rule: { ...terminalRule, terminal: false }
        }
      ]),
      teacherRequest: TEACHER_REQUEST,
      attempt: 2,
      fetcher: judgeFetch
    });
    expect(result).toMatchObject({ ok: false, stage: "trace" });
  });

  it("stops early when the current workflow lacks the required native trace suite", () => {
    const compatibility = validateNativeTitrationV2(CHECKED_AT);
    expect(() => executeComposerJudgeTraces(compatibility, 1)).toThrow(
      /legacy engine/i
    );
  });

  it("exposes fixed call/revision budgets and never grants Preview authority", async () => {
    expect(COMPOSER_JUDGE_CALL_LIMIT).toBe(3);
    expect(COMPOSER_JUDGE_REVISION_LIMIT).toBe(2);
    const workflow = validate(editableDraft());
    const { review } = await reviewComposerWorkflow({
      teacherRequest: TEACHER_REQUEST,
      workflow,
      attempt: COMPOSER_JUDGE_CALL_LIMIT,
      fetcher: judgeFetch
    });
    expect(review.authority).toBe("advisory_only");
    expect(review).not.toHaveProperty("previewEligible");
    expect(review).not.toHaveProperty("workflow");
  });
});
