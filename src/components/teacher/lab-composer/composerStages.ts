import type { LabWorkflowDraftV2 } from "../../../lab-workflows/schema/v2";

export const COMPOSER_STAGE_IDS = [
  "define",
  "setup",
  "workflow",
  "assess",
  "validate",
  "agent_loop"
] as const;

export type ComposerStageId = (typeof COMPOSER_STAGE_IDS)[number];

export interface ComposerStageDefinition {
  readonly id: ComposerStageId;
  readonly label: string;
  readonly shortPurpose: string;
  readonly purpose: string;
}

export interface ComposerStageReadiness {
  readonly count: number;
  readonly summary: string;
  readonly state: "started" | "needs-content";
}

export const COMPOSER_STAGES: readonly ComposerStageDefinition[] =
  Object.freeze([
    {
      id: "define",
      label: "Define",
      shortPurpose: "Goals",
      purpose:
        "Confirm what students will learn and the audience this lab is designed for."
    },
    {
      id: "setup",
      label: "Set up",
      shortPurpose: "Bench",
      purpose:
        "Choose the equipment, materials, and student actions for the bench."
    },
    {
      id: "workflow",
      label: "Workflow",
      shortPurpose: "Rules",
      purpose:
        "Choose what students should do and connect only the steps that must happen in order."
    },
    {
      id: "assess",
      label: "Assess",
      shortPurpose: "Evidence",
      purpose:
        "Connect learning goals to grading items and the evidence students will produce."
    },
    {
      id: "validate",
      label: "Check & preview",
      shortPurpose: "Review",
      purpose:
        "Check for missing or unsupported choices, then try the student experience."
    },
    {
      id: "agent_loop",
      label: "AI review",
      shortPurpose: "Trace",
      purpose:
        "See the suggested draft, LabBench checks, optional teaching feedback, and your decisions in one place."
    }
  ]);

export function summarizeStageReadiness(
  draft: Readonly<LabWorkflowDraftV2>,
  stageId: ComposerStageId
): ComposerStageReadiness {
  switch (stageId) {
    case "define":
      return draft.objectiveIds.length > 0
        ? {
            count: draft.objectiveIds.length,
            summary: `${draft.objectiveIds.length} learning objective${draft.objectiveIds.length === 1 ? "" : "s"} selected`,
            state: "started"
          }
        : {
            count: 0,
            summary: "Choose at least one objective",
            state: "needs-content"
          };
    case "setup": {
      const count =
        draft.equipment.length +
        draft.materials.length +
        draft.permittedActions.length;
      return count > 0
        ? {
            count,
            summary: `${draft.equipment.length} equipment · ${draft.materials.length} materials · ${draft.permittedActions.length} actions`,
            state: "started"
          }
        : { count, summary: "Build the student bench", state: "needs-content" };
    }
    case "workflow": {
      const independentRules = draft.rules.filter(
        ({ kind }) => kind !== "ordering"
      ).length;
      const dependencies = draft.rules.length - independentRules;
      return independentRules + draft.instructions.length > 0
        ? {
            count: independentRules + draft.instructions.length,
            summary: `${independentRules} checks · ${dependencies} connections · ${draft.instructions.length} directions`,
            state: "started"
          }
        : {
            count: 0,
            summary: "Describe evidence and guidance",
            state: "needs-content"
          };
    }
    case "assess":
      return draft.rubric.criteria.length > 0
        ? {
            count: draft.rubric.criteria.length,
            summary: `${draft.rubric.criteria.length} grading items · ${draft.rubric.totalPoints} points`,
            state: "started"
          }
        : {
            count: 0,
            summary: "Map objectives to evidence",
            state: "needs-content"
          };
    case "validate":
      return {
        count: 0,
        summary: "Run the checker after every edit",
        state: "needs-content"
      };
    case "agent_loop":
      return {
        count: 0,
        summary: "See AI suggestions and checks",
        state: "started"
      };
  }
}

/** Routes strict-schema and validator paths to a teacher-facing editing stage. */
export function stageForIssuePath(path: string): ComposerStageId {
  const normalized = path.replace(/^draft\.?/, "");
  if (
    /^(metadata|sourceRequest|objectiveIds|catalog|id|schemaVersion)/.test(
      normalized
    )
  )
    return "define";
  if (
    /^(equipment|materials|layout|permittedActions|requiredChemistryCapabilityIds|safety)/.test(
      normalized
    )
  )
    return "setup";
  if (/^(rules|instructions|coachPolicy|presentation)/.test(normalized))
    return "workflow";
  if (/^rubric/.test(normalized)) return "assess";
  return "validate";
}
