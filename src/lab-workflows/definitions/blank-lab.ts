import { hashLabWorkflowSpec } from "../hash";
import {
  labWorkflowDraftV2Schema,
  type LabWorkflowDraftV2
} from "../schema/v2";
import { NATIVE_TITRATION_V2_DRAFT } from "./titration/native-endpoint-control";

export const BLANK_LAB_V2_WORKFLOW_ID = "workflow.blank_lab.native.v2" as const;

/**
 * A minimal, schema-valid starting draft so a teacher can build a new lab
 * instead of dismantling the pre-built titration. It reuses the existing
 * verified bench-layout configuration but carries no equipment, materials,
 * actions, objectives, rules, instructions, or grading items. It is
 * `draft_unvalidated`: Preview stays closed until the teacher builds and
 * validates it. No registry IDs are invented here — only the empty scaffolding
 * of an already-verified layout is reused.
 */
export function createBlankLabDraftV2(): LabWorkflowDraftV2 {
  const base = structuredClone(NATIVE_TITRATION_V2_DRAFT) as LabWorkflowDraftV2;
  const draft: LabWorkflowDraftV2 = {
    ...base,
    id: BLANK_LAB_V2_WORKFLOW_ID,
    revision: 1,
    sourceRequest: "Start a new lab from scratch.",
    metadata: {
      ...base.metadata,
      title: "New lab",
      studentSummary: "Describe what students will do in this lab.",
      learningObjective: "Describe what students should be able to do."
    },
    objectiveIds: [],
    equipment: [],
    materials: [],
    layout: { ...base.layout, placements: [] },
    requiredChemistryCapabilityIds: [],
    permittedActions: [],
    rules: [],
    instructions: [],
    coachPolicy: { triggers: [], adaptiveRetries: [] },
    rubric: { ...base.rubric, criteria: [], totalPoints: 0 },
    safetyPolicyIds: [],
    safetyBindings: [],
    presentation: {
      instructionGuidance: [],
      materialLabels: [],
      rulePrompts: []
    },
    supportStatus: "draft_unvalidated",
    validation: null,
    judgeCritique: null
  };
  // A blank lab has no legacy titration compatibility, migration provenance, or
  // family catalog metadata.
  delete draft.compatibility;
  delete draft.provenance;
  delete draft.catalog;
  return labWorkflowDraftV2Schema.parse(draft);
}

export const BLANK_LAB_V2_DRAFT = Object.freeze(createBlankLabDraftV2());
export const BLANK_LAB_V2_SOURCE_HASH = hashLabWorkflowSpec(BLANK_LAB_V2_DRAFT);
