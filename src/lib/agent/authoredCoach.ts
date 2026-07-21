import { actionRegistry } from "../../lab-workflows/registries/actions";
import {
  eventFlagRegistry,
  eventTypeRegistry
} from "../../lab-workflows/registries/event-flags";
import type { GenericLabState } from "../../lab-workflows/runtime";
import type {
  WorkflowDiagnosis,
  WorkflowRule
} from "../../lab-workflows/schema/conditions";
import type { ValidatedLabWorkflowSpecV2 } from "../../lab-workflows/schema/v2";
import {
  evaluateLabWorkflowEligibilityV2,
  WORKFLOW_ELIGIBILITY_FAILURE_CODES_V2
} from "../../lab-workflows/validation";
import {
  AUTHORED_COACH_PROMPT_VERSION,
  AUTHORED_COACH_VERSION
} from "./authoredCoachPrompt";
import {
  AUTHORED_COACH_CONTEXT_VERSION,
  AUTHORED_COACH_CONTRACT_VERSION,
  AUTHORED_COACH_OUTPUT_VERSION,
  authoredCoachModelOutputSchema,
  authoredCoachRequestSchema,
  authoredCoachResponseSchema,
  authoredCoachWorkflowContextSchema,
  type AuthoredCoachErrorCode,
  type AuthoredCoachGuidanceKind,
  type AuthoredCoachModelOutput,
  type AuthoredCoachRequest,
  type AuthoredCoachResponse,
  type AuthoredCoachWorkflowContext
} from "./authoredCoachSchemas";

export const AUTHORED_COACH_FALLBACK_MODEL =
  "deterministic-diagnosis-coach-v2" as const;
export const AUTHORED_COACH_MODEL_TIMEOUT_MS = 10_000;

export interface AuthoredCoachModel {
  readonly model: string;
  respond(request: Readonly<AuthoredCoachRequest>): Promise<unknown>;
}

export interface GenerateAuthoredCoachOptions {
  readonly model?: AuthoredCoachModel;
  readonly modelTimeoutMs?: number;
}

export class AuthoredCoachInputError extends Error {
  readonly code: AuthoredCoachErrorCode;
  readonly fieldPaths: readonly string[];
  readonly status: number;

  constructor(
    code: AuthoredCoachErrorCode,
    message: string,
    fieldPaths: readonly string[],
    status = 422
  ) {
    super(message);
    this.name = "AuthoredCoachInputError";
    this.code = code;
    this.fieldPaths = Object.freeze([...fieldPaths]);
    this.status = status;
  }
}

