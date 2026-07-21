import { describe, expect, it } from "vitest";

import { capabilityRegistry } from "../../../../src/lab-workflows/capabilities";
import { componentRegistry } from "../../../../src/lab-workflows/registries/components";

describe("verified component entry metadata", () => {
  it("pins every component to a verified capability surface and core tier", () => {
    for (const entry of componentRegistry.list()) {
      expect(
        entry.compatibleFamilyIds.length === 0 ||
          entry.compatibleFamilyIds.includes("family.acid_base_titration.v1")
      ).toBe(true);
      expect(entry.performanceTier).toBe("core");
      expect(entry.displayName.length).toBeGreaterThan(0);
      expect(entry.capabilityIds.length).toBeGreaterThan(0);
      for (const capabilityId of entry.capabilityIds) {
        expect(capabilityRegistry.getEquipment(capabilityId).availability).toBe(
          "verified"
        );
      }
      expect(entry.stateSchemaId).toMatch(/^schema\.equipment_state\..+\.v1$/);
      expect(entry.visualAdapterDefinitionId).toMatch(
        /^visual-adapter\..+\.v1$/
      );
      expect(entry.mechanicalAdapterId).toMatch(/^mechanical-adapter\..+\.v1$/);
      expect(Array.isArray(entry.safetyConstraintIds)).toBe(true);
      expect(entry.allowedRoleIds.length).toBeGreaterThan(0);
      expect(entry.stateSchema.fields.length).toBeGreaterThan(0);
      expect(
        entry.stateSchema.fields.every(({ runtimeOwned }) => runtimeOwned)
      ).toBe(true);
    }
  });

  it("models the current burette action, event, and precision surface", () => {
    const burette = componentRegistry.get("component.burette.v1");

    expect(burette.allowedActionIds).toEqual([
      "action.rinse.v1",
      "action.fill.v1",
      "action.dispense.v1",
      "action.read_volume.v1"
    ]);
    expect(burette.allowedRoleIds).toEqual(["titrant_delivery"]);
    expect(burette.allowedActionIds).not.toContain("action.set_flow_rate.v1");
    expect(burette.emittedEventTypes).toEqual([
      "rinse_burette",
      "fill_burette",
      "refill_burette",
      "add_titrant",
      "read_meniscus"
    ]);
    expect(burette.measurement).toMatchObject({
      capacityML: 50,
      graduationIncrementML: 0.1,
      reportIncrementML: 0.05,
      toleranceML: 0.05,
      quantitative: true
    });
    expect(burette.visualAdapterId).toBe("Burette");
    expect(burette.visualAdapterDefinitionId).toBe("visual-adapter.burette.v1");
    expect(burette.mechanicalAdapterId).toBe("mechanical-adapter.burette.v1");
    expect(burette.defaultConfigurationPresetId).toBe(
      "component_config.burette.50ml.v1"
    );
    expect(burette.capabilityIds).toEqual([
      "capability.contain_liquid.v1",
      "capability.receive_liquid.v1",
      "capability.dispense_liquid.v1",
      "capability.measure_volume.v1",
      "capability.rinse.v1",
      "capability.mount.v1"
    ]);
  });

  it("keeps flask chemistry out while exposing verified bottle mechanics", () => {
    const flask = componentRegistry.get("component.erlenmeyer_flask.v1");
    const reagentBottle = componentRegistry.get("component.reagent_bottle.v1");
    const indicatorBottle = componentRegistry.get(
      "component.indicator_bottle.v1"
    );

    expect(flask.allowedActionIds).toEqual(["action.add_indicator.v1"]);
    expect(flask.allowedActionIds).not.toContain("action.mix.v1");
    expect(flask.capabilityIds).toEqual([
      "capability.contain_liquid.v1",
      "capability.receive_liquid.v1",
      "capability.observe_color.v1"
    ]);
    expect(reagentBottle.allowedActionIds).toEqual([
      "action.rinse.v1",
      "action.fill.v1",
      "action.rinse_transfer_device.v1",
      "action.transfer_liquid.v1",
      "action.pour_liquid.v1",
      "action.transfer_solid.v1"
    ]);
    expect(indicatorBottle.allowedActionIds).toEqual([
      "action.select_indicator.v1"
    ]);
    expect(indicatorBottle.emittedEventTypes).toEqual(["select_indicator"]);
    expect(reagentBottle.defaultConfigurationPresetAvailability).toBe(
      "verified"
    );
    expect(reagentBottle.capabilityIds).not.toContain(
      "capability.measure_volume.v1"
    );
    expect(reagentBottle.safetyConstraintIds).toEqual([]);
    expect(indicatorBottle.capabilityIds).not.toContain(
      "capability.measure_volume.v1"
    );
  });

  it("registers the exact solution-preparation equipment without a family runtime", () => {
    expect(
      componentRegistry.get("component.volumetric_pipette.v1")
    ).toMatchObject({
      measurement: { capacityML: 10, toleranceML: 0.02 },
      compatibleFamilyIds: [],
      mechanicalAdapterId: "mechanical-adapter.volumetric_pipette.v1"
    });
    expect(
      componentRegistry.get("component.volumetric_flask.v1")
    ).toMatchObject({
      measurement: { capacityML: 100, toleranceML: 0.08 },
      compatibleFamilyIds: [],
      allowedActionIds: [
        "action.transfer_liquid.v1",
        "action.fill_to_mark.v1",
        "action.mix_solution.v1"
      ]
    });
    expect(componentRegistry.get("component.wash_bottle.v1")).toMatchObject({
      measurement: { capacityML: 250, quantitative: false },
      compatibleFamilyIds: []
    });
  });

  it("keeps unrelated planned component families out of the verified registry", () => {
    // component.beaker.v1 is registered now that a general-purpose vessel
    // exists; the rest remain planned.
    expect(componentRegistry.has("component.beaker.v1")).toBe(true);
    for (const id of [
      "component.graduated_cylinder.v1",
      "component.heat_source_bunsen.v1"
    ]) {
      expect(componentRegistry.has(id)).toBe(false);
    }
  });

  it("registers coffee-cup calorimetry equipment with verified adapters", () => {
    expect(componentRegistry.get("component.calorimeter.v1")).toMatchObject({
      mechanicalAdapterAvailability: "verified",
      visualAdapterDefinitionAvailability: "verified",
      defaultConfigurationPresetId:
        "component_config.calorimeter.coffee_cup_100ml.v1",
      allowedActionIds: [
        "action.pour_liquid.v1",
        "action.mix_calorimeter.v1",
        "action.set_calorimeter_lid.v1",
        "action.transfer_solid.v1"
      ]
    });
    expect(componentRegistry.get("component.thermometer.v1")).toMatchObject({
      mechanicalAdapterAvailability: "verified",
      visualAdapterDefinitionAvailability: "verified",
      measurement: { kind: "temperature", unitId: "unit.celsius.v1" },
      allowedActionIds: [
        "action.place_thermometer.v1",
        "action.remove_thermometer.v1",
        "action.read_temperature.v1"
      ]
    });
    expect(componentRegistry.get("component.balance.v1")).toMatchObject({
      mechanicalAdapterAvailability: "verified",
      visualAdapterDefinitionAvailability: "verified",
      measurement: {
        kind: "mass",
        unitId: "unit.g.v1",
        reportIncrementML: 0.01
      }
    });
    expect(componentRegistry.get("component.weighing_boat.v1")).toMatchObject({
      mechanicalAdapterId: "mechanical-adapter.balance.v1",
      capabilityIds: [
        "capability.contain_solid.v1",
        "capability.receive_solid.v1",
        "capability.dispense_solid.v1"
      ]
    });
  });
});
