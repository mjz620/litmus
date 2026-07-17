import { createSupportingRegistry } from "./supportingRegistry";
import type { EquipmentPreconditionEntry } from "./types";

export const EQUIPMENT_PRECONDITION_ENTRIES = [
  {
    id: "precondition.equipment.burette_empty_before_rinse.v1",
    version: "1.0.0",
    description:
      "The burette has no available liquid and filling has not begun.",
    equipmentRole: "target",
    stateSchemaId: "schema.equipment_state.burette.v1"
  },
  {
    id: "precondition.equipment.burette_capacity_available.v1",
    version: "1.0.0",
    description:
      "The requested fill fits within the burette's remaining capacity.",
    equipmentRole: "target",
    stateSchemaId: "schema.equipment_state.burette.v1"
  },
  {
    id: "precondition.equipment.indicator_not_added.v1",
    version: "1.0.0",
    description:
      "The receiving flask has not already received its one indicator addition.",
    equipmentRole: "target",
    stateSchemaId: "schema.equipment_state.erlenmeyer_flask.v1"
  },
  {
    id: "precondition.equipment.burette_has_liquid.v1",
    version: "1.0.0",
    description:
      "The source burette contains a positive available liquid volume.",
    equipmentRole: "source",
    stateSchemaId: "schema.equipment_state.burette.v1"
  },
  {
    id: "precondition.equipment.dispense_within_available_volume.v1",
    version: "1.0.0",
    description:
      "The requested delivery does not exceed liquid available in the source burette.",
    equipmentRole: "source",
    stateSchemaId: "schema.equipment_state.burette.v1"
  },
  {
    id: "precondition.equipment.indicator_added.v1",
    version: "1.0.0",
    description: "The receiving flask already contains one selected indicator.",
    equipmentRole: "target",
    stateSchemaId: "schema.equipment_state.erlenmeyer_flask.v1"
  }
] as const satisfies readonly EquipmentPreconditionEntry[];

export const equipmentPreconditionRegistry = createSupportingRegistry(
  "equipment precondition",
  "equipment-preconditions.1.0.0",
  EQUIPMENT_PRECONDITION_ENTRIES
);
