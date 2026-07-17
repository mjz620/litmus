import type { ActionRegistryEntry } from "./types";

const ENGINE = ["engine.titration.v1"] as const;
const FAMILY = ["family.acid_base_titration.v1"] as const;

export const ACTION_REGISTRY_ENTRIES = [
  {
    id: "action.rinse.v1",
    version: "1.0.0",
    purpose: "Rinse the empty burette with water or the verified titrant.",
    engineActionType: "rinse_burette",
    actorComponentIds: ["component.burette.v1", "component.reagent_bottle.v1"],
    targetComponentIds: ["component.burette.v1"],
    requiredReagentRoleIds: [],
    parameters: [
      {
        key: "solvent",
        valueType: "enum",
        required: true,
        allowedValues: ["water", "titrant"]
      }
    ],
    emittedSemanticEventTypes: ["rinse_burette"],
    compatibleEngineIds: ENGINE,
    compatibleFamilyIds: FAMILY
  },
  {
    id: "action.fill.v1",
    version: "1.0.0",
    purpose: "Add a bounded amount of verified titrant to the burette.",
    engineActionType: "fill_burette",
    actorComponentIds: ["component.burette.v1", "component.reagent_bottle.v1"],
    targetComponentIds: ["component.burette.v1"],
    requiredReagentRoleIds: ["titrant"],
    parameters: [
      {
        key: "volumeML",
        valueType: "number",
        required: true,
        unitId: "unit.ml.v1",
        minimum: 0.01,
        maximum: 50
      }
    ],
    emittedSemanticEventTypes: ["fill_burette", "refill_burette"],
    compatibleEngineIds: ENGINE,
    compatibleFamilyIds: FAMILY
  },
  {
    id: "action.select_indicator.v1",
    version: "1.0.0",
    purpose: "Commit one verified indicator selection to the flask.",
    engineActionType: "select_indicator",
    actorComponentIds: ["component.indicator_bottle.v1"],
    targetComponentIds: ["component.erlenmeyer_flask.v1"],
    requiredReagentRoleIds: ["indicator"],
    parameters: [
      {
        key: "indicator",
        valueType: "enum",
        required: true,
        allowedValues: ["phenolphthalein", "bromothymol_blue", "methyl_orange"]
      }
    ],
    emittedSemanticEventTypes: ["select_indicator"],
    compatibleEngineIds: ENGINE,
    compatibleFamilyIds: FAMILY
  },
  {
    id: "action.add_indicator.v1",
    version: "1.0.0",
    purpose:
      "Add the selected verified indicator to the flask through the existing one-time engine action.",
    engineActionType: "select_indicator",
    actorComponentIds: ["component.erlenmeyer_flask.v1"],
    targetComponentIds: ["component.erlenmeyer_flask.v1"],
    requiredReagentRoleIds: ["indicator"],
    parameters: [
      {
        key: "indicator",
        valueType: "enum",
        required: true,
        allowedValues: ["phenolphthalein", "bromothymol_blue", "methyl_orange"]
      }
    ],
    emittedSemanticEventTypes: ["select_indicator"],
    compatibleEngineIds: ENGINE,
    compatibleFamilyIds: FAMILY
  },
  {
    id: "action.dispense.v1",
    version: "1.0.0",
    purpose:
      "Deliver a bounded titrant volume over a positive duration through the burette stopcock.",
    engineActionType: "add_titrant",
    actorComponentIds: ["component.burette.v1"],
    targetComponentIds: ["component.erlenmeyer_flask.v1"],
    requiredReagentRoleIds: ["titrant"],
    parameters: [
      {
        key: "volumeML",
        valueType: "number",
        required: true,
        unitId: "unit.ml.v1",
        minimum: 0.01,
        maximum: 50,
        authoredMaximumKey: "maxVolumeMLPerAction"
      },
      {
        key: "durationS",
        valueType: "number",
        required: true,
        minimum: 0.01,
        maximum: 600
      }
    ],
    emittedSemanticEventTypes: ["add_titrant"],
    compatibleEngineIds: ENGINE,
    compatibleFamilyIds: FAMILY
  },
  {
    id: "action.read_volume.v1",
    version: "1.0.0",
    purpose:
      "Record the bottom of the burette meniscus to its supported precision.",
    engineActionType: "read_meniscus",
    actorComponentIds: ["component.burette.v1"],
    targetComponentIds: [],
    requiredReagentRoleIds: [],
    parameters: [
      {
        key: "reportedML",
        valueType: "number",
        required: true,
        unitId: "unit.ml.v1",
        minimum: 0,
        maximum: 50
      }
    ],
    emittedSemanticEventTypes: ["read_meniscus"],
    compatibleEngineIds: ENGINE,
    compatibleFamilyIds: FAMILY
  }
] as const satisfies readonly ActionRegistryEntry[];
