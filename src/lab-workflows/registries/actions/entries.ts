import type { ActionRegistryEntry } from "./types";
import {
  ADD_INDICATOR_ACTION_PARAMETERS,
  DISPENSE_ACTION_PARAMETERS,
  FILL_ACTION_PARAMETERS,
  READ_VOLUME_ACTION_PARAMETERS,
  RINSE_ACTION_PARAMETERS,
  SELECT_INDICATOR_ACTION_PARAMETERS
} from "./parameterSchemas";

const ENGINE = ["engine.titration.v1"] as const;
const FAMILY = ["family.acid_base_titration.v1"] as const;
const SOURCE_ONLY_ERRORS = [
  "action-error.parameters_invalid.v1",
  "action-error.source_capability_missing.v1",
  "action-error.mechanical_adapter_unavailable.v1"
] as const;
const CONNECTION_ERRORS = [
  "action-error.parameters_invalid.v1",
  "action-error.source_capability_missing.v1",
  "action-error.target_capability_missing.v1",
  "action-error.precondition_failed.v1",
  "action-error.mechanical_adapter_unavailable.v1"
] as const;

export const ACTION_REGISTRY_ENTRIES = [
  {
    id: "action.rinse.v1",
    version: "1.0.0",
    purpose: "Rinse the empty burette with water or the verified titrant.",
    engineActionType: "rinse_burette",
    actorComponentIds: ["component.burette.v1", "component.reagent_bottle.v1"],
    targetComponentIds: ["component.burette.v1"],
    requiredSourceCapabilityIds: ["capability.contain_liquid.v1"],
    requiredTargetCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.receive_liquid.v1",
      "capability.rinse.v1"
    ],
    parameterSchemaId: "schema.action_parameters.rinse.v1",
    preconditionIds: ["precondition.equipment.burette_empty_before_rinse.v1"],
    possibleErrorCodes: CONNECTION_ERRORS,
    mechanicalAdapterId: "mechanical-adapter.burette.v1",
    emittedEventContractId: "event-contract.rinse_burette.v1",
    behavior: "discrete",
    requiredReagentRoleIds: [],
    parameters: RINSE_ACTION_PARAMETERS,
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
    requiredSourceCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.dispense_liquid.v1"
    ],
    requiredTargetCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.receive_liquid.v1"
    ],
    parameterSchemaId: "schema.action_parameters.fill.v1",
    preconditionIds: ["precondition.equipment.burette_capacity_available.v1"],
    possibleErrorCodes: CONNECTION_ERRORS,
    mechanicalAdapterId: "mechanical-adapter.burette.v1",
    emittedEventContractId: "event-contract.fill_burette.v1",
    behavior: "discrete",
    requiredReagentRoleIds: ["titrant"],
    parameters: FILL_ACTION_PARAMETERS,
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
    requiredSourceCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.dispense_liquid.v1"
    ],
    requiredTargetCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.receive_liquid.v1"
    ],
    parameterSchemaId: "schema.action_parameters.select_indicator.v1",
    preconditionIds: ["precondition.equipment.indicator_not_added.v1"],
    possibleErrorCodes: CONNECTION_ERRORS,
    mechanicalAdapterId: "mechanical-adapter.indicator_bottle.v1",
    emittedEventContractId: "event-contract.select_indicator.v1",
    behavior: "discrete",
    requiredReagentRoleIds: ["indicator"],
    parameters: SELECT_INDICATOR_ACTION_PARAMETERS,
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
    requiredSourceCapabilityIds: ["capability.contain_liquid.v1"],
    requiredTargetCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.receive_liquid.v1"
    ],
    parameterSchemaId: "schema.action_parameters.add_indicator.v1",
    preconditionIds: ["precondition.equipment.indicator_not_added.v1"],
    possibleErrorCodes: CONNECTION_ERRORS,
    mechanicalAdapterId: "mechanical-adapter.erlenmeyer_flask.v1",
    emittedEventContractId: "event-contract.add_indicator_legacy.v1",
    behavior: "discrete",
    requiredReagentRoleIds: ["indicator"],
    parameters: ADD_INDICATOR_ACTION_PARAMETERS,
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
    requiredSourceCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.dispense_liquid.v1",
      "capability.measure_volume.v1"
    ],
    requiredTargetCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.receive_liquid.v1"
    ],
    parameterSchemaId: "schema.action_parameters.dispense.v1",
    preconditionIds: [
      "precondition.equipment.burette_has_liquid.v1",
      "precondition.equipment.dispense_within_available_volume.v1",
      "precondition.equipment.indicator_added.v1"
    ],
    possibleErrorCodes: CONNECTION_ERRORS,
    mechanicalAdapterId: "mechanical-adapter.burette.v1",
    emittedEventContractId: "event-contract.add_titrant.v1",
    behavior: "continuous",
    requiredReagentRoleIds: ["titrant"],
    parameters: DISPENSE_ACTION_PARAMETERS,
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
    requiredSourceCapabilityIds: ["capability.measure_volume.v1"],
    requiredTargetCapabilityIds: [],
    parameterSchemaId: "schema.action_parameters.read_volume.v1",
    preconditionIds: [],
    possibleErrorCodes: SOURCE_ONLY_ERRORS,
    mechanicalAdapterId: "mechanical-adapter.burette.v1",
    emittedEventContractId: "event-contract.read_meniscus.v1",
    behavior: "discrete",
    requiredReagentRoleIds: [],
    parameters: READ_VOLUME_ACTION_PARAMETERS,
    emittedSemanticEventTypes: ["read_meniscus"],
    compatibleEngineIds: ENGINE,
    compatibleFamilyIds: FAMILY
  }
] as const satisfies readonly ActionRegistryEntry[];
