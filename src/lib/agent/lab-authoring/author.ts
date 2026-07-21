import { createHash } from "node:crypto";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInputItem } from "openai/resources/responses/responses";

import {
  labWorkflowDraftSchema,
  type LabWorkflowDraft
} from "../../../lab-workflows/schema";
import { ENDPOINT_CONTROL_PRELAB_DRAFT } from "../../../lab-workflows/seeds";
import { LabAuthoringError, unavailableLabAuthoringError } from "./errors";
import {
  LAB_AUTHORING_DEFAULT_MODEL,
  LAB_AUTHORING_OUTPUT_SCHEMA_VERSION,
  LAB_AUTHORING_PROMPT_VERSION,
  LAB_AUTHORING_SYSTEM_PROMPT,
  LAB_AUTHORING_TOOL_CONTRACT_VERSION
} from "./prompt";
import {
  LAB_AUTHORING_REGISTRY_SNAPSHOT_IDS,
  LAB_AUTHORING_REGISTRY_TOOLS,
  collectToolReturnedRegistryIds,
  executeLabAuthoringRegistryTool
} from "./registryTools";
import {
  LAB_AUTHORING_LIMITS,
  labAuthoringModelResultSchema,
  labAuthoringResultSchema,
  labAuthoringSuccessResponseSchema,
  type LabAuthoringModelResult,
  type LabAuthoringRequest,
  type LabAuthoringResult,
  type LabAuthoringSuccessResponse,
  type LabAuthoringToolName
} from "./schemas";

interface ToolExecutionTrace {
  readonly names: LabAuthoringToolName[];
  readonly exposedRegistryIds: Set<string>;
}

function workflowIdFor(request: LabAuthoringRequest): string {
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
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
  return `workflow.composer.${hash}.v1`;
}

function normalizeInitialDraft(
  draft: LabWorkflowDraft,
  request: LabAuthoringRequest
): LabWorkflowDraft {
  return labWorkflowDraftSchema.parse({
    ...draft,
    id: workflowIdFor(request),
    revision: 1,
    sourceRequest: request.teacherRequest,
    metadata: {
      ...draft.metadata,
      gradeBand: request.gradeBand ?? draft.metadata.gradeBand,
      estimatedMinutes:
        request.targetMinutes ?? draft.metadata.estimatedMinutes,
      deviceProfileId: request.deviceProfileId
    },
    supportStatus: "draft_unvalidated",
    validation: null,
    judgeCritique: null
  });
}

type ModelWorkflowDraft = NonNullable<
  LabAuthoringModelResult["proposedWorkflow"]
>;

function modelDraftToApplicationDraft(
  draft: ModelWorkflowDraft
): LabWorkflowDraft {
  return labWorkflowDraftSchema.parse({
    ...draft,
    steps: draft.steps.map((step) => ({
      ...step,
      allowedActions: step.allowedActions.map(
        ({ authoredLimits, maxAttempts, ...action }) => ({
          ...action,
          ...(authoredLimits === null ? {} : { authoredLimits }),
          ...(maxAttempts === null ? {} : { maxAttempts })
        })
      ),
      expectedObservations: step.expectedObservations.map(
        ({
          observationKeyId,
          flagId,
          expectedValueSourceId,
          ...observation
        }) => ({
          ...observation,
          ...(observationKeyId === null ? {} : { observationKeyId }),
          ...(flagId === null ? {} : { flagId }),
          ...(expectedValueSourceId === null ? {} : { expectedValueSourceId })
        })
      )
    }))
  });
}

function applicationDraftToModelDraft(
  draft: LabWorkflowDraft
): ModelWorkflowDraft {
  return {
    ...draft,
    steps: draft.steps.map((step) => ({
      ...step,
      allowedActions: step.allowedActions.map((action) => ({
        ...action,
        authoredLimits: action.authoredLimits ?? null,
        maxAttempts: action.maxAttempts ?? null
      })),
      expectedObservations: step.expectedObservations.map((observation) => ({
        ...observation,
        observationKeyId: observation.observationKeyId ?? null,
        flagId: observation.flagId ?? null,
        expectedValueSourceId: observation.expectedValueSourceId ?? null
      }))
    }))
  };
}

