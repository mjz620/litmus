import { describe, expect, it } from "vitest";

import {
  DISSOLUTION_CALORIMETRY_V2_DRAFT,
  validateDissolutionCalorimetryV2
} from "../../../src/lab-workflows/definitions/calorimetry";
import {
  createGenericLabActionTrace,
  replayGenericLabActionTrace
} from "../../../src/lab-workflows/replay";
import {
  createCapabilityGenericRuntimePorts,
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  type GenericLabState,
  type NormalizedLabAction
} from "../../../src/lab-workflows/runtime";

const CHECKED_AT = "2026-07-20T12:00:00.000Z";

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

function dissolutionActions(options: {
  readonly tare: boolean;
  readonly reportedMassG: number;
  readonly sampleMassG?: number;
}): readonly NormalizedLabAction[] {
  const sampleMassG = options.sampleMassG ?? 2.5;
  return [
    action(
      "permission.place_boat",
      "action.place_on_balance.v1",
      "weighing_boat",
      ["balance"]
    ),
    ...(options.tare
      ? [action("permission.tare", "action.tare_balance.v1", "balance", [])]
      : []),
    action(
      "permission.weigh_solid",
      "action.transfer_solid.v1",
      "solid_stock",
      ["weighing_boat"],
      [{ key: "massG", valueType: "number", value: sampleMassG }]
    ),
    action(
      "permission.read_mass",
      "action.read_balance.v1",
      "balance",
      [],
      [{ key: "reportedG", valueType: "number", value: options.reportedMassG }]
    ),
    action(
      "permission.remove_boat",
      "action.remove_from_balance.v1",
      "balance",
      []
    ),
    action(
      "permission.pour_water",
      "action.pour_liquid.v1",
      "water_source",
      ["calorimeter"],
      [{ key: "volumeML", valueType: "number", value: 100 }]
    ),
    action(
      "permission.add_solid",
      "action.transfer_solid.v1",
      "weighing_boat",
      ["calorimeter"],
      [{ key: "massG", valueType: "number", value: sampleMassG }]
    ),
    action(
      "permission.mix",
      "action.mix_calorimeter.v1",
      "calorimeter",
      [],
      [{ key: "inversions", valueType: "number", value: 10 }]
    ),
    action(
      "permission.place_probe",
      "action.place_thermometer.v1",
      "thermometer",
      ["calorimeter"]
    ),
    action(
      "permission.read_temperature",
      "action.read_temperature.v1",
      "thermometer",
      [],
      [{ key: "reportedC", valueType: "number", value: 18.2 }]
    )
  ];
}

function observable(state: GenericLabState, id: string): number {
  const match = state.chemistry.observables.find(
    ({ observableId }) => observableId === id
  );
  if (!match || typeof match.value !== "number") {
    throw new Error(`Missing numeric observable ${id}`);
  }
  return match.value;
}

function replay(options: {
  readonly tare: boolean;
  readonly reportedMassG: number;
  readonly sampleMassG?: number;
}) {
  const workflow = validateDissolutionCalorimetryV2(CHECKED_AT);
  return replayGenericLabActionTrace(
    createGenericLabActionTrace({
      traceId: `trace.dissolution.${options.tare ? "tared" : "untared"}.${options.sampleMassG ?? 2.5}`,
      sessionId: `dissolution-${options.tare ? "tared" : "untared"}`,
      sessionSeed: "lc2-913-dissolution-seed",
      workflow,
      actions: dissolutionActions(options)
    }),
    { workflow, ports: createCapabilityGenericRuntimePorts(workflow) }
  );
}

