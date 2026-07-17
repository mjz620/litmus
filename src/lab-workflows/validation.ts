import type { ZodIssue } from "zod";

import { hashLabWorkflowSpec, labWorkflowHashMatches } from "./hash";
import {
  actionRegistry,
  type ActionParameterDefinition,
  type ActionRegistryEntry
} from "./registries/actions";
import {
  componentRegistry,
  type ComponentRegistryEntry
} from "./registries/components";
import {
  configurationRegistry,
  type ConfigurationCategory,
  type ConfigurationRegistryEntry
} from "./registries/configurations";
import { engineRegistry, type EngineRegistryEntry } from "./registries/engines";
import {
  eventFlagRegistry,
  eventTypeRegistry,
  type EventFlagRegistryEntry,
  type EventTypeRegistryEntry
} from "./registries/event-flags";
import {
  reagentRegistry,
  type ReagentRegistryEntry
} from "./registries/reagents";
import { safetyRegistry, type SafetyRegistryEntry } from "./registries/safety";
import { skillRegistry, type SkillRegistryEntry } from "./registries/skills";
import { verifyRegisteredSeedReplay } from "./seedReplay";
import {
  labWorkflowDraftSchema,
  labWorkflowSpecSchema,
  validatedLabWorkflowSpecSchema,
  validationResultSchema,
  type LabWorkflowDraft,
  type LabWorkflowSpec,
  type ValidatedLabWorkflowSpec,
  type ValidationIssue,
  type ValidationResult,
  type WorkflowSupportStatus
} from "./schema";

export const LAB_WORKFLOW_VALIDATOR_VERSION = "1.0.0" as const;

export const WORKFLOW_VALIDATION_CHECK_IDS = Object.freeze({
  schema: "check.schema.v1",
  registryResolution: "check.registry_resolution.v1",
  compatibility: "check.compatibility.v1",
  safety: "check.safety.v1",
  stepReachability: "check.step_reachability.v1",
  eventEvidence: "check.event_evidence.v1",
  seedRegistration: "check.seed_registration.v1",
  seedReplay: "check.seed_replay.v1",
  performanceBudget: "check.performance_budget.v1"
} as const);

export const WORKFLOW_VALIDATION_ISSUE_CODES = Object.freeze({
  schemaInvalid: "validation.schema_invalid.v1",
  registryIdUnknown: "validation.registry_id_unknown.v1",
  registryIdUnavailable: "validation.registry_id_unavailable.v1",
  configurationCategoryMismatch:
    "validation.configuration_category_mismatch.v1",
  duplicateId: "validation.duplicate_id.v1",
  referenceUnknown: "validation.instance_reference_unknown.v1",
  familyIncompatible: "validation.family_incompatible.v1",
  engineIncompatible: "validation.engine_incompatible.v1",
  skillNotSelected: "validation.skill_not_selected.v1",
  skillUnavailable: "validation.skill_unavailable.v1",
  skillRequiredComponentMissing:
    "validation.skill_required_component_missing.v1",
  componentActionIncompatible: "validation.component_action_incompatible.v1",
  componentRoleIncompatible: "validation.component_role_incompatible.v1",
  actionTargetIncompatible: "validation.action_target_incompatible.v1",
  actionPresetIncompatible: "validation.action_preset_incompatible.v1",
  actionLimitUnknown: "validation.action_limit_unknown.v1",
  actionLimitOutsideRegistry: "validation.action_limit_outside_registry.v1",
  reagentContainerIncompatible: "validation.reagent_container_incompatible.v1",
  reagentRoleIncompatible: "validation.reagent_role_incompatible.v1",
  reagentActionIncompatible: "validation.reagent_action_incompatible.v1",
  reagentAmountOutsideRegistry: "validation.reagent_amount_outside_registry.v1",
  reagentCapacityExceeded: "validation.reagent_capacity_exceeded.v1",
  stepOrderInvalid: "validation.step_order_invalid.v1",
  requiredStepEmpty: "validation.required_step_empty.v1",
  observationUnreachable: "validation.observation_unreachable.v1",
  observationExpectationIncomplete:
    "validation.observation_expectation_incomplete.v1",
  eventFlagIncompatible: "validation.event_flag_incompatible.v1",
  coachFlagNotEligible: "validation.coach_flag_not_eligible.v1",
  coachSkillMismatch: "validation.coach_skill_mismatch.v1",
  coachStaySilentMissing: "validation.coach_stay_silent_missing.v1",
  coachTriggerBroad: "validation.coach_trigger_broad.v1",
  rubricEvidenceUnreachable: "validation.rubric_evidence_unreachable.v1",
  retryIncompatible: "validation.retry_incompatible.v1",
  seedIncompatible: "validation.seed_incompatible.v1",
  seedReplayFailed: "validation.seed_replay_failed.v1",
  safetyProhibited: "validation.safety_prohibited.v1",
  safetyFamilyIncompatible: "validation.safety_family_incompatible.v1",
  performanceRestricted: "validation.performance_restricted.v1"
} as const);

type CheckId =
  (typeof WORKFLOW_VALIDATION_CHECK_IDS)[keyof typeof WORKFLOW_VALIDATION_CHECK_IDS];

const ALL_CHECK_IDS = Object.values(WORKFLOW_VALIDATION_CHECK_IDS);
const ISSUE = WORKFLOW_VALIDATION_ISSUE_CODES;
const CHECK = WORKFLOW_VALIDATION_CHECK_IDS;

export const LAB_WORKFLOW_REGISTRY_SNAPSHOT_IDS = Object.freeze({
  actions: actionRegistry.snapshotId,
  components: componentRegistry.snapshotId,
  configurations: configurationRegistry.snapshotId,
  engines: engineRegistry.snapshotId,
  eventFlags: eventFlagRegistry.snapshotId,
  eventTypes: eventTypeRegistry.snapshotId,
  reagents: reagentRegistry.snapshotId,
  safety: safetyRegistry.snapshotId,
  skills: skillRegistry.snapshotId
});

export const WORKFLOW_ELIGIBILITY_FAILURE_CODES = Object.freeze({
  schemaInvalid: "eligibility.schema_invalid.v1",
  statusNotRunnable: "eligibility.status_not_runnable.v1",
  validationNotRunnable: "eligibility.validation_not_runnable.v1",
  previewNotEligible: "eligibility.preview_not_eligible.v1",
  assignmentNotEligible: "eligibility.assignment_not_eligible.v1",
  validatorVersionStale: "eligibility.validator_version_stale.v1",
  registrySnapshotStale: "eligibility.registry_snapshot_stale.v1",
  hashMismatch: "eligibility.hash_mismatch.v1"
} as const);

export type LabWorkflowEligibilityPurpose = "assignment" | "preview";

export interface LabWorkflowEligibility {
  readonly eligible: boolean;
  readonly purpose: LabWorkflowEligibilityPurpose;
  readonly failureCodes: readonly string[];
}

export interface LabWorkflowValidationOptions {
  /** Injected to keep the validator deterministic and free of wall-clock reads. */
  readonly checkedAt: string;
}

export interface SchemaInvalidLabWorkflowValidation {
  readonly schemaValid: false;
  readonly spec: null;
  readonly validation: null;
  readonly issues: readonly ValidationIssue[];
}

export interface SchemaValidLabWorkflowValidation {
  readonly schemaValid: true;
  readonly spec: Readonly<ValidatedLabWorkflowSpec>;
  readonly validation: Readonly<ValidationResult>;
  readonly issues: readonly ValidationIssue[];
}

export type LabWorkflowValidationOutcome =
  | SchemaInvalidLabWorkflowValidation
  | SchemaValidLabWorkflowValidation;

interface IssueCollector {
  readonly issues: ValidationIssue[];
  readonly failedChecks: Set<CheckId>;
}

interface ResolvedComponent {
  readonly index: number;
  readonly spec: LabWorkflowDraft["components"][number];
  readonly entry: ComponentRegistryEntry | null;
}

const ACTION_ENTRIES: readonly ActionRegistryEntry[] = actionRegistry.list();
const COMPONENT_ENTRIES: readonly ComponentRegistryEntry[] =
  componentRegistry.list();
const CONFIGURATION_ENTRIES: readonly ConfigurationRegistryEntry[] =
  configurationRegistry.list();
