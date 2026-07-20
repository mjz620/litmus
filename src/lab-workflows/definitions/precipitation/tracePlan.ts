import type { GenericTraceSuiteCaseKind } from "../../replay";
import {
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  type NormalizedLabAction
} from "../../runtime";

export interface PrecipitationTracePlanCase {
  readonly kind: GenericTraceSuiteCaseKind;
  readonly actions: readonly NormalizedLabAction[];
}

function action(
  permissionId: string,
  sourceEquipmentInstanceId: string,
  volumeML: number
): NormalizedLabAction {
  return {
    schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
    permissionId,
    actionId: "action.pour_liquid.v1",
    sourceEquipmentInstanceId,
    targetEquipmentInstanceIds: ["mixing_beaker"],
    parameters: [{ key: "volumeML", valueType: "number", value: volumeML }]
  };
}

const pourSilver = (volumeML: number) =>
  action("permission.pour_silver", "silver_bottle", volumeML);
const pourChloride = (volumeML: number) =>
  action("permission.pour_chloride", "chloride_bottle", volumeML);

/**
 * Runtime conformance cases for the precipitation workflow. These prove the
 * authored rules actually separate a correct run from an incomplete one — a
 * spec that validates statically can still fail to distinguish them.
 *
 * There is deliberately no `recoverable_mistake` or `terminal_mistake` case.
 * Both require a rule *diagnosis* to go violated (then recover, or end the
 * attempt), and this workflow's only rules are two required pours: a student
 * either performs them or has not performed them yet. Nothing here can be done
 * wrongly, only incompletely. Fabricating those cases would mean inventing a
 * rule the lab does not need. The incomplete run is covered separately, by
 * asserting it does not complete and forms no precipitate.
 */
export function createPrecipitationTracePlan(): readonly PrecipitationTracePlanCase[] {
  return [
    {
      // Canonical run.
      kind: "valid",
      actions: [pourSilver(20), pourChloride(20)]
    },
    {
      // Reverse order. Precipitation has no required sequence — combining the
      // same two solutions gives the same product either way.
      kind: "alternate_valid",
      actions: [pourChloride(20), pourSilver(20)]
    },
    {
      // Several small pours rather than one, still reaching both solutions.
      kind: "alternate_valid",
      actions: [pourSilver(5), pourSilver(15), pourChloride(20)]
    },
    {
      // Minimum authored volumes still produce the same deterministic product.
      kind: "tolerance_boundary",
      actions: [pourSilver(1), pourChloride(1)]
    }
  ];
}

/**
 * An incomplete attempt: only one solution ever reaches the beaker, so no
 * precipitate can form. Kept outside the suite because its outcome is
 * "still in progress", which the suite's case kinds do not describe.
 */
export function createIncompletePrecipitationTrace(): readonly NormalizedLabAction[] {
  return [pourSilver(20)];
}
