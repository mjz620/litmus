import { createHash } from "node:crypto";

import OpenAI, { type APIError } from "openai";

import type { LabDraftCommand } from "../../../lab-workflows/authoring";
import { createBlankLabDraftV2 } from "../../../lab-workflows/definitions/blank-lab";
import { SOLUTION_PREPARATION_AUTHORING_COMMANDS } from "../../../lab-workflows/definitions/solution-preparation";
import { createSolutionPreparationTracePlan } from "../../../lab-workflows/definitions/solution-preparation/tracePlan";
import { hashLabWorkflowSpec } from "../../../lab-workflows/hash";
import {
  createGenericLabActionTrace,
  LabTraceError,
  runGenericTraceSuite,
  type GenericTraceSuiteCaseKind
} from "../../../lab-workflows/replay";
import {
  createCapabilityGenericRuntimePorts,
  createLegacyTitrationRuntimePorts,
  type GenericRuntimePorts,
  type NormalizedLabAction
} from "../../../lab-workflows/runtime";
import {
  labWorkflowDraftV2Schema,
  type LabWorkflowDraftV2,
  type ValidatedLabWorkflowSpecV2
} from "../../../lab-workflows/schema/v2";
import { validateLabWorkflowSpecV2 } from "../../../lab-workflows/validation";
import {
  CAPABILITY_AUTHOR_OUTPUT_SCHEMA_VERSION,
  CAPABILITY_AUTHOR_PROMPT_VERSION,
  CAPABILITY_AUTHOR_TOOL_CONTRACT_VERSION
} from "./capabilityPrompt";
import {
  CAPABILITY_AUTHOR_LIMITS,
  capabilityAuthorErrorResponseSchema,
  capabilityAuthorPlanSchema,
  capabilityAuthorSuccessResponseSchema,
  type CapabilityAuthorDiagnostic,
  type CapabilityAuthorErrorCode,
  type CapabilityAuthorErrorResponse,
  type CapabilityAuthorPlan,
  type CapabilityAuthorProgress,
  type CapabilityAuthorRequest,
  type CapabilityAuthorSuccessResponse,
  type CapabilityAuthorTraceSummary
} from "./capabilityAuthorSchemas";
import { CAPABILITY_AUTHOR_TOOL_LIMITS } from "./capabilitySchemas";
import {
  CAPABILITY_AUTHOR_REGISTRY_SNAPSHOT_IDS,
  CapabilityAuthorToolError,
  createCapabilityAuthorToolSession,
  type CapabilityAuthorToolSession
} from "./capabilityTools";

export class CapabilityAuthoringError extends Error {
  constructor(
    readonly code: CapabilityAuthorErrorCode,
    message: string,
    readonly status: number,
    readonly retryable: boolean,
    readonly fieldPaths: readonly string[] = []
  ) {
    super(message);
    this.name = "CapabilityAuthoringError";
  }
}

export function createCapabilityAuthoringErrorResponse(
  error: CapabilityAuthoringError
): CapabilityAuthorErrorResponse {
  return capabilityAuthorErrorResponseSchema.parse({
    ok: false,
    metadata: {
      contractVersion: "2.0.0",
      promptVersion: CAPABILITY_AUTHOR_PROMPT_VERSION,
      toolContractVersion: CAPABILITY_AUTHOR_TOOL_CONTRACT_VERSION
    },
    error: {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      fieldPaths: [...error.fieldPaths].sort()
    }
  });
}

export interface CapabilityAuthorPlannerContext {
  readonly request: CapabilityAuthorRequest;
  readonly attempt: number;
  readonly diagnostics: readonly CapabilityAuthorDiagnostic[];
  readonly draftSummary: Readonly<{
    schemaVersion: string;
    id: string;
    revision: number;
    draftHash: string;
    supportStatus: string;
  }>;
  readonly modelCallsRemaining: number;
  readonly executeTool: (name: string, args: unknown) => unknown;
  readonly signal: AbortSignal;
}

export interface CapabilityAuthorPlannerRoundResult {
  readonly plan: unknown;
  readonly usage: Readonly<{
    modelCalls: number;
    inputTokens: number;
    outputTokens: number;
  }>;
}

export interface CapabilityAuthorPlanner {
  readonly mode: "live" | "mock";
  readonly model: string;
  runRound(
    context: CapabilityAuthorPlannerContext
  ): Promise<CapabilityAuthorPlannerRoundResult>;
}

export interface RunCapabilityAuthoringOptions {
  readonly planner?: CapabilityAuthorPlanner;
  readonly checkedAt?: string;
  readonly onProgress?: (progress: CapabilityAuthorProgress) => void;
  /** Execution override; public metadata continues to report the fixed limit. */
  readonly timeoutMs?: number;
}