const ENGINE_ENTRIES: readonly EngineRegistryEntry[] = engineRegistry.list();
const EVENT_FLAG_ENTRIES: readonly EventFlagRegistryEntry[] =
  eventFlagRegistry.list();
const EVENT_TYPE_ENTRIES: readonly EventTypeRegistryEntry[] =
  eventTypeRegistry.list();
const REAGENT_ENTRIES: readonly ReagentRegistryEntry[] = reagentRegistry.list();
const SAFETY_ENTRIES: readonly SafetyRegistryEntry[] = safetyRegistry.list();
const SKILL_ENTRIES: readonly SkillRegistryEntry[] = skillRegistry.list();

const ACTION_BY_ID: ReadonlyMap<string, ActionRegistryEntry> = new Map(
  ACTION_ENTRIES.map((entry) => [entry.id, entry])
);
const COMPONENT_BY_ID: ReadonlyMap<string, ComponentRegistryEntry> = new Map(
  COMPONENT_ENTRIES.map((entry) => [entry.id, entry])
);
const CONFIGURATION_BY_ID: ReadonlyMap<string, ConfigurationRegistryEntry> =
  new Map(CONFIGURATION_ENTRIES.map((entry) => [entry.id, entry]));
const ENGINE_BY_ID: ReadonlyMap<string, EngineRegistryEntry> = new Map(
  ENGINE_ENTRIES.map((entry) => [entry.id, entry])
);
const EVENT_FLAG_BY_ID: ReadonlyMap<string, EventFlagRegistryEntry> = new Map(
  EVENT_FLAG_ENTRIES.map((entry) => [entry.id, entry])
);
const EVENT_TYPE_BY_ID: ReadonlyMap<string, EventTypeRegistryEntry> = new Map(
  EVENT_TYPE_ENTRIES.map((entry) => [entry.id, entry])
);
const REAGENT_BY_ID: ReadonlyMap<string, ReagentRegistryEntry> = new Map(
  REAGENT_ENTRIES.map((entry) => [entry.id, entry])
);
const SAFETY_BY_ID: ReadonlyMap<string, SafetyRegistryEntry> = new Map(
  SAFETY_ENTRIES.map((entry) => [entry.id, entry])
);

