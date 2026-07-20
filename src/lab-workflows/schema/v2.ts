import { z } from "zod";

import { CHEMISTRY_CAPABILITY_IDS } from "../capabilities";
import {
  LAB_WORKFLOW_SCHEMA_LIMITS,
  judgeCritiqueSchema,
  labMetadataSchema,
  labWorkflowDraftV1Schema,
  labWorkflowSpecV1Schema,
  registryIdSchema,
  semanticVersionSchema,
  sha256HashSchema,
  validatedLabWorkflowSpecV1Schema,
  validatedWorkflowSupportStatusSchema,
  validationIssueSchema,
  workflowLocalIdSchema
} from "../schema";
import {
  instructionSectionsSchema,
  rubricSpecV2Schema,
  workflowRulesSchema
} from "./conditions";

export const LAB_WORKFLOW_SCHEMA_VERSION_V2 = "2.0.0" as const;
export const LAB_WORKFLOW_SCHEMA_VERSION_V2_1 = "2.1.0" as const;
export const LEGACY_RUNTIME_ADAPTER_IDS = Object.freeze([
  "runtime-adapter.titration.v1"
] as const);

export const LAB_WORKFLOW_V2_SCHEMA_LIMITS = Object.freeze({
  equipmentCount: LAB_WORKFLOW_SCHEMA_LIMITS.componentCount,
  materialCount: LAB_WORKFLOW_SCHEMA_LIMITS.reagentCount,
  placementCount: LAB_WORKFLOW_SCHEMA_LIMITS.componentCount,
  permittedActionCount: LAB_WORKFLOW_SCHEMA_LIMITS.listItemCount,
  referenceCount: LAB_WORKFLOW_SCHEMA_LIMITS.listItemCount,
  coachTriggerCount: LAB_WORKFLOW_SCHEMA_LIMITS.coachTriggerCount,
  adaptiveRetryCount: LAB_WORKFLOW_SCHEMA_LIMITS.retryCount,
  safetyBindingCount: LAB_WORKFLOW_SCHEMA_LIMITS.safetyConstraintCount,
  presentationEntryCount: LAB_WORKFLOW_SCHEMA_LIMITS.listItemCount,
  authoredLimitCount: LAB_WORKFLOW_SCHEMA_LIMITS.authoredLimitCount,
  validationIssueCount: LAB_WORKFLOW_SCHEMA_LIMITS.validationIssueCount,
  resolvedAdapterCount: LAB_WORKFLOW_SCHEMA_LIMITS.listItemCount,
  resolvedModelCount: LAB_WORKFLOW_SCHEMA_LIMITS.listItemCount
});

const LIMITS = LAB_WORKFLOW_V2_SCHEMA_LIMITS;

const shortTextSchema = z
  .string()
  .min(1)
  .max(LAB_WORKFLOW_SCHEMA_LIMITS.shortTextLength)
  .refine((value) => value.trim().length > 0, "Text cannot be blank");
const longTextSchema = z
  .string()
  .min(1)
  .max(LAB_WORKFLOW_SCHEMA_LIMITS.longTextLength)
  .refine((value) => value.trim().length > 0, "Text cannot be blank");
const referenceListSchema = z
  .array(registryIdSchema)
  .max(LIMITS.referenceCount);
const localReferenceListSchema = z
  .array(workflowLocalIdSchema)
  .max(LIMITS.referenceCount);

const authoredLimitsSchemaV2 = z
  .record(registryIdSchema, z.number().finite())
  .refine(
    (limits) => Object.keys(limits).length <= LIMITS.authoredLimitCount,
    `At most ${LIMITS.authoredLimitCount} authored limits are allowed`
  );

const registrySnapshotIdsSchemaV2 = z
  .record(registryIdSchema, registryIdSchema)
  .refine(
    (snapshots) => Object.keys(snapshots).length <= LIMITS.referenceCount,
    `At most ${LIMITS.referenceCount} registry snapshots are allowed`
  );

export const labMetadataV2Schema = labMetadataSchema;

export const labCatalogV2Schema = z.strictObject({
  familyId: registryIdSchema.optional()
});

export const equipmentInstanceSpecV2Schema = z.strictObject({
  instanceId: workflowLocalIdSchema,
  equipmentDefinitionId: registryIdSchema,
  configurationPresetId: registryIdSchema,
  label: shortTextSchema,
  required: z.boolean()
});

