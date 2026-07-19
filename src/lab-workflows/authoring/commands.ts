import { z } from "zod";

import {
  labMetadataSchema,
  registryIdSchema,
  workflowLocalIdSchema
} from "../schema";
import {
  instructionSectionSchema,
  rubricCriterionSpecV2Schema,
  workflowConditionSchema,
  workflowRuleSchema
} from "../schema/conditions";
import {
  equipmentInstanceSpecV2Schema,
  materialBindingV2Schema,
  permittedActionSpecV2Schema,
  physicalLayoutSpecV2Schema
} from "../schema/v2";
import {
  labDraftRemovalPlanTokenSchema,
  labDraftRemovalResolutionSchema
} from "./removal";

const updateMetadataCommandSchema = z.strictObject({
  type: z.literal("update_metadata"),
  metadata: labMetadataSchema
});

const addEquipmentCommandSchema = z.strictObject({
  type: z.literal("add_equipment"),
  equipment: equipmentInstanceSpecV2Schema
});
const removeEquipmentCommandSchema = z.strictObject({
  type: z.literal("remove_equipment"),
  instanceId: workflowLocalIdSchema
});
const configureEquipmentCommandSchema = z.strictObject({
  type: z.literal("configure_equipment"),
  instanceId: workflowLocalIdSchema,
  configurationPresetId: registryIdSchema
});
const bindMaterialCommandSchema = z.strictObject({
  type: z.literal("bind_material"),
  binding: materialBindingV2Schema
});
const removeMaterialBindingCommandSchema = z.strictObject({
  type: z.literal("remove_material_binding"),
  instanceId: workflowLocalIdSchema
});
const setMaterialConcentrationCommandSchema = z.strictObject({
  type: z.literal("set_material_concentration"),
  instanceId: workflowLocalIdSchema,
  initialization: z.strictObject({
    kind: z.literal("bounded_concentration"),
    configurationSchemaId: registryIdSchema,
    concentration: z.strictObject({
      decimalValue: z.string().min(1).max(32),
      unitId: registryIdSchema
    })
  })
});
const clearMaterialConcentrationCommandSchema = z.strictObject({
  type: z.literal("clear_material_concentration"),
  instanceId: workflowLocalIdSchema
});
const setLayoutCommandSchema = z.strictObject({
  type: z.literal("set_layout"),
  layout: physicalLayoutSpecV2Schema
});
const permitActionCommandSchema = z.strictObject({
  type: z.literal("permit_action"),
  action: permittedActionSpecV2Schema
});
const removePermittedActionCommandSchema = z.strictObject({
  type: z.literal("remove_permitted_action"),
  permissionId: workflowLocalIdSchema
});
const addRuleCommandSchema = z.strictObject({
  type: z.literal("add_rule"),
  rule: workflowRuleSchema
});
const removeRuleCommandSchema = z.strictObject({
  type: z.literal("remove_rule"),
  ruleId: workflowLocalIdSchema
});
const replaceRuleCommandSchema = z.strictObject({
  type: z.literal("replace_rule"),
  ruleId: workflowLocalIdSchema,
  rule: workflowRuleSchema
});
const addConditionCommandSchema = z.strictObject({
  type: z.literal("add_condition"),
  ruleId: workflowLocalIdSchema,
  condition: workflowConditionSchema
});
const removeConditionCommandSchema = z.strictObject({
  type: z.literal("remove_condition"),
  ruleId: workflowLocalIdSchema
});
const addOrderingDependencyCommandSchema = z.strictObject({
  type: z.literal("add_ordering_dependency"),
  ruleId: workflowLocalIdSchema,
  predecessorRuleId: workflowLocalIdSchema,
  successorRuleId: workflowLocalIdSchema,
  severity: z.enum([
    "info",
    "best-practice",
    "procedural",
    "conceptual",
    "safety"
  ]),
  recoverable: z.boolean(),
  objectiveIds: z.array(registryIdSchema).min(1).max(64)
});
const removeOrderingDependencyCommandSchema = z.strictObject({
  type: z.literal("remove_ordering_dependency"),
  ruleId: workflowLocalIdSchema
});
const addInstructionCommandSchema = z.strictObject({
  type: z.literal("add_instruction"),
  instruction: instructionSectionSchema
});
const removeInstructionCommandSchema = z.strictObject({
  type: z.literal("remove_instruction"),
  instructionId: workflowLocalIdSchema
});
const replaceInstructionCommandSchema = z.strictObject({
  type: z.literal("replace_instruction"),
  instructionId: workflowLocalIdSchema,
  instruction: instructionSectionSchema
});
const addObjectiveCommandSchema = z.strictObject({
  type: z.literal("add_objective"),
  objectiveId: registryIdSchema
});
const removeObjectiveCommandSchema = z.strictObject({
  type: z.literal("remove_objective"),
  objectiveId: registryIdSchema
});
const addRubricCriterionCommandSchema = z.strictObject({
  type: z.literal("add_rubric_criterion"),
  criterion: rubricCriterionSpecV2Schema
});
const removeRubricCriterionCommandSchema = z.strictObject({
  type: z.literal("remove_rubric_criterion"),
  criterionId: workflowLocalIdSchema
});
const replaceRubricCriterionCommandSchema = z.strictObject({
  type: z.literal("replace_rubric_criterion"),
  criterionId: workflowLocalIdSchema,
  criterion: rubricCriterionSpecV2Schema
});
const applyRemovalCommandSchema = z.strictObject({
  type: z.literal("apply_removal"),
  plan: labDraftRemovalPlanTokenSchema,
  resolution: labDraftRemovalResolutionSchema,
  confirmCompatibilityEffects: z.boolean(),
  confirmDependentContentRemoval: z.boolean()
});

export const labDraftCommandSchema = z.discriminatedUnion("type", [
  updateMetadataCommandSchema,
  addEquipmentCommandSchema,
  removeEquipmentCommandSchema,
  configureEquipmentCommandSchema,
  bindMaterialCommandSchema,
  removeMaterialBindingCommandSchema,
  setMaterialConcentrationCommandSchema,
  clearMaterialConcentrationCommandSchema,
  setLayoutCommandSchema,
  permitActionCommandSchema,
  removePermittedActionCommandSchema,
  addRuleCommandSchema,
  removeRuleCommandSchema,
  replaceRuleCommandSchema,
  addConditionCommandSchema,
  removeConditionCommandSchema,
  addOrderingDependencyCommandSchema,
  removeOrderingDependencyCommandSchema,
  addInstructionCommandSchema,
  removeInstructionCommandSchema,
  replaceInstructionCommandSchema,
  addObjectiveCommandSchema,
  removeObjectiveCommandSchema,
  addRubricCriterionCommandSchema,
  removeRubricCriterionCommandSchema,
  replaceRubricCriterionCommandSchema,
  applyRemovalCommandSchema
]);

export type LabDraftCommand = z.infer<typeof labDraftCommandSchema>;
export type LabDraftCommandType = LabDraftCommand["type"];
