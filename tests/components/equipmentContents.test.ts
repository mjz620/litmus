import { describe, expect, it } from "vitest";

import { equipmentContentsForFocus } from "../../src/components/lab/setup-driven/labScene";
import { validateNativeFullTitrationV2 } from "../../src/lab-workflows/definitions/titration/native-full-titration";
import { createSetupDrivenNativeSession } from "../../src/stores/setupDrivenLabSession";

const CHECKED_AT = "2026-07-19T12:00:00.000Z";

function titrationProjection() {
  const workflow = validateNativeFullTitrationV2(CHECKED_AT);
  return createSetupDrivenNativeSession({
    sessionId: "equipment-contents-test",
    sessionSeed: "equipment-contents-seed",
    selection: {
      workflowId: workflow.id,
      workflowHash: workflow.validation.canonicalSpecHash
    },
    workflow
  }).getProjection();
}

/*
 * Determining the analyte's concentration is the entire point of a titration.
 * The contents readout originally printed it straight from the registry — and
 * the registered display name carries it too ("0.100 M hydrochloric acid") —
 * so focusing the flask handed the student the answer.
 */
describe("equipment contents never give away the unknown", () => {
  it("reports the analyte by volume only, with no concentration", () => {
    const contents = equipmentContentsForFocus(titrationProjection(), "flask");

    expect(contents).toHaveLength(1);
    const [line] = contents;
    expect(line).toContain("25.00 mL");
    expect(line).not.toMatch(/\d\s*M\b/);
    expect(line?.toLowerCase()).toContain("hydrochloric acid");
  });

  it("still reports the titrant standard's concentration at its source", () => {
    // A standard the student is told to use is not a spoiler; they need it.
    const contents = equipmentContentsForFocus(
      titrationProjection(),
      "washStation"
    );

    expect(contents.join(" ")).toMatch(/0\.100 M/);
    expect(contents.join(" ")).toContain("50.00 mL");
  });

  it("does not repeat a concentration already carried by the name", () => {
    const contents = equipmentContentsForFocus(
      titrationProjection(),
      "washStation"
    );

    // "0.100 M sodium hydroxide — 0.100 M · 50.00 mL" was the earlier defect.
    for (const line of contents) {
      expect(line.match(/M\b/g)?.length ?? 0).toBeLessThanOrEqual(1);
    }
  });

  it("returns nothing for equipment holding no material", () => {
    expect(equipmentContentsForFocus(titrationProjection(), "burette")).toEqual(
      []
    );
    expect(equipmentContentsForFocus(titrationProjection(), null)).toEqual([]);
  });
});