export const materialBindingV2Schema = z.strictObject({
  instanceId: workflowLocalIdSchema,
  materialProfileId: registryIdSchema,
  containerInstanceId: workflowLocalIdSchema,
  quantityPresetId: registryIdSchema
});

export const canonicalConcentrationDecimalSchema = z
  .string()
  .min(1)
  .max(32)
  .regex(/^(0|[1-9]\d*)(?:\.\d*[1-9])?$/);

export const boundedConcentrationInitializationV2_1Schema = z.strictObject({
  kind: z.literal("bounded_concentration"),
  configurationSchemaId: registryIdSchema,
  concentration: z.strictObject({
    decimalValue: canonicalConcentrationDecimalSchema,
    unitId: registryIdSchema
  })
});

export const materialBindingV2_1Schema = materialBindingV2Schema.extend({
  initialization: boundedConcentrationInitializationV2_1Schema.optional()
});

export const physicalPlacementV2Schema = z.strictObject({
  equipmentInstanceId: workflowLocalIdSchema,
  placementSlotId: registryIdSchema
});

export const physicalLayoutSpecV2Schema = z.strictObject({
  configurationSchemaId: registryIdSchema,
  placements: z.array(physicalPlacementV2Schema).max(LIMITS.placementCount)
});

export const actionAvailabilityV2Schema = z.strictObject({
  allSatisfiedRuleIds: localReferenceListSchema,
  allUnsatisfiedRuleIds: localReferenceListSchema
});

export const permittedActionSpecV2Schema = z.strictObject({
  id: workflowLocalIdSchema,
  actionId: registryIdSchema,
  sourceEquipmentInstanceId: workflowLocalIdSchema.optional(),
  targetEquipmentInstanceIds: z
    .array(workflowLocalIdSchema)
    .max(LAB_WORKFLOW_SCHEMA_LIMITS.componentCount),
  parameterPresetId: registryIdSchema.optional(),
  authoredLimits: authoredLimitsSchemaV2.optional(),
  maxAttempts: z.number().finite().int().min(1).max(1_000).optional(),
  availability: actionAvailabilityV2Schema
});

export const coachTriggerSpecV2Schema = z.strictObject({
  id: workflowLocalIdSchema,
  objectiveIds: referenceListSchema,
  eventTypeIds: referenceListSchema,
  flagIds: referenceListSchema,
  triggerTypeId: registryIdSchema,
  hintStrategyId: registryIdSchema,
  maxHintLevel: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3)
  ]),
  cooldownEventCount: z.number().finite().int().min(0).max(1_000),
  staySilentOnEventReasonIds: referenceListSchema
});

export const adaptiveRetrySpecV2Schema = z.strictObject({
  id: workflowLocalIdSchema,
  templateId: registryIdSchema,
  targetObjectiveIds: referenceListSchema,
  eligibleFlagIds: referenceListSchema,
  initializationPresetId: registryIdSchema,
  maxMinutes: z.number().finite().int().min(1).max(120),
  studentGoal: longTextSchema,
  successEvidenceReasonIds: referenceListSchema
});

export const coachPolicySpecV2Schema = z.strictObject({
  triggers: z.array(coachTriggerSpecV2Schema).max(LIMITS.coachTriggerCount),
  adaptiveRetries: z
    .array(adaptiveRetrySpecV2Schema)
    .max(LIMITS.adaptiveRetryCount)
});

export const safetyBindingV2Schema = z.strictObject({
  safetyPolicyId: registryIdSchema,
  equipmentInstanceIds: localReferenceListSchema,
  materialInstanceIds: localReferenceListSchema
});

export const instructionPresentationV2Schema = z.strictObject({
  instructionId: workflowLocalIdSchema,
  teacherRationale: longTextSchema,
  equipmentInstanceIds: localReferenceListSchema
});

export const materialPresentationV2Schema = z.strictObject({
  materialInstanceId: workflowLocalIdSchema,
  displayLabel: shortTextSchema
});

export const rulePromptPresentationV2Schema = z.strictObject({
  ruleId: workflowLocalIdSchema,
  studentPrompt: longTextSchema
});

