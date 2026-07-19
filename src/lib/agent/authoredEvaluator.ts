import { configurationRegistry } from "../../lab-workflows/registries/configurations";
import { eventTypeRegistry } from "../../lab-workflows/registries/event-flags";
import type { GenericLabState } from "../../lab-workflows/runtime";
import type {
  RubricCriterionSpecV2,
  RubricEvidenceMapping
} from "../../lab-workflows/schema/conditions";
import type { ValidatedLabWorkflowSpecV2 } from "../../lab-workflows/schema/v2";
import {
  evaluateLabWorkflowEligibilityV2,
  WORKFLOW_ELIGIBILITY_FAILURE_CODES_V2
} from "../../lab-workflows/validation";
import {
  AUTHORED_EVALUATOR_PROMPT_VERSION,
  AUTHORED_EVALUATOR_VERSION
} from "./authoredEvaluatorPrompt";
import {
  AUTHORED_EVALUATOR_CONTRACT_VERSION,
  AUTHORED_EVALUATOR_OUTPUT_VERSION,
  authoredEvaluateRequestSchema,
  authoredEvaluationResponseSchema,
  authoredEvaluatorModelOutputSchema,
  type AuthoredEvaluateRequest,
  type AuthoredEvaluationErrorCode,
  type AuthoredEvaluationResponse,
  type AuthoredEvaluatorModelOutput,
  type AuthoredWorkflowStudentResponse,
  type ReportText
} from "./evaluatorSchemas";

export const AUTHORED_EVALUATOR_FALLBACK_MODEL =
  "deterministic-authored-rubric-v2" as const;

export interface AuthoredEvaluatorModel {
  readonly model: string;
  evaluate(request: Readonly<AuthoredEvaluateRequest>): Promise<unknown>;
}

export interface EvaluateAuthoredReportOptions {
  readonly model?: AuthoredEvaluatorModel;
  readonly evaluatedAt?: string;
}

export interface CreateAuthoredEvaluationRequestInput {
  readonly sessionId: string;
  readonly experimentId: string;
  readonly assignedDefinition: Readonly<ValidatedLabWorkflowSpecV2>;
  readonly runtimeState: Readonly<GenericLabState>;
  readonly report: Readonly<ReportText>;
  readonly workflowResponses?: readonly Omit<
    AuthoredWorkflowStudentResponse,
    "evidenceId"
  >[];
}

interface EvidenceResolution {
  readonly found: boolean;
  readonly positive: boolean;
  readonly evidenceIds: readonly string[];
}

export class AuthoredEvaluationInputError extends Error {
  readonly code: AuthoredEvaluationErrorCode;
  readonly fieldPaths: readonly string[];
  readonly status: number;

  constructor(
    code: AuthoredEvaluationErrorCode,
    message: string,
    fieldPaths: readonly string[],
    status = 422
  ) {
    super(message);
    this.name = "AuthoredEvaluationInputError";
    this.code = code;
    this.fieldPaths = Object.freeze([...fieldPaths]);
    this.status = status;
  }
}

function fail(
  code: AuthoredEvaluationErrorCode,
  message: string,
  fieldPaths: readonly string[],
  status = 422
): never {
  throw new AuthoredEvaluationInputError(code, message, fieldPaths, status);
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function sortPairs(values: readonly (readonly [string, string])[]) {
  return [...values].sort(
    ([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)
  );
}

function reportEvidenceIds(request: Readonly<AuthoredEvaluateRequest>) {
  return Object.values(request.report).map(({ evidenceId }) => evidenceId);
}

function allEvidenceIds(
  request: Readonly<AuthoredEvaluateRequest>
): Set<string> {
  return new Set([
    ...request.runtimeState.eventEnvelopes.map(({ eventId }) => eventId),
    ...request.diagnosisEvidence.map(({ evidenceId }) => evidenceId),
    ...request.observableEvidence.map(({ evidenceId }) => evidenceId),
    ...request.workflowResponses.map(({ evidenceId }) => evidenceId),
    ...reportEvidenceIds(request)
  ]);
}

function assertEvidenceIdsAreUnique(
  request: Readonly<AuthoredEvaluateRequest>
): void {
  const ids = [
    ...request.runtimeState.eventEnvelopes.map(({ eventId }) => eventId),
    ...request.diagnosisEvidence.map(({ evidenceId }) => evidenceId),
    ...request.observableEvidence.map(({ evidenceId }) => evidenceId),
    ...request.workflowResponses.map(({ evidenceId }) => evidenceId),
    ...reportEvidenceIds(request)
  ];
  if (new Set(ids).size !== ids.length)
    fail(
      "evaluator.unsupported_evidence.v2",
      "Evaluation evidence IDs must be unique.",
      ["evidence"]
    );
}

function assertCurrentDefinition(
  request: Readonly<AuthoredEvaluateRequest>
): void {
  const definition = request.assignedDefinition;
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
      stale ? "evaluator.stale_definition.v2" : "evaluator.invalid_request.v2",
      stale
        ? "The assigned lab definition no longer matches its deterministic validation."
        : "Only a current runnable lab definition can be evaluated.",
      ["assignedDefinition"],
      stale ? 409 : 422
    );
  }
}