function fail(
  code: AuthoredCoachErrorCode,
  message: string,
  fieldPaths: readonly string[],
  status = 422
): never {
  throw new AuthoredCoachInputError(code, message, fieldPaths, status);
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function sortPairs(values: readonly (readonly [string, string])[]) {
  return [...values].sort(
    ([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)
  );
}

function currentAvailableActions(
  definition: Readonly<ValidatedLabWorkflowSpecV2>,
  state: Readonly<GenericLabState>
) {
  const diagnosisStatus = new Map(
    state.diagnoses.map(({ ruleId, status }) => [ruleId, status])
  );
  const attempts = new Map(
    state.permissionAttempts.map(({ permissionId, count }) => [
      permissionId,
      count
    ])
  );
  if (state.workflowStatus !== "in_progress") return [];
  return definition.permittedActions.flatMap((permission) => {
    const available =
      permission.availability.allSatisfiedRuleIds.every(
        (ruleId) => diagnosisStatus.get(ruleId) === "satisfied"
      ) &&
      permission.availability.allUnsatisfiedRuleIds.every(
        (ruleId) => diagnosisStatus.get(ruleId) !== "satisfied"
      ) &&
      (permission.maxAttempts === undefined ||
        (attempts.get(permission.id) ?? 0) < permission.maxAttempts);
    return available
      ? [{ permissionId: permission.id, actionId: permission.actionId }]
      : [];
  });
}

function assertRuntimeProvenance(
  definition: Readonly<ValidatedLabWorkflowSpecV2>,
  state: Readonly<GenericLabState>
): void {
  const artifact = definition.validation;
  const provenance = state.provenance;
  const expectedSnapshots = sortPairs(
    Object.entries(artifact.registrySnapshotIds)
  );
  const runtimeSnapshots = sortPairs(
    provenance.registrySnapshots.map(
      ({ registryId, snapshotId }) => [registryId, snapshotId] as const
    )
  );
  const compatibilityMatches = definition.compatibility
    ? provenance.compatibility?.runtimeAdapterId ===
        definition.compatibility.runtimeAdapterId &&
      provenance.compatibility.runtimeAdapterVersion ===
        definition.compatibility.runtimeAdapterVersion &&
      provenance.compatibility.engineId === definition.compatibility.engineId
    : provenance.compatibility === null;

  if (
    provenance.workflowId !== definition.id ||
    provenance.workflowRevision !== definition.revision ||
    provenance.workflowHash !== artifact.canonicalSpecHash ||
    provenance.validatorVersion !== artifact.validatorVersion ||
    !sameJson(runtimeSnapshots, expectedSnapshots) ||
    !sameJson(provenance.resolvedAdapters, artifact.resolvedAdapters) ||
    !sameJson(
      provenance.resolvedChemistryModels,
      artifact.resolvedChemistryModels
    ) ||
    !compatibilityMatches
  ) {
    throw new TypeError(
      "Runtime evidence does not match the exact validated coach definition."
    );
  }
}

/** Builds live Coach context without changing the persisted consumer envelope. */
export function createAuthoredCoachWorkflowContext(
  definition: Readonly<ValidatedLabWorkflowSpecV2>,
  state: Readonly<GenericLabState>
): Readonly<AuthoredCoachWorkflowContext> {
  const eligibility = evaluateLabWorkflowEligibilityV2(definition, "preview");
  if (!eligibility.eligible) {
    throw new TypeError(
      "Only a current preview-eligible definition can provide authored Coach context."
    );
  }
  assertRuntimeProvenance(definition, state);
  return deepFreeze(
    authoredCoachWorkflowContextSchema.parse({
      schemaVersion: AUTHORED_COACH_CONTEXT_VERSION,
      definition,
      definitionHash: definition.validation.canonicalSpecHash,
      runtime: {
        sessionId: state.sessionId,
        workflowId: state.provenance.workflowId,
        workflowRevision: state.provenance.workflowRevision,
        workflowHash: state.provenance.workflowHash,
        validatorVersion: state.provenance.validatorVersion,
        workflowStatus: state.workflowStatus,
        permissionAttempts: state.permissionAttempts
      },
      activeObjectiveIds: definition.objectiveIds,
      instructions: definition.instructions,
      rules: definition.rules,
      diagnoses: state.diagnoses,
      evidence: state.eventEnvelopes,
      availableActions: currentAvailableActions(definition, state)
    })
  );
}

function assertCurrentDefinition(
  request: Readonly<AuthoredCoachRequest>
): void {
  const { workflowContext } = request;
  const definition = workflowContext.definition;
  const eligibility = evaluateLabWorkflowEligibilityV2(definition, "preview");
  if (!eligibility.eligible) {
    const stale = eligibility.failureCodes.some((code) =>
      [
        WORKFLOW_ELIGIBILITY_FAILURE_CODES_V2.validatorVersionStale,
        WORKFLOW_ELIGIBILITY_FAILURE_CODES_V2.registrySnapshotStale,
        WORKFLOW_ELIGIBILITY_FAILURE_CODES_V2.hashMismatch,
        WORKFLOW_ELIGIBILITY_FAILURE_CODES_V2.resolvedAdapterMismatch,
        WORKFLOW_ELIGIBILITY_FAILURE_CODES_V2.resolvedModelMismatch,
        WORKFLOW_ELIGIBILITY_FAILURE_CODES_V2.validationArtifactMismatch
      ].includes(code as never)
    );
    fail(
      stale ? "coach.stale_definition.v2" : "coach.invalid_request.v2",
      stale
        ? "The active lab definition no longer matches its deterministic validation."
        : "Only a current runnable lab definition can supply authored coaching.",
      ["workflowContext.definition"],
      stale ? 409 : 422
    );
  }
  if (
    workflowContext.definitionHash !== definition.validation.canonicalSpecHash
  ) {
    fail(
      "coach.stale_definition.v2",
      "The Coach context hash does not match the active lab definition.",
      ["workflowContext.definitionHash"],
      409
    );
  }
}

function assertContextProjection(
  request: Readonly<AuthoredCoachRequest>
): void {
  const context = request.workflowContext;
  const definition = context.definition;
  if (
    context.runtime.sessionId !== request.sessionId ||
    context.runtime.workflowId !== definition.id ||
    context.runtime.workflowRevision !== definition.revision ||
    context.runtime.workflowHash !== definition.validation.canonicalSpecHash ||
    context.runtime.validatorVersion !==
      definition.validation.validatorVersion ||
    !sameJson(context.activeObjectiveIds, definition.objectiveIds) ||
    !sameJson(context.instructions, definition.instructions) ||
    !sameJson(context.rules, definition.rules)
  ) {
    fail(
      "coach.context_mismatch.v2",
      "Authored Coach context does not match the exact active lab.",
      ["workflowContext"],
      409
    );
  }

  const ruleById = new Map(definition.rules.map((rule) => [rule.id, rule]));
  const evidenceIds = new Set(context.evidence.map(({ eventId }) => eventId));
  if (
    context.diagnoses.length !== definition.rules.length ||
    new Set(context.diagnoses.map(({ ruleId }) => ruleId)).size !==
      context.diagnoses.length
  ) {
    fail(
      "coach.context_mismatch.v2",
      "Coach diagnoses must exactly cover the active workflow rules.",
      ["workflowContext.diagnoses"]
    );
  }
  context.diagnoses.forEach((diagnosis, index) => {
    const rule = ruleById.get(diagnosis.ruleId);
    if (
      !rule ||
      diagnosis.severity !== rule.severity ||
      diagnosis.recoverable !== rule.recoverable ||
      !sameJson(diagnosis.objectiveIds, rule.objectiveIds) ||
      diagnosis.evidenceEventIds.some((eventId) => !evidenceIds.has(eventId))
    ) {
      fail(
        "coach.unsupported_reference.v2",
        "A diagnosis does not resolve to the active workflow and evidence.",
        [`workflowContext.diagnoses.${index}`]
      );
    }
  });

  const permissionById = new Map(
    definition.permittedActions.map((permission) => [permission.id, permission])
  );
  const semanticEventTypes = new Set<string>(
    eventTypeRegistry.list().map(({ semanticEventType }) => semanticEventType)
  );
  if (evidenceIds.size !== context.evidence.length) {
    fail(
      "coach.unsupported_reference.v2",
      "Coach evidence IDs must be unique.",
      ["workflowContext.evidence"]
    );
  }
  context.evidence.forEach((event, index) => {
    const permission = permissionById.get(event.normalizedAction.permissionId);
    if (
      !permission ||
      permission.actionId !== event.normalizedAction.actionId ||
      !semanticEventTypes.has(event.payload.type) ||
      event.ruleEvidenceIds.some((ruleId) => !ruleById.has(ruleId))
    ) {
      fail(
        "coach.unsupported_reference.v2",
        "A Coach evidence event contains an unknown rule or action.",
        [`workflowContext.evidence.${index}`]
      );
    }
  });

  const stateProjection = {
    workflowStatus: context.runtime.workflowStatus,
    diagnoses: context.diagnoses,
    permissionAttempts: context.runtime.permissionAttempts
  };
  const diagnosisStatus = new Map(
    stateProjection.diagnoses.map(({ ruleId, status }) => [ruleId, status])
  );
  const attempts = new Map(
    stateProjection.permissionAttempts.map(({ permissionId, count }) => [
      permissionId,
      count
    ])
  );
  const expectedAvailable =
    stateProjection.workflowStatus === "in_progress"
      ? definition.permittedActions.flatMap((permission) => {
          const available =
            permission.availability.allSatisfiedRuleIds.every(
              (ruleId) => diagnosisStatus.get(ruleId) === "satisfied"
            ) &&
            permission.availability.allUnsatisfiedRuleIds.every(
              (ruleId) => diagnosisStatus.get(ruleId) !== "satisfied"
            ) &&
            (permission.maxAttempts === undefined ||
              (attempts.get(permission.id) ?? 0) < permission.maxAttempts);
          return available
            ? [{ permissionId: permission.id, actionId: permission.actionId }]
            : [];
        })
      : [];
  if (!sameJson(context.availableActions, expectedAvailable)) {
    fail(
      "coach.context_mismatch.v2",
      "Available recovery actions do not match the deterministic workflow state.",
      ["workflowContext.availableActions"]
    );
  }
}

function assertTrigger(request: Readonly<AuthoredCoachRequest>): void {
  const source = request.triggerPolicy.source;
  const question = request.studentQuestion?.trim();
  const violated = request.workflowContext.diagnoses.filter(
    ({ status }) => status === "violated"
  );
  if (source === "question") {
    if (
      !question ||
      !request.triggerPolicy.reasons.includes("student_question")
    ) {
      fail(
        "coach.trigger_not_authorized.v2",
        "A question-triggered Coach request requires an explicit student question and reason.",
        ["studentQuestion", "triggerPolicy.reasons"]
      );
    }
    return;
  }
  if (question) {
    fail(
      "coach.trigger_not_authorized.v2",
      "Unsolicited Coach requests cannot include a student question.",
      ["triggerPolicy.source"]
    );
  }
  if (source === "event") {
    const knownReasons = new Set([
      ...violated.map(({ ruleId }) => `diagnosis:${ruleId}`),
      ...request.workflowContext.evidence.flatMap(({ payload }) => [
        ...payload.flags,
        ...payload.evidence.map(({ skillId }) => `repeated_failure:${skillId}`)
      ])
    ]);
    if (
      request.triggerPolicy.reasons.some(
        (reason) => !knownReasons.has(reason)
      ) ||
      (violated.length > 0 && request.triggerPolicy.reasons.length === 0)
    ) {
      fail(
        "coach.trigger_not_authorized.v2",
        "The unsolicited Coach trigger does not resolve to current deterministic evidence.",
        ["triggerPolicy.reasons"]
      );
    }
    return;
  }
  if (
    source === "retry" &&
    (!violated.some(({ recoverable }) => recoverable) ||
      !request.triggerPolicy.reasons.includes("targeted_retry_requested"))
  ) {
    fail(
      "coach.trigger_not_authorized.v2",
      "Retry coaching requires a recoverable deterministic violation.",
      ["workflowContext.diagnoses"]
    );
  }
}

function assertRequest(request: Readonly<AuthoredCoachRequest>): void {
  assertCurrentDefinition(request);
  assertContextProjection(request);
  assertTrigger(request);
}

function guidanceKindForRule(
  rule: Readonly<WorkflowRule>
): AuthoredCoachGuidanceKind {
  if (rule.severity === "safety") return "safety";
  if (rule.kind === "best_practice" || rule.severity === "best-practice")
    return "optional_context";
  if (rule.severity === "conceptual") return "ai_guidance";
  return "mandatory_procedure";
}

const SEVERITY_PRIORITY: Readonly<
  Record<WorkflowDiagnosis["severity"], number>
> = Object.freeze({
  safety: 5,
  conceptual: 4,
  procedural: 3,
  "best-practice": 2,
  info: 1
});

function selectDiagnosis(
  request: Readonly<AuthoredCoachRequest>
): WorkflowDiagnosis | null {
  return (
    [...request.workflowContext.diagnoses]
      .filter(({ status }) => status === "violated")
      .sort(
        (left, right) =>
          SEVERITY_PRIORITY[right.severity] -
            SEVERITY_PRIORITY[left.severity] ||
          Number(right.recoverable) - Number(left.recoverable) ||
          left.ruleId.localeCompare(right.ruleId)
      )[0] ?? null
  );
}

interface AuthoredTriggerMatch {
  readonly objectiveIds: readonly string[];
  readonly rule: Readonly<WorkflowRule> | null;
  readonly evidenceEventIds: readonly string[];
}

function selectAuthoredTriggerMatch(
  request: Readonly<AuthoredCoachRequest>
): AuthoredTriggerMatch | null {
  const { definition, evidence, rules } = request.workflowContext;
  const reasonSet = new Set(request.triggerPolicy.reasons);
  for (const trigger of definition.coachPolicy.triggers) {
    const semanticFlags = trigger.flagIds.flatMap((flagId) => {
      if (!eventFlagRegistry.has(flagId)) return [flagId];
      return [eventFlagRegistry.get(flagId).semanticFlag];
    });
    if (!semanticFlags.some((flag) => reasonSet.has(flag))) continue;
    const matchingEvents = evidence.filter((event) => {
      const eventTypeMatches = trigger.eventTypeIds.some(
        (eventTypeId) =>
          semanticTypeForReference(eventTypeId) === event.payload.type
      );
      return (
        eventTypeMatches &&
        event.payload.flags.some((flag) => semanticFlags.includes(flag))
      );
    });
    if (matchingEvents.length === 0) continue;
    const rule =
      rules.find(
        (candidate) =>
          candidate.condition.kind === "event_flag" &&
          trigger.flagIds.includes(candidate.condition.flagId) &&
          candidate.objectiveIds.some((objectiveId) =>
            trigger.objectiveIds.includes(objectiveId)
          )
      ) ??
      rules.find((candidate) =>
        candidate.objectiveIds.some((objectiveId) =>
          trigger.objectiveIds.includes(objectiveId)
        )
      ) ??
      null;
    return {
      objectiveIds: trigger.objectiveIds,
      rule,
      evidenceEventIds: matchingEvents.map(({ eventId }) => eventId)
    };
  }
  return null;
}

function semanticTypeForReference(referenceId: string): string | null {
  const entry = eventTypeRegistry
    .list()
    .find(
      ({ id, workflowReferenceId }) =>
        id === referenceId || workflowReferenceId === referenceId
    );
  return entry?.semanticEventType ?? null;
}

function actionIdsForRule(
  rule: Readonly<WorkflowRule>,
  rules: readonly Readonly<WorkflowRule>[]
): string[] {
  const { condition } = rule;
  if (
    condition.kind === "action_observed" ||
    condition.kind === "action_count_within_range"
  ) {
    return [condition.actionId];
  }
  if (condition.kind === "rule_satisfied_before") {
    const predecessor = rules.find(
      ({ id }) => id === condition.predecessorRuleId
    );
    return predecessor ? actionIdsForRule(predecessor, rules) : [];
  }
  const eventReference =
    condition.kind === "semantic_event_observed"
      ? condition.eventTypeId
      : condition.kind === "observation_recorded"
        ? condition.eventTypeId
        : condition.kind === "event_flag"
          ? condition.eventTypeId
          : undefined;
  if (!eventReference) return [];
  const semanticType = semanticTypeForReference(eventReference);
  if (!semanticType) return [];
  return actionRegistry
    .list()
    .filter(({ emittedSemanticEventTypes }) =>
      emittedSemanticEventTypes.some(
        (emittedSemanticType) => emittedSemanticType === semanticType
      )
    )
    .map(({ id }) => id);
}

function silentOutput(): AuthoredCoachModelOutput {
  return {
    shouldRespond: false,
    interventionType: "none",
    hintLevel: 0,
    message: "",
    guidance: null,
    safety: { refused: false, reason: null }
  };
}

function instructionForQuestion(
  context: Readonly<AuthoredCoachWorkflowContext>,
  question: string
) {
  const tokens = question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);
  return (
    [...context.instructions]
      .map((instruction) => ({
        instruction,
        score: tokens.filter((token) =>
          `${instruction.title} ${instruction.guidance}`
            .toLowerCase()
            .includes(token)
        ).length
      }))
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.instruction.id.localeCompare(right.instruction.id)
      )
      .find(({ score }) => score > 0)?.instruction ??
    context.instructions[0] ??
    null
  );
}

