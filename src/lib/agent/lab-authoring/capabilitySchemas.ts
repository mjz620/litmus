import { z } from "zod";

import { labDraftCommandSchema } from "../../../lab-workflows/authoring";
import { registryIdSchema } from "../../../lab-workflows/schema";
import { WORKFLOW_CONDITION_KINDS } from "../../../lab-workflows/schema/conditions";

export const CAPABILITY_AUTHOR_TOOL_LIMITS = Object.freeze({
  maxToolCalls: 24,
  maxCommandsPerCall: 64,
  maxReturnedItems: 32,
  maxRequestedIds: 32,
  maxQueryCharacters: 240
});

export const capabilityAuthorToolNameSchema = z.enum([
  "searchObjectives",
  "inspectEquipment",
  "inspectMaterials",
  "inspectActions",
  "inspectCapabilities",
  "inspectConditions",
  "inspectModels",
  "inspectSafety",
  "inspectConfigurations",
  "inspectDraft",
  "applyDraftCommands"
]);

export const searchObjectivesArgumentsSchema = z.strictObject({
  query: z
    .string()
    .trim()
    .min(1)
    .max(CAPABILITY_AUTHOR_TOOL_LIMITS.maxQueryCharacters),
  availability: z.enum(["verified", "planned", "restricted"]).nullable()
});

const exactIdsArgumentsSchema = z.strictObject({
  ids: z
    .array(registryIdSchema)
    .max(CAPABILITY_AUTHOR_TOOL_LIMITS.maxRequestedIds)
});

export const inspectEquipmentArgumentsSchema = exactIdsArgumentsSchema;
export const inspectMaterialsArgumentsSchema = exactIdsArgumentsSchema;
export const inspectActionsArgumentsSchema = exactIdsArgumentsSchema;
export const inspectCapabilitiesArgumentsSchema = exactIdsArgumentsSchema;
export const inspectModelsArgumentsSchema = exactIdsArgumentsSchema;
export const inspectSafetyArgumentsSchema = exactIdsArgumentsSchema;
export const inspectConfigurationsArgumentsSchema = exactIdsArgumentsSchema;

export const inspectConditionsArgumentsSchema = z.strictObject({
  kinds: z
    .array(z.enum(WORKFLOW_CONDITION_KINDS))
    .max(WORKFLOW_CONDITION_KINDS.length)
});

export const inspectDraftArgumentsSchema = z.strictObject({});

export const applyDraftCommandsArgumentsSchema = z.strictObject({
  expectedRevision: z.number().int().min(1).max(1_000_000),
  commands: z
    .array(labDraftCommandSchema)
    .min(1)
    .max(CAPABILITY_AUTHOR_TOOL_LIMITS.maxCommandsPerCall)
});

export type CapabilityAuthorToolName = z.infer<
  typeof capabilityAuthorToolNameSchema
>;
export type ApplyDraftCommandsArguments = z.infer<
  typeof applyDraftCommandsArgumentsSchema
>;
