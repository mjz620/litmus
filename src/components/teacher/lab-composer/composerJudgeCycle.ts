import {
  applyLabDraftTransaction,
  type LabDraftCommand
} from "../../../lab-workflows/authoring";
import { createCalorimetryTracePlan } from "../../../lab-workflows/definitions/calorimetry/tracePlan";
import { createPrecipitationTracePlan } from "../../../lab-workflows/definitions/precipitation/tracePlan";
import { createSolutionPreparationTracePlan } from "../../../lab-workflows/definitions/solution-preparation/tracePlan";
import { createEndpointDrillTracePlan } from "../../../lab-workflows/definitions/titration/endpointDrillTracePlan";
import {
  createGenericLabActionTrace,
  runGenericTraceSuite,
  type GenericTraceSuiteCaseKind
} from "../../../lab-workflows/replay";
import type { NormalizedLabAction } from "../../../lab-workflows/runtime";
import { createCapabilityGenericRuntimePorts } from "../../../lab-workflows/runtime";
import type {
  LabWorkflowDraftV2,
  ValidatedLabWorkflowSpecV2
} from "../../../lab-workflows/schema/v2";
import {
  validateLabWorkflowSpecV2,
  type SchemaValidLabWorkflowV2Validation
} from "../../../lab-workflows/validation";
import type { CapabilityAuthorTraceSummary } from "../../../lib/agent/lab-authoring/capabilityAuthorSchemas";
import { createWorkflowJudgeRequest } from "../../../lib/agent/lab-workflow-judge/request";
import type {
  WorkflowJudgeIssue,
  WorkflowJudgeResponse
} from "../../../lib/agent/lab-workflow-judge/schemas";
import {
  requestWorkflowJudgeReview,
  type WorkflowJudgeFetch
} from "./workflowJudgeClient";

export const COMPOSER_JUDGE_CALL_LIMIT = 3;
export const COMPOSER_JUDGE_REVISION_LIMIT = 2;

export interface ComposerJudgeSuggestion {
  readonly id: string;
  readonly issueId: string;
  readonly label: string;
  readonly explanation: string;
  readonly commands: readonly LabDraftCommand[];
}

export type ComposerJudgeCycleResult =
  | Readonly<{
      ok: true;
      draft: Readonly<LabWorkflowDraftV2>;
      validation: Readonly<SchemaValidLabWorkflowV2Validation>;
      traces: readonly CapabilityAuthorTraceSummary[];
      review: WorkflowJudgeResponse;
    }>
  | Readonly<{
      ok: false;
      stage: "command" | "validation" | "trace" | "judge";
      message: string;
    }>;

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

interface ComposerJudgeTraceCase {
  readonly kind: GenericTraceSuiteCaseKind;
  readonly actions: readonly NormalizedLabAction[];
}

/*
 * Scenario sets are authored per capability shape, not per draft, and every
 * action in one names a specific permission. A teacher who removes or renames
 * a permission has a legal lab that these scenarios can no longer drive, so
 * the plan only applies while every permission it references still exists.
 */
const COMPOSER_JUDGE_TRACE_PLANS: readonly {
  readonly requiredPermissionIds: readonly string[];
  readonly create: () => readonly ComposerJudgeTraceCase[];
}[] = [
  {
    requiredPermissionIds: [
      "migration.permission.s1.a1",
      "migration.permission.s2.a1"
    ],
    create: createEndpointDrillTracePlan
  },
  {
    requiredPermissionIds: [
      "permission.condition_pipette",
      "permission.aspirate_stock",
      "permission.deliver_aliquot",
      "permission.fill_to_mark",
      "permission.mix_solution"
    ],
    create: createSolutionPreparationTracePlan
  },
  {
    requiredPermissionIds: [
      "permission.pour_hot",
      "permission.pour_cold",
      "permission.place_probe",
      "permission.mix_calorimeter",
      "permission.read_temperature"
    ],
    create: createCalorimetryTracePlan
  },
  {
    /*
     * Four cases, not five: the precipitation capability has no authored rule
     * a run can violate and recover from, nor one that ends an attempt, so
     * those two kinds have nothing to demonstrate here. The judge reviews the
     * scenarios that exist rather than being denied all of them.
     */
    requiredPermissionIds: [
      "permission.tare_balance",
      "permission.pour_silver",
      "permission.pour_chloride",
      "permission.collect_precipitate",
      "permission.read_mass"
    ],
    create: createPrecipitationTracePlan
  }
];

function composerJudgeTracePlan(
  workflow: Readonly<ValidatedLabWorkflowSpecV2>
): readonly ComposerJudgeTraceCase[] | null {
  if (workflow.compatibility) return null;
  const available = new Set(workflow.permittedActions.map(({ id }) => id));
  const plan = COMPOSER_JUDGE_TRACE_PLANS.find(({ requiredPermissionIds }) =>
    requiredPermissionIds.every((id) => available.has(id))
  );
  return plan ? plan.create() : null;
}

