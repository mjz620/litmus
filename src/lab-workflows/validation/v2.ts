import type { ZodIssue } from "zod";

import { LEGACY_TITRATION_RUNTIME_ADAPTER } from "../adapters/titration/metadata";
import { capabilityRegistry, type CapabilityRegistry } from "../capabilities";
import { hashLabWorkflowSpec, labWorkflowHashMatches } from "../hash";
import {
  BoundedConcentrationError,
  canonicalizeBoundedConcentrationDecimal
} from "../material-initialization";
import {
  actionEventContractRegistry,
  actionParameterSchemaRegistry,
  actionRegistry,
  equipmentPreconditionRegistry,
  labActionErrorContractRegistry,
  type ActionEventContractEntry,
  type ActionParameterDefinition,
  type ActionParameterSchemaEntry,
  type ActionRegistryEntry,
  type EquipmentPreconditionEntry,
  type LabActionErrorContractEntry,
  type SupportingRegistry
} from "../registries/actions";
import {
  ChemistryModelResolutionError,
  chemistryModelRegistry,
  resolveChemistryModelProviders,
  type ChemistryModelRegistry
} from "../registries/chemistry-models";
import {
  componentRegistry,
  type ComponentRegistry,
  type ComponentRegistryEntry
} from "../registries/components";
import {
  configurationRegistry,
  type ConfigurationCategory,
  type ConfigurationRegistryEntry
} from "../registries/configurations";
import {
  engineRegistry,
  type EngineRegistryEntry
} from "../registries/engines";
import {
  eventFlagRegistry,
  eventTypeRegistry,
  type EventFlagRegistryEntry,
  type EventTypeRegistryEntry
} from "../registries/event-flags";
import {
  materialRegistry,
  type ReagentRegistryEntry
} from "../registries/reagents";
import { safetyRegistry, type SafetyRegistryEntry } from "../registries/safety";
import {
  scenePlacementRegistry,
  scenePlacementsOverlap,
  type VerifiedScenePlacement
} from "../registries/scene-placements";
import { skillRegistry, type SkillRegistry } from "../registries/skills";
import {
  validationIssueSchema,
  type ValidationIssue,
  type WorkflowSupportStatus
} from "../schema";
import type {
  StructuredEvidenceValue,
  WorkflowRule
} from "../schema/conditions";
import {
  labWorkflowDraftV2Schema,
  labWorkflowSpecV2Schema,
  validatedLabWorkflowSpecV2Schema,
  validationResultV2Schema,
  validationResultV2_0Schema,
  type LabWorkflowDraftV2,
  type LabWorkflowSpecV2,
  type ValidatedLabWorkflowSpecV2,
  type ValidationResultV2
} from "../schema/v2";

export const LAB_WORKFLOW_VALIDATOR_VERSION_V2 = "2.2.0" as const;

export const WORKFLOW_VALIDATION_CHECK_IDS_V2 = Object.freeze({
  schema: "check.schema.v2",
  references: "check.references.v2",
  equipment: "check.equipment.v2",
  materials: "check.materials.v2",
  actions: "check.actions.v2",
  chemistryModels: "check.chemistry_models.v2",
  rules: "check.rules.v2",
  rubric: "check.rubric.v2",
  presentationCoach: "check.presentation_coach.v2",
  safety: "check.safety.v2",
  eligibility: "check.eligibility.v2"
} as const);

export const WORKFLOW_VALIDATION_ISSUE_CODES_V2 = Object.freeze({
  schemaInvalid: "validation.schema_invalid.v2",
  registryIdUnknown: "validation.registry_id_unknown.v2",
  registryIdUnavailable: "validation.registry_id_unavailable.v2",
  configurationMismatch: "validation.configuration_mismatch.v2",
  duplicateId: "validation.duplicate_id.v2",
  duplicateReference: "validation.duplicate_reference.v2",
  referenceUnknown: "validation.reference_unknown.v2",
  equipmentConfigurationIncompatible:
    "validation.equipment_configuration_incompatible.v2",
  equipmentCapabilityUnavailable:
    "validation.equipment_capability_unavailable.v2",
  equipmentStateIncompatible: "validation.equipment_state_incompatible.v2",
  adapterUnavailable: "validation.adapter_unavailable.v2",
  layoutIncompatible: "validation.layout_incompatible.v2",
  materialUnavailable: "validation.material_unavailable.v2",
  materialUsageIncompatible: "validation.material_usage_incompatible.v2",
  materialContainerIncompatible:
    "validation.material_container_incompatible.v2",
  materialContainerExclusive: "validation.material_container_exclusive.v2",
  quantityIncompatible: "validation.quantity_incompatible.v2",
  materialInitializationMissing:
    "validation.material_initialization_missing.v2",
  materialInitializationInvalid:
    "validation.material_initialization_invalid.v2",
  capacityExceeded: "validation.capacity_exceeded.v2",
  actionSourceIncompatible: "validation.action_source_incompatible.v2",
  actionTargetIncompatible: "validation.action_target_incompatible.v2",
  actionCapabilityMissing: "validation.action_capability_missing.v2",
  actionParameterIncompatible: "validation.action_parameter_incompatible.v2",
  actionLimitIncompatible: "validation.action_limit_incompatible.v2",
  actionContractIncompatible: "validation.action_contract_incompatible.v2",
  actionAvailabilityContradiction:
    "validation.action_availability_contradiction.v2",
  chemistryCapabilityUnavailable:
    "validation.chemistry_capability_unavailable.v2",
  chemistryRequirementMissing: "validation.chemistry_requirement_missing.v2",
  chemistryModelResolutionFailed:
    "validation.chemistry_model_resolution_failed.v2",
  legacyAdapterUnavailable: "validation.legacy_adapter_unavailable.v2",
  legacyCompatibilityInvalid: "validation.legacy_compatibility_invalid.v2",
  ruleReferenceInvalid: "validation.rule_reference_invalid.v2",
  ruleConditionInvalid: "validation.rule_condition_invalid.v2",
  ruleKindIncompatible: "validation.rule_kind_incompatible.v2",
  ruleCycle: "validation.rule_cycle.v2",
  ruleContradiction: "validation.rule_contradiction.v2",
  successMissing: "validation.success_missing.v2",
  successUnreachable: "validation.success_unreachable.v2",
  objectiveInvalid: "validation.objective_invalid.v2",
  rubricInvalid: "validation.rubric_invalid.v2",
  evidenceUnreachable: "validation.evidence_unreachable.v2",
  coachInvalid: "validation.coach_invalid.v2",
  instructionInvalid: "validation.instruction_invalid.v2",
  presentationInvalid: "validation.presentation_invalid.v2",
  safetyPolicyInvalid: "validation.safety_policy_invalid.v2",
  safetyProhibited: "validation.safety_prohibited.v2",
  safetyBindingInvalid: "validation.safety_binding_invalid.v2",
  runtimeUnavailable: "validation.runtime_unavailable.v2"
} as const);

export const WORKFLOW_ELIGIBILITY_FAILURE_CODES_V2 = Object.freeze({
  schemaInvalid: "eligibility.schema_invalid.v2",
  statusNotRunnable: "eligibility.status_not_runnable.v2",
  validationNotRunnable: "eligibility.validation_not_runnable.v2",
  previewNotEligible: "eligibility.preview_not_eligible.v2",
  assignmentNotEligible: "eligibility.assignment_not_eligible.v2",
  validatorVersionStale: "eligibility.validator_version_stale.v2",
  registrySnapshotStale: "eligibility.registry_snapshot_stale.v2",
  hashMismatch: "eligibility.hash_mismatch.v2",
  resolvedAdapterMismatch: "eligibility.resolved_adapter_mismatch.v2",
  resolvedModelMismatch: "eligibility.resolved_model_mismatch.v2",
  validationArtifactMismatch: "eligibility.validation_artifact_mismatch.v2"
} as const);

type CheckIdV2 =
  (typeof WORKFLOW_VALIDATION_CHECK_IDS_V2)[keyof typeof WORKFLOW_VALIDATION_CHECK_IDS_V2];
type PassNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export interface LabWorkflowV2RegistryContext {
  readonly capabilities: CapabilityRegistry;
  readonly components: ComponentRegistry;
  readonly configurations: SupportingRegistry<ConfigurationRegistryEntry>;
  readonly materials: SupportingRegistry<ReagentRegistryEntry>;
  readonly actions: SupportingRegistry<ActionRegistryEntry>;
  readonly actionParameterSchemas: SupportingRegistry<ActionParameterSchemaEntry>;
  readonly equipmentPreconditions: SupportingRegistry<EquipmentPreconditionEntry>;
  readonly actionErrorContracts: SupportingRegistry<LabActionErrorContractEntry>;
  readonly actionEventContracts: SupportingRegistry<ActionEventContractEntry>;
  readonly chemistryModels: ChemistryModelRegistry;
  readonly eventFlags: SupportingRegistry<EventFlagRegistryEntry>;
  readonly eventTypes: SupportingRegistry<EventTypeRegistryEntry>;
  readonly skills: SkillRegistry;
  readonly safety: SupportingRegistry<SafetyRegistryEntry>;
  readonly engines: SupportingRegistry<EngineRegistryEntry>;
  readonly scenePlacements: SupportingRegistry<VerifiedScenePlacement>;
}

export const PRODUCTION_LAB_WORKFLOW_V2_REGISTRIES: LabWorkflowV2RegistryContext =
  Object.freeze({
    capabilities: capabilityRegistry,
    components: componentRegistry,
    configurations: configurationRegistry,
    materials: materialRegistry,
    actions: actionRegistry,
    actionParameterSchemas: actionParameterSchemaRegistry,
    equipmentPreconditions: equipmentPreconditionRegistry,
    actionErrorContracts: labActionErrorContractRegistry,
    actionEventContracts: actionEventContractRegistry,
    chemistryModels: chemistryModelRegistry,
    eventFlags: eventFlagRegistry,
    eventTypes: eventTypeRegistry,
    skills: skillRegistry,
    safety: safetyRegistry,
    engines: engineRegistry,
    scenePlacements: scenePlacementRegistry
  });

export interface LabWorkflowV2ValidationOptions {
  readonly checkedAt: string;
  readonly registries?: LabWorkflowV2RegistryContext;
}

export interface SchemaInvalidLabWorkflowV2Validation {
  readonly schemaValid: false;
  readonly spec: null;
  readonly validation: null;
  readonly issues: readonly ValidationIssue[];
}

export interface SchemaValidLabWorkflowV2Validation {
  readonly schemaValid: true;
  readonly spec: Readonly<ValidatedLabWorkflowSpecV2>;
  readonly validation: Readonly<ValidationResultV2>;
  readonly issues: readonly ValidationIssue[];
}

export type LabWorkflowV2ValidationOutcome =
  | SchemaInvalidLabWorkflowV2Validation
  | SchemaValidLabWorkflowV2Validation;

export type LabWorkflowV2EligibilityPurpose = "assignment" | "preview";
export interface LabWorkflowV2Eligibility {
  readonly eligible: boolean;
  readonly purpose: LabWorkflowV2EligibilityPurpose;
  readonly failureCodes: readonly string[];
}

interface CollectedIssue {
  readonly pass: PassNumber;
  readonly checkId: CheckIdV2;
  readonly issue: ValidationIssue;
}

