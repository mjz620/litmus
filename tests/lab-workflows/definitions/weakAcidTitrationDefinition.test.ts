import { describe, expect, it } from "vitest";

import {
  WEAK_ACID_TITRATION_V1_DRAFT,
  WEAK_ACID_TITRATION_V1_EXPECTED_HASH,
  WEAK_ACID_TITRATION_V1_SOURCE_HASH,
  validateWeakAcidTitrationV1
} from "../../../src/lab-workflows/definitions/titration/weak-acid-titration";
import { createFullTitrationTracePlan } from "../../../src/lab-workflows/definitions/titration/fullTitrationTracePlan";
import { materialRegistry } from "../../../src/lab-workflows/registries/reagents";
import {
  createGenericLabActionTrace,
  runGenericTraceSuite
} from "../../../src/lab-workflows/replay";
import { createCapabilityGenericRuntimePorts } from "../../../src/lab-workflows/runtime";

const CHECKED_AT = "2026-07-20T17:00:00.000Z";

describe("weak-acid titration definition", () => {
  it("is a cited, frozen acetic-acid/NaOH workflow with registered pKa metadata", () => {
    expect(Object.isFrozen(WEAK_ACID_TITRATION_V1_DRAFT)).toBe(true);
    expect(WEAK_ACID_TITRATION_V1_DRAFT.sourceRequest).toContain("iciq.org");
    expect(
      WEAK_ACID_TITRATION_V1_DRAFT.materials.find(
        ({ instanceId }) => instanceId === "analyte"
      )
    ).toMatchObject({
      materialProfileId: "reagent.acetic_acid_0_100m.v1",
      quantityPresetId: "quantity-preset.acetic_acid_0_100m_25ml.v1"
    });
    expect(
      materialRegistry.get("reagent.acetic_acid_0_100m.v1").acidBaseDissociation
    ).toEqual({ type: "weak_acid", pKa25C: 4.756 });
    expect(
      materialRegistry.get("reagent.ammonia_0_100m.v1").acidBaseDissociation
    ).toEqual({ type: "weak_base", pKb25C: 4.751 });
  });

  it("validates as runnable on the capability-native chemistry model", () => {
    const workflow = validateWeakAcidTitrationV1(CHECKED_AT);
    expect(workflow.validation.canonicalSpecHash).toBe(
      WEAK_ACID_TITRATION_V1_EXPECTED_HASH
    );
    expect(WEAK_ACID_TITRATION_V1_SOURCE_HASH).toBe(
      WEAK_ACID_TITRATION_V1_EXPECTED_HASH
    );
    expect(workflow.compatibility).toBeUndefined();
    expect(
      workflow.validation.resolvedChemistryModels.map(({ modelId }) => modelId)
    ).toContain("chemistry-model.acid_base_titration.v1");
    expect(workflow.coachPolicy.triggers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          flagIds: ["flag.indicator_unsuitable.v1"],
          staySilentOnEventReasonIds: ["evidence.indicator_suitable.v1"]
        })
      ])
    );
  });

  it("replays the supported full procedure to a basic equivalence region", () => {
    const workflow = validateWeakAcidTitrationV1(CHECKED_AT);
    const valid = createFullTitrationTracePlan().find(
      ({ kind }) => kind === "valid"
    );
    if (!valid) throw new Error("Missing valid full-titration trace.");
    const [result] = runGenericTraceSuite(
      [
        {
          kind: valid.kind,
          trace: createGenericLabActionTrace({
            traceId: "trace.weak_acid_titration.valid",
            sessionId: "weak-acid-titration-valid",
            sessionSeed: "weak-acid-titration-seed",
            workflow,
            actions: valid.actions
          })
        }
      ],
      () => ({
        workflow,
        ports: createCapabilityGenericRuntimePorts(workflow)
      })
    );
    expect(result!.finalState.workflowStatus).toBe("completed");
    expect(
      result!.finalState.chemistry.observables.find(
        ({ observableId }) => observableId === "observable.solution_ph.v1"
      )?.value
    ).toBeGreaterThan(7);
    expect(
      result!.finalState.chemistry.observables.find(
        ({ observableId }) =>
          observableId === "observable.indicator_suitable.v1"
      )?.value
    ).toBe(true);
  });
});