/**
 * The teaching review replays a capability's authored trace scenarios through
 * the real runtime. A compatibility-bound draft cannot run them at all, and a
 * lab whose permissions no scenario set covers has nothing to replay. Exposed
 * so the composer can say so up front instead of spending one of the bounded
 * review calls on a run that stops immediately.
 */
export function teachingReviewUnsupportedReason(
  workflow: Readonly<ValidatedLabWorkflowSpecV2>
): string | null {
  if (workflow.compatibility) {
    return "This lab still runs on the legacy engine, which the teaching review cannot replay.";
  }
  return composerJudgeTracePlan(workflow)
    ? null
    : "This lab's steps do not match a set of teaching-review scenarios yet. The Litmus checker still covers it.";
}

export function executeComposerJudgeTraces(
  workflow: Readonly<ValidatedLabWorkflowSpecV2>,
  attempt: number
): readonly CapabilityAuthorTraceSummary[] {
  const plan = composerJudgeTracePlan(workflow);
  if (!plan) {
    throw new TypeError(teachingReviewUnsupportedReason(workflow) ?? "");
  }
  return plan.map((testCase) => {
    const traceId = `trace.agent.${workflow.validation.canonicalSpecHash.slice(-12)}.${testCase.kind}.${attempt}`;
    const trace = createGenericLabActionTrace({
      traceId,
      sessionId: `composer-judge-${workflow.revision}-${testCase.kind}-${attempt}`,
      sessionSeed: `composer-judge-${workflow.id}-${testCase.kind}`,
      workflow,
      actions: testCase.actions
    });
    const result = runGenericTraceSuite(
      [{ kind: testCase.kind, trace }],
      () => ({
        workflow,
        ports: createCapabilityGenericRuntimePorts(workflow)
      })
    )[0]!;
    const diagnosisMap = new Map(
      result.states
        .flatMap(({ diagnoses }) => diagnoses)
        .map((diagnosis) => [
          `${diagnosis.ruleId}|${diagnosis.status}|${diagnosis.recoverable}`,
          diagnosis
        ])
    );
    return {
      kind: testCase.kind,
      traceId,
      passed: true,
      actionCount: testCase.actions.length,
      workflowStatus: result.finalState.workflowStatus,
      eventIds: uniqueSorted(
        result.finalState.eventEnvelopes.map(({ eventId }) => eventId)
      ),
      evidenceEventIds: uniqueSorted(
        result.finalState.eventEnvelopes
          .filter(({ ruleEvidenceIds }) => ruleEvidenceIds.length > 0)
          .map(({ eventId }) => eventId)
      ),
      diagnoses: [...diagnosisMap.values()]
        .sort((left, right) => left.ruleId.localeCompare(right.ruleId))
        .map(({ ruleId, status, severity, recoverable, evidenceEventIds }) => ({
          ruleId,
          status,
          severity,
          recoverable,
          evidenceEventIds: uniqueSorted(evidenceEventIds)
        })),
      observables: result.finalState.chemistry.observables.map(
        ({ observableId, value, unitId }) => ({
          observableId,
          value,
          unitId: unitId ?? null
        })
      ),
      error: null
    };
  });
}

function balancedRubricCommands(
  draft: Readonly<LabWorkflowDraftV2>
): readonly LabDraftCommand[] {
  if (draft.rubric.criteria.length === 0) return [];
  const base = Number(
    (draft.rubric.totalPoints / draft.rubric.criteria.length).toFixed(6)
  );
  let assigned = 0;
  return draft.rubric.criteria.map((criterion, index) => {
    const maxPoints =
      index === draft.rubric.criteria.length - 1
        ? Number((draft.rubric.totalPoints - assigned).toFixed(6))
        : base;
    assigned += maxPoints;
    return {
      type: "replace_rubric_criterion" as const,
      criterionId: criterion.id,
      criterion: { ...criterion, maxPoints }
    };
  });
}

function removableOrderingRule(draft: Readonly<LabWorkflowDraftV2>) {
  const referenced = new Set([
    ...draft.instructions.flatMap(({ relatedRuleIds }) => relatedRuleIds),
    ...draft.rubric.criteria.flatMap(({ ruleIds }) => ruleIds),
    ...draft.permittedActions.flatMap(({ availability }) => [
      ...availability.allSatisfiedRuleIds,
      ...availability.allUnsatisfiedRuleIds
    ]),
    ...draft.presentation.rulePrompts.map(({ ruleId }) => ruleId)
  ]);
  return [...draft.rules]
    .reverse()
    .find(({ id, kind }) => kind === "ordering" && !referenced.has(id));
}

