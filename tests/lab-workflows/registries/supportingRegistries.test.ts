import { describe, expect, it } from "vitest";

import {
  ACTION_REGISTRY_ENTRIES,
  actionRegistry,
  createSupportingRegistry,
  SupportingRegistryError
} from "../../../src/lab-workflows/registries/actions";
import { componentRegistry } from "../../../src/lab-workflows/registries/components";
import { configurationRegistry } from "../../../src/lab-workflows/registries/configurations";
import { engineRegistry } from "../../../src/lab-workflows/registries/engines";
import {
  eventFlagRegistry,
  eventTypeRegistry
} from "../../../src/lab-workflows/registries/event-flags";
import { reagentRegistry } from "../../../src/lab-workflows/registries/reagents";
import { safetyRegistry } from "../../../src/lab-workflows/registries/safety";
import {
  EXAMPLE_STRONG,
  titration
} from "../../../src/experiments/titration/titration";

describe("Lab Composer supporting registries", () => {
  it("provides deterministic exact lookup and stable unknown-ID failures", () => {
    const cases = [
      [actionRegistry, "action.unknown.v1"],
      [reagentRegistry, "reagent.unknown.v1"],
      [engineRegistry, "engine.precipitation.v1"],
      [eventFlagRegistry, "flag.unknown.v1"],
      [eventTypeRegistry, "event.unknown.v1"],
      [safetyRegistry, "safety.unknown.v1"],
      [configurationRegistry, "seed.precipitation.unmixed.v1"]
    ] as const;

    for (const [registry, unknownId] of cases) {
      expect(registry.has(unknownId)).toBe(false);
      expect(() => registry.get(unknownId)).toThrowError(
        expect.objectContaining({
          name: "SupportingRegistryError",
          code: "registry.unknown_id",
          registryKind: registry.kind,
          registryId: unknownId
        })
      );
    }
  });

  it("rejects duplicate IDs and returns frozen snapshots", () => {
    const duplicate = ACTION_REGISTRY_ENTRIES[0];
    expect(() =>
      createSupportingRegistry("action", "test", [duplicate, { ...duplicate }])
    ).toThrowError(
      new SupportingRegistryError(
        "registry.duplicate_id",
        "action",
        "action.rinse.v1"
      )
    );

    expect(Object.isFrozen(actionRegistry.list())).toBe(true);
    expect(Object.isFrozen(actionRegistry.get("action.dispense.v1"))).toBe(
      true
    );
    expect(
      Object.isFrozen(
        actionRegistry.get("action.dispense.v1").actorComponentIds
      )
    ).toBe(true);
  });

  it("resolves every verified cross-reference exactly", () => {
    for (const component of componentRegistry.list()) {
      for (const actionId of component.allowedActionIds) {
        expect(actionRegistry.get(actionId).id).toBe(actionId);
      }
      for (const safetyId of component.safetyConstraintIds) {
        expect(safetyRegistry.get(safetyId).id).toBe(safetyId);
      }
    }

    for (const action of actionRegistry.list()) {
      for (const componentId of [
        ...action.actorComponentIds,
        ...action.targetComponentIds
      ]) {
        expect(componentRegistry.get(componentId).id).toBe(componentId);
      }
      expect(engineRegistry.get(action.compatibleEngineIds[0]).id).toBe(
        "engine.titration.v1"
      );
      const registeredReagentRoles = new Set(
        reagentRegistry
          .list()
          .flatMap(({ allowedRoleIds }) => [...allowedRoleIds])
      );
      for (const roleId of action.requiredReagentRoleIds) {
        expect(registeredReagentRoles.has(roleId)).toBe(true);
      }
    }

    for (const reagent of reagentRegistry.list()) {
      for (const componentId of reagent.compatibleContainerComponentIds) {
        expect(componentRegistry.get(componentId).id).toBe(componentId);
      }
      expect(engineRegistry.get(reagent.compatibleEngineIds[0]).id).toBe(
        "engine.titration.v1"
      );
      expect(safetyRegistry.get(reagent.safetyConstraintIds[0]).id).toBe(
        "safety.virtual_titration_ppe_notice.v1"
      );
      for (const { unitId } of reagent.requestedAmountLimits) {
        expect(configurationRegistry.get(unitId).category).toBe("unit");
      }
    }

    const engine = engineRegistry.get("engine.titration.v1");
    for (const id of engine.componentIds) componentRegistry.get(id);
    for (const id of engine.actionIds) actionRegistry.get(id);
    for (const id of engine.reagentIds) reagentRegistry.get(id);
    for (const id of [...engine.engineConfigIds, ...engine.seedTemplateIds]) {
      configurationRegistry.get(id);
    }
    for (const id of engine.workflowEventTypeIds) eventTypeRegistry.get(id);

    for (const flag of eventFlagRegistry.list()) {
      for (const semanticEventType of flag.emittedBySemanticEventTypes) {
        expect(
          eventTypeRegistry
            .list()
            .some((event) => event.semanticEventType === semanticEventType)
        ).toBe(true);
      }
    }
  });

  it("maps only current engine-backed action types", () => {
    expect(
      actionRegistry.list().map(({ engineActionType }) => engineActionType)
    ).toEqual([
      "rinse_burette",
      "fill_burette",
      "select_indicator",
      "select_indicator",
      "add_titrant",
      "read_meniscus"
    ]);
    expect(actionRegistry.has("action.set_flow_rate.v1")).toBe(false);
    expect(actionRegistry.has("action.mix.v1")).toBe(false);
    expect(actionRegistry.has("action.transfer_volume.v1")).toBe(false);
  });

  it("declares exact authored-limit and preset compatibility metadata", () => {
    const dispense = actionRegistry.get("action.dispense.v1");
    const volumeParameter = dispense.parameters.find(
      ({ key }) => key === "volumeML"
    );
    expect(
      volumeParameter && "authoredMaximumKey" in volumeParameter
        ? volumeParameter.authoredMaximumKey
        : undefined
    ).toBe("maxVolumeMLPerAction");
    expect(dispense.requiredReagentRoleIds).toEqual(["titrant"]);

    expect(
      configurationRegistry.get("action_params.titration_dropwise_or_slow.v1")
        .compatibleActionIds
    ).toEqual(["action.dispense.v1"]);
    expect(
      configurationRegistry.get("component_config.burette.50ml.v1")
        .compatibleComponentIds
    ).toEqual(["component.burette.v1"]);
    expect(
      configurationRegistry.get("observation.observed_color.v1").adapterKey
    ).toBe("observedColor");
  });

  it("represents every current titration semantic flag accurately", () => {
    let state = titration.createInitialState(EXAMPLE_STRONG);
    const emittedFlags = new Set<string>();

    let result = titration.step(state, {
      type: "rinse_burette",
      solvent: "water"
    });
    result.events.forEach((event) =>
      event.flags.forEach((flag) => emittedFlags.add(flag))
    );

    state = titration.createInitialState(EXAMPLE_STRONG);
    state = titration.step(state, {
      type: "rinse_burette",
      solvent: "titrant"
    }).state;
    state = titration.step(state, {
      type: "fill_burette",
      volumeML: 50
    }).state;
    state = titration.step(state, {
      type: "select_indicator",
      indicator: "phenolphthalein"
    }).state;
    result = titration.step(state, {
      type: "add_titrant",
      volumeML: 26,
      durationS: 1
    });
    result.events.forEach((event) =>
      event.flags.forEach((flag) => emittedFlags.add(flag))
    );
    state = result.state;

    result = titration.step(state, {
      type: "read_meniscus",
      reportedML: 0
    });
    result.events.forEach((event) =>
      event.flags.forEach((flag) => emittedFlags.add(flag))
    );
    result = titration.step(state, {
      type: "submit_report",
      reportedMolarityM: 1,
      explanation: "test"
    });
    result.events.forEach((event) =>
      event.flags.forEach((flag) => emittedFlags.add(flag))
    );

    expect([...emittedFlags].sort()).toEqual(
      eventFlagRegistry
        .list()
        .map(({ semanticFlag }) => semanticFlag)
        .sort()
    );
  });

  it("registers the controlled endpoint positive stay-silent evidence", () => {
    let state = titration.createInitialState(EXAMPLE_STRONG);
    state = titration.step(state, {
      type: "rinse_burette",
      solvent: "titrant"
    }).state;
    state = titration.step(state, {
      type: "fill_burette",
      volumeML: 50
    }).state;
    state = titration.step(state, {
      type: "select_indicator",
      indicator: "phenolphthalein"
    }).state;
    const controlled = titration.step(state, {
      type: "add_titrant",
      volumeML: 24,
      durationS: 120
    }).events[0]!;

    expect(controlled.flags).not.toContain("flow_rate_high_near_endpoint");
    expect(controlled.flags).not.toContain("endpoint_overshoot");
    expect(controlled.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: "controlled_addition_near_endpoint"
        })
      ])
    );
    expect(
      eventFlagRegistry.get("flag.flow_rate_high_near_endpoint.v1")
        .positiveStaySilentEvidenceReasonId
    ).toBe("evidence.controlled_addition_near_endpoint.v1");
    expect(
      configurationRegistry.has("evidence.controlled_addition_near_endpoint.v1")
    ).toBe(true);
  });

  it("bounds the verified one-time indicator dose", () => {
    expect(
      reagentRegistry.get("reagent.phenolphthalein.v1").requestedAmountLimits
    ).toEqual([{ unitId: "unit.drop.v1", minimum: 1, maximum: 2 }]);
  });

  it("keeps planned families, engines, and reagents unavailable while retaining the safety rejection policy", () => {
    expect(engineRegistry.has("engine.precipitation.v1")).toBe(false);
    expect(engineRegistry.has("engine.calorimetry.v1")).toBe(false);
    expect(reagentRegistry.has("reagent.silver_nitrate_0_100m.v1")).toBe(false);
    expect(configurationRegistry.has("seed.precipitation.unmixed.v1")).toBe(
      false
    );
    expect(safetyRegistry.get("safety.no_open_flame_mvp.v1")).toMatchObject({
      availability: "restricted",
      prohibited: true,
      compatibleFamilyIds: []
    });
  });
});
