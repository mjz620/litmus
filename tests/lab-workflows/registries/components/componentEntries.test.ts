import { describe, expect, it } from "vitest";

import { componentRegistry } from "../../../../src/lab-workflows/registries/components";

describe("verified component entry metadata", () => {
  it("pins every component to the implemented titration family and core tier", () => {
    for (const entry of componentRegistry.list()) {
      expect(entry.compatibleFamilyIds).toEqual([
        "family.acid_base_titration.v1"
      ]);
      expect(entry.performanceTier).toBe("core");
      expect(entry.safetyConstraintIds).toContain(
        "safety.virtual_titration_ppe_notice.v1"
      );
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
  });

  it("does not claim unimplemented flask chemistry or bottle interactions", () => {
    const flask = componentRegistry.get("component.erlenmeyer_flask.v1");
    const reagentBottle = componentRegistry.get("component.reagent_bottle.v1");
    const indicatorBottle = componentRegistry.get(
      "component.indicator_bottle.v1"
    );

    expect(flask.allowedActionIds).toEqual(["action.add_indicator.v1"]);
    expect(flask.allowedActionIds).not.toContain("action.mix.v1");
    expect(reagentBottle.allowedActionIds).toEqual([
      "action.rinse.v1",
      "action.fill.v1"
    ]);
    expect(indicatorBottle.allowedActionIds).toEqual([
      "action.select_indicator.v1"
    ]);
    expect(indicatorBottle.emittedEventTypes).toEqual(["select_indicator"]);
  });

  it("keeps planned component families out of the verified registry", () => {
    for (const id of [
      "component.beaker.v1",
      "component.pipette.v1",
      "component.graduated_cylinder.v1",
      "component.balance.v1",
      "component.thermometer.v1",
      "component.calorimeter.v1",
      "component.heat_source_bunsen.v1"
    ]) {
      expect(componentRegistry.has(id)).toBe(false);
    }
  });
});