interface ValidationContext {
  readonly spec: LabWorkflowDraftV2;
  readonly registries: LabWorkflowV2RegistryContext;
  readonly issues: CollectedIssue[];
  readonly failedChecks: Set<CheckIdV2>;
  readonly equipmentById: Map<string, ComponentRegistryEntry | null>;
  readonly materialById: Map<string, ReagentRegistryEntry | null>;
  readonly actionByPermissionId: Map<string, ActionRegistryEntry | null>;
  readonly ruleById: Map<string, WorkflowRule>;
  readonly resolvedAdapters: ValidationResultV2["resolvedAdapters"];
  resolvedChemistryModels: ValidationResultV2["resolvedChemistryModels"];
}

const CHECK = WORKFLOW_VALIDATION_CHECK_IDS_V2;
const ISSUE = WORKFLOW_VALIDATION_ISSUE_CODES_V2;
const ALL_CHECK_IDS = Object.values(CHECK);

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareStrings);
}

function mapById<T extends { readonly id: string }>(
  entries: readonly T[]
): Map<string, T> {
  return new Map(entries.map((entry) => [entry.id, entry]));
}

function zodPath(value: ZodIssue): string {
  if (value.path.length === 0) return "$";
  return value.path.reduce<string>(
    (path, segment) =>
      typeof segment === "number"
        ? `${path}[${segment}]`
        : path
          ? `${path}.${String(segment)}`
          : String(segment),
    ""
  );
}

function addIssue(
  context: ValidationContext,
  pass: PassNumber,
  checkId: CheckIdV2,
  code: string,
  path: string,
  message: string,
  options: {
    readonly severity?: ValidationIssue["severity"];
    readonly registryId?: string;
    readonly suggestions?: readonly string[];
    readonly safetyRelated?: boolean;
  } = {}
): void {
  const value = validationIssueSchema.parse({
    code,
    severity: options.severity ?? "error",
    path,
    message,
    ...(options.registryId ? { registryId: options.registryId } : {}),
    suggestedSupportedIds: sortedUnique(options.suggestions ?? []),
    safetyRelated: options.safetyRelated ?? false
  });
  context.issues.push({ pass, checkId, issue: value });
  context.failedChecks.add(checkId);
}

function stableIssues(values: readonly CollectedIssue[]): ValidationIssue[] {
  const severity = { error: 0, warning: 1, info: 2 } as const;
  return [...values]
    .sort(
      (left, right) =>
        left.pass - right.pass ||
        compareStrings(left.issue.path, right.issue.path) ||
        severity[left.issue.severity] - severity[right.issue.severity] ||
        compareStrings(left.issue.code, right.issue.code) ||
        compareStrings(
          left.issue.registryId ?? "",
          right.issue.registryId ?? ""
        ) ||
        Number(left.issue.safetyRelated) - Number(right.issue.safetyRelated) ||
        compareStrings(left.issue.message, right.issue.message) ||
        compareStrings(
          left.issue.suggestedSupportedIds.join("\0"),
          right.issue.suggestedSupportedIds.join("\0")
        )
    )
    .map(({ issue: value }) => value);
}

function addDuplicates(
  context: ValidationContext,
  values: readonly string[],
  path: (index: number) => string,
  code: string = ISSUE.duplicateId
): void {
  const seen = new Map<string, number>();
  values.forEach((id, index) => {
    const first = seen.get(id);
    if (first === undefined) seen.set(id, index);
    else
      addIssue(
        context,
        2,
        CHECK.references,
        code,
        path(index),
        `Duplicate reference ${id}; first declared at index ${first}.`,
        { registryId: id }
      );
  });
}

function resolveConfiguration(
  context: ValidationContext,
  id: string,
  path: string,
  category: ConfigurationCategory,
  pass: PassNumber,
  checkId: CheckIdV2,
  requireVerified = true
): ConfigurationRegistryEntry | null {
  const entries = context.registries.configurations.list();
  const entry = entries.find((candidate) => candidate.id === id) ?? null;
  if (!entry) {
    addIssue(
      context,
      pass,
      checkId,
      ISSUE.registryIdUnknown,
      path,
      `Unknown ${category} ID: ${id}.`,
      {
        registryId: id,
        suggestions: entries
          .filter((candidate) => candidate.category === category)
          .map(({ id: value }) => value)
      }
    );
    return null;
  }
  if (entry.category !== category) {
    addIssue(
      context,
      pass,
      checkId,
      ISSUE.configurationMismatch,
      path,
      `${id} is ${entry.category}, not ${category}.`,
      { registryId: id }
    );
    return entry;
  }
  if (requireVerified && entry.availability !== "verified") {
    addIssue(
      context,
      pass,
      checkId,
      ISSUE.registryIdUnavailable,
      path,
      `${id} is ${entry.availability}, not verified.`,
      { registryId: id }
    );
  }
  return entry;
}

function reference(
  context: ValidationContext,
  exists: boolean,
  id: string,
  path: string,
  kind: string,
  pass: PassNumber,
  checkId: CheckIdV2,
  safetyRelated = false
): boolean {
  if (exists) return true;
  addIssue(
    context,
    pass,
    checkId,
    ISSUE.referenceUnknown,
    path,
    `Unknown ${kind} reference: ${id}.`,
    { registryId: id, safetyRelated }
  );
  return false;
}

function registrySnapshots(
  registries: LabWorkflowV2RegistryContext
): Readonly<Record<string, string>> {
  return Object.freeze({
    capabilities: registries.capabilities.snapshotId,
    components: registries.components.snapshotId,
    configurations: registries.configurations.snapshotId,
    materials: registries.materials.snapshotId,
    actions: registries.actions.snapshotId,
    actionParameterSchemas: registries.actionParameterSchemas.snapshotId,
    equipmentPreconditions: registries.equipmentPreconditions.snapshotId,
    actionErrorContracts: registries.actionErrorContracts.snapshotId,
    actionEventContracts: registries.actionEventContracts.snapshotId,
    chemistryModels: registries.chemistryModels.snapshotId,
    eventFlags: registries.eventFlags.snapshotId,
    eventTypes: registries.eventTypes.snapshotId,
    skills: registries.skills.snapshotId,
    safety: registries.safety.snapshotId,
    engines: registries.engines.snapshotId,
    scenePlacements: registries.scenePlacements.snapshotId
  });
}

function validateReferences(context: ValidationContext): void {
  const spec = context.spec;
  addDuplicates(
    context,
    spec.objectiveIds,
    (index) => `objectiveIds[${index}]`,
    ISSUE.duplicateReference
  );
  addDuplicates(
    context,
    spec.equipment.map(({ instanceId }) => instanceId),
    (index) => `equipment[${index}].instanceId`
  );
  addDuplicates(
    context,
    spec.materials.map(({ instanceId }) => instanceId),
    (index) => `materials[${index}].instanceId`
  );
  addDuplicates(
    context,
    spec.permittedActions.map(({ id }) => id),
    (index) => `permittedActions[${index}].id`
  );
  addDuplicates(
    context,
    spec.rules.map(({ id }) => id),
    (index) => `rules[${index}].id`
  );
  addDuplicates(
    context,
    spec.instructions.map(({ id }) => id),
    (index) => `instructions[${index}].id`
  );
  addDuplicates(
    context,
    spec.coachPolicy.triggers.map(({ id }) => id),
    (index) => `coachPolicy.triggers[${index}].id`
  );
  addDuplicates(
    context,
    spec.coachPolicy.adaptiveRetries.map(({ id }) => id),
    (index) => `coachPolicy.adaptiveRetries[${index}].id`
  );
  addDuplicates(
    context,
    spec.rubric.criteria.map(({ id }) => id),
    (index) => `rubric.criteria[${index}].id`
  );
  addDuplicates(
    context,
    spec.safetyPolicyIds,
    (index) => `safetyPolicyIds[${index}]`,
    ISSUE.duplicateReference
  );

  spec.objectiveIds.forEach((id, index) => {
    const resolution = context.registries.skills.resolve(id);
    if (resolution.status !== "resolved" || resolution.source !== "canonical") {
      addIssue(
        context,
        2,
        CHECK.references,
        ISSUE.objectiveInvalid,
        `objectiveIds[${index}]`,
        `Objective ${id} is not an exact canonical objective ID.`,
        { registryId: id }
      );
    } else if (resolution.entry.restricted) {
      addIssue(
        context,
        2,
        CHECK.references,
        ISSUE.registryIdUnavailable,
        `objectiveIds[${index}]`,
        `Objective ${id} is restricted.`,
        { registryId: id }
      );
    }
  });
}

