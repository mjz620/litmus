import type { LabDraftCommand } from "../../authoring";
import type { LabWorkflowDraftV2 } from "../../schema/v2";
import {
  buildSodiumChlorideDilutionCommands,
  createSodiumChlorideDilutionDraft,
  type SodiumChlorideDilutionAuthoringSpec
} from "./dilutionAuthoring";

export const SOLUTION_PREPARATION_WORKFLOW_ID =
  "workflow.sodium_chloride_dilution.native.v2" as const;

export const SOLUTION_PREPARATION_STOCK_1M_WORKFLOW_ID =
  "workflow.sodium_chloride_stock_1m_dilution.native.v2" as const;

export const SOLUTION_PREPARATION_QUARTER_WORKFLOW_ID =
  "workflow.sodium_chloride_quarter_dilution.native.v2" as const;

export const SOLUTION_PREPARATION_AUTHORING_SPEC =
  Object.freeze({
    workflowId: SOLUTION_PREPARATION_WORKFLOW_ID,
    rubricId: "rubric.sodium_chloride_dilution.v2",
    rubricTitle: "Sodium chloride dilution rubric",
    title: "Prepare a sodium chloride dilution",
    learningObjective:
      "Transfer a calibrated aliquot, dilute it to the mark, and mix a solution with deterministic concentration evidence.",
    studentSummary:
      "Use a volumetric pipette and flask to prepare 100.00 mL of 0.0500 mol/L sodium chloride from a 0.5000 mol/L stock solution.",
    sourceRequest:
      "Create a bounded sodium-chloride solution-preparation lab using a teacher-authored stock concentration.",
    stockLabel: "0.5000 mol/L sodium chloride stock",
    materialProfileId: "reagent.sodium_chloride_aqueous.v1",
    quantityPresetId: "quantity-preset.sodium_chloride_solution_50ml.v1",
    stockConcentrationDecimal: "0.5000",
    finalConcentrationMinimum: 0.04995,
    finalConcentrationMaximum: 0.05005
  } as const satisfies SodiumChlorideDilutionAuthoringSpec);

export const SOLUTION_PREPARATION_STOCK_1M_AUTHORING_SPEC =
  Object.freeze({
    workflowId: SOLUTION_PREPARATION_STOCK_1M_WORKFLOW_ID,
    rubricId: "rubric.sodium_chloride_stock_1m_dilution.v2",
    rubricTitle: "Sodium chloride 1.000 M stock dilution rubric",
    title: "Dilute a 1.000 M sodium chloride stock",
    learningObjective:
      "Transfer a calibrated aliquot from a 1.000 M stock, dilute it to the mark, and confirm the registered product concentration.",
    studentSummary:
      "Use a volumetric pipette and flask to prepare 100.00 mL of 0.1000 mol/L sodium chloride from a 1.000 M stock solution.",
    sourceRequest:
      "Create a bounded sodium-chloride solution-preparation lab that dilutes a 1.000 M authored stock tenfold.",
    stockLabel: "1.000 M sodium chloride stock",
    materialProfileId: "reagent.sodium_chloride_aqueous.v1",
    quantityPresetId: "quantity-preset.sodium_chloride_solution_50ml.v1",
    stockConcentrationDecimal: "1",
    finalConcentrationMinimum: 0.0999,
    finalConcentrationMaximum: 0.1001
  } as const satisfies SodiumChlorideDilutionAuthoringSpec);

export const SOLUTION_PREPARATION_QUARTER_AUTHORING_SPEC =
  Object.freeze({
    workflowId: SOLUTION_PREPARATION_QUARTER_WORKFLOW_ID,
    rubricId: "rubric.sodium_chloride_quarter_dilution.v2",
    rubricTitle: "Sodium chloride quarter-molar dilution rubric",
    title: "Prepare a 0.0250 mol/L sodium chloride solution",
    learningObjective:
      "Transfer a calibrated aliquot from a teacher-authored 0.2500 mol/L stock, dilute it to the mark, and mix a solution with deterministic concentration evidence.",
    studentSummary:
      "Use a volumetric pipette and flask to prepare 100.00 mL of 0.0250 mol/L sodium chloride from a 0.2500 mol/L stock solution.",
    sourceRequest:
      "Create a bounded sodium-chloride solution-preparation lab using a 0.2500 mol/L authored stock concentration.",
    stockLabel: "0.2500 mol/L sodium chloride stock",
    materialProfileId: "reagent.sodium_chloride_aqueous.v1",
    quantityPresetId: "quantity-preset.sodium_chloride_solution_50ml.v1",
    stockConcentrationDecimal: "0.2500",
    finalConcentrationMinimum: 0.02495,
    finalConcentrationMaximum: 0.02505
  } as const satisfies SodiumChlorideDilutionAuthoringSpec);

export const SOLUTION_PREPARATION_AUTHORING_COMMANDS = Object.freeze(
  buildSodiumChlorideDilutionCommands(SOLUTION_PREPARATION_AUTHORING_SPEC)
) as readonly LabDraftCommand[];

export const SOLUTION_PREPARATION_STOCK_1M_AUTHORING_COMMANDS = Object.freeze(
  buildSodiumChlorideDilutionCommands(SOLUTION_PREPARATION_STOCK_1M_AUTHORING_SPEC)
) as readonly LabDraftCommand[];

export const SOLUTION_PREPARATION_QUARTER_AUTHORING_COMMANDS = Object.freeze(
  buildSodiumChlorideDilutionCommands(SOLUTION_PREPARATION_QUARTER_AUTHORING_SPEC)
) as readonly LabDraftCommand[];

export function createAuthoredSolutionPreparationDraft(): Readonly<LabWorkflowDraftV2> {
  return createSodiumChlorideDilutionDraft(
    SOLUTION_PREPARATION_AUTHORING_SPEC,
    SOLUTION_PREPARATION_AUTHORING_COMMANDS
  );
}

export function createAuthoredSolutionPreparationStock1mDraft(): Readonly<LabWorkflowDraftV2> {
  return createSodiumChlorideDilutionDraft(
    SOLUTION_PREPARATION_STOCK_1M_AUTHORING_SPEC,
    SOLUTION_PREPARATION_STOCK_1M_AUTHORING_COMMANDS
  );
}

export function createAuthoredSolutionPreparationQuarterDraft(): Readonly<LabWorkflowDraftV2> {
  return createSodiumChlorideDilutionDraft(
    SOLUTION_PREPARATION_QUARTER_AUTHORING_SPEC,
    SOLUTION_PREPARATION_QUARTER_AUTHORING_COMMANDS
  );
}