const AUTHOR_PROGRESS = Object.freeze({
  understanding_request: {
    stage: "understanding_request",
    message: "Reading your request and identifying the learning goal."
  },
  checking_available_parts: {
    stage: "checking_available_parts",
    message: "Checking which equipment, materials, and actions are available."
  },
  building_draft: {
    stage: "building_draft",
    message: "Building a draft from supported lab parts."
  },
  checking_lab: {
    stage: "checking_lab",
    message: "Checking safety, compatibility, and required relationships."
  },
  testing_student_paths: {
    stage: "testing_student_paths",
    message: "Testing five student paths in the real simulator."
  },
  using_verified_fallback: {
    stage: "using_verified_fallback",
    message:
      "The live helper could not finish, so Litmus is using its verified local builder."
  },
  finalizing: {
    stage: "finalizing",
    message: "Preparing the proposal for your review."
  }
} satisfies Readonly<
  Record<CapabilityAuthorProgress["stage"], CapabilityAuthorProgress>
>);

const DETERMINISTIC_FALLBACK_TIMEOUT_MS = 4_000;
const DETERMINISTIC_FALLBACK_ERROR_CODES = new Set<CapabilityAuthorErrorCode>([
  "authoring.provider_retryable.v2"
]);

const UNSAFE_OR_OUT_OF_SCOPE_REQUEST_PATTERN =
  /(?:ignore (?:all |the )?(?:previous|prior|system)|invent (?:a |new )?(?:registry|component|action|adapter|model)|validator (?:already )?approved|output (?:code|javascript)|reveal (?:the )?(?:prompt|secret|chain.of.thought)|open flame|bunsen|flame test)/i;

const SOLUTION_PREPARATION_REQUEST_PATTERN =
  /(?:solution preparation|dilution|dilute|volumetric (?:transfer|flask|pipette)|sodium chloride|copper nitrate|copper\(ii\) nitrate|stock solution|fill(?:ing)? to (?:the )?mark|mix(?:ing)? (?:a )?solution)/i;

function requestsVerifiedSolutionPreparation(
  request: CapabilityAuthorRequest
): boolean {
  return (
    SOLUTION_PREPARATION_REQUEST_PATTERN.test(request.teacherRequest) &&
    !UNSAFE_OR_OUT_OF_SCOPE_REQUEST_PATTERN.test(request.teacherRequest)
  );
}

function shouldUseDeterministicFallbackForLiveResult(
  request: CapabilityAuthorRequest,
  result: CapabilityAuthorSuccessResponse
): boolean {
  if (result.metadata.mode !== "live") return false;
  if (!requestsVerifiedSolutionPreparation(request)) return false;
  if (
    result.result.outcome === "rejected_for_safety" ||
    result.result.outcome === "runnable"
  ) {
    return false;
  }
  return true;
}

function fallbackUsageMetadata(
  fallback: CapabilityAuthorSuccessResponse
): CapabilityAuthorSuccessResponse["metadata"] {
  return {
    ...fallback.metadata,
    usage: {
      ...fallback.metadata.usage,
      estimatedCost: {
        currency: "USD",
        amount: null,
        source: "provider_not_priced"
      }
    }
  };
}

function annotateVerifiedFallback(
  fallback: CapabilityAuthorSuccessResponse
): CapabilityAuthorSuccessResponse {
  return capabilityAuthorSuccessResponseSchema.parse({
    ...fallback,
    metadata: fallbackUsageMetadata(fallback),
    result: {
      ...fallback.result,
      questions: [],
      limitations: [
        ...fallback.result.limitations,
        "The live helper did not produce a runnable supported draft, so Litmus completed this proposal with its verified local builder."
      ].slice(0, CAPABILITY_AUTHOR_LIMITS.maxLimitations)
    }
  });
}

export async function runCapabilityAuthoringWithDeterministicFallback(
  request: CapabilityAuthorRequest,
  options: RunCapabilityAuthoringOptions & {
    readonly planner: CapabilityAuthorPlanner;
  }
): Promise<CapabilityAuthorSuccessResponse> {
  try {
    const result = await runCapabilityAuthoring(request, options);
    if (!shouldUseDeterministicFallbackForLiveResult(request, result)) {
      return result;
    }
    options.onProgress?.(AUTHOR_PROGRESS.using_verified_fallback);
    const fallback = await runCapabilityAuthoring(request, {
      checkedAt: options.checkedAt,
      onProgress: options.onProgress,
      timeoutMs: DETERMINISTIC_FALLBACK_TIMEOUT_MS
    });
    return annotateVerifiedFallback(fallback);
  } catch (error) {
    if (
      !(error instanceof CapabilityAuthoringError) ||
      !error.retryable ||
      !DETERMINISTIC_FALLBACK_ERROR_CODES.has(error.code)
    ) {
      throw error;
    }
    options.onProgress?.(AUTHOR_PROGRESS.using_verified_fallback);
    const fallback = await runCapabilityAuthoring(request, {
      checkedAt: options.checkedAt,
      onProgress: options.onProgress,
      timeoutMs: DETERMINISTIC_FALLBACK_TIMEOUT_MS
    });
    return annotateVerifiedFallback(fallback);
  }
}

