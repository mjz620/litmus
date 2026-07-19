import { createSupportingRegistry } from "./supportingRegistry";
import type {
  ActionParameterDefinition,
  ActionParameterSchemaEntry
} from "./types";

export const RINSE_ACTION_PARAMETERS = [
  {
    key: "solvent",
    valueType: "enum",
    required: true,
    allowedValues: ["water", "titrant"]
  }
] as const satisfies readonly ActionParameterDefinition[];

export const FILL_ACTION_PARAMETERS = [
  {
    key: "volumeML",
    valueType: "number",
    required: true,
    unitId: "unit.ml.v1",
    minimum: 0.01,
    maximum: 50
  }
] as const satisfies readonly ActionParameterDefinition[];

export const SELECT_INDICATOR_ACTION_PARAMETERS = [
  {
    key: "indicator",
    valueType: "enum",
    required: true,
    allowedValues: ["phenolphthalein", "bromothymol_blue", "methyl_orange"]
  }
] as const satisfies readonly ActionParameterDefinition[];

export const ADD_INDICATOR_ACTION_PARAMETERS = [
  {
    key: "indicator",
    valueType: "enum",
    required: true,
    allowedValues: ["phenolphthalein", "bromothymol_blue", "methyl_orange"]
  }
] as const satisfies readonly ActionParameterDefinition[];

export const DISPENSE_ACTION_PARAMETERS = [
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
] as const satisfies readonly ActionParameterDefinition[];

export const READ_VOLUME_ACTION_PARAMETERS = [
  {
    key: "reportedML",
    valueType: "number",
    required: true,
    unitId: "unit.ml.v1",
    minimum: 0,
    maximum: 50
  }
] as const satisfies readonly ActionParameterDefinition[];

export const TRANSFER_LIQUID_ACTION_PARAMETERS = [
  {
    key: "volumeML",
    valueType: "number",
    required: true,
    unitId: "unit.ml.v1",
    minimum: 0.01,
    maximum: 100,
    authoredMaximumKey: "maxTransferVolumeML"
  }
] as const satisfies readonly ActionParameterDefinition[];

export const RINSE_TRANSFER_DEVICE_ACTION_PARAMETERS =
  [] as const satisfies readonly ActionParameterDefinition[];

export const FILL_TO_MARK_ACTION_PARAMETERS = [
  {
    key: "finalVolumeML",
    valueType: "number",
    required: true,
    unitId: "unit.ml.v1",
    minimum: 0.01,
    maximum: 1000,
    authoredMinimumKey: "minFinalVolumeML",
    authoredMaximumKey: "maxFinalVolumeML"
  }
] as const satisfies readonly ActionParameterDefinition[];

export const MIX_SOLUTION_ACTION_PARAMETERS = [
  {
    key: "inversions",
    valueType: "number",
    required: true,
    minimum: 1,
    maximum: 20
  }
] as const satisfies readonly ActionParameterDefinition[];

export const ACTION_PARAMETER_SCHEMA_ENTRIES = [
  {
    id: "schema.action_parameters.rinse.v1",
    version: "1.0.0",
    description:
      "Exact solvent choice accepted by the legacy burette rinse action.",
    additionalProperties: false,
    actionIds: ["action.rinse.v1"],
    parameters: RINSE_ACTION_PARAMETERS
  },
  {
    id: "schema.action_parameters.fill.v1",
    version: "1.0.0",
    description: "Bounded positive burette fill volume in milliliters.",
    additionalProperties: false,
    actionIds: ["action.fill.v1"],
    parameters: FILL_ACTION_PARAMETERS
  },
  {
    id: "schema.action_parameters.select_indicator.v1",
    version: "1.0.0",
    description:
      "Exact registered indicator choice for the legacy selection action.",
    additionalProperties: false,
    actionIds: ["action.select_indicator.v1"],
    parameters: SELECT_INDICATOR_ACTION_PARAMETERS
  },
  {
    id: "schema.action_parameters.add_indicator.v1",
    version: "1.0.0",
    description:
      "Exact registered indicator choice for the legacy combined addition action.",
    additionalProperties: false,
    actionIds: ["action.add_indicator.v1"],
    parameters: ADD_INDICATOR_ACTION_PARAMETERS
  },
  {
    id: "schema.action_parameters.dispense.v1",
    version: "1.0.0",
    description:
      "Bounded titrant delivery volume and positive delivery duration.",
    additionalProperties: false,
    actionIds: ["action.dispense.v1"],
    parameters: DISPENSE_ACTION_PARAMETERS
  },
  {
    id: "schema.action_parameters.read_volume.v1",
    version: "1.0.0",
    description: "Bounded reported burette reading in milliliters.",
    additionalProperties: false,
    actionIds: ["action.read_volume.v1"],
    parameters: READ_VOLUME_ACTION_PARAMETERS
  },
  {
    id: "schema.action_parameters.transfer_liquid.v1",
    version: "1.0.0",
    description: "Bounded positive liquid transfer volume in milliliters.",
    additionalProperties: false,
    actionIds: ["action.transfer_liquid.v1"],
    parameters: TRANSFER_LIQUID_ACTION_PARAMETERS
  },
  {
    id: "schema.action_parameters.rinse_transfer_device.v1",
    version: "1.0.0",
    description:
      "No authored parameters; the exact source material determines conditioning identity.",
    additionalProperties: false,
    actionIds: ["action.rinse_transfer_device.v1"],
    parameters: RINSE_TRANSFER_DEVICE_ACTION_PARAMETERS
  },
  {
    id: "schema.action_parameters.fill_to_mark.v1",
    version: "1.0.0",
    description:
      "Bounded observed final volume used by the registered volumetric-vessel mechanic.",
    additionalProperties: false,
    actionIds: ["action.fill_to_mark.v1"],
    parameters: FILL_TO_MARK_ACTION_PARAMETERS
  },
  {
    id: "schema.action_parameters.mix_solution.v1",
    version: "1.0.0",
    description: "Bounded positive count of volumetric-flask inversions.",
    additionalProperties: false,
    actionIds: ["action.mix_solution.v1"],
    parameters: MIX_SOLUTION_ACTION_PARAMETERS
  }
] as const satisfies readonly ActionParameterSchemaEntry[];

export const actionParameterSchemaRegistry = createSupportingRegistry(
  "action parameter schema",
  "action-parameter-schemas.2.0.0",
  ACTION_PARAMETER_SCHEMA_ENTRIES
);
