import type { GenericTraceSuiteCaseKind } from "../../replay";
import {
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  type NormalizedLabAction
} from "../../runtime";

export interface EndpointDrillTracePlanCase {
  readonly kind: GenericTraceSuiteCaseKind;
  readonly actions: readonly NormalizedLabAction[];
}

/**
 * The drill's bench is seeded mid-procedure by
 * `seed.titration.near_endpoint_22ml.v1`: conditioned, indicator committed,
 * and 22.00 mL already delivered. Equivalence is 25.00 mL and the authored
 * `native.rule.endpoint_volume_tolerance` accepts exactly 25.10 mL, so every
 * completing case has to land on that reading rather than merely stop near it.
 */
const SEEDED_DELIVERED_ML = 22;
const TARGET_READING_ML = 25.1;

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

const readBurette = (reportedML: number) =>
  action(
    "migration.permission.s1.a1",
    "action.read_volume.v1",
    "titrant_burette",
    [],
    [{ key: "reportedML", valueType: "number", value: reportedML }]
  );

/*
 * Delivery stays under the model's 0.5 mL/s fast-rate threshold: the whole
 * drill sits inside the near-endpoint window, where a quicker addition earns
 * a control flag that has nothing to do with the mistake a case is written
 * to demonstrate.
 */
const dispense = (volumeML: number, durationS = 4) =>
  action(
    "migration.permission.s2.a1",
    "action.dispense.v1",
    "titrant_burette",
    ["analyte_flask"],
    [
      { key: "volumeML", valueType: "number", value: volumeML },
      { key: "durationS", valueType: "number", value: durationS }
    ]
  );

/** `count` additions of `volumeML`, the authored per-action ceiling being 0.5 mL. */
function titrate(count: number, volumeML: number, durationS = 4) {
  return Array.from({ length: count }, () => dispense(volumeML, durationS));
}

/** Additions that carry the burette from the seeded reading to the target. */
function approachEndpoint(
  coarseCount: number,
  coarseML: number,
  fineML: number,
  fineDurationS = 6
): readonly NormalizedLabAction[] {
  const coarse = titrate(coarseCount, coarseML);
  const remainingML =
    TARGET_READING_ML - SEEDED_DELIVERED_ML - coarseCount * coarseML;
  const fineCount = Math.round(remainingML / fineML);
  return [...coarse, ...titrate(fineCount, fineML, fineDurationS)];
}

/**
 * Runtime conformance cases for the capability-native endpoint drill. Static
 * validation only proves the spec is legal; these run real actions through the
 * real runtime so the teaching review can see the authored rules separate a
 * controlled approach from an overshoot.
 */
export function createEndpointDrillTracePlan(): readonly EndpointDrillTracePlanCase[] {
  return [
    {
      // Canonical: record the meniscus, then close on the endpoint, easing to
      // dropwise for the last stretch.
      kind: "valid",
      actions: [
        readBurette(SEEDED_DELIVERED_ML),
        ...approachEndpoint(6, 0.5, 0.1)
      ]
    },
    {
      /*
       * Delivers first and records the meniscus afterwards. The drill accepts
       * either order — the reading only has to be the one actually on the
       * burette when it is taken — so this is a second correct procedure
       * rather than a mistake.
       */
      kind: "alternate_valid",
      actions: [
        dispense(0.5),
        readBurette(SEEDED_DELIVERED_ML + 0.5),
        ...titrate(5, 0.5),
        dispense(0.1, 6)
      ]
    },
    {
      /*
       * Rushes the first additions at the burette's full open rate while
       * already inside the near-endpoint window, leaving the required endpoint
       * volume unmet, then slows down and lands on it. The attempt completes,
       * so the hurried approach is recorded as evidence rather than ending
       * the run.
       */
      kind: "recoverable_mistake",
      actions: [
        readBurette(SEEDED_DELIVERED_ML),
        ...titrate(2, 0.5, 0.5),
        ...titrate(4, 0.5),
        dispense(0.1, 6)
      ]
    },
    {
      // Runs straight past equivalence. Past the 0.3 mL overshoot tolerance
      // the engine raises the overshoot flag, and the authored terminal rule
      // ends the attempt.
      kind: "terminal_mistake",
      actions: [readBurette(SEEDED_DELIVERED_ML), ...titrate(7, 0.5)]
    },
    {
      /*
       * Arrives on the inclusive edge of the accepted endpoint volume with a
       * full 0.5 mL addition as the final step — the largest jump the drill
       * permits, and the least margin for error that still counts as landing
       * on the endpoint.
       */
      kind: "tolerance_boundary",
      actions: [
        readBurette(SEEDED_DELIVERED_ML),
        ...titrate(5, 0.5),
        dispense(0.1, 6),
        dispense(0.5)
      ]
    }
  ];
}