function validateEquipment(context: ValidationContext): void {
  const spec = context.spec;
  const components = mapById(context.registries.components.list());
  const capabilities = mapById(context.registries.capabilities.listEquipment());
  const configEntries = mapById(context.registries.configurations.list());
  const scenePlacements = mapById(context.registries.scenePlacements.list());
  const resolvedScenePlacements: {
    readonly index: number;
    readonly equipmentInstanceId: string;
    readonly placement: Readonly<VerifiedScenePlacement>;
  }[] = [];
  const layoutSchema = resolveConfiguration(
    context,
    spec.layout.configurationSchemaId,
    "layout.configurationSchemaId",
    "configuration_schema",
    3,
    CHECK.equipment,
    false
  );
  if (
    layoutSchema &&
    (layoutSchema.scope !== "layout" ||
      ("strict" in layoutSchema && !layoutSchema.strict))
  ) {
    addIssue(
      context,
      3,
      CHECK.equipment,
      ISSUE.layoutIncompatible,
      "layout.configurationSchemaId",
      `${layoutSchema.id} is not a strict layout schema.`,
      { registryId: layoutSchema.id }
    );
  }

  addDuplicates(
    context,
    spec.layout.placements.map(
      ({ equipmentInstanceId }) => equipmentInstanceId
    ),
    (index) => `layout.placements[${index}].equipmentInstanceId`,
    ISSUE.duplicateReference
  );
  spec.equipment.forEach((equipment, index) => {
    const path = `equipment[${index}]`;
    const entry = components.get(equipment.equipmentDefinitionId) ?? null;
    context.equipmentById.set(equipment.instanceId, entry);
    if (!entry) {
      addIssue(
        context,
        3,
        CHECK.equipment,
        ISSUE.registryIdUnknown,
        `${path}.equipmentDefinitionId`,
        `Unknown equipment definition ${equipment.equipmentDefinitionId}.`,
        {
          registryId: equipment.equipmentDefinitionId,
          suggestions: [...components.keys()]
        }
      );
      return;
    }
    for (const capabilityId of entry.capabilityIds) {
      const capability = capabilities.get(capabilityId);
      if (!capability || capability.availability !== "verified") {
        addIssue(
          context,
          3,
          CHECK.equipment,
          ISSUE.equipmentCapabilityUnavailable,
          `${path}.equipmentDefinitionId`,
          `Equipment capability ${capabilityId} is not verified.`,
          { registryId: capabilityId }
        );
      }
    }
    for (const [adapterId, availability, kind] of [
      [
        entry.visualAdapterDefinitionId,
        entry.visualAdapterDefinitionAvailability,
        "visual"
      ],
      [
        entry.mechanicalAdapterId,
        entry.mechanicalAdapterAvailability,
        "mechanical"
      ]
    ] as const) {
      if (availability !== "verified") {
        addIssue(
          context,
          3,
          CHECK.equipment,
          ISSUE.adapterUnavailable,
          `${path}.equipmentDefinitionId`,
          `${adapterId} is ${availability}.`,
          { registryId: adapterId }
        );
      } else {
        (
          context.resolvedAdapters as ValidationResultV2["resolvedAdapters"][number][]
        ).push({ kind, ownerId: entry.id, adapterId, version: entry.version });
      }
    }
    if (entry.stateSchemaAvailability !== "verified") {
      addIssue(
        context,
        3,
        CHECK.equipment,
        ISSUE.equipmentStateIncompatible,
        `${path}.equipmentDefinitionId`,
        `${entry.stateSchemaId} is not verified.`,
        { registryId: entry.stateSchemaId }
      );
    }
    const configuration = resolveConfiguration(
      context,
      equipment.configurationPresetId,
      `${path}.configurationPresetId`,
      "component_configuration",
      3,
      CHECK.equipment
    );
    if (configuration) {
      if (!configuration.compatibleComponentIds.includes(entry.id)) {
        addIssue(
          context,
          3,
          CHECK.equipment,
          ISSUE.equipmentConfigurationIncompatible,
          `${path}.configurationPresetId`,
          `${configuration.id} is not compatible with ${entry.id}.`,
          { registryId: configuration.id }
        );
      }
      if (!configuration.schemaId) {
        addIssue(
          context,
          3,
          CHECK.equipment,
          ISSUE.equipmentConfigurationIncompatible,
          `${path}.configurationPresetId`,
          `${configuration.id} has no configuration schema.`,
          { registryId: configuration.id }
        );
      } else {
        const schema = configEntries.get(configuration.schemaId);
        if (
          !schema ||
          schema.category !== "configuration_schema" ||
          schema.scope !== "equipment"
        ) {
          addIssue(
            context,
            3,
            CHECK.equipment,
            ISSUE.equipmentConfigurationIncompatible,
            `${path}.configurationPresetId`,
            `${configuration.schemaId} is not a strict equipment schema.`,
            { registryId: configuration.schemaId }
          );
        }
      }
    }
    const placements = spec.layout.placements.filter(
      ({ equipmentInstanceId }) => equipmentInstanceId === equipment.instanceId
    );
    if (placements.length !== 1) {
      addIssue(
        context,
        3,
        CHECK.equipment,
        ISSUE.layoutIncompatible,
        `${path}.instanceId`,
        `Equipment ${equipment.instanceId} must have exactly one placement.`,
        { registryId: equipment.instanceId }
      );
    }
  });

  spec.layout.placements.forEach((placement, index) => {
    const path = `layout.placements[${index}]`;
    const equipment = spec.equipment.find(
      ({ instanceId }) => instanceId === placement.equipmentInstanceId
    );
    if (!equipment) {
      reference(
        context,
        false,
        placement.equipmentInstanceId,
        `${path}.equipmentInstanceId`,
        "equipment",
        3,
        CHECK.equipment
      );
      return;
    }
    const entry = context.equipmentById.get(equipment.instanceId);
    const slot = resolveConfiguration(
      context,
      placement.placementSlotId,
      `${path}.placementSlotId`,
      "placement",
      3,
      CHECK.equipment
    );
    if (slot && entry) {
      if (
        slot.schemaId !== spec.layout.configurationSchemaId ||
        !slot.compatibleComponentIds.includes(entry.id)
      ) {
        addIssue(
          context,
          3,
          CHECK.equipment,
          ISSUE.layoutIncompatible,
          `${path}.placementSlotId`,
          `${slot.id} does not match the selected layout/equipment.`,
          { registryId: slot.id }
        );
      }
    }
    const scenePlacement = scenePlacements.get(placement.placementSlotId);
    if (!scenePlacement) {
      addIssue(
        context,
        3,
        CHECK.equipment,
        ISSUE.layoutIncompatible,
        `${path}.placementSlotId`,
        `${placement.placementSlotId} has no verified 3D scene pose.`,
        {
          registryId: placement.placementSlotId,
          suggestions: context.registries.scenePlacements
            .list()
            .filter(
              (candidate) =>
                candidate.equipmentDefinitionId ===
                equipment.equipmentDefinitionId
            )
            .map(({ id }) => id)
        }
      );
    } else if (
      entry &&
      (scenePlacement.equipmentDefinitionId !== entry.id ||
        scenePlacement.visualAdapterDefinitionId !==
          entry.visualAdapterDefinitionId)
    ) {
      addIssue(
        context,
        3,
        CHECK.equipment,
        ISSUE.layoutIncompatible,
        `${path}.placementSlotId`,
        `${scenePlacement.id} does not match the equipment visual adapter.`,
        { registryId: scenePlacement.id }
      );
    } else {
      resolvedScenePlacements.push({
        index,
        equipmentInstanceId: placement.equipmentInstanceId,
        placement: scenePlacement
      });
    }
  });

  for (
    let leftIndex = 0;
    leftIndex < resolvedScenePlacements.length;
    leftIndex += 1
  ) {
    const left = resolvedScenePlacements[leftIndex];
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < resolvedScenePlacements.length;
      rightIndex += 1
    ) {
      const right = resolvedScenePlacements[rightIndex];
      const sameAlignedAssembly =
        left.placement.assemblyId !== null &&
        left.placement.assemblyId === right.placement.assemblyId &&
        left.placement.anchorId === right.placement.anchorId &&
        left.placement.equipmentDefinitionId !==
          right.placement.equipmentDefinitionId;
      if (
        !sameAlignedAssembly &&
        scenePlacementsOverlap(left.placement, right.placement)
      ) {
        addIssue(
          context,
          3,
          CHECK.equipment,
          ISSUE.layoutIncompatible,
          `layout.placements[${right.index}].placementSlotId`,
          `${right.placement.displayName} overlaps ${left.placement.displayName}.`,
          { registryId: right.placement.id }
        );
      }
    }
  }

  const assemblyAnchors = new Map<string, Set<string>>();
  for (const resolved of resolvedScenePlacements) {
    if (!resolved.placement.assemblyId) continue;
    const anchors =
      assemblyAnchors.get(resolved.placement.assemblyId) ?? new Set();
    anchors.add(resolved.placement.anchorId);
    assemblyAnchors.set(resolved.placement.assemblyId, anchors);
  }
  for (const [assemblyId, anchors] of assemblyAnchors) {
    if (anchors.size <= 1) continue;
    const mismatch = resolvedScenePlacements.find(
      ({ placement }) => placement.assemblyId === assemblyId
    );
    if (!mismatch) continue;
    addIssue(
      context,
      3,
      CHECK.equipment,
      ISSUE.layoutIncompatible,
      `layout.placements[${mismatch.index}].placementSlotId`,
      "Linked equipment must use the same verified workstation anchor.",
      { registryId: mismatch.placement.id }
    );
  }
}

function validateMaterials(context: ValidationContext): void {
  const profiles = mapById(context.registries.materials.list());
  const configs = mapById(context.registries.configurations.list());
  const requiredChemistry = new Set(
    context.spec.requiredChemistryCapabilityIds
  );
  context.spec.materials.forEach((material, index) => {
    const path = `materials[${index}]`;
    const profile = profiles.get(material.materialProfileId) ?? null;
    context.materialById.set(material.instanceId, profile);
    if (!profile) {
      addIssue(
        context,
        4,
        CHECK.materials,
        ISSUE.registryIdUnknown,
        `${path}.materialProfileId`,
        `Unknown material profile ${material.materialProfileId}.`,
        {
          registryId: material.materialProfileId,
          suggestions: [...profiles.keys()]
        }
      );
      return;
    }
    if (profile.availability !== "verified") {
      addIssue(
        context,
        4,
        CHECK.materials,
        ISSUE.materialUnavailable,
        `${path}.materialProfileId`,
        `${profile.id} is ${profile.availability}.`,
        { registryId: profile.id }
      );
    }
    if (!profile.usageModes.includes("material_binding")) {
      addIssue(
        context,
        4,
        CHECK.materials,
        ISSUE.materialUsageIncompatible,
        `${path}.materialProfileId`,
        `${profile.id} cannot be used as a material binding.`,
        { registryId: profile.id }
      );
    }
    const authoredInitialization =
      context.spec.schemaVersion === "2.1.0"
        ? context.spec.materials[index]?.initialization
        : undefined;
    const concentrationContract = profile.concentrationAuthoring;
    if (concentrationContract && !authoredInitialization) {
      addIssue(
        context,
        4,
        CHECK.materials,
        ISSUE.materialInitializationMissing,
        `${path}.initialization`,
        `${profile.displayName} requires a bounded concentration.`,
        { registryId: concentrationContract.configurationSchemaId }
      );
    } else if (!concentrationContract && authoredInitialization) {
      addIssue(
        context,
        4,
        CHECK.materials,
        ISSUE.materialInitializationInvalid,
        `${path}.initialization`,
        `${profile.id} does not allow an authored concentration.`,
        { registryId: profile.id }
      );
    } else if (concentrationContract && authoredInitialization) {
      const initializationSchema = configs.get(
        authoredInitialization.configurationSchemaId
      );
      if (
        authoredInitialization.configurationSchemaId !==
          concentrationContract.configurationSchemaId ||
        authoredInitialization.concentration.unitId !==
          concentrationContract.unitId ||
        !initializationSchema ||
        initializationSchema.category !== "configuration_schema" ||
        initializationSchema.scope !== "material_initialization" ||
        initializationSchema.availability !== "verified"
      ) {
        addIssue(
          context,
          4,
          CHECK.materials,
          ISSUE.materialInitializationInvalid,
          `${path}.initialization`,
          "The concentration schema or unit does not match the registered material profile.",
          { registryId: authoredInitialization.configurationSchemaId }
        );
      } else {
        try {
          const normalized = canonicalizeBoundedConcentrationDecimal(
            authoredInitialization.concentration.decimalValue,
            concentrationContract
          );
          if (
            normalized.canonicalDecimalValue !==
            authoredInitialization.concentration.decimalValue
          ) {
            addIssue(
              context,
              4,
              CHECK.materials,
              ISSUE.materialInitializationInvalid,
              `${path}.initialization.concentration.decimalValue`,
              `Store the canonical decimal ${normalized.canonicalDecimalValue}.`,
              { registryId: profile.id }
            );
          }
        } catch (error) {
          if (!(error instanceof BoundedConcentrationError)) throw error;
          addIssue(
            context,
            4,
            CHECK.materials,
            ISSUE.materialInitializationInvalid,
            `${path}.initialization.concentration.decimalValue`,
            error.message,
            {
              registryId: profile.id,
              safetyRelated: error.code === "bounded_concentration.range"
            }
          );
        }
      }
    }
    profile.providedChemistryCapabilityIds.forEach((id) => {
      if (!requiredChemistry.has(id)) {
        addIssue(
          context,
          4,
          CHECK.materials,
          ISSUE.chemistryRequirementMissing,
          `${path}.materialProfileId`,
          `Definition does not require material capability ${id}.`,
          { registryId: id }
        );
      }
    });
    const container = context.equipmentById.get(material.containerInstanceId);
    if (!container) {
      reference(
        context,
        false,
        material.containerInstanceId,
        `${path}.containerInstanceId`,
        "equipment",
        4,
        CHECK.materials
      );
    } else {
      const missing = profile.compatibleContainerCapabilityIds.filter(
        (id) => !container.capabilityIds.includes(id)
      );
      if (missing.length > 0) {
        addIssue(
          context,
          4,
          CHECK.materials,
          ISSUE.materialContainerIncompatible,
          `${path}.containerInstanceId`,
          `${container.id} lacks required material-container capabilities.`,
          { registryId: missing[0] }
        );
      }
    }
    const quantity = configs.get(material.quantityPresetId);
    if (!quantity || quantity.category !== "quantity_preset") {
      addIssue(
        context,
        4,
        CHECK.materials,
        ISSUE.quantityIncompatible,
        `${path}.quantityPresetId`,
        `Unknown or non-quantity preset ${material.quantityPresetId}.`,
        { registryId: material.quantityPresetId }
      );
    } else {
      if (
        quantity.availability !== "verified" ||
        !profile.quantityPresetIds.includes(quantity.id) ||
        !quantity.compatibleMaterialProfileIds.includes(profile.id)
      ) {
        addIssue(
          context,
          4,
          CHECK.materials,
          ISSUE.quantityIncompatible,
          `${path}.quantityPresetId`,
          `${quantity.id} is not a verified exact preset for ${profile.id}.`,
          { registryId: quantity.id }
        );
      }
      if (
        container?.measurement &&
        quantity.unitId === "unit.ml.v1" &&
        quantity.amount > container.measurement.capacityML
      ) {
        addIssue(
          context,
          4,
          CHECK.materials,
          ISSUE.capacityExceeded,
          `${path}.quantityPresetId`,
          `${quantity.amount} mL exceeds ${container.measurement.capacityML} mL capacity.`,
          { registryId: quantity.id, safetyRelated: true }
        );
      }
    }
    const initialization = configs.get(profile.initializationPresetSchemaId);
    if (
      !initialization ||
      initialization.category !== "configuration_schema" ||
      initialization.scope !== "material_initialization"
    ) {
      addIssue(
        context,
        4,
        CHECK.materials,
        ISSUE.configurationMismatch,
        `${path}.materialProfileId`,
        `Material initialization schema ${profile.initializationPresetSchemaId} is unavailable.`,
        { registryId: profile.initializationPresetSchemaId }
      );
    }
  });

  // A container holds at most one reagent, and a reagent lives in at most one
  // container. Two reagents in one container (e.g. acid in the base's burette)
  // or one reagent split across containers is chemically contradictory and must
  // not reach a runnable/previewable state, even for an imported or edited draft.
  const reagentsByContainer = new Map<string, Set<string>>();
  const containersByReagent = new Map<string, Set<string>>();
  context.spec.materials.forEach((material, index) => {
    const path = `materials[${index}]`;
    const containerReagents =
      reagentsByContainer.get(material.containerInstanceId) ??
      new Set<string>();
    if (
      containerReagents.size > 0 &&
      !containerReagents.has(material.materialProfileId)
    ) {
      addIssue(
        context,
        4,
        CHECK.materials,
        ISSUE.materialContainerExclusive,
        `${path}.containerInstanceId`,
        `${material.containerInstanceId} holds more than one reagent.`,
        { registryId: material.containerInstanceId, safetyRelated: true }
      );
    }
    containerReagents.add(material.materialProfileId);
    reagentsByContainer.set(material.containerInstanceId, containerReagents);

    const reagentContainers =
      containersByReagent.get(material.materialProfileId) ?? new Set<string>();
    if (
      reagentContainers.size > 0 &&
      !reagentContainers.has(material.containerInstanceId)
    ) {
      addIssue(
        context,
        4,
        CHECK.materials,
        ISSUE.materialContainerExclusive,
        `${path}.materialProfileId`,
        `${material.materialProfileId} is placed in more than one container.`,
        { registryId: material.materialProfileId }
      );
    }
    reagentContainers.add(material.containerInstanceId);
    containersByReagent.set(material.materialProfileId, reagentContainers);
  });
}

