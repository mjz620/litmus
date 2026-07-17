import { afterEach, describe, expect, it, vi } from "vitest";

import { createTitrationRetryScenario } from "../../../src/experiments/titration/retry";
import { replayTitrationActions } from "../../../src/experiments/titration/replay";
import {
  titration,
  type TitrationAction
} from "../../../src/experiments/titration/titration";
import {
  assertTitrationActionAdapter,
  assertTitrationComponentAdapter,
  loadTitrationEngineAdapter
} from "../../../src/lab-workflows/adapters/titration";
import {
  LAB_WORKFLOW_RUNTIME_ERROR_CODES,
  LabWorkflowRuntimeError,
  assembleTitrationWorkflow,
  type LabWorkflowRuntimeCommand
} from "../../../src/lab-workflows/runtime";
import type {
  LabWorkflowDraft,
  ValidatedLabWorkflowSpec
} from "../../../src/lab-workflows/schema";
import {
  ENDPOINT_CONTROL_PRELAB_DRAFT,
  ENDPOINT_CONTROL_PRELAB_REPLAY_ACTIONS,
  ENDPOINT_CONTROL_PRELAB_REPLAY_SESSION_SEED,
  ENDPOINT_CONTROL_PRELAB_VALIDATION_TIME
} from "../../../src/lab-workflows/seeds";
import {
  WORKFLOW_ELIGIBILITY_FAILURE_CODES,
  validateLabWorkflowSpec
} from "../../../src/lab-workflows/validation";

const ERROR = LAB_WORKFLOW_RUNTIME_ERROR_CODES;

function validateRunnable(
  draft: LabWorkflowDraft = ENDPOINT_CONTROL_PRELAB_DRAFT
): Readonly<ValidatedLabWorkflowSpec> {
  const outcome = validateLabWorkflowSpec(draft, {
    checkedAt: ENDPOINT_CONTROL_PRELAB_VALIDATION_TIME
  });
  expect(outcome.schemaValid).toBe(true);
  if (!outcome.schemaValid) throw new Error("Workflow must parse");
  expect(outcome.validation.runnable).toBe(true);
  return outcome.spec;
}

function commandFor(
  workflowStepId: string,
  action: TitrationAction
): LabWorkflowRuntimeCommand {
  switch (action.type) {
    case "read_meniscus":
      return {
        stepId: workflowStepId,
        actionId: "action.read_volume.v1",
        actorComponentInstanceId: "titrant_burette",
        targetComponentInstanceIds: [],
        parameters: { reportedML: action.reportedML }
      };
    case "add_titrant":
      return {
        stepId: workflowStepId,
        actionId: "action.dispense.v1",
        actorComponentInstanceId: "titrant_burette",
        targetComponentInstanceIds: ["analyte_flask"],
        parameters: {
          volumeML: action.volumeML,
          durationS: action.durationS
        }
      };
    default:
      throw new Error(`Canonical replay does not use ${action.type}`);
  }
}