export const presentationSpecV2Schema = z.strictObject({
  instructionGuidance: z
    .array(instructionPresentationV2Schema)
    .max(LIMITS.presentationEntryCount),
  materialLabels: z
    .array(materialPresentationV2Schema)
    .max(LIMITS.presentationEntryCount),
  rulePrompts: z
    .array(rulePromptPresentationV2Schema)
    .max(LIMITS.presentationEntryCount)
});

/**
 * Native initialization descriptor: the registered seed template the generic
 * runtime applies deterministically at session start. Compatibility-owned
 * workflows carry their preset inside `compatibility.initializationPresetId`
 * instead; authoring both is a validation error.
 */
export const nativeInitializationSpecV2Schema = z.strictObject({
  presetId: registryIdSchema
});

export const legacyEquipmentRoleBindingSchema = z.strictObject({
  equipmentInstanceId: workflowLocalIdSchema,
  legacyRoleId: registryIdSchema
});

export const legacyMaterialRoleBindingSchema = z.strictObject({
  materialInstanceId: workflowLocalIdSchema,
  legacyRoleId: registryIdSchema
});

export const legacyCompatibilityDescriptorV2Schema = z.strictObject({
  kind: z.literal("legacy_v1"),
  runtimeAdapterId: z.enum(LEGACY_RUNTIME_ADAPTER_IDS),
  runtimeAdapterVersion: semanticVersionSchema,
  engineId: registryIdSchema,
  engineConfigurationPresetId: registryIdSchema,
  initializationPresetId: registryIdSchema,
  equipmentRoleBindings: z
    .array(legacyEquipmentRoleBindingSchema)
    .max(LIMITS.equipmentCount),
  materialRoleBindings: z
    .array(legacyMaterialRoleBindingSchema)
    .max(LIMITS.materialCount)
});

export const migrationProvenanceV2Schema = z.strictObject({
  kind: z.literal("migrated_v1"),
  sourceSchemaVersion: z.literal("1.0.0"),
  sourceSpecHash: sha256HashSchema,
  migrationVersion: semanticVersionSchema,
  sourceRegistrySnapshotIds: registrySnapshotIdsSchemaV2
});

export const resolvedAdapterV2Schema = z.strictObject({
  kind: z.enum(["equipment", "action", "visual", "mechanical"]),
  ownerId: registryIdSchema,
  adapterId: registryIdSchema,
  version: semanticVersionSchema
});

export const resolvedChemistryModelV2Schema = z.strictObject({
  modelId: registryIdSchema,
  version: semanticVersionSchema,
  providedCapabilityIds: z
    .array(z.enum(CHEMISTRY_CAPABILITY_IDS))
    .max(LIMITS.referenceCount)
});

const validationResultShapeV2 = {
  validatorVersion: semanticVersionSchema,
  checkedAt: z.string().datetime({ offset: true }),
  canonicalSpecHash: sha256HashSchema,
  registrySnapshotIds: registrySnapshotIdsSchemaV2,
  resolvedAdapters: z
    .array(resolvedAdapterV2Schema)
    .max(LIMITS.resolvedAdapterCount),
  resolvedChemistryModels: z
    .array(resolvedChemistryModelV2Schema)
    .max(LIMITS.resolvedModelCount),
  status: validatedWorkflowSupportStatusSchema,
  runnable: z.boolean(),
  previewEligible: z.boolean(),
  assignmentEligible: z.boolean(),
  issues: z.array(validationIssueSchema).max(LIMITS.validationIssueCount),
  passedCheckIds: referenceListSchema
};

export const validationResultV2_0Schema = z.strictObject({
  artifactSchemaVersion: z.literal("2.0.0"),
  validatedSchemaVersion: z.literal("2.0.0"),
  ...validationResultShapeV2
});

export const validationResultV2_1Schema = z.strictObject({
  artifactSchemaVersion: z.literal("2.1.0"),
  validatedSchemaVersion: z.literal("2.1.0"),
  ...validationResultShapeV2
});

export const validationResultV2Schema = z.discriminatedUnion(
  "validatedSchemaVersion",
  [validationResultV2_0Schema, validationResultV2_1Schema]
);