function ruleForQuestion(
  context: Readonly<AuthoredCoachWorkflowContext>,
  question: string,
  instruction: AuthoredCoachWorkflowContext["instructions"][number] | null
): Readonly<WorkflowRule> | null {
  if (!instruction) return null;
  const related = context.rules.filter(({ id }) =>
    instruction.relatedRuleIds.includes(id)
  );
  if (/(?:optional|best practice|have to|required)/i.test(question)) {
    return related.find(({ kind }) => kind === "best_practice") ?? null;
  }
  if (/(?:safe|safety|hazard|danger)/i.test(question)) {
    return related.find(({ severity }) => severity === "safety") ?? null;
  }
  return null;
}

function refusalOutput(): AuthoredCoachModelOutput {
  return {
    shouldRespond: true,
    interventionType: "warning",
    hintLevel: 0,
    message:
      "I can help with this lab and its learning goals, but not that request.",
    guidance: {
      kind: "ai_guidance",
      title: "Lab questions only",
      objectiveIds: [],
      ruleIds: [],
      instructionIds: [],
      evidenceEventIds: [],
      recoveryActionIds: []
    },
    safety: { refused: true, reason: "off_topic_or_unsafe" }
  };
}

function deterministicModelOutput(
  request: Readonly<AuthoredCoachRequest>
): AuthoredCoachModelOutput {
  if (isOffTopic(request.studentQuestion ?? "")) return refusalOutput();
  const context = request.workflowContext;
  const questionInstruction =
    request.triggerPolicy.source === "question"
      ? instructionForQuestion(context, request.studentQuestion ?? "")
      : null;
  const questionRule = ruleForQuestion(
    context,
    request.studentQuestion ?? "",
    questionInstruction
  );
  const currentDiagnosis = selectDiagnosis(request);
  const diagnosis =
    request.triggerPolicy.source === "question" &&
    questionRule &&
    currentDiagnosis?.severity !== "safety"
      ? null
      : currentDiagnosis;
  const authoredTrigger = diagnosis
    ? null
    : selectAuthoredTriggerMatch(request);
  if (
    !diagnosis &&
    !authoredTrigger &&
    request.triggerPolicy.source !== "question"
  ) {
    return silentOutput();
  }

  const rule = diagnosis
    ? (context.rules.find(({ id }) => id === diagnosis.ruleId) ?? null)
    : (authoredTrigger?.rule ?? questionRule);
  const instruction = rule
    ? (context.instructions.find(({ relatedRuleIds }) =>
        relatedRuleIds.includes(rule.id)
      ) ?? null)
    : questionInstruction;
  const relatedRuleIds = rule
    ? [rule.id]
    : (instruction?.relatedRuleIds.slice(0, 4) ?? []);
  const availableActionIds = new Set(
    context.availableActions.map(({ actionId }) => actionId)
  );
  const recoveryActionIds = rule
    ? unique(actionIdsForRule(rule, context.rules)).filter((actionId) =>
        availableActionIds.has(actionId)
      )
    : [];
  const kind = rule ? guidanceKindForRule(rule) : "ai_guidance";
  const title =
    instruction?.title ??
    (kind === "safety"
      ? "Safety check"
      : kind === "mandatory_procedure"
        ? "Required lab step"
        : kind === "optional_context"
          ? "Helpful context"
          : "Coach guidance");
  const baseGuidance =
    instruction?.guidance ??
    "Review the highlighted lab evidence and the available controls before choosing your next step.";
  const prefix =
    kind === "safety"
      ? "Pause for this safety check: "
      : kind === "mandatory_procedure"
        ? "This procedure step is required: "
        : kind === "optional_context"
          ? "This is helpful, but not required: "
          : "Use this lab guidance: ";
  const evidenceEventIds =
    diagnosis?.evidenceEventIds ?? authoredTrigger?.evidenceEventIds ?? [];

  return {
    shouldRespond: true,
    interventionType: kind === "safety" ? "warning" : "hint",
    hintLevel: Math.min(1, request.triggerPolicy.maxHintLevel),
    message: `${prefix}${baseGuidance}`,
    guidance: {
      kind,
      title,
      objectiveIds: [
        ...(diagnosis?.objectiveIds ??
          authoredTrigger?.objectiveIds ??
          rule?.objectiveIds ??
          context.activeObjectiveIds.slice(0, 4))
      ],
      ruleIds: relatedRuleIds,
      instructionIds: instruction ? [instruction.id] : [],
      evidenceEventIds: [...evidenceEventIds],
      recoveryActionIds
    },
    safety: { refused: false, reason: null }
  };
}