function includesId(values: readonly string[], value: string): boolean {
  return values.includes(value);
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function sortedIds<TEntry extends { readonly id: string }>(
  entries: readonly TEntry[]
): string[] {
  return entries.map(({ id }) => id).sort();
}

function addIssue(
  collector: IssueCollector,
  checkId: CheckId,
  issue: ValidationIssue
): void {
  collector.issues.push(issue);
  collector.failedChecks.add(checkId);
}

function issue(
  code: string,
  path: string,
  message: string,
  options: {
    readonly severity?: ValidationIssue["severity"];
    readonly registryId?: string;
    readonly suggestedSupportedIds?: string[];
    readonly safetyRelated?: boolean;
  } = {}
): ValidationIssue {
  return {
    code,
    severity: options.severity ?? "error",
    path,
    message,
    ...(options.registryId ? { registryId: options.registryId } : {}),
    suggestedSupportedIds: options.suggestedSupportedIds ?? [],
    safetyRelated: options.safetyRelated ?? false
  };
}

function zodPath(issueValue: ZodIssue): string {
  if (issueValue.path.length === 0) return "$";
  return issueValue.path.reduce<string>((path, segment) => {
    if (typeof segment === "number") return `${path}[${segment}]`;
    return path ? `${path}.${String(segment)}` : String(segment);
  }, "");
}

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function stableIssues(issues: ValidationIssue[]): ValidationIssue[] {
  const severityOrder = { error: 0, warning: 1, info: 2 } as const;
  return [...issues].sort(
    (left, right) =>
      compareStrings(left.path, right.path) ||
      severityOrder[left.severity] - severityOrder[right.severity] ||
      compareStrings(left.code, right.code) ||
      compareStrings(left.registryId ?? "", right.registryId ?? "")
  );
}

function findSkill(id: string): SkillRegistryEntry | null {
  const resolution = skillRegistry.resolve(id);
  return resolution.status === "resolved" ? resolution.entry : null;
}

function canonicalSkillId(id: string): string {
  const resolution = skillRegistry.resolve(id);
  return resolution.status === "resolved" ? resolution.canonicalId : id;
}

function deriveSafetyConstraints(
  source: LabWorkflowSpec
): LabWorkflowDraft["safetyConstraints"] {
  const requestedById = new Map(
    source.safetyConstraints.map((constraint) => [constraint.id, constraint])
  );
  const safetyIds = new Set(requestedById.keys());

  for (const component of source.components) {
    const entry = COMPONENT_BY_ID.get(component.componentId);
    entry?.safetyConstraintIds.forEach((id) => safetyIds.add(id));
  }
  for (const reagent of source.reagents) {
    const entry = REAGENT_BY_ID.get(reagent.reagentId);
    entry?.safetyConstraintIds.forEach((id) => safetyIds.add(id));
  }

  return [...safetyIds].sort().map((id) => {
    const entry = SAFETY_BY_ID.get(id);
    if (!entry) return requestedById.get(id)!;

    const appliesTo = new Set<string>();
    for (const component of source.components) {
      if (
        includesId(
          COMPONENT_BY_ID.get(component.componentId)?.safetyConstraintIds ?? [],
          id
        )
      ) {
        appliesTo.add(component.instanceId);
      }
    }
    for (const reagent of source.reagents) {
      if (
        includesId(
          REAGENT_BY_ID.get(reagent.reagentId)?.safetyConstraintIds ?? [],
          id
        )
      ) {
        appliesTo.add(reagent.containerInstanceId);
      }
    }

    return {
      id: entry.id,
      appliesToInstanceIds: [...appliesTo].sort(),
      severity: entry.severity,
      studentFacingText: entry.studentFacingText,
      teacherFacingText: entry.teacherFacingText
    };
  });
}

function normalizeWorkflow(source: LabWorkflowSpec): LabWorkflowDraft {
  const normalized = {
    ...source,
    skillIds: source.skillIds.map(canonicalSkillId),
    reagents: source.reagents.map((reagent) => ({
      ...reagent,
      displayLabel:
        REAGENT_BY_ID.get(reagent.reagentId)?.displayName ??
        reagent.displayLabel
    })),
    steps: source.steps.map((step) => ({
      ...step,
      skillIds: step.skillIds.map(canonicalSkillId)
    })),
    coachTriggers: source.coachTriggers.map((trigger) => ({
      ...trigger,
      skillId: canonicalSkillId(trigger.skillId)
    })),
    rubric: {
      ...source.rubric,
      criteria: source.rubric.criteria.map((criterion) => ({
        ...criterion,
        skillIds: criterion.skillIds.map(canonicalSkillId)
      })),
      totalPoints: source.rubric.criteria.reduce(
        (total, criterion) => total + criterion.maxPoints,
        0
      )
    },
    adaptiveRetries: source.adaptiveRetries.map((retry) => ({
      ...retry,
      targetSkillIds: retry.targetSkillIds.map(canonicalSkillId)
    })),
    safetyConstraints: deriveSafetyConstraints(source),
    supportStatus: "draft_unvalidated" as const,
    validation: null,
    judgeCritique: null
  };
  return labWorkflowDraftSchema.parse(normalized);
}

function addUnknownRegistryIssue(
  collector: IssueCollector,
  path: string,
  kind: string,
  id: string,
  suggestions: string[],
  checkId: CheckId = CHECK.registryResolution
): void {
  addIssue(
    collector,
    checkId,
    issue(ISSUE.registryIdUnknown, path, `Unknown ${kind} registry ID: ${id}`, {
      registryId: id,
      suggestedSupportedIds: suggestions
    })
  );
}

function resolveConfiguration(
  collector: IssueCollector,
  id: string,
  path: string,
  expectedCategory: ConfigurationCategory,
  familyId: string,
  checkId: CheckId = CHECK.registryResolution
): ConfigurationRegistryEntry | null {
  const entry = CONFIGURATION_BY_ID.get(id);
  if (!entry) {
    addUnknownRegistryIssue(
      collector,
      path,
      expectedCategory,
      id,
      sortedIds(
        CONFIGURATION_ENTRIES.filter(
          ({ category }) => category === expectedCategory
        )
      ),
      checkId
    );
    return null;
  }
  if (entry.category !== expectedCategory) {
    addIssue(
      collector,
      checkId,
      issue(
        ISSUE.configurationCategoryMismatch,
        path,
        `${id} is registered as ${entry.category}, not ${expectedCategory}.`,
        {
          registryId: id,
          suggestedSupportedIds: sortedIds(
            CONFIGURATION_ENTRIES.filter(
              ({ category }) => category === expectedCategory
            )
          )
        }
      )
    );
  }
  if (!includesId(entry.compatibleFamilyIds, familyId)) {
    addIssue(
      collector,
      CHECK.compatibility,
      issue(
        ISSUE.familyIncompatible,
        path,
        `${id} is not compatible with family ${familyId}.`,
        { registryId: id }
      )
    );
  }
  return entry;
}

function addDuplicateIssues<T>(
  collector: IssueCollector,
  items: readonly T[],
  getId: (item: T) => string,
  pathForIndex: (index: number) => string
): void {
  const firstIndex = new Map<string, number>();
  items.forEach((item, index) => {
    const id = getId(item);
    const seenAt = firstIndex.get(id);
    if (seenAt === undefined) {
      firstIndex.set(id, index);
      return;
    }
    addIssue(
      collector,
      CHECK.registryResolution,
      issue(
        ISSUE.duplicateId,
        pathForIndex(index),
        `Duplicate ID ${id}; first declared at index ${seenAt}.`,
        { registryId: id }
      )
    );
  });
}

function validateSkillReference(
  collector: IssueCollector,
  id: string,
  path: string,
  familyId: string
): SkillRegistryEntry | null {
  const entry = findSkill(id);
  if (!entry) {
    addUnknownRegistryIssue(
      collector,
      path,
      "skill",
      id,
      sortedIds(
        SKILL_ENTRIES.filter(({ availability }) => availability === "verified")
      )
    );
    return null;
  }
  if (entry.availability !== "verified") {
    addIssue(
      collector,
      CHECK.registryResolution,
      issue(
        ISSUE.skillUnavailable,
        path,
        `Skill ${entry.id} is ${entry.availability}, not verified.`,
        {
          registryId: entry.id,
          suggestedSupportedIds: sortedIds(
            SKILL_ENTRIES.filter(
              ({ availability }) => availability === "verified"
            )
          )
        }
      )
    );
  }
  if (!entry.supportedFamilyIds.includes(familyId)) {
    addIssue(
      collector,
      CHECK.compatibility,
      issue(
        ISSUE.familyIncompatible,
        path,
        `Skill ${entry.id} is not compatible with family ${familyId}.`,
        { registryId: entry.id }
      )
    );
  }
  return entry;
}

function validateEventReference(
  collector: IssueCollector,
  id: string,
  path: string,
  engineId: string
): EventTypeRegistryEntry | null {
  const entry = EVENT_TYPE_BY_ID.get(id);
  if (!entry) {
    addUnknownRegistryIssue(
      collector,
      path,
      "event type",
      id,
      sortedIds(EVENT_TYPE_ENTRIES)
    );
    return null;
  }
  if (!includesId(entry.compatibleEngineIds, engineId)) {
    addIssue(
      collector,
      CHECK.compatibility,
      issue(
        ISSUE.engineIncompatible,
        path,
        `Event ${id} is not compatible with engine ${engineId}.`,
        { registryId: id }
      )
    );
  }
  const engine = ENGINE_BY_ID.get(engineId);
  if (
    engine &&
    !includesId(engine.semanticEventTypes, entry.semanticEventType)
  ) {
    addIssue(
      collector,
      CHECK.compatibility,
      issue(
        ISSUE.engineIncompatible,
        path,
        `Event ${id} is absent from engine ${engineId} capabilities.`,
        { registryId: id }
      )
    );
  }
  return entry;
}

function validateFlagReference(
  collector: IssueCollector,
  id: string,
  path: string,
  engineId: string
): EventFlagRegistryEntry | null {
  const entry = EVENT_FLAG_BY_ID.get(id);
  if (!entry) {
    addUnknownRegistryIssue(
      collector,
      path,
      "event flag",
      id,
      sortedIds(EVENT_FLAG_ENTRIES)
    );
    return null;
  }
  if (!includesId(entry.compatibleEngineIds, engineId)) {
    addIssue(
      collector,
      CHECK.compatibility,
      issue(
        ISSUE.engineIncompatible,
        path,
        `Flag ${id} is not compatible with engine ${engineId}.`,
        { registryId: id }
      )
    );
  }
  const engine = ENGINE_BY_ID.get(engineId);
  if (engine && !includesId(engine.semanticFlags, entry.semanticFlag)) {
    addIssue(
      collector,
      CHECK.compatibility,
      issue(
        ISSUE.engineIncompatible,
        path,
        `Flag ${id} is absent from engine ${engineId} capabilities.`,
        { registryId: id }
      )
    );
  }
  return entry;
}

function validateAuthoredLimits(
  collector: IssueCollector,
  action: LabWorkflowDraft["steps"][number]["allowedActions"][number],
  actionEntry: ActionRegistryEntry,
  path: string
): void {
  if (!action.authoredLimits) return;
  const parameters: readonly ActionParameterDefinition[] =
    actionEntry.parameters;

  for (const [key, value] of Object.entries(action.authoredLimits)) {
    const minimumParameter = parameters.find(
      ({ authoredMinimumKey }) => authoredMinimumKey === key
    );
    const maximumParameter = parameters.find(
      ({ authoredMaximumKey }) => authoredMaximumKey === key
    );
    const parameter = minimumParameter ?? maximumParameter;
    if (!parameter) {
      addIssue(
        collector,
        CHECK.compatibility,
        issue(
          ISSUE.actionLimitUnknown,
          `${path}.authoredLimits.${key}`,
          `${key} is not an authorable limit for action ${actionEntry.id}.`,
          { registryId: actionEntry.id }
        )
      );
      continue;
    }

    const outsideMinimum =
      minimumParameter !== undefined &&
      (parameter.minimum === undefined ||
        value < parameter.minimum ||
        (parameter.maximum !== undefined && value > parameter.maximum));
    const outsideMaximum =
      maximumParameter !== undefined &&
      (parameter.maximum === undefined ||
        value > parameter.maximum ||
        (parameter.minimum !== undefined && value < parameter.minimum));
    if (outsideMinimum || outsideMaximum) {
      addIssue(
        collector,
        CHECK.safety,
        issue(
          ISSUE.actionLimitOutsideRegistry,
          `${path}.authoredLimits.${key}`,
          `${key}=${value} falls outside the registered ${parameter.key} range.`,
          { registryId: actionEntry.id, safetyRelated: true }
        )
      );
    }
  }
}

function determineStatus(
  issues: readonly ValidationIssue[],
  spec: LabWorkflowDraft
): Exclude<WorkflowSupportStatus, "draft_unvalidated"> {
  const errors = issues.filter(({ severity }) => severity === "error");
  if (errors.length === 0) return "runnable";
  if (errors.some(({ safetyRelated }) => safetyRelated)) {
    return "rejected_for_safety";
  }

  const partialCodes = new Set<string>([
    ISSUE.skillUnavailable,
    ISSUE.skillRequiredComponentMissing,
    ISSUE.familyIncompatible,
    ISSUE.skillNotSelected
  ]);
  const hasVerifiedSkill = spec.skillIds.some(
    (id) => findSkill(id)?.availability === "verified"
  );
  if (hasVerifiedSkill && errors.every(({ code }) => partialCodes.has(code))) {
    return "partially_supported";
  }
  return "unsupported";
}

function validateResolvedWorkflow(
  source: LabWorkflowSpec,
  spec: LabWorkflowDraft,
  collector: IssueCollector
): void {
  const knownFamilyIds = [
    ...new Set(ENGINE_ENTRIES.map(({ familyId }) => familyId))
  ].sort();
  if (
    !knownFamilyIds.includes(spec.familyId as (typeof knownFamilyIds)[number])
  ) {
    addUnknownRegistryIssue(
      collector,
      "familyId",
      "family",
      spec.familyId,
      knownFamilyIds
    );
  }

  const engine = ENGINE_BY_ID.get(spec.engineId) ?? null;
  if (!engine) {
    addUnknownRegistryIssue(
      collector,
      "engineId",
      "engine",
      spec.engineId,
      sortedIds(ENGINE_ENTRIES)
    );
  } else {
    if (engine.availability !== "verified") {
      addIssue(
        collector,
        CHECK.registryResolution,
        issue(
          ISSUE.registryIdUnavailable,
          "engineId",
          `Engine ${engine.id} is not verified.`,
          { registryId: engine.id }
        )
      );
    }
    if (engine.familyId !== spec.familyId) {
      addIssue(
        collector,
        CHECK.compatibility,
        issue(
          ISSUE.familyIncompatible,
          "engineId",
          `Engine ${engine.id} belongs to ${engine.familyId}, not ${spec.familyId}.`,
          { registryId: engine.id }
        )
      );
    }
  }

  const engineConfig = resolveConfiguration(
    collector,
    spec.engineConfigId,
    "engineConfigId",
    "engine_configuration",
    spec.familyId
  );
  if (
    engine &&
    engineConfig &&
    !engine.engineConfigIds.includes(spec.engineConfigId)
  ) {
    addIssue(
      collector,
      CHECK.compatibility,
      issue(
        ISSUE.engineIncompatible,
        "engineConfigId",
        `${spec.engineConfigId} is not supported by engine ${engine.id}.`,
        { registryId: spec.engineConfigId }
      )
    );
  }

  const seed = resolveConfiguration(
    collector,
    spec.initializationPresetId,
    "initializationPresetId",
    "seed_template",
    spec.familyId,
    CHECK.seedRegistration
  );
  if (
    engine &&
    seed &&
    !engine.seedTemplateIds.includes(spec.initializationPresetId)
  ) {
    addIssue(
      collector,
      CHECK.seedRegistration,
      issue(
        ISSUE.seedIncompatible,
        "initializationPresetId",
        `${spec.initializationPresetId} is not supported by engine ${engine.id}.`,
        { registryId: spec.initializationPresetId }
      )
    );
  }
  if (
    engine &&
    seed &&
    engine.seedTemplateIds.includes(spec.initializationPresetId) &&
    !verifyRegisteredSeedReplay(engine.id, spec.initializationPresetId)
  ) {
    addIssue(
      collector,
      CHECK.seedReplay,
      issue(
        ISSUE.seedReplayFailed,
        "initializationPresetId",
        `${spec.initializationPresetId} did not replay through engine ${engine.id}.`,
        { registryId: spec.initializationPresetId }
      )
    );
  }
  resolveConfiguration(
    collector,
    spec.metadata.deviceProfileId,
    "metadata.deviceProfileId",
    "device_profile",
    spec.familyId,
    CHECK.performanceBudget
  );

  addDuplicateIssues(
    collector,
    spec.skillIds,
    (id) => id,
    (index) => `skillIds[${index}]`
  );
  addDuplicateIssues(
    collector,
    spec.components,
    ({ instanceId }) => instanceId,
    (index) => `components[${index}].instanceId`
  );
  addDuplicateIssues(
    collector,
    spec.reagents,
    ({ instanceId }) => instanceId,
    (index) => `reagents[${index}].instanceId`
  );
  addDuplicateIssues(
    collector,
    spec.steps,
    ({ id }) => id,
    (index) => `steps[${index}].id`
  );
  addDuplicateIssues(
    collector,
    spec.coachTriggers,
    ({ id }) => id,
    (index) => `coachTriggers[${index}].id`
  );
  addDuplicateIssues(
    collector,
    spec.rubric.criteria,
    ({ id }) => id,
    (index) => `rubric.criteria[${index}].id`
  );
  addDuplicateIssues(
    collector,
    spec.adaptiveRetries,
    ({ id }) => id,
    (index) => `adaptiveRetries[${index}].id`
  );
  addDuplicateIssues(
    collector,
    source.safetyConstraints,
    ({ id }) => id,
    (index) => `safetyConstraints[${index}].id`
  );

  const componentInstances = new Map<string, ResolvedComponent>();
  spec.components.forEach((component, index) => {
    const entry = COMPONENT_BY_ID.get(component.componentId) ?? null;
    if (!entry) {
      addUnknownRegistryIssue(
        collector,
        `components[${index}].componentId`,
        "component",
        component.componentId,
        sortedIds(COMPONENT_ENTRIES)
      );
    } else {
      if (!entry.compatibleFamilyIds.includes(spec.familyId)) {
        addIssue(
          collector,
          CHECK.compatibility,
          issue(
            ISSUE.familyIncompatible,
            `components[${index}].componentId`,
            `${entry.id} is not compatible with family ${spec.familyId}.`,
            { registryId: entry.id }
          )
        );
      }
      if (!entry.allowedRoleIds.includes(component.role)) {
        addIssue(
          collector,
          CHECK.compatibility,
          issue(
            ISSUE.componentRoleIncompatible,
            `components[${index}].role`,
            `${component.role} is not a registered role for ${entry.id}.`,
            {
              registryId: entry.id,
              suggestedSupportedIds: [...entry.allowedRoleIds].sort()
            }
          )
        );
      }
      if (engine && !engine.componentIds.includes(entry.id)) {
        addIssue(
          collector,
          CHECK.compatibility,
          issue(
            ISSUE.engineIncompatible,
            `components[${index}].componentId`,
            `${entry.id} is not supported by engine ${engine.id}.`,
            { registryId: entry.id }
          )
        );
      }
      if (entry.performanceTier === "restricted") {
        addIssue(
          collector,
          CHECK.performanceBudget,
          issue(
            ISSUE.performanceRestricted,
            `components[${index}].componentId`,
            `${entry.id} is restricted for this device profile.`,
            { registryId: entry.id, safetyRelated: true }
          )
        );
      }
    }

    const configuration = resolveConfiguration(
      collector,
      component.configurationPresetId,
      `components[${index}].configurationPresetId`,
      "component_configuration",
      spec.familyId
    );
    if (
      entry &&
      configuration &&
      configuration.compatibleComponentIds.length > 0 &&
      !configuration.compatibleComponentIds.includes(entry.id)
    ) {
      addIssue(
        collector,
        CHECK.compatibility,
        issue(
          ISSUE.componentActionIncompatible,
          `components[${index}].configurationPresetId`,
          `${configuration.id} is not compatible with ${entry.id}.`,
          { registryId: configuration.id }
        )
      );
    }
    const placement = resolveConfiguration(
      collector,
      component.placementSlotId,
      `components[${index}].placementSlotId`,
      "placement",
      spec.familyId
    );
    if (
      entry &&
      placement &&
      placement.compatibleComponentIds.length > 0 &&
      !placement.compatibleComponentIds.includes(entry.id)
    ) {
      addIssue(
        collector,
        CHECK.compatibility,
        issue(
          ISSUE.componentActionIncompatible,
          `components[${index}].placementSlotId`,
          `${placement.id} is not compatible with ${entry.id}.`,
          { registryId: placement.id }
        )
      );
    }
    if (!componentInstances.has(component.instanceId)) {
      componentInstances.set(component.instanceId, {
        index,
        spec: component,
        entry
      });
    }
  });

  const rootSkillIds = new Set(spec.skillIds);
  const rootSkills = spec.skillIds.map((id, index) =>
    validateSkillReference(collector, id, `skillIds[${index}]`, spec.familyId)
  );
  rootSkills.forEach((skill, index) => {
    if (!skill) return;
    for (const requiredComponentId of skill.requiredComponentIds) {
      if (
        !spec.components.some(
          ({ componentId, required }) =>
            componentId === requiredComponentId && required
        )
      ) {
        addIssue(
          collector,
          CHECK.compatibility,
          issue(
            ISSUE.skillRequiredComponentMissing,
            `skillIds[${index}]`,
            `Skill ${skill.id} requires component ${requiredComponentId}.`,
            {
              registryId: requiredComponentId,
              suggestedSupportedIds: COMPONENT_BY_ID.has(requiredComponentId)
                ? [requiredComponentId]
                : []
            }
          )
        );
      }
    }
  });

  spec.reagents.forEach((reagent, index) => {
    const entry = REAGENT_BY_ID.get(reagent.reagentId) ?? null;
    if (!entry) {
      addUnknownRegistryIssue(
        collector,
        `reagents[${index}].reagentId`,
        "reagent",
        reagent.reagentId,
        sortedIds(REAGENT_ENTRIES)
      );
    } else {
      if (!includesId(entry.compatibleFamilyIds, spec.familyId)) {
        addIssue(
          collector,
          CHECK.compatibility,
          issue(
            ISSUE.familyIncompatible,
            `reagents[${index}].reagentId`,
            `${entry.id} is not compatible with family ${spec.familyId}.`,
            { registryId: entry.id }
          )
        );
      }
      if (
        !includesId(entry.compatibleEngineIds, spec.engineId) ||
        (engine && !engine.reagentIds.includes(entry.id))
      ) {
        addIssue(
          collector,
          CHECK.compatibility,
          issue(
            ISSUE.engineIncompatible,
            `reagents[${index}].reagentId`,
            `${entry.id} is not compatible with engine ${spec.engineId}.`,
            { registryId: entry.id }
          )
        );
      }
      if (!includesId(entry.allowedRoleIds, reagent.role)) {
        addIssue(
          collector,
          CHECK.compatibility,
          issue(
            ISSUE.reagentRoleIncompatible,
            `reagents[${index}].role`,
            `${reagent.role} is not a registered role for ${entry.id}.`,
            { registryId: entry.id }
          )
        );
      }
      const amountLimit = entry.requestedAmountLimits.find(
        ({ unitId }) => unitId === reagent.amountUnitId
      );
      if (!amountLimit) {
        addIssue(
          collector,
          CHECK.compatibility,
          issue(
            ISSUE.reagentAmountOutsideRegistry,
            `reagents[${index}].amountUnitId`,
            `${reagent.amountUnitId} is not registered for ${entry.id}.`,
            {
              registryId: entry.id,
              suggestedSupportedIds: entry.requestedAmountLimits.map(
                ({ unitId }) => unitId
              )
            }
          )
        );
      } else if (
        reagent.requestedAmount < amountLimit.minimum ||
        reagent.requestedAmount > amountLimit.maximum
      ) {
        addIssue(
          collector,
          CHECK.safety,
          issue(
            ISSUE.reagentAmountOutsideRegistry,
            `reagents[${index}].requestedAmount`,
            `${reagent.requestedAmount} ${reagent.amountUnitId} falls outside the registered amount range for ${entry.id}.`,
            { registryId: entry.id, safetyRelated: true }
          )
        );
      }
    }

    const container = componentInstances.get(reagent.containerInstanceId);
    if (!container) {
      addIssue(
        collector,
        CHECK.registryResolution,
        issue(
          ISSUE.referenceUnknown,
          `reagents[${index}].containerInstanceId`,
          `Unknown component instance ${reagent.containerInstanceId}.`,
          { registryId: reagent.containerInstanceId }
        )
      );
    } else if (entry && container.entry) {
      if (!entry.compatibleContainerComponentIds.includes(container.entry.id)) {
        addIssue(
          collector,
          CHECK.compatibility,
          issue(
            ISSUE.reagentContainerIncompatible,
            `reagents[${index}].containerInstanceId`,
            `${entry.id} cannot use container ${container.entry.id}.`,
            { registryId: entry.id }
          )
        );
      }
      if (
        reagent.amountUnitId === "unit.ml.v1" &&
        container.entry.measurement &&
        reagent.requestedAmount > container.entry.measurement.capacityML
      ) {
        addIssue(
          collector,
          CHECK.safety,
          issue(
            ISSUE.reagentCapacityExceeded,
            `reagents[${index}].requestedAmount`,
            `${reagent.requestedAmount} mL exceeds the registered ${container.entry.measurement.capacityML} mL capacity.`,
            { registryId: container.entry.id, safetyRelated: true }
          )
        );
      }
    }
    resolveConfiguration(
      collector,
      reagent.amountUnitId,
      `reagents[${index}].amountUnitId`,
      "unit",
      spec.familyId
    );
  });

  source.safetyConstraints.forEach((constraint, index) => {
    const entry = SAFETY_BY_ID.get(constraint.id);
    if (!entry) {
      addUnknownRegistryIssue(
        collector,
        `safetyConstraints[${index}].id`,
        "safety",
        constraint.id,
        sortedIds(SAFETY_ENTRIES)
      );
      return;
    }
    if (entry.prohibited || entry.availability === "restricted") {
      addIssue(
        collector,
        CHECK.safety,
        issue(
          ISSUE.safetyProhibited,
          `safetyConstraints[${index}].id`,
          `${entry.id} is prohibited by the verified safety policy.`,
          { registryId: entry.id, safetyRelated: true }
        )
      );
    } else if (!entry.compatibleFamilyIds.includes(spec.familyId)) {
      addIssue(
        collector,
        CHECK.safety,
        issue(
          ISSUE.safetyFamilyIncompatible,
          `safetyConstraints[${index}].id`,
          `${entry.id} is not compatible with family ${spec.familyId}.`,
          { registryId: entry.id, safetyRelated: true }
        )
      );
    }
  });

  const reachableEventTypes = new Set<string>();
  const stepSkillCoverage = new Set<string>();

  spec.steps.forEach((step, stepIndex) => {
    if (step.order !== stepIndex + 1) {
      addIssue(
        collector,
        CHECK.stepReachability,
        issue(
          ISSUE.stepOrderInvalid,
          `steps[${stepIndex}].order`,
          `Linear workflows require order ${stepIndex + 1} at this position.`,
          {}
        )
      );
    }
    if (!step.optional && step.allowedActions.length === 0) {
      addIssue(
        collector,
        CHECK.stepReachability,
        issue(
          ISSUE.requiredStepEmpty,
          `steps[${stepIndex}].allowedActions`,
          "A required step must expose at least one registered action."
        )
      );
    }
    if (
      !step.optional &&
      !step.expectedObservations.some(({ requiredForCompletion }) =>
        Boolean(requiredForCompletion)
      )
    ) {
      addIssue(
        collector,
        CHECK.stepReachability,
        issue(
          ISSUE.requiredStepEmpty,
          `steps[${stepIndex}].expectedObservations`,
          "A required step must declare completion evidence."
        )
      );
    }

    addDuplicateIssues(
      collector,
      step.skillIds,
      (id) => id,
      (index) => `steps[${stepIndex}].skillIds[${index}]`
    );
    addDuplicateIssues(
      collector,
      step.componentInstanceIds,
      (id) => id,
      (index) => `steps[${stepIndex}].componentInstanceIds[${index}]`
    );
    const stepComponentIds = new Set(step.componentInstanceIds);
    step.componentInstanceIds.forEach((instanceId, componentIndex) => {
      if (!componentInstances.has(instanceId)) {
        addIssue(
          collector,
          CHECK.registryResolution,
          issue(
            ISSUE.referenceUnknown,
            `steps[${stepIndex}].componentInstanceIds[${componentIndex}]`,
            `Unknown component instance ${instanceId}.`,
            { registryId: instanceId }
          )
        );
      }
    });

    step.skillIds.forEach((skillId, skillIndex) => {
      validateSkillReference(
        collector,
        skillId,
        `steps[${stepIndex}].skillIds[${skillIndex}]`,
        spec.familyId
      );
      stepSkillCoverage.add(skillId);
      if (!rootSkillIds.has(skillId)) {
        addIssue(
          collector,
          CHECK.compatibility,
          issue(
            ISSUE.skillNotSelected,
            `steps[${stepIndex}].skillIds[${skillIndex}]`,
            `Step skill ${skillId} is not declared in workflow skillIds.`,
            { registryId: skillId }
          )
        );
      }
    });

    const stepEventTypes = new Set<string>();
    step.allowedActions.forEach((action, actionIndex) => {
      const path = `steps[${stepIndex}].allowedActions[${actionIndex}]`;
      const actionEntry = ACTION_BY_ID.get(action.actionId) ?? null;
      if (!actionEntry) {
        addUnknownRegistryIssue(
          collector,
          `${path}.actionId`,
          "action",
          action.actionId,
          sortedIds(ACTION_ENTRIES)
        );
      } else {
        actionEntry.emittedSemanticEventTypes.forEach((eventType) => {
          stepEventTypes.add(eventType);
          reachableEventTypes.add(eventType);
        });
        if (
          !includesId(actionEntry.compatibleFamilyIds, spec.familyId) ||
          !includesId(actionEntry.compatibleEngineIds, spec.engineId) ||
          (engine && !engine.actionIds.includes(actionEntry.id))
        ) {
          addIssue(
            collector,
            CHECK.compatibility,
            issue(
              ISSUE.engineIncompatible,
              `${path}.actionId`,
              `${actionEntry.id} is not compatible with the selected engine/family.`,
              { registryId: actionEntry.id }
            )
          );
        }
        for (const roleId of actionEntry.requiredReagentRoleIds) {
          if (!spec.reagents.some(({ role }) => role === roleId)) {
            addIssue(
              collector,
              CHECK.compatibility,
              issue(
                ISSUE.reagentActionIncompatible,
                `${path}.actionId`,
                `${actionEntry.id} requires a verified reagent with role ${roleId}.`,
                { registryId: roleId, suggestedSupportedIds: [roleId] }
              )
            );
          }
        }
      }

      const actor = componentInstances.get(action.actorComponentInstanceId);
      if (!actor) {
        addIssue(
          collector,
          CHECK.registryResolution,
          issue(
            ISSUE.referenceUnknown,
            `${path}.actorComponentInstanceId`,
            `Unknown component instance ${action.actorComponentInstanceId}.`,
            { registryId: action.actorComponentInstanceId }
          )
        );
      } else {
        if (!stepComponentIds.has(action.actorComponentInstanceId)) {
          addIssue(
            collector,
            CHECK.stepReachability,
            issue(
              ISSUE.referenceUnknown,
              `${path}.actorComponentInstanceId`,
              `Actor ${action.actorComponentInstanceId} is not available in this step.`,
              { registryId: action.actorComponentInstanceId }
            )
          );
        }
        if (
          actionEntry &&
          actor.entry &&
          (!actionEntry.actorComponentIds.includes(actor.entry.id) ||
            !actor.entry.allowedActionIds.includes(actionEntry.id))
        ) {
          addIssue(
            collector,
            CHECK.compatibility,
            issue(
              ISSUE.componentActionIncompatible,
              `${path}.actorComponentInstanceId`,
              `${actor.entry.id} cannot act through ${actionEntry.id}.`,
              { registryId: actor.entry.id }
            )
          );
        }
      }

      if (
        actionEntry &&
        actionEntry.targetComponentIds.length > 0 &&
        action.targetComponentInstanceIds.length === 0
      ) {
        addIssue(
          collector,
          CHECK.compatibility,
          issue(
            ISSUE.actionTargetIncompatible,
            `${path}.targetComponentInstanceIds`,
            `${actionEntry.id} requires a compatible target.`,
            { registryId: actionEntry.id }
          )
        );
      }
      if (
        actionEntry &&
        actionEntry.targetComponentIds.length === 0 &&
        action.targetComponentInstanceIds.length > 0
      ) {
        addIssue(
          collector,
          CHECK.compatibility,
          issue(
            ISSUE.actionTargetIncompatible,
            `${path}.targetComponentInstanceIds`,
            `${actionEntry.id} does not accept targets.`,
            { registryId: actionEntry.id }
          )
        );
      }
      action.targetComponentInstanceIds.forEach((targetId, targetIndex) => {
        const target = componentInstances.get(targetId);
        if (!target) {
          addIssue(
            collector,
            CHECK.registryResolution,
            issue(
              ISSUE.referenceUnknown,
              `${path}.targetComponentInstanceIds[${targetIndex}]`,
              `Unknown component instance ${targetId}.`,
              { registryId: targetId }
            )
          );
          return;
        }
        if (!stepComponentIds.has(targetId)) {
          addIssue(
            collector,
            CHECK.stepReachability,
            issue(
              ISSUE.referenceUnknown,
              `${path}.targetComponentInstanceIds[${targetIndex}]`,
              `Target ${targetId} is not available in this step.`,
              { registryId: targetId }
            )
          );
        }
        if (
          actionEntry &&
          target.entry &&
          !actionEntry.targetComponentIds.includes(target.entry.id)
        ) {
          addIssue(
            collector,
            CHECK.compatibility,
            issue(
              ISSUE.actionTargetIncompatible,
              `${path}.targetComponentInstanceIds[${targetIndex}]`,
              `${target.entry.id} is not a target for ${actionEntry.id}.`,
              { registryId: target.entry.id }
            )
          );
        }
      });
      addDuplicateIssues(
        collector,
        action.targetComponentInstanceIds,
        (id) => id,
        (index) => `${path}.targetComponentInstanceIds[${index}]`
      );

      const preset = resolveConfiguration(
        collector,
        action.parameterPresetId,
        `${path}.parameterPresetId`,
        "action_parameters",
        spec.familyId
      );
      if (
        actionEntry &&
        preset &&
        preset.compatibleActionIds.length > 0 &&
        !preset.compatibleActionIds.includes(actionEntry.id)
      ) {
        addIssue(
          collector,
          CHECK.compatibility,
          issue(
            ISSUE.actionPresetIncompatible,
            `${path}.parameterPresetId`,
            `${preset.id} is not compatible with ${actionEntry.id}.`,
            { registryId: preset.id }
          )
        );
      }
      if (actionEntry)
        validateAuthoredLimits(collector, action, actionEntry, path);
    });

    addDuplicateIssues(
      collector,
      step.expectedObservations,
      ({ id }) => id,
      (index) => `steps[${stepIndex}].expectedObservations[${index}].id`
    );
    step.expectedObservations.forEach((observation, observationIndex) => {
      const path = `steps[${stepIndex}].expectedObservations[${observationIndex}]`;
      const event = validateEventReference(
        collector,
        observation.eventTypeId,
        `${path}.eventTypeId`,
        spec.engineId
      );
      if (event && !stepEventTypes.has(event.semanticEventType)) {
        addIssue(
          collector,
          CHECK.stepReachability,
          issue(
            ISSUE.observationUnreachable,
            `${path}.eventTypeId`,
            `No allowed action in this step emits ${event.semanticEventType}.`,
            { registryId: observation.eventTypeId }
          )
        );
      }
      if (
        (observation.expectation === "flag_present" ||
          observation.expectation === "flag_absent") &&
        !observation.flagId
      ) {
        addIssue(
          collector,
          CHECK.eventEvidence,
          issue(
            ISSUE.observationExpectationIncomplete,
            `${path}.flagId`,
            `${observation.expectation} requires a flagId.`
          )
        );
      }
      if (
        observation.expectation === "value_recorded" &&
        !observation.observationKeyId
      ) {
        addIssue(
          collector,
          CHECK.eventEvidence,
          issue(
            ISSUE.observationExpectationIncomplete,
            `${path}.observationKeyId`,
            "value_recorded requires an observationKeyId."
          )
        );
      }
      if (observation.observationKeyId) {
        const observationKey = resolveConfiguration(
          collector,
          observation.observationKeyId,
          `${path}.observationKeyId`,
          "observation_key",
          spec.familyId,
          CHECK.eventEvidence
        );
        if (
          event &&
          observationKey?.adapterKey &&
          !event.observationKeys.includes(observationKey.adapterKey)
        ) {
          addIssue(
            collector,
            CHECK.eventEvidence,
            issue(
              ISSUE.observationUnreachable,
              `${path}.observationKeyId`,
              `${observationKey.id} is not emitted by ${event.id}.`,
              { registryId: observationKey.id }
            )
          );
        }
      }
      if (observation.flagId) {
        const flag = validateFlagReference(
          collector,
          observation.flagId,
          `${path}.flagId`,
          spec.engineId
        );
        if (
          flag &&
          event &&
          (!flag.emittedBySemanticEventTypes.includes(
            event.semanticEventType
          ) ||
            !event.emittedSemanticFlags.includes(flag.semanticFlag))
        ) {
          addIssue(
            collector,
            CHECK.eventEvidence,
            issue(
              ISSUE.eventFlagIncompatible,
              `${path}.flagId`,
              `${flag.id} is not emitted by ${event.id}.`,
              { registryId: flag.id }
            )
          );
        }
        if (flag && !step.skillIds.includes(flag.canonicalSkillId)) {
          addIssue(
            collector,
            CHECK.eventEvidence,
            issue(
              ISSUE.eventFlagIncompatible,
              `${path}.flagId`,
              `${flag.id} does not provide evidence for a skill in this step.`,
              { registryId: flag.id }
            )
          );
        }
      }
      if (observation.expectedValueSourceId) {
        resolveConfiguration(
          collector,
          observation.expectedValueSourceId,
          `${path}.expectedValueSourceId`,
          "observable",
          spec.familyId,
          CHECK.eventEvidence
        );
      }
    });
    resolveConfiguration(
      collector,
      step.completionPolicyId,
      `steps[${stepIndex}].completionPolicyId`,
      "completion_policy",
      spec.familyId,
      CHECK.stepReachability
    );
  });

  spec.skillIds.forEach((skillId, index) => {
    if (!stepSkillCoverage.has(skillId)) {
      addIssue(
        collector,
        CHECK.stepReachability,
        issue(
          ISSUE.skillNotSelected,
          `skillIds[${index}]`,
          `Skill ${skillId} is not targeted by any workflow step.`,
          { registryId: skillId }
        )
      );
    }
  });

  spec.coachTriggers.forEach((trigger, triggerIndex) => {
    const path = `coachTriggers[${triggerIndex}]`;
    validateSkillReference(
      collector,
      trigger.skillId,
      `${path}.skillId`,
      spec.familyId
    );
    if (!rootSkillIds.has(trigger.skillId)) {
      addIssue(
        collector,
        CHECK.eventEvidence,
        issue(
          ISSUE.skillNotSelected,
          `${path}.skillId`,
          `Coach skill ${trigger.skillId} is not selected by the workflow.`,
          { registryId: trigger.skillId }
        )
      );
    }
    const triggerEvents = trigger.eventTypeIds
      .map((eventId, eventIndex) =>
        validateEventReference(
          collector,
          eventId,
          `${path}.eventTypeIds[${eventIndex}]`,
          spec.engineId
        )
      )
      .filter((entry): entry is EventTypeRegistryEntry => entry !== null);
    triggerEvents.forEach((event, eventIndex) => {
      if (!reachableEventTypes.has(event.semanticEventType)) {
        addIssue(
          collector,
          CHECK.eventEvidence,
          issue(
            ISSUE.observationUnreachable,
            `${path}.eventTypeIds[${eventIndex}]`,
            `No workflow action emits ${event.semanticEventType}.`,
            { registryId: event.id }
          )
        );
      }
    });
    if (trigger.flagIds.length === 0) {
      addIssue(
        collector,
        CHECK.eventEvidence,
        issue(
          ISSUE.coachTriggerBroad,
          `${path}.flagIds`,
          "A flag-free coach trigger may interrupt routine successful actions.",
          { severity: "warning" }
        )
      );
    }
    trigger.flagIds.forEach((flagId, flagIndex) => {
      const flag = validateFlagReference(
        collector,
        flagId,
        `${path}.flagIds[${flagIndex}]`,
        spec.engineId
      );
      if (!flag) return;
      if (!flag.coachEligible) {
        addIssue(
          collector,
          CHECK.eventEvidence,
          issue(
            ISSUE.coachFlagNotEligible,
            `${path}.flagIds[${flagIndex}]`,
            `${flag.id} is not coach eligible.`,
            { registryId: flag.id }
          )
        );
      }
      if (flag.canonicalSkillId !== trigger.skillId) {
        addIssue(
          collector,
          CHECK.eventEvidence,
          issue(
            ISSUE.coachSkillMismatch,
            `${path}.flagIds[${flagIndex}]`,
            `${flag.id} belongs to skill ${flag.canonicalSkillId}, not ${trigger.skillId}.`,
            { registryId: flag.id }
          )
        );
      }
      if (
        !triggerEvents.some((event) =>
          flag.emittedBySemanticEventTypes.includes(event.semanticEventType)
        )
      ) {
        addIssue(
          collector,
          CHECK.eventEvidence,
          issue(
            ISSUE.eventFlagIncompatible,
            `${path}.flagIds[${flagIndex}]`,
            `${flag.id} is not emitted by any trigger event.`,
            { registryId: flag.id }
          )
        );
      }
      if (
        flag.positiveStaySilentEvidenceReasonId &&
        !trigger.staySilentOnEventReasonIds.includes(
          flag.positiveStaySilentEvidenceReasonId
        )
      ) {
        addIssue(
          collector,
          CHECK.eventEvidence,
          issue(
            ISSUE.coachStaySilentMissing,
            `${path}.staySilentOnEventReasonIds`,
            `${flag.id} requires stay-silent evidence ${flag.positiveStaySilentEvidenceReasonId}.`,
            { registryId: flag.positiveStaySilentEvidenceReasonId }
          )
        );
      }
    });
    trigger.staySilentOnEventReasonIds.forEach((reasonId, reasonIndex) => {
      resolveConfiguration(
        collector,
        reasonId,
        `${path}.staySilentOnEventReasonIds[${reasonIndex}]`,
        "evidence_reason",
        spec.familyId,
        CHECK.eventEvidence
      );
    });
    resolveConfiguration(
      collector,
      trigger.triggerTypeId,
      `${path}.triggerTypeId`,
      "coach_trigger",
      spec.familyId,
      CHECK.eventEvidence
    );
    resolveConfiguration(
      collector,
      trigger.hintStrategyId,
      `${path}.hintStrategyId`,
      "hint_strategy",
      spec.familyId,
      CHECK.eventEvidence
    );
  });

  resolveConfiguration(
    collector,
    spec.rubric.passingPolicyId,
    "rubric.passingPolicyId",
    "passing_policy",
    spec.familyId,
    CHECK.eventEvidence
  );
  spec.rubric.criteria.forEach((criterion, criterionIndex) => {
    const path = `rubric.criteria[${criterionIndex}]`;
    criterion.skillIds.forEach((skillId, skillIndex) => {
      validateSkillReference(
        collector,
        skillId,
        `${path}.skillIds[${skillIndex}]`,
        spec.familyId
      );
      if (!rootSkillIds.has(skillId)) {
        addIssue(
          collector,
          CHECK.eventEvidence,
          issue(
            ISSUE.skillNotSelected,
            `${path}.skillIds[${skillIndex}]`,
            `Rubric skill ${skillId} is not selected by the workflow.`,
            { registryId: skillId }
          )
        );
      }
    });
    resolveConfiguration(
      collector,
      criterion.assessmentModeId,
      `${path}.assessmentModeId`,
      "assessment_mode",
      spec.familyId,
      CHECK.eventEvidence
    );
    const rubricEvents = criterion.requiredEventTypeIds
      .map((eventId, eventIndex) =>
        validateEventReference(
          collector,
          eventId,
          `${path}.requiredEventTypeIds[${eventIndex}]`,
          spec.engineId
        )
      )
      .filter((entry): entry is EventTypeRegistryEntry => entry !== null);
    rubricEvents.forEach((event, eventIndex) => {
      if (!reachableEventTypes.has(event.semanticEventType)) {
        addIssue(
          collector,
          CHECK.eventEvidence,
          issue(
            ISSUE.rubricEvidenceUnreachable,
            `${path}.requiredEventTypeIds[${eventIndex}]`,
            `No workflow action emits ${event.semanticEventType}.`,
            { registryId: event.id }
          )
        );
      }
    });
    criterion.requiredObservationKeyIds.forEach((observationId, index) => {
      const observation = resolveConfiguration(
        collector,
        observationId,
        `${path}.requiredObservationKeyIds[${index}]`,
        "observation_key",
        spec.familyId,
        CHECK.eventEvidence
      );
      if (
        observation?.adapterKey &&
        rubricEvents.length > 0 &&
        !rubricEvents.some((event) =>
          event.observationKeys.includes(observation.adapterKey!)
        )
      ) {
        addIssue(
          collector,
          CHECK.eventEvidence,
          issue(
            ISSUE.rubricEvidenceUnreachable,
            `${path}.requiredObservationKeyIds[${index}]`,
            `${observation.id} is not emitted by the required rubric events.`,
            { registryId: observation.id }
          )
        );
      }
    });
    criterion.studentSubmissionFieldIds.forEach((submissionId, index) => {
      resolveConfiguration(
        collector,
        submissionId,
        `${path}.studentSubmissionFieldIds[${index}]`,
        "submission_field",
        spec.familyId,
        CHECK.eventEvidence
      );
    });
    if (
      criterion.requiredEventTypeIds.length === 0 &&
      criterion.studentSubmissionFieldIds.length === 0
    ) {
      addIssue(
        collector,
        CHECK.eventEvidence,
        issue(
          ISSUE.rubricEvidenceUnreachable,
          path,
          "A rubric criterion must name deterministic event evidence or a structured submission."
        )
      );
    }
  });

  spec.adaptiveRetries.forEach((retry, retryIndex) => {
    const path = `adaptiveRetries[${retryIndex}]`;
    const template = resolveConfiguration(
      collector,
      retry.templateId,
      `${path}.templateId`,
      "retry_template",
      spec.familyId,
      CHECK.eventEvidence
    );
    const retrySkills = retry.targetSkillIds
      .map((skillId, skillIndex) => {
        const skill = validateSkillReference(
          collector,
          skillId,
          `${path}.targetSkillIds[${skillIndex}]`,
          spec.familyId
        );
        if (!rootSkillIds.has(skillId)) {
          addIssue(
            collector,
            CHECK.eventEvidence,
            issue(
              ISSUE.skillNotSelected,
              `${path}.targetSkillIds[${skillIndex}]`,
              `Retry skill ${skillId} is not selected by the workflow.`,
              { registryId: skillId }
            )
          );
        }
        if (
          skill &&
          template &&
          !skill.adaptiveRetryPatternIds.includes(template.id)
        ) {
          addIssue(
            collector,
            CHECK.eventEvidence,
            issue(
              ISSUE.retryIncompatible,
              `${path}.templateId`,
              `${template.id} is not registered for skill ${skill.id}.`,
              { registryId: template.id }
            )
          );
        }
        return skill;
      })
      .filter((entry): entry is SkillRegistryEntry => entry !== null);
    retry.eligibleFlagIds.forEach((flagId, flagIndex) => {
      const flag = validateFlagReference(
        collector,
        flagId,
        `${path}.eligibleFlagIds[${flagIndex}]`,
        spec.engineId
      );
      if (flag && !retrySkills.some(({ id }) => id === flag.canonicalSkillId)) {
        addIssue(
          collector,
          CHECK.eventEvidence,
          issue(
            ISSUE.retryIncompatible,
            `${path}.eligibleFlagIds[${flagIndex}]`,
            `${flag.id} does not target a retry skill.`,
            { registryId: flag.id }
          )
        );
      }
    });
    const retrySeed = resolveConfiguration(
      collector,
      retry.seedTemplateId,
      `${path}.seedTemplateId`,
      "seed_template",
      spec.familyId,
      CHECK.seedRegistration
    );
    if (
      engine &&
      retrySeed &&
      !engine.seedTemplateIds.includes(retry.seedTemplateId)
    ) {
      addIssue(
        collector,
        CHECK.seedRegistration,
        issue(
          ISSUE.seedIncompatible,
          `${path}.seedTemplateId`,
          `${retry.seedTemplateId} is not supported by engine ${engine.id}.`,
          { registryId: retry.seedTemplateId }
        )
      );
    }
    retry.successEvidenceReasonIds.forEach((reasonId, reasonIndex) => {
      resolveConfiguration(
        collector,
        reasonId,
        `${path}.successEvidenceReasonIds[${reasonIndex}]`,
        "evidence_reason",
        spec.familyId,
        CHECK.eventEvidence
      );
      if (
        !retrySkills.some(({ positiveEvidenceReasonIds }) =>
          positiveEvidenceReasonIds.includes(reasonId)
        )
      ) {
        addIssue(
          collector,
          CHECK.eventEvidence,
          issue(
            ISSUE.retryIncompatible,
            `${path}.successEvidenceReasonIds[${reasonIndex}]`,
            `${reasonId} is not positive evidence for a retry skill.`,
            { registryId: reasonId }
          )
        );
      }
    });
  });
}

export function validateLabWorkflowSpec(
  input: unknown,
  options: LabWorkflowValidationOptions
): LabWorkflowValidationOutcome {
  validationResultSchema.shape.checkedAt.parse(options.checkedAt);
  const parsed = labWorkflowSpecSchema.safeParse(input);
  if (!parsed.success) {
    const issues = stableIssues(
      parsed.error.issues.map((zodIssue) =>
        issue(
          ISSUE.schemaInvalid,
          zodPath(zodIssue),
          `Schema validation failed: ${zodIssue.message}`
        )
      )
    );
    return deepFreeze({
      schemaValid: false as const,
      spec: null,
      validation: null,
      issues
    });
  }

  const normalized = normalizeWorkflow(parsed.data);
  const collector: IssueCollector = {
    issues: [],
    failedChecks: new Set()
  };
  validateResolvedWorkflow(parsed.data, normalized, collector);

  const issues = stableIssues(collector.issues);
  const status = determineStatus(issues, normalized);
  const runnable = status === "runnable";
  const canonicalSpecHash = hashLabWorkflowSpec(normalized);
  const validation = validationResultSchema.parse({
    validatorVersion: LAB_WORKFLOW_VALIDATOR_VERSION,
    checkedAt: options.checkedAt,
    canonicalSpecHash,
    registrySnapshotIds: LAB_WORKFLOW_REGISTRY_SNAPSHOT_IDS,
    status,
    runnable,
    previewEligible: runnable,
    assignmentEligible: runnable,
    issues,
    passedCheckIds: ALL_CHECK_IDS.filter(
      (checkId) => !collector.failedChecks.has(checkId)
    )
  });
  const preservedCritique =
    parsed.data.judgeCritique?.specHash === canonicalSpecHash
      ? parsed.data.judgeCritique
      : null;
  const spec = validatedLabWorkflowSpecSchema.parse({
    ...normalized,
    supportStatus: status,
    validation,
    judgeCritique: preservedCritique
  });

  return deepFreeze({
    schemaValid: true as const,
    spec,
    validation,
    issues
  });
}

/**
 * Fail-closed hard-validation gate. Assignment callers must additionally record
 * explicit teacher approval; this function establishes runtime eligibility only.
 */
export function evaluateLabWorkflowEligibility(
  input: unknown,
  purpose: LabWorkflowEligibilityPurpose
): Readonly<LabWorkflowEligibility> {
  const parsed = labWorkflowSpecSchema.safeParse(input);
  const failureCodes: string[] = [];
  const failure = WORKFLOW_ELIGIBILITY_FAILURE_CODES;

  if (!parsed.success) {
    return deepFreeze({
      eligible: false,
      purpose,
      failureCodes: [failure.schemaInvalid]
    });
  }

  const spec = parsed.data;
  if (spec.supportStatus !== "runnable") {
    failureCodes.push(failure.statusNotRunnable);
  }
  if (
    spec.validation === null ||
    spec.validation.status !== "runnable" ||
    !spec.validation.runnable
  ) {
    failureCodes.push(failure.validationNotRunnable);
  }
  if (purpose === "preview" && !spec.validation?.previewEligible) {
    failureCodes.push(failure.previewNotEligible);
  }
  if (purpose === "assignment" && !spec.validation?.assignmentEligible) {
    failureCodes.push(failure.assignmentNotEligible);
  }
  if (
    spec.validation !== null &&
    spec.validation.validatorVersion !== LAB_WORKFLOW_VALIDATOR_VERSION
  ) {
    failureCodes.push(failure.validatorVersionStale);
  }
  if (spec.validation !== null) {
    const expectedSnapshots = Object.entries(
      LAB_WORKFLOW_REGISTRY_SNAPSHOT_IDS
    );
    const actualSnapshots = Object.entries(spec.validation.registrySnapshotIds);
    const snapshotsMatch =
      actualSnapshots.length === expectedSnapshots.length &&
      expectedSnapshots.every(
        ([key, value]) => spec.validation?.registrySnapshotIds[key] === value
      );
    if (!snapshotsMatch) {
      failureCodes.push(failure.registrySnapshotStale);
    }
    if (!labWorkflowHashMatches(spec, spec.validation.canonicalSpecHash)) {
      failureCodes.push(failure.hashMismatch);
    }
  }

  return deepFreeze({
    eligible: failureCodes.length === 0,
    purpose,
    failureCodes
  });
}