function normalizeModelInput(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const record = input as Readonly<Record<string, unknown>>;
  const applicationDraft = labWorkflowDraftSchema.safeParse(
    record.proposedWorkflow
  );
  if (!applicationDraft.success) return input;
  return {
    ...record,
    proposedWorkflow: applicationDraftToModelDraft(applicationDraft.data)
  };
}

function collectDraftRegistryReferences(
  draft: LabWorkflowDraft
): readonly string[] {
  const references = new Set<string>([
    draft.metadata.deviceProfileId,
    draft.familyId,
    draft.engineId,
    draft.engineConfigId,
    draft.initializationPresetId,
    ...draft.skillIds,
    draft.rubric.passingPolicyId
  ]);

  for (const component of draft.components) {
    references.add(component.componentId);
    references.add(component.configurationPresetId);
    references.add(component.role);
    references.add(component.placementSlotId);
  }
  for (const reagent of draft.reagents) {
    references.add(reagent.reagentId);
    references.add(reagent.role);
    references.add(reagent.amountUnitId);
  }
  for (const step of draft.steps) {
    step.skillIds.forEach((id) => references.add(id));
    references.add(step.completionPolicyId);
    for (const action of step.allowedActions) {
      references.add(action.actionId);
      references.add(action.parameterPresetId);
    }
    for (const observation of step.expectedObservations) {
      references.add(observation.eventTypeId);
      if (observation.observationKeyId) {
        references.add(observation.observationKeyId);
      }
      if (observation.flagId) references.add(observation.flagId);
      if (observation.expectedValueSourceId) {
        references.add(observation.expectedValueSourceId);
      }
    }
  }
  for (const trigger of draft.coachTriggers) {
    references.add(trigger.skillId);
    trigger.eventTypeIds.forEach((id) => references.add(id));
    trigger.flagIds.forEach((id) => references.add(id));
    references.add(trigger.triggerTypeId);
    references.add(trigger.hintStrategyId);
    trigger.staySilentOnEventReasonIds.forEach((id) => references.add(id));
  }
  for (const criterion of draft.rubric.criteria) {
    criterion.skillIds.forEach((id) => references.add(id));
    references.add(criterion.assessmentModeId);
    criterion.requiredEventTypeIds.forEach((id) => references.add(id));
    criterion.requiredObservationKeyIds.forEach((id) => references.add(id));
    criterion.studentSubmissionFieldIds.forEach((id) => references.add(id));
  }
  for (const retry of draft.adaptiveRetries) {
    references.add(retry.templateId);
    retry.targetSkillIds.forEach((id) => references.add(id));
    retry.eligibleFlagIds.forEach((id) => references.add(id));
    references.add(retry.seedTemplateId);
    retry.successEvidenceReasonIds.forEach((id) => references.add(id));
  }
  draft.safetyConstraints.forEach(({ id }) => references.add(id));
  return [...references].sort();
}

function alternativeIsExposed(
  alternative: LabAuthoringResult["suggestedAlternatives"][number],
  exposedRegistryIds: ReadonlySet<string>
): boolean {
  return (
    exposedRegistryIds.has(alternative.familyId) &&
    alternative.skillIds.every((skillId) => exposedRegistryIds.has(skillId))
  );
}

/**
 * Enforces registry provenance after structured parsing. Exact schema validity
 * is necessary but never sufficient to trust model-selected registry IDs.
 */