function validateAuthoredLimits(
  context: ValidationContext,
  limits: Readonly<Record<string, number>>,
  parameters: readonly ActionParameterDefinition[],
  path: string,
  actionId: string
): void {
  Object.entries(limits).forEach(([key, value]) => {
    const minimum = parameters.find(
      ({ authoredMinimumKey }) => authoredMinimumKey === key
    );
    const maximum = parameters.find(
      ({ authoredMaximumKey }) => authoredMaximumKey === key
    );
    const parameter = minimum ?? maximum;
    const invalid =
      !parameter ||
      (minimum !== undefined &&
        (parameter.minimum === undefined ||
          value < parameter.minimum ||
          (parameter.maximum !== undefined && value > parameter.maximum))) ||
      (maximum !== undefined &&
        (parameter.maximum === undefined ||
          value > parameter.maximum ||
          (parameter.minimum !== undefined && value < parameter.minimum)));
    if (invalid) {
      addIssue(
        context,
        5,
        CHECK.actions,
        ISSUE.actionLimitIncompatible,
        `${path}.authoredLimits.${key}`,
        `${key}=${value} is not a bounded narrowing for ${actionId}.`,
        { registryId: actionId, safetyRelated: parameter !== undefined }
      );
    }
  });
}

function validateActions(context: ValidationContext): void {
  const actions = mapById(context.registries.actions.list());
  const parameterSchemas = mapById(
    context.registries.actionParameterSchemas.list()
  );
  const preconditions = mapById(
    context.registries.equipmentPreconditions.list()
  );
  const errors = mapById(context.registries.actionErrorContracts.list());
  const eventContracts = mapById(
    context.registries.actionEventContracts.list()
  );
  const configs = mapById(context.registries.configurations.list());
  const rules = context.ruleById;

  context.spec.permittedActions.forEach((permission, index) => {
    const path = `permittedActions[${index}]`;
    const entry = actions.get(permission.actionId) ?? null;
    context.actionByPermissionId.set(permission.id, entry);
    if (!entry) {
      addIssue(
        context,
        5,
        CHECK.actions,
        ISSUE.registryIdUnknown,
        `${path}.actionId`,
        `Unknown action ${permission.actionId}.`,
        { registryId: permission.actionId, suggestions: [...actions.keys()] }
      );
      return;
    }
    const source = permission.sourceEquipmentInstanceId
      ? context.equipmentById.get(permission.sourceEquipmentInstanceId)
      : null;
    if (
      entry.requiredSourceCapabilityIds.length > 0 &&
      !permission.sourceEquipmentInstanceId
    ) {
      addIssue(
        context,
        5,
        CHECK.actions,
        ISSUE.actionSourceIncompatible,
        `${path}.sourceEquipmentInstanceId`,
        `${entry.id} requires source equipment.`,
        { registryId: entry.id }
      );
    } else if (permission.sourceEquipmentInstanceId && !source) {
      reference(
        context,
        false,
        permission.sourceEquipmentInstanceId,
        `${path}.sourceEquipmentInstanceId`,
        "equipment",
        5,
        CHECK.actions
      );
    } else if (source) {
      if (
        !entry.actorComponentIds.includes(source.id) ||
        !source.allowedActionIds.includes(entry.id)
      ) {
        addIssue(
          context,
          5,
          CHECK.actions,
          ISSUE.actionSourceIncompatible,
          `${path}.sourceEquipmentInstanceId`,
          `${source.id} cannot source ${entry.id}.`,
          { registryId: source.id }
        );
      }
      entry.requiredSourceCapabilityIds.forEach((id) => {
        if (!source.capabilityIds.includes(id))
          addIssue(
            context,
            5,
            CHECK.actions,
            ISSUE.actionCapabilityMissing,
            `${path}.sourceEquipmentInstanceId`,
            `${source.id} lacks ${id}.`,
            { registryId: id }
          );
      });
    }
    addDuplicates(
      context,
      permission.targetEquipmentInstanceIds,
      (targetIndex) => `${path}.targetEquipmentInstanceIds[${targetIndex}]`,
      ISSUE.duplicateReference
    );
    if (
      entry.requiredTargetCapabilityIds.length > 0 &&
      permission.targetEquipmentInstanceIds.length === 0
    ) {
      addIssue(
        context,
        5,
        CHECK.actions,
        ISSUE.actionTargetIncompatible,
        `${path}.targetEquipmentInstanceIds`,
        `${entry.id} requires a target.`,
        { registryId: entry.id }
      );
    }
    if (permission.targetEquipmentInstanceIds.length > 1) {
      addIssue(
        context,
        5,
        CHECK.actions,
        ISSUE.actionTargetIncompatible,
        `${path}.targetEquipmentInstanceIds`,
        `${entry.id} has no verified multi-target contract.`,
        { registryId: entry.id }
      );
    }
    permission.targetEquipmentInstanceIds.forEach((id, targetIndex) => {
      const target = context.equipmentById.get(id);
      if (!target) {
        reference(
          context,
          false,
          id,
          `${path}.targetEquipmentInstanceIds[${targetIndex}]`,
          "equipment",
          5,
          CHECK.actions
        );
        return;
      }
      if (!entry.targetComponentIds.includes(target.id)) {
        addIssue(
          context,
          5,
          CHECK.actions,
          ISSUE.actionTargetIncompatible,
          `${path}.targetEquipmentInstanceIds[${targetIndex}]`,
          `${target.id} cannot receive ${entry.id}.`,
          { registryId: target.id }
        );
      }
      entry.requiredTargetCapabilityIds.forEach((capabilityId) => {
        if (!target.capabilityIds.includes(capabilityId))
          addIssue(
            context,
            5,
            CHECK.actions,
            ISSUE.actionCapabilityMissing,
            `${path}.targetEquipmentInstanceIds[${targetIndex}]`,
            `${target.id} lacks ${capabilityId}.`,
            { registryId: capabilityId }
          );
      });
    });
    const parameterSchema = parameterSchemas.get(entry.parameterSchemaId);
    if (!parameterSchema || !parameterSchema.actionIds.includes(entry.id)) {
      addIssue(
        context,
        5,
        CHECK.actions,
        ISSUE.actionContractIncompatible,
        `${path}.actionId`,
        `Parameter schema ${entry.parameterSchemaId} does not resolve for ${entry.id}.`,
        { registryId: entry.parameterSchemaId }
      );
    }
    if (permission.parameterPresetId) {
      const preset = configs.get(permission.parameterPresetId);
      if (
        !preset ||
        preset.category !== "action_parameters" ||
        preset.availability !== "verified" ||
        !preset.compatibleActionIds.includes(entry.id) ||
        preset.schemaId !== entry.parameterSchemaId
      ) {
        addIssue(
          context,
          5,
          CHECK.actions,
          ISSUE.actionParameterIncompatible,
          `${path}.parameterPresetId`,
          `${permission.parameterPresetId} is not an exact parameter preset for ${entry.id}.`,
          { registryId: permission.parameterPresetId }
        );
      }
    }
    if (permission.authoredLimits)
      validateAuthoredLimits(
        context,
        permission.authoredLimits,
        parameterSchema?.parameters ?? entry.parameters,
        path,
        entry.id
      );
    entry.preconditionIds.forEach((id) => {
      const precondition = preconditions.get(id);
      const participant =
        precondition?.equipmentRole === "source"
          ? source
          : permission.targetEquipmentInstanceIds.length === 1
            ? context.equipmentById.get(
                permission.targetEquipmentInstanceIds[0]!
              )
            : null;
      if (
        !precondition ||
        !participant ||
        participant.stateSchemaId !== precondition.stateSchemaId
      ) {
        addIssue(
          context,
          5,
          CHECK.actions,
          ISSUE.actionContractIncompatible,
          `${path}.actionId`,
          `Precondition ${id} does not resolve to the selected equipment.`,
          { registryId: id }
        );
      }
    });
    entry.possibleErrorCodes.forEach((id) => {
      if (!errors.has(id))
        addIssue(
          context,
          5,
          CHECK.actions,
          ISSUE.actionContractIncompatible,
          `${path}.actionId`,
          `Unknown action error contract ${id}.`,
          { registryId: id }
        );
    });
    const eventContract = eventContracts.get(entry.emittedEventContractId);
    if (!eventContract)
      addIssue(
        context,
        5,
        CHECK.actions,
        ISSUE.actionContractIncompatible,
        `${path}.actionId`,
        `Unknown event contract ${entry.emittedEventContractId}.`,
        { registryId: entry.emittedEventContractId }
      );
    if (
      ![
        source,
        ...permission.targetEquipmentInstanceIds.map((id) =>
          context.equipmentById.get(id)
        )
      ].some(
        (participant) =>
          participant?.mechanicalAdapterId === entry.mechanicalAdapterId &&
          participant.mechanicalAdapterAvailability === "verified"
      )
    ) {
      addIssue(
        context,
        5,
        CHECK.actions,
        ISSUE.adapterUnavailable,
        `${path}.actionId`,
        `Mechanical adapter ${entry.mechanicalAdapterId} is unavailable for this connection.`,
        { registryId: entry.mechanicalAdapterId }
      );
    } else {
      (
        context.resolvedAdapters as ValidationResultV2["resolvedAdapters"][number][]
      ).push({
        kind: "mechanical",
        ownerId: entry.id,
        adapterId: entry.mechanicalAdapterId,
        version: entry.version
      });
    }
    const satisfied = new Set(permission.availability.allSatisfiedRuleIds);
    permission.availability.allSatisfiedRuleIds.forEach((id, ruleIndex) =>
      reference(
        context,
        rules.has(id),
        id,
        `${path}.availability.allSatisfiedRuleIds[${ruleIndex}]`,
        "rule",
        5,
        CHECK.actions
      )
    );
    permission.availability.allUnsatisfiedRuleIds.forEach((id, ruleIndex) => {
      reference(
        context,
        rules.has(id),
        id,
        `${path}.availability.allUnsatisfiedRuleIds[${ruleIndex}]`,
        "rule",
        5,
        CHECK.actions
      );
      if (satisfied.has(id))
        addIssue(
          context,
          5,
          CHECK.actions,
          ISSUE.actionAvailabilityContradiction,
          `${path}.availability.allUnsatisfiedRuleIds[${ruleIndex}]`,
          `Rule ${id} is required both satisfied and unsatisfied.`,
          { registryId: id }
        );
    });
  });
}

