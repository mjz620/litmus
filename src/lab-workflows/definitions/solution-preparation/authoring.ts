import type { LabDraftCommand } from "../../authoring";
import type { LabWorkflowDraftV2 } from "../../schema/v2";
import {
  buildDilutionCommands,
  createDilutionDraft,
  type DilutionAuthoringSpec
} from "./dilutionAuthoring";

/*
 * All three variants dilute copper(II) nitrate rather than sodium chloride.
 * Sodium chloride is colourless at every concentration, so the one thing the
 * lab is teaching — that dilution reduces concentration — had no visible
 * consequence in the flask. Copper(II) nitrate carries a teal that scales with
 * concentration, so the aliquot visibly pales as it is made up to the mark.
 *
 * Stock concentrations are chosen so the product stays in the range where the
 * tint is legible on a Chromebook panel. A tenfold dilution of a 0.25 mol/L
 * stock lands at 0.025 mol/L, which is very nearly colourless in reality; the
 * ladder below keeps every product at or above 0.05 mol/L instead.
 */

export const SOLUTION_PREPARATION_WORKFLOW_ID =
  "workflow.copper_nitrate_dilution.native.v2" as const;

export const SOLUTION_PREPARATION_STOCK_1M_WORKFLOW_ID =
  "workflow.copper_nitrate_stock_1m_dilution.native.v2" as const;

export const SOLUTION_PREPARATION_QUARTER_WORKFLOW_ID =
  "workflow.copper_nitrate_half_molar_dilution.native.v2" as const;

const COPPER_NITRATE = {
  materialProfileId: "reagent.copper_nitrate_aqueous.v1",
  quantityPresetId: "quantity-preset.copper_nitrate_solution_50ml.v1"
} as const;

export const SOLUTION_PREPARATION_AUTHORING_SPEC = Object.freeze({
  workflowId: SOLUTION_PREPARATION_WORKFLOW_ID,
  rubricId: "rubric.copper_nitrate_dilution.v2",
  rubricTitle: "Copper(II) nitrate dilution rubric",
  title: "Prepare a copper(II) nitrate dilution",
  learningObjective:
    "Transfer a calibrated aliquot, dilute it to the mark, and mix a solution with deterministic concentration evidence.",
  studentSummary:
    "Use a volumetric pipette and flask to prepare 100.00 mL of 0.2000 mol/L copper(II) nitrate from a 2.000 mol/L stock solution.",
  sourceRequest:
    "Create a bounded copper(II) nitrate solution-preparation lab using a teacher-authored stock concentration.",
  stockLabel: "2.000 mol/L copper(II) nitrate stock",
  ...COPPER_NITRATE,
  stockConcentrationDecimal: "2.0000",
  finalConcentrationMinimum: 0.1998,
  finalConcentrationMaximum: 0.2002
} as const satisfies DilutionAuthoringSpec);

export const SOLUTION_PREPARATION_STOCK_1M_AUTHORING_SPEC = Object.freeze({
  workflowId: SOLUTION_PREPARATION_STOCK_1M_WORKFLOW_ID,
  rubricId: "rubric.copper_nitrate_stock_1m_dilution.v2",
  rubricTitle: "Copper(II) nitrate 1.000 M stock dilution rubric",
  title: "Dilute a 1.000 M copper(II) nitrate stock",
  learningObjective:
    "Transfer a calibrated aliquot from a 1.000 M stock, dilute it to the mark, and confirm the registered product concentration.",
  studentSummary:
    "Use a volumetric pipette and flask to prepare 100.00 mL of 0.1000 mol/L copper(II) nitrate from a 1.000 M stock solution.",
  sourceRequest:
    "Create a bounded copper(II) nitrate solution-preparation lab that dilutes a 1.000 M authored stock tenfold.",
  stockLabel: "1.000 M copper(II) nitrate stock",
  ...COPPER_NITRATE,
  stockConcentrationDecimal: "1",
  finalConcentrationMinimum: 0.0999,
  finalConcentrationMaximum: 0.1001
} as const satisfies DilutionAuthoringSpec);

export const SOLUTION_PREPARATION_QUARTER_AUTHORING_SPEC = Object.freeze({
  workflowId: SOLUTION_PREPARATION_QUARTER_WORKFLOW_ID,
  rubricId: "rubric.copper_nitrate_half_molar_dilution.v2",
  rubricTitle: "Copper(II) nitrate half-molar dilution rubric",
  title: "Prepare a 0.0500 mol/L copper(II) nitrate solution",
  learningObjective:
    "Transfer a calibrated aliquot from a teacher-authored 0.5000 mol/L stock, dilute it to the mark, and mix a solution with deterministic concentration evidence.",
  studentSummary:
    "Use a volumetric pipette and flask to prepare 100.00 mL of 0.0500 mol/L copper(II) nitrate from a 0.5000 mol/L stock solution.",
  sourceRequest:
    "Create a bounded copper(II) nitrate solution-preparation lab using a 0.5000 mol/L authored stock concentration.",
  stockLabel: "0.5000 mol/L copper(II) nitrate stock",
  ...COPPER_NITRATE,
  stockConcentrationDecimal: "0.5000",
  finalConcentrationMinimum: 0.04995,
  finalConcentrationMaximum: 0.05005
} as const satisfies DilutionAuthoringSpec);

export const SOLUTION_PREPARATION_AUTHORING_COMMANDS = Object.freeze(
  buildDilutionCommands(SOLUTION_PREPARATION_AUTHORING_SPEC)
) as readonly LabDraftCommand[];

export const SOLUTION_PREPARATION_STOCK_1M_AUTHORING_COMMANDS = Object.freeze(
  buildDilutionCommands(SOLUTION_PREPARATION_STOCK_1M_AUTHORING_SPEC)
) as readonly LabDraftCommand[];

export const SOLUTION_PREPARATION_QUARTER_AUTHORING_COMMANDS = Object.freeze(
  buildDilutionCommands(SOLUTION_PREPARATION_QUARTER_AUTHORING_SPEC)
) as readonly LabDraftCommand[];

export function createAuthoredSolutionPreparationDraft(): Readonly<LabWorkflowDraftV2> {
  return createDilutionDraft(
    SOLUTION_PREPARATION_AUTHORING_SPEC,
    SOLUTION_PREPARATION_AUTHORING_COMMANDS
  );
}

export function createAuthoredSolutionPreparationStock1mDraft(): Readonly<LabWorkflowDraftV2> {
  return createDilutionDraft(
    SOLUTION_PREPARATION_STOCK_1M_AUTHORING_SPEC,
    SOLUTION_PREPARATION_STOCK_1M_AUTHORING_COMMANDS
  );
}

export function createAuthoredSolutionPreparationQuarterDraft(): Readonly<LabWorkflowDraftV2> {
  return createDilutionDraft(
    SOLUTION_PREPARATION_QUARTER_AUTHORING_SPEC,
    SOLUTION_PREPARATION_QUARTER_AUTHORING_COMMANDS
  );
}
