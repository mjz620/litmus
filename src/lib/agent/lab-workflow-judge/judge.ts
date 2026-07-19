import { configurationRegistry } from "../../../lab-workflows/registries/configurations";
import {
  evaluateLabWorkflowEligibilityV2,
  WORKFLOW_ELIGIBILITY_FAILURE_CODES_V2
} from "../../../lab-workflows/validation";
import {
  WORKFLOW_JUDGE_PROMPT_VERSION,
  WORKFLOW_JUDGE_VERSION
} from "./prompt";
import {
  WORKFLOW_JUDGE_CONTRACT_VERSION,
  WORKFLOW_JUDGE_DIMENSIONS,
  WORKFLOW_JUDGE_OUTPUT_VERSION,
  workflowJudgeErrorResponseSchema,
  workflowJudgeModelOutputSchema,
  workflowJudgeRequestSchema,
  workflowJudgeResponseSchema,
  type WorkflowJudgeDimension,
  type WorkflowJudgeErrorCode,
  type WorkflowJudgeModelOutput,
  type WorkflowJudgeRequest,
  type WorkflowJudgeResponse
} from "./schemas";
import { createWorkflowJudgeCapabilitySummary } from "./request";

export {
  createWorkflowJudgeCapabilitySummary,
  createWorkflowJudgeRequest
} from "./request";
export type { CreateWorkflowJudgeRequestInput } from "./request";

export const WORKFLOW_JUDGE_FALLBACK_MODEL =
  "deterministic-workflow-judge-v2" as const;