/**
 * Drop citations the deterministic context never supplied, keeping the answer.
 *
 * This used to throw, which discarded the model's entire response and served
 * the current step's authored instruction in its place. One unrecognised id in
 * a citation array was enough, so a correct answer to a direct question —
 * "what happens if I didn't tare" — came back as an unrelated restatement of
 * the next step, badged "From the lab steps". All-or-nothing rejection made a
 * citation problem look like a comprehension problem.
 *
 * Stripping is the conservative repair: it can only ever remove a claim of
 * support, never add one. `evidenceEventTypes` on the response is derived from
 * the surviving evidence ids, so a repaired answer cites strictly less than the
 * model asked for and never something the engine did not supply.
 *
 * What is removed is returned rather than swallowed, so the caller can report
 * it — a model that routinely invents ids is a prompt defect, and silently
 * rewriting its citations would hide that.
 */
function groundModelReferences(
  request: Readonly<AuthoredCoachRequest>,
  output: Readonly<AuthoredCoachModelOutput>
): {
  readonly output: AuthoredCoachModelOutput;
  readonly droppedReferences: readonly string[];
} {
  if (!output.shouldRespond || !output.guidance) {
    return { output, droppedReferences: [] };
  }
  const context = request.workflowContext;
  const supported = {
    objectiveIds: new Set(context.activeObjectiveIds),
    ruleIds: new Set(context.rules.map(({ id }) => id)),
    instructionIds: new Set(context.instructions.map(({ id }) => id)),
    evidenceEventIds: new Set(context.evidence.map(({ eventId }) => eventId)),
    recoveryActionIds: new Set(
      context.availableActions.map(({ actionId }) => actionId)
    )
  } as const;

  const dropped: string[] = [];
  const keep = (field: keyof typeof supported): string[] => {
    const values = output.guidance?.[field] ?? [];
    return values.filter((value) => {
      if (supported[field].has(value)) return true;
      dropped.push(`${field}:${value}`);
      return false;
    });
  };

  const guidance = {
    ...output.guidance,
    objectiveIds: keep("objectiveIds"),
    ruleIds: keep("ruleIds"),
    instructionIds: keep("instructionIds"),
    evidenceEventIds: keep("evidenceEventIds"),
    recoveryActionIds: keep("recoveryActionIds")
  };

  return {
    output: dropped.length === 0 ? output : { ...output, guidance },
    droppedReferences: dropped
  };
}

