import { describe, expect, it } from "vitest";

import { resolveLabSceneConfiguration } from "../../src/components/lab/setup-driven/labScene";
import { LAB_PALETTE } from "../../src/components/lab/three/labPalette";
import {
  SOLUTION_PREPARATION_V2_EXPECTED_HASH,
  validateSolutionPreparationV2
} from "../../src/lab-workflows/definitions/solution-preparation";
import {
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  type NormalizedLabAction
} from "../../src/lab-workflows/runtime";
import { createSetupDrivenNativeSession } from "../../src/stores/setupDrivenLabSession";

/*
 * The point of the dilution lab is that the product is visibly weaker than the
 * stock it came from. That claim spans the chemistry model, the reagent
 * registry, the scene projection, and the material ledger, so asserting the
 * colour helper alone would not catch the chain going dark — which is how the
 * precipitation visuals regressed twice before. These tests run a real session
 * and read the colours the scene would actually hand to three.js.
 */

const STOCK_ADAPTER = "visual-adapter.reagent_bottle.v1";
const PIPETTE_ADAPTER = "visual-adapter.volumetric_pipette.v1";
const FLASK_ADAPTER = "visual-adapter.volumetric_flask.v1";

const workflow = validateSolutionPreparationV2("2026-07-18T15:00:00.000Z");

function action(
  permissionId: string,
  actionId: string,
  sourceEquipmentInstanceId: string,
  targetEquipmentInstanceIds: readonly string[],
  parameters: NormalizedLabAction["parameters"] = []
): NormalizedLabAction {
  return {
    schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
    permissionId,
    actionId,
    sourceEquipmentInstanceId,
    targetEquipmentInstanceIds,
    parameters
  };
}

function session() {
  return createSetupDrivenNativeSession({
    sessionId: "dilution-visuals",
    sessionSeed: "dilution-visuals-seed",
    selection: {
      workflowId: workflow.id,
      workflowHash: SOLUTION_PREPARATION_V2_EXPECTED_HASH
    },
    workflow
  });
}

const condition = () =>
  action(
    "permission.condition_pipette",
    "action.rinse_transfer_device.v1",
    "stock_bottle",
    ["transfer_pipette"]
  );
const aspirate = (volumeML: number) =>
  action(
    "permission.aspirate_stock",
    "action.transfer_liquid.v1",
    "stock_bottle",
    ["transfer_pipette"],
    [{ key: "volumeML", valueType: "number", value: volumeML }]
  );
const deliver = (volumeML: number) =>
  action(
    "permission.deliver_aliquot",
    "action.transfer_liquid.v1",
    "transfer_pipette",
    ["preparation_flask"],
    [{ key: "volumeML", valueType: "number", value: volumeML }]
  );
const fill = (finalVolumeML: number) =>
  action(
    "permission.fill_to_mark",
    "action.fill_to_mark.v1",
    "water_bottle",
    ["preparation_flask"],
    [{ key: "finalVolumeML", valueType: "number", value: finalVolumeML }]
  );

const mix = () =>
  action(
    "permission.mix_solution",
    "action.mix_solution.v1",
    "preparation_flask",
    [],
    [{ key: "inversions", valueType: "number", value: 10 }]
  );

