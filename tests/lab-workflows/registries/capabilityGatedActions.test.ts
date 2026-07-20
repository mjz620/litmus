import { describe, expect, it } from "vitest";

import { actionRegistry } from "../../../src/lab-workflows/registries/actions";
import { componentRegistry } from "../../../src/lab-workflows/registries/components";

/**
 * Glassware swappability rests on one rule: an empty component allowlist means
 * "capability-gated", not "nothing permitted". If that inverts, adding a vessel
 * silently stops working everywhere.
 */
describe("capability-gated action compatibility", () => {
  it("leaves pour_liquid without a target component allowlist", () => {
    const pour = actionRegistry.get("action.pour_liquid.v1");
    expect(pour.targetComponentIds).toEqual([]);
    expect(pour.requiredTargetCapabilityIds).toEqual([
      "capability.contain_liquid.v1",
      "capability.receive_liquid.v1"
    ]);
  });

  it("accepts every registered vessel carrying the required capabilities", () => {
    const pour = actionRegistry.get("action.pour_liquid.v1");
    const receivers = componentRegistry
      .list()
      .filter((component) =>
        pour.requiredTargetCapabilityIds.every((capabilityId) =>
          component.capabilityIds.includes(capabilityId)
        )
      )
      .map(({ id }) => id);

    // Three different labs' vessels, all valid pour targets without
    // pour_liquid naming any of them.
    expect(receivers).toContain("component.beaker.v1");
    expect(receivers).toContain("component.calorimeter.v1");
    expect(receivers).toContain("component.erlenmeyer_flask.v1");
  });

  it("still excludes equipment that cannot receive liquid", () => {
    const pour = actionRegistry.get("action.pour_liquid.v1");
    const thermometer = componentRegistry.get("component.thermometer.v1");
    const satisfied = pour.requiredTargetCapabilityIds.every((capabilityId) =>
      thermometer.capabilityIds.includes(capabilityId)
    );
    expect(satisfied).toBe(false);
  });

  it("keeps a deliberately apparatus-bound action restricted", () => {
    // Lid sealing is specific to the calorimeter; it must not become open.
    const lid = actionRegistry.get("action.set_calorimeter_lid.v1");
    expect(lid.actorComponentIds).toEqual(["component.calorimeter.v1"]);
  });
});