/**
 * The guards that survive repair. Unlike an invented citation, none of these
 * can be fixed by removing something: an unsolicited intervention untied to a
 * violation has no business being shown at all, and safety guidance carrying
 * the wrong label misrepresents the hazard.
 */
function assertGroundedIntervention(
  request: Readonly<AuthoredCoachRequest>,
  output: Readonly<AuthoredCoachModelOutput>
): void {
  if (!output.shouldRespond || !output.guidance) return;
  const context = request.workflowContext;
  const violatedRuleIds = new Set(
    context.diagnoses
      .filter(({ status }) => status === "violated")
      .map(({ ruleId }) => ruleId)
  );
  if (
    request.triggerPolicy.source === "event" &&
    violatedRuleIds.size > 0 &&
    !output.guidance.ruleIds.some((ruleId) => violatedRuleIds.has(ruleId))
  ) {
    throw new TypeError(
      "Unsolicited Coach output is not tied to a current violation."
    );
  }
  if (
    request.triggerPolicy.source === "event" &&
    violatedRuleIds.size === 0 &&
    (!selectAuthoredTriggerMatch(request) ||
      output.guidance.evidenceEventIds.length === 0)
  ) {
    throw new TypeError(
      "Unsolicited Coach output is not tied to an authored evidence trigger."
    );
  }
  const citedRules = output.guidance.ruleIds.flatMap((ruleId) => {
    const rule = context.rules.find(({ id }) => id === ruleId);
    return rule ? [rule] : [];
  });
  if (
    citedRules.some(({ severity }) => severity === "safety") &&
    output.guidance.kind !== "safety"
  ) {
    throw new TypeError("Safety guidance must be labeled as safety.");
  }
}