const SOLUTION_CONFIGURATION_IDS = Object.freeze([
  "device.chromebook_core.v1",
  "component_config.reagent_bottle.stock_solution.v1",
  "component_config.volumetric_pipette.10ml.v1",
  "component_config.volumetric_flask.100ml.v1",
  "component_config.wash_bottle.250ml.v1",
  "schema.layout_configuration.solution_preparation_bench.v1",
  "placement.solution_stock_right.v1",
  "placement.solution_pipette_stand.v1",
  "placement.solution_flask_center.v1",
  "placement.solution_wash_left.v1",
  "quantity-preset.copper_nitrate_solution_50ml.v1",
  "quantity-preset.distilled_water_250ml.v1",
  "schema.material_initialization.bounded_concentration.v1",
  "unit.mol_per_l.v1",
  "unit.ml.v1",
  "observable.solution_volume_ml.v1",
  "observable.solution_concentration_m.v1",
  "observable.stock_concentration_m.v1",
  "completion.all_required_observations.v1",
  "assessment.event_performance.v1"
]);

export function deterministicSolutionPreparationTracePlan(): CapabilityAuthorPlan["traceCases"] {
  return createSolutionPreparationTracePlan().map((testCase) => ({
    kind: testCase.kind,
    actions: testCase.actions.map((action) => ({
      ...action,
      sourceEquipmentInstanceId: action.sourceEquipmentInstanceId ?? null,
      targetEquipmentInstanceIds: [...action.targetEquipmentInstanceIds],
      parameters: action.parameters.map((parameter) => ({ ...parameter }))
    }))
  }));
}

function solutionCommandsFor(
  request: CapabilityAuthorRequest
): readonly LabDraftCommand[] {
  return structuredClone(SOLUTION_PREPARATION_AUTHORING_COMMANDS).map(
    (command): LabDraftCommand =>
      command.type === "update_metadata"
        ? {
            ...command,
            metadata: {
              ...command.metadata,
              gradeBand: request.gradeBand ?? command.metadata.gradeBand,
              estimatedMinutes:
                request.targetMinutes ?? command.metadata.estimatedMinutes,
              deviceProfileId: request.deviceProfileId
            }
          }
        : command
  );
}

function exposeSolutionPreparationRegistries(
  execute: CapabilityAuthorPlannerContext["executeTool"]
): void {
  execute("searchObjectives", {
    query: "volumetric transfer",
    availability: "verified"
  });
  execute("searchObjectives", {
    query: "solution dilution",
    availability: "verified"
  });
  execute("inspectEquipment", { ids: [] });
  execute("inspectMaterials", { ids: [] });
  execute("inspectActions", { ids: [] });
  execute("inspectCapabilities", { ids: [] });
  execute("inspectConditions", { kinds: [] });
  execute("inspectModels", { ids: [] });
  execute("inspectSafety", { ids: [] });
  execute("inspectConfigurations", { ids: SOLUTION_CONFIGURATION_IDS });
}

const INJECTION_PATTERN =
  /(?:ignore (?:all |the )?(?:previous|prior|system)|invent (?:a |new )?(?:registry|component|action|adapter|model)|validator (?:already )?approved|output (?:code|javascript)|reveal (?:the )?(?:prompt|secret|chain.of.thought))/i;