export function guardLabAuthoringResult(
  input: unknown,
  request: LabAuthoringRequest,
  exposedRegistryIds: ReadonlySet<string>
): LabAuthoringResult {
  const parsed = labAuthoringModelResultSchema.parse(
    normalizeModelInput(input)
  );
  const normalizedDraft = parsed.proposedWorkflow
    ? normalizeInitialDraft(
        modelDraftToApplicationDraft(parsed.proposedWorkflow),
        request
      )
    : null;
  const unexposed = new Set<string>();

  parsed.requestSummary.extractedSkillIds.forEach((skillId) => {
    if (!exposedRegistryIds.has(skillId)) unexposed.add(skillId);
  });
  if (normalizedDraft) {
    collectDraftRegistryReferences(normalizedDraft).forEach((reference) => {
      if (!exposedRegistryIds.has(reference)) unexposed.add(reference);
    });
  }

  const suggestedAlternatives = parsed.suggestedAlternatives.filter(
    (alternative) => alternativeIsExposed(alternative, exposedRegistryIds)
  );
  const extractedSkillIds = parsed.requestSummary.extractedSkillIds.filter(
    (skillId) => exposedRegistryIds.has(skillId)
  );
  const missingCapabilityIds = [
    ...new Set(
      parsed.missingCapabilityIds.filter((capabilityId) =>
        exposedRegistryIds.has(capabilityId)
      )
    )
  ].sort();
  if (unexposed.size > 0) {
    return labAuthoringResultSchema.parse({
      requestSummary: {
        ...parsed.requestSummary,
        extractedSkillIds,
        ambiguities: [
          ...parsed.requestSummary.ambiguities,
          "One or more proposed registry references were not returned by the read-only tools."
        ]
      },
      proposedWorkflow: null,
      claimedSupport: "unsupported",
      missingCapabilityIds,
      suggestedAlternatives,
      revisionSummary: null
    });
  }

  return labAuthoringResultSchema.parse({
    ...parsed,
    requestSummary: {
      ...parsed.requestSummary,
      extractedSkillIds
    },
    proposedWorkflow: normalizedDraft,
    claimedSupport:
      parsed.claimedSupport === "candidate_runnable" && !normalizedDraft
        ? "unsupported"
        : parsed.claimedSupport,
    missingCapabilityIds,
    suggestedAlternatives,
    revisionSummary: null
  });
}

function executeTool(
  trace: ToolExecutionTrace,
  name: LabAuthoringToolName,
  args: unknown
): unknown {
  if (trace.names.length >= LAB_AUTHORING_LIMITS.maxToolCalls) {
    throw new LabAuthoringError({
      code: "authoring.tool_limit.v1",
      message: "Lab authoring exceeded the registry-tool call limit.",
      status: 503,
      retryable: true
    });
  }
  const output = executeLabAuthoringRegistryTool(name, args);
  trace.names.push(name);
  collectToolReturnedRegistryIds(output, trace.exposedRegistryIds);
  return output;
}

function requestConstraints(request: LabAuthoringRequest): string[] {
  return [
    request.gradeBand ? `Grade band: ${request.gradeBand}` : null,
    request.targetMinutes
      ? `Target duration: ${request.targetMinutes} minutes`
      : null,
    request.classContext ? `Class context: ${request.classContext}` : null,
    `Device profile: ${request.deviceProfileId}`
  ].filter((value): value is string => value !== null);
}

function unsupportedResult(options: {
  readonly request: LabAuthoringRequest;
  readonly objective: string;
  readonly extractedSkillIds?: readonly string[];
  readonly claimedSupport?:
    | "partially_supported"
    | "rejected_for_safety"
    | "unsupported";
  readonly missingCapabilityIds: readonly string[];
  readonly ambiguity: string;
}): LabAuthoringResult {
  return labAuthoringResultSchema.parse({
    requestSummary: {
      objective: options.objective,
      extractedSkillIds: options.extractedSkillIds ?? [],
      constraints: requestConstraints(options.request),
      ambiguities: [options.ambiguity]
    },
    proposedWorkflow: null,
    claimedSupport: options.claimedSupport ?? "unsupported",
    missingCapabilityIds: options.missingCapabilityIds,
    suggestedAlternatives: [],
    revisionSummary: null
  });
}