function assertNoProhibitedClaims(output: Readonly<AuthoredCoachModelOutput>) {
  if (
    /(?:pH|equivalence point|concentration|molarity|precipitate|heat flow)\s*(?:is|=|of)\s*[-+]?\d/i.test(
      output.message
    ) ||
    /(?:reset|rewind)\s+(?:the\s+)?(?:checkpoint|simulation|lab)|(?:add|remove|delete|change)\s+(?:a\s+|the\s+)?(?:workflow\s+)?rule/i.test(
      output.message
    )
  ) {
    throw new TypeError(
      "Coach output attempted to invent chemistry or control runtime/workflow state."
    );
  }
}

function validateModelOutput(
  request: Readonly<AuthoredCoachRequest>,
  candidate: unknown,
  deterministic: Readonly<AuthoredCoachModelOutput>
): AuthoredCoachModelOutput {
  const parsed = authoredCoachModelOutputSchema.parse(candidate);
  if (parsed.hintLevel > request.triggerPolicy.maxHintLevel) {
    throw new TypeError("Coach model exceeded the deterministic hint limit.");
  }
  if (deterministic.shouldRespond && !parsed.shouldRespond) {
    throw new TypeError("Coach model ignored an authorized intervention.");
  }
  /*
   * Repair citations first, then judge the repaired answer. Running the
   * remaining guards against the original would let a response qualify on the
   * strength of a reference that is about to be removed.
   */
  const { output, droppedReferences } = groundModelReferences(request, parsed);
  if (droppedReferences.length > 0) {
    console.warn("coach.grounding.references_dropped", {
      definitionId: request.workflowContext.definition.id,
      source: request.triggerPolicy.source,
      droppedReferences: droppedReferences.slice(0, 32)
    });
  }
  assertGroundedIntervention(request, output);
  assertNoProhibitedClaims(output);
  return output;
}