export function createDeterministicCapabilityAuthorPlanner(): CapabilityAuthorPlanner {
  const planner: CapabilityAuthorPlanner = {
    mode: "mock" as const,
    model: "deterministic-capability-author-v1",
    async runRound(context: CapabilityAuthorPlannerContext) {
      const normalized = context.request.teacherRequest.toLocaleLowerCase();
      if (INJECTION_PATTERN.test(normalized)) {
        return {
          plan: {
            disposition: "unsupported",
            objective: "Create a lab only from verified Litmus capabilities.",
            assumptions: [],
            questions: [],
            limitations: [
              "The request attempted to override capability, validation, or confidentiality boundaries."
            ],
            traceCases: []
          },
          usage: { modelCalls: 1, inputTokens: 0, outputTokens: 0 }
        };
      }
      if (/open flame|bunsen|flame test/i.test(normalized)) {
        context.executeTool("inspectSafety", {
          ids: ["safety.no_open_flame_mvp.v1"]
        });
        return {
          plan: {
            disposition: "rejected_for_safety",
            objective: "Use open-flame equipment in a student lab.",
            assumptions: [
              "The requested flame is intended as a student action."
            ],
            questions: [],
            limitations: [
              "Open-flame equipment is restricted and unavailable in this runtime."
            ],
            traceCases: []
          },
          usage: { modelCalls: 1, inputTokens: 0, outputTokens: 0 }
        };
      }
      if (/make any lab|surprise me|anything is fine/i.test(normalized)) {
        return {
          plan: {
            disposition: "needs_clarification",
            objective: "Identify an assessable chemistry learning objective.",
            assumptions: [],
            questions: [
              "Which specific skill or misconception should students practice?"
            ],
            limitations: ["No assessable objective was supplied."],
            traceCases: []
          },
          usage: { modelCalls: 1, inputTokens: 0, outputTokens: 0 }
        };
      }
      if (!requestsVerifiedSolutionPreparation(context.request)) {
        context.executeTool("inspectCapabilities", { ids: [] });
        return {
          plan: {
            disposition: "unsupported",
            objective: context.request.teacherRequest,
            assumptions: [],
            questions: [],
            limitations: [
              "The request does not map to the currently verified capability-authoring template."
            ],
            traceCases: []
          },
          usage: { modelCalls: 1, inputTokens: 0, outputTokens: 0 }
        };
      }

      if (context.draftSummary.revision === 1) {
        exposeSolutionPreparationRegistries(context.executeTool);
        const edit = context.executeTool("applyDraftCommands", {
          expectedRevision: context.draftSummary.revision,
          commands: solutionCommandsFor(context.request)
        }) as { readonly ok?: boolean };
        if (edit.ok !== true) {
          throw new CapabilityAuthoringError(
            "authoring.tool_failure.v2",
            "The deterministic author could not apply the shared draft commands.",
            502,
            true,
            ["tools.applyDraftCommands"]
          );
        }
      }
      return {
        plan: {
          disposition: "candidate",
          objective:
            "Prepare a bounded copper(II) nitrate dilution with calibrated volumetric technique.",
          assumptions: [
            "Use the verified aqueous copper(II) nitrate identity.",
            "Use a 2.0000 mol/L stock and a 100.00 mL final preparation.",
            "Every student action remains available by keyboard."
          ],
          questions: [],
          limitations: [
            "Only the registered concentration range, apparatus, and deterministic dilution model are supported."
          ],
          traceCases: deterministicSolutionPreparationTracePlan()
        },
        usage: { modelCalls: 1, inputTokens: 0, outputTokens: 0 }
      };
    }
  };
  return Object.freeze(planner);
}

function workflowIdFor(request: CapabilityAuthorRequest): string {
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        contractVersion: request.contractVersion,
        teacherRequest: request.teacherRequest,
        gradeBand: request.gradeBand ?? null,
        targetMinutes: request.targetMinutes ?? null,
        classContext: request.classContext ?? null,
        deviceProfileId: request.deviceProfileId
      }),
      "utf8"
    )
    .digest("hex")
    .slice(0, 16);
  return `workflow.capability_author.${digest}.v2`;
}

function initialDraftFor(request: CapabilityAuthorRequest): LabWorkflowDraftV2 {
  const blank = createBlankLabDraftV2();
  return labWorkflowDraftV2Schema.parse({
    ...blank,
    id: workflowIdFor(request),
    sourceRequest: request.teacherRequest,
    metadata: {
      ...blank.metadata,
      gradeBand: request.gradeBand ?? blank.metadata.gradeBand,
      estimatedMinutes:
        request.targetMinutes ?? blank.metadata.estimatedMinutes,
      deviceProfileId: request.deviceProfileId
    },
    supportStatus: "draft_unvalidated",
    validation: null,
    judgeCritique: null
  });
}

function normalizePlan(planInput: unknown): CapabilityAuthorPlan {
  const parsed = capabilityAuthorPlanSchema.safeParse(planInput);
  if (!parsed.success) {
    throw new CapabilityAuthoringError(
      "authoring.output_invalid.v2",
      "The capability author returned an invalid bounded plan.",
      502,
      true,
      parsed.error.issues.map(({ path }) => path.join(".") || "$")
    );
  }
  return {
    ...parsed.data,
    traceCases: parsed.data.traceCases.map((testCase) => ({
      kind: testCase.kind,
      actions: testCase.actions.map(
        ({ sourceEquipmentInstanceId, ...action }) => ({
          ...action,
          ...(sourceEquipmentInstanceId === null
            ? {}
            : { sourceEquipmentInstanceId })
        })
      )
    }))
  } as CapabilityAuthorPlan;
}