function createMockResult(
  request: LabAuthoringRequest,
  trace: ToolExecutionTrace
): LabAuthoringResult {
  const normalized = request.teacherRequest.toLocaleLowerCase();
  if (
    /(?:ignore (?:all |the )?(?:previous|prior|system)|invent (?:a |new )?(?:registry|component|action|engine)|validator (?:already )?approved|output (?:code|javascript)|reveal (?:the )?(?:prompt|secret|chain.of.thought))/i.test(
      normalized
    )
  ) {
    return unsupportedResult({
      request,
      objective: "Create a lab only from verified Litmus capabilities.",
      missingCapabilityIds: [],
      ambiguity:
        "The request attempts to override authoring constraints or invent capabilities."
    });
  }

  if (/\b(?:make any lab|surprise me|anything is fine)\b/i.test(normalized)) {
    return unsupportedResult({
      request,
      objective: "Identify an assessable chemistry learning objective.",
      missingCapabilityIds: [],
      ambiguity:
        "No specific skill, misconception, or assessable learning objective was provided."
    });
  }

  if (/aspirin|organic synthesis|reflux|recrystallization/i.test(normalized)) {
    const requestsOpenFlame = /open flame|bunsen/i.test(normalized);
    if (requestsOpenFlame) {
      executeTool(trace, "getEngineCapabilities", {
        familyId: "family.acid_base_titration.v1"
      });
    }
    return unsupportedResult({
      request,
      objective: "Synthesize aspirin and assess product yield or purity.",
      claimedSupport: requestsOpenFlame ? "rejected_for_safety" : "unsupported",
      missingCapabilityIds: requestsOpenFlame
        ? ["safety.no_open_flame_mvp.v1"]
        : [],
      ambiguity:
        "Missing verified capabilities: organic synthesis, controlled heating/reflux, filtration, recrystallization, yield/purity analysis, and associated safety models."
    });
  }

  if (/open flame|bunsen|flame test/i.test(normalized)) {
    executeTool(trace, "getEngineCapabilities", {
      familyId: "family.acid_base_titration.v1"
    });
    return unsupportedResult({
      request,
      objective: "Use open-flame equipment in a virtual chemistry workflow.",
      claimedSupport: "rejected_for_safety",
      missingCapabilityIds: ["safety.no_open_flame_mvp.v1"],
      ambiguity:
        "Open-flame equipment is restricted and unavailable in the Chromebook MVP."
    });
  }

  if (/net ionic|spectator ion/i.test(normalized)) {
    const skillOutput = executeTool(trace, "searchSkillRegistry", {
      query: "net ionic equations"
    });
    executeTool(trace, "listSupportedLabFamilies", {
      skillIds: ["net_ionic_equations"],
      runnableOnly: true
    });
    collectToolReturnedRegistryIds(skillOutput, trace.exposedRegistryIds);
    return unsupportedResult({
      request,
      objective: "Practice net ionic equations and spectator ions.",
      extractedSkillIds: ["net_ionic_equations"],
      claimedSupport: "partially_supported",
      missingCapabilityIds: [
        "component.beaker.v1",
        "family.precipitation_solubility.v1"
      ],
      ambiguity:
        "The skill is planned, but its verified precipitation engine and components are unavailable."
    });
  }

  if (/calorimetry|heat transfer/i.test(normalized)) {
    executeTool(trace, "searchSkillRegistry", { query: "heat transfer" });
    executeTool(trace, "listSupportedLabFamilies", {
      skillIds: ["heat_transfer"],
      runnableOnly: true
    });
    return unsupportedResult({
      request,
      objective: "Practice heat transfer with deterministic calorimetry.",
      extractedSkillIds: ["heat_transfer"],
      claimedSupport: "partially_supported",
      missingCapabilityIds: [
        "component.calorimeter.v1",
        "component.thermometer.v1",
        "family.calorimetry.v1"
      ],
      ambiguity:
        "The skill and planned family are registered, but the verified calorimetry engine and components are unavailable."
    });
  }

  if (/gas collection|electroplating/i.test(normalized)) {
    return unsupportedResult({
      request,
      objective: request.teacherRequest,
      missingCapabilityIds: [],
      ambiguity:
        "The requested family does not have a verified Lab Composer runtime."
    });
  }

  if (/titration|endpoint|meniscus|burette/i.test(normalized)) {
    executeTool(trace, "searchSkillRegistry", { query: "endpoint control" });
    executeTool(trace, "searchSkillRegistry", { query: "meniscus reading" });
    executeTool(trace, "listSupportedLabFamilies", {
      skillIds: ["endpoint_control", "meniscus_reading"],
      runnableOnly: true
    });
    executeTool(trace, "getComponentRegistry", {
      familyId: "family.acid_base_titration.v1",
      componentIds: []
    });
    executeTool(trace, "getReagentRegistry", {
      familyId: "family.acid_base_titration.v1",
      reagentIds: []
    });
    executeTool(trace, "getEngineCapabilities", {
      familyId: "family.acid_base_titration.v1"
    });

    const draft = structuredClone(
      ENDPOINT_CONTROL_PRELAB_DRAFT
    ) as LabWorkflowDraft;
    return guardLabAuthoringResult(
      {
        requestSummary: {
          objective:
            "Practice endpoint control and precise burette meniscus reading.",
          extractedSkillIds: ["endpoint_control", "meniscus_reading"],
          constraints: requestConstraints(request),
          ambiguities: []
        },
        proposedWorkflow: draft,
        claimedSupport: "candidate_runnable",
        missingCapabilityIds: [],
        suggestedAlternatives: [],
        revisionSummary: null
      },
      request,
      trace.exposedRegistryIds
    );
  }

  return unsupportedResult({
    request,
    objective: request.teacherRequest,
    missingCapabilityIds: [],
    ambiguity:
      "The requested objective did not resolve to a verified Lab Composer skill and family."
  });
}

