import { describe, expect, it } from "vitest";

import { listExperimentManifests } from "../../src/experiments/registry";
import { createTitrationRetryScenario } from "../../src/experiments/titration/retry";
import { titration } from "../../src/experiments/titration/titration";
import { engineRegistry } from "../../src/lab-workflows/registries/engines";
import { skillRegistry } from "../../src/lab-workflows/registries/skills";
import {
  LAB_WORKFLOW_RUNTIME_ERROR_CODES,
  assembleTitrationWorkflow
} from "../../src/lab-workflows/runtime";
import {
  labWorkflowDraftSchema,
  type LabWorkflowDraft
} from "../../src/lab-workflows/schema";
import {
  ENDPOINT_CONTROL_PRELAB_DRAFT,
  ENDPOINT_CONTROL_PRELAB_REPLAY_SESSION_SEED,
  ENDPOINT_CONTROL_PRELAB_VALIDATION_TIME
} from "../../src/lab-workflows/seeds";
import {
  WORKFLOW_VALIDATION_ISSUE_CODES,
  validateLabWorkflowSpec
} from "../../src/lab-workflows/validation";

/**
 * Phase-0 migration baselines. These tests intentionally describe current
 * coupling; later capability-runtime tickets must replace each assertion with
 * an explicit compatibility/migration test instead of silently deleting it.
 */
describe("current Lab Composer architecture characterization", () => {
  it("has two static experiment plugins but only one Composer engine", () => {
    expect(listExperimentManifests().map(({ id }) => id)).toEqual([
      "acid_base_titration",
      "precipitation_solubility"
    ]);
    expect(engineRegistry.list().map(({ id }) => id)).toEqual([
      "engine.titration.v1"
    ]);

    const precipitationSkill = skillRegistry.get("net_ionic_equations");
    expect(precipitationSkill).toMatchObject({
      availability: "planned",
      supportedFamilyIds: ["family.precipitation_solubility.v1"]
    });
  });

  it("requires the v1 family, single engine, seed, and ordered-step fields", () => {
    expect(ENDPOINT_CONTROL_PRELAB_DRAFT.schemaVersion).toBe("1.0.0");

    for (const field of [
      "familyId",
      "engineId",
      "initializationPresetId"
    ] as const) {
      const missing = structuredClone(ENDPOINT_CONTROL_PRELAB_DRAFT) as Record<
        string,
        unknown
      >;
      delete missing[field];
      expect(labWorkflowDraftSchema.safeParse(missing).success, field).toBe(
        false
      );
    }

    const reordered = structuredClone(
      ENDPOINT_CONTROL_PRELAB_DRAFT
    ) as LabWorkflowDraft;
    reordered.steps[0]!.order = 2;
    reordered.steps[1]!.order = 1;
    const outcome = validateLabWorkflowSpec(reordered, {
      checkedAt: ENDPOINT_CONTROL_PRELAB_VALIDATION_TIME
    });
    expect(outcome.schemaValid).toBe(true);
    if (!outcome.schemaValid) throw new Error("Expected schema-valid workflow");
    expect(outcome.validation.runnable).toBe(false);
    expect(outcome.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: WORKFLOW_VALIDATION_ISSUE_CODES.stepOrderInvalid
        })
      ])
    );
  });

  it("uses the ordered workflow step as a stricter runtime gate than the engine", async () => {
    const validated = validateLabWorkflowSpec(ENDPOINT_CONTROL_PRELAB_DRAFT, {
      checkedAt: ENDPOINT_CONTROL_PRELAB_VALIDATION_TIME
    });
    expect(validated.schemaValid).toBe(true);
    if (!validated.schemaValid) throw new Error("Expected runnable workflow");

    const scenario = createTitrationRetryScenario(
      "endpoint_control",
      ENDPOINT_CONTROL_PRELAB_REPLAY_SESSION_SEED
    );
    const engineState = titration.createInitialState(
      scenario.config,
      scenario.seed
    );
    const directEngineResult = titration.step(engineState, {
      type: "add_titrant",
      volumeML: 0.1,
      durationS: 2
    });
    expect(directEngineResult.events).toEqual([
      expect.objectContaining({ type: "add_titrant" })
    ]);

    const runtime = await assembleTitrationWorkflow(validated.spec, {
      sessionSeed: ENDPOINT_CONTROL_PRELAB_REPLAY_SESSION_SEED
    });
    expect(() =>
      runtime.dispatch({
        stepId: "approach_endpoint",
        actionId: "action.dispense.v1",
        actorComponentInstanceId: "titrant_burette",
        targetComponentInstanceIds: ["analyte_flask"],
        parameters: { volumeML: 0.1, durationS: 2 }
      })
    ).toThrowError(
      expect.objectContaining({
        code: LAB_WORKFLOW_RUNTIME_ERROR_CODES.stepMismatch
      })
    );
  });

  it("emits the compact legacy SemanticEvent shape without runtime IDs", () => {
    const scenario = createTitrationRetryScenario(
      "endpoint_control",
      "phase-0-semantic-event"
    );
    const state = titration.createInitialState(scenario.config, scenario.seed);
    const event = titration.step(state, {
      type: "read_meniscus",
      reportedML: state.buretteReadingML
    }).events[0]!;

    expect(event).toMatchObject({
      type: "read_meniscus",
      tSim: state.tSim,
      observation: expect.any(Object),
      flags: [],
      evidence: expect.any(Array)
    });
    expect(event).not.toHaveProperty("eventId");
    expect(event).not.toHaveProperty("sequence");
    expect(event).not.toHaveProperty("actionId");
    expect(event).not.toHaveProperty("equipmentInstanceIds");
    expect(event).not.toHaveProperty("workflowRuleIds");
  });
});
