import { describe, expect, it } from "vitest";

import { replayTitrationActions } from "../../src/experiments/titration/replay";
import {
  EXAMPLE_STRONG,
  type TitrationAction
} from "../../src/experiments/titration/titration";

describe("titration action replay", () => {
  it("reproduces every fill, reading, and cumulative delivery", () => {
    const actions = [
      { type: "rinse_burette", solvent: "titrant" },
      { type: "select_indicator", indicator: "phenolphthalein" },
      { type: "fill_burette", volumeML: 30 },
      { type: "add_titrant", volumeML: 20, durationS: 100 },
      { type: "fill_burette", volumeML: 15 },
      { type: "add_titrant", volumeML: 5, durationS: 25 },
      { type: "read_meniscus", reportedML: 30 }
    ] satisfies TitrationAction[];

    const first = replayTitrationActions(EXAMPLE_STRONG, actions);
    const second = replayTitrationActions(EXAMPLE_STRONG, actions);

    expect(second).toEqual(first);
    expect(first.state.titrantAddedML).toBe(25);
    expect(first.state.buretteAvailableML).toBe(20);
    expect(first.state.buretteReadingML).toBe(30);
    expect(first.state.fillHistory).toEqual([
      {
        requestedML: 30,
        resultingAvailableML: 30,
        currentReadingML: 20,
        kind: "initial",
        tSim: 0
      },
      {
        requestedML: 15,
        resultingAvailableML: 25,
        currentReadingML: 25,
        kind: "refill",
        tSim: 100
      }
    ]);
    expect(first.events.map((event) => event.type)).toEqual([
      "rinse_burette",
      "select_indicator",
      "fill_burette",
      "add_titrant",
      "refill_burette",
      "add_titrant",
      "read_meniscus"
    ]);
  });
});
