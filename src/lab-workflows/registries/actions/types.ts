import type { EquipmentCapabilityId } from "../../capabilities";
import type {
  ComponentRegistryId,
  EquipmentStateSchemaId,
  MechanicalAdapterId
} from "../components";

export type ActionRegistryId =
  | "action.add_indicator.v1"
  | "action.dispense.v1"
  | "action.fill.v1"
  | "action.fill_to_mark.v1"
  | "action.mix_solution.v1"
  | "action.read_volume.v1"
  | "action.rinse.v1"
  | "action.rinse_transfer_device.v1"
  | "action.select_indicator.v1"
  | "action.transfer_liquid.v1";

export type ActionParameterSchemaId =
  | "schema.action_parameters.add_indicator.v1"
  | "schema.action_parameters.dispense.v1"
  | "schema.action_parameters.fill.v1"
  | "schema.action_parameters.fill_to_mark.v1"
  | "schema.action_parameters.mix_solution.v1"
  | "schema.action_parameters.read_volume.v1"
  | "schema.action_parameters.rinse.v1"
  | "schema.action_parameters.rinse_transfer_device.v1"
  | "schema.action_parameters.select_indicator.v1"
  | "schema.action_parameters.transfer_liquid.v1";

export type EquipmentPreconditionId =
  | "precondition.equipment.burette_capacity_available.v1"
  | "precondition.equipment.burette_empty_before_rinse.v1"
  | "precondition.equipment.burette_has_liquid.v1"
  | "precondition.equipment.dispense_within_available_volume.v1"
  | "precondition.equipment.indicator_added.v1"
  | "precondition.equipment.indicator_not_added.v1"
  | "precondition.equipment.pipette_empty_before_rinse.v1"
  | "precondition.equipment.source_has_transfer_volume.v1"
  | "precondition.equipment.target_has_transfer_capacity.v1"
  | "precondition.equipment.volumetric_flask_has_liquid.v1";

export type LabActionErrorCode =
  | "action-error.mechanical_adapter_unavailable.v1"
  | "action-error.parameters_invalid.v1"
  | "action-error.precondition_failed.v1"
  | "action-error.source_capability_missing.v1"
  | "action-error.target_capability_missing.v1";

export type ActionEventContractId =
  | "event-contract.add_indicator_legacy.v1"
  | "event-contract.add_titrant.v1"
  | "event-contract.fill_burette.v1"
  | "event-contract.fill_to_mark.v1"
  | "event-contract.mix_solution.v1"
  | "event-contract.read_meniscus.v1"
  | "event-contract.rinse_burette.v1"
  | "event-contract.rinse_transfer_device.v1"
  | "event-contract.select_indicator.v1"
  | "event-contract.transfer_liquid.v1";

export type ActionBehavior = "continuous" | "discrete";

export interface ActionParameterDefinition {
  readonly key: string;
  readonly valueType: "enum" | "number" | "string";
  readonly required: boolean;
  readonly unitId?: "unit.ml.v1";
  readonly minimum?: number;
  readonly maximum?: number;
  readonly allowedValues?: readonly string[];
  /** Exact workflow key allowed to narrow this registered lower bound. */
  readonly authoredMinimumKey?: string;
  /** Exact workflow key allowed to narrow this registered upper bound. */
  readonly authoredMaximumKey?: string;
}

export interface ActionParameterSchemaEntry {
  readonly id: ActionParameterSchemaId;
  readonly version: "1.0.0";
  readonly description: string;
  readonly additionalProperties: false;
  readonly actionIds: readonly ActionRegistryId[];
  readonly parameters: readonly ActionParameterDefinition[];
}

export interface EquipmentPreconditionEntry {
  readonly id: EquipmentPreconditionId;
  readonly version: "1.0.0";
  readonly description: string;
  readonly equipmentRole: "source" | "target";
  readonly stateSchemaId: EquipmentStateSchemaId;
}

export interface LabActionErrorContractEntry {
  readonly id: LabActionErrorCode;
  readonly version: "1.0.0";
  readonly description: string;
  readonly failurePhase:
    | "adapter_resolution"
    | "capability_check"
    | "parameter_parse"
    | "precondition_check";
}

export interface ActionEventContractEntry {
  readonly id: ActionEventContractId;
  readonly version: "1.0.0";
  readonly description: string;
  readonly eventTypeIds: readonly string[];
}

export interface ActionRegistryEntry {
  readonly id: ActionRegistryId;
  readonly version: "1.0.0";
  readonly purpose: string;
  readonly engineActionType:
    | "add_titrant"
    | "fill_burette"
    | "read_meniscus"
    | "rinse_burette"
    | "select_indicator"
    | null;
  readonly actorComponentIds: readonly ComponentRegistryId[];
  readonly targetComponentIds: readonly ComponentRegistryId[];
  readonly requiredSourceCapabilityIds: readonly EquipmentCapabilityId[];
  readonly requiredTargetCapabilityIds: readonly EquipmentCapabilityId[];
  readonly parameterSchemaId: ActionParameterSchemaId;
  readonly preconditionIds: readonly EquipmentPreconditionId[];
  readonly possibleErrorCodes: readonly LabActionErrorCode[];
  readonly mechanicalAdapterId: MechanicalAdapterId;
  readonly emittedEventContractId: ActionEventContractId;
  readonly behavior: ActionBehavior;
  readonly requiredReagentRoleIds: readonly string[];
  /** @deprecated V1 compatibility metadata; parameterSchemaId is authoritative. */
  readonly parameters: readonly ActionParameterDefinition[];
  readonly emittedSemanticEventTypes: readonly string[];
  readonly compatibleEngineIds: readonly string[];
  readonly compatibleFamilyIds: readonly string[];
}