function validateChemistry(context: ValidationContext): void {
  addDuplicates(
    context,
    context.spec.requiredChemistryCapabilityIds,
    (index) => `requiredChemistryCapabilityIds[${index}]`,
    ISSUE.duplicateReference
  );
  context.spec.requiredChemistryCapabilityIds.forEach((id, index) => {
    let capability;
    try {
      capability = context.registries.capabilities.getChemistry(id);
    } catch {
      addIssue(
        context,
        6,
        CHECK.chemistryModels,
        ISSUE.registryIdUnknown,
        `requiredChemistryCapabilityIds[${index}]`,
        `Unknown chemistry capability ${id}.`,
        { registryId: id }
      );
      return;
    }
    if (capability.availability !== "verified") {
      addIssue(
        context,
        6,
        CHECK.chemistryModels,
        ISSUE.chemistryCapabilityUnavailable,
        `requiredChemistryCapabilityIds[${index}]`,
        `${id} is ${capability.availability}, not verified.`,
        { registryId: id }
      );
    }
  });
  try {
    const resolution = resolveChemistryModelProviders(
      context.spec.requiredChemistryCapabilityIds,
      {
        capabilityRegistry: context.registries.capabilities,
        modelRegistry: context.registries.chemistryModels,
        ...(context.spec.compatibility
          ? {
              compatibilityRuntimeAdapterId:
                context.spec.compatibility.runtimeAdapterId
            }
          : {})
      }
    );
    context.resolvedChemistryModels = resolution.orderedModels.map((model) => ({
      modelId: model.id,
      version: model.version,
      providedCapabilityIds: [...model.providedCapabilityIds]
    }));
  } catch (error) {
    if (!(error instanceof ChemistryModelResolutionError)) throw error;
    addIssue(
      context,
      6,
      CHECK.chemistryModels,
      ISSUE.chemistryModelResolutionFailed,
      "requiredChemistryCapabilityIds",
      error.message,
      { registryId: error.capabilityId ?? error.modelId }
    );
  }
  const compatibility = context.spec.compatibility;
  if (compatibility) {
    const engine = context.registries.engines
      .list()
      .find(({ id }) => id === compatibility.engineId);
    if (!engine) {
      addIssue(
        context,
        6,
        CHECK.chemistryModels,
        ISSUE.legacyCompatibilityInvalid,
        "compatibility.engineId",
        `Unknown legacy engine ${compatibility.engineId}.`,
        { registryId: compatibility.engineId }
      );
    } else {
      const config = context.registries.configurations
        .list()
        .find(({ id }) => id === compatibility.engineConfigurationPresetId);
      const seed = context.registries.configurations
        .list()
        .find(({ id }) => id === compatibility.initializationPresetId);
      if (
        !engine.engineConfigIds.includes(
          compatibility.engineConfigurationPresetId
        ) ||
        config?.category !== "engine_configuration" ||
        !engine.seedTemplateIds.includes(
          compatibility.initializationPresetId
        ) ||
        seed?.category !== "seed_template"
      ) {
        addIssue(
          context,
          6,
          CHECK.chemistryModels,
          ISSUE.legacyCompatibilityInvalid,
          "compatibility",
          "Legacy engine configuration or seed does not resolve exactly.",
          { registryId: compatibility.engineId }
        );
      }
    }
    compatibility.equipmentRoleBindings.forEach((binding, index) =>
      reference(
        context,
        context.equipmentById.has(binding.equipmentInstanceId),
        binding.equipmentInstanceId,
        `compatibility.equipmentRoleBindings[${index}].equipmentInstanceId`,
        "equipment",
        6,
        CHECK.chemistryModels
      )
    );
    compatibility.materialRoleBindings.forEach((binding, index) =>
      reference(
        context,
        context.materialById.has(binding.materialInstanceId),
        binding.materialInstanceId,
        `compatibility.materialRoleBindings[${index}].materialInstanceId`,
        "material",
        6,
        CHECK.chemistryModels
      )
    );
    if (
      compatibility.runtimeAdapterId !== LEGACY_TITRATION_RUNTIME_ADAPTER.id ||
      compatibility.runtimeAdapterVersion !==
        LEGACY_TITRATION_RUNTIME_ADAPTER.version ||
      compatibility.engineId !== LEGACY_TITRATION_RUNTIME_ADAPTER.engineId
    ) {
      addIssue(
        context,
        6,
        CHECK.chemistryModels,
        ISSUE.legacyAdapterUnavailable,
        "compatibility.runtimeAdapterId",
        `No exact executable legacy adapter matches ${compatibility.runtimeAdapterId}@${compatibility.runtimeAdapterVersion}.`,
        { registryId: compatibility.runtimeAdapterId }
      );
    }
  }
}

function emittedEventIds(context: ValidationContext): Set<string> {
  const result = new Set<string>();
  const eventTypes = context.registries.eventTypes.list();
  for (const action of context.actionByPermissionId.values()) {
    if (!action) continue;
    for (const semanticType of action.emittedSemanticEventTypes) {
      for (const event of eventTypes) {
        if (
          event.id === semanticType ||
          event.semanticEventType === semanticType
        )
          result.add(event.id);
      }
    }
  }
  return result;
}

function validateEvent(
  context: ValidationContext,
  id: string,
  path: string,
  reachableEvents: ReadonlySet<string>,
  requireReachable = true
): EventTypeRegistryEntry | null {
  const event =
    context.registries.eventTypes
      .list()
      .find(({ id: candidate }) => candidate === id) ?? null;
  if (!event) {
    addIssue(
      context,
      7,
      CHECK.rules,
      ISSUE.registryIdUnknown,
      path,
      `Unknown event type ${id}.`,
      { registryId: id }
    );
  } else if (requireReachable && !reachableEvents.has(id)) {
    addIssue(
      context,
      7,
      CHECK.rules,
      ISSUE.evidenceUnreachable,
      path,
      `No permitted action emits ${id}.`,
      { registryId: id }
    );
  }
  return event;
}

function stateValueMatches(
  field: ComponentRegistryEntry["stateSchema"]["fields"][number],
  value: StructuredEvidenceValue
): boolean {
  if (value.valueType === "null") return field.nullable;
  if (field.valueType === "boolean") return value.valueType === "boolean";
  if (field.valueType === "number") return value.valueType === "number";
  if (field.valueType === "string") return value.valueType === "text";
  if (field.valueType === "string_array")
    return value.valueType === "text_list";
  return (
    value.valueType === "identifier" &&
    (!field.allowedValues || field.allowedValues.includes(String(value.value)))
  );
}