function expectRuntimeError(
  run: () => unknown,
  code: LabWorkflowRuntimeError["code"]
): LabWorkflowRuntimeError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(LabWorkflowRuntimeError);
    expect(error).toMatchObject({ code });
    return error as LabWorkflowRuntimeError;
  }
  throw new Error(`Expected runtime error ${code}`);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("titration Lab Composer runtime", () => {
  it("assembles and completes the canonical seed with exact step/event parity", async () => {
    const workflow = validateRunnable();
    const scenario = createTitrationRetryScenario(
      "endpoint_control",
      ENDPOINT_CONTROL_PRELAB_REPLAY_SESSION_SEED
    );
    const actions = ENDPOINT_CONTROL_PRELAB_REPLAY_ACTIONS.map(
      ({ action }) => action
    );
    const expected = replayTitrationActions(
      scenario.config,
      actions,
      scenario.seed
    );
    const createInitialStateSpy = vi.spyOn(titration, "createInitialState");
    const stepSpy = vi.spyOn(titration, "step");
    const runtime = await assembleTitrationWorkflow(workflow, {
      sessionSeed: ENDPOINT_CONTROL_PRELAB_REPLAY_SESSION_SEED
    });

    const initial = runtime.getSnapshot();
    expect(initial).toMatchObject({
      workflowId: workflow.id,
      workflowRevision: 1,
      workflowHash: workflow.validation.canonicalSpecHash,
      engineId: "engine.titration.v1",
      experimentDefinitionId: "acid_base_titration",
      status: "active",
      currentStep: { id: "read_initial_burette" },
      completedStepIds: [],
      satisfiedObservationIds: [],
      engineState: {
        sessionSeed: ENDPOINT_CONTROL_PRELAB_REPLAY_SESSION_SEED,
        titrantAddedML: 22,
        buretteAvailableML: 28,
        buretteReadingML: 22,
        buretteConditioned: true,
        indicatorAdded: true
      }
    });
    expect(initial.allowedActions).toEqual([
      {
        actionId: "action.read_volume.v1",
        actorComponentInstanceId: "titrant_burette",
        targetComponentInstanceIds: [],
        maxAttempts: 3,
        attemptsUsed: 0
      }
    ]);
    expect(initial.componentViews).toMatchObject([
      {
        instanceId: "titrant_burette",
        componentId: "component.burette.v1",
        visualAdapterId: "Burette",
        state: {
          availableML: 28,
          deliveredML: 22,
          conditionedWith: "titrant",
          meniscusReadingML: 22
        }
      },
      {
        instanceId: "analyte_flask",
        componentId: "component.erlenmeyer_flask.v1",
        visualAdapterId: "ErlenmeyerFlask",
        state: {
          totalVolumeML: 47,
          observableColor: "colorless",
          indicatorAdded: true
        }
      },
      {
        instanceId: "indicator_source",
        componentId: "component.indicator_bottle.v1",
        visualAdapterId: "IndicatorShelf",
        state: {
          indicatorReagentInstanceId: "indicator",
          selected: true,
          added: true
        }
      }
    ]);

    const forwardedEvents = [];
    for (const replayItem of ENDPOINT_CONTROL_PRELAB_REPLAY_ACTIONS) {
      const transition = runtime.dispatch(
        commandFor(replayItem.workflowStepId, replayItem.action)
      );
      const engineResult = stepSpy.mock.results.at(-1)?.value;
      expect(transition.events[0]).toBe(engineResult?.events[0]);
      forwardedEvents.push(...transition.events);
      if (replayItem.workflowStepId === "read_initial_burette") {
        expect(transition.snapshot.currentStep?.id).toBe("approach_endpoint");
        expect(transition.snapshot.completedStepIds).toEqual([
          "read_initial_burette"
        ]);
      }
    }

    const completed = runtime.getSnapshot();
    expect(createInitialStateSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ buretteCapacityML: 50 }),
      expect.objectContaining({
        sessionSeed: ENDPOINT_CONTROL_PRELAB_REPLAY_SESSION_SEED
      })
    );
    expect(stepSpy).toHaveBeenCalledTimes(actions.length);
    expect(forwardedEvents).toEqual(expected.events);
    expect(completed.semanticEvents).toEqual(expected.events);
    expect(completed.engineState).toEqual(expected.state);
    expect(completed).toMatchObject({
      status: "completed",
      currentStep: null,
      completedStepIds: ["read_initial_burette", "approach_endpoint"],
      satisfiedObservationIds: [],
      allowedActions: []
    });
    expect(completed.componentViews[1]).toMatchObject({
      state: { observableColor: "pink", totalVolumeML: 50.1 }
    });
    expect(Object.isFrozen(runtime.workflow)).toBe(true);
    expect(Object.isFrozen(completed)).toBe(true);
    expect(Object.isFrozen(completed.engineState)).toBe(true);
    expect(Object.isFrozen(completed.semanticEvents[0])).toBe(true);
  });

  it("fails closed for invalid, non-runnable, hash-stale, and snapshot-stale inputs", async () => {
    const runnable = validateRunnable();
    const nonRunnableDraft = structuredClone(
      ENDPOINT_CONTROL_PRELAB_DRAFT
    ) as LabWorkflowDraft;
    nonRunnableDraft.steps[1]!.allowedActions[0]!.authoredLimits = {
      maxVolumeMLPerAction: 50.01
    };
    const nonRunnableOutcome = validateLabWorkflowSpec(nonRunnableDraft, {
      checkedAt: ENDPOINT_CONTROL_PRELAB_VALIDATION_TIME
    });
    expect(nonRunnableOutcome.schemaValid).toBe(true);
    if (!nonRunnableOutcome.schemaValid) throw new Error("Expected schema");
    expect(nonRunnableOutcome.validation.runnable).toBe(false);

    const hashStale = structuredClone(runnable) as ValidatedLabWorkflowSpec;
    hashStale.metadata.title = "Tampered after validation";
    const snapshotStale = structuredClone(runnable) as ValidatedLabWorkflowSpec;
    snapshotStale.validation.registrySnapshotIds.actions = "actions.0.0.0";

    const cases: Array<{
      input: unknown;
      failureCode: string;
    }> = [
      {
        input: null,
        failureCode: WORKFLOW_ELIGIBILITY_FAILURE_CODES.schemaInvalid
      },
      {
        input: ENDPOINT_CONTROL_PRELAB_DRAFT,
        failureCode: WORKFLOW_ELIGIBILITY_FAILURE_CODES.statusNotRunnable
      },
      {
        input: nonRunnableOutcome.spec,
        failureCode: WORKFLOW_ELIGIBILITY_FAILURE_CODES.statusNotRunnable
      },
      {
        input: hashStale,
        failureCode: WORKFLOW_ELIGIBILITY_FAILURE_CODES.hashMismatch
      },
      {
        input: snapshotStale,
        failureCode: WORKFLOW_ELIGIBILITY_FAILURE_CODES.registrySnapshotStale
      }
    ];

    for (const testCase of cases) {
      await expect(
        assembleTitrationWorkflow(testCase.input, {
          sessionSeed: "fail-closed"
        })
      ).rejects.toMatchObject({
        code: ERROR.workflowIneligible,
        details: {
          failureCodes: expect.arrayContaining([testCase.failureCode])
        }
      });
    }
  });

  it("rejects stale-step, disallowed, mismatched, and out-of-range actions before step", async () => {
    const runtime = await assembleTitrationWorkflow(validateRunnable(), {
      sessionSeed: "runtime-policy"
    });
    const stepSpy = vi.spyOn(titration, "step");

    expectRuntimeError(
      () =>
        runtime.dispatch({
          stepId: "approach_endpoint",
          actionId: "action.read_volume.v1",
          actorComponentInstanceId: "titrant_burette",
          targetComponentInstanceIds: [],
          parameters: { reportedML: 22 }
        }),
      ERROR.stepMismatch
    );
    expectRuntimeError(
      () =>
        runtime.dispatch({
          stepId: "read_initial_burette",
          actionId: "action.dispense.v1",
          actorComponentInstanceId: "titrant_burette",
          targetComponentInstanceIds: ["analyte_flask"],
          parameters: { volumeML: 0.5, durationS: 5 }
        }),
      ERROR.actionNotAllowed
    );
    expectRuntimeError(
      () =>
        runtime.dispatch({
          stepId: "read_initial_burette",
          actionId: "action.read_volume.v1",
          actorComponentInstanceId: "analyte_flask",
          targetComponentInstanceIds: [],
          parameters: { reportedML: 22 }
        }),
      ERROR.actionNotAllowed
    );
    expect(stepSpy).not.toHaveBeenCalled();

    runtime.dispatch(
      commandFor("read_initial_burette", {
        type: "read_meniscus",
        reportedML: 22
      })
    );
    expectRuntimeError(
      () =>
        runtime.dispatch({
          stepId: "approach_endpoint",
          actionId: "action.dispense.v1",
          actorComponentInstanceId: "titrant_burette",
          targetComponentInstanceIds: ["analyte_flask"],
          parameters: { volumeML: 0.51, durationS: 5 }
        }),
      ERROR.actionParameterInvalid
    );
    expectRuntimeError(
      () =>
        runtime.dispatch({
          stepId: "approach_endpoint",
          actionId: "action.dispense.v1",
          actorComponentInstanceId: "titrant_burette",
          targetComponentInstanceIds: ["analyte_flask"],
          parameters: { volumeML: 0.5, durationS: 5, executable: "no" }
        }),
      ERROR.actionParameterInvalid
    );
    expect(stepSpy).toHaveBeenCalledTimes(1);
  });

  it("enforces authored attempt limits without invoking the engine again", async () => {
    const draft = structuredClone(
      ENDPOINT_CONTROL_PRELAB_DRAFT
    ) as LabWorkflowDraft;
    draft.steps[1]!.allowedActions[0]!.maxAttempts = 1;
    const runtime = await assembleTitrationWorkflow(validateRunnable(draft), {
      sessionSeed: "attempt-limit"
    });
    runtime.dispatch(
      commandFor("read_initial_burette", {
        type: "read_meniscus",
        reportedML: 22
      })
    );
    const dispense = commandFor("approach_endpoint", {
      type: "add_titrant",
      volumeML: 0.5,
      durationS: 5
    });
    runtime.dispatch(dispense);
    expect(runtime.getSnapshot().allowedActions[0]).toMatchObject({
      attemptsUsed: 1,
      maxAttempts: 1
    });

    const stepSpy = vi.spyOn(titration, "step");
    expectRuntimeError(
      () => runtime.dispatch(dispense),
      ERROR.actionAttemptLimitExceeded
    );
    expect(stepSpy).not.toHaveBeenCalled();
  });

  it("resolves adapters exactly and never fuzzy-matches unsupported IDs", async () => {
    expectRuntimeError(
      () => assertTitrationActionAdapter("action.dispense.closest.v1"),
      ERROR.adapterNotFound
    );
    expectRuntimeError(
      () => assertTitrationComponentAdapter("component.burette.latest"),
      ERROR.adapterNotFound
    );
    await expect(
      loadTitrationEngineAdapter(
        "engine.titration.latest",
        "engine_config.titration.strong_acid_strong_base_25ml.v1",
        "seed.titration.near_endpoint_22ml.v1",
        "exact-adapter"
      )
    ).rejects.toMatchObject({ code: ERROR.adapterNotFound });
    await expect(
      loadTitrationEngineAdapter(
        "engine.titration.v1",
        "engine_config.titration.strong_acid_strong_base_25ml.v1",
        "seed.titration.near_endpoint_approximately.v1",
        "exact-adapter"
      )
    ).rejects.toMatchObject({ code: ERROR.adapterNotFound });
  });

  it("assembles and steps locally without fetch, timers, OpenAI, or Supabase", async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("Network access is forbidden during simulation");
    });
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const intervalSpy = vi.spyOn(globalThis, "setInterval");
    vi.stubGlobal("fetch", fetchSpy);

    const runtime = await assembleTitrationWorkflow(validateRunnable(), {
      sessionSeed: "offline-runtime"
    });
    runtime.dispatch(
      commandFor("read_initial_burette", {
        type: "read_meniscus",
        reportedML: 22
      })
    );

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(timeoutSpy).not.toHaveBeenCalled();
    expect(intervalSpy).not.toHaveBeenCalled();
  });
});
