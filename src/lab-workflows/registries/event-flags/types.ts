export type EventFlagRegistryId =
  | "burette_not_conditioned"
  | "flag.endpoint_overshoot.v1"
  | "flag.flow_rate_high_near_endpoint.v1"
  | "meniscus_misread"
  | "result_out_of_tolerance";

export interface EventFlagRegistryEntry {
  readonly id: EventFlagRegistryId;
  readonly version: "1.0.0";
  readonly semanticFlag: string;
  readonly workflowReferenceId: string | null;
  readonly emittedBySemanticEventTypes: readonly string[];
  readonly canonicalSkillId:
    | "burette_conditioning"
    | "endpoint_control"
    | "meniscus_reading"
    | "stoichiometry";
  readonly severity: "error" | "warning";
  readonly coachEligible: boolean;
  readonly positiveStaySilentEvidenceReasonId: string | null;
  readonly compatibleEngineIds: readonly ["engine.titration.v1"];
}

export interface EventTypeRegistryEntry {
  readonly id: string;
  readonly version: "1.0.0";
  readonly semanticEventType: string;
  readonly workflowReferenceId: string | null;
  readonly observationKeys: readonly string[];
  readonly emittedSemanticFlags: readonly string[];
  readonly compatibleEngineIds: readonly ["engine.titration.v1"];
}