function conditionReachable(
  context: ValidationContext,
  rule: WorkflowRule,
  index: number,
  reachableEvents: ReadonlySet<string>
): boolean {
  const condition = rule.condition;
  const path = `rules[${index}].condition`;
  switch (condition.kind) {
    case "equipment_state_equals":
    case "forbidden_state_never_reached": {
      // same exact state metadata validation
      const equipmentId = condition.equipmentInstanceId;
      const equipment = context.equipmentById.get(equipmentId);
      if (!equipment)
        return reference(
          context,
          false,
          equipmentId,
          `${path}.equipmentInstanceId`,
          "equipment",
          7,
          CHECK.rules
        );
      const field = equipment.stateSchema.fields.find(
        ({ key }) => key === condition.stateFieldKey
      );
      const value =
        condition.kind === "equipment_state_equals"
          ? condition.expectedValue
          : condition.forbiddenValue;
      if (!field || !stateValueMatches(field, value)) {
        addIssue(
          context,
          7,
          CHECK.rules,
          ISSUE.equipmentStateIncompatible,
          `${path}.stateFieldKey`,
          `${condition.stateFieldKey} is not a compatible state value for ${equipment.id}.`,
          { registryId: equipment.id }
        );
        return false;
      }
      return true;
    }
    case "equipment_capability_present": {
      const equipment = context.equipmentById.get(
        condition.equipmentInstanceId
      );
      if (!equipment)
        return reference(
          context,
          false,
          condition.equipmentInstanceId,
          `${path}.equipmentInstanceId`,
          "equipment",
          7,
          CHECK.rules
        );
      if (!equipment.capabilityIds.includes(condition.capabilityId)) {
        addIssue(
          context,
          7,
          CHECK.rules,
          ISSUE.ruleConditionInvalid,
          `${path}.capabilityId`,
          `${equipment.id} does not have ${condition.capabilityId}.`,
          { registryId: condition.capabilityId }
        );
        return false;
      }
      return true;
    }
    case "material_bound_to_container": {
      const material = context.spec.materials.find(
        ({ instanceId }) => instanceId === condition.materialInstanceId
      );
      const valid =
        material?.containerInstanceId ===
        condition.containerEquipmentInstanceId;
      if (!valid)
        addIssue(
          context,
          7,
          CHECK.rules,
          ISSUE.ruleConditionInvalid,
          path,
          "Material binding condition does not match the authored setup.",
          { registryId: condition.materialInstanceId }
        );
      return valid;
    }
    case "action_observed":
    case "action_count_within_range": {
      const matching = context.spec.permittedActions.filter(
        (permission) =>
          permission.actionId === condition.actionId &&
          (condition.sourceEquipmentInstanceId === undefined ||
            permission.sourceEquipmentInstanceId ===
              condition.sourceEquipmentInstanceId) &&
          condition.targetEquipmentInstanceIds.every((id) =>
            permission.targetEquipmentInstanceIds.includes(id)
          )
      );
      if (matching.length === 0) {
        addIssue(
          context,
          7,
          CHECK.rules,
          ISSUE.evidenceUnreachable,
          path,
          `No permitted action matches ${condition.actionId}.`,
          { registryId: condition.actionId }
        );
        return false;
      }
      if (
        condition.kind === "action_count_within_range" &&
        matching.every(
          ({ maxAttempts }) =>
            maxAttempts !== undefined && maxAttempts < condition.minimumCount
        )
      ) {
        addIssue(
          context,
          7,
          CHECK.rules,
          ISSUE.successUnreachable,
          `${path}.minimumCount`,
          "Action count exceeds every matching permission's maxAttempts.",
          { registryId: condition.actionId }
        );
        return false;
      }
      return true;
    }
    case "semantic_event_observed":
      return (
        validateEvent(
          context,
          condition.eventTypeId,
          `${path}.eventTypeId`,
          reachableEvents
        ) !== null && reachableEvents.has(condition.eventTypeId)
      );
    case "observation_recorded": {
      const observation = resolveConfiguration(
        context,
        condition.observationKeyId,
        `${path}.observationKeyId`,
        "observation_key",
        7,
        CHECK.rules
      );
      const event = condition.eventTypeId
        ? validateEvent(
            context,
            condition.eventTypeId,
            `${path}.eventTypeId`,
            reachableEvents
          )
        : null;
      if (condition.expectedValueSourceId)
        resolveConfiguration(
          context,
          condition.expectedValueSourceId,
          `${path}.expectedValueSourceId`,
          "observable",
          7,
          CHECK.rules
        );
      if (
        event &&
        !event.observationKeys.includes(
          observation?.adapterKey ?? condition.observationKeyId
        )
      ) {
        addIssue(
          context,
          7,
          CHECK.rules,
          ISSUE.ruleConditionInvalid,
          `${path}.observationKeyId`,
          `${condition.observationKeyId} is not emitted by ${event.id}.`,
          { registryId: condition.observationKeyId }
        );
        return false;
      }
      return (
        observation !== null &&
        (!condition.eventTypeId || reachableEvents.has(condition.eventTypeId))
      );
    }
    case "registered_completion_policy_satisfied": {
      const completion = resolveConfiguration(
        context,
        condition.completionPolicyId,
        `${path}.completionPolicyId`,
        "completion_policy",
        7,
        CHECK.rules
      );
      condition.evidenceRuleIds.forEach((id, evidenceIndex) =>
        reference(
          context,
          context.ruleById.has(id),
          id,
          `${path}.evidenceRuleIds[${evidenceIndex}]`,
          "rule",
          7,
          CHECK.rules
        )
      );
      if (condition.evidenceRuleIds.includes(rule.id)) {
        addIssue(
          context,
          7,
          CHECK.rules,
          ISSUE.ruleCycle,
          `${path}.evidenceRuleIds`,
          `Rule ${rule.id} depends on itself.`,
          { registryId: rule.id }
        );
        return false;
      }
      if (
        condition.completionPolicyId ===
          "completion.engine_endpoint_observed.v1" &&
        !context.spec.compatibility
      ) {
        addIssue(
          context,
          7,
          CHECK.rules,
          ISSUE.ruleConditionInvalid,
          `${path}.completionPolicyId`,
          "Engine endpoint completion requires explicit legacy compatibility.",
          { registryId: condition.completionPolicyId }
        );
        return false;
      }
      return (
        completion !== null &&
        condition.evidenceRuleIds.every((id) => context.ruleById.has(id))
      );
    }
    case "observable_within_tolerance": {
      const observableResolved =
        resolveConfiguration(
          context,
          condition.observableId,
          `${path}.observableId`,
          "observable",
          7,
          CHECK.rules
        ) !== null;
      const unitResolved =
        resolveConfiguration(
          context,
          condition.unitId,
          `${path}.unitId`,
          "unit",
          7,
          CHECK.rules
        ) !== null;
      let boundsPlausible = true;
      if (condition.minimum > condition.maximum) {
        addIssue(
          context,
          7,
          CHECK.rules,
          ISSUE.ruleConditionInvalid,
          `${path}.minimum`,
          `The lowest accepted value ${condition.minimum} is greater than the highest ${condition.maximum}.`
        );
        boundsPlausible = false;
      }
      // The supported measurements (e.g. a burette reading in mL) are physical
      // quantities that cannot be negative. A negative accepted range can never
      // be satisfied by a student, so it must not reach a runnable state.
      if (condition.minimum < 0 || condition.maximum < 0) {
        addIssue(
          context,
          7,
          CHECK.rules,
          ISSUE.ruleConditionInvalid,
          `${path}.minimum`,
          "A measured result cannot be negative.",
          { safetyRelated: true }
        );
        boundsPlausible = false;
      }
      return observableResolved && unitResolved && boundsPlausible;
    }
    case "event_flag": {
      const flag = context.registries.eventFlags
        .list()
        .find(({ id }) => id === condition.flagId);
      if (!flag) {
        addIssue(
          context,
          7,
          CHECK.rules,
          ISSUE.registryIdUnknown,
          `${path}.flagId`,
          `Unknown event flag ${condition.flagId}.`,
          { registryId: condition.flagId }
        );
        return false;
      }
      if (condition.eventTypeId) {
        const event = validateEvent(
          context,
          condition.eventTypeId,
          `${path}.eventTypeId`,
          reachableEvents
        );
        if (
          event &&
          !flag.emittedBySemanticEventTypes.includes(event.semanticEventType)
        ) {
          addIssue(
            context,
            7,
            CHECK.rules,
            ISSUE.ruleConditionInvalid,
            path,
            `${flag.id} is not emitted by ${event.id}.`,
            { registryId: flag.id }
          );
          return false;
        }
      }
      return (
        condition.presence === "absent" ||
        !condition.eventTypeId ||
        reachableEvents.has(condition.eventTypeId)
      );
    }
    case "rule_satisfied_before":
      return (
        reference(
          context,
          context.ruleById.has(condition.predecessorRuleId),
          condition.predecessorRuleId,
          `${path}.predecessorRuleId`,
          "rule",
          7,
          CHECK.rules
        ) &&
        reference(
          context,
          context.ruleById.has(condition.successorRuleId),
          condition.successorRuleId,
          `${path}.successorRuleId`,
          "rule",
          7,
          CHECK.rules
        )
      );
    case "student_response_submitted":
      return (
        resolveConfiguration(
          context,
          condition.submissionFieldId,
          `${path}.submissionFieldId`,
          "submission_field",
          7,
          CHECK.rules
        ) !== null
      );
  }
}

function graphHasCycle(edges: readonly (readonly [string, string])[]): boolean {
  const adjacency = new Map<string, string[]>();
  for (const [from, to] of edges)
    adjacency.set(from, [...(adjacency.get(from) ?? []), to]);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of (adjacency.get(id) ?? []).sort(compareStrings))
      if (visit(next)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return [...adjacency.keys()].sort(compareStrings).some(visit);
}

function validateRules(context: ValidationContext): void {
  const reachableEvents = emittedEventIds(context);
  const positive = new Map<string, string>();
  const negative = new Map<string, string>();
  const orderingEdges: [string, string][] = [];
  const completionEdges: [string, string][] = [];
  let successCount = 0;
  let reachableSuccess = 0;
  context.spec.rules.forEach((rule, index) => {
    const path = `rules[${index}]`;
    rule.objectiveIds.forEach((id, objectiveIndex) => {
      if (!context.spec.objectiveIds.includes(id))
        addIssue(
          context,
          7,
          CHECK.rules,
          ISSUE.objectiveInvalid,
          `${path}.objectiveIds[${objectiveIndex}]`,
          `Rule objective ${id} is not selected by the lab.`,
          { registryId: id }
        );
    });
    const isOrdering = rule.condition.kind === "rule_satisfied_before";
    if ((rule.kind === "ordering") !== isOrdering)
      addIssue(
        context,
        7,
        CHECK.rules,
        ISSUE.ruleKindIncompatible,
        `${path}.kind`,
        "Ordering rules and rule_satisfied_before conditions must be paired.",
        { registryId: rule.id }
      );
    if (rule.condition.kind === "rule_satisfied_before")
      orderingEdges.push([
        rule.condition.predecessorRuleId,
        rule.condition.successorRuleId
      ]);
    if (rule.condition.kind === "registered_completion_policy_satisfied") {
      for (const id of rule.condition.evidenceRuleIds)
        completionEdges.push([rule.id, id]);
    }
    const reachable = conditionReachable(context, rule, index, reachableEvents);
    if (rule.kind === "success") {
      successCount += 1;
      if (reachable) reachableSuccess += 1;
    }
    const key = JSON.stringify(rule.condition);
    const bucket =
      rule.kind === "failure" || rule.kind === "forbidden"
        ? negative
        : rule.kind === "required" || rule.kind === "success"
          ? positive
          : null;
    const opposite =
      bucket === positive ? negative : bucket === negative ? positive : null;
    if (bucket && opposite?.has(key))
      addIssue(
        context,
        7,
        CHECK.rules,
        ISSUE.ruleContradiction,
        `${path}.condition`,
        `Condition contradicts rule ${opposite.get(key)}.`,
        { registryId: rule.id }
      );
    bucket?.set(key, rule.id);
  });
  if (successCount === 0)
    addIssue(
      context,
      7,
      CHECK.rules,
      ISSUE.successMissing,
      "rules",
      "At least one success rule is required."
    );
  else if (reachableSuccess === 0)
    addIssue(
      context,
      7,
      CHECK.rules,
      ISSUE.successUnreachable,
      "rules",
      "No success rule is statically reachable."
    );
  if (graphHasCycle(orderingEdges) || graphHasCycle(completionEdges))
    addIssue(
      context,
      7,
      CHECK.rules,
      ISSUE.ruleCycle,
      "rules",
      "Workflow rule dependency graph contains a cycle."
    );
}