const labWorkflowSharedShapeV2 = {
  id: registryIdSchema,
  revision: z.number().finite().int().min(1).max(1_000_000),
  sourceRequest: longTextSchema,
  metadata: labMetadataV2Schema,
  catalog: labCatalogV2Schema.optional(),
  objectiveIds: referenceListSchema,
  equipment: z.array(equipmentInstanceSpecV2Schema).max(LIMITS.equipmentCount),
  layout: physicalLayoutSpecV2Schema,
  requiredChemistryCapabilityIds: z
    .array(z.enum(CHEMISTRY_CAPABILITY_IDS))
    .max(LIMITS.referenceCount),
  permittedActions: z
    .array(permittedActionSpecV2Schema)
    .max(LIMITS.permittedActionCount),
  rules: workflowRulesSchema,
  instructions: instructionSectionsSchema,
  coachPolicy: coachPolicySpecV2Schema,
  rubric: rubricSpecV2Schema,
  safetyPolicyIds: referenceListSchema,
  safetyBindings: z.array(safetyBindingV2Schema).max(LIMITS.safetyBindingCount),
  presentation: presentationSpecV2Schema,
  initialization: nativeInitializationSpecV2Schema.optional(),
  compatibility: legacyCompatibilityDescriptorV2Schema.optional(),
  provenance: migrationProvenanceV2Schema.optional()
};

const labWorkflowBaseShapeV2_0 = {
  schemaVersion: z.literal(LAB_WORKFLOW_SCHEMA_VERSION_V2),
  ...labWorkflowSharedShapeV2,
  materials: z.array(materialBindingV2Schema).max(LIMITS.materialCount)
};

const labWorkflowBaseShapeV2_1 = {
  schemaVersion: z.literal(LAB_WORKFLOW_SCHEMA_VERSION_V2_1),
  ...labWorkflowSharedShapeV2,
  materials: z.array(materialBindingV2_1Schema).max(LIMITS.materialCount)
};

export const labWorkflowDraftV2_0Schema = z.strictObject({
  ...labWorkflowBaseShapeV2_0,
  supportStatus: z.literal("draft_unvalidated"),
  validation: z.null(),
  judgeCritique: z.null()
});

export const labWorkflowDraftV2_1Schema = z.strictObject({
  ...labWorkflowBaseShapeV2_1,
  supportStatus: z.literal("draft_unvalidated"),
  validation: z.null(),
  judgeCritique: z.null()
});

export const labWorkflowDraftV2Schema = z.discriminatedUnion("schemaVersion", [
  labWorkflowDraftV2_0Schema,
  labWorkflowDraftV2_1Schema
]);

export const validatedLabWorkflowSpecV2_0Schema = z.strictObject({
  ...labWorkflowBaseShapeV2_0,
  supportStatus: validatedWorkflowSupportStatusSchema,
  validation: validationResultV2_0Schema,
  judgeCritique: judgeCritiqueSchema.nullable()
});

export const validatedLabWorkflowSpecV2_1Schema = z.strictObject({
  ...labWorkflowBaseShapeV2_1,
  supportStatus: validatedWorkflowSupportStatusSchema,
  validation: validationResultV2_1Schema,
  judgeCritique: judgeCritiqueSchema.nullable()
});

export const validatedLabWorkflowSpecV2Schema = z.discriminatedUnion(
  "schemaVersion",
  [validatedLabWorkflowSpecV2_0Schema, validatedLabWorkflowSpecV2_1Schema]
);

export const labWorkflowSpecV2_0Schema = z.discriminatedUnion("supportStatus", [
  labWorkflowDraftV2_0Schema,
  validatedLabWorkflowSpecV2_0Schema
]);

export const labWorkflowSpecV2_1Schema = z.discriminatedUnion("supportStatus", [
  labWorkflowDraftV2_1Schema,
  validatedLabWorkflowSpecV2_1Schema
]);

export const labWorkflowSpecV2Schema = z.union([
  labWorkflowSpecV2_0Schema,
  labWorkflowSpecV2_1Schema
]);

/**
 * Strict schema-version facades. Existing unversioned exports stay pinned to
 * v1 until version-aware hashing and validation land in LC2-106/107.
 */
export const versionedLabWorkflowDraftSchema = z.union([
  labWorkflowDraftV1Schema,
  labWorkflowDraftV2_0Schema,
  labWorkflowDraftV2_1Schema
]);

export const versionedValidatedLabWorkflowSpecSchema = z.union([
  validatedLabWorkflowSpecV1Schema,
  validatedLabWorkflowSpecV2_0Schema,
  validatedLabWorkflowSpecV2_1Schema
]);