function responseFromOutput(
  request: Readonly<AuthoredCoachRequest>,
  output: Readonly<AuthoredCoachModelOutput>,
  metadata: {
    readonly model: string;
    readonly mode: "live" | "deterministic_fallback";
    readonly fallbackReason:
      | "deterministic_configured"
      | "model_unavailable"
      | "model_output_invalid"
      | null;
  }
): AuthoredCoachResponse {
  const guidance = output.guidance;
  const evidence = new Map(
    request.workflowContext.evidence.map((event) => [event.eventId, event])
  );
  return authoredCoachResponseSchema.parse({
    ok: true,
    contractVersion: AUTHORED_COACH_CONTRACT_VERSION,
    shouldRespond: output.shouldRespond,
    interventionType: output.interventionType,
    skillIds: guidance?.objectiveIds ?? [],
    hintLevel: output.hintLevel,
    message: output.message,
    evidenceEventTypes: unique(
      (guidance?.evidenceEventIds ?? []).flatMap((eventId) => {
        const event = evidence.get(eventId);
        return event ? [event.payload.type] : [];
      })
    ),
    guidance,
    safety: output.safety,
    authority: {
      kind: "advisory",
      simulationStateChanged: false,
      canResetCheckpoint: false,
      canChangeWorkflowRules: false
    },
    metadata: {
      outputVersion: AUTHORED_COACH_OUTPUT_VERSION,
      coachVersion: AUTHORED_COACH_VERSION,
      promptVersion: AUTHORED_COACH_PROMPT_VERSION,
      model: metadata.model,
      mode: metadata.mode,
      fallbackReason: metadata.fallbackReason,
      definitionId: request.workflowContext.definition.id,
      definitionRevision: request.workflowContext.definition.revision,
      definitionHash: request.workflowContext.definitionHash
    }
  });
}

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Coach model timed out.")),
          timeoutMs
        );
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function generateAuthoredCoachResponse(
  input: Readonly<AuthoredCoachRequest>,
  options: GenerateAuthoredCoachOptions = {}
): Promise<AuthoredCoachResponse> {
  const request = authoredCoachRequestSchema.parse(input);
  assertRequest(request);
  const deterministic = deterministicModelOutput(request);

  // Routine success is decided locally and never incurs a model call.
  if (!deterministic.shouldRespond) {
    return responseFromOutput(request, deterministic, {
      model: AUTHORED_COACH_FALLBACK_MODEL,
      mode: "deterministic_fallback",
      fallbackReason: "deterministic_configured"
    });
  }
  if (!options.model) {
    return responseFromOutput(request, deterministic, {
      model: AUTHORED_COACH_FALLBACK_MODEL,
      mode: "deterministic_fallback",
      fallbackReason: "deterministic_configured"
    });
  }

  let candidate: unknown;
  try {
    candidate = await withTimeout(
      options.model.respond(request),
      options.modelTimeoutMs ?? AUTHORED_COACH_MODEL_TIMEOUT_MS
    );
  } catch (error) {
    /*
     * Both fallback paths used to swallow the error entirely. The student saw
     * an unrelated lab step and no operator could tell whether the model had
     * timed out, been rejected, or never been called — which is precisely how
     * a citation bug went unnoticed while looking like a bad coach.
     */
    console.warn("coach.model_unavailable", {
      definitionId: request.workflowContext.definition.id,
      reason: error instanceof Error ? error.message : "unknown error"
    });
    return responseFromOutput(request, deterministic, {
      model: AUTHORED_COACH_FALLBACK_MODEL,
      mode: "deterministic_fallback",
      fallbackReason: "model_unavailable"
    });
  }
  try {
    return responseFromOutput(
      request,
      validateModelOutput(request, candidate, deterministic),
      {
        model: options.model.model,
        mode: "live",
        fallbackReason: null
      }
    );
  } catch (error) {
    console.warn("coach.model_output_invalid", {
      definitionId: request.workflowContext.definition.id,
      source: request.triggerPolicy.source,
      reason: error instanceof Error ? error.message : "unknown error"
    });
    return responseFromOutput(request, deterministic, {
      model: AUTHORED_COACH_FALLBACK_MODEL,
      mode: "deterministic_fallback",
      fallbackReason: "model_output_invalid"
    });
  }
}

function isOffTopic(question: string): boolean {
  return /(?:weapon|hurt someone|cheat|password|celebrity|sports score|write malware)/i.test(
    question
  );
}
