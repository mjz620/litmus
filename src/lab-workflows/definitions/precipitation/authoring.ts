import {
  applyLabDraftTransaction,
  type LabDraftCommand
} from "../../authoring";
import { createBlankLabDraftV2 } from "../blank-lab";
import {
  labWorkflowDraftV2Schema,
  type LabWorkflowDraftV2
} from "../../schema/v2";
import serializedWorkflow from "./silver-chloride.v2.json";

export const PRECIPITATION_WORKFLOW_ID =
  "workflow.silver_chloride_precipitation.native.v2" as const;

const TARGET = labWorkflowDraftV2Schema.parse(serializedWorkflow);

/**
 * Exact shared-domain commands for the shipped workflow. The checked-in JSON
 * is the reviewable definition, while this projection proves every editable
 * structure can still be recreated through the same command layer as Composer.
 */
export const PRECIPITATION_AUTHORING_COMMANDS: readonly LabDraftCommand[] =
  Object.freeze([
    { type: "update_metadata", metadata: TARGET.metadata },
    ...TARGET.objectiveIds.map(
      (objectiveId): LabDraftCommand => ({ type: "add_objective", objectiveId })
    ),
    ...TARGET.equipment.map(
      (equipment): LabDraftCommand => ({ type: "add_equipment", equipment })
    ),
    { type: "set_layout", layout: TARGET.layout },
    ...TARGET.materials.map(
      (binding): LabDraftCommand => ({ type: "bind_material", binding })
    ),
    ...TARGET.permittedActions.map(
      (action): LabDraftCommand => ({ type: "permit_action", action })
    ),
    ...TARGET.rules.map(
      (rule): LabDraftCommand => ({ type: "add_rule", rule })
    ),
    ...TARGET.instructions.map(
      (instruction): LabDraftCommand => ({
        type: "add_instruction",
        instruction
      })
    ),
    ...TARGET.rubric.criteria.map(
      (criterion): LabDraftCommand => ({
        type: "add_rubric_criterion",
        criterion
      })
    )
  ]);

export function createAuthoredPrecipitationDraft(): Readonly<LabWorkflowDraftV2> {
  const blank = createBlankLabDraftV2();
  const scaffold = labWorkflowDraftV2Schema.parse({
    ...blank,
    id: TARGET.id,
    revision: TARGET.revision - 1,
    sourceRequest: TARGET.sourceRequest,
    rubric: {
      ...blank.rubric,
      id: TARGET.rubric.id,
      version: TARGET.rubric.version,
      title: TARGET.rubric.title,
      passingPolicyId: TARGET.rubric.passingPolicyId
    }
  });
  const result = applyLabDraftTransaction(
    scaffold,
    PRECIPITATION_AUTHORING_COMMANDS,
    scaffold.revision
  );
  if (!result.ok) {
    throw new Error(
      `Precipitation command ${result.failingCommandIndex ?? "?"} failed: ${result.error.code} at ${result.error.path}: ${result.error.message}`
    );
  }
  return labWorkflowDraftV2Schema.parse({
    ...result.draft,
    requiredChemistryCapabilityIds: TARGET.requiredChemistryCapabilityIds,
    coachPolicy: TARGET.coachPolicy,
    safetyPolicyIds: TARGET.safetyPolicyIds,
    safetyBindings: TARGET.safetyBindings,
    presentation: TARGET.presentation
  });
}
