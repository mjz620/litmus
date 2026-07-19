import type { GenericTraceSuiteCaseKind } from "../../replay";
import {
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  type NormalizedLabAction
} from "../../runtime";

export interface SolutionPreparationTracePlanCase {
  readonly kind: GenericTraceSuiteCaseKind;
  readonly actions: readonly NormalizedLabAction[];
}

function action(
  permissionId: string,
  actionId: string,
  sourceEquipmentInstanceId: string,
  targetEquipmentInstanceIds: readonly string[],
  parameters: NormalizedLabAction["parameters"] = []
): NormalizedLabAction {
  return {
    schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
    permissionId,
    actionId,
    sourceEquipmentInstanceId,
    targetEquipmentInstanceIds: [...targetEquipmentInstanceIds],
    parameters: parameters.map((parameter) => ({ ...parameter }))
  };
}

const conditionPipette = () =>
  action(
    "permission.condition_pipette",
    "action.rinse_transfer_device.v1",
    "stock_bottle",
    ["transfer_pipette"]
  );
const aspirateStock = (volumeML: number) =>
  action(
    "permission.aspirate_stock",
    "action.transfer_liquid.v1",
    "stock_bottle",
    ["transfer_pipette"],
    [{ key: "volumeML", valueType: "number", value: volumeML }]
  );
const deliverAliquot = (volumeML: number) =>
  action(
    "permission.deliver_aliquot",
    "action.transfer_liquid.v1",
    "transfer_pipette",
    ["preparation_flask"],
    [{ key: "volumeML", valueType: "number", value: volumeML }]
  );
const fillToMark = (finalVolumeML: number) =>
  action(
    "permission.fill_to_mark",
    "action.fill_to_mark.v1",
    "water_bottle",
    ["preparation_flask"],
    [{ key: "finalVolumeML", valueType: "number", value: finalVolumeML }]
  );
const mixSolution = (inversions = 10) =>
  action(
    "permission.mix_solution",
    "action.mix_solution.v1",
    "preparation_flask",
    [],
    [{ key: "inversions", valueType: "number", value: inversions }]
  );

/**
 * Fixed runtime exercise inputs for the checked solution-preparation
 * capability. These are actions executed by the real coordinator, never
 * expected model outcomes or chemistry calculations.
 */
export function createSolutionPreparationTracePlan(): readonly SolutionPreparationTracePlanCase[] {
  return [
    {
      kind: "valid",
      actions: [
        conditionPipette(),
        aspirateStock(10),
        deliverAliquot(10),
        fillToMark(100),
        mixSolution()
      ]
    },
    {
      kind: "alternate_valid",
      actions: [
        conditionPipette(),
        aspirateStock(5),
        deliverAliquot(5),
        aspirateStock(5),
        deliverAliquot(5),
        fillToMark(100),
        mixSolution()
      ]
    },
    {
      kind: "recoverable_mistake",
      actions: [
        conditionPipette(),
        aspirateStock(10),
        deliverAliquot(10),
        fillToMark(99.91),
        fillToMark(100),
        mixSolution()
      ]
    },
    { kind: "terminal_mistake", actions: [fillToMark(90)] },
    {
      kind: "tolerance_boundary",
      actions: [
        conditionPipette(),
        aspirateStock(10),
        deliverAliquot(10),
        fillToMark(99.92),
        mixSolution()
      ]
    }
  ];
}