function validateRubric(context: ValidationContext): void {
  const rules = context.ruleById;
  const eventIds = new Set(
    context.registries.eventTypes.list().map(({ id }) => id)
  );
  const total = context.spec.rubric.criteria.reduce(
    (sum, criterion) => sum + criterion.maxPoints,
    0
  );
  if (total !== context.spec.rubric.totalPoints) {
    addIssue(
      context,
      8,
      CHECK.rubric,
      ISSUE.rubricInvalid,
      "rubric.totalPoints",
      `Rubric total ${context.spec.rubric.totalPoints} does not equal criterion sum ${total}.`
    );
  }
  resolveConfiguration(
    context,
    context.spec.rubric.passingPolicyId,
    "rubric.passingPolicyId",
    "passing_policy",
    8,
    CHECK.rubric
  );
  context.spec.rubric.criteria.forEach((criterion, index) => {
    const path = `rubric.criteria[${index}]`;
    // A grading item must be worth more than zero points, otherwise full credit
    // equals no credit and the rubric row can never award anything.
    if (criterion.maxPoints <= 0) {
      addIssue(
        context,
        8,
        CHECK.rubric,
        ISSUE.rubricInvalid,
        `${path}.maxPoints`,
        "A grading item must be worth more than zero points."
      );
    }
    criterion.objectiveIds.forEach((id, objectiveIndex) => {
      if (!context.spec.objectiveIds.includes(id))
        addIssue(
          context,
          8,
          CHECK.rubric,
          ISSUE.objectiveInvalid,
          `${path}.objectiveIds[${objectiveIndex}]`,
          `Rubric objective ${id} is not selected.`,
          { registryId: id }
        );
    });
    criterion.ruleIds.forEach((id, ruleIndex) => {
      if (!rules.has(id))
        reference(
          context,
          false,
          id,
          `${path}.ruleIds[${ruleIndex}]`,
          "rule",
          8,
          CHECK.rubric
        );
    });
    resolveConfiguration(
      context,
      criterion.assessmentModeId,
      `${path}.assessmentModeId`,
      "assessment_mode",
      8,
      CHECK.rubric
    );
    criterion.evidenceMappings.forEach((mapping, mappingIndex) => {
      const evidencePath = `${path}.evidenceMappings[${mappingIndex}]`;
      if (mapping.kind === "rule_diagnosis")
        reference(
          context,
          rules.has(mapping.ruleId),
          mapping.ruleId,
          `${evidencePath}.ruleId`,
          "rule",
          8,
          CHECK.rubric
        );
      if (mapping.kind === "semantic_event")
        reference(
          context,
          eventIds.has(mapping.eventTypeId),
          mapping.eventTypeId,
          `${evidencePath}.eventTypeId`,
          "event",
          8,
          CHECK.rubric
        );
      if (mapping.kind === "semantic_event_observation") {
        resolveConfiguration(
          context,
          mapping.observationKeyId,
          `${evidencePath}.observationKeyId`,
          "observation_key",
          8,
          CHECK.rubric
        );
        if (mapping.eventTypeId)
          reference(
            context,
            eventIds.has(mapping.eventTypeId),
            mapping.eventTypeId,
            `${evidencePath}.eventTypeId`,
            "event",
            8,
            CHECK.rubric
          );
      }
      if (mapping.kind === "observable")
        resolveConfiguration(
          context,
          mapping.observableId,
          `${evidencePath}.observableId`,
          "observable",
          8,
          CHECK.rubric
        );
      if (mapping.kind === "student_response")
        resolveConfiguration(
          context,
          mapping.submissionFieldId,
          `${evidencePath}.submissionFieldId`,
          "submission_field",
          8,
          CHECK.rubric
        );
    });
  });
}

function validatePresentationAndCoach(context: ValidationContext): void {
  const ruleIds = new Set(context.spec.rules.map(({ id }) => id));
  const instructionIds = new Set(context.spec.instructions.map(({ id }) => id));
  const equipmentIds = new Set(
    context.spec.equipment.map(({ instanceId }) => instanceId)
  );
  const materialIds = new Set(
    context.spec.materials.map(({ instanceId }) => instanceId)
  );
  const eventById = mapById(context.registries.eventTypes.list());
  const flagsById = mapById(context.registries.eventFlags.list());

  context.spec.instructions.forEach((instruction, index) => {
    addDuplicates(
      context,
      instruction.relatedRuleIds,
      (ruleIndex) => `instructions[${index}].relatedRuleIds[${ruleIndex}]`,
      ISSUE.duplicateReference
    );
    instruction.relatedRuleIds.forEach((id, ruleIndex) =>
      reference(
        context,
        ruleIds.has(id),
        id,
        `instructions[${index}].relatedRuleIds[${ruleIndex}]`,
        "rule",
        9,
        CHECK.presentationCoach
      )
    );
  });
  context.spec.presentation.instructionGuidance.forEach((guidance, index) => {
    reference(
      context,
      instructionIds.has(guidance.instructionId),
      guidance.instructionId,
      `presentation.instructionGuidance[${index}].instructionId`,
      "instruction",
      9,
      CHECK.presentationCoach
    );
    guidance.equipmentInstanceIds.forEach((id, equipmentIndex) =>
      reference(
        context,
        equipmentIds.has(id),
        id,
        `presentation.instructionGuidance[${index}].equipmentInstanceIds[${equipmentIndex}]`,
        "equipment",
        9,
        CHECK.presentationCoach
      )
    );
  });
  context.spec.presentation.materialLabels.forEach((label, index) =>
    reference(
      context,
      materialIds.has(label.materialInstanceId),
      label.materialInstanceId,
      `presentation.materialLabels[${index}].materialInstanceId`,
      "material",
      9,
      CHECK.presentationCoach
    )
  );
  context.spec.presentation.rulePrompts.forEach((prompt, index) =>
    reference(
      context,
      ruleIds.has(prompt.ruleId),
      prompt.ruleId,
      `presentation.rulePrompts[${index}].ruleId`,
      "rule",
      9,
      CHECK.presentationCoach
    )
  );

  context.spec.coachPolicy.triggers.forEach((trigger, index) => {
    const path = `coachPolicy.triggers[${index}]`;
    trigger.objectiveIds.forEach((id, objectiveIndex) => {
      if (!context.spec.objectiveIds.includes(id))
        addIssue(
          context,
          9,
          CHECK.presentationCoach,
          ISSUE.coachInvalid,
          `${path}.objectiveIds[${objectiveIndex}]`,
          `Coach objective ${id} is not selected.`,
          { registryId: id }
        );
    });
    resolveConfiguration(
      context,
      trigger.triggerTypeId,
      `${path}.triggerTypeId`,
      "coach_trigger",
      9,
      CHECK.presentationCoach
    );
    resolveConfiguration(
      context,
      trigger.hintStrategyId,
      `${path}.hintStrategyId`,
      "hint_strategy",
      9,
      CHECK.presentationCoach
    );
    const semanticEvents = trigger.eventTypeIds.map((id, eventIndex) => {
      const event = eventById.get(id);
      if (!event)
        addIssue(
          context,
          9,
          CHECK.presentationCoach,
          ISSUE.coachInvalid,
          `${path}.eventTypeIds[${eventIndex}]`,
          `Unknown coach event ${id}.`,
          { registryId: id }
        );
      return event?.semanticEventType;
    });
    trigger.flagIds.forEach((id, flagIndex) => {
      const flag = flagsById.get(id);
      if (
        !flag ||
        !flag.coachEligible ||
        !trigger.objectiveIds.includes(flag.canonicalSkillId) ||
        !flag.emittedBySemanticEventTypes.some((type) =>
          semanticEvents.includes(type)
        )
      ) {
        addIssue(
          context,
          9,
          CHECK.presentationCoach,
          ISSUE.coachInvalid,
          `${path}.flagIds[${flagIndex}]`,
          `${id} is not a compatible coach flag.`,
          { registryId: id }
        );
      }
      if (
        flag?.positiveStaySilentEvidenceReasonId &&
        !trigger.staySilentOnEventReasonIds.includes(
          flag.positiveStaySilentEvidenceReasonId
        )
      ) {
        addIssue(
          context,
          9,
          CHECK.presentationCoach,
          ISSUE.coachInvalid,
          `${path}.staySilentOnEventReasonIds`,
          `Missing positive stay-silent reason ${flag.positiveStaySilentEvidenceReasonId}.`,
          { registryId: flag.positiveStaySilentEvidenceReasonId }
        );
      }
    });
    trigger.staySilentOnEventReasonIds.forEach((id, reasonIndex) =>
      resolveConfiguration(
        context,
        id,
        `${path}.staySilentOnEventReasonIds[${reasonIndex}]`,
        "evidence_reason",
        9,
        CHECK.presentationCoach
      )
    );
  });
  context.spec.coachPolicy.adaptiveRetries.forEach((retry, index) => {
    const path = `coachPolicy.adaptiveRetries[${index}]`;
    resolveConfiguration(
      context,
      retry.templateId,
      `${path}.templateId`,
      "retry_template",
      9,
      CHECK.presentationCoach
    );
    resolveConfiguration(
      context,
      retry.initializationPresetId,
      `${path}.initializationPresetId`,
      "seed_template",
      9,
      CHECK.presentationCoach
    );
    retry.targetObjectiveIds.forEach((id, objectiveIndex) => {
      if (!context.spec.objectiveIds.includes(id))
        addIssue(
          context,
          9,
          CHECK.presentationCoach,
          ISSUE.coachInvalid,
          `${path}.targetObjectiveIds[${objectiveIndex}]`,
          `Retry objective ${id} is not selected.`,
          { registryId: id }
        );
    });
    retry.eligibleFlagIds.forEach((id, flagIndex) => {
      if (!flagsById.has(id))
        addIssue(
          context,
          9,
          CHECK.presentationCoach,
          ISSUE.coachInvalid,
          `${path}.eligibleFlagIds[${flagIndex}]`,
          `Unknown retry flag ${id}.`,
          { registryId: id }
        );
    });
    retry.successEvidenceReasonIds.forEach((id, reasonIndex) =>
      resolveConfiguration(
        context,
        id,
        `${path}.successEvidenceReasonIds[${reasonIndex}]`,
        "evidence_reason",
        9,
        CHECK.presentationCoach
      )
    );
  });
}

function validateSafety(context: ValidationContext): void {
  const policies = mapById(context.registries.safety.list());
  const listed = new Set(context.spec.safetyPolicyIds);
  const equipmentIds = new Set(
    context.spec.equipment.map(({ instanceId }) => instanceId)
  );
  const materialIds = new Set(
    context.spec.materials.map(({ instanceId }) => instanceId)
  );
  context.spec.safetyPolicyIds.forEach((id, index) => {
    const policy = policies.get(id);
    if (!policy)
      addIssue(
        context,
        10,
        CHECK.safety,
        ISSUE.safetyPolicyInvalid,
        `safetyPolicyIds[${index}]`,
        `Unknown safety policy ${id}.`,
        { registryId: id, safetyRelated: true }
      );
    else if (policy.prohibited || policy.availability !== "verified")
      addIssue(
        context,
        10,
        CHECK.safety,
        ISSUE.safetyProhibited,
        `safetyPolicyIds[${index}]`,
        `${id} is prohibited or unavailable.`,
        { registryId: id, safetyRelated: true }
      );
  });
  for (const [instanceId, equipment] of context.equipmentById) {
    for (const policyId of equipment?.safetyConstraintIds ?? []) {
      if (!listed.has(policyId))
        addIssue(
          context,
          10,
          CHECK.safety,
          ISSUE.safetyBindingInvalid,
          "safetyPolicyIds",
          `Equipment ${instanceId} requires ${policyId}.`,
          { registryId: policyId, safetyRelated: true }
        );
    }
  }
  for (const [instanceId, material] of context.materialById) {
    for (const policyId of material?.safetyPolicyIds ?? []) {
      if (!listed.has(policyId))
        addIssue(
          context,
          10,
          CHECK.safety,
          ISSUE.safetyBindingInvalid,
          "safetyPolicyIds",
          `Material ${instanceId} requires ${policyId}.`,
          { registryId: policyId, safetyRelated: true }
        );
    }
    if (material?.concentrationAuthoring) {
      for (const policyId of material.concentrationAuthoring.safetyPolicyIds) {
        const bound = context.spec.safetyBindings.some(
          (binding) =>
            binding.safetyPolicyId === policyId &&
            binding.materialInstanceIds.includes(instanceId)
        );
        if (!bound)
          addIssue(
            context,
            10,
            CHECK.safety,
            ISSUE.safetyBindingInvalid,
            "safetyBindings",
            `The authored concentration for ${instanceId} requires its registered solution-preparation safety binding.`,
            { registryId: policyId, safetyRelated: true }
          );
      }
    }
  }
  context.spec.safetyBindings.forEach((binding, index) => {
    const path = `safetyBindings[${index}]`;
    if (!listed.has(binding.safetyPolicyId))
      addIssue(
        context,
        10,
        CHECK.safety,
        ISSUE.safetyBindingInvalid,
        `${path}.safetyPolicyId`,
        `${binding.safetyPolicyId} is not globally selected.`,
        { registryId: binding.safetyPolicyId, safetyRelated: true }
      );
    binding.equipmentInstanceIds.forEach((id, equipmentIndex) =>
      reference(
        context,
        equipmentIds.has(id),
        id,
        `${path}.equipmentInstanceIds[${equipmentIndex}]`,
        "equipment",
        10,
        CHECK.safety,
        true
      )
    );
    binding.materialInstanceIds.forEach((id, materialIndex) =>
      reference(
        context,
        materialIds.has(id),
        id,
        `${path}.materialInstanceIds[${materialIndex}]`,
        "material",
        10,
        CHECK.safety,
        true
      )
    );
  });
  for (const equipment of context.spec.equipment) {
    for (const policyId of context.equipmentById.get(equipment.instanceId)
      ?.safetyConstraintIds ?? []) {
      const bound = context.spec.safetyBindings.some(
        (binding) =>
          binding.safetyPolicyId === policyId &&
          binding.equipmentInstanceIds.includes(equipment.instanceId)
      );
      if (!bound)
        addIssue(
          context,
          10,
          CHECK.safety,
          ISSUE.safetyBindingInvalid,
          "safetyBindings",
          `Safety policy ${policyId} is not bound to ${equipment.instanceId}.`,
          { registryId: policyId, safetyRelated: true }
        );
    }
  }
}