export interface WorkflowJudgeModelResult {
  readonly output: unknown;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface WorkflowJudgeModel {
  readonly model: string;
  judge(
    request: Readonly<WorkflowJudgeRequest>
  ): Promise<WorkflowJudgeModelResult>;
}

export interface JudgeLabWorkflowOptions {
  readonly model?: WorkflowJudgeModel;
  readonly judgedAt?: string;
}

export class WorkflowJudgeInputError extends Error {
  constructor(
    readonly code: WorkflowJudgeErrorCode,
    message: string,
    readonly fieldPaths: readonly string[],
    readonly status = 422,
    readonly retryable = false
  ) {
    super(message);
    this.name = "WorkflowJudgeInputError";
  }
}

function fail(
  code: WorkflowJudgeErrorCode,
  message: string,
  fieldPaths: readonly string[],
  status = 422,
  retryable = false
): never {
  throw new WorkflowJudgeInputError(
    code,
    message,
    Object.freeze([...fieldPaths]),
    status,
    retryable
  );
}

export function createWorkflowJudgeErrorResponse(
  error: WorkflowJudgeInputError
) {
  return workflowJudgeErrorResponseSchema.parse({
    ok: false,
    contractVersion: WORKFLOW_JUDGE_CONTRACT_VERSION,
    error: {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      fieldPaths: [...error.fieldPaths].sort()
    }
  });
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertCurrentWorkflow(request: Readonly<WorkflowJudgeRequest>): void {
  if (!sameJson(request.validation, request.workflow.validation)) {
    fail(
      "judge.stale_hash.v2",
      "The supplied validation does not belong to this exact workflow.",
      ["validation", "workflow.validation"],
      409
    );
  }
  const eligibility = evaluateLabWorkflowEligibilityV2(
    request.workflow,
    "preview"
  );
  if (eligibility.eligible) return;
  const staleCodes = new Set<string>([
    WORKFLOW_ELIGIBILITY_FAILURE_CODES_V2.validatorVersionStale,
    WORKFLOW_ELIGIBILITY_FAILURE_CODES_V2.registrySnapshotStale,
    WORKFLOW_ELIGIBILITY_FAILURE_CODES_V2.hashMismatch,
    WORKFLOW_ELIGIBILITY_FAILURE_CODES_V2.resolvedAdapterMismatch,
    WORKFLOW_ELIGIBILITY_FAILURE_CODES_V2.resolvedModelMismatch,
    WORKFLOW_ELIGIBILITY_FAILURE_CODES_V2.validationArtifactMismatch
  ]);
  const stale = eligibility.failureCodes.some((code) => staleCodes.has(code));
  fail(
    stale ? "judge.stale_hash.v2" : "judge.not_eligible.v2",
    stale
      ? "The workflow no longer matches its deterministic validation."
      : "The advisory Judge only reviews a current runnable, preview-eligible workflow.",
    ["workflow"],
    stale ? 409 : 422
  );
}

function assertCapabilitySummary(
  request: Readonly<WorkflowJudgeRequest>
): void {
  const expected = createWorkflowJudgeCapabilitySummary(request.workflow);
  if (!sameJson(request.capabilitySummary, expected)) {
    fail(
      "judge.capability_mismatch.v2",
      "The capability summary does not match the exact validated workflow.",
      ["capabilitySummary"],
      409
    );
  }
}

const EXPECTED_TRACE_STATUS = Object.freeze({
  valid: "completed",
  alternate_valid: "completed",
  recoverable_mistake: "completed",
  terminal_mistake: "failed",
  tolerance_boundary: "completed"
} as const);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertTraces(request: Readonly<WorkflowJudgeRequest>): void {
  const kinds = request.traces.map(({ kind }) => kind).sort();
  const expectedKinds = Object.keys(EXPECTED_TRACE_STATUS).sort();
  if (!sameJson(kinds, expectedKinds)) {
    fail(
      "judge.trace_evidence_invalid.v2",
      "Exactly one executed trace is required for every review case.",
      ["traces"]
    );
  }
  const ruleById = new Map(
    request.workflow.rules.map((rule) => [rule.id, rule])
  );
  const expectedTracePrefix = new RegExp(
    `^trace\\.agent\\.${escapeRegex(request.workflow.validation.canonicalSpecHash.slice(-12))}\\.`
  );
  const traceIds = new Set<string>();
  request.traces.forEach((trace, index) => {
    const eventIds = new Set(trace.eventIds);
    const recoverableViolation = trace.diagnoses.some(
      ({ status, recoverable }) => status === "violated" && recoverable
    );
    if (
      trace.source !== "executed_generic_replay_v1" ||
      trace.workflowId !== request.workflow.id ||
      trace.workflowRevision !== request.workflow.revision ||
      trace.workflowHash !== request.workflow.validation.canonicalSpecHash ||
      !trace.passed ||
      trace.actionCount < 1 ||
      trace.workflowStatus !== EXPECTED_TRACE_STATUS[trace.kind] ||
      !expectedTracePrefix.test(trace.traceId) ||
      traceIds.has(trace.traceId) ||
      trace.evidenceEventIds.some((eventId) => !eventIds.has(eventId)) ||
      (trace.kind === "recoverable_mistake" && !recoverableViolation) ||
      (trace.kind === "terminal_mistake" &&
        !trace.diagnoses.some(
          ({ status, recoverable }) => status === "violated" && !recoverable
        ))
    ) {
      fail(
        "judge.trace_evidence_invalid.v2",
        "A trace summary is not bound to a demonstrated generic-runtime replay outcome.",
        [`traces[${index}]`],
        409
      );
    }
    traceIds.add(trace.traceId);
    trace.diagnoses.forEach((diagnosis, diagnosisIndex) => {
      const rule = ruleById.get(diagnosis.ruleId);
      if (
        !rule ||
        rule.severity !== diagnosis.severity ||
        rule.recoverable !== diagnosis.recoverable ||
        diagnosis.evidenceEventIds.some((eventId) => !eventIds.has(eventId))
      ) {
        fail(
          "judge.trace_evidence_invalid.v2",
          "Trace diagnosis evidence does not match a current workflow rule.",
          [`traces[${index}].diagnoses[${diagnosisIndex}]`],
          409
        );
      }
    });
    trace.observables.forEach(({ observableId }, observableIndex) => {
      if (!configurationRegistry.has(observableId)) {
        fail(
          "judge.trace_evidence_invalid.v2",
          "Trace observable evidence is not registered.",
          [`traces[${index}].observables[${observableIndex}].observableId`],
          409
        );
      }
    });
  });
}

function getAtPath(root: unknown, path: string): unknown {
  if (path === "$") return root;
  const tokens = [...path.matchAll(/\.([A-Za-z][A-Za-z0-9_]*)|\[(\d+)\]/g)];
  if (`$${tokens.map((token) => token[0]).join("")}` !== path) return undefined;
  let current: unknown = root;
  for (const token of tokens) {
    const key: string | number = token[1] ?? Number(token[2]);
    if (current === null || typeof current !== "object" || !(key in current))
      return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }
  return current;
}

function allowedEvidenceReferences(
  request: Readonly<WorkflowJudgeRequest>
): Set<string> {
  return new Set([
    "teacher_request",
    "validation.current",
    ...request.workflow.validation.passedCheckIds,
    ...request.workflow.objectiveIds,
    ...request.workflow.equipment.flatMap((equipment) => [
      equipment.instanceId,
      equipment.equipmentDefinitionId,
      equipment.configurationPresetId
    ]),
    ...request.workflow.permittedActions.flatMap((permission) => [
      permission.id,
      permission.actionId
    ]),
    ...request.workflow.rules.map(({ id }) => id),
    ...request.workflow.instructions.map(({ id }) => id),
    ...request.workflow.rubric.criteria.map(({ id }) => id),
    request.capabilitySummary.deviceProfileId,
    request.capabilitySummary.rubricId,
    ...(request.capabilitySummary.runtimeAdapterId
      ? [request.capabilitySummary.runtimeAdapterId]
      : []),
    ...request.capabilitySummary.resolvedAdapters.flatMap(
      ({ ownerId, adapterId }) => [ownerId, adapterId]
    ),
    ...request.capabilitySummary.resolvedChemistryModels.map(
      ({ modelId }) => modelId
    ),
    ...request.capabilitySummary.requiredChemistryCapabilityIds,
    ...request.capabilitySummary.availableEventTypeIds,
    ...request.capabilitySummary.availableFlagIds,
    ...request.traces.flatMap((trace) => [
      trace.traceId,
      ...trace.eventIds,
      ...trace.evidenceEventIds,
      ...trace.observables.map(({ observableId }) => observableId)
    ])
  ]);
}

const PROHIBITED_CHEMISTRY_CLAIM =
  /(?:pH|equivalence point|concentration|precipitate|solubility|heat flow|tolerance|ground truth).{0,80}(?:equals?|is|should be|set to|change to|calculate|compute)\s*-?\d/i;
const IDENTIFIER_PATTERN =
  /\b(?:action|component|event|flag|rule|criterion|objective|capability|model|adapter|placement|rubric)\.[A-Za-z0-9_.:-]+\b/g;

function allCritiqueText(output: Readonly<WorkflowJudgeModelOutput>): string[] {
  return [
    output.summary,
    output.uncertainty.explanation,
    ...output.scores.map(({ rationale }) => rationale),
    ...output.issues.flatMap(({ critique, suggestedRevision }) => [
      critique,
      suggestedRevision
    ]),
    ...output.strengths.map(({ statement }) => statement)
  ];
}

function validateModelOutput(
  outputInput: unknown,
  request: Readonly<WorkflowJudgeRequest>
): WorkflowJudgeModelOutput | null {
  const parsed = workflowJudgeModelOutputSchema.safeParse(outputInput);
  if (!parsed.success) return null;
  const output = parsed.data;
  const dimensions = output.scores.map(({ dimension }) => dimension).sort();
  if (!sameJson(dimensions, [...WORKFLOW_JUDGE_DIMENSIONS].sort())) return null;
  const allowedEvidence = allowedEvidenceReferences(request);
  const pathGroups = [
    ...output.scores.map(({ pathReferences }) => pathReferences),
    ...output.strengths.map(({ pathReferences }) => pathReferences),
    ...output.issues.map(({ path }) => [path])
  ];
  const evidenceGroups = [
    ...output.scores.map(({ evidenceReferences }) => evidenceReferences),
    ...output.strengths.map(({ evidenceReferences }) => evidenceReferences),
    ...output.issues.map(({ evidenceReferences }) => evidenceReferences),
    output.uncertainty.evidenceReferences
  ];
  if (
    pathGroups.some((paths) =>
      paths.some((path) => getAtPath(request.workflow, path) === undefined)
    ) ||
    evidenceGroups.some((references) =>
      references.some((reference) => !allowedEvidence.has(reference))
    ) ||
    new Set(output.issues.map(({ id }) => id)).size !== output.issues.length
  ) {
    return null;
  }
  const text = allCritiqueText(output).join("\n");
  if (PROHIBITED_CHEMISTRY_CLAIM.test(text)) return null;
  const mentionedIds = text.match(IDENTIFIER_PATTERN) ?? [];
  if (mentionedIds.some((identifier) => !allowedEvidence.has(identifier)))
    return null;
  return output;
}

type Score = 1 | 2 | 3 | 4 | 5;
type Issue = WorkflowJudgeModelOutput["issues"][number];

function scoreEntry(
  dimension: WorkflowJudgeDimension,
  score: Score,
  rationale: string,
  pathReferences: readonly string[],
  evidenceReferences: readonly string[],
  uncertainty: "low" | "medium" | "high" = "low"
): WorkflowJudgeModelOutput["scores"][number] {
  return {
    dimension,
    score,
    rationale,
    pathReferences: [...pathReferences],
    evidenceReferences: [...evidenceReferences],
    uncertainty
  };
}

function deterministicCritique(
  request: Readonly<WorkflowJudgeRequest>
): WorkflowJudgeModelOutput {
  const workflow = request.workflow;
  const issues: Issue[] = [];
  const scores: WorkflowJudgeModelOutput["scores"] = [];
  const alternate = request.traces.find(
    ({ kind }) => kind === "alternate_valid"
  )!;
  const recoverable = request.traces.find(
    ({ kind }) => kind === "recoverable_mistake"
  )!;
  const terminal = request.traces.find(
    ({ kind }) => kind === "terminal_mistake"
  )!;
  const valid = request.traces.find(({ kind }) => kind === "valid")!;
  const objectiveRuleIds = new Set(
    workflow.rules.flatMap(({ objectiveIds }) => objectiveIds)
  );
  const objectiveRubricIds = new Set(
    workflow.rubric.criteria.flatMap(({ objectiveIds }) => objectiveIds)
  );
  const missingRuleObjective = workflow.objectiveIds.find(
    (objectiveId) => !objectiveRuleIds.has(objectiveId)
  );
  const missingRubricObjective = workflow.objectiveIds.find(
    (objectiveId) => !objectiveRubricIds.has(objectiveId)
  );
  const objectiveAligned = !missingRuleObjective && !missingRubricObjective;
  if (!objectiveAligned) {
    issues.push({
      id: "judge.issue.objective_alignment",
      severity: "blocker",
      dimension: "objective_alignment",
      path: "$.objectiveIds",
      critique:
        "At least one stated objective is not represented by both workflow rules and rubric criteria.",
      suggestedRevision:
        "Map every stated objective to existing rules and evidence-backed rubric criteria, then revalidate and retrace.",
      evidenceReferences: [
        missingRuleObjective ??
          missingRubricObjective ??
          workflow.objectiveIds[0]!
      ]
    });
  }
  scores.push(
    scoreEntry(
      "objective_alignment",
      objectiveAligned ? 5 : 2,
      objectiveAligned
        ? "Every objective is represented in both authored rules and rubric criteria."
        : "Objective coverage is incomplete across the authored rules and rubric.",
      ["$.objectiveIds", "$.rules", "$.rubric.criteria"],
      objectiveAligned
        ? [workflow.objectiveIds[0]!, workflow.rubric.criteria[0]!.id]
        : [missingRuleObjective ?? missingRubricObjective!]
    )
  );

  const instructionRuleIds = new Set(
    workflow.instructions.flatMap(({ relatedRuleIds }) => relatedRuleIds)
  );
  const coreRules = workflow.rules.filter(({ kind }) => kind !== "ordering");
  const uncoveredRule = coreRules.find(({ id }) => !instructionRuleIds.has(id));
  const hasSuccess = workflow.rules.some(({ kind }) => kind === "success");
  const pedagogyStrong = workflow.instructions.length >= 2 && hasSuccess;
  if (!pedagogyStrong) {
    issues.push({
      id: "judge.issue.pedagogy",
      severity: "medium",
      dimension: "pedagogy",
      path: "$.instructions",
      critique:
        "The learning sequence lacks enough staged guidance or an explicit success rule.",
      suggestedRevision:
        "Use concise instruction stages tied to existing rules and retain an explicit completion rule.",
      evidenceReferences: [valid.traceId]
    });
  }
  scores.push(
    scoreEntry(
      "pedagogy",
      pedagogyStrong ? 5 : 2,
      pedagogyStrong
        ? "The authored instructions form a staged sequence and end in a registered success condition."
        : "The authored sequence has a meaningful instructional gap.",
      ["$.instructions", "$.rules"],
      [valid.traceId]
    )
  );

  const orderingCount = workflow.rules.filter(
    ({ kind }) => kind === "ordering"
  ).length;
  const nonOrderingCount = Math.max(1, workflow.rules.length - orderingCount);
  const overlyRigid = orderingCount / nonOrderingCount > 0.75;
  if (overlyRigid) {
    issues.push({
      id: "judge.issue.flexibility",
      severity: "medium",
      dimension: "flexibility",
      path: "$.rules",
      critique:
        "Ordering constraints dominate the workflow even though an alternate valid trace exists.",
      suggestedRevision:
        "Keep only prerequisite edges that protect learning or safety and leave independent valid actions unordered.",
      evidenceReferences: [alternate.traceId]
    });
  }
  scores.push(
    scoreEntry(
      "flexibility",
      overlyRigid ? 2 : 5,
      overlyRigid
        ? "The executed alternate path passes, but the authored graph imposes unusually dense ordering."
        : "The executed alternate path completes and the authored prerequisite graph leaves meaningful independence.",
      ["$.rules"],
      [alternate.traceId]
    )
  );

  const rubricPoints = workflow.rubric.criteria.map(
    ({ maxPoints }) => maxPoints
  );
  const dominantCriterion = workflow.rubric.criteria.find(
    ({ maxPoints }) =>
      workflow.rubric.totalPoints > 0 &&
      maxPoints / workflow.rubric.totalPoints > 0.6
  );
  const weakCriterion = workflow.rubric.criteria.find(
    ({ scoringGuide, evidenceMappings }) =>
      scoringGuide.length < 2 || evidenceMappings.length === 0
  );
  const rubricFair =
    workflow.rubric.criteria.length >= workflow.objectiveIds.length &&
    !dominantCriterion &&
    !weakCriterion &&
    rubricPoints.reduce((sum, points) => sum + points, 0) ===
      workflow.rubric.totalPoints;
  if (!rubricFair) {
    const index = Math.max(
      0,
      workflow.rubric.criteria.findIndex(
        ({ id }) => id === (dominantCriterion ?? weakCriterion)?.id
      )
    );
    issues.push({
      id: "judge.issue.rubric_fairness",
      severity: "blocker",
      dimension: "rubric_fairness",
      path: `$.rubric.criteria[${index}]`,
      critique:
        "The rubric weight or evidence guidance does not fairly represent the stated objectives.",
      suggestedRevision:
        "Balance points across objectives and retain multiple evidence-backed performance levels for each criterion.",
      evidenceReferences: [
        workflow.rubric.criteria[index]?.id ?? workflow.rubric.id
      ]
    });
  }
  scores.push(
    scoreEntry(
      "rubric_fairness",
      rubricFair ? 5 : 2,
      rubricFair
        ? "Rubric points are balanced across objectives and every criterion has registered evidence and scoring guidance."
        : "The rubric has a material fairness or evidence-guidance gap.",
      ["$.rubric", "$.objectiveIds"],
      [workflow.rubric.criteria[0]!.id, valid.traceId]
    )
  );

  const hasRecoverableRule = workflow.rules.some(
    ({ recoverable, kind }) => recoverable && kind !== "success"
  );
  const hasTerminalRule = workflow.rules.some(
    ({ terminal, recoverable, severity }) =>
      terminal &&
      !recoverable &&
      (severity === "procedural" ||
        severity === "conceptual" ||
        severity === "safety")
  );
  const meaningfulFailures = hasRecoverableRule && hasTerminalRule;
  if (!meaningfulFailures) {
    issues.push({
      id: "judge.issue.failure_cases",
      severity: "medium",
      dimension: "failure_cases",
      path: "$.rules",
      critique:
        "The workflow does not distinguish both recoverable practice mistakes and a meaningful terminal failure.",
      suggestedRevision:
        "Use existing rule conditions to identify one recoverable learning moment and one genuinely terminal outcome.",
      evidenceReferences: [recoverable.traceId, terminal.traceId]
    });
  }
  scores.push(
    scoreEntry(
      "failure_cases",
      meaningfulFailures ? 5 : 2,
      meaningfulFailures
        ? "Executed traces demonstrate separate recoverable and terminal outcomes backed by authored rules."
        : "Executed cases exist, but the authored rules do not express both failure modes clearly.",
      ["$.rules"],
      [recoverable.traceId, terminal.traceId]
    )
  );

  const vagueInstruction = workflow.instructions.find(
    ({ guidance }) => guidance.trim().length < 40
  );
  const clear = !uncoveredRule && !vagueInstruction;
  if (!clear) {
    issues.push({
      id: "judge.issue.clarity",
      severity: "medium",
      dimension: "clarity",
      path: vagueInstruction
        ? `$.instructions[${workflow.instructions.indexOf(vagueInstruction)}]`
        : "$.instructions",
      critique: "At least one core rule lacks clear student-facing guidance.",
      suggestedRevision:
        "Connect concise, observable student guidance to every core rule without adding numeric scientific truth.",
      evidenceReferences: [
        uncoveredRule?.id ?? vagueInstruction?.id ?? valid.traceId
      ]
    });
  }
  scores.push(
    scoreEntry(
      "clarity",
      clear ? 5 : 3,
      clear
        ? "Student guidance is concise and covers every core workflow rule."
        : "Some student guidance is vague or does not cover a core rule.",
      ["$.instructions", "$.rules"],
      [workflow.instructions[0]?.id ?? valid.traceId]
    )
  );

  const teacherUsable =
    workflow.metadata.title.length > 0 &&
    workflow.metadata.learningObjective.length > 0 &&
    workflow.presentation.instructionGuidance.length > 0;
  scores.push(
    scoreEntry(
      "teacher_usability",
      teacherUsable ? 5 : 3,
      teacherUsable
        ? "Title, learning objective, guidance, and runnable structure are visible to a teacher."
        : "The teacher-facing overview or rationale is incomplete.",
      ["$.metadata", "$.presentation"],
      ["validation.current"]
    )
  );

  const expectedMinutes = Math.max(5, Math.ceil(valid.actionCount * 1.5));
  const durationFeasible =
    workflow.metadata.estimatedMinutes >= expectedMinutes;
  if (!durationFeasible) {
    issues.push({
      id: "judge.issue.duration",
      severity: "medium",
      dimension: "duration_feasibility",
      path: "$.metadata.estimatedMinutes",
      critique:
        "The stated duration is short relative to the executed action sequence and its required observations.",
      suggestedRevision:
        "Increase the teacher-facing duration estimate or remove nonessential authored work, then rerun traces.",
      evidenceReferences: [valid.traceId]
    });
  }
  scores.push(
    scoreEntry(
      "duration_feasibility",
      durationFeasible ? 5 : 2,
      durationFeasible
        ? "The stated duration reasonably accommodates the executed valid trace and instruction stages."
        : "The stated duration does not reasonably accommodate the demonstrated work.",
      ["$.metadata.estimatedMinutes", "$.instructions"],
      [valid.traceId]
    )
  );

  const levelFit = !(
    workflow.metadata.gradeBand === "9-10" &&
    workflow.metadata.difficulty === "advanced"
  );
  scores.push(
    scoreEntry(
      "student_level",
      levelFit ? 5 : 3,
      levelFit
        ? "The declared grade band, difficulty, vocabulary, and scaffolding are mutually consistent."
        : "The declared difficulty may exceed the scaffolding provided for the grade band.",
      ["$.metadata.gradeBand", "$.metadata.difficulty", "$.instructions"],
      [workflow.instructions[0]?.id ?? "teacher_request"],
      levelFit ? "low" : "medium"
    )
  );

  const underResourced =
    workflow.metadata.deviceProfileId === "device.chromebook_core.v1" &&
    workflow.equipment.length <= 6 &&
    workflow.metadata.accessibilityNotes.length >= 1;
  if (!underResourced) {
    issues.push({
      id: "judge.issue.under_resourced",
      severity: "low",
      dimension: "under_resourced_suitability",
      path: "$.metadata",
      critique:
        "The declared device, apparatus count, or accessibility fallback needs clearer low-resource support.",
      suggestedRevision:
        "Use the Chromebook profile and document keyboard/text fallbacks while keeping apparatus requirements bounded.",
      evidenceReferences: [request.capabilitySummary.deviceProfileId]
    });
  }
  scores.push(
    scoreEntry(
      "under_resourced_suitability",
      underResourced ? 5 : 3,
      underResourced
        ? "The workflow targets the Chromebook profile, uses bounded apparatus, and documents an accessibility fallback."
        : "The low-resource device or accessibility story is incomplete.",
      [
        "$.metadata.deviceProfileId",
        "$.metadata.accessibilityNotes",
        "$.equipment"
      ],
      [request.capabilitySummary.deviceProfileId]
    )
  );

  const seriousIssues = issues.filter(
    ({ severity }) => severity === "blocker" || severity === "medium"
  );
  const average =
    scores.reduce((sum, { score }) => sum + score, 0) / scores.length;
  return workflowJudgeModelOutputSchema.parse({
    scores,
    issues,
    strengths: [
      {
        statement:
          "The workflow passed current deterministic validation and all five required executed trace cases.",
        pathReferences: ["$.validation", "$.rules"],
        evidenceReferences: ["validation.current", valid.traceId]
      },
      {
        statement:
          "The authored rubric cites registered workflow evidence rather than free-form grading claims.",
        pathReferences: ["$.rubric.criteria"],
        evidenceReferences: [workflow.rubric.criteria[0]!.id]
      }
    ],
    summary:
      seriousIssues.length === 0
        ? "The exact validated workflow is pedagogically coherent, evidence-backed, and practical for its stated classroom context."
        : "The exact validated workflow runs, but its authored learning design needs bounded teacher review before use.",
    recommendation:
      seriousIssues.length === 0 && average >= 4 ? "approve" : "revise",
    uncertainty: {
      level: "low",
      explanation:
        "The review is grounded in the exact validation artifact and five executed trace summaries; classroom observation remains outside this evidence.",
      evidenceReferences: [
        valid.traceId,
        alternate.traceId,
        "validation.current"
      ]
    }
  });
}

function parseRequest(input: unknown): WorkflowJudgeRequest {
  const parsed = workflowJudgeRequestSchema.safeParse(input);
  if (!parsed.success) {
    fail(
      "judge.invalid_request.v2",
      "Workflow Judge request failed strict validation.",
      parsed.error.issues.map(({ path }) => path.join(".") || "$"),
      400
    );
  }
  return parsed.data;
}

export async function judgeLabWorkflow(
  requestInput: unknown,
  options: JudgeLabWorkflowOptions = {}
): Promise<WorkflowJudgeResponse> {
  const request = parseRequest(requestInput);
  assertCurrentWorkflow(request);
  assertCapabilitySummary(request);
  assertTraces(request);
  const fallback = deterministicCritique(request);
  let critique = fallback;
  let mode: "live" | "deterministic_fallback" = "deterministic_fallback";
  let fallbackReason:
    | "deterministic_configured"
    | "model_unavailable"
    | "model_output_invalid"
    | null = "deterministic_configured";
  let modelName: string = WORKFLOW_JUDGE_FALLBACK_MODEL;
  let inputTokens = 0;
  let outputTokens = 0;

  if (options.model) {
    modelName = options.model.model;
    try {
      const result = await options.model.judge(request);
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
      const normalized = validateModelOutput(result.output, request);
      if (normalized) {
        critique = normalized;
        mode = "live";
        fallbackReason = null;
      } else {
        fallbackReason = "model_output_invalid";
      }
    } catch {
      fallbackReason = "model_unavailable";
    }
  }

  return workflowJudgeResponseSchema.parse({
    ok: true,
    contractVersion: WORKFLOW_JUDGE_CONTRACT_VERSION,
    authority: "advisory_only",
    metadata: {
      outputVersion: WORKFLOW_JUDGE_OUTPUT_VERSION,
      judgeVersion: WORKFLOW_JUDGE_VERSION,
      promptVersion: WORKFLOW_JUDGE_PROMPT_VERSION,
      model: modelName,
      mode,
      fallbackReason,
      judgedAt: options.judgedAt ?? new Date().toISOString(),
      workflowId: request.workflow.id,
      workflowRevision: request.workflow.revision,
      workflowHash: request.workflow.validation.canonicalSpecHash,
      validatorVersion: request.workflow.validation.validatorVersion,
      promptTokens: inputTokens,
      outputTokens,
      estimatedCost: {
        currency: "USD",
        amount: mode === "deterministic_fallback" ? 0 : null,
        source:
          mode === "deterministic_fallback"
            ? "deterministic_fallback"
            : "provider_not_priced"
      }
    },
    critique
  });
}
