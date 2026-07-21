import { describe, expect, it } from "vitest";

import {
  enumValueLabel,
  registeredEnumParameters
} from "../../src/components/lab/setup-driven/actionParameters";
import {
  completedActionMessage,
  isActionSettledByRules,
  nextPromptAction
} from "../../src/components/lab/setup-driven/NativeSetupDrivenWorkspace";
import { nativeTitrationBenchFacts } from "../../src/components/lab/setup-driven/nativeTitrationFacts";
import { procedureGuideStepsFromWorkflow } from "../../src/components/lab/setup-driven/procedureGuideSteps";
import {
  projectionActionsForEquipmentFocus,
  resolveLabSceneConfiguration
} from "../../src/components/lab/titration/setupDrivenScene";
import { INDICATOR_SPECIFICATIONS } from "../../src/experiments/titration/titration";
import { actionRegistry } from "../../src/lab-workflows/registries/actions";
import {
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  type GenericLabState,
  type NormalizedLabAction
} from "../../src/lab-workflows/runtime";
import {
  createSetupDrivenNativeTitrationSession,
  nativeTitrationCurvePoints
} from "../../src/stores/setupDrivenLabSession";

function session() {
  return createSetupDrivenNativeTitrationSession({
    sessionId: "native-workspace-test",
    sessionSeed: "native-workspace-seed"
  });
}

function normalized(
  action: ReturnType<
    ReturnType<typeof session>["getProjection"]
  >["actions"][number],
  parameters: NormalizedLabAction["parameters"]
): NormalizedLabAction {
  return {
    schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
    permissionId: action.permissionId,
    actionId: action.actionId,
    sourceEquipmentInstanceId: action.sourceEquipmentInstanceId ?? undefined,
    targetEquipmentInstanceIds: action.targetEquipmentInstanceIds,
    parameters
  };
}

function findAction(
  runtime: ReturnType<typeof session>,
  actionId: string
): ReturnType<ReturnType<typeof session>["getProjection"]>["actions"][number] {
  const action = runtime
    .getProjection()
    .actions.find((candidate) => candidate.actionId === actionId);
  expect(action, actionId).toBeDefined();
  return action as NonNullable<typeof action>;
}