function successResponse(
  result: LabAuthoringResult,
  options: {
    readonly mode: "live" | "mock";
    readonly model: string;
    readonly toolCalls: readonly LabAuthoringToolName[];
  }
): LabAuthoringSuccessResponse {
  return labAuthoringSuccessResponseSchema.parse({
    ok: true,
    metadata: {
      promptVersion: LAB_AUTHORING_PROMPT_VERSION,
      toolContractVersion: LAB_AUTHORING_TOOL_CONTRACT_VERSION,
      outputSchemaVersion: LAB_AUTHORING_OUTPUT_SCHEMA_VERSION,
      model: options.model,
      mode: options.mode,
      registrySnapshotIds: LAB_AUTHORING_REGISTRY_SNAPSHOT_IDS,
      toolCalls: options.toolCalls,
      limits: {
        maxToolCalls: LAB_AUTHORING_LIMITS.maxToolCalls,
        maxModelRounds: LAB_AUTHORING_LIMITS.maxModelRounds,
        maxOutputTokensPerRound: LAB_AUTHORING_LIMITS.maxOutputTokensPerRound,
        timeoutMs: LAB_AUTHORING_LIMITS.timeoutMs
      }
    },
    result
  });
}

export function createMockLabAuthoringResponse(
  request: LabAuthoringRequest
): LabAuthoringSuccessResponse {
  const trace: ToolExecutionTrace = {
    names: [],
    exposedRegistryIds: new Set()
  };
  const result = createMockResult(request, trace);
  return successResponse(result, {
    mode: "mock",
    model: "deterministic-lab-author-v1",
    toolCalls: trace.names
  });
}

function hasRefusal(
  output: readonly { readonly type: string; readonly content?: unknown }[]
): boolean {
  return output.some(
    (item) =>
      item.type === "message" &&
      Array.isArray(item.content) &&
      item.content.some(
        (content) =>
          content &&
          typeof content === "object" &&
          "type" in content &&
          content.type === "refusal"
      )
  );
}

function guardLiveResult(
  input: unknown,
  request: LabAuthoringRequest,
  exposedRegistryIds: ReadonlySet<string>
): LabAuthoringResult {
  try {
    return guardLabAuthoringResult(input, request, exposedRegistryIds);
  } catch {
    throw new LabAuthoringError({
      code: "authoring.output_invalid.v1",
      message: "The authoring model returned an unusable structured result.",
      status: 502,
      retryable: true
    });
  }
}