describe("LC2-913 dissolution calorimetry definition", () => {
  it("validates as a runnable workflow over registered mass and thermal primitives", () => {
    expect(DISSOLUTION_CALORIMETRY_V2_DRAFT.metadata.tags).toContain(
      "Purdue Chemistry demonstration 21.3"
    );
    const workflow = validateDissolutionCalorimetryV2(CHECKED_AT);
    expect(workflow.validation).toMatchObject({
      runnable: true,
      previewEligible: true,
      status: "runnable"
    });
    expect(
      workflow.materials.map(({ materialProfileId }) => materialProfileId)
    ).toContain("reagent.ammonium_nitrate_solid.v1");
  });

  it("executes a complete tared weighing and mass-derived endothermic dissolution", () => {
    const result = replay({ tare: true, reportedMassG: 2.5 });

    expect(result.finalState.workflowStatus).toBe("completed");
    expect(
      observable(result.finalState, "observable.calorimeter_temperature_c.v1")
    ).toBeCloseTo(18.152, 3);
    expect(
      observable(result.finalState, "observable.reacted_amount_mol.v1")
    ).toBeCloseTo(2.5 / 80.0434, 8);
    expect(
      observable(
        result.finalState,
        "observable.measured_molar_enthalpy_kj_per_mol.v1"
      )
    ).toBe(25.7);
    expect(
      observable(result.finalState, "observable.reaction_heat_j.v1")
    ).toBeGreaterThan(0);
    const beforeDissolutionHeatJ = observable(
      result.states[6]!,
      "observable.calorimeter_heat_content_j.v1"
    );
    const afterDissolutionHeatJ = observable(
      result.states[7]!,
      "observable.calorimeter_heat_content_j.v1"
    );
    const reactionHeatJ = observable(
      result.states[7]!,
      "observable.reaction_heat_j.v1"
    );
    expect(
      afterDissolutionHeatJ - beforeDissolutionHeatJ + reactionHeatJ
    ).toBeCloseTo(0, 6);

    const solid = result.finalState.materialLedger.materials.find(
      ({ materialInstanceId }) => materialInstanceId === "ammonium_nitrate"
    )!;
    expect(
      solid.locations.reduce((total, location) => total + location.amount, 0)
    ).toBe(2.5);
    expect(solid.locations).toEqual([
      { equipmentInstanceId: "calorimeter", amount: 2.5 }
    ]);
    expect(
      observable(result.finalState, "observable.calorimeter_volume_ml.v1")
    ).toBe(100);

    expect(replay({ tare: true, reportedMassG: 2.5 }).finalState).toEqual(
      result.finalState
    );
  });

  it("keeps an untared reading as a visible technique error that changes molar enthalpy", () => {
    const result = replay({ tare: false, reportedMassG: 4.5 });
    const balance = result.finalState.equipment.find(
      ({ instanceId }) => instanceId === "balance"
    )!;

    expect(balance.fields).toContainEqual({ key: "lastReportedG", value: 4.5 });
    expect(
      observable(
        result.finalState,
        "observable.measured_molar_enthalpy_kj_per_mol.v1"
      )
    ).toBeCloseTo(25.7 * (2.5 / 4.5), 3);
    expect(
      result.finalState.diagnoses.find(
        ({ ruleId }) => ruleId === "rule.tare_before_weigh"
      )
    ).toMatchObject({ status: "violated", recoverable: false });
  });

  it("changes temperature with weighed mass while preserving molar enthalpy", () => {
    const smaller = replay({
      tare: true,
      reportedMassG: 1.25,
      sampleMassG: 1.25
    });
    const standard = replay({ tare: true, reportedMassG: 2.5 });

    expect(
      observable(smaller.finalState, "observable.calorimeter_temperature_c.v1")
    ).toBeGreaterThan(
      observable(standard.finalState, "observable.calorimeter_temperature_c.v1")
    );
    expect(
      observable(
        smaller.finalState,
        "observable.measured_molar_enthalpy_kj_per_mol.v1"
      )
    ).toBe(25.7);
  });

  it("quantizes only the balance reading while retaining exact ledger mass", () => {
    const result = replay({
      tare: true,
      reportedMassG: 2.47,
      sampleMassG: 2.473
    });
    const readState = result.states[4]!;
    const balance = readState.equipment.find(
      ({ instanceId }) => instanceId === "balance"
    )!;
    const solid = result.finalState.materialLedger.materials.find(
      ({ materialInstanceId }) => materialInstanceId === "ammonium_nitrate"
    )!;

    expect(balance.fields).toContainEqual({
      key: "currentReadingG",
      value: 2.47
    });
    expect(balance.fields).toContainEqual({
      key: "lastReportedG",
      value: 2.47
    });
    expect(solid.locations).toEqual([
      { equipmentInstanceId: "calorimeter", amount: 2.473 },
      { equipmentInstanceId: "solid_stock", amount: 0.027 }
    ]);
  });
});
