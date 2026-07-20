import { describe, expect, it } from "vitest";

import {
  SETUP_DRIVEN_SCENE_ERROR_CODES,
  TITRATION_VISUAL_ADAPTERS,
  projectionActionsForEquipmentFocus,
  resolveTitrationSceneConfiguration,
  visibleControlGroupsForConfiguration
} from "../../src/components/lab/titration/setupDrivenScene";
import { validateSolutionPreparationV2 } from "../../src/lab-workflows/definitions/solution-preparation";
import {
  STRICT_TITRATION_SETUP_SELECTION,
  createSetupDrivenNativeSession,
  createSetupDrivenTitrationSession,
  normalizeSetupDrivenTitrationAction,
  type SetupDrivenLabProjection
} from "../../src/stores/setupDrivenLabSession";

function session() {
  return createSetupDrivenTitrationSession({
    experimentId: "acid_base_titration",
    sessionId: "setup-driven-scene-test",
    sessionSeed: "setup-driven-scene-seed",
    selection: STRICT_TITRATION_SETUP_SELECTION
  });
}

describe("setup-driven titration scene projection", () => {
  it("resolves exact visual adapters, layout slots, and the initial read action", () => {
    const configuration = resolveTitrationSceneConfiguration(
      session().getProjection()
    );

    expect(configuration).toEqual({
      mode: "setup_driven_v2",
      workflowId: STRICT_TITRATION_SETUP_SELECTION.workflowId,
      workflowHash: STRICT_TITRATION_SETUP_SELECTION.workflowHash,
      equipmentInstanceIds: [
        "titrant_burette",
        "analyte_flask",
        "indicator_source"
      ],
      equipmentPoses: [
        expect.objectContaining({
          equipmentInstanceId: "titrant_burette",
          placementSlotId: "placement.bench_center_stand.v1",
          translation: [0, 0, 0]
        }),
        expect.objectContaining({
          equipmentInstanceId: "analyte_flask",
          placementSlotId: "placement.under_burette.v1",
          translation: [0, 0, 0]
        }),
        expect.objectContaining({
          equipmentInstanceId: "indicator_source",
          placementSlotId: "placement.indicator_shelf.v1",
          translation: [0, 0, 0]
        })
      ],
      selectableEquipmentIds: [
        "burette",
        "meniscus",
        "flask",
        "indicatorShelf"
      ],
      availableActionIds: ["action.read_volume.v1"],
      availableControlGroups: ["reading"],
      minDispenseVolumeML: 0.01,
      maxDispenseVolumeML: 0.5,
      equipmentFillFractions: expect.any(Object),
      projectedState: {
        burette: {
          availableML: 28,
          capacityML: 50,
          deliveredML: 22,
          meniscusReadingML: 22
        },
        flask: {
          observableColor: "colorless",
          indicatorAdded: true
        }
      }
    });
    expect(visibleControlGroupsForConfiguration(configuration, null)).toEqual([
      "reading"
    ]);
    expect(
      visibleControlGroupsForConfiguration(configuration, "burette")
    ).toEqual([]);
    expect(
      visibleControlGroupsForConfiguration(configuration, "meniscus")
    ).toEqual(["reading"]);
  });

  it("switches visible controls to dispensing after the required reading", () => {
    const runtime = session();
    runtime.dispatch(
      normalizeSetupDrivenTitrationAction({
        type: "read_meniscus",
        reportedML: 22
      })
    );
    const configuration = resolveTitrationSceneConfiguration(
      runtime.getProjection()
    );

    expect(configuration.availableActionIds).toEqual(["action.dispense.v1"]);
    expect(configuration.availableControlGroups).toEqual(["deliver"]);
    expect(
      visibleControlGroupsForConfiguration(configuration, "burette")
    ).toEqual(["deliver"]);
    expect(
      visibleControlGroupsForConfiguration(configuration, "meniscus")
    ).toEqual([]);
  });

  it("projects an alternate verified arrangement without changing action or state authority", () => {
    const current = structuredClone(
      session().getProjection()
    ) as SetupDrivenLabProjection;
    const projection: SetupDrivenLabProjection = {
      ...current,
      equipment: current.equipment.map((equipment) => {
        if (equipment.instanceId === "titrant_burette") {
          return {
            ...equipment,
            placementSlotId: "placement.bench_left_stand_reversed.v1"
          };
        }
        if (equipment.instanceId === "analyte_flask") {
          return {
            ...equipment,
            placementSlotId: "placement.under_left_burette.v1"
          };
        }
        return {
          ...equipment,
          placementSlotId: "placement.indicator_shelf_right.v1"
        };
      })
    };
    const configuration = resolveTitrationSceneConfiguration(projection);

    expect(configuration.equipmentPoses).toEqual([
      expect.objectContaining({
        equipmentInstanceId: "titrant_burette",
        translation: [-0.34, 0, 0],
        yawRadians: Math.PI
      }),
      expect.objectContaining({
        equipmentInstanceId: "analyte_flask",
        translation: [-0.34, 0, 0]
      }),
      expect.objectContaining({
        equipmentInstanceId: "indicator_source",
        translation: [1.17, 0, 0]
      })
    ]);
    expect(configuration.availableActionIds).toEqual(["action.read_volume.v1"]);
    expect(configuration.projectedState?.burette?.meniscusReadingML).toBe(22);
  });

  it("keeps the legacy scene and controls unchanged without a setup projection", () => {
    const configuration = resolveTitrationSceneConfiguration(null);
    expect(configuration.mode).toBe("legacy");
    expect(configuration.selectableEquipmentIds).toEqual([
      "burette",
      "flask",
      "meniscus",
      "indicatorShelf",
      "washStation"
    ]);
    expect(configuration.availableControlGroups).toEqual([
      "prepare",
      "indicator",
      "deliver",
      "reading"
    ]);
    expect(configuration.projectedState).toBeNull();
  });

  it("registers shared lab visual adapters for titration, dilution, and calorimetry", () => {
    expect(Object.keys(TITRATION_VISUAL_ADAPTERS).sort()).toEqual([
      "visual-adapter.beaker.v1",
      "visual-adapter.burette.v1",
      "visual-adapter.calorimeter.v1",
      "visual-adapter.erlenmeyer_flask.v1",
      "visual-adapter.indicator_bottle.v1",
      "visual-adapter.reagent_bottle.v1",
      "visual-adapter.thermometer.v1",
      "visual-adapter.volumetric_flask.v1",
      "visual-adapter.volumetric_pipette.v1",
      "visual-adapter.wash_bottle.v1"
    ]);
    expect(
      TITRATION_VISUAL_ADAPTERS["visual-adapter.volumetric_pipette.v1"]
    ).toMatchObject({
      kind: "volumetric_pipette",
      selectableEquipmentIds: ["volumetricPipette"]
    });
  });

  it("resolves the native solution-preparation projection without burette or flask", () => {
    const workflow = validateSolutionPreparationV2("2026-07-18T15:00:00.000Z");
    const session = createSetupDrivenNativeSession({
      sessionId: "dilution-scene-test",
      sessionSeed: "dilution-scene-seed",
      selection: {
        workflowId: workflow.id,
        workflowHash: workflow.validation.canonicalSpecHash
      },
      workflow
    });
    const configuration = resolveTitrationSceneConfiguration(
      session.getProjection()
    );
    expect(configuration.projectedState?.burette).toBeNull();
    expect(configuration.projectedState?.flask).toBeNull();
    expect(configuration.selectableEquipmentIds).toEqual(
      expect.arrayContaining([
        "volumetricPipette",
        "volumetricFlask",
        "washBottle",
        "reagentBottle"
      ])
    );
    expect(configuration.availableControlGroups).toContain("solution");
  });

  it("filters native lab actions to the focused equipment instance", () => {
    const workflow = validateSolutionPreparationV2("2026-07-18T15:00:00.000Z");
    const session = createSetupDrivenNativeSession({
      sessionId: "dilution-focus-actions-test",
      sessionSeed: "dilution-focus-actions-seed",
      selection: {
        workflowId: workflow.id,
        workflowHash: workflow.validation.canonicalSpecHash
      },
      workflow
    });
    const projection = session.getProjection();
    const pipetteActions = projectionActionsForEquipmentFocus(
      projection,
      "volumetricPipette"
    );
    const flaskActions = projectionActionsForEquipmentFocus(
      projection,
      "volumetricFlask"
    );

    expect(pipetteActions.length).toBeGreaterThan(0);
    expect(
      pipetteActions.every(
        (action) =>
          action.sourceEquipmentInstanceId === "transfer_pipette" ||
          action.targetEquipmentInstanceIds.includes("transfer_pipette")
      )
    ).toBe(true);
    expect(
      flaskActions.every(
        (action) =>
          action.sourceEquipmentInstanceId === "preparation_flask" ||
          action.targetEquipmentInstanceIds.includes("preparation_flask")
      )
    ).toBe(true);
    expect(projectionActionsForEquipmentFocus(projection, null)).toEqual(
      projection.actions
    );
  });

  it.each([
    [
      "unknown visual adapter",
      (projection: SetupDrivenLabProjection) => ({
        ...projection,
        equipment: projection.equipment.map((equipment, index) =>
          index === 0
            ? {
                ...equipment,
                visualAdapterDefinitionId: "visual-adapter.unknown.v1"
              }
            : equipment
        )
      }),
      SETUP_DRIVEN_SCENE_ERROR_CODES.visualAdapterUnknown
    ],
    [
      "unsupported placement",
      (projection: SetupDrivenLabProjection) => ({
        ...projection,
        equipment: projection.equipment.map((equipment, index) =>
          index === 0
            ? { ...equipment, placementSlotId: "placement.unknown.v1" }
            : equipment
        )
      }),
      SETUP_DRIVEN_SCENE_ERROR_CODES.placementUnsupported
    ],
    [
      "unknown action adapter",
      (projection: SetupDrivenLabProjection) => ({
        ...projection,
        actions: projection.actions.map((action, index) =>
          index === 0 ? { ...action, actionId: "action.unknown.v1" } : action
        )
      }),
      SETUP_DRIVEN_SCENE_ERROR_CODES.actionAdapterUnknown
    ]
  ])("fails closed for %s", (_, transform, expectedCode) => {
    const projection = transform(
      structuredClone(session().getProjection()) as SetupDrivenLabProjection
    );

    expect(() => resolveTitrationSceneConfiguration(projection)).toThrowError(
      expect.objectContaining({ code: expectedCode })
    );
  });
});
