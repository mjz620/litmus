import {
  actionRegistry,
  actionEventContractRegistry
} from "../../../lab-workflows/registries/actions";
import {
  eventFlagRegistry,
  eventTypeRegistry
} from "../../../lab-workflows/registries/event-flags";
import type { ValidatedLabWorkflowSpecV2 } from "../../../lab-workflows/schema/v2";
import type { CapabilityAuthorTraceSummary } from "../lab-authoring/capabilityAuthorSchemas";
import {
  WORKFLOW_JUDGE_CONTRACT_VERSION,
  workflowJudgeRequestSchema,
  type WorkflowJudgeCapabilitySummary,
  type WorkflowJudgeRequest,
  type WorkflowJudgeTraceEvidence
} from "./schemas";

export interface CreateWorkflowJudgeRequestInput {
  readonly teacherRequest: string;
  readonly workflow: Readonly<ValidatedLabWorkflowSpecV2>;
  readonly traces: readonly CapabilityAuthorTraceSummary[];
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function ruleEventTypeIds(
  workflow: Readonly<ValidatedLabWorkflowSpecV2>
): string[] {
  return workflow.rules.flatMap(({ condition }) => {
    switch (condition.kind) {
      case "semantic_event_observed":
        return [condition.eventTypeId];
      case "observation_recorded":
      case "event_flag":
        return condition.eventTypeId ? [condition.eventTypeId] : [];
      default:
        return [];
    }
  });
}

function rubricEventTypeIds(
  workflow: Readonly<ValidatedLabWorkflowSpecV2>
): string[] {
  return workflow.rubric.criteria.flatMap(({ evidenceMappings }) =>
    evidenceMappings.flatMap((mapping) =>
      mapping.kind === "semantic_event" ||
      mapping.kind === "semantic_event_observation"
        ? mapping.eventTypeId
          ? [mapping.eventTypeId]
          : []
        : []
    )
  );
}

export function createWorkflowJudgeCapabilitySummary(
  workflow: Readonly<ValidatedLabWorkflowSpecV2>
): WorkflowJudgeCapabilitySummary {
  const actionIds = uniqueSorted(
    workflow.permittedActions.map(({ actionId }) => actionId)
  );
  const actionEvents = actionIds.flatMap((actionId) => {
    const action = actionRegistry.get(actionId);
    return actionEventContractRegistry.get(action.emittedEventContractId)
      .eventTypeIds;
  });
  const availableEventTypeIds = uniqueSorted([
    ...actionEvents,
    ...ruleEventTypeIds(workflow),
    ...rubricEventTypeIds(workflow),
    ...workflow.coachPolicy.triggers.flatMap(({ eventTypeIds }) => eventTypeIds)
  ]);
  const semanticEventTypes = new Set(
    availableEventTypeIds.flatMap((eventTypeId) =>
      eventTypeRegistry.has(eventTypeId)
        ? [eventTypeRegistry.get(eventTypeId).semanticEventType]
        : []
    )
  );
  const availableFlagIds = uniqueSorted([
    ...workflow.rules.flatMap(({ condition }) =>
      condition.kind === "event_flag" ? [condition.flagId] : []
    ),
    ...workflow.coachPolicy.triggers.flatMap(({ flagIds }) => flagIds),
    ...eventFlagRegistry
      .list()
      .filter(({ emittedBySemanticEventTypes }) =>
        emittedBySemanticEventTypes.some((eventType) =>
          semanticEventTypes.has(eventType)
        )
      )
      .map(({ id }) => id)
  ]);
  return Object.freeze({
    schemaVersion: "1.0.0" as const,
    workflowHash: workflow.validation.canonicalSpecHash,
    supportMode: workflow.compatibility
      ? ("legacy_adapter" as const)
      : ("native_capability" as const),
    objectiveIds: uniqueSorted(workflow.objectiveIds),
    equipmentDefinitionIds: uniqueSorted(
      workflow.equipment.map(
        ({ equipmentDefinitionId }) => equipmentDefinitionId
      )
    ),
    actionIds,
    requiredChemistryCapabilityIds: uniqueSorted(
      workflow.requiredChemistryCapabilityIds
    ),
    availableEventTypeIds,
    availableFlagIds,
    deviceProfileId: workflow.metadata.deviceProfileId,
    rubricId: workflow.rubric.id,
    rubricVersion: workflow.rubric.version,
    resolvedAdapters: workflow.validation.resolvedAdapters.map((adapter) => ({
      ...adapter
    })),
    resolvedChemistryModels: workflow.validation.resolvedChemistryModels.map(
      (model) => ({
        ...model,
        providedCapabilityIds: [...model.providedCapabilityIds]
      })
    ),
    runtimeAdapterId: workflow.compatibility?.runtimeAdapterId ?? null
  });
}

function bindTrace(
  workflow: Readonly<ValidatedLabWorkflowSpecV2>,
  trace: Readonly<CapabilityAuthorTraceSummary>
): WorkflowJudgeTraceEvidence {
  if (!trace.passed || trace.workflowStatus === null || trace.error !== null)
    throw new TypeError(
      `The ${trace.kind} trace is not successful executed evidence.`
    );
  return {
    source: "executed_generic_replay_v1",
    workflowId: workflow.id,
    workflowRevision: workflow.revision,
    workflowHash: workflow.validation.canonicalSpecHash,
    kind: trace.kind,
    traceId: trace.traceId,
    passed: true,
    actionCount: trace.actionCount,
    workflowStatus: trace.workflowStatus,
    eventIds: uniqueSorted(trace.eventIds),
    evidenceEventIds: uniqueSorted(trace.evidenceEventIds),
    diagnoses: trace.diagnoses.map((diagnosis) => ({
      ...diagnosis,
      evidenceEventIds: uniqueSorted(diagnosis.evidenceEventIds)
    })),
    observables: trace.observables.map((observable) => ({ ...observable })),
    error: null
  };
}

export function createWorkflowJudgeRequest(
  input: CreateWorkflowJudgeRequestInput
): WorkflowJudgeRequest {
  return workflowJudgeRequestSchema.parse({
    contractVersion: WORKFLOW_JUDGE_CONTRACT_VERSION,
    teacherRequest: input.teacherRequest,
    workflow: input.workflow,
    validation: input.workflow.validation,
    capabilitySummary: createWorkflowJudgeCapabilitySummary(input.workflow),
    traces: input.traces.map((trace) => bindTrace(input.workflow, trace))
  });
}
