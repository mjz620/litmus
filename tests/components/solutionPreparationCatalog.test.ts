import { describe, expect, it } from "vitest";

import {
  getSolutionPreparationPracticePath,
  resolveExperimentId,
  SOLUTION_PREPARATION_PRACTICE_PATH
} from "../../src/components/ui/experimentRoutes";
import { validateSolutionPreparationV2 } from "../../src/lab-workflows/definitions/solution-preparation";
import { createSetupDrivenNativeSession } from "../../src/stores/setupDrivenLabSession";
import { resolveLabSceneConfiguration } from "../../src/components/lab/titration/setupDrivenScene";

describe("unified student catalog dilution practice", () => {
  it("exposes a guest practice path that is not a family-dispatch route", () => {
    expect(getSolutionPreparationPracticePath()).toBe(
      SOLUTION_PREPARATION_PRACTICE_PATH
    );
    expect(resolveExperimentId("solution-preparation")).toBeNull();
  });

  it("initializes the verified dilution seed on the shared immersive scene path", () => {
    const workflow = validateSolutionPreparationV2("2026-07-18T15:00:00.000Z");
    const session = createSetupDrivenNativeSession({
      sessionId: "catalog-dilution-practice",
      sessionSeed: "catalog-dilution-practice",
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
      expect.arrayContaining(["volumetricPipette", "volumetricFlask"])
    );
    expect(configuration.projectedState?.burette).toBeNull();
  });
});
