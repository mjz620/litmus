import { describe, expect, it } from "vitest";

import {
  MATERIAL_LEDGER_ERROR_CODES as ERROR,
  MaterialLedgerError,
  applyExecutedMaterialAction,
  createMaterialTransfer,
  initializeMaterialLedger,
  materialAmountAt,
  validateMaterialLedger,
  volumeAt
} from "../../../src/lab-workflows/chemistry-models/material-ledger";

const CAPACITIES = [
  { equipmentInstanceId: "source", capacityML: null },
  { equipmentInstanceId: "target", capacityML: 50 }
] as const;

function ledger() {
  return initializeMaterialLedger([
    {
      materialInstanceId: "material.water",
      materialProfileId: "reagent.distilled_water.v1",
      materialVersion: "1.0.0",
      containerInstanceId: "source",
      amount: 50,
      unitId: "unit.ml.v1"
    }
  ]);
}

function expectLedgerError(
  run: () => unknown,
  code: MaterialLedgerError["code"]
): void {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(MaterialLedgerError);
    expect(error).toMatchObject({ code });
    return;
  }
  throw new Error(`Expected ${code}`);
}

function transfer(amount: number) {
  const initial = ledger();
  const delta = createMaterialTransfer(initial, {
    materialInstanceId: "material.water",
    sourceEquipmentInstanceId: "source",
    targetEquipmentInstanceId: "target",
    amount,
    unitId: "unit.ml.v1"
  });
  return {
    initial,
    action: {
      actionId: "action.fill.v1",
      sourceEquipmentInstanceId: "source",
      targetEquipmentInstanceIds: ["target"],
      materialInstanceIds: ["material.water"],
      transfers: [delta]
    }
  } as const;
}