function validationDiagnostics(
  issues: readonly {
    readonly code: string;
    readonly path: string;
    readonly message: string;
    readonly safetyRelated: boolean;
  }[]
): CapabilityAuthorDiagnostic[] {
  return issues
    .slice(0, CAPABILITY_AUTHOR_LIMITS.maxDiagnostics)
    .map((issue) => ({
      source: "validation",
      code: issue.code,
      path: issue.path,
      message: issue.message,
      safetyRelated: issue.safetyRelated
    }));
}

function runtimePortsFor(
  workflow: Readonly<ValidatedLabWorkflowSpecV2>
): GenericRuntimePorts {
  return workflow.compatibility
    ? createLegacyTitrationRuntimePorts(workflow)
    : createCapabilityGenericRuntimePorts(workflow);
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function executeTraceCases(
  plan: CapabilityAuthorPlan,
  workflow: Readonly<ValidatedLabWorkflowSpecV2>,
  attempt: number
): {
  readonly summaries: readonly CapabilityAuthorTraceSummary[];
  readonly diagnostics: readonly CapabilityAuthorDiagnostic[];
} {
  const summaries: CapabilityAuthorTraceSummary[] = [];
  const diagnostics: CapabilityAuthorDiagnostic[] = [];
  for (const testCase of plan.traceCases) {
    const traceId = `trace.agent.${workflow.validation.canonicalSpecHash.slice(-12)}.${testCase.kind}.${attempt}`;
    try {
      const trace = createGenericLabActionTrace({
        traceId,
        sessionId: `agent-${workflow.revision}-${testCase.kind}-${attempt}`,
        sessionSeed: `capability-author-${workflow.id}-${testCase.kind}`,
        workflow,
        actions: testCase.actions as readonly NormalizedLabAction[]
      });
      const result = runGenericTraceSuite(
        [{ kind: testCase.kind as GenericTraceSuiteCaseKind, trace }],
        () => ({ workflow, ports: runtimePortsFor(workflow) })
      )[0]!;
      const allDiagnoses = result.states.flatMap(({ diagnoses }) => diagnoses);
      const diagnosisMap = new Map(
        allDiagnoses.map((diagnosis) => [
          `${diagnosis.ruleId}|${diagnosis.status}|${diagnosis.recoverable}`,
          diagnosis
        ])
      );
      const eventIds = result.finalState.eventEnvelopes.map(
        ({ eventId }) => eventId
      );
      const evidenceEventIds = result.finalState.eventEnvelopes
        .filter(({ ruleEvidenceIds }) => ruleEvidenceIds.length > 0)
        .map(({ eventId }) => eventId);
      summaries.push({
        kind: testCase.kind,
        traceId,
        passed: true,
        actionCount: testCase.actions.length,
        workflowStatus: result.finalState.workflowStatus,
        eventIds: uniqueSorted(eventIds).slice(
          0,
          CAPABILITY_AUTHOR_LIMITS.maxTraceEvidence
        ),
        evidenceEventIds: uniqueSorted(evidenceEventIds).slice(
          0,
          CAPABILITY_AUTHOR_LIMITS.maxTraceEvidence
        ),
        diagnoses: [...diagnosisMap.values()]
          .sort((left, right) =>
            `${left.ruleId}|${left.status}`.localeCompare(
              `${right.ruleId}|${right.status}`
            )
          )
          .slice(0, CAPABILITY_AUTHOR_LIMITS.maxTraceEvidence)
          .map((diagnosis) => ({
            ruleId: diagnosis.ruleId,
            status: diagnosis.status,
            severity: diagnosis.severity,
            recoverable: diagnosis.recoverable,
            evidenceEventIds: diagnosis.evidenceEventIds.slice(
              0,
              CAPABILITY_AUTHOR_LIMITS.maxTraceEvidence
            )
          })),
        observables: result.finalState.chemistry.observables
          .slice(0, CAPABILITY_AUTHOR_LIMITS.maxTraceEvidence)
          .map(({ observableId, value, unitId }) => ({
            observableId,
            value,
            unitId: unitId ?? null
          })),
        error: null
      });
    } catch (error) {
      const diagnostic: CapabilityAuthorDiagnostic = {
        source: "trace",
        code:
          error instanceof LabTraceError
            ? error.code
            : "authoring.trace_runtime_failure.v2",
        path: `traceCases.${testCase.kind}`,
        message:
          error instanceof Error
            ? error.message
            : "The real trace runtime rejected this case.",
        safetyRelated: false
      };
      diagnostics.push(diagnostic);
      summaries.push({
        kind: testCase.kind,
        traceId,
        passed: false,
        actionCount: testCase.actions.length,
        workflowStatus: null,
        eventIds: [],
        evidenceEventIds: [],
        diagnoses: [],
        observables: [],
        error: diagnostic
      });
    }
  }
  return { summaries, diagnostics };
}

function validationSummary(workflow: Readonly<ValidatedLabWorkflowSpecV2>) {
  return {
    status: workflow.validation.status,
    runnable: workflow.validation.runnable,
    previewEligible: workflow.validation.previewEligible,
    canonicalSpecHash: workflow.validation.canonicalSpecHash,
    validatorVersion: workflow.validation.validatorVersion,
    checkedAt: workflow.validation.checkedAt,
    issues: validationDiagnostics(workflow.validation.issues)
  };
}

function summaryForSession(session: CapabilityAuthorToolSession) {
  const draft = session.getDraft();
  return Object.freeze({
    schemaVersion: draft.schemaVersion,
    id: draft.id,
    revision: draft.revision,
    draftHash: hashLabWorkflowSpec(draft),
    supportStatus: draft.supportStatus
  });
}

function timeoutError(): CapabilityAuthoringError {
  return new CapabilityAuthoringError(
    "authoring.timeout.v2",
    "Capability authoring exceeded its fixed time limit.",
    504,
    true
  );
}

function providerFailure(error: APIError): CapabilityAuthoringError {
  if (
    error.status === 400 ||
    error.status === 401 ||
    error.status === 403 ||
    error.status === 404
  ) {
    return new CapabilityAuthoringError(
      "authoring.provider_configuration.v2",
      "Capability authoring provider configuration needs attention.",
      502,
      false
    );
  }
  if (error.status === 429 || (error.status !== undefined && error.status >= 500)) {
    return new CapabilityAuthoringError(
      "authoring.provider_retryable.v2",
      "Capability authoring provider is temporarily unavailable.",
      503,
      true
    );
  }
  return new CapabilityAuthoringError(
    "authoring.model_unavailable.v2",
    "Capability authoring provider is unavailable.",
    503,
    false
  );
}

async function plannerRoundWithAbort(
  planner: CapabilityAuthorPlanner,
  context: CapabilityAuthorPlannerContext
): Promise<CapabilityAuthorPlannerRoundResult> {
  if (context.signal.aborted) throw timeoutError();
  return await Promise.race([
    planner.runRound(context),
    new Promise<never>((_, reject) => {
      context.signal.addEventListener("abort", () => reject(timeoutError()), {
        once: true
      });
    })
  ]);
}

function resultForDisposition(
  disposition: Exclude<CapabilityAuthorPlan["disposition"], "candidate">
): "needs_clarification" | "unsupported" | "rejected_for_safety" {
  return disposition;
}

export async function runCapabilityAuthoring(
  request: CapabilityAuthorRequest,
  options: RunCapabilityAuthoringOptions = {}
): Promise<CapabilityAuthorSuccessResponse> {
  const planner =
    options.planner ?? createDeterministicCapabilityAuthorPlanner();
  const checkedAt = options.checkedAt ?? new Date().toISOString();
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? CAPABILITY_AUTHOR_LIMITS.timeoutMs
  );
  const session = createCapabilityAuthorToolSession(initialDraftFor(request));
  let diagnostics: readonly CapabilityAuthorDiagnostic[] = [];
  let latestPlan: CapabilityAuthorPlan | null = null;
  let latestWorkflow: Readonly<ValidatedLabWorkflowSpecV2> | null = null;
  let latestTraces: readonly CapabilityAuthorTraceSummary[] = [];
  const hashLineage: Array<{
    attempt: number;
    revision: number;
    draftHash: string;
    validationStatus:
      | "runnable"
      | "partially_supported"
      | "unsupported"
      | "rejected_for_safety";
    runnable: boolean;
  }> = [];
  let modelCalls = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let lastProgressStage: CapabilityAuthorProgress["stage"] | null = null;

  const reportProgress = (stage: CapabilityAuthorProgress["stage"]): void => {
    if (lastProgressStage === stage) return;
    lastProgressStage = stage;
    options.onProgress?.(AUTHOR_PROGRESS[stage]);
  };

  try {
    reportProgress("understanding_request");
    for (
      let attempt = 1;
      attempt <= CAPABILITY_AUTHOR_LIMITS.maxRevisionAttempts;
      attempt += 1
    ) {
      if (modelCalls >= CAPABILITY_AUTHOR_LIMITS.maxModelCalls) {
        diagnostics = [
          {
            source: "limit",
            code: "authoring.model_call_limit.v2",
            path: "$",
            message: "The fixed model-call budget was exhausted.",
            safetyRelated: false
          }
        ];
        break;
      }
      const round = await plannerRoundWithAbort(planner, {
        request,
        attempt,
        diagnostics,
        draftSummary: summaryForSession(session),
        modelCallsRemaining:
          CAPABILITY_AUTHOR_LIMITS.maxModelCalls - modelCalls,
        executeTool: (name, args) => {
          reportProgress(
            name === "applyDraftCommands"
              ? "building_draft"
              : "checking_available_parts"
          );
          return session.execute(name, args);
        },
        signal: controller.signal
      });
      modelCalls += round.usage.modelCalls;
      inputTokens += round.usage.inputTokens;
      outputTokens += round.usage.outputTokens;
      if (modelCalls > CAPABILITY_AUTHOR_LIMITS.maxModelCalls) {
        diagnostics = [
          {
            source: "limit",
            code: "authoring.model_call_limit.v2",
            path: "$",
            message: "The fixed model-call budget was exhausted.",
            safetyRelated: false
          }
        ];
        break;
      }
      latestPlan = normalizePlan(round.plan);
      if (latestPlan.disposition !== "candidate") {
        reportProgress("finalizing");
        return capabilityAuthorSuccessResponseSchema.parse({
          ok: true,
          metadata: {
            contractVersion: "2.0.0",
            promptVersion: CAPABILITY_AUTHOR_PROMPT_VERSION,
            toolContractVersion: CAPABILITY_AUTHOR_TOOL_CONTRACT_VERSION,
            outputSchemaVersion: CAPABILITY_AUTHOR_OUTPUT_SCHEMA_VERSION,
            model: planner.model,
            mode: planner.mode,
            registrySnapshotIds: CAPABILITY_AUTHOR_REGISTRY_SNAPSHOT_IDS,
            limits: {
              maxRevisionAttempts: CAPABILITY_AUTHOR_LIMITS.maxRevisionAttempts,
              maxModelCalls: CAPABILITY_AUTHOR_LIMITS.maxModelCalls,
              maxToolCalls: CAPABILITY_AUTHOR_TOOL_LIMITS.maxToolCalls,
              maxOutputTokensPerCall:
                CAPABILITY_AUTHOR_LIMITS.maxOutputTokensPerCall,
              timeoutMs: CAPABILITY_AUTHOR_LIMITS.timeoutMs
            },
            usage: {
              modelCalls,
              toolCalls: session.getAuditTrail().length,
              inputTokens,
              outputTokens,
              totalTokens: inputTokens + outputTokens,
              estimatedCost: {
                currency: "USD",
                amount: planner.mode === "mock" ? 0 : null,
                source:
                  planner.mode === "mock"
                    ? "deterministic_mock"
                    : "provider_not_priced"
              }
            },
            hashLineage,
            toolAudit: session.getAuditTrail()
          },
          result: {
            outcome: resultForDisposition(latestPlan.disposition),
            objective: latestPlan.objective,
            assumptions: latestPlan.assumptions,
            questions: latestPlan.questions,
            limitations: latestPlan.limitations,
            workflow: null,
            validation: null,
            traces: [],
            unresolvedDiagnostics: []
          }
        });
      }

      reportProgress("checking_lab");
      const validation = validateLabWorkflowSpecV2(session.getDraft(), {
        checkedAt
      });
      if (!validation.schemaValid) {
        throw new CapabilityAuthoringError(
          "authoring.internal_failure.v2",
          "Shared commands produced a structurally invalid draft.",
          500,
          false
        );
      }
      latestWorkflow = validation.spec;
      hashLineage.push({
        attempt,
        revision: latestWorkflow.revision,
        draftHash: validation.validation.canonicalSpecHash,
        validationStatus: validation.validation.status,
        runnable: validation.validation.runnable
      });
      if (!validation.validation.runnable) {
        diagnostics = validationDiagnostics(validation.issues);
        continue;
      }

      reportProgress("testing_student_paths");
      const executed = executeTraceCases(latestPlan, latestWorkflow, attempt);
      latestTraces = executed.summaries;
      if (executed.diagnostics.length === 0) {
        reportProgress("finalizing");
        return capabilityAuthorSuccessResponseSchema.parse({
          ok: true,
          metadata: {
            contractVersion: "2.0.0",
            promptVersion: CAPABILITY_AUTHOR_PROMPT_VERSION,
            toolContractVersion: CAPABILITY_AUTHOR_TOOL_CONTRACT_VERSION,
            outputSchemaVersion: CAPABILITY_AUTHOR_OUTPUT_SCHEMA_VERSION,
            model: planner.model,
            mode: planner.mode,
            registrySnapshotIds: CAPABILITY_AUTHOR_REGISTRY_SNAPSHOT_IDS,
            limits: {
              maxRevisionAttempts: CAPABILITY_AUTHOR_LIMITS.maxRevisionAttempts,
              maxModelCalls: CAPABILITY_AUTHOR_LIMITS.maxModelCalls,
              maxToolCalls: CAPABILITY_AUTHOR_TOOL_LIMITS.maxToolCalls,
              maxOutputTokensPerCall:
                CAPABILITY_AUTHOR_LIMITS.maxOutputTokensPerCall,
              timeoutMs: CAPABILITY_AUTHOR_LIMITS.timeoutMs
            },
            usage: {
              modelCalls,
              toolCalls: session.getAuditTrail().length,
              inputTokens,
              outputTokens,
              totalTokens: inputTokens + outputTokens,
              estimatedCost: {
                currency: "USD",
                amount: planner.mode === "mock" ? 0 : null,
                source:
                  planner.mode === "mock"
                    ? "deterministic_mock"
                    : "provider_not_priced"
              }
            },
            hashLineage,
            toolAudit: session.getAuditTrail()
          },
          result: {
            outcome: "runnable",
            objective: latestPlan.objective,
            assumptions: latestPlan.assumptions,
            questions: latestPlan.questions,
            limitations: latestPlan.limitations,
            workflow: latestWorkflow,
            validation: validationSummary(latestWorkflow),
            traces: latestTraces,
            unresolvedDiagnostics: []
          }
        });
      }
      diagnostics = executed.diagnostics;
    }

    const fallbackPlan = latestPlan ?? {
      disposition: "candidate" as const,
      objective: request.teacherRequest,
      assumptions: [],
      questions: [],
      limitations: [],
      traceCases: []
    };
    reportProgress("finalizing");
    return capabilityAuthorSuccessResponseSchema.parse({
      ok: true,
      metadata: {
        contractVersion: "2.0.0",
        promptVersion: CAPABILITY_AUTHOR_PROMPT_VERSION,
        toolContractVersion: CAPABILITY_AUTHOR_TOOL_CONTRACT_VERSION,
        outputSchemaVersion: CAPABILITY_AUTHOR_OUTPUT_SCHEMA_VERSION,
        model: planner.model,
        mode: planner.mode,
        registrySnapshotIds: CAPABILITY_AUTHOR_REGISTRY_SNAPSHOT_IDS,
        limits: {
          maxRevisionAttempts: CAPABILITY_AUTHOR_LIMITS.maxRevisionAttempts,
          maxModelCalls: CAPABILITY_AUTHOR_LIMITS.maxModelCalls,
          maxToolCalls: CAPABILITY_AUTHOR_TOOL_LIMITS.maxToolCalls,
          maxOutputTokensPerCall:
            CAPABILITY_AUTHOR_LIMITS.maxOutputTokensPerCall,
          timeoutMs: CAPABILITY_AUTHOR_LIMITS.timeoutMs
        },
        usage: {
          modelCalls,
          toolCalls: session.getAuditTrail().length,
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
          estimatedCost: {
            currency: "USD",
            amount: planner.mode === "mock" ? 0 : null,
            source:
              planner.mode === "mock"
                ? "deterministic_mock"
                : "provider_not_priced"
          }
        },
        hashLineage,
        toolAudit: session.getAuditTrail()
      },
      result: {
        outcome: "limited",
        objective: fallbackPlan.objective,
        assumptions: fallbackPlan.assumptions,
        questions: fallbackPlan.questions,
        limitations: [
          ...fallbackPlan.limitations,
          "The fixed revision or model-call budget ended before all deterministic gates passed."
        ].slice(0, CAPABILITY_AUTHOR_LIMITS.maxLimitations),
        workflow: latestWorkflow,
        validation: latestWorkflow ? validationSummary(latestWorkflow) : null,
        traces: latestTraces,
        unresolvedDiagnostics: diagnostics.slice(
          0,
          CAPABILITY_AUTHOR_LIMITS.maxDiagnostics
        )
      }
    });
  } catch (error) {
    if (error instanceof CapabilityAuthoringError) throw error;
    if (error instanceof OpenAI.APIError) throw providerFailure(error);
    if (error instanceof CapabilityAuthorToolError) {
      throw new CapabilityAuthoringError(
        "authoring.tool_failure.v2",
        "A bounded capability-author tool failed.",
        502,
        true,
        error.fieldPaths
      );
    }
    if (controller.signal.aborted) throw timeoutError();
    throw new CapabilityAuthoringError(
      "authoring.model_unavailable.v2",
      "Capability authoring is temporarily unavailable.",
      503,
      true
    );
  } finally {
    clearTimeout(timer);
  }
}
