import type { EngineRegistryEntry } from "./types";

export const ENGINE_REGISTRY_ENTRIES = [
  {
    id: "engine.titration.v1",
    version: "1.0.0",
    experimentDefinitionId: "acid_base_titration",
    experimentDefinitionVersion: "1.0.0",
    familyId: "family.acid_base_titration.v1",
    availability: "verified",
    deterministic: true,
    supportsSeededState: true,
    componentIds: [
      "component.burette.v1",
      "component.erlenmeyer_flask.v1",
      "component.reagent_bottle.v1",
      "component.indicator_bottle.v1"
    ],
    actionIds: [
      "action.rinse.v1",
      "action.fill.v1",
      "action.select_indicator.v1",
      "action.add_indicator.v1",
      "action.dispense.v1",
      "action.read_volume.v1"
    ],
    reagentIds: [
      "reagent.hydrochloric_acid_0_100m.v1",
      "reagent.hydrochloric_acid_aqueous.v1",
      "reagent.sodium_hydroxide_0_100m.v1",
      "reagent.sodium_hydroxide_aqueous.v1",
      "reagent.phenolphthalein.v1",
      "reagent.bromothymol_blue.v1",
      "reagent.methyl_orange.v1",
      "reagent.distilled_water.v1"
    ],
    engineConfigIds: [
      "engine_config.titration.strong_acid_strong_base_25ml.v1"
    ],
    seedTemplateIds: ["seed.titration.near_endpoint_22ml.v1"],
    semanticEventTypes: [
      "rinse_burette",
      "fill_burette",
      "refill_burette",
      "select_indicator",
      "add_titrant",
      "read_meniscus",
      "submit_report"
    ],
    workflowEventTypeIds: ["event.add_titrant.v1", "event.read_meniscus.v1"],
    semanticFlags: [
      "flow_rate_high_near_endpoint",
      "endpoint_overshoot",
      "meniscus_misread",
      "burette_not_conditioned",
      "result_out_of_tolerance"
    ]
  }
] as const satisfies readonly EngineRegistryEntry[];