function assertRuntimeProvenance(
  request: Readonly<AuthoredEvaluateRequest>
): void {
  const definition = request.assignedDefinition;
  const state = request.runtimeState;
  const provenance = state.provenance;
  const artifact = definition.validation;
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
    request.sessionId !== state.sessionId ||
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
    fail(
      "evaluator.runtime_provenance_mismatch.v2",
      "Runtime evidence does not belong to the exact assigned lab definition.",
      ["runtimeState.provenance"],
      409
    );
  }
}

function assertEvidence(request: Readonly<AuthoredEvaluateRequest>): void {
  assertEvidenceIdsAreUnique(request);
  const definition = request.assignedDefinition;
  const state = request.runtimeState;
  const ruleById = new Map(definition.rules.map((rule) => [rule.id, rule]));
  const objectiveIds = new Set(definition.objectiveIds);
  const permissionById = new Map(
    definition.permittedActions.map((permission) => [permission.id, permission])
  );
  const eventIds = new Set(state.eventEnvelopes.map(({ eventId }) => eventId));
  const semanticEventTypes = new Set<string>(
    eventTypeRegistry.list().map(({ semanticEventType }) => semanticEventType)
  );

  state.eventEnvelopes.forEach((event, index) => {
    const permission = permissionById.get(event.normalizedAction.permissionId);
    if (
      !permission ||
      permission.actionId !== event.normalizedAction.actionId ||
      !semanticEventTypes.has(event.payload.type) ||
      event.ruleEvidenceIds.some((ruleId) => !ruleById.has(ruleId))
    ) {
      fail(
        "evaluator.unsupported_evidence.v2",
        "An event does not resolve to this lab's registered action and rules.",
        [`runtimeState.eventEnvelopes[${index}]`]
      );
    }
  });

  if (request.diagnosisEvidence.length !== state.diagnoses.length)
    fail(
      "evaluator.unsupported_evidence.v2",
      "Diagnosis evidence must exactly cover the final runtime diagnoses.",
      ["diagnosisEvidence"]
    );
  request.diagnosisEvidence.forEach(({ diagnosis }, index) => {
    const runtimeDiagnosis = state.diagnoses.find(
      ({ ruleId }) => ruleId === diagnosis.ruleId
    );
    if (
      !runtimeDiagnosis ||
      !sameJson(runtimeDiagnosis, diagnosis) ||
      !ruleById.has(diagnosis.ruleId) ||
      diagnosis.objectiveIds.some(
        (objectiveId) => !objectiveIds.has(objectiveId)
      ) ||
      diagnosis.evidenceEventIds.some((eventId) => !eventIds.has(eventId))
    ) {
      fail(
        "evaluator.unsupported_evidence.v2",
        "A diagnosis is not exact final evidence for this lab.",
        [`diagnosisEvidence[${index}]`]
      );
    }
  });

  if (request.observableEvidence.length !== state.chemistry.observables.length)
    fail(
      "evaluator.unsupported_evidence.v2",
      "Observable evidence must exactly cover the final runtime observables.",
      ["observableEvidence"]
    );
  request.observableEvidence.forEach(({ evidenceId, ...observable }, index) => {
    void evidenceId;
    const runtimeObservable = state.chemistry.observables.find(
      ({ observableId }) => observableId === observable.observableId
    );
    const configuration = configurationRegistry.has(observable.observableId)
      ? configurationRegistry.get(observable.observableId)
      : null;
    if (
      !runtimeObservable ||
      !sameJson(runtimeObservable, observable) ||
      configuration?.category !== "observable"
    ) {
      fail(
        "evaluator.unsupported_evidence.v2",
        "An observable is not exact registered final evidence.",
        [`observableEvidence[${index}]`]
      );
    }
  });

  const supportedSubmissionIds = new Set(
    definition.rubric.criteria.flatMap((criterion) =>
      criterion.evidenceMappings.flatMap((mapping) =>
        mapping.kind === "student_response" ? [mapping.submissionFieldId] : []
      )
    )
  );
  request.workflowResponses.forEach(({ submissionFieldId }, index) => {
    const configuration = configurationRegistry.has(submissionFieldId)
      ? configurationRegistry.get(submissionFieldId)
      : null;
    if (
      configuration?.category !== "submission_field" ||
      !supportedSubmissionIds.has(submissionFieldId)
    ) {
      fail(
        "evaluator.unsupported_evidence.v2",
        "A student response is not registered by the assigned rubric.",
        [`workflowResponses[${index}].submissionFieldId`]
      );
    }
  });
}

