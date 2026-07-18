import { describe, expect, it } from "vitest";

import {
  compatibleContainers,
  composerEquipmentCatalog,
  composerEquipmentConfigurationCatalog,
  composerMaterialCatalog,
  composerPlacementCatalog,
  placementSupportsEquipment,
  quantityPresetsFor
} from "../../src/components/teacher/lab-composer/catalog";
import { NATIVE_TITRATION_V2_DRAFT } from "../../src/lab-workflows/definitions/titration/native-endpoint-control";

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
    ).toEqual(["quantity-preset.distilled_water_50ml.v1"]);
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
});
