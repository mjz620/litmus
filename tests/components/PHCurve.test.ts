import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PHCurve } from "../../src/components/lab/PHCurve";
import {
  EXAMPLE_STRONG,
  titration
} from "../../src/experiments/titration/titration";

describe("PHCurve", () => {
  it("renders a graceful empty state without an SVG", () => {
    const markup = renderToStaticMarkup(
      createElement(PHCurve, { points: [], maxVolumeML: 50 })
    );

    expect(markup).toContain("Add titrant to record the first pH measurement.");
    expect(markup).not.toContain("<svg");
  });

  it("renders an accessible SVG, current values, and axis labels", () => {
    const markup = renderToStaticMarkup(
      createElement(PHCurve, {
        points: [
          { volumeML: 0.1, pH: 1 },
          { volumeML: 1, pH: 1.04 }
        ],
        maxVolumeML: 50
      })
    );

    expect(markup).toContain('role="img"');
    expect(markup).toContain('data-point-count="2"');
    expect(markup).toContain("Curve contains 2 measurements.");
    expect(markup).toContain("1.00 mL · pH 1.04");
    expect(markup).toContain("<polyline");
    expect(markup).toContain("Titrant added (mL)");
  });

  it("changes from empty state to plotted engine-owned curve data", () => {
    const initial = titration.createInitialState(EXAMPLE_STRONG);
    const filled = titration.step(initial, { type: "fill_burette" }).state;
    const updated = titration.step(filled, {
      type: "add_titrant",
      volumeML: 0.1,
      durationS: 4
    }).state;

    const initialMarkup = renderToStaticMarkup(
      createElement(PHCurve, {
        points: initial.curve,
        maxVolumeML: initial.config.buretteCapacityML
      })
    );
    const updatedMarkup = renderToStaticMarkup(
      createElement(PHCurve, {
        points: updated.curve,
        maxVolumeML: updated.config.buretteCapacityML
      })
    );

    expect(initialMarkup).not.toContain("<svg");
    expect(updatedMarkup).toContain('data-point-count="1"');
    expect(updatedMarkup).toContain("0.10 mL · pH 1.00");
  });
});