function assertRequest(request: Readonly<AuthoredEvaluateRequest>): void {
  assertCurrentDefinition(request);
  assertRuntimeProvenance(request);
  assertEvidence(request);
}

function eventEvidence(
  request: Readonly<AuthoredEvaluateRequest>,
  eventTypeId: string,
  observationAdapterKey?: string
): readonly string[] {
  const registered = eventTypeRegistry.get(eventTypeId);
  return request.runtimeState.eventEnvelopes
    .filter(
      ({ payload }) =>
        payload.type === registered.semanticEventType &&
        (observationAdapterKey === undefined ||
          Object.hasOwn(payload.observation, observationAdapterKey))
    )
    .map(({ eventId }) => eventId);
}

function mappingEvidence(
  request: Readonly<AuthoredEvaluateRequest>,
  mapping: Readonly<RubricEvidenceMapping>
): EvidenceResolution {
  switch (mapping.kind) {
    case "rule_diagnosis": {
      const evidence = request.diagnosisEvidence.find(
        ({ diagnosis }) => diagnosis.ruleId === mapping.ruleId
      );
      return {
        found: evidence !== undefined,
        positive: evidence?.diagnosis.status === "satisfied",
        evidenceIds: evidence ? [evidence.evidenceId] : []
      };
    }
    case "semantic_event": {
      const ids = eventEvidence(request, mapping.eventTypeId);
      return {
        found: ids.length > 0,
        positive: ids.length > 0,
        evidenceIds: ids
      };
    }
    case "semantic_event_observation": {
      const configuration = configurationRegistry.get(mapping.observationKeyId);
      const observationAdapterKey = configuration.adapterKey;
      if (!observationAdapterKey)
        throw new TypeError(
          "Registered observation evidence is missing its adapter key."
        );
      const ids = mapping.eventTypeId
        ? eventEvidence(request, mapping.eventTypeId, observationAdapterKey)
        : request.runtimeState.eventEnvelopes
            .filter(({ payload }) =>
              Object.hasOwn(payload.observation, observationAdapterKey)
            )
            .map(({ eventId }) => eventId);
      return {
        found: ids.length > 0,
        positive: ids.length > 0,
        evidenceIds: ids
      };
    }
    case "observable": {
      const evidence = request.observableEvidence.find(
        ({ observableId }) => observableId === mapping.observableId
      );
      return {
        found: evidence !== undefined,
        positive: evidence !== undefined,
        evidenceIds: evidence ? [evidence.evidenceId] : []
      };
    }
    case "student_response": {
      const response = request.workflowResponses.find(
        ({ submissionFieldId }) =>
          submissionFieldId === mapping.submissionFieldId
      );
      return {
        found: response !== undefined,
        positive: response !== undefined,
        evidenceIds: response ? [response.evidenceId] : []
      };
    }
  }
}

