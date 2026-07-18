import {
  MATERIAL_LEDGER_ERROR_CODES as ERROR,
  MaterialLedgerError
} from "./errors";
import { executedMaterialActionSchema, materialLedgerSchema } from "./schemas";
import {
  MATERIAL_LEDGER_SCHEMA_VERSION,
  type ExecutedMaterialAction,
  type ExecutedMaterialTransfer,
  type InitialMaterialLedgerBinding,
  type MaterialContainerCapacity,
  type MaterialLedger,
  type MaterialLedgerMaterial,
  type MaterialQuantityUnitId
} from "./types";
import { integerUnitsToQuantity, quantityToIntegerUnits } from "./quantity";
import {
  assertContainerVolumeWithinCapacity,
  assertKnownMaterialContainer,
  assertVolumeConserved
} from "../volume-conservation";

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function fail(
  code: MaterialLedgerError["code"],
  message: string,
  details: MaterialLedgerError["details"] = {}
): never {
  throw new MaterialLedgerError(code, message, details);
}

function canonicalizeMaterial(
  material: MaterialLedgerMaterial
): MaterialLedgerMaterial {
  const byLocation = new Map<string, number>();
  for (const location of material.locations) {
    if (byLocation.has(location.equipmentInstanceId)) {
      fail(
        ERROR.invalidLedger,
        `Material ${material.materialInstanceId} repeats a location.`,
        {
          materialInstanceId: material.materialInstanceId,
          equipmentInstanceId: location.equipmentInstanceId
        }
      );
    }
    byLocation.set(
      location.equipmentInstanceId,
      quantityToIntegerUnits(location.amount, material.unitId)
    );
  }
  const initialUnits = quantityToIntegerUnits(
    material.initialAmount,
    material.unitId
  );
  const allocatedUnits = [...byLocation.values()].reduce(
    (total, amount) => total + amount,
    0
  );
  if (allocatedUnits !== initialUnits) {
    fail(
      ERROR.conservationViolation,
      `Material ${material.materialInstanceId} is not conserved.`,
      {
        materialInstanceId: material.materialInstanceId,
        initialUnits,
        allocatedUnits
      }
    );
  }
  return {
    ...material,
    initialAmount: integerUnitsToQuantity(initialUnits, material.unitId),
    locations: [...byLocation.entries()]
      .filter(([, amount]) => amount > 0)
      .sort(([left], [right]) => compareStrings(left, right))
      .map(([equipmentInstanceId, amount]) => ({
        equipmentInstanceId,
        amount: integerUnitsToQuantity(amount, material.unitId)
      }))
  };
}

export function validateMaterialLedger(input: unknown): MaterialLedger {
  const parsed = materialLedgerSchema.safeParse(input);
  if (!parsed.success) {
    fail(ERROR.invalidLedger, "Material ledger schema is invalid.");
  }
  const seen = new Set<string>();
  const materials = parsed.data.materials.map((material) => {
    if (seen.has(material.materialInstanceId)) {
      fail(
        ERROR.invalidLedger,
        `Duplicate material ${material.materialInstanceId}.`,
        { materialInstanceId: material.materialInstanceId }
      );
    }
    seen.add(material.materialInstanceId);
    return canonicalizeMaterial(material);
  });
  return {
    schemaVersion: MATERIAL_LEDGER_SCHEMA_VERSION,
    materials: materials.sort((left, right) =>
      compareStrings(left.materialInstanceId, right.materialInstanceId)
    )
  };
}

export function initializeMaterialLedger(
  bindings: readonly InitialMaterialLedgerBinding[]
): MaterialLedger {
  return validateMaterialLedger({
    schemaVersion: MATERIAL_LEDGER_SCHEMA_VERSION,
    materials: bindings.map((binding) => ({
      materialInstanceId: binding.materialInstanceId,
      materialProfileId: binding.materialProfileId,
      materialVersion: binding.materialVersion,
      unitId: binding.unitId,
      initialAmount: binding.amount,
      locations: [
        {
          equipmentInstanceId: binding.containerInstanceId,
          amount: binding.amount
        }
      ]
    }))
  });
}

export function materialAmountAt(
  ledger: Readonly<MaterialLedger>,
  materialInstanceId: string,
  equipmentInstanceId: string
): number {
  const material = ledger.materials.find(
    (candidate) => candidate.materialInstanceId === materialInstanceId
  );
  if (!material) return 0;
  return (
    material.locations.find(
      (location) => location.equipmentInstanceId === equipmentInstanceId
    )?.amount ?? 0
  );
}

