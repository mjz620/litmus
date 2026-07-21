import { describe, expect, it } from "vitest";

import { getFlaskLiquidColor } from "../../src/components/lab/three/sceneProjection";
import { LAB_PALETTE } from "../../src/components/lab/three/labPalette";
import { resolveLabSceneConfiguration } from "../../src/components/lab/setup-driven/labScene";
import { validatePrecipitationV2 } from "../../src/lab-workflows/definitions/precipitation";
import { GENERIC_LAB_RUNTIME_SCHEMA_VERSION } from "../../src/lab-workflows/runtime";
import { createSetupDrivenNativeSession } from "../../src/stores/setupDrivenLabSession";

const CHECKED_AT = "2026-07-19T12:00:00.000Z";

function pour(permissionId: string, sourceEquipmentInstanceId: string) {
  return {
    schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
    permissionId,
    actionId: "action.pour_liquid.v1",
    sourceEquipmentInstanceId,
    targetEquipmentInstanceIds: ["mixing_beaker"],
    // Within the authored 0.01–25 mL bound for both pours.
    parameters: [
      { key: "volumeML", valueType: "number", value: 10 } as const
    ]
  } as const;
}

function startSession() {
  const workflow = validatePrecipitationV2(CHECKED_AT);
  return createSetupDrivenNativeSession({
    sessionId: "precipitation-visual-test",
    sessionSeed: "precipitation-visual-seed",
    selection: {
      workflowId: workflow.id,
      workflowHash: workflow.validation.canonicalSpecHash
    },
    workflow
  });
}

/*
 * The beaker colour is the entire observable outcome of the precipitation
 * workflow. It regressed to invisible twice over: LabScene accepted a
 * `beakerContentsColor` prop no caller passed, and the palette had no entry
 * for the "white" label the solubility rules emit, so even a wired colour
 * fell back to colorless. These tests walk the full chain — engine observable
 * to scene configuration to rendered hex.
 */
describe("precipitation is visible in the scene", () => {
  it("shows clear contents before the reagents are combined", () => {
    const session = startSession();
    const configuration = resolveLabSceneConfiguration(session.getProjection());
    expect(configuration.projectedState?.beaker).not.toBeNull();
    expect(configuration.projectedState?.beaker?.observableColor).toBe("clear");
    expect(
      getFlaskLiquidColor(configuration.projectedState?.beaker?.observableColor)
    ).toBe(LAB_PALETTE.colorlessLiquid);
  });

  it("turns the beaker white once silver nitrate meets sodium chloride", () => {
    const session = startSession();
    session.dispatch(pour("permission.pour_silver", "silver_bottle"));
    session.dispatch(pour("permission.pour_chloride", "chloride_bottle"));

    const configuration = resolveLabSceneConfiguration(session.getProjection());
    const observedColor =
      configuration.projectedState?.beaker?.observableColor;

    expect(observedColor).toBe("white");
    // A precipitate the student can actually see: not the colorless fallback.
    const rendered = getFlaskLiquidColor(observedColor);
    expect(rendered).toBe(LAB_PALETTE.whitePrecipitate);
    expect(rendered).not.toBe(LAB_PALETTE.colorlessLiquid);
  });

  it("projects the precipitate colour as an engine-owned observable", () => {
    const session = startSession();
    session.dispatch(pour("permission.pour_silver", "silver_bottle"));
    session.dispatch(pour("permission.pour_chloride", "chloride_bottle"));

    const projection = session.getProjection();
    expect(projection.observables["observable.precipitate_color.v1"]).toBe(
      "white"
    );
    expect(projection.observables["observable.precipitate_observed.v1"]).toBe(
      true
    );
  });
});

describe("liquid colour vocabulary covers every engine label", () => {
  it("maps every solubility-rule colour to a distinct rendered value", () => {
    // Labels the precipitation model can emit (solubility.ts rules + no-reaction).
    for (const label of ["white", "blue", "rust brown"]) {
      expect(getFlaskLiquidColor(label)).not.toBe(LAB_PALETTE.colorlessLiquid);
    }
    expect(getFlaskLiquidColor("clear")).toBe(LAB_PALETTE.colorlessLiquid);
  });
});