function criterionEvidence(
  request: Readonly<AuthoredEvaluateRequest>,
  criterion: Readonly<RubricCriterionSpecV2>
) {
  const mappings = criterion.evidenceMappings.map((mapping) => ({
    mapping,
    resolution: mappingEvidence(request, mapping)
  }));
  const diagnosisEvidence = request.diagnosisEvidence.filter(({ diagnosis }) =>
    criterion.ruleIds.includes(diagnosis.ruleId)
  );
  const rules = criterion.ruleIds.flatMap((ruleId) => {
    const rule = request.assignedDefinition.rules.find(
      ({ id }) => id === ruleId
    );
    return rule ? [rule] : [];
  });
  const violated = diagnosisEvidence.filter(
    ({ diagnosis }) => diagnosis.status === "violated"
  );
  const nonRecoverableViolation = violated.some(({ diagnosis }) => {
    const rule = rules.find(({ id }) => id === diagnosis.ruleId);
    return (
      !diagnosis.recoverable ||
      rule?.terminal === true ||
      diagnosis.severity === "safety"
    );
  });
  const recoverableViolation = violated.some(
    ({ diagnosis }) => diagnosis.recoverable
  );
  return {
    mappings,
    diagnosisEvidence,
    nonRecoverableViolation,
    recoverableViolation,
    evidenceIds: unique([
      ...mappings.flatMap(({ resolution }) => resolution.evidenceIds),
      ...diagnosisEvidence.map(({ evidenceId }) => evidenceId),
      ...reportEvidenceIds(request)
    ])
  };
}

function rounded(value: number): number {
  return Math.round(value * 100) / 100;
}

function performance(score: number, maximum: number) {
  const ratio = maximum === 0 ? 1 : score / maximum;
  if (ratio >= 0.8) return "mastered" as const;
  if (ratio >= 0.4) return "developing" as const;
  return "not_demonstrated" as const;
}

function deterministicModelOutput(
  request: Readonly<AuthoredEvaluateRequest>
): AuthoredEvaluatorModelOutput {
  const criteria = request.assignedDefinition.rubric.criteria.map(
    (criterion) => {
      const evidence = criterionEvidence(request, criterion);
      const required = evidence.mappings.filter(
        ({ mapping }) => mapping.required
      );
      const requiredFound = required.filter(
        ({ resolution }) => resolution.found && resolution.positive
      ).length;
      const allRequired = requiredFound === required.length;
      const anyMapped = evidence.mappings.some(
        ({ resolution }) => resolution.found
      );
      let score: number;
      if (evidence.nonRecoverableViolation) score = 0;
      else if (allRequired && !evidence.recoverableViolation)
        score = criterion.maxPoints;
      else if (anyMapped) {
        const requiredRatio =
          required.length === 0 ? 0.6 : requiredFound / required.length;
        score = rounded(
          criterion.maxPoints *
            Math.min(
              evidence.recoverableViolation ? 0.6 : 0.75,
              Math.max(0.25, requiredRatio)
            )
        );
      } else score = 0;

      const feedback = evidence.nonRecoverableViolation
        ? "Final deterministic evidence contains a non-recoverable violation tied to this grading item."
        : allRequired && !evidence.recoverableViolation
          ? "The final deterministic evidence satisfies every required mapping for this grading item, including valid alternate approaches."
          : "Some required evidence is missing or remains recoverably violated; review the cited work before resubmitting.";
      return {
        criterionId: criterion.id,
        score,
        feedback,
        evidenceIds: evidence.evidenceIds
      };
    }
  );
  const claims = criteria.map((criterion) => {
    const rubricCriterion = request.assignedDefinition.rubric.criteria.find(
      ({ id }) => id === criterion.criterionId
    )!;
    const evidence = criterionEvidence(request, rubricCriterion);
    const conceptualViolation = evidence.diagnosisEvidence.some(
      ({ diagnosis }) =>
        diagnosis.status === "violated" && diagnosis.severity === "conceptual"
    );
    const mastered = criterion.score === rubricCriterion.maxPoints;
    return {
      kind: mastered
        ? ("strength" as const)
        : conceptualViolation
          ? ("misconception" as const)
          : ("growth_area" as const),
      statement: mastered
        ? "The supplied evidence demonstrates this authored objective, regardless of the valid action order used."
        : conceptualViolation
          ? "A deterministic conceptual diagnosis shows that this part of the work was not demonstrated."
          : "The supplied evidence shows incomplete or recoverable work; the fallback does not infer a misconception from missing evidence alone.",
      evidenceIds: criterion.evidenceIds
    };
  });
  const missingRequired = request.assignedDefinition.rubric.criteria.some(
    (criterion) =>
      criterionEvidence(request, criterion).mappings.some(
        ({ mapping, resolution }) => mapping.required && !resolution.found
      )
  );
  const reportIds = reportEvidenceIds(request);
  return authoredEvaluatorModelOutputSchema.parse({
    criteria,
    claims,
    overallSummary:
      "This deterministic fallback applies the assigned grading evidence exactly. Written nuance should be reviewed by the teacher when model feedback is unavailable.",
    overallEvidenceIds: unique([
      ...criteria.flatMap(({ evidenceIds }) => evidenceIds),
      ...reportIds
    ]),
    uncertainty: {
      level: missingRequired ? "high" : "medium",
      explanation: missingRequired
        ? "Required authored evidence is absent, so the fallback cannot infer it from prose."
        : "The fallback can score registered evidence but does not make a semantic judgment about every nuance of the writing.",
      evidenceIds: reportIds
    }
  });
}

