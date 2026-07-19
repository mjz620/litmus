import { z } from "zod";

import {
  registryIdSchema,
  sha256HashSchema,
  workflowLocalIdSchema
} from "../schema";

export const labDraftRemovalTargetSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("objective"),
    objectiveId: registryIdSchema
  }),
  z.strictObject({
    kind: z.literal("equipment"),
    instanceId: workflowLocalIdSchema
  }),
  z.strictObject({
    kind: z.literal("rule"),
    ruleId: workflowLocalIdSchema
  }),
  z.strictObject({
    kind: z.literal("material"),
    instanceId: workflowLocalIdSchema
  }),
  z.strictObject({
    kind: z.literal("permitted_action"),
    permissionId: workflowLocalIdSchema
  }),
  z.strictObject({
    kind: z.literal("instruction"),
    instructionId: workflowLocalIdSchema
  }),
  z.strictObject({
    kind: z.literal("rubric_criterion"),
    criterionId: workflowLocalIdSchema
  })
]);

export const labDraftRemovalResolutionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("remove_only") }),
  z.strictObject({ kind: z.literal("cascade") }),
  z.strictObject({
    kind: z.literal("reassign"),
    replacementObjectiveId: registryIdSchema
  }),
  z.strictObject({ kind: z.literal("detach") }),
  z.strictObject({ kind: z.literal("remove_dependents") })
]);

export const labDraftRemovalPlanTokenSchema = z.strictObject({
  sourceRevision: z.number().finite().int().min(1).max(1_000_000),
  sourceDraftHash: sha256HashSchema,
  target: labDraftRemovalTargetSchema
});

export type LabDraftRemovalTarget = z.infer<typeof labDraftRemovalTargetSchema>;
export type LabDraftRemovalResolution = z.infer<
  typeof labDraftRemovalResolutionSchema
>;
export type RemovalResolutionKind = LabDraftRemovalResolution["kind"];

export type RemovalReferenceKind =
  | "adaptive_retry"
  | "coach_trigger"
  | "compatibility_binding"
  | "instruction"
  | "instruction_guidance"
  | "layout_placement"
  | "material_binding"
  | "material_label"
  | "permitted_action"
  | "rubric_criterion"
  | "rule_prompt"
  | "safety_binding"
  | "workflow_rule";

export interface RemovalReference {
  readonly kind: RemovalReferenceKind;
  readonly id: string;
  readonly path: string;
}

export type CompatibilityEffectKind =
  | "equipment_role_removed"
  | "material_role_removed"
  | "runtime_compatibility_incomplete";

export interface CompatibilityEffect {
  readonly kind: CompatibilityEffectKind;
  readonly id: string;
  readonly path: string;
  readonly message: string;
}

export interface LabDraftRemovalImpact {
  readonly sourceRevision: number;
  readonly sourceDraftHash: string;
  readonly target: LabDraftRemovalTarget;
  readonly references: readonly RemovalReference[];
  readonly compatibilityEffects: readonly CompatibilityEffect[];
  readonly allowedResolutions: readonly RemovalResolutionKind[];
}