function suggestionForIssue(
  draft: Readonly<LabWorkflowDraftV2>,
  issue: Readonly<WorkflowJudgeIssue>,
  validActionCount: number
): ComposerJudgeSuggestion | null {
  switch (issue.dimension) {
    case "duration_feasibility": {
      const estimatedMinutes = Math.max(
        draft.metadata.estimatedMinutes,
        5,
        Math.ceil(validActionCount * 1.5)
      );
      if (estimatedMinutes === draft.metadata.estimatedMinutes) return null;
      return {
        id: `suggestion.${issue.id}`,
        issueId: issue.id,
        label: `Allow about ${estimatedMinutes} minutes`,
        explanation:
          "Updates the teacher-facing time estimate; it does not change the simulation.",
        commands: [
          {
            type: "update_metadata",
            metadata: { ...draft.metadata, estimatedMinutes }
          }
        ]
      };
    }
    case "rubric_fairness": {
      const commands = balancedRubricCommands(draft);
      if (commands.length === 0) return null;
      return {
        id: `suggestion.${issue.id}`,
        issueId: issue.id,
        label: "Balance rubric points across the objectives",
        explanation:
          "Keeps the same criteria and evidence while distributing the existing total more evenly.",
        commands
      };
    }
    case "failure_cases": {
      const rule = draft.rules.find(
        ({ terminal, severity }) => terminal && severity === "best-practice"
      );
      if (!rule) return null;
      return {
        id: `suggestion.${issue.id}`,
        issueId: issue.id,
        label: "Treat the stopping mistake as a procedure problem",
        explanation:
          "Keeps the same registered condition and changes only how its teaching role is described.",
        commands: [
          {
            type: "replace_rule",
            ruleId: rule.id,
            rule: { ...rule, severity: "procedural" }
          }
        ]
      };
    }
    case "flexibility": {
      const rule = removableOrderingRule(draft);
      if (!rule) return null;
      return {
        id: `suggestion.${issue.id}`,
        issueId: issue.id,
        label: "Remove one unnecessary order requirement",
        explanation:
          "Leaves the activity cards in place and removes one unreferenced prerequisite edge.",
        commands: [{ type: "remove_ordering_dependency", ruleId: rule.id }]
      };
    }
    default:
      return null;
  }
}

export function createComposerJudgeSuggestions(
  draft: Readonly<LabWorkflowDraftV2>,
  review: Readonly<WorkflowJudgeResponse>,
  traces: readonly CapabilityAuthorTraceSummary[]
): readonly ComposerJudgeSuggestion[] {
  const validActionCount =
    traces.find(({ kind }) => kind === "valid")?.actionCount ?? 0;
  return review.critique.issues.flatMap((issue) => {
    const suggestion = suggestionForIssue(draft, issue, validActionCount);
    return suggestion ? [suggestion] : [];
  });
}

export async function reviewComposerWorkflow(input: {
  readonly teacherRequest: string;
  readonly workflow: Readonly<ValidatedLabWorkflowSpecV2>;
  readonly attempt: number;
  readonly fetcher?: WorkflowJudgeFetch;
}): Promise<{
  readonly traces: readonly CapabilityAuthorTraceSummary[];
  readonly review: WorkflowJudgeResponse;
}> {
  const traces = executeComposerJudgeTraces(input.workflow, input.attempt);
  const request = createWorkflowJudgeRequest({
    teacherRequest: input.teacherRequest,
    workflow: input.workflow,
    traces
  });
  const review = await requestWorkflowJudgeReview(request, input.fetcher);
  return { traces, review };
}

export async function applyComposerJudgeSuggestion(input: {
  readonly draft: Readonly<LabWorkflowDraftV2>;
  readonly suggestion: Readonly<ComposerJudgeSuggestion>;
  readonly teacherRequest: string;
  readonly attempt: number;
  readonly checkedAt?: string;
  readonly fetcher?: WorkflowJudgeFetch;
}): Promise<ComposerJudgeCycleResult> {
  const transaction = applyLabDraftTransaction(
    input.draft,
    input.suggestion.commands,
    input.draft.revision
  );
  if (!transaction.ok) {
    return {
      ok: false,
      stage: "command",
      message: "That suggestion no longer matches this draft. Nothing changed."
    };
  }
  const validation = validateLabWorkflowSpecV2(transaction.draft, {
    checkedAt: input.checkedAt ?? new Date().toISOString()
  });
  if (!validation.schemaValid || !validation.validation.runnable) {
    return {
      ok: false,
      stage: "validation",
      message:
        "Litmus rejected that suggestion during its required checks. Your draft was not changed."
    };
  }
  let traces: readonly CapabilityAuthorTraceSummary[];
  try {
    traces = executeComposerJudgeTraces(validation.spec, input.attempt);
  } catch {
    return {
      ok: false,
      stage: "trace",
      message:
        "A required student scenario no longer worked after that suggestion. Your draft was not changed."
    };
  }
  try {
    const request = createWorkflowJudgeRequest({
      teacherRequest: input.teacherRequest,
      workflow: validation.spec,
      traces
    });
    const review = await requestWorkflowJudgeReview(request, input.fetcher);
    return {
      ok: true,
      draft: transaction.draft,
      validation,
      traces,
      review
    };
  } catch {
    return {
      ok: false,
      stage: "judge",
      message:
        "The follow-up teaching review did not finish. Your draft was not changed."
    };
  }
}