describe("material ledger and volume conservation", () => {
  it("initializes exact quantities and applies immutable, deterministic split transfers", () => {
    const { initial, action } = transfer(12.34);
    const before = structuredClone(initial);
    const first = applyExecutedMaterialAction(initial, action, CAPACITIES);
    const second = applyExecutedMaterialAction(ledger(), action, CAPACITIES);

    expect(initial).toEqual(before);
    expect(first).toEqual(second);
    expect(first.materials[0]).toMatchObject({
      initialAmount: 50,
      unitId: "unit.ml.v1",
      locations: [
        { equipmentInstanceId: "source", amount: 37.66 },
        { equipmentInstanceId: "target", amount: 12.34 }
      ]
    });
    expect(
      first.materials[0]!.locations.reduce(
        (total, location) => total + location.amount,
        0
      )
    ).toBe(50);
    expect(volumeAt(first, "target")).toBe(12.34);
  });

  it("accepts exact source depletion and exact target capacity", () => {
    const { initial, action } = transfer(50);
    const next = applyExecutedMaterialAction(initial, action, CAPACITIES);

    expect(materialAmountAt(next, "material.water", "source")).toBe(0);
    expect(materialAmountAt(next, "material.water", "target")).toBe(50);
    expect(next.materials[0]!.locations).toEqual([
      { equipmentInstanceId: "target", amount: 50 }
    ]);
  });

  it("rejects empty sources, over-capacity targets, unknown locations, and self-transfers", () => {
    const { initial, action } = transfer(50);
    const depleted = applyExecutedMaterialAction(initial, action, CAPACITIES);

    expectLedgerError(
      () =>
        createMaterialTransfer(depleted, {
          materialInstanceId: "material.water",
          sourceEquipmentInstanceId: "source",
          targetEquipmentInstanceId: "target",
          amount: 0.01,
          unitId: "unit.ml.v1"
        }),
      ERROR.sourceUnavailable
    );

    const nearlyFull = validateMaterialLedger({
      schemaVersion: "1.0.0",
      materials: [
        {
          materialInstanceId: "material.water",
          materialProfileId: "reagent.distilled_water.v1",
          materialVersion: "1.0.0",
          unitId: "unit.ml.v1",
          initialAmount: 99,
          locations: [
            { equipmentInstanceId: "source", amount: 50 },
            { equipmentInstanceId: "target", amount: 49 }
          ]
        }
      ]
    });
    const overDelta = createMaterialTransfer(nearlyFull, {
      materialInstanceId: "material.water",
      sourceEquipmentInstanceId: "source",
      targetEquipmentInstanceId: "target",
      amount: 2,
      unitId: "unit.ml.v1"
    });
    expectLedgerError(
      () =>
        applyExecutedMaterialAction(
          nearlyFull,
          {
            actionId: "action.fill.v1",
            sourceEquipmentInstanceId: "source",
            targetEquipmentInstanceIds: ["target"],
            materialInstanceIds: ["material.water"],
            transfers: [overDelta]
          },
          CAPACITIES
        ),
      ERROR.targetCapacityExceeded
    );

    const valid = transfer(1).action;
    expectLedgerError(
      () => applyExecutedMaterialAction(initial, valid, [CAPACITIES[0]!]),
      ERROR.unknownLocation
    );
    expect(() =>
      createMaterialTransfer(initial, {
        materialInstanceId: "material.water",
        sourceEquipmentInstanceId: "source",
        targetEquipmentInstanceId: "source",
        amount: 1,
        unitId: "unit.ml.v1"
      })
    ).toThrow(MaterialLedgerError);
  });

  it("rejects negative, non-finite, over-precision, duplicate, and nonconserved quantities", () => {
    for (const amount of [
      -1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      1.0000001
    ]) {
      expect(() =>
        initializeMaterialLedger([
          {
            materialInstanceId: "material.invalid",
            materialProfileId: "reagent.distilled_water.v1",
            materialVersion: "1.0.0",
            containerInstanceId: "source",
            amount,
            unitId: "unit.ml.v1"
          }
        ])
      ).toThrow(MaterialLedgerError);
    }

    const initial = ledger();
    const mismatched = transfer(1).action;
    expectLedgerError(
      () =>
        applyExecutedMaterialAction(
          initial,
          { ...mismatched, materialInstanceIds: ["material.other"] },
          CAPACITIES
        ),
      ERROR.invalidLedger
    );
    expectLedgerError(
      () =>
        validateMaterialLedger({
          ...initial,
          materials: [...initial.materials, initial.materials[0]]
        }),
      ERROR.invalidLedger
    );
    expectLedgerError(
      () =>
        validateMaterialLedger({
          ...initial,
          materials: [
            {
              ...initial.materials[0]!,
              initialAmount: 49
            }
          ]
        }),
      ERROR.conservationViolation
    );
  });

  it("conserves drop-count materials without treating drops as container volume", () => {
    const drops = initializeMaterialLedger([
      {
        materialInstanceId: "material.indicator",
        materialProfileId: "reagent.phenolphthalein.v1",
        materialVersion: "1.0.0",
        containerInstanceId: "source",
        amount: 2,
        unitId: "unit.drop.v1"
      }
    ]);
    const delta = createMaterialTransfer(drops, {
      materialInstanceId: "material.indicator",
      sourceEquipmentInstanceId: "source",
      targetEquipmentInstanceId: "target",
      amount: 1,
      unitId: "unit.drop.v1"
    });
    const next = applyExecutedMaterialAction(
      drops,
      {
        actionId: "action.test_indicator.v1",
        sourceEquipmentInstanceId: "source",
        targetEquipmentInstanceIds: ["target"],
        materialInstanceIds: ["material.indicator"],
        transfers: [delta]
      },
      CAPACITIES
    );

    expect(materialAmountAt(next, "material.indicator", "source")).toBe(1);
    expect(materialAmountAt(next, "material.indicator", "target")).toBe(1);
    expect(volumeAt(next, "target")).toBe(0);
  });
});
