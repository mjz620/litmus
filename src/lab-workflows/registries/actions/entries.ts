import type { ActionRegistryEntry } from "./types";
import {
  ADD_INDICATOR_ACTION_PARAMETERS,
  DISPENSE_ACTION_PARAMETERS,
  FILL_TO_MARK_ACTION_PARAMETERS,
  FILL_ACTION_PARAMETERS,
  MIX_CALORIMETER_ACTION_PARAMETERS,
  MIX_SOLUTION_ACTION_PARAMETERS,
  PLACE_THERMOMETER_ACTION_PARAMETERS,
  POUR_LIQUID_ACTION_PARAMETERS,
  READ_TEMPERATURE_ACTION_PARAMETERS,
  READ_VOLUME_ACTION_PARAMETERS,
  REMOVE_THERMOMETER_ACTION_PARAMETERS,
  RINSE_TRANSFER_DEVICE_ACTION_PARAMETERS,
  RINSE_ACTION_PARAMETERS,
  SELECT_INDICATOR_ACTION_PARAMETERS,
  SET_CALORIMETER_LID_ACTION_PARAMETERS,
  TRANSFER_LIQUID_ACTION_PARAMETERS
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
  },
  {
    id: "action.rinse_transfer_device.v1",
    version: "1.0.0",
    purpose:
      "Condition an empty volumetric transfer device with its exact source solution.",
    engineActionType: null,
    actorComponentIds: ["component.reagent_bottle.v1"],
    targetComponentIds: ["component.volumetric_pipette.v1"],
    requiredSourceCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.dispense_liquid.v1"
    ],
    requiredTargetCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.receive_liquid.v1",
      "capability.rinse.v1"
    ],
    parameterSchemaId: "schema.action_parameters.rinse_transfer_device.v1",
    preconditionIds: ["precondition.equipment.pipette_empty_before_rinse.v1"],
    possibleErrorCodes: CONNECTION_ERRORS,
    mechanicalAdapterId: "mechanical-adapter.volumetric_pipette.v1",
    emittedEventContractId: "event-contract.rinse_transfer_device.v1",
    behavior: "discrete",
    requiredReagentRoleIds: ["stock_solution"],
    parameters: RINSE_TRANSFER_DEVICE_ACTION_PARAMETERS,
    emittedSemanticEventTypes: ["rinse_transfer_device"],
    compatibleEngineIds: [],
    compatibleFamilyIds: []
  },
  {
    id: "action.transfer_liquid.v1",
    version: "1.0.0",
    purpose:
      "Move a bounded liquid volume between an exact source and compatible receiving vessel.",
    engineActionType: null,
    actorComponentIds: [
      "component.reagent_bottle.v1",
      "component.volumetric_pipette.v1"
    ],
    targetComponentIds: [
      "component.volumetric_pipette.v1",
      "component.volumetric_flask.v1"
    ],
    requiredSourceCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.dispense_liquid.v1"
    ],
    requiredTargetCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.receive_liquid.v1"
    ],
    parameterSchemaId: "schema.action_parameters.transfer_liquid.v1",
    preconditionIds: [],
    possibleErrorCodes: CONNECTION_ERRORS,
    mechanicalAdapterId: "mechanical-adapter.volumetric_pipette.v1",
    emittedEventContractId: "event-contract.transfer_liquid.v1",
    behavior: "discrete",
    requiredReagentRoleIds: ["stock_solution"],
    parameters: TRANSFER_LIQUID_ACTION_PARAMETERS,
    emittedSemanticEventTypes: ["transfer_liquid"],
    compatibleEngineIds: [],
    compatibleFamilyIds: []
  },
  {
    id: "action.fill_to_mark.v1",
    version: "1.0.0",
    purpose:
      "Add exact bound diluent until a volumetric vessel reaches the submitted final volume.",
    engineActionType: null,
    actorComponentIds: ["component.wash_bottle.v1"],
    targetComponentIds: ["component.volumetric_flask.v1"],
    requiredSourceCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.dispense_liquid.v1"
    ],
    requiredTargetCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.receive_liquid.v1",
      "capability.fill_to_mark.v1"
    ],
    parameterSchemaId: "schema.action_parameters.fill_to_mark.v1",
    preconditionIds: [],
    possibleErrorCodes: CONNECTION_ERRORS,
    mechanicalAdapterId: "mechanical-adapter.volumetric_flask.v1",
    emittedEventContractId: "event-contract.fill_to_mark.v1",
    behavior: "continuous",
    requiredReagentRoleIds: ["diluent"],
    parameters: FILL_TO_MARK_ACTION_PARAMETERS,
    emittedSemanticEventTypes: ["fill_to_mark"],
    compatibleEngineIds: [],
    compatibleFamilyIds: []
  },
  {
    id: "action.mix_solution.v1",
    version: "1.0.0",
    purpose:
      "Mechanically mix a bounded liquid preparation by flask inversion.",
    engineActionType: null,
    actorComponentIds: ["component.volumetric_flask.v1"],
    targetComponentIds: [],
    requiredSourceCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.mix.v1"
    ],
    requiredTargetCapabilityIds: [],
    parameterSchemaId: "schema.action_parameters.mix_solution.v1",
    preconditionIds: ["precondition.equipment.volumetric_flask_has_liquid.v1"],
    possibleErrorCodes: SOURCE_ONLY_ERRORS,
    mechanicalAdapterId: "mechanical-adapter.volumetric_flask.v1",
    emittedEventContractId: "event-contract.mix_solution.v1",
    behavior: "discrete",
    requiredReagentRoleIds: [],
    parameters: MIX_SOLUTION_ACTION_PARAMETERS,
    emittedSemanticEventTypes: ["mix_solution"],
    compatibleEngineIds: [],
    compatibleFamilyIds: []
  },
  {
    id: "action.pour_liquid.v1",
    version: "1.0.0",
    purpose:
      "Pour a bounded liquid volume from a registered source into any registered receiving vessel.",
    engineActionType: null,
    actorComponentIds: [
      "component.wash_bottle.v1",
      "component.reagent_bottle.v1"
    ],
    /*
     * No component allowlist: any vessel declaring the required capabilities
     * below can receive a pour, so glassware stays swappable between labs
     * without editing this entry to name each new one.
     */
    targetComponentIds: [],
    requiredSourceCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.dispense_liquid.v1"
    ],
    requiredTargetCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.receive_liquid.v1"
    ],
    parameterSchemaId: "schema.action_parameters.pour_liquid.v1",
    preconditionIds: [],
    possibleErrorCodes: CONNECTION_ERRORS,
    mechanicalAdapterId: "mechanical-adapter.calorimeter.v1",
    emittedEventContractId: "event-contract.pour_liquid.v1",
    behavior: "discrete",
    requiredReagentRoleIds: [],
    parameters: POUR_LIQUID_ACTION_PARAMETERS,
    emittedSemanticEventTypes: ["pour_liquid"],
    compatibleEngineIds: [],
    compatibleFamilyIds: []
  },
  {
    id: "action.mix_calorimeter.v1",
    version: "1.0.0",
    purpose: "Mix the liquid contents of a coffee-cup calorimeter.",
    engineActionType: null,
    actorComponentIds: ["component.calorimeter.v1"],
    targetComponentIds: [],
    requiredSourceCapabilityIds: [
      "capability.contain_liquid.v1",
      "capability.mix.v1"
    ],
    requiredTargetCapabilityIds: [],
    parameterSchemaId: "schema.action_parameters.mix_calorimeter.v1",
    preconditionIds: ["precondition.equipment.calorimeter_has_liquid.v1"],
    possibleErrorCodes: SOURCE_ONLY_ERRORS,
    mechanicalAdapterId: "mechanical-adapter.calorimeter.v1",
    emittedEventContractId: "event-contract.mix_calorimeter.v1",
    behavior: "discrete",
    requiredReagentRoleIds: [],
    parameters: MIX_CALORIMETER_ACTION_PARAMETERS,
    emittedSemanticEventTypes: ["mix_calorimeter"],
    compatibleEngineIds: [],
    compatibleFamilyIds: []
  },
  {
    id: "action.set_calorimeter_lid.v1",
    version: "1.0.0",
    purpose: "Open or close the coffee-cup calorimeter lid.",
    engineActionType: null,
    actorComponentIds: ["component.calorimeter.v1"],
    targetComponentIds: [],
    requiredSourceCapabilityIds: ["capability.seal_lid.v1"],
    requiredTargetCapabilityIds: [],
    parameterSchemaId: "schema.action_parameters.set_calorimeter_lid.v1",
    preconditionIds: [],
    possibleErrorCodes: SOURCE_ONLY_ERRORS,
    mechanicalAdapterId: "mechanical-adapter.calorimeter.v1",
    emittedEventContractId: "event-contract.set_calorimeter_lid.v1",
    behavior: "discrete",
    requiredReagentRoleIds: [],
    parameters: SET_CALORIMETER_LID_ACTION_PARAMETERS,
    emittedSemanticEventTypes: ["set_calorimeter_lid"],
    compatibleEngineIds: [],
    compatibleFamilyIds: []
  },
  {
    id: "action.place_thermometer.v1",
    version: "1.0.0",
    purpose: "Insert a digital thermometer into a coffee-cup calorimeter.",
    engineActionType: null,
    actorComponentIds: ["component.thermometer.v1"],
    targetComponentIds: ["component.calorimeter.v1"],
    requiredSourceCapabilityIds: ["capability.measure_temperature.v1"],
    requiredTargetCapabilityIds: ["capability.accept_probe.v1"],
    parameterSchemaId: "schema.action_parameters.place_thermometer.v1",
    preconditionIds: [],
    possibleErrorCodes: CONNECTION_ERRORS,
    mechanicalAdapterId: "mechanical-adapter.thermometer.v1",
    emittedEventContractId: "event-contract.place_thermometer.v1",
    behavior: "discrete",
    requiredReagentRoleIds: [],
    parameters: PLACE_THERMOMETER_ACTION_PARAMETERS,
    emittedSemanticEventTypes: ["place_thermometer"],
    compatibleEngineIds: [],
    compatibleFamilyIds: []
  },
  {
    id: "action.remove_thermometer.v1",
    version: "1.0.0",
    purpose: "Remove a digital thermometer from its host calorimeter.",
    engineActionType: null,
    actorComponentIds: ["component.thermometer.v1"],
    targetComponentIds: [],
    requiredSourceCapabilityIds: ["capability.measure_temperature.v1"],
    requiredTargetCapabilityIds: [],
    parameterSchemaId: "schema.action_parameters.remove_thermometer.v1",
    preconditionIds: [],
    possibleErrorCodes: SOURCE_ONLY_ERRORS,
    mechanicalAdapterId: "mechanical-adapter.thermometer.v1",
    emittedEventContractId: "event-contract.remove_thermometer.v1",
    behavior: "discrete",
    requiredReagentRoleIds: [],
    parameters: REMOVE_THERMOMETER_ACTION_PARAMETERS,
    emittedSemanticEventTypes: ["remove_thermometer"],
    compatibleEngineIds: [],
    compatibleFamilyIds: []
  },
  {
    id: "action.read_temperature.v1",
    version: "1.0.0",
    purpose:
      "Record a student-reported Celsius reading from a placed thermometer.",
    engineActionType: null,
    actorComponentIds: ["component.thermometer.v1"],
    targetComponentIds: [],
    requiredSourceCapabilityIds: ["capability.measure_temperature.v1"],
    requiredTargetCapabilityIds: [],
    parameterSchemaId: "schema.action_parameters.read_temperature.v1",
    preconditionIds: [],
    possibleErrorCodes: SOURCE_ONLY_ERRORS,
    mechanicalAdapterId: "mechanical-adapter.thermometer.v1",
    emittedEventContractId: "event-contract.read_temperature.v1",
    behavior: "discrete",
    requiredReagentRoleIds: [],
    parameters: READ_TEMPERATURE_ACTION_PARAMETERS,
    emittedSemanticEventTypes: ["read_temperature"],
    compatibleEngineIds: [],
    compatibleFamilyIds: []
  }
] as const satisfies readonly ActionRegistryEntry[];
