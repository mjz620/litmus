import type { SemanticEvent } from "../../../experiments/shared";
import type { TitrationState } from "../../../experiments/titration/titration";

export type TitrationProcedureStage =
  | "prepare_burette"
  | "add_titrant"
  | "record_results"
  | "report_submitted";

const STAGE_LABELS: Record<TitrationProcedureStage, string> = {
  prepare_burette: "Prepare the burette",
  add_titrant: "Titrate toward the endpoint",
  record_results: "Record your readings",
  report_submitted: "Report submitted"
};

/**
 * Project engine state onto a student-facing procedure stage. This is a pure
 * display projection over existing state fields and recorded events; it owns
 * no chemistry and never inspects ground truth.
 */
export function getProcedureStage(
  state: TitrationState,
  events: readonly SemanticEvent[]
): TitrationProcedureStage {
  if (state.submitted) return "report_submitted";
  if (state.buretteAvailableML === 0 && state.titrantAddedML === 0) {
    return "prepare_burette";
  }
  if (state.titrantAddedML === 0) return "add_titrant";

  const lastAdditionIndex = events.findLastIndex(
    ({ type }) => type === "add_titrant"
  );
  const lastReadingIndex = events.findLastIndex(
    ({ type }) => type === "read_meniscus"
  );

  return lastReadingIndex > lastAdditionIndex
    ? "record_results"
    : "add_titrant";
}

export function getProcedureStageLabel(stage: TitrationProcedureStage): string {
  return STAGE_LABELS[stage];
}