export function createMaterialTransfer(
  ledgerInput: Readonly<MaterialLedger>,
  input: {
    readonly materialInstanceId: string;
    readonly sourceEquipmentInstanceId: string;
    readonly targetEquipmentInstanceId: string;
    readonly amount: number;
    readonly unitId: MaterialQuantityUnitId;
  }
): ExecutedMaterialTransfer {
  const ledger = validateMaterialLedger(ledgerInput);
  if (input.sourceEquipmentInstanceId === input.targetEquipmentInstanceId) {
    fail(
      ERROR.invalidLedger,
      "A material transfer requires distinct locations."
    );
  }
  const material = ledger.materials.find(
    (candidate) => candidate.materialInstanceId === input.materialInstanceId
  );
  if (!material) {
    fail(
      ERROR.unknownMaterial,
      `Unknown material ${input.materialInstanceId}.`,
      {
        materialInstanceId: input.materialInstanceId
      }
    );
  }
  if (material.unitId !== input.unitId) {
    fail(
      ERROR.unitMismatch,
      `Material ${material.materialInstanceId} uses ${material.unitId}.`,
      {
        materialInstanceId: material.materialInstanceId,
        unitId: input.unitId
      }
    );
  }
  const amountUnits = quantityToIntegerUnits(input.amount, input.unitId, false);
  const sourceBeforeUnits = quantityToIntegerUnits(
    materialAmountAt(
      ledger,
      material.materialInstanceId,
      input.sourceEquipmentInstanceId
    ),
    input.unitId
  );
  if (amountUnits > sourceBeforeUnits) {
    fail(
      ERROR.sourceUnavailable,
      "Material source does not contain enough quantity.",
      {
        materialInstanceId: material.materialInstanceId,
        requestedUnits: amountUnits,
        availableUnits: sourceBeforeUnits
      }
    );
  }
  const targetBeforeUnits = quantityToIntegerUnits(
    materialAmountAt(
      ledger,
      material.materialInstanceId,
      input.targetEquipmentInstanceId
    ),
    input.unitId
  );
  return {
    kind: "transfer",
    materialInstanceId: material.materialInstanceId,
    materialProfileId: material.materialProfileId,
    unitId: material.unitId,
    sourceEquipmentInstanceId: input.sourceEquipmentInstanceId,
    targetEquipmentInstanceId: input.targetEquipmentInstanceId,
    amount: integerUnitsToQuantity(amountUnits, input.unitId),
    sourceAmountBefore: integerUnitsToQuantity(sourceBeforeUnits, input.unitId),
    sourceAmountAfter: integerUnitsToQuantity(
      sourceBeforeUnits - amountUnits,
      input.unitId
    ),
    targetAmountBefore: integerUnitsToQuantity(targetBeforeUnits, input.unitId),
    targetAmountAfter: integerUnitsToQuantity(
      targetBeforeUnits + amountUnits,
      input.unitId
    )
  };
}

export function applyExecutedMaterialAction(
  ledgerInput: Readonly<MaterialLedger>,
  actionInput: Readonly<ExecutedMaterialAction>,
  capacities: readonly MaterialContainerCapacity[]
): MaterialLedger {
  let ledger = validateMaterialLedger(ledgerInput);
  const parsed = executedMaterialActionSchema.safeParse(actionInput);
  if (!parsed.success) {
    fail(ERROR.invalidLedger, "Executed material action schema is invalid.");
  }
  const transferMaterialIds = [
    ...new Set(
      parsed.data.transfers.map(({ materialInstanceId }) => materialInstanceId)
    )
  ];
  if (
    parsed.data.materialInstanceIds.length !== transferMaterialIds.length ||
    parsed.data.materialInstanceIds.some(
      (id, index) => id !== transferMaterialIds[index]
    ) ||
    parsed.data.transfers.some(
      (transfer) =>
        transfer.sourceEquipmentInstanceId !==
          parsed.data.sourceEquipmentInstanceId ||
        !parsed.data.targetEquipmentInstanceIds.includes(
          transfer.targetEquipmentInstanceId
        )
    )
  ) {
    fail(
      ERROR.invalidLedger,
      "Executed material action references do not match its transfers."
    );
  }
  for (const transfer of parsed.data.transfers) {
    const expected = createMaterialTransfer(ledger, transfer);
    if (JSON.stringify(expected) !== JSON.stringify(transfer)) {
      fail(
        ERROR.invalidLedger,
        "Executed material transfer does not match the current ledger."
      );
    }
    assertKnownMaterialContainer(
      transfer.sourceEquipmentInstanceId,
      capacities
    );
    assertKnownMaterialContainer(
      transfer.targetEquipmentInstanceId,
      capacities
    );
    const previous = ledger;
    ledger = validateMaterialLedger({
      ...ledger,
      materials: ledger.materials.map((material) => {
        if (material.materialInstanceId !== transfer.materialInstanceId) {
          return material;
        }
        const byLocation = new Map(
          material.locations.map((location) => [
            location.equipmentInstanceId,
            location.amount
          ])
        );
        byLocation.set(
          transfer.sourceEquipmentInstanceId,
          transfer.sourceAmountAfter
        );
        byLocation.set(
          transfer.targetEquipmentInstanceId,
          transfer.targetAmountAfter
        );
        return {
          ...material,
          locations: [...byLocation.entries()].map(
            ([equipmentInstanceId, amount]) => ({
              equipmentInstanceId,
              amount
            })
          )
        };
      })
    });
    assertVolumeConserved(previous, ledger);
    assertContainerVolumeWithinCapacity(
      ledger,
      transfer.targetEquipmentInstanceId,
      capacities
    );
  }
  return ledger;
}
