import type { EventFlagRegistryEntry, EventTypeRegistryEntry } from "./types";

const ENGINE = ["engine.titration.v1"] as const;

export const EVENT_FLAG_REGISTRY_ENTRIES = [
  {
    id: "flag.flow_rate_high_near_endpoint.v1",
    version: "1.0.0",
    semanticFlag: "flow_rate_high_near_endpoint",
    workflowReferenceId: "flag.flow_rate_high_near_endpoint.v1",
    emittedBySemanticEventTypes: ["add_titrant"],
    canonicalSkillId: "endpoint_control",
    severity: "warning",
    coachEligible: true,
    positiveStaySilentEvidenceReasonId:
      "evidence.controlled_addition_near_endpoint.v1",
    compatibleEngineIds: ENGINE
  },
  {
    id: "flag.endpoint_overshoot.v1",
    version: "1.0.0",
    semanticFlag: "endpoint_overshoot",
    workflowReferenceId: "flag.endpoint_overshoot.v1",
    emittedBySemanticEventTypes: ["add_titrant"],
    canonicalSkillId: "endpoint_control",
    severity: "error",
    coachEligible: true,
    positiveStaySilentEvidenceReasonId:
      "evidence.controlled_addition_near_endpoint.v1",
    compatibleEngineIds: ENGINE
  },
  {
    id: "meniscus_misread",
    version: "1.0.0",
    semanticFlag: "meniscus_misread",
    workflowReferenceId: null,
    emittedBySemanticEventTypes: ["read_meniscus"],
    canonicalSkillId: "meniscus_reading",
    severity: "warning",
    coachEligible: true,
    positiveStaySilentEvidenceReasonId: "meniscus_read_ok",
    compatibleEngineIds: ENGINE
  },
  {
    id: "burette_not_conditioned",
    version: "1.0.0",
    semanticFlag: "burette_not_conditioned",
    workflowReferenceId: null,
    emittedBySemanticEventTypes: ["rinse_burette", "add_titrant"],
    canonicalSkillId: "burette_conditioning",
    severity: "warning",
    coachEligible: true,
    positiveStaySilentEvidenceReasonId: "conditioned_with_titrant",
    compatibleEngineIds: ENGINE
  },
  {
    id: "result_out_of_tolerance",
    version: "1.0.0",
    semanticFlag: "result_out_of_tolerance",
    workflowReferenceId: null,
    emittedBySemanticEventTypes: ["submit_report"],
    canonicalSkillId: "stoichiometry",
    severity: "warning",
    coachEligible: false,
    positiveStaySilentEvidenceReasonId: "result_within_tolerance",
    compatibleEngineIds: ENGINE
  }
] as const satisfies readonly EventFlagRegistryEntry[];

export const EVENT_TYPE_REGISTRY_ENTRIES = [
  {
    id: "rinse_burette",
    version: "1.0.0",
    semanticEventType: "rinse_burette",
    workflowReferenceId: null,
    observationKeys: ["solvent"],
    emittedSemanticFlags: ["burette_not_conditioned"],
    compatibleEngineIds: ENGINE
  },
  {
    id: "fill_burette",
    version: "1.0.0",
    semanticEventType: "fill_burette",
    workflowReferenceId: null,
    observationKeys: [
      "requestedML",
      "resultingAvailableML",
      "currentReadingML",
      "fillKind"
    ],
    emittedSemanticFlags: [],
    compatibleEngineIds: ENGINE
  },
  {
    id: "refill_burette",
    version: "1.0.0",
    semanticEventType: "refill_burette",
    workflowReferenceId: null,
    observationKeys: [
      "requestedML",
      "resultingAvailableML",
      "currentReadingML",
      "fillKind"
    ],
    emittedSemanticFlags: [],
    compatibleEngineIds: ENGINE
  },
  {
    id: "select_indicator",
    version: "1.0.0",
    semanticEventType: "select_indicator",
    workflowReferenceId: null,
    observationKeys: ["indicator"],
    emittedSemanticFlags: [],
    compatibleEngineIds: ENGINE
  },
  {
    id: "event.add_titrant.v1",
    version: "1.0.0",
    semanticEventType: "add_titrant",
    workflowReferenceId: "event.add_titrant.v1",
    observationKeys: [
      "addedML",
      "totalML",
      "cumulativeDeliveredML",
      "currentReadingML",
      "availableML",
      "rateMlPerS",
      "pH",
      "observedColor",
      "equivalenceML"
    ],
    emittedSemanticFlags: [
      "flow_rate_high_near_endpoint",
      "endpoint_overshoot",
      "burette_not_conditioned"
    ],
    compatibleEngineIds: ENGINE
  },
  {
    id: "event.read_meniscus.v1",
    version: "1.0.0",
    semanticEventType: "read_meniscus",
    workflowReferenceId: "event.read_meniscus.v1",
    observationKeys: ["reportedML", "trueML", "errorML"],
    emittedSemanticFlags: ["meniscus_misread"],
    compatibleEngineIds: ENGINE
  },
  {
    id: "submit_report",
    version: "1.0.0",
    semanticEventType: "submit_report",
    workflowReferenceId: null,
    observationKeys: ["reportedMolarityM", "trueMolarityM", "relErr"],
    emittedSemanticFlags: ["result_out_of_tolerance"],
    compatibleEngineIds: ENGINE
  }
] as const satisfies readonly EventTypeRegistryEntry[];