function luminance(hex: string): number {
  const value = hex.replace(/^#/, "");
  const channel = (offset: number) =>
    Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}

describe("dilution lab visuals", () => {
  it("tints the stock bottle with the undiluted copper(II) nitrate colour", () => {
    const { equipmentLiquidColors } = resolveLabSceneConfiguration(
      session().getProjection()
    );

    const stock = equipmentLiquidColors[STOCK_ADAPTER];
    expect(stock).toBeDefined();
    expect(stock).not.toBe(LAB_PALETTE.colorlessLiquid);
    // 2.000 mol/L is past the published 1 mol/L reference, so it reads darker
    // than the reference tint rather than equal to it.
    expect(luminance(stock!)).toBeLessThan(luminance("#1F9BAF"));
  });

  it("renders the stock bottle as holding liquid rather than empty glass", () => {
    const { equipmentFillFractions } = resolveLabSceneConfiguration(
      session().getProjection()
    );

    expect(equipmentFillFractions[STOCK_ADAPTER]).toBeGreaterThan(0);
  });

  it("leaves the empty flask colourless before any stock is delivered", () => {
    const { equipmentLiquidColors } = resolveLabSceneConfiguration(
      session().getProjection()
    );

    expect(equipmentLiquidColors[FLASK_ADAPTER]).toBeUndefined();
  });

  it("carries the stock colour into the pipette on aspiration", () => {
    const runtime = session();
    runtime.dispatch(condition());
    runtime.dispatch(aspirate(10));

    const { equipmentLiquidColors } = resolveLabSceneConfiguration(
      runtime.getProjection()
    );

    expect(equipmentLiquidColors[PIPETTE_ADAPTER]).toBe(
      equipmentLiquidColors[STOCK_ADAPTER]
    );
  });

  it("pales the flask as the aliquot is made up to the mark", () => {
    const runtime = session();
    runtime.dispatch(condition());
    runtime.dispatch(aspirate(10));
    runtime.dispatch(deliver(10));

    const undiluted = resolveLabSceneConfiguration(
      runtime.getProjection()
    ).equipmentLiquidColors;
    // Before dilution the flask holds neat stock at the aliquot's own strength.
    expect(undiluted[FLASK_ADAPTER]).toBeDefined();

    runtime.dispatch(fill(100));

    const diluted = resolveLabSceneConfiguration(
      runtime.getProjection()
    ).equipmentLiquidColors;
    const flask = diluted[FLASK_ADAPTER];
    expect(flask).toBeDefined();

    // The product is a tenth of the stock, so it must read lighter than both
    // the bottle it came from and the flask before water was added.
    expect(luminance(flask!)).toBeGreaterThan(
      luminance(undiluted[FLASK_ADAPTER]!)
    );
    expect(luminance(flask!)).toBeGreaterThan(
      luminance(diluted[STOCK_ADAPTER]!)
    );
    // ...but still visibly teal rather than washed out to plain water.
    expect(flask).not.toBe(LAB_PALETTE.colorlessLiquid);
    expect(luminance(flask!)).toBeLessThan(
      luminance(LAB_PALETTE.colorlessLiquid)
    );
  });

  it("depletes the wash bottle as diluent is spent", () => {
    const runtime = session();
    const before = resolveLabSceneConfiguration(runtime.getProjection())
      .equipmentFillFractions["visual-adapter.wash_bottle.v1"];

    runtime.dispatch(condition());
    runtime.dispatch(aspirate(10));
    runtime.dispatch(deliver(10));
    runtime.dispatch(fill(100));

    const after = resolveLabSceneConfiguration(runtime.getProjection())
      .equipmentFillFractions["visual-adapter.wash_bottle.v1"];

    expect(after).toBeLessThan(before!);
  });
});

describe("dilution lab technique-order mistakes", () => {
  it("still completes when the pipette is conditioned late, with the violation recorded", () => {
    const runtime = session();
    // The common slip: aspirate straight away, forget to condition first,
    // then condition the emptied pipette on the way past.
    runtime.dispatch(aspirate(10));
    runtime.dispatch(deliver(10));
    runtime.dispatch(condition());
    runtime.dispatch(fill(100));
    runtime.dispatch(mix());

    const diagnoses = runtime.getGenericState().diagnoses;
    const ordering = diagnoses.find(
      ({ ruleId }) => ruleId === "rule.condition_before_aspirate"
    );

    // The mistake is on the record and costs the rubric criterion...
    expect(ordering?.status).toBe("violated");
    // ...but the student is not trapped in a lab that can never finish.
    expect(runtime.getState().workflowStatus).toBe("completed");
  });

  it("still ends the attempt when the flask is diluted before the aliquot arrives", () => {
    const runtime = session();
    runtime.dispatch(fill(90));

    // `rule.deliver_before_fill` is terminal: this one is meant to stop the run.
    expect(runtime.getState().workflowStatus).toBe("failed");
  });
});
