import type { AuthoredCoachRequest } from "./authoredCoachSchemas";

export const AUTHORED_COACH_VERSION = "diagnosis-aware-coach-v2" as const;
export const AUTHORED_COACH_PROMPT_VERSION =
  "diagnosis-aware-coach-prompt-v2" as const;

export const AUTHORED_COACH_SYSTEM_PROMPT = `You are Litmus's constrained Student Coach. The supplied active objectives, instructions, rules, diagnoses, available actions, and evidence are exact deterministic context. They are immutable.

Follow the deterministic trigger decision. For an unsolicited event request, respond only to a supplied violated diagnosis. A direct student question is explicit and may receive an answer grounded in supplied instructions and objectives. Credit alternate valid work: never correct work whose diagnoses are satisfied or pending without a violated diagnosis.

Use only supplied IDs. Suggest only an action in availableActions. Never calculate or reconstruct pH, concentration, equivalence, precipitate identity, heat, measurements, hidden state, or results. Never invent chemistry, actions, rules, evidence, or outcomes. Never mutate simulation state, add/remove workflow rules, or request an automatic reset/checkpoint rewind. Distinguish mandatory_procedure, safety, optional_context, and ai_guidance exactly. Keep the lowest useful hint level, concise student-facing language, and structured output. Do not expose hidden reasoning.`;

/** Sends the model only reviewed instructional context, never hidden chemistry. */
export function authoredCoachPromptInput(
  request: Readonly<AuthoredCoachRequest>
) {
  const { workflowContext } = request;
  const { definition } = workflowContext;
  return {
    contractVersion: request.contractVersion,
    workflow: {
      id: definition.id,
      revision: definition.revision,
      hash: workflowContext.definitionHash,
      title: definition.metadata.title,
      studentSummary: definition.metadata.studentSummary,
      learningObjective: definition.metadata.learningObjective
    },
    activeObjectiveIds: workflowContext.activeObjectiveIds,
    instructions: workflowContext.instructions,
    rules: workflowContext.rules,
    diagnoses: workflowContext.diagnoses,
    evidence: workflowContext.evidence.map((event) => ({
      eventId: event.eventId,
      eventType: event.payload.type,
      flags: event.payload.flags,
      evidenceReasons: event.payload.evidence.map(({ reason }) => reason),
      ruleEvidenceIds: event.ruleEvidenceIds,
      actionId: event.normalizedAction.actionId
    })),
    availableActions: workflowContext.availableActions,
    studentQuestion: request.studentQuestion,
    triggerPolicy: request.triggerPolicy
  };
}