function determineStatus(
  issues: readonly ValidationIssue[]
): Exclude<WorkflowSupportStatus, "draft_unvalidated"> {
  const errors = issues.filter(({ severity }) => severity === "error");
  if (errors.length === 0) return "runnable";
  if (errors.some(({ safetyRelated }) => safetyRelated))
    return "rejected_for_safety";
  const availabilityCodes = new Set<string>([
    ISSUE.registryIdUnavailable,
    ISSUE.chemistryCapabilityUnavailable,
    ISSUE.chemistryModelResolutionFailed,
    ISSUE.legacyAdapterUnavailable
  ]);
  return errors.every(({ code }) => availabilityCodes.has(code))
    ? "partially_supported"
    : "unsupported";
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameStringRecord(
  left: Readonly<Record<string, string>>,
  right: Readonly<Record<string, string>>
): boolean {
  const leftEntries = Object.entries(left).sort(([leftKey], [rightKey]) =>
    compareStrings(leftKey, rightKey)
  );
  const rightEntries = Object.entries(right).sort(([leftKey], [rightKey]) =>
    compareStrings(leftKey, rightKey)
  );
  return sameJson(leftEntries, rightEntries);
}

function createDraft(parsed: LabWorkflowSpecV2): LabWorkflowDraftV2 {
  const { supportStatus, validation, judgeCritique, ...authored } = parsed;
  void supportStatus;
  void validation;
  void judgeCritique;
  return labWorkflowDraftV2Schema.parse({
    ...authored,
    supportStatus: "draft_unvalidated",
    validation: null,
    judgeCritique: null
  });
}

function hasExactPreviewRuntime(spec: LabWorkflowDraftV2): boolean {
  const compatibility = spec.compatibility;
  // Native definitions compile only after every exact equipment, action,
  // mechanics, model, safety, and rule reference above has passed hard
  // validation. The production capability ports execute those compiled
  // contracts directly; they do not require a family or engine dispatcher.
  if (!compatibility) return true;
  return (
    compatibility.runtimeAdapterId === LEGACY_TITRATION_RUNTIME_ADAPTER.id &&
    compatibility.runtimeAdapterVersion ===
      LEGACY_TITRATION_RUNTIME_ADAPTER.version &&
    compatibility.engineId === LEGACY_TITRATION_RUNTIME_ADAPTER.engineId
  );
}

export function validateLabWorkflowSpecV2(
  input: unknown,
  options: LabWorkflowV2ValidationOptions
): LabWorkflowV2ValidationOutcome {
  validationResultV2_0Schema.shape.checkedAt.parse(options.checkedAt);
  const parsed = labWorkflowSpecV2Schema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((zodIssue) =>
        validationIssueSchema.parse({
          code: ISSUE.schemaInvalid,
          severity: "error",
          path: zodPath(zodIssue),
          message: `Schema validation failed: ${zodIssue.message}`,
          suggestedSupportedIds: [],
          safetyRelated: false
        })
      )
      .sort(
        (left, right) =>
          compareStrings(left.path, right.path) ||
          compareStrings(left.message, right.message)
      );
    return deepFreeze({
      schemaValid: false as const,
      spec: null,
      validation: null,
      issues
    });
  }

  try {
    hashLabWorkflowSpec(parsed.data);
  } catch (error) {
    const issues = [
      validationIssueSchema.parse({
        code: ISSUE.schemaInvalid,
        severity: "error",
        path: "$",
        message: `Schema validation failed: ${error instanceof Error ? error.message : "non-JSON data"}`,
        suggestedSupportedIds: [],
        safetyRelated: false
      })
    ];
    return deepFreeze({
      schemaValid: false as const,
      spec: null,
      validation: null,
      issues
    });
  }

  const registries =
    options.registries ?? PRODUCTION_LAB_WORKFLOW_V2_REGISTRIES;
  const spec = createDraft(parsed.data);
  const context: ValidationContext = {
    spec,
    registries,
    issues: [],
    failedChecks: new Set(),
    equipmentById: new Map(),
    materialById: new Map(),
    actionByPermissionId: new Map(),
    ruleById: new Map(spec.rules.map((rule) => [rule.id, rule])),
    resolvedAdapters: [],
    resolvedChemistryModels: []
  };

  validateReferences(context);
  validateEquipment(context);
  validateMaterials(context);
  validateActions(context);
  validateChemistry(context);
  validateRules(context);
  validateRubric(context);
  validatePresentationAndCoach(context);
  validateSafety(context);
  const previewRuntimeAvailable = hasExactPreviewRuntime(spec);
  if (!previewRuntimeAvailable) {
    addIssue(
      context,
      11,
      CHECK.eligibility,
      ISSUE.runtimeUnavailable,
      "$",
      "No exact setup-driven preview runtime is registered for this definition; preview and assignment remain disabled.",
      { severity: "warning" }
    );
  }

  const issues = stableIssues(context.issues);
  const status = determineStatus(issues);
  const runnable = status === "runnable";
  const canonicalSpecHash = hashLabWorkflowSpec(spec);
  const adapters = [...context.resolvedAdapters]
    .filter(
      (candidate, index, values) =>
        values.findIndex((value) => sameJson(value, candidate)) === index
    )
    .sort(
      (left, right) =>
        compareStrings(left.ownerId, right.ownerId) ||
        compareStrings(left.kind, right.kind) ||
        compareStrings(left.adapterId, right.adapterId)
    );
  const models = [...context.resolvedChemistryModels];
  const validation = validationResultV2Schema.parse({
    artifactSchemaVersion: spec.schemaVersion,
    validatedSchemaVersion: spec.schemaVersion,
    validatorVersion: LAB_WORKFLOW_VALIDATOR_VERSION_V2,
    checkedAt: options.checkedAt,
    canonicalSpecHash,
    registrySnapshotIds: registrySnapshots(registries),
    resolvedAdapters: adapters,
    resolvedChemistryModels: models,
    status,
    runnable,
    previewEligible: runnable && previewRuntimeAvailable,
    // LC2-801: assignment opens once the same current runnable/preview seam is met.
    // Persistence still cannot confer runnability; Assign rechecks eligibility server-side.
    assignmentEligible: runnable && previewRuntimeAvailable,
    issues,
    passedCheckIds: ALL_CHECK_IDS.filter((id) => !context.failedChecks.has(id))
  });
  const preservedCritique =
    parsed.data.judgeCritique?.specHash === canonicalSpecHash
      ? parsed.data.judgeCritique
      : null;
  const validated = validatedLabWorkflowSpecV2Schema.parse({
    ...spec,
    supportStatus: status,
    validation,
    judgeCritique: preservedCritique
  });
  return deepFreeze({
    schemaValid: true as const,
    spec: validated,
    validation,
    issues
  });
}

export function evaluateLabWorkflowEligibilityV2(
  input: unknown,
  purpose: LabWorkflowV2EligibilityPurpose,
  options: Pick<LabWorkflowV2ValidationOptions, "registries"> = {}
): Readonly<LabWorkflowV2Eligibility> {
  const parsed = labWorkflowSpecV2Schema.safeParse(input);
  const failure = WORKFLOW_ELIGIBILITY_FAILURE_CODES_V2;
  if (!parsed.success || parsed.data.validation === null) {
    return deepFreeze({
      eligible: false,
      purpose,
      failureCodes: [failure.schemaInvalid]
    });
  }
  const spec = parsed.data;
  const artifact = spec.validation;
  const registries =
    options.registries ?? PRODUCTION_LAB_WORKFLOW_V2_REGISTRIES;
  const failureCodes: string[] = [];
  if (spec.supportStatus !== "runnable")
    failureCodes.push(failure.statusNotRunnable);
  if (artifact.status !== "runnable" || !artifact.runnable)
    failureCodes.push(failure.validationNotRunnable);
  if (purpose === "preview" && !artifact.previewEligible)
    failureCodes.push(failure.previewNotEligible);
  if (purpose === "assignment" && !artifact.assignmentEligible)
    failureCodes.push(failure.assignmentNotEligible);
  if (artifact.validatorVersion !== LAB_WORKFLOW_VALIDATOR_VERSION_V2)
    failureCodes.push(failure.validatorVersionStale);
  if (
    !sameStringRecord(
      artifact.registrySnapshotIds,
      registrySnapshots(registries)
    )
  )
    failureCodes.push(failure.registrySnapshotStale);
  if (!labWorkflowHashMatches(spec, artifact.canonicalSpecHash))
    failureCodes.push(failure.hashMismatch);

  const authoritative = validateLabWorkflowSpecV2(spec, {
    checkedAt: artifact.checkedAt,
    registries
  });
  if (authoritative.schemaValid) {
    if (
      !sameJson(
        artifact.resolvedAdapters,
        authoritative.validation.resolvedAdapters
      )
    )
      failureCodes.push(failure.resolvedAdapterMismatch);
    if (
      !sameJson(
        artifact.resolvedChemistryModels,
        authoritative.validation.resolvedChemistryModels
      )
    )
      failureCodes.push(failure.resolvedModelMismatch);
    if (
      spec.supportStatus !== authoritative.spec.supportStatus ||
      !sameJson(artifact, authoritative.validation)
    )
      failureCodes.push(failure.validationArtifactMismatch);
  } else if (!failureCodes.includes(failure.validationArtifactMismatch)) {
    failureCodes.push(failure.validationArtifactMismatch);
  }
  return deepFreeze({
    eligible: failureCodes.length === 0,
    purpose,
    failureCodes
  });
}
