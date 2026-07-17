import { describe, expect, it } from "vitest";

import {
  EQUIPMENT,
  EQUIPMENT_IDS,
  getVisibleControlGroups
} from "../../src/components/lab/titration/equipment";

describe("selectable equipment metadata", () => {
  it("keeps the original equipment names and appends the two new stations", () => {
    expect(EQUIPMENT_IDS).toEqual([
      "burette",
      "flask",
      "meniscus",
      "indicatorShelf",
      "washStation"
    ]);
    expect(EQUIPMENT.burette.name).toBe("Burette");
    expect(EQUIPMENT.flask.name).toBe("Flask & indicator");
    expect(EQUIPMENT.meniscus.name).toBe("Meniscus");
    expect(EQUIPMENT.indicatorShelf.name).toBe("Indicator shelf");
    expect(EQUIPMENT.washStation.name).toBe("Wash station");
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
      "reading"
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
