import type { ProcedureGuideStep } from "../ProcedureGuide";
import type { TitrationProcedureStage } from "./procedureStage";

interface StageCopy {
  readonly stage: TitrationProcedureStage;
  readonly title: string;
  readonly guidance: string;
}

/**
 * Student-facing copy for the legacy titration stages. The stage machine in
 * `procedureStage` owns which stage is current; this only supplies the prose
 * shown beside it.
 */
const STAGE_COPY: readonly StageCopy[] = [
  {
    stage: "prepare_burette",
    title: "Prepare the burette",
    guidance:
      "Rinse the burette with titrant, fill it above the zero mark, then run the tip clear of air bubbles before taking an initial reading."
  },
  {
    stage: "add_titrant",
    title: "Titrate toward the endpoint",
    guidance:
      "Add titrant steadily while swirling, then slow to dropwise additions once the indicator colour starts to persist between drops."
  },
  {
    stage: "record_results",
    title: "Record your readings",
    guidance:
      "Read the bottom of the meniscus at eye level and record the final burette volume before calculating the delivered titrant."
  },
  {
    stage: "report_submitted",
    title: "Submit your report",
    guidance:
      "Report the endpoint volume and the concentration it gives, together with the readings the result depends on."
  }
];

/**
 * Projects the current titration stage onto read-only guide steps. Stages
 * before the current one are complete; the current one is active.
 */
export function titrationProcedureGuideSteps(
  stage: TitrationProcedureStage
): readonly ProcedureGuideStep[] {
  const currentIndex = STAGE_COPY.findIndex((entry) => entry.stage === stage);
  const submitted = stage === "report_submitted";

  return STAGE_COPY.map((entry, index) => ({
    id: entry.stage,
    title: entry.title,
    guidance: entry.guidance,
    status:
      submitted || index < currentIndex
        ? ("done" as const)
        : index === currentIndex
          ? ("active" as const)
          : ("pending" as const)
  }));
}