describe("native titration workspace projection", () => {
  it("renders the titration bench: burette focus exposes the dispense controls", () => {
    const runtime = session();
    const projection = runtime.getProjection();
    const configuration = resolveLabSceneConfiguration(projection);

    expect(configuration.mode).toBe("setup_driven_v2");
    expect(configuration.selectableEquipmentIds).toEqual(
      expect.arrayContaining([
        "burette",
        "meniscus",
        "flask",
        "indicatorShelf",
        "washStation"
      ])
    );
    // The dispense bounds come from registered minimum + authored per-action
    // ceiling, never a hardcoded UI constant.
    expect(configuration.minDispenseVolumeML).toBe(0.01);
    expect(configuration.maxDispenseVolumeML).toBe(0.5);
    expect(configuration.projectedState?.burette).toMatchObject({
      availableML: 0,
      capacityML: 50,
      deliveredML: 0
    });

    const buretteActions = projectionActionsForEquipmentFocus(
      projection,
      "burette"
    );
    expect(buretteActions.map(({ actionId }) => actionId)).toEqual(
      expect.arrayContaining([
        "action.rinse.v1",
        "action.fill.v1",
        "action.read_volume.v1",
        "action.dispense.v1"
      ])
    );

    const washStationActions = projectionActionsForEquipmentFocus(
      projection,
      "washStation"
    );
    expect(washStationActions.map(({ actionId }) => actionId)).toEqual(
      expect.arrayContaining(["action.rinse.v1", "action.fill.v1"])
    );
  });

  it("keeps every permitted action dispatchable from typed controls (keyboard path)", () => {
    // The focused panel renders number inputs from numericParameterBounds and
    // selects from the registered enum parameters. Together they must cover
    // every required parameter of every permitted action, otherwise a step is
    // unreachable without the pointer gesture.
    const runtime = session();
    for (const action of runtime.getProjection().actions) {
      const numericKeys = action.numericParameterBounds.map(
        ({ parameterKey }) => parameterKey
      );
      const enumKeys = registeredEnumParameters(action.actionId).map(
        ({ key }) => key
      );
      const covered = new Set([...numericKeys, ...enumKeys]);
      for (const parameter of actionRegistry.get(action.actionId).parameters) {
        if (!parameter.required) continue;
        expect(
          covered.has(parameter.key),
          `${action.actionId} keyboard path misses ${parameter.key}`
        ).toBe(true);
      }
    }
  });

  it("labels registered enum choices for rinse solvent and indicators", () => {
    expect(registeredEnumParameters("action.rinse.v1")).toEqual([
      { key: "solvent", allowedValues: ["water", "titrant"] }
    ]);
    const indicator = registeredEnumParameters("action.add_indicator.v1");
    expect(indicator).toEqual([
      {
        key: "indicator",
        allowedValues: ["phenolphthalein", "bromothymol_blue", "methyl_orange"]
      }
    ]);
    // The review dialog can present every offered indicator's transition range.
    for (const value of indicator[0]!.allowedValues) {
      expect(
        INDICATOR_SPECIFICATIONS[value as keyof typeof INDICATOR_SPECIFICATIONS]
      ).toBeDefined();
    }
    expect(enumValueLabel("bromothymol_blue")).toBe("Bromothymol blue");
    expect(enumValueLabel("water")).toBe("Distilled water");
  });

  it("runs the full procedure through typed native actions and feeds the pH curve selector", () => {
    const runtime = session();
    runtime.dispatch(
      normalized(findAction(runtime, "action.rinse.v1"), [
        { key: "solvent", valueType: "enum", value: "titrant" }
      ])
    );
    expect(
      completedActionMessage(
        findAction(runtime, "action.rinse.v1"),
        runtime.getProjection()
      )
    ).toBe("Completed — the burette is conditioned with titrant.");
    runtime.dispatch(
      normalized(findAction(runtime, "action.fill.v1"), [
        { key: "volumeML", valueType: "number", value: 50 }
      ])
    );
    // Indicator confirmation dialog dispatches the native action with the
    // chosen indicator enum parameter.
    runtime.dispatch(
      normalized(findAction(runtime, "action.add_indicator.v1"), [
        { key: "indicator", valueType: "enum", value: "phenolphthalein" }
      ])
    );
    runtime.dispatch(
      normalized(findAction(runtime, "action.read_volume.v1"), [
        { key: "reportedML", valueType: "number", value: 0 }
      ])
    );
    const transition = runtime.dispatch(
      normalized(findAction(runtime, "action.dispense.v1"), [
        { key: "volumeML", valueType: "number", value: 0.5 },
        { key: "durationS", valueType: "number", value: 4 }
      ])
    );

    expect(transition.state.indicatorAdded).toBe(true);
    expect(transition.state.titrantAddedML).toBeCloseTo(0.5, 9);

    const generic = runtime.getGenericState();
    const points = nativeTitrationCurvePoints(generic);
    expect(points).toHaveLength(1);
    expect(points[0]!.volumeML).toBeCloseTo(0.5, 9);
    expect(points[0]!.pH).toBeGreaterThan(0);
    // The selector mirrors the bridge projection the strangler UI renders.
    expect(points).toEqual(
      transition.state.curve.map(({ volumeML, pH }) => ({ volumeML, pH }))
    );
  });

  it("advances the next-step prompt past technique actions that stay available", () => {
    // fill and read remain permitted for the whole attempt (refills and the
    // final reading are legitimate), and each is reachable from the bench,
    // the meniscus focus, and the Lab steps drawer. The prompt must move on
    // once the workflow's own observing rule records the action as done —
    // from whichever surface the student performed it.
    const runtime = session();
    const workflow = runtime.getWorkflow();
    const next = () =>
      nextPromptAction(workflow, runtime.getProjection())?.permissionId;

    expect(next()).toBe("permission.condition_burette");
    runtime.dispatch(
      normalized(findAction(runtime, "action.rinse.v1"), [
        { key: "solvent", valueType: "enum", value: "titrant" }
      ])
    );
    expect(next()).toBe("permission.fill_burette");
    runtime.dispatch(
      normalized(findAction(runtime, "action.fill.v1"), [
        { key: "volumeML", valueType: "number", value: 50 }
      ])
    );
    expect(findAction(runtime, "action.fill.v1").available).toBe(true);
    expect(
      isActionSettledByRules(
        workflow,
        findAction(runtime, "action.fill.v1"),
        runtime.getProjection().diagnoses
      )
    ).toBe(true);
    expect(next()).toBe("permission.add_indicator");
    runtime.dispatch(
      normalized(findAction(runtime, "action.add_indicator.v1"), [
        { key: "indicator", valueType: "enum", value: "phenolphthalein" }
      ])
    );
    expect(next()).toBe("permission.read_burette");
    runtime.dispatch(
      normalized(findAction(runtime, "action.read_volume.v1"), [
        { key: "reportedML", valueType: "number", value: 0 }
      ])
    );
    expect(findAction(runtime, "action.read_volume.v1").available).toBe(true);
    expect(next()).toBe("permission.dispense");
    runtime.dispatch(
      normalized(findAction(runtime, "action.dispense.v1"), [
        { key: "volumeML", valueType: "number", value: 0.5 },
        { key: "durationS", valueType: "number", value: 4 }
      ])
    );
    expect(next()).toBe("permission.dispense");
  });

  it("keeps conditioning as the next step after a water rinse", () => {
    // A water rinse satisfies the authored action_observed rule, but the
    // burette is not conditioned with titrant: equipment state owns this
    // completion, so the prompt must keep asking for the titrant rinse.
    const runtime = session();
    const workflow = runtime.getWorkflow();
    runtime.dispatch(
      normalized(findAction(runtime, "action.rinse.v1"), [
        { key: "solvent", valueType: "enum", value: "water" }
      ])
    );
    expect(
      completedActionMessage(
        findAction(runtime, "action.rinse.v1"),
        runtime.getProjection()
      )
    ).toBeNull();
    expect(
      nextPromptAction(workflow, runtime.getProjection())?.permissionId
    ).toBe("permission.condition_burette");
  });

  it("renders the authored native instructions through the shared procedure guide", () => {
    const runtime = session();
    const steps = procedureGuideStepsFromWorkflow(
      runtime.getWorkflow(),
      runtime.getGenericState().diagnoses
    );
    expect(steps.map(({ id }) => id)).toEqual([
      "prepare_burette",
      "add_indicator",
      "read_initial_burette",
      "approach_endpoint"
    ]);
    expect(steps[0]!.status).toBe("active");
  });

  it("projects curve points only from finite add_titrant observations", () => {
    const synthetic = {
      eventEnvelopes: [
        {
          payload: {
            type: "add_titrant",
            tSim: 4,
            observation: { totalML: 5, pH: 2.1 },
            flags: [],
            evidence: []
          }
        },
        {
          payload: {
            type: "read_meniscus",
            tSim: 6,
            observation: { reportedML: 5 },
            flags: [],
            evidence: []
          }
        },
        {
          payload: {
            type: "add_titrant",
            tSim: 9,
            observation: { totalML: Number.NaN, pH: 2.2 },
            flags: [],
            evidence: []
          }
        },
        {
          payload: {
            type: "add_titrant",
            tSim: 12,
            observation: { totalML: 7.5, pH: 2.4 },
            flags: [],
            evidence: []
          }
        }
      ]
    } as unknown as Pick<Readonly<GenericLabState>, "eventEnvelopes">;

    expect(nativeTitrationCurvePoints(synthetic)).toEqual([
      { volumeML: 5, pH: 2.1 },
      { volumeML: 7.5, pH: 2.4 }
    ]);
  });

  it("projects notebook/bench facts from equipment observables, never ground truth", () => {
    const runtime = session();
    const workflow = runtime.getWorkflow();
    const initial = nativeTitrationBenchFacts(
      workflow,
      runtime.getGenericState()
    );
    expect(initial).toMatchObject({
      analyteVolumeML: 25,
      titrantConcentrationM: 0.1,
      indicatorName: "phenolphthalein",
      indicatorAdded: false,
      buretteConditioned: false,
      buretteFillFraction: 0,
      stage: "prepare_burette",
      stageLabel: "Prepare the burette"
    });
    // The unknown analyte concentration must never appear on a student
    // surface: the facts object carries no concentration for the analyte.
    expect(JSON.stringify(initial)).not.toContain("analyteConcentration");

    runtime.dispatch(
      normalized(findAction(runtime, "action.rinse.v1"), [
        { key: "solvent", valueType: "enum", value: "titrant" }
      ])
    );
    runtime.dispatch(
      normalized(findAction(runtime, "action.fill.v1"), [
        { key: "volumeML", valueType: "number", value: 50 }
      ])
    );
    runtime.dispatch(
      normalized(findAction(runtime, "action.add_indicator.v1"), [
        { key: "indicator", valueType: "enum", value: "phenolphthalein" }
      ])
    );
    runtime.dispatch(
      normalized(findAction(runtime, "action.read_volume.v1"), [
        { key: "reportedML", valueType: "number", value: 0 }
      ])
    );
    runtime.dispatch(
      normalized(findAction(runtime, "action.dispense.v1"), [
        { key: "volumeML", valueType: "number", value: 0.5 },
        { key: "durationS", valueType: "number", value: 4 }
      ])
    );
    const afterDispense = nativeTitrationBenchFacts(
      workflow,
      runtime.getGenericState()
    );
    expect(afterDispense).toMatchObject({
      indicatorAdded: true,
      buretteConditioned: true,
      stage: "add_titrant"
    });
    expect(afterDispense?.buretteFillFraction).toBeCloseTo(49.5 / 50, 9);

    runtime.dispatch(
      normalized(findAction(runtime, "action.read_volume.v1"), [
        { key: "reportedML", valueType: "number", value: 0.5 }
      ])
    );
    expect(
      nativeTitrationBenchFacts(workflow, runtime.getGenericState())?.stage
    ).toBe("record_results");
  });
});
