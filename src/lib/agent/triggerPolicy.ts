import type { SemanticEvent } from "../../experiments/shared";
import type { WorkflowDiagnosis } from "../../lab-workflows/schema/conditions";

export type CoachTriggerSource = "event" | "question" | "retry";

export interface CoachTriggerDecision {
  shouldTrigger: boolean;
  source: CoachTriggerSource;
  reasons: string[];
  maxHintLevel: 0 | 1 | 2 | 3;
}

export interface CoachTriggerInput {
  recentEvents: readonly SemanticEvent[];
  diagnoses?: readonly WorkflowDiagnosis[];
  studentQuestion?: string;
  retryRequested?: boolean;
  repeatedFailureThreshold?: number;
}

/** Deterministic trigger policy. Routine successful work is deliberately quiet. */
export function decideCoachTrigger({
  recentEvents,
  diagnoses = [],
  studentQuestion,
  retryRequested = false,
  repeatedFailureThreshold = 2
}: CoachTriggerInput): CoachTriggerDecision {
  if (studentQuestion?.trim()) {
    return {
      shouldTrigger: true,
      source: "question",
      reasons: ["student_question"],
      maxHintLevel: 3
    };
  }

  if (retryRequested) {
    return {
      shouldTrigger: true,
      source: "retry",
      reasons: ["targeted_retry_requested"],
      maxHintLevel: 2
    };
  }

  const flaggedReasons = Array.from(
    new Set(recentEvents.flatMap((event) => event.flags))
  );
  const diagnosisReasons = diagnoses
    .filter(({ status }) => status === "violated")
    .map(({ ruleId }) => `diagnosis:${ruleId}`);
  const deterministicReasons = Array.from(
    new Set([...flaggedReasons, ...diagnosisReasons])
  );
  if (deterministicReasons.length > 0) {
    return {
      shouldTrigger: true,
      source: "event",
      reasons: deterministicReasons,
      maxHintLevel: 2
    };
  }

  const negativeEvidenceCounts = new Map<string, number>();
  for (const event of recentEvents) {
    for (const evidence of event.evidence) {
      if (evidence.delta < 0) {
        negativeEvidenceCounts.set(
          evidence.skillId,
          (negativeEvidenceCounts.get(evidence.skillId) ?? 0) + 1
        );
      }
    }
  }

  const repeatedFailures = [...negativeEvidenceCounts.entries()]
    .filter(([, count]) => count >= repeatedFailureThreshold)
    .map(([skillId]) => `repeated_failure:${skillId}`);

  return {
    shouldTrigger: repeatedFailures.length > 0,
    source: "event",
    reasons: repeatedFailures,
    maxHintLevel: repeatedFailures.length > 0 ? 2 : 0
  };
}