const PROHIBITED_CHEMISTRY_CLAIM =
  /\b(?:calculated|computed|reconstructed|inferred)\s+(?:the\s+)?(?:pH|concentration|equivalence(?:\s+point)?|precipitate(?:\s+identity)?|heat(?:\s+flow)?)\b|\bpH\s*(?:is|=)\s*[-+]?\d/i;

function outputText(output: Readonly<AuthoredEvaluatorModelOutput>): string {
  return [
    ...output.criteria.map(({ feedback }) => feedback),
    ...output.claims.map(({ statement }) => statement),
    output.overallSummary,
    output.uncertainty.explanation
  ].join("\n");
}

function validateModelOutput(
  request: Readonly<AuthoredEvaluateRequest>,
  candidate: unknown
): AuthoredEvaluatorModelOutput {
  const output = authoredEvaluatorModelOutputSchema.parse(candidate);
  const rubric = request.assignedDefinition.rubric;
  const criterionIds = output.criteria.map(({ criterionId }) => criterionId);
  if (
    output.criteria.length !== rubric.criteria.length ||
    new Set(criterionIds).size !== criterionIds.length ||
    rubric.criteria.some(({ id }) => !criterionIds.includes(id))
  )
    throw new TypeError(
      "Model criterion results do not match the assigned rubric."
    );

  const globallyAllowed = allEvidenceIds(request);
  const deterministicCeilings = new Map(
    deterministicModelOutput(request).criteria.map(({ criterionId, score }) => [
      criterionId,
      score
    ])
  );
  const assertAllowed = (ids: readonly string[]) => {
    if (ids.some((id) => !globallyAllowed.has(id)))
      throw new TypeError("Model output cites unsupported evidence.");
  };
  output.criteria.forEach((result) => {
    const criterion = rubric.criteria.find(
      ({ id }) => id === result.criterionId
    )!;
    const locallyAllowed = new Set(
      criterionEvidence(request, criterion).evidenceIds
    );
    if (
      result.score > criterion.maxPoints ||
      result.score > (deterministicCeilings.get(result.criterionId) ?? 0) ||
      result.evidenceIds.some((id) => !locallyAllowed.has(id))
    )
      throw new TypeError("Model criterion result exceeds authored authority.");
  });
  output.claims.forEach(({ evidenceIds }) => assertAllowed(evidenceIds));
  assertAllowed(output.overallEvidenceIds);
  assertAllowed(output.uncertainty.evidenceIds);
  if (PROHIBITED_CHEMISTRY_CLAIM.test(outputText(output)))
    throw new TypeError(
      "Model output attempts to reconstruct chemistry truth."
    );
  return output;
}

