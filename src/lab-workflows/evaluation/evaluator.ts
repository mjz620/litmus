import type { SemanticEvent } from "../../experiments/shared";
import type { LabWorkflowV2RegistryContext } from "../validation";
import { PRODUCTION_LAB_WORKFLOW_V2_REGISTRIES } from "../validation";
import type {
  StructuredEvidenceValue,
  WorkflowCondition,
  WorkflowDiagnosis,
  WorkflowRule
} from "../schema/conditions";
import type {
  GenericStateValue,
  GenericWorkflowEvaluationContext,
  GenericWorkflowEvaluatorPort,
  NormalizedLabAction
} from "../runtime/generic/types";
import { GENERIC_LAB_RUNTIME_SCHEMA_VERSION } from "../runtime/generic/types";
import { deepFreeze } from "../runtime/generic/utils";
import {
  WORKFLOW_EVALUATOR_ERROR_CODES as ERROR,
  WorkflowEvaluatorError
} from "./errors";

interface ConditionResult {
  readonly status: "satisfied" | "violated" | "pending";
  readonly evidenceEventIds: readonly string[];
  readonly expected?: StructuredEvidenceValue;
  readonly observed?: StructuredEvidenceValue;
}

export interface CreateWorkflowEvaluatorOptions {
  readonly rules: readonly WorkflowRule[];
  readonly registries?: LabWorkflowV2RegistryContext;
}

function fail(
  code: WorkflowEvaluatorError["code"],
  message: string,
  details: Readonly<Record<string, string>> = {}
): never {
  throw new WorkflowEvaluatorError(code, message, details);
}

function evidence(value: GenericStateValue | boolean | number | string): StructuredEvidenceValue {
  if (value === null) return { valueType: "null", value: null };
  if (typeof value === "boolean") return { valueType: "boolean", value };
  if (typeof value === "number") return { valueType: "number", value };
  if (Array.isArray(value)) return { valueType: "text_list", value: [...value] };
  return { valueType: "text", value: String(value) };
}

function evidenceValue(value: StructuredEvidenceValue): unknown {
  return value.value;
}

function sameTargets(left: readonly string[], right: readonly string[]): boolean {
  return right.every((id) => left.includes(id));
}

function actionMatches(
  condition: Extract<WorkflowCondition, { kind: "action_observed" | "action_count_within_range" }>,
  action: Readonly<NormalizedLabAction>
): boolean {
  return (
    action.actionId === condition.actionId &&
    (condition.sourceEquipmentInstanceId === undefined ||
      action.sourceEquipmentInstanceId === condition.sourceEquipmentInstanceId) &&
    sameTargets(action.targetEquipmentInstanceIds, condition.targetEquipmentInstanceIds)
  );
}

function priorFor(
  context: GenericWorkflowEvaluationContext,
  ruleId: string
): WorkflowDiagnosis | undefined {
  return context.previousDiagnoses.find((diagnosis) => diagnosis.ruleId === ruleId);
}

function firstMatchingEvent(
  context: GenericWorkflowEvaluationContext,
  predicate: (event: SemanticEvent) => boolean
): { readonly event: SemanticEvent; readonly id: string } | null {
  const envelope = context.eventEnvelopes.find(({ payload }) =>
    predicate(payload)
  );
  return envelope
    ? { event: envelope.payload, id: envelope.eventId }
    : null;
}

function stateField(
  context: GenericWorkflowEvaluationContext,
  equipmentInstanceId: string,
  key: string
): GenericStateValue | undefined {
  return context.equipment
    .find(({ instanceId }) => instanceId === equipmentInstanceId)
    ?.fields.find((field) => field.key === key)?.value;
}

function result(
  status: ConditionResult["status"],
  evidenceEventIds: readonly string[] = [],
  expected?: StructuredEvidenceValue,
  observed?: StructuredEvidenceValue
): ConditionResult {
  return {
    status,
    evidenceEventIds,
    ...(expected ? { expected } : {}),
    ...(observed ? { observed } : {})
  };
}

function previousSatisfied(
  context: GenericWorkflowEvaluationContext,
  rule: WorkflowRule
): ConditionResult | null {
  const prior = priorFor(context, rule.id);
  return prior?.status === "satisfied"
    ? result("satisfied", prior.evidenceEventIds, prior.expected, prior.observed)
    : null;
}

