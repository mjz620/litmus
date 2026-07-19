import { describe, expect, expectTypeOf, it } from "vitest";

import {
  CAPABILITY_REGISTRY_ENTRIES,
  CHEMISTRY_CAPABILITY_IDS,
  EQUIPMENT_CAPABILITY_IDS,
  CapabilityRegistryError,
  capabilityRegistry,
  capabilityRegistrySnapshot,
  createCapabilityRegistry,
  type ChemistryCapabilityId,
  type EquipmentCapabilityId
} from "../../../src/lab-workflows/capabilities";

describe("capability registry", () => {
  it("publishes the exact bounded equipment and chemistry vocabularies", () => {
    expect(EQUIPMENT_CAPABILITY_IDS).toEqual([
      "capability.contain_liquid.v1",
      "capability.receive_liquid.v1",
      "capability.dispense_liquid.v1",
      "capability.transfer_liquid.v1",
      "capability.measure_volume.v1",
      "capability.rinse.v1",
      "capability.mix.v1",
      "capability.mount.v1",
      "capability.observe_color.v1",
      "capability.fill_to_mark.v1"
    ]);
    expect(CHEMISTRY_CAPABILITY_IDS).toEqual([
      "chemistry.material_ledger.v1",
      "chemistry.volume_conservation.v1",
      "chemistry.solution_mixing.v1",
      "chemistry.concentration_dilution.v1",
      "chemistry.acid_base_equilibrium.v1",
      "chemistry.indicator_response.v1",
      "chemistry.instrument_observables.v1"
    ]);
    expect(capabilityRegistry.snapshotId).toBe("capabilities.2.0.0");
    expect(capabilityRegistrySnapshot.entries).toBe(capabilityRegistry.list());
    expectTypeOf<EquipmentCapabilityId>().not.toEqualTypeOf<ChemistryCapabilityId>();
  });

  it("keeps category-specific lookup exact", () => {
    expect(
      capabilityRegistry.getEquipment("capability.contain_liquid.v1").kind
    ).toBe("equipment");
    expect(
      capabilityRegistry.getChemistry("chemistry.material_ledger.v1").kind
    ).toBe("chemistry");
    expect(
      capabilityRegistry.getChemistry("chemistry.material_ledger.v1")
        .providerCardinality
    ).toBe("exclusive");
    expect(() =>
      capabilityRegistry.getEquipment("chemistry.material_ledger.v1")
    ).toThrowError(
      new CapabilityRegistryError(
        "capability_registry.unknown_id",
        "chemistry.material_ledger.v1"
      )
    );
    expect(() => capabilityRegistry.get("chemistry.future.v1")).toThrowError(
      expect.objectContaining({
        code: "capability_registry.unknown_id",
        registryId: "chemistry.future.v1"
      })
    );
  });

  it("rejects duplicate exact IDs with a stable error", () => {
    const duplicate = CAPABILITY_REGISTRY_ENTRIES[0];
    expect(() =>
      createCapabilityRegistry([duplicate, { ...duplicate }])
    ).toThrowError(
      new CapabilityRegistryError(
        "capability_registry.duplicate_id",
        duplicate.id
      )
    );
  });

  it("publishes verified current mechanics and bounded chemistry", () => {
    expect(capabilityRegistry.get("capability.rinse.v1").availability).toBe(
      "verified"
    );
    expect(
      capabilityRegistry.get("capability.transfer_liquid.v1").availability
    ).toBe("verified");
    expect(capabilityRegistry.get("capability.mix.v1").availability).toBe(
      "verified"
    );
    expect(
      capabilityRegistry.get("capability.fill_to_mark.v1").availability
    ).toBe("verified");
    expect(
      capabilityRegistry.get("chemistry.concentration_dilution.v1").availability
    ).toBe("verified");
    expect(
      capabilityRegistry.get("chemistry.acid_base_equilibrium.v1").availability
    ).toBe("verified");
  });

  it("returns immutable entries and category collections", () => {
    expect(Object.isFrozen(capabilityRegistry.list())).toBe(true);
    expect(Object.isFrozen(capabilityRegistry.listEquipment())).toBe(true);
    expect(Object.isFrozen(capabilityRegistry.listChemistry())).toBe(true);
    expect(Object.isFrozen(capabilityRegistry.list()[0])).toBe(true);
    expect(Object.isFrozen(EQUIPMENT_CAPABILITY_IDS)).toBe(true);
    expect(Object.isFrozen(CHEMISTRY_CAPABILITY_IDS)).toBe(true);
  });
});
