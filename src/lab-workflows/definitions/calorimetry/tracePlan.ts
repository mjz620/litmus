import type { GenericTraceSuiteCaseKind } from "../../replay";
import {
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  type NormalizedLabAction
} from "../../runtime";

export interface CalorimetryTracePlanCase {
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

const pourCold = (volumeML: number) =>
  action(
    "permission.pour_cold",
    "action.pour_liquid.v1",
    "cold_bottle",
    ["calorimeter"],
    [{ key: "volumeML", valueType: "number", value: volumeML }]
  );
const pourHot = (volumeML: number) =>
  action(
    "permission.pour_hot",
    "action.pour_liquid.v1",
    "hot_bottle",
    ["calorimeter"],
    [{ key: "volumeML", valueType: "number", value: volumeML }]
  );
const mix = (inversions = 10) =>
  action(
    "permission.mix_calorimeter",
    "action.mix_calorimeter.v1",
    "calorimeter",
    [],
    [{ key: "inversions", valueType: "number", value: inversions }]
  );
const placeProbe = () =>
  action(
    "permission.place_probe",
    "action.place_thermometer.v1",
    "thermometer",
    ["calorimeter"]
  );
const readTemperature = (reportedC = 39.3) =>
  action(
    "permission.read_temperature",
    "action.read_temperature.v1",
    "thermometer",
    [],
    [{ key: "reportedC", valueType: "number", value: reportedC }]
  );

/**
 * Fixed runtime exercise inputs for the checked coffee-cup calorimetry
 * capability. Actions are executed by the real coordinator; chemistry outcomes
 * are asserted separately from this plan.
 */
export function createCalorimetryTracePlan(): readonly CalorimetryTracePlanCase[] {
  return [
    {
      kind: "valid",
      actions: [
        pourCold(50),
        pourHot(50),
        mix(),
        placeProbe(),
        readTemperature()
      ]
    },
    {
      kind: "alternate_valid",
      actions: [
        pourHot(50),
        pourCold(50),
        mix(),
        placeProbe(),
        readTemperature()
      ]
    },
    {
      kind: "recoverable_mistake",
      actions: [
        pourCold(50),
        pourHot(40),
        pourHot(10),
        mix(),
        placeProbe(),
        readTemperature()
      ]
    },
    {
      kind: "terminal_mistake",
      actions: [pourCold(50), mix()]
    },
    {
      kind: "tolerance_boundary",
      actions: [
        pourCold(50),
        pourHot(50),
        mix(),
        placeProbe(),
        readTemperature()
      ]
    }
  ];
}
