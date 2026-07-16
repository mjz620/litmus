import { describe, expect, it } from "vitest";

import {
  formatBuretteVolume,
  formatPH
} from "../../src/experiments/titration/display";
import {
  computePH,
  EXAMPLE_STRONG,
  titration
} from "../../src/experiments/titration/titration";

describe("titration display formatting", () => {
  it("formats burette readings to the nearest 0.05 mL", () => {
    expect(formatBuretteVolume(12.374)).toBe("12.35");
    expect(formatBuretteVolume(12.375)).toBe("12.40");
    expect(formatBuretteVolume(12.376)).toBe("12.40");
    expect(formatBuretteVolume(1.025)).toBe("1.05");
    expect(formatBuretteVolume(22.025)).toBe("22.05");
  });

  it("keeps two visible decimal places for exact burette readings", () => {
    expect(formatBuretteVolume(0)).toBe("0.00");
    expect(formatBuretteVolume(22)).toBe("22.00");
    expect(formatBuretteVolume(22.05)).toBe("22.05");
  });

  it("formats pH to two decimal places", () => {
    expect(formatPH(7)).toBe("7.00");
    expect(formatPH(3.600974)).toBe("3.60");
  });

  it("does not round the full-precision titrant volume in engine state", () => {
    const initialState = titration.createInitialState(EXAMPLE_STRONG);
    const filledState = titration.step(initialState, {
      type: "fill_burette"
    }).state;
    const { state } = titration.step(filledState, {
      type: "add_titrant",
      volumeML: 0.1234,
      durationS: 2
    });

    expect(state.titrantAddedML).toBe(0.1234);
    expect(formatBuretteVolume(state.titrantAddedML)).toBe("0.10");
    expect(Number(formatBuretteVolume(state.titrantAddedML))).not.toBe(
      state.titrantAddedML
    );
  });

  it("does not round the full-precision chemistry result", () => {
    const rawPH = computePH(EXAMPLE_STRONG, 24.875, 1);
    const displayedPH = formatPH(rawPH);

    expect(rawPH).not.toBe(Number(displayedPH));
    expect(displayedPH).toBe("3.60");
  });
});
