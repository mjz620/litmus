import { describe, expect, it } from "vitest";

import { createTitrationRetryScenario } from "../../../src/experiments/titration/retry";
import { replayTitrationActions } from "../../../src/experiments/titration/replay";
import { titration } from "../../../src/experiments/titration/titration";
import { actionRegistry } from "../../../src/lab-workflows/registries/actions";
import { verifyRegisteredSeedReplay } from "../../../src/lab-workflows/seedReplay";
import {
  ENDPOINT_CONTROL_PRELAB_DRAFT,
  ENDPOINT_CONTROL_PRELAB_EXPECTED_HASH,
  ENDPOINT_CONTROL_PRELAB_REPLAY_ACTIONS,
  ENDPOINT_CONTROL_PRELAB_REPLAY_SESSION_SEED,
  ENDPOINT_CONTROL_PRELAB_VALIDATION_TIME,
  ENDPOINT_CONTROL_PRELAB_WORKFLOW_ID
} from "../../../src/lab-workflows/seeds";
import {
  WORKFLOW_VALIDATION_CHECK_IDS,
  evaluateLabWorkflowEligibility,
  validateLabWorkflowSpec
} from "../../../src/lab-workflows/validation";

describe("canonical endpoint-control pre-lab workflow", () => {
  it("is an immutable schema-valid migration of the documented seed", () => {
    expect(ENDPOINT_CONTROL_PRELAB_DRAFT).toMatchObject({
      schemaVersion: "1.0.0",
      id: ENDPOINT_CONTROL_PRELAB_WORKFLOW_ID,
      revision: 1,
      familyId: "family.acid_base_titration.v1",
      engineId: "engine.titration.v1",
      initializationPresetId: "seed.titration.near_endpoint_22ml.v1",
      skillIds: ["endpoint_control", "meniscus_reading"],
      supportStatus: "draft_unvalidated",
      validation: null,
      judgeCritique: null
    });
    expect(ENDPOINT_CONTROL_PRELAB_DRAFT.steps.map(({ id }) => id)).toEqual([
      "read_initial_burette",
      "approach_endpoint"
    ]);
    expect(Object.isFrozen(ENDPOINT_CONTROL_PRELAB_DRAFT)).toBe(true);
    expect(Object.isFrozen(ENDPOINT_CONTROL_PRELAB_DRAFT.steps)).toBe(true);
    expect(Object.isFrozen(ENDPOINT_CONTROL_PRELAB_DRAFT.steps[0])).toBe(true);
    expect(Object.isFrozen(ENDPOINT_CONTROL_PRELAB_REPLAY_ACTIONS)).toBe(true);
  });

  it("hard-validates to a pinned, preview-eligible runnable artifact", () => {
    const outcome = validateLabWorkflowSpec(ENDPOINT_CONTROL_PRELAB_DRAFT, {
      checkedAt: ENDPOINT_CONTROL_PRELAB_VALIDATION_TIME
    });

    expect(outcome.schemaValid).toBe(true);
    if (!outcome.schemaValid) throw new Error("Canonical workflow must parse");
    expect(outcome.issues).toEqual([]);
    expect(outcome.validation).toMatchObject({
      canonicalSpecHash: ENDPOINT_CONTROL_PRELAB_EXPECTED_HASH,
      status: "runnable",
      runnable: true,
      previewEligible: true,
      assignmentEligible: true
    });
    expect(outcome.validation.passedCheckIds).toContain(
      WORKFLOW_VALIDATION_CHECK_IDS.seedReplay
    );
    expect(evaluateLabWorkflowEligibility(outcome.spec, "preview")).toEqual({
      eligible: true,
      purpose: "preview",
      failureCodes: []
    });
  });

  it("maps every pinned replay action to its workflow step and registry action", () => {
    const counts = new Map<string, number>();

    for (const replayItem of ENDPOINT_CONTROL_PRELAB_REPLAY_ACTIONS) {
      const step = ENDPOINT_CONTROL_PRELAB_DRAFT.steps.find(
        ({ id }) => id === replayItem.workflowStepId
      );
      expect(step).toBeDefined();
      const matchingAction = step?.allowedActions.find(
        ({ actionId }) =>
          actionRegistry.get(actionId).engineActionType ===
          replayItem.action.type
      );
      expect(matchingAction).toBeDefined();

      const count = (counts.get(replayItem.workflowStepId) ?? 0) + 1;
      counts.set(replayItem.workflowStepId, count);
      expect(count).toBeLessThanOrEqual(matchingAction?.maxAttempts ?? 1);

      if (replayItem.action.type === "add_titrant") {
        expect(replayItem.action.volumeML).toBeLessThanOrEqual(
          matchingAction?.authoredLimits?.maxVolumeMLPerAction ?? 0
        );
      }
    }

    expect(counts).toEqual(
      new Map([
        ["read_initial_burette", 1],
        ["approach_endpoint", 7]
      ])
    );
  });

  it("replays the registered seed deterministically through ExperimentDefinition.step", () => {
    const scenario = createTitrationRetryScenario(
      "endpoint_control",
      ENDPOINT_CONTROL_PRELAB_REPLAY_SESSION_SEED
    );
    const initial = titration.createInitialState(
      scenario.config,
      scenario.seed
    );
    const actions = ENDPOINT_CONTROL_PRELAB_REPLAY_ACTIONS.map(
      ({ action }) => action
    );
    const first = replayTitrationActions(
      scenario.config,
      actions,
      scenario.seed
    );
    const second = replayTitrationActions(
      scenario.config,
      actions,
      scenario.seed
    );

    expect(initial).toMatchObject({
      sessionSeed: ENDPOINT_CONTROL_PRELAB_REPLAY_SESSION_SEED,
      indicatorAdded: true,
      titrantAddedML: 22,
      buretteAvailableML: 28,
      buretteReadingML: 22,
      buretteConditioned: true,
      titrantDilutionFactor: 1,
      tSim: 30
    });
    expect(second).toEqual(first);
    expect(first.events.map(({ type }) => type)).toEqual([
      "read_meniscus",
      "add_titrant",
      "add_titrant",
      "add_titrant",
      "add_titrant",
      "add_titrant",
      "add_titrant",
      "add_titrant"
    ]);
    expect(first.events.flatMap(({ flags }) => flags)).toEqual([]);
    expect(first.events[0]).toMatchObject({
      type: "read_meniscus",
      observation: { reportedML: 22, trueML: 22, errorML: 0 },
      flags: [],
      evidence: [
        {
          skillId: "volumetric_reading",
          delta: 0.6,
          reason: "meniscus_read_ok"
        }
      ]
    });
    expect(
      first.events
        .flatMap(({ evidence }) => evidence)
        .filter(({ reason }) => reason === "controlled_addition_near_endpoint")
    ).toHaveLength(5);
    expect(first.events.at(-1)).toEqual({
      type: "add_titrant",
      tSim: 61,
      observation: {
        addedML: 0.1,
        totalML: 25.1,
        cumulativeDeliveredML: 25.1,
        currentReadingML: 25.1,
        availableML: 24.9,
        rateMlPerS: 0.1,
        pH: 10.3,
        observedColor: "pink",
        equivalenceML: 25
      },
      flags: [],
      evidence: [
        {
          skillId: "endpoint_control",
          delta: 0.5,
          reason: "controlled_addition_near_endpoint"
        }
      ]
    });
    expect(first.state).toMatchObject({
      titrantAddedML: 25.1,
      buretteAvailableML: 24.9,
      buretteReadingML: 25.1,
      tSim: 61
    });
    expect(first.state.curve.at(-1)).toEqual({ volumeML: 25.1, pH: 10.3 });
  });

  it("fails closed for any unregistered engine/seed pair", () => {
    expect(
      verifyRegisteredSeedReplay(
        "engine.titration.v1",
        "seed.titration.near_endpoint_22ml.v1"
      )
    ).toBe(true);
    expect(
      verifyRegisteredSeedReplay(
        "engine.titration.v1",
        "seed.titration.near_endpoint_approximately.v1"
      )
    ).toBe(false);
    expect(
      verifyRegisteredSeedReplay(
        "engine.precipitation.v1",
        "seed.titration.near_endpoint_22ml.v1"
      )
    ).toBe(false);
  });
});
