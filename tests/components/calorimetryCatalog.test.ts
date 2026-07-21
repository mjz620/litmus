import { describe, expect, it } from "vitest";

import {
  CALORIMETRY_PRACTICE_PATH,
  getCalorimetryPracticePath,
  resolveExperimentId
} from "../../src/components/ui/experimentRoutes";
import { validateDissolutionCalorimetryV2 } from "../../src/lab-workflows/definitions/calorimetry";
import { resolveLabSceneConfiguration } from "../../src/components/lab/titration/setupDrivenScene";
import { createSetupDrivenNativeSession } from "../../src/stores/setupDrivenLabSession";

describe("unified student catalog calorimetry practice", () => {
  it("exposes a guest practice path that is not a family-dispatch route", () => {
    expect(getCalorimetryPracticePath()).toBe(CALORIMETRY_PRACTICE_PATH);
    expect(resolveExperimentId("calorimetry")).toBeNull();
  });

  it("initializes the measured dissolution workflow on the shared immersive scene path", () => {
    const workflow = validateDissolutionCalorimetryV2(
      "2026-07-19T12:00:00.000Z"
    );
    const session = createSetupDrivenNativeSession({
      sessionId: "catalog-calorimetry-practice",
      sessionSeed: "catalog-calorimetry-practice",
      selection: {
        workflowId: workflow.id,
        workflowHash: workflow.validation.canonicalSpecHash
      },
      workflow
    });
    const configuration = resolveLabSceneConfiguration(
      session.getProjection()
    );
    expect(configuration.mode).toBe("setup_driven_v2");
    expect(configuration.selectableEquipmentIds).toEqual(
      expect.arrayContaining([
        "balance",
        "weighingBoat",
        "calorimeter",
        "thermometer"
      ])
    );
    expect(configuration.projectedState?.burette).toBeNull();
  });
});
