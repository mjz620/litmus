import { describe, expect, it } from "vitest";

import {
  CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES,
  createChemistryModelRegistry,
  resolveChemistryModelProviders,
  type ChemistryModelAvailability,
  type ChemistryModelId,
  type ChemistryModelMetadataEntry
} from "../../../../src/lab-workflows/registries/chemistry-models";
import type { ChemistryCapabilityId } from "../../../../src/lab-workflows/capabilities";

function model(
  id: ChemistryModelId,
  providedCapabilityIds: readonly ChemistryCapabilityId[],
  requiredCapabilityIds: readonly ChemistryCapabilityId[] = [],
  availability: ChemistryModelAvailability = "verified"
): ChemistryModelMetadataEntry {
  return {
    id,
    version: "1.0.0",
    displayName: id,
    providedCapabilityIds,
    requiredCapabilityIds,
    availability
  };
}

function expectResolutionError(
  action: () => unknown,
  expected: Readonly<Record<string, unknown>>
): void {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toMatchObject(expected);
}

describe("exact chemistry model provider resolution", () => {
  it("returns a deeply frozen empty resolution for zero requirements", () => {
    const resolution = resolveChemistryModelProviders([]);

    expect(resolution).toEqual({
      requiredCapabilityIds: [],
      capabilityProviders: [],
      orderedModelIds: [],
      orderedModels: []
    });
    expect(Object.isFrozen(resolution)).toBe(true);
    expect(Object.isFrozen(resolution.requiredCapabilityIds)).toBe(true);
    expect(Object.isFrozen(resolution.capabilityProviders)).toBe(true);
    expect(Object.isFrozen(resolution.orderedModelIds)).toBe(true);
    expect(Object.isFrozen(resolution.orderedModels)).toBe(true);
  });

  it("resolves one exact verified provider and deduplicates repeated roots", () => {
    const ledger = model("chemistry-model.test.ledger.v1", [
      "chemistry.material_ledger.v1"
    ]);
    const resolution = resolveChemistryModelProviders(
      ["chemistry.material_ledger.v1", "chemistry.material_ledger.v1"],
      { modelRegistry: createChemistryModelRegistry([ledger]) }
    );

    expect(resolution.requiredCapabilityIds).toEqual([
      "chemistry.material_ledger.v1"
    ]);
    expect(resolution.capabilityProviders).toEqual([
      {
        capabilityId: "chemistry.material_ledger.v1",
        modelId: ledger.id
      }
    ]);
    expect(resolution.orderedModelIds).toEqual([ledger.id]);
    expect(resolution.orderedModels).toEqual([ledger]);
    expect(Object.isFrozen(resolution.capabilityProviders[0])).toBe(true);
  });

  it("orders transitive providers before dependants", () => {
    const mixing = model(
      "chemistry-model.test.mixing.v1",
      ["chemistry.solution_mixing.v1"],
      ["chemistry.volume_conservation.v1"]
    );
    const volume = model(
      "chemistry-model.test.volume.v1",
      ["chemistry.volume_conservation.v1"],
      ["chemistry.material_ledger.v1"]
    );
    const ledger = model("chemistry-model.test.ledger.v1", [
      "chemistry.material_ledger.v1"
    ]);

    const resolution = resolveChemistryModelProviders(
      ["chemistry.solution_mixing.v1"],
      {
        modelRegistry: createChemistryModelRegistry([mixing, ledger, volume])
      }
    );

    expect(resolution.orderedModelIds).toEqual([
      ledger.id,
      volume.id,
      mixing.id
    ]);
  });

  it("uses exact model ID as the tie-break independent of input ordering", () => {
    const zeta = model("chemistry-model.test.zeta.v1", [
      "chemistry.volume_conservation.v1"
    ]);
    const alpha = model("chemistry-model.test.alpha.v1", [
      "chemistry.material_ledger.v1"
    ]);

    const forward = resolveChemistryModelProviders(
      ["chemistry.volume_conservation.v1", "chemistry.material_ledger.v1"],
      { modelRegistry: createChemistryModelRegistry([zeta, alpha]) }
    );
    const reversed = resolveChemistryModelProviders(
      ["chemistry.material_ledger.v1", "chemistry.volume_conservation.v1"],
      { modelRegistry: createChemistryModelRegistry([alpha, zeta]) }
    );

    expect(forward).toEqual(reversed);
    expect(forward.orderedModelIds).toEqual([alpha.id, zeta.id]);
  });

  it("selects one model only once when it provides multiple capabilities", () => {
    const combined = model("chemistry-model.test.combined.v1", [
      "chemistry.material_ledger.v1",
      "chemistry.volume_conservation.v1"
    ]);
    const resolution = resolveChemistryModelProviders(
      ["chemistry.volume_conservation.v1", "chemistry.material_ledger.v1"],
      { modelRegistry: createChemistryModelRegistry([combined]) }
    );

    expect(resolution.capabilityProviders).toHaveLength(2);
    expect(resolution.orderedModelIds).toEqual([combined.id]);
  });

  it("rejects unknown requirements before provider selection", () => {
    expectResolutionError(
      () => resolveChemistryModelProviders(["chemistry.unknown.v1"]),
      {
        code: CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES.unknownCapability,
        capabilityId: "chemistry.unknown.v1"
      }
    );
  });

  it("rejects unknown metadata capability references deterministically", () => {
    const invalid = model(
      "chemistry-model.test.invalid.v1",
      ["chemistry.material_ledger.v1"],
      ["chemistry.unknown.v1" as ChemistryCapabilityId]
    );
    expectResolutionError(
      () =>
        resolveChemistryModelProviders(["chemistry.material_ledger.v1"], {
          modelRegistry: createChemistryModelRegistry([invalid])
        }),
      {
        code: CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES.unknownCapability,
        capabilityId: "chemistry.unknown.v1",
        modelId: invalid.id
      }
    );
  });

  it("distinguishes a missing root provider from an unmet dependency", () => {
    expectResolutionError(
      () =>
        resolveChemistryModelProviders(["chemistry.material_ledger.v1"], {
          modelRegistry: createChemistryModelRegistry([])
        }),
      {
        code: CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES.missingProvider,
        capabilityId: "chemistry.material_ledger.v1"
      }
    );

    const mixing = model(
      "chemistry-model.test.mixing.v1",
      ["chemistry.solution_mixing.v1"],
      ["chemistry.volume_conservation.v1"]
    );
    expectResolutionError(
      () =>
        resolveChemistryModelProviders(["chemistry.solution_mixing.v1"], {
          modelRegistry: createChemistryModelRegistry([mixing])
        }),
      {
        code: CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES.unmetDependency,
        capabilityId: "chemistry.volume_conservation.v1",
        modelId: mixing.id
      }
    );
  });

  it("does not let declared or restricted providers satisfy resolution", () => {
    for (const availability of ["declared", "restricted"] as const) {
      const unavailable = model(
        `chemistry-model.test.${availability}.v1`,
        ["chemistry.material_ledger.v1"],
        [],
        availability
      );
      expectResolutionError(
        () =>
          resolveChemistryModelProviders(["chemistry.material_ledger.v1"], {
            modelRegistry: createChemistryModelRegistry([unavailable])
          }),
        {
          code: CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES.providerNotVerified,
          capabilityId: "chemistry.material_ledger.v1",
          modelIds: [unavailable.id]
        }
      );
    }
  });

  it("selects the sole verified provider when declared alternatives exist", () => {
    const declared = model(
      "chemistry-model.test.declared.v1",
      ["chemistry.material_ledger.v1"],
      [],
      "declared"
    );
    const verified = model("chemistry-model.test.verified.v1", [
      "chemistry.material_ledger.v1"
    ]);
    const resolution = resolveChemistryModelProviders(
      ["chemistry.material_ledger.v1"],
      { modelRegistry: createChemistryModelRegistry([declared, verified]) }
    );

    expect(resolution.orderedModelIds).toEqual([verified.id]);
  });

  it("rejects ambiguous verified providers for an exclusive capability", () => {
    const alpha = model("chemistry-model.test.alpha.v1", [
      "chemistry.material_ledger.v1"
    ]);
    const beta = model("chemistry-model.test.beta.v1", [
      "chemistry.material_ledger.v1"
    ]);
    expectResolutionError(
      () =>
        resolveChemistryModelProviders(["chemistry.material_ledger.v1"], {
          modelRegistry: createChemistryModelRegistry([beta, alpha])
        }),
      {
        code: CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES.ambiguousExclusiveProvider,
        capabilityId: "chemistry.material_ledger.v1",
        modelIds: [alpha.id, beta.id]
      }
    );
  });

  it("rejects self and multi-model dependency cycles with canonical IDs", () => {
    const self = model(
      "chemistry-model.test.self.v1",
      ["chemistry.material_ledger.v1"],
      ["chemistry.material_ledger.v1"]
    );
    expectResolutionError(
      () =>
        resolveChemistryModelProviders(["chemistry.material_ledger.v1"], {
          modelRegistry: createChemistryModelRegistry([self])
        }),
      {
        code: CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES.dependencyCycle,
        modelIds: [self.id],
        cycleModelIds: [self.id]
      }
    );

    const alpha = model(
      "chemistry-model.test.alpha.v1",
      ["chemistry.material_ledger.v1"],
      ["chemistry.volume_conservation.v1"]
    );
    const beta = model(
      "chemistry-model.test.beta.v1",
      ["chemistry.volume_conservation.v1"],
      ["chemistry.material_ledger.v1"]
    );
    expectResolutionError(
      () =>
        resolveChemistryModelProviders(["chemistry.material_ledger.v1"], {
          modelRegistry: createChemistryModelRegistry([beta, alpha])
        }),
      {
        code: CHEMISTRY_MODEL_RESOLUTION_ERROR_CODES.dependencyCycle,
        modelIds: [alpha.id, beta.id],
        cycleModelIds: [alpha.id, beta.id]
      }
    );
  });

  it("does not mutate requirement arrays or model metadata", () => {
    const requirements = [
      "chemistry.volume_conservation.v1",
      "chemistry.material_ledger.v1"
    ] as const;
    const combined = model("chemistry-model.test.combined.v1", [
      "chemistry.volume_conservation.v1",
      "chemistry.material_ledger.v1"
    ]);
    const beforeRequirements = structuredClone(requirements);
    const beforeModel = structuredClone(combined);

    resolveChemistryModelProviders(requirements, {
      modelRegistry: createChemistryModelRegistry([combined])
    });

    expect(requirements).toEqual(beforeRequirements);
    expect(combined).toEqual(beforeModel);
  });
});
