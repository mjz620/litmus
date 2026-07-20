import { describe, expect, expectTypeOf, it } from "vitest";

import {
  CHEMISTRY_MODEL_REGISTRY_ENTRIES,
  CHEMISTRY_MODEL_REGISTRY_ERROR_CODES,
  ChemistryModelRegistryError,
  chemistryModelRegistry,
  chemistryModelRegistrySnapshot,
  createChemistryModelRegistry,
  type ChemistryModelImplementationRegistration,
  type ChemistryModelMetadataEntry,
  type ChemistryModelModule
} from "../../../../src/lab-workflows/registries/chemistry-models";

const VERIFIED_MODEL = {
  id: "chemistry-model.test.ledger.v1",
  version: "1.0.0",
  displayName: "Synthetic verified ledger",
  providedCapabilityIds: ["chemistry.material_ledger.v1"],
  requiredCapabilityIds: [],
  availability: "verified"
} as const satisfies ChemistryModelMetadataEntry;

describe("chemistry model metadata registry", () => {
  it("publishes exact generic providers beside the compatibility-scoped legacy provider", () => {
    expect(CHEMISTRY_MODEL_REGISTRY_ENTRIES).toEqual([
      expect.objectContaining({
        id: "chemistry-model.shared_liquid_foundation.v1",
        availability: "verified",
        providedCapabilityIds: [
          "chemistry.material_ledger.v1",
          "chemistry.volume_conservation.v1",
          "chemistry.solution_mixing.v1"
        ],
        requiredCapabilityIds: []
      }),
      expect.objectContaining({
        id: "chemistry-model.concentration_dilution.v1",
        availability: "verified",
        providedCapabilityIds: [
          "chemistry.concentration_dilution.v1",
          "chemistry.instrument_observables.v1"
        ],
        requiredCapabilityIds: [
          "chemistry.material_ledger.v1",
          "chemistry.volume_conservation.v1",
          "chemistry.solution_mixing.v1"
        ]
      }),
      expect.objectContaining({
        id: "chemistry-model.thermal_energy.v1",
        availability: "verified",
        providedCapabilityIds: ["chemistry.thermal_energy.v1"],
        requiredCapabilityIds: [
          "chemistry.material_ledger.v1",
          "chemistry.volume_conservation.v1",
          "chemistry.solution_mixing.v1"
        ]
      }),
      expect.objectContaining({
        id: "chemistry-model.precipitation.v1",
        availability: "verified",
        providedCapabilityIds: ["chemistry.precipitation_solubility.v1"],
        requiredCapabilityIds: [
          "chemistry.material_ledger.v1",
          "chemistry.volume_conservation.v1",
          "chemistry.solution_mixing.v1"
        ]
      }),
      expect.objectContaining({
        id: "chemistry-model.legacy_titration.v1",
        availability: "verified",
        compatibilityRuntimeAdapterId: "runtime-adapter.titration.v1"
      })
    ]);
    expect(chemistryModelRegistry.snapshotId).toBe("chemistry-models.2.1.0");
    expect(chemistryModelRegistry.list()).toHaveLength(5);
    expect(chemistryModelRegistrySnapshot.entries).toBe(
      chemistryModelRegistry.list()
    );
    expect(
      chemistryModelRegistry.has("chemistry-model.legacy_titration.v1")
    ).toBe(true);
    expect(
      chemistryModelRegistry.has("chemistry-model.concentration_dilution.v1")
    ).toBe(true);
  });

  it("resolves exact synthetic IDs and fails closed for unknown IDs", () => {
    const registry = createChemistryModelRegistry([VERIFIED_MODEL]);

    expect(registry.has(VERIFIED_MODEL.id)).toBe(true);
    expect(registry.get(VERIFIED_MODEL.id)).toEqual(VERIFIED_MODEL);
    expect(registry.has("chemistry-model.test.unknown.v1")).toBe(false);
    expect(() => registry.get("chemistry-model.test.unknown.v1")).toThrowError(
      expect.objectContaining({
        name: "ChemistryModelRegistryError",
        code: CHEMISTRY_MODEL_REGISTRY_ERROR_CODES.unknownId,
        registryId: "chemistry-model.test.unknown.v1"
      })
    );
  });

  it("rejects duplicate model IDs with a stable error", () => {
    expect(() =>
      createChemistryModelRegistry([VERIFIED_MODEL, { ...VERIFIED_MODEL }])
    ).toThrowError(
      new ChemistryModelRegistryError(
        CHEMISTRY_MODEL_REGISTRY_ERROR_CODES.duplicateId,
        VERIFIED_MODEL.id
      )
    );
  });

  it("deeply freezes cloned metadata without mutating its input", () => {
    const mutableProvided = ["chemistry.material_ledger.v1"] as const;
    const input = {
      ...VERIFIED_MODEL,
      providedCapabilityIds: mutableProvided
    } satisfies ChemistryModelMetadataEntry;
    const registry = createChemistryModelRegistry([input]);
    const entry = registry.get(input.id);

    expect(Object.isFrozen(registry)).toBe(true);
    expect(Object.isFrozen(registry.list())).toBe(true);
    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.providedCapabilityIds)).toBe(true);
    expect(Object.isFrozen(entry.requiredCapabilityIds)).toBe(true);
    expect(entry).not.toBe(input);
    expect(Object.isFrozen(input)).toBe(false);
    expect(Object.isFrozen(mutableProvided)).toBe(false);
  });

  it("keeps executable modules behind a distinct registration contract", () => {
    type State = { readonly amount: number };
    type Initial = { readonly amount: number };
    type Action = { readonly delta: number };
    type Observables = { readonly amount: number };

    const chemistryModule = {
      id: VERIFIED_MODEL.id,
      version: "1.0.0",
      providedCapabilityIds: VERIFIED_MODEL.providedCapabilityIds,
      requiredCapabilityIds: VERIFIED_MODEL.requiredCapabilityIds,
      initialize: (context: Initial): State => ({ amount: context.amount }),
      applyMaterialAction: (action: Action, state: State) => ({
        state: { amount: state.amount + action.delta }
      }),
      deriveObservables: (state: State): Observables => ({
        amount: state.amount
      })
    } satisfies ChemistryModelModule<State, Initial, Action, Observables>;
    const registration = {
      metadataId: VERIFIED_MODEL.id,
      module: chemistryModule
    } satisfies ChemistryModelImplementationRegistration<
      State,
      Initial,
      Action,
      Observables
    >;

    expect(registration.metadataId).toBe(VERIFIED_MODEL.id);
    expectTypeOf(registration.module.initialize).toBeFunction();
    expect(chemistryModelRegistry.list()).not.toContain(registration.module);
  });
});
