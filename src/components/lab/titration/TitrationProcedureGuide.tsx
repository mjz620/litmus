"use client";

import { isTitrationState, useLabStore } from "../../../stores/labStore";
import { ProcedureGuide } from "../ProcedureGuide";
import { getProcedureStage } from "./procedureStage";
import { titrationProcedureGuideSteps } from "./titrationProcedureSteps";

/**
 * Read-only procedure reference for the legacy titration bench. It mirrors the
 * stage the engine has already derived; it dispatches nothing and is separate
 * from the precision-control executor.
 */
export function TitrationProcedureGuide() {
  const state = useLabStore((store) =>
    isTitrationState(store.state) ? store.state : null
  );
  const eventQueue = useLabStore((store) => store.eventQueue);

  if (!state) return null;

  const stage = getProcedureStage(state, eventQueue);
  return (
    <ProcedureGuide
      steps={titrationProcedureGuideSteps(stage)}
      showHeader={false}
    />
  );
}
