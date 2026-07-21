import { ACTION_REGISTRY_ENTRIES } from "./entries";
import {
  createSupportingRegistry,
  type SupportingRegistry
} from "./supportingRegistry";
import type { ActionRegistryEntry } from "./types";

export const ACTION_REGISTRY_SNAPSHOT_ID = "actions.3.3.0" as const;
export const LEGACY_ACTION_REGISTRY_SNAPSHOT_IDS = Object.freeze([
  "actions.1.0.0",
  "actions.2.0.0",
  "actions.3.0.0",
  "actions.3.1.0",
  "actions.3.2.0"
] as const);

export const actionRegistry: SupportingRegistry<ActionRegistryEntry> =
  createSupportingRegistry(
    "action",
    ACTION_REGISTRY_SNAPSHOT_ID,
    ACTION_REGISTRY_ENTRIES
  );

export { ACTION_REGISTRY_ENTRIES } from "./entries";
export {
  ACTION_PARAMETER_SCHEMA_ENTRIES,
  actionParameterSchemaRegistry
} from "./parameterSchemas";
export {
  EQUIPMENT_PRECONDITION_ENTRIES,
  equipmentPreconditionRegistry
} from "./preconditions";
export {
  LAB_ACTION_ERROR_CONTRACT_ENTRIES,
  labActionErrorContractRegistry
} from "./errorContracts";
export {
  ACTION_EVENT_CONTRACT_ENTRIES,
  actionEventContractRegistry
} from "./eventContracts";
export {
  createSupportingRegistry,
  SupportingRegistryError
} from "./supportingRegistry";
export type {
  SupportingRegistry,
  SupportingRegistryEntry,
  SupportingRegistryErrorCode
} from "./supportingRegistry";
export type {
  ActionBehavior,
  ActionEventContractEntry,
  ActionEventContractId,
  ActionParameterDefinition,
  ActionParameterSchemaEntry,
  ActionParameterSchemaId,
  ActionRegistryEntry,
  ActionRegistryId,
  EquipmentPreconditionEntry,
  EquipmentPreconditionId,
  LabActionErrorCode,
  LabActionErrorContractEntry
} from "./types";