function responseFromOutput(
  request: Readonly<AuthoredEvaluateRequest>,
  output: Readonly<AuthoredEvaluatorModelOutput>,
  metadata: {
    readonly model: string;
    readonly mode: "live" | "deterministic_fallback";
    readonly fallbackReason:
      | "deterministic_configured"
      | "model_unavailable"
      | "model_output_invalid"
      | null;
    readonly evaluatedAt: string;
  }
): AuthoredEvaluationResponse {
  const criteria = request.assignedDefinition.rubric.criteria.map(
    (criterion) => {
      const result = output.criteria.find(
        ({ criterionId }) => criterionId === criterion.id
      )!;
      return {
        ...result,
        objectiveIds: criterion.objectiveIds,
        maxPoints: criterion.maxPoints,
        performance: performance(result.score, criterion.maxPoints)
      };
    }
  );
  return authoredEvaluationResponseSchema.parse({
    ok: true,
    contractVersion: AUTHORED_EVALUATOR_CONTRACT_VERSION,
    metadata: {
      outputVersion: AUTHORED_EVALUATOR_OUTPUT_VERSION,
      evaluatorVersion: AUTHORED_EVALUATOR_VERSION,
      promptVersion: AUTHORED_EVALUATOR_PROMPT_VERSION,
      model: metadata.model,
      mode: metadata.mode,
      fallbackReason: metadata.fallbackReason,
      evaluatedAt: metadata.evaluatedAt,
      definitionId: request.assignedDefinition.id,
      definitionRevision: request.assignedDefinition.revision,
      definitionHash: request.assignedDefinition.validation.canonicalSpecHash,
      validatorVersion: request.assignedDefinition.validation.validatorVersion,
      rubricId: request.assignedDefinition.rubric.id,
      rubricVersion: request.assignedDefinition.rubric.version
    },
    result: {
      criteria,
      earnedPoints: rounded(
        criteria.reduce((sum, criterion) => sum + criterion.score, 0)
      ),
      possiblePoints: request.assignedDefinition.rubric.totalPoints,
      claims: output.claims,
      overallSummary: output.overallSummary,
      overallEvidenceIds: output.overallEvidenceIds,
      uncertainty: output.uncertainty
    }
  });
}

export function createAuthoredEvaluationRequest(
  input: CreateAuthoredEvaluationRequestInput
): AuthoredEvaluateRequest {
  return authoredEvaluateRequestSchema.parse({
    contractVersion: AUTHORED_EVALUATOR_CONTRACT_VERSION,
    sessionId: input.sessionId,
    experimentId: input.experimentId,
    assignedDefinition: input.assignedDefinition,
    runtimeState: input.runtimeState,
    diagnosisEvidence: input.runtimeState.diagnoses.map((diagnosis) => ({
      evidenceId: `diagnosis.${diagnosis.ruleId}`,
      diagnosis
    })),
    observableEvidence: input.runtimeState.chemistry.observables.map(
      (observable) => ({
        evidenceId: `observable.${observable.observableId}`,
        ...observable
      })
    ),
    workflowResponses: (input.workflowResponses ?? []).map(
      (response, index) => ({
        evidenceId: `response.${response.submissionFieldId}.${index + 1}`,
        ...response
      })
    ),
    report: {
      procedureSummary: {
        evidenceId: "report.procedure_summary",
        text: input.report.procedureSummary
      },
      dataAnalysis: {
        evidenceId: "report.data_analysis",
        text: input.report.dataAnalysis
      },
      conceptExplanation: {
        evidenceId: "report.concept_explanation",
        text: input.report.conceptExplanation
      },
      sourcesOfError: {
        evidenceId: "report.sources_of_error",
        text: input.report.sourcesOfError
      }
    }
  });
}

export async function evaluateAuthoredReport(
  input: Readonly<AuthoredEvaluateRequest>,
  options: EvaluateAuthoredReportOptions = {}
): Promise<AuthoredEvaluationResponse> {
  const request = authoredEvaluateRequestSchema.parse(input);
  assertRequest(request);
  const evaluatedAt = options.evaluatedAt ?? new Date().toISOString();
  if (!options.model) {
    return responseFromOutput(request, deterministicModelOutput(request), {
      model: AUTHORED_EVALUATOR_FALLBACK_MODEL,
      mode: "deterministic_fallback",
      fallbackReason: "deterministic_configured",
      evaluatedAt
    });
  }

  let candidate: unknown;
  try {
    candidate = await options.model.evaluate(request);
  } catch {
    return responseFromOutput(request, deterministicModelOutput(request), {
      model: AUTHORED_EVALUATOR_FALLBACK_MODEL,
      mode: "deterministic_fallback",
      fallbackReason: "model_unavailable",
      evaluatedAt
    });
  }
  try {
    return responseFromOutput(
      request,
      validateModelOutput(request, candidate),
      {
        model: options.model.model,
        mode: "live",
        fallbackReason: null,
        evaluatedAt
      }
    );
  } catch {
    return responseFromOutput(request, deterministicModelOutput(request), {
      model: AUTHORED_EVALUATOR_FALLBACK_MODEL,
      mode: "deterministic_fallback",
      fallbackReason: "model_output_invalid",
      evaluatedAt
    });
  }
}