export const versionedLabWorkflowSpecSchema = z.union([
  labWorkflowSpecV1Schema,
  labWorkflowSpecV2_0Schema,
  labWorkflowSpecV2_1Schema
]);

export type LabMetadataV2 = z.infer<typeof labMetadataV2Schema>;
export type LabCatalogV2 = z.infer<typeof labCatalogV2Schema>;
export type EquipmentInstanceSpecV2 = z.infer<
  typeof equipmentInstanceSpecV2Schema
>;
export type MaterialBindingV2_0 = z.infer<typeof materialBindingV2Schema>;
export type MaterialBindingV2_1 = z.infer<typeof materialBindingV2_1Schema>;
export type MaterialBindingV2 = MaterialBindingV2_0 | MaterialBindingV2_1;
export type BoundedConcentrationInitializationV2_1 = z.infer<
  typeof boundedConcentrationInitializationV2_1Schema
>;

/**
 * Authored concentration initialization for a material binding, or undefined
 * on v2.0 bindings that cannot carry one.
 *
 * Callers must not reach for `binding.initialization` behind an `in` check.
 * `materialBindingV2Schema` is a strict object without the key, so on that
 * union member TypeScript widens the property to `unknown`, and a truthiness
 * guard then narrows it to `{}` — losing every field. Going through the schema
 * keeps the result typed and matches what validation already accepted.
 */
export function materialBindingInitialization(
  binding: Readonly<MaterialBindingV2>
): BoundedConcentrationInitializationV2_1 | undefined {
  const parsed = materialBindingV2_1Schema.safeParse(binding);
  return parsed.success ? parsed.data.initialization : undefined;
}
export type PhysicalPlacementV2 = z.infer<typeof physicalPlacementV2Schema>;
export type PhysicalLayoutSpecV2 = z.infer<typeof physicalLayoutSpecV2Schema>;
export type PermittedActionSpecV2 = z.infer<typeof permittedActionSpecV2Schema>;
export type CoachPolicySpecV2 = z.infer<typeof coachPolicySpecV2Schema>;
export type SafetyBindingV2 = z.infer<typeof safetyBindingV2Schema>;
export type PresentationSpecV2 = z.infer<typeof presentationSpecV2Schema>;
export type NativeInitializationSpecV2 = z.infer<
  typeof nativeInitializationSpecV2Schema
>;
export type LegacyCompatibilityDescriptorV2 = z.infer<
  typeof legacyCompatibilityDescriptorV2Schema
>;
export type MigrationProvenanceV2 = z.infer<typeof migrationProvenanceV2Schema>;
export type ValidationResultV2_0 = z.infer<typeof validationResultV2_0Schema>;
export type ValidationResultV2_1 = z.infer<typeof validationResultV2_1Schema>;
export type ValidationResultV2 = ValidationResultV2_0 | ValidationResultV2_1;
export type LabWorkflowDraftV2_0 = z.infer<typeof labWorkflowDraftV2_0Schema>;
export type LabWorkflowDraftV2_1 = z.infer<typeof labWorkflowDraftV2_1Schema>;
export type LabWorkflowDraftV2 = LabWorkflowDraftV2_0 | LabWorkflowDraftV2_1;
export type ValidatedLabWorkflowSpecV2_0 = z.infer<
  typeof validatedLabWorkflowSpecV2_0Schema
>;
export type ValidatedLabWorkflowSpecV2_1 = z.infer<
  typeof validatedLabWorkflowSpecV2_1Schema
>;
export type ValidatedLabWorkflowSpecV2 =
  | ValidatedLabWorkflowSpecV2_0
  | ValidatedLabWorkflowSpecV2_1;
export type LabWorkflowSpecV2_0 = z.infer<typeof labWorkflowSpecV2_0Schema>;
export type LabWorkflowSpecV2_1 = z.infer<typeof labWorkflowSpecV2_1Schema>;
export type LabWorkflowSpecV2 = LabWorkflowSpecV2_0 | LabWorkflowSpecV2_1;
export type VersionedLabWorkflowDraft = z.infer<
  typeof versionedLabWorkflowDraftSchema
>;
export type VersionedValidatedLabWorkflowSpec = z.infer<
  typeof versionedValidatedLabWorkflowSpecSchema
>;
export type VersionedLabWorkflowSpec = z.infer<
  typeof versionedLabWorkflowSpecSchema
>;
