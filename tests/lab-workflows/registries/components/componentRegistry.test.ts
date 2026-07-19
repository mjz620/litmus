import { describe, expect, it } from "vitest";

import {
  COMPONENT_REGISTRY_ENTRIES,
  ComponentRegistryError,
  componentRegistry,
  componentRegistrySnapshot,
  createComponentRegistry
} from "../../../../src/lab-workflows/registries/components";

describe("component registry", () => {
  it("lists the verified titration and solution-preparation component contracts", () => {
    expect(componentRegistry.snapshotId).toBe("components.3.3.0");
    expect(componentRegistry.list().map(({ id }) => id)).toEqual([
      "component.burette.v1",
      "component.erlenmeyer_flask.v1",
      "component.reagent_bottle.v1",
      "component.indicator_bottle.v1",
      "component.volumetric_pipette.v1",
      "component.volumetric_flask.v1",
      "component.wash_bottle.v1",
      "component.calorimeter.v1",
      "component.thermometer.v1"
    ]);
    expect(componentRegistrySnapshot.entries).toBe(componentRegistry.list());
  });

  it("uses exact lookup and fails closed for an unknown or future ID", () => {
    expect(componentRegistry.has("component.burette.v1")).toBe(true);
    expect(componentRegistry.get("component.burette.v1").version).toBe("1.0.0");
    expect(componentRegistry.has("component.beaker.v1")).toBe(false);

    expect(() => componentRegistry.get("component.beaker.v1")).toThrowError(
      expect.objectContaining({
        name: "ComponentRegistryError",
        code: "component_registry.unknown_id",
        registryId: "component.beaker.v1"
      })
    );
  });

  it("rejects duplicate IDs with a stable error", () => {
    const duplicate = COMPONENT_REGISTRY_ENTRIES[0];

    expect(() =>
      createComponentRegistry([duplicate, { ...duplicate }])
    ).toThrowError(
      new ComponentRegistryError(
        "component_registry.duplicate_id",
        "component.burette.v1"
      )
    );
  });

  it("returns deeply read-only registry data", () => {
    const entries = componentRegistry.list();
    const burette = componentRegistry.get("component.burette.v1");

    expect(Object.isFrozen(entries)).toBe(true);
    expect(Object.isFrozen(burette)).toBe(true);
    expect(Object.isFrozen(burette.capabilityIds)).toBe(true);
    expect(Object.isFrozen(burette.stateSchema.fields)).toBe(true);
    expect(Object.isFrozen(burette.allowedActionIds)).toBe(true);
    expect(Object.isFrozen(burette.allowedRoleIds)).toBe(true);
    expect(Object.isFrozen(burette.measurement)).toBe(true);
  });
});
