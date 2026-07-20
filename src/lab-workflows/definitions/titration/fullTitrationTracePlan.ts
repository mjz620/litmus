import type { GenericTraceSuiteCaseKind } from "../../replay";
import {
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  type NormalizedLabAction
} from "../../runtime";

export interface FullTitrationTracePlanCase {
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

const rinse = (solvent: "titrant" | "water") =>
  action(
    "permission.condition_burette",
    "action.rinse.v1",
    "titrant_bottle",
    ["titrant_burette"],
    [{ key: "solvent", valueType: "enum", value: solvent }]
  );

const fill = (volumeML: number) =>
  action(
    "permission.fill_burette",
    "action.fill.v1",
    "titrant_bottle",
    ["titrant_burette"],
    [{ key: "volumeML", valueType: "number", value: volumeML }]
  );

const addIndicator = () =>
  action(
    "permission.add_indicator",
    "action.add_indicator.v1",
    "analyte_flask",
    ["analyte_flask"],
    [{ key: "indicator", valueType: "enum", value: "phenolphthalein" }]
  );

const readBurette = (reportedML: number) =>
  action(
    "permission.read_burette",
    "action.read_volume.v1",
    "titrant_burette",
    [],
    [{ key: "reportedML", valueType: "number", value: reportedML }]
  );

const dispense = (volumeML: number, durationS: number) =>
  action(
    "permission.dispense",
    "action.dispense.v1",
    "titrant_burette",
    ["analyte_flask"],
    [
      { key: "volumeML", valueType: "number", value: volumeML },
      { key: "durationS", valueType: "number", value: durationS }
    ]
  );

/** Deliver `count` controlled additions of `volumeML` each. */
function titrate(count: number, volumeML: number, durationS = 4) {
  return Array.from({ length: count }, () => dispense(volumeML, durationS));
}

const PREPARE = [rinse("titrant"), fill(50), addIndicator()];

/**
 * Runtime conformance cases for the full titration. Static validation only
 * proves the spec is legal; these run real actions through the real runtime to
 * show the authored rules separate a correct procedure from a flawed one.
 */
export function createFullTitrationTracePlan(): readonly FullTitrationTracePlanCase[] {
  return [
    {
      // Canonical: prepare, read, then approach the endpoint under control.
      kind: "valid",
      actions: [
        ...PREPARE,
        readBurette(0),
        ...titrate(46, 0.5),
        ...titrate(21, 0.1, 6)
      ]
    },
    {
      // Rinsing with water first is wasteful, but conditioning with titrant
      // afterwards still leaves the burette fit to use, so the attempt
      // completes. It is not a `recoverable_mistake` case: that kind requires a
      // rule diagnosis to go violated and then recover, and no authored rule
      // here fails on a water rinse. The engine does raise a
      // `burette_not_conditioned` flag, so a future rule could make this a
      // genuine recoverable case rather than a stylistic variation.
      kind: "alternate_valid",
      actions: [
        rinse("water"),
        rinse("titrant"),
        fill(50),
        addIndicator(),
        readBurette(0),
        ...titrate(46, 0.5),
        ...titrate(21, 0.1, 6)
      ]
    },
    {
      // Larger early additions, slowing to dropwise near the endpoint.
      kind: "alternate_valid",
      actions: [
        ...PREPARE,
        readBurette(0),
        ...titrate(44, 0.5),
        ...titrate(31, 0.1, 6)
      ]
    }
  ];
}

/**
 * An incomplete attempt: the burette is never prepared, so nothing can be
 * delivered. Kept outside the suite because its outcome is "still in
 * progress", which the suite's case kinds do not describe.
 */
export function createUnpreparedTitrationTrace(): readonly NormalizedLabAction[] {
  return [addIndicator()];
}
