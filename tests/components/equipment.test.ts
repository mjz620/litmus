import { describe, expect, it } from "vitest";

import {
  EQUIPMENT,
  EQUIPMENT_IDS,
  getVisibleControlGroups
} from "../../src/components/lab/titration/equipment";

describe("selectable equipment metadata", () => {
  it("keeps the original titration names and appends the setup-driven stations", () => {
    expect(EQUIPMENT_IDS).toEqual([
      "burette",
      "flask",
      "meniscus",
      "indicatorShelf",
      "washStation",
      "volumetricPipette",
      "volumetricFlask",
      "washBottle",
      "reagentBottle",
      "calorimeter",
      "thermometer",
      "beaker",
      "balance",
      "weighingBoat"
    ]);
    expect(EQUIPMENT.burette.name).toBe("Burette");
    expect(EQUIPMENT.flask.name).toBe("Flask & indicator");
    expect(EQUIPMENT.meniscus.name).toBe("Meniscus");
    expect(EQUIPMENT.indicatorShelf.name).toBe("Indicator shelf");
    expect(EQUIPMENT.washStation.name).toBe("Wash station");
    expect(EQUIPMENT.volumetricPipette.name).toBe("Volumetric pipette");
    expect(EQUIPMENT.volumetricFlask.name).toBe("Volumetric flask");
    expect(EQUIPMENT.washBottle.name).toBe("Wash bottle");
    expect(EQUIPMENT.reagentBottle.name).toBe("Stock bottle");
    expect(EQUIPMENT.calorimeter.name).toBe("Coffee-cup calorimeter");
    expect(EQUIPMENT.thermometer.name).toBe("Digital thermometer");
    expect(EQUIPMENT.beaker.name).toBe("Beaker");
    expect(EQUIPMENT.balance.name).toBe("Laboratory balance");
    expect(EQUIPMENT.weighingBoat.name).toBe("Weighing boat");
  });

  it("names every selectable equipment item with a purpose", () => {
    for (const id of EQUIPMENT_IDS) {
      expect(EQUIPMENT[id].name.length).toBeGreaterThan(0);
      expect(EQUIPMENT[id].purpose.length).toBeGreaterThan(0);
      expect(EQUIPMENT[id].controlGroups.length).toBeGreaterThan(0);
    }
  });

  it("shows every control group when nothing is selected", () => {
    expect(getVisibleControlGroups(null)).toEqual([
      "prepare",
      "indicator",
      "deliver",
      "reading",
      "solution",
      "calorimetry",
      "weighing"
    ]);
  });

  it("maps the burette to its rinse/fill and stopcock delivery controls", () => {
    expect(getVisibleControlGroups("burette")).toEqual(["prepare", "deliver"]);
  });

  it("maps the flask to indicator controls", () => {
    expect(getVisibleControlGroups("flask")).toEqual(["indicator"]);
  });

  it("maps the meniscus to the reading controls", () => {
    expect(getVisibleControlGroups("meniscus")).toEqual(["reading"]);
  });

  it("maps the indicator shelf to indicator controls", () => {
    expect(getVisibleControlGroups("indicatorShelf")).toEqual(["indicator"]);
  });

  it("maps the wash station to preparation controls", () => {
    expect(getVisibleControlGroups("washStation")).toEqual(["prepare"]);
  });

  it("keeps every control group reachable across selections", () => {
    const reachable = new Set(
      EQUIPMENT_IDS.flatMap((id) => getVisibleControlGroups(id))
    );

    expect([...reachable].sort()).toEqual(
      [...getVisibleControlGroups(null)].sort()
    );
  });
});