async function createLiveLabAuthoringResponse(
  request: LabAuthoringRequest
): Promise<LabAuthoringSuccessResponse> {
  const model =
    process.env.OPENAI_LAB_AUTHOR_MODEL ?? LAB_AUTHORING_DEFAULT_MODEL;
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    maxRetries: 0,
    timeout: LAB_AUTHORING_LIMITS.timeoutMs
  });
  const trace: ToolExecutionTrace = {
    names: [],
    exposedRegistryIds: new Set()
  };
  const input: ResponseInputItem[] = [
    { role: "system", content: LAB_AUTHORING_SYSTEM_PROMPT },
    {
      role: "user",
      content: JSON.stringify({
        promptVersion: LAB_AUTHORING_PROMPT_VERSION,
        toolContractVersion: LAB_AUTHORING_TOOL_CONTRACT_VERSION,
        revisionNumber: 0,
        request
      })
    }
  ];
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    LAB_AUTHORING_LIMITS.timeoutMs
  );

  try {
    for (
      let round = 0;
      round < LAB_AUTHORING_LIMITS.maxModelRounds;
      round += 1
    ) {
      const response = await client.responses.parse(
        {
          model,
          input,
          tools: [...LAB_AUTHORING_REGISTRY_TOOLS],
          tool_choice: "auto",
          parallel_tool_calls: true,
          max_output_tokens: LAB_AUTHORING_LIMITS.maxOutputTokensPerRound,
          store: false,
          text: {
            format: zodTextFormat(
              labAuthoringModelResultSchema,
              "lab_authoring_result"
            )
          }
        },
        { signal: controller.signal }
      );
      if (hasRefusal(response.output)) {
        throw new LabAuthoringError({
          code: "authoring.model_refused.v1",
          message: "The authoring model refused this request.",
          status: 422,
          retryable: false
        });
      }

      const toolCalls = response.output.filter(
        (item) => item.type === "function_call"
      );
      if (toolCalls.length === 0) {
        if (!response.output_parsed) {
          throw new LabAuthoringError({
            code: "authoring.output_invalid.v1",
            message: "The authoring model returned no structured result.",
            status: 502,
            retryable: true
          });
        }
        const result = guardLiveResult(
          response.output_parsed,
          request,
          trace.exposedRegistryIds
        );
        return successResponse(result, {
          mode: "live",
          model,
          toolCalls: trace.names
        });
      }

      input.push(
        ...response.output.filter(
          (item) =>
            item.type === "function_call" ||
            item.type === "reasoning" ||
            item.type === "message"
        )
      );
      for (const toolCall of toolCalls) {
        let args: unknown;
        try {
          args = JSON.parse(toolCall.arguments);
        } catch {
          throw new LabAuthoringError({
            code: "authoring.tool_call_invalid.v1",
            message: `Tool ${toolCall.name} returned invalid JSON arguments.`,
            status: 502,
            retryable: true,
            fieldPaths: [`tools.${toolCall.name}`]
          });
        }
        const output = executeTool(
          trace,
          toolCall.name as LabAuthoringToolName,
          args
        );
        input.push({
          type: "function_call_output",
          call_id: toolCall.call_id,
          output: JSON.stringify(output)
        });
      }
    }

    throw new LabAuthoringError({
      code: "authoring.tool_limit.v1",
      message: "Lab authoring did not finish within the model-round limit.",
      status: 503,
      retryable: true
    });
  } catch (error) {
    if (error instanceof LabAuthoringError) throw error;
    if (controller.signal.aborted) {
      throw new LabAuthoringError({
        code: "authoring.timeout.v1",
        message: "Lab authoring exceeded its time limit.",
        status: 504,
        retryable: true
      });
    }
    throw unavailableLabAuthoringError();
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateLabAuthoringResponse(
  request: LabAuthoringRequest
): Promise<LabAuthoringSuccessResponse> {
  if (
    process.env.OPENAI_MOCK_MODE === "1" ||
    process.env.NODE_ENV === "test" ||
    !process.env.OPENAI_API_KEY
  ) {
    return createMockLabAuthoringResponse(request);
  }
  return createLiveLabAuthoringResponse(request);
}