export function createWorkflowEvaluator(
  options: CreateWorkflowEvaluatorOptions
): GenericWorkflowEvaluatorPort {
  const registries = options.registries ?? PRODUCTION_LAB_WORKFLOW_V2_REGISTRIES;
  const rules = deepFreeze(options.rules.map((rule) => structuredClone(rule)));
  const byId = new Map<string, WorkflowRule>();
  for (const rule of rules) {
    if (byId.has(rule.id))
      fail(ERROR.ruleDuplicate, `Duplicate workflow rule ${rule.id}.`, { ruleId: rule.id });
    byId.set(rule.id, rule);
    if (
      rule.condition.kind === "registered_completion_policy_satisfied" &&
      rule.condition.completionPolicyId !==
        "completion.all_required_observations.v1"
    ) {
      fail(
        ERROR.registryContractMissing,
        `Completion policy ${rule.condition.completionPolicyId} has no generic implementation.`,
        { completionPolicyId: rule.condition.completionPolicyId }
      );
    }
  }

  const eventSemanticType = new Map(
    registries.eventTypes.list().map((entry) => [entry.id, entry.semanticEventType])
  );
  const flagSemanticValue = new Map<string, string>(
    registries.eventFlags.list().map((entry) => [entry.id, entry.semanticFlag])
  );
  const configurationAdapter = new Map(
    registries.configurations.list().map((entry) => [entry.id, entry.adapterKey])
  );

  function evaluateCondition(
    rule: WorkflowRule,
    context: GenericWorkflowEvaluationContext,
    evaluateRule: (ruleId: string) => WorkflowDiagnosis
  ): ConditionResult {
    const priorDiagnosis = priorFor(context, rule.id);
    if (
      priorDiagnosis?.status === "violated" &&
      (rule.terminal || rule.kind === "ordering")
    ) {
      return result(
        "violated",
        priorDiagnosis.evidenceEventIds,
        priorDiagnosis.expected,
        priorDiagnosis.observed
      );
    }
    const condition = rule.condition;
    switch (condition.kind) {
      case "equipment_state_equals": {
        const actual = stateField(context, condition.equipmentInstanceId, condition.stateFieldKey);
        if (actual === undefined) return result("pending", [], condition.expectedValue);
        const observed = evidence(actual);
        return result(
          evidenceValue(condition.expectedValue) === actual ? "satisfied" : "pending",
          [],
          condition.expectedValue,
          observed
        );
      }
      case "equipment_capability_present": {
        const binding = context.equipmentBindings.find(
          ({ instanceId }) => instanceId === condition.equipmentInstanceId
        );
        return result(binding?.capabilityIds.includes(condition.capabilityId) ? "satisfied" : "violated");
      }
      case "material_bound_to_container": {
        const material = context.materialLedger.materials.find(
          ({ materialInstanceId }) => materialInstanceId === condition.materialInstanceId
        );
        const amount = material?.locations.find(
          ({ equipmentInstanceId }) => equipmentInstanceId === condition.containerEquipmentInstanceId
        )?.amount;
        return result(amount !== undefined && amount > 0 ? "satisfied" : "pending");
      }
      case "action_observed": {
        const prior = previousSatisfied(context, rule);
        if (prior) return prior;
        return context.currentAction && actionMatches(condition, context.currentAction)
          ? result("satisfied", context.currentEventIds)
          : result("pending");
      }
      case "action_count_within_range": {
        const prior = priorFor(context, rule.id);
        const count = context.actionBindings.reduce((sum, binding) => {
          const action = {
            schemaVersion:
              context.currentAction?.schemaVersion ??
              GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
            permissionId: binding.permission.id,
            actionId: binding.permission.actionId,
            ...(binding.permission.sourceEquipmentInstanceId
              ? { sourceEquipmentInstanceId: binding.permission.sourceEquipmentInstanceId }
              : {}),
            targetEquipmentInstanceIds: binding.permission.targetEquipmentInstanceIds,
            parameters: []
          } as NormalizedLabAction;
          if (!actionMatches(condition, action)) return sum;
          return sum + (context.permissionAttempts.find(
            ({ permissionId }) => permissionId === binding.permission.id
          )?.count ?? 0);
        }, 0);
        const observed = evidence(count);
        const expected: StructuredEvidenceValue = {
          valueType: "text",
          value: `${condition.minimumCount}..${condition.maximumCount}`
        };
        return result(
          count < condition.minimumCount
            ? "pending"
            : count > condition.maximumCount
              ? "violated"
              : "satisfied",
          [
            ...(prior?.evidenceEventIds ?? []),
            ...(context.currentAction && actionMatches(condition, context.currentAction)
              ? context.currentEventIds
              : [])
          ],
          expected,
          observed
        );
      }
      case "semantic_event_observed": {
        const prior = previousSatisfied(context, rule);
        if (prior) return prior;
        const semanticType = eventSemanticType.get(condition.eventTypeId);
        if (!semanticType)
          fail(ERROR.registryContractMissing, `Unknown event contract ${condition.eventTypeId}.`);
        const match = firstMatchingEvent(context, (event) => event.type === semanticType);
        return match ? result("satisfied", [match.id]) : result("pending");
      }
      case "observation_recorded": {
        const prior = previousSatisfied(context, rule);
        if (prior) return prior;
        const observationKey = configurationAdapter.get(condition.observationKeyId);
        const semanticType = condition.eventTypeId
          ? eventSemanticType.get(condition.eventTypeId)
          : undefined;
        if (condition.eventTypeId && !semanticType)
          fail(ERROR.registryContractMissing, `Unknown event contract ${condition.eventTypeId}.`);
        if (!observationKey)
          fail(ERROR.registryContractMissing, `Unknown observation ${condition.observationKeyId}.`);
        const match = firstMatchingEvent(
          context,
          (event) =>
            (!semanticType || event.type === semanticType) &&
            Object.hasOwn(event.observation, observationKey)
        );
        if (!match) return result("pending");
        const actual = match.event.observation[observationKey]!;
        const expectedObservable = condition.expectedValueSourceId
          ? context.observables.find(({ observableId }) => observableId === condition.expectedValueSourceId)
          : undefined;
        const expected = expectedObservable ? evidence(expectedObservable.value) : undefined;
        const observed = evidence(actual);
        return result(
          "satisfied",
          [match.id],
          expected,
          observed
        );
      }
      case "registered_completion_policy_satisfied": {
        const dependencies = condition.evidenceRuleIds.map(evaluateRule);
        return result(
          dependencies.some(({ status }) => status === "violated")
            ? "violated"
            : dependencies.every(({ status }) => status === "satisfied")
              ? "satisfied"
              : "pending",
          dependencies.flatMap(({ evidenceEventIds }) => evidenceEventIds)
        );
      }
      case "observable_within_tolerance": {
        const observable = context.observables.find(({ observableId }) => observableId === condition.observableId);
        if (!observable || typeof observable.value !== "number") return result("pending");
        if (observable.unitId !== condition.unitId)
          fail(
            ERROR.contextMismatch,
            `Observable ${condition.observableId} unit does not match its rule.`,
            { observableId: condition.observableId }
          );
        const minimumOk = condition.minimumInclusive
          ? observable.value >= condition.minimum
          : observable.value > condition.minimum;
        const maximumOk = condition.maximumInclusive
          ? observable.value <= condition.maximum
          : observable.value < condition.maximum;
        return result(
          minimumOk && maximumOk ? "satisfied" : "violated",
          [],
          undefined,
          { valueType: "number", value: observable.value, unitId: condition.unitId }
        );
      }
      case "event_flag": {
        const semanticFlag = flagSemanticValue.get(condition.flagId);
        const semanticType = condition.eventTypeId
          ? eventSemanticType.get(condition.eventTypeId)
          : undefined;
        if (condition.eventTypeId && !semanticType)
          fail(ERROR.registryContractMissing, `Unknown event contract ${condition.eventTypeId}.`);
        if (!semanticFlag) fail(ERROR.registryContractMissing, `Unknown event flag ${condition.flagId}.`);
        const relevant = firstMatchingEvent(
          context,
          (event) => !semanticType || event.type === semanticType
        );
        const flagged = firstMatchingEvent(
          context,
          (event) =>
            (!semanticType || event.type === semanticType) &&
            event.flags.includes(semanticFlag)
        );
        const clean = firstMatchingEvent(
          context,
          (event) =>
            (!semanticType || event.type === semanticType) &&
            !event.flags.includes(semanticFlag)
        );
        if (condition.presence === "absent") {
          if (clean) return result("satisfied", [clean.id]);
          return flagged ? result("violated", [flagged.id]) : result("pending");
        }
        const prior = previousSatisfied(context, rule);
        return prior ??
          (flagged
            ? result("satisfied", [flagged.id])
            : result("pending", relevant ? [relevant.id] : []));
      }
      case "rule_satisfied_before": {
        const priorOrdering = priorFor(context, rule.id);
        if (
          priorOrdering?.status === "satisfied" ||
          priorOrdering?.status === "violated"
        ) {
          return result(
            priorOrdering.status,
            priorOrdering.evidenceEventIds,
            priorOrdering.expected,
            priorOrdering.observed
          );
        }
        const predecessor = evaluateRule(condition.predecessorRuleId);
        const successor = evaluateRule(condition.successorRuleId);
        if (successor.status !== "satisfied") return result("pending");
        const priorPredecessor = priorFor(
          context,
          condition.predecessorRuleId
        );
        return result(
          priorPredecessor?.status === "satisfied" ? "satisfied" : "violated",
          [...predecessor.evidenceEventIds, ...successor.evidenceEventIds]
        );
      }
      case "forbidden_state_never_reached": {
        const prior = priorFor(context, rule.id);
        if (prior?.status === "violated")
          return result("violated", prior.evidenceEventIds, prior.expected, prior.observed);
        const actual = stateField(context, condition.equipmentInstanceId, condition.stateFieldKey);
        if (actual === undefined) return result("satisfied");
        const observed = evidence(actual);
        return result(
          evidenceValue(condition.forbiddenValue) === actual ? "violated" : "satisfied",
          evidenceValue(condition.forbiddenValue) === actual
            ? context.currentEventIds
            : [],
          condition.forbiddenValue,
          observed
        );
      }
      case "student_response_submitted": {
        const response = context.studentResponses.find(
          ({ submissionFieldId }) => submissionFieldId === condition.submissionFieldId
        );
        return response
          ? result("satisfied", [], undefined, evidence(response.value))
          : result("pending");
      }
      default: {
        const unreachable: never = condition;
        return unreachable;
      }
    }
  }

  return Object.freeze({
    evaluate(context: Readonly<GenericWorkflowEvaluationContext>): readonly WorkflowDiagnosis[] {
      if (JSON.stringify(context.rules) !== JSON.stringify(rules))
        fail(ERROR.contextMismatch, "Evaluator rules do not match compiled rules.");
      const memo = new Map<string, WorkflowDiagnosis>();
      const visiting = new Set<string>();
      const evaluateRule = (ruleId: string): WorkflowDiagnosis => {
        const existing = memo.get(ruleId);
        if (existing) return existing;
        const rule = byId.get(ruleId);
        if (!rule) fail(ERROR.ruleUnknown, `Unknown workflow rule ${ruleId}.`, { ruleId });
        if (visiting.has(ruleId)) fail(ERROR.contextMismatch, `Workflow rule cycle at ${ruleId}.`, { ruleId });
        visiting.add(ruleId);
        const condition = evaluateCondition(rule, context, evaluateRule);
        visiting.delete(ruleId);
        const negative = rule.kind === "failure" || rule.kind === "forbidden";
        const status =
          negative && rule.condition.kind !== "forbidden_state_never_reached"
            ? condition.status === "satisfied"
              ? "violated"
              : condition.status === "violated"
                ? "satisfied"
                : "pending"
            : condition.status;
        const diagnosis: WorkflowDiagnosis = {
          ruleId: rule.id,
          status,
          severity: rule.severity,
          recoverable: rule.recoverable,
          objectiveIds: [...rule.objectiveIds],
          evidenceEventIds: [...condition.evidenceEventIds],
          ...(condition.expected ? { expected: condition.expected } : {}),
          ...(condition.observed ? { observed: condition.observed } : {})
        };
        memo.set(ruleId, diagnosis);
        return diagnosis;
      };
      return deepFreeze(rules.map(({ id }) => evaluateRule(id)));
    }
  });
}
