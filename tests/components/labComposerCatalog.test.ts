import { describe, expect, it } from "vitest";

import {
  compatibleContainers,
  composerEquipmentCatalog,
  composerEquipmentConfigurationCatalog,
  composerMaterialCatalog,
  composerObservableUnitId,
  composerPermissionLabel,
  composerPlacementCatalog,
  composerToleranceObservableCatalog,
  placementSupportsEquipment,
  quantityPresetsFor
} from "../../src/components/teacher/lab-composer/catalog";
import { NATIVE_TITRATION_V2_DRAFT } from "../../src/lab-workflows/definitions/titration/native-endpoint-control";
import { PRECIPITATION_V2_DRAFT } from "../../src/lab-workflows/definitions/precipitation";

describe("teacher Lab Composer catalog projection", () => {
  it("exposes only verified, executable equipment and binding materials", () => {
    expect(composerEquipmentCatalog.length).toBeGreaterThan(0);
    expect(
      composerEquipmentCatalog.every(
        (entry) =>
          entry.performanceTier !== "restricted" &&
          entry.visualAdapterDefinitionAvailability === "verified" &&
          entry.mechanicalAdapterAvailability === "verified"
      )
    ).toBe(true);
    expect(composerMaterialCatalog.map(({ id }) => id)).toContain(
      "reagent.distilled_water.v1"
    );
    expect(
      composerMaterialCatalog.every(
        (entry) =>
          entry.availability === "verified" &&
          entry.usageModes.includes("material_binding")
      )
    ).toBe(true);
  });

  it("derives material containers, quantities, presets, and slots from exact registries", () => {
    const indicatorContainers = compatibleContainers(
      "reagent.bromothymol_blue.v1",
      NATIVE_TITRATION_V2_DRAFT.equipment
    );
    expect(indicatorContainers.map(({ instanceId }) => instanceId)).toEqual([
      "titrant_burette",
      "indicator_source"
    ]);

    expect(
      quantityPresetsFor("reagent.distilled_water.v1").map(({ id }) => id)
    ).toEqual([
      "quantity-preset.distilled_water_250ml.v1",
      "quantity-preset.distilled_water_50ml.v1"
    ]);
    expect(composerEquipmentCatalog.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "component.volumetric_pipette.v1",
        "component.volumetric_flask.v1",
        "component.wash_bottle.v1"
      ])
    );
    expect(
      composerEquipmentConfigurationCatalog.some(
        (entry) =>
          entry.id === "component_config.reagent_bottle.titrant_source.v1"
      )
    ).toBe(true);
    expect(
      composerPlacementCatalog.some(
        (entry) => entry.id === "placement.reagent_station.v1"
      )
    ).toBe(true);
    expect(
      placementSupportsEquipment(
        "placement.reagent_station.v1",
        "component.reagent_bottle.v1"
      )
    ).toBe(true);
    expect(
      placementSupportsEquipment(
        "placement.reagent_station.v1",
        "component.burette.v1"
      )
    ).toBe(false);
  });

  it("names the equipment so permissions sharing an action stay distinguishable", () => {
    const pours = PRECIPITATION_V2_DRAFT.permittedActions.filter(
      ({ actionId }) => actionId === "action.pour_liquid.v1"
    );
    expect(pours.length).toBeGreaterThan(1);

    const labels = pours.map((permission) =>
      composerPermissionLabel(permission, PRECIPITATION_V2_DRAFT.equipment)
    );
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.some((label) => label.includes("silver nitrate"))).toBe(true);
    expect(labels.some((label) => label.includes("sodium chloride"))).toBe(true);
  });

  it("offers only observables carrying a registered unit for tolerance ranges", () => {
    expect(composerToleranceObservableCatalog.length).toBeGreaterThan(0);
    expect(
      composerToleranceObservableCatalog.every(({ unitId }) =>
        unitId.startsWith("unit.")
      )
    ).toBe(true);

    const offered = composerToleranceObservableCatalog.map(({ id }) => id);
    expect(offered).toContain("observable.solution_concentration_m.v1");
    // Booleans and colours cannot carry a numeric range.
    expect(offered).not.toContain("observable.precipitate_observed.v1");
    expect(offered).not.toContain("observable.precipitate_color.v1");

    // Units must match what the authored labs already record.
    expect(composerObservableUnitId("observable.solution_volume_ml.v1")).toBe(
      "unit.ml.v1"
    );
    expect(
      composerObservableUnitId("observable.solution_concentration_m.v1")
    ).toBe("unit.mol_per_l.v1");
    expect(
      composerObservableUnitId("observable.calorimeter_temperature_c.v1")
    ).toBe("unit.celsius.v1");
  });
});
