import { describe, expect, it } from "vitest";

import { actionForTitrationIntent } from "../../src/components/lab/titration/useTitrationIntents";

describe("physical titration intent mapping", () => {
  it.each(["phenolphthalein", "bromothymol_blue", "methyl_orange"] as const)(
    "maps the %s bottle to indicator selection",
    (indicator) => {
      expect(
        actionForTitrationIntent({
          type: "indicator_bottle_clicked",
          indicator
        })
      ).toEqual({
        type: "select_indicator",
        indicator
      });
    }
  );

  it("maps the wash bottle to a water rinse", () => {
    expect(actionForTitrationIntent({ type: "wash_bottle_clicked" })).toEqual({
      type: "rinse_burette",
      solvent: "water"
    });
  });

  it("maps the titrant bottle to a titrant rinse", () => {
    expect(
      actionForTitrationIntent({ type: "titrant_bottle_clicked" })
    ).toEqual({
      type: "rinse_burette",
      solvent: "titrant"
    });
  });

  it("maps the funnel to the existing fill action", () => {
    expect(actionForTitrationIntent({ type: "funnel_clicked" })).toEqual({
      type: "fill_burette"
    });
  });
});
