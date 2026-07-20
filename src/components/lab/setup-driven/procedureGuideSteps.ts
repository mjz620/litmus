import type { ProcedureGuideStep } from "../ProcedureGuide";
import type { GenericLabState } from "../../../lab-workflows/runtime";
import type { ValidatedLabWorkflowSpecV2 } from "../../../lab-workflows/schema/v2";

/**
 * Projects authored instruction sections into read-only guide steps, using the
 * deterministic rule diagnoses already produced by the runtime. This reads
 * engine output only; it never evaluates chemistry or rules itself.
 */
export function procedureGuideStepsFromWorkflow(
  workflow: Readonly<ValidatedLabWorkflowSpecV2>,
  diagnoses: GenericLabState["diagnoses"]
): readonly ProcedureGuideStep[] {
  const statusByRuleId = new Map(
    diagnoses.map((diagnosis) => [diagnosis.ruleId, diagnosis.status])
  );

  const steps = workflow.instructions.map((section) => {
    const statuses = section.relatedRuleIds.map((ruleId) =>
      statusByRuleId.get(ruleId)
    );
    const violated = statuses.some((status) => status === "violated");
    const satisfied = statuses.filter((status) => status === "satisfied").length;
    const resolved = statuses.filter((status) => status !== undefined).length;

    return {
      id: section.id,
      title: section.title,
      guidance: section.guidance,
      status: violated
        ? ("attention" as const)
        : resolved > 0 && satisfied === resolved
          ? ("done" as const)
          : ("pending" as const)
    };
  });

  // The first unresolved step is the one the student is working on.
  const activeIndex = steps.findIndex((step) => step.status === "pending");
  if (activeIndex === -1) return steps;

  return steps.map((step, index) =>
    index === activeIndex ? { ...step, status: "active" as const } : step
  );
}
