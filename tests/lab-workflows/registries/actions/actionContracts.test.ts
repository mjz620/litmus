import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  ACTION_REGISTRY_SNAPSHOT_ID,
  LEGACY_ACTION_REGISTRY_SNAPSHOT_IDS,
  actionEventContractRegistry,
  actionParameterSchemaRegistry,
  actionRegistry,
  equipmentPreconditionRegistry,
  labActionErrorContractRegistry,
  SupportingRegistryError
} from "../../../../src/lab-workflows/registries/actions";
import { componentRegistry } from "../../../../src/lab-workflows/registries/components";
import { eventTypeRegistry } from "../../../../src/lab-workflows/registries/event-flags";

const EXPECTED_ACTION_CONTRACTS = {
  "action.rinse.v1": {
    source: ["capability.contain_liquid.v1"],
    target: [
      "capability.contain_liquid.v1",
      "capability.receive_liquid.v1",
      "capability.rinse.v1"
    ],
    parameterSchemaId: "schema.action_parameters.rinse.v1",
    preconditionIds: ["precondition.equipment.burette_empty_before_rinse.v1"],
    mechanicalAdapterId: "mechanical-adapter.burette.v1",
    eventContractId: "event-contract.rinse_burette.v1",
    behavior: "discrete"
  },
  "action.fill.v1": {
    source: ["capability.contain_liquid.v1", "capability.dispense_liquid.v1"],
    target: ["capability.contain_liquid.v1", "capability.receive_liquid.v1"],
    parameterSchemaId: "schema.action_parameters.fill.v1",
    preconditionIds: ["precondition.equipment.burette_capacity_available.v1"],
    mechanicalAdapterId: "mechanical-adapter.burette.v1",
    eventContractId: "event-contract.fill_burette.v1",
    behavior: "discrete"
  },
  "action.select_indicator.v1": {
    source: ["capability.contain_liquid.v1", "capability.dispense_liquid.v1"],
    target: ["capability.contain_liquid.v1", "capability.receive_liquid.v1"],
    parameterSchemaId: "schema.action_parameters.select_indicator.v1",
    preconditionIds: ["precondition.equipment.indicator_not_added.v1"],
    mechanicalAdapterId: "mechanical-adapter.indicator_bottle.v1",
    eventContractId: "event-contract.select_indicator.v1",
    behavior: "discrete"
  },
  "action.add_indicator.v1": {
    source: ["capability.contain_liquid.v1"],
    target: ["capability.contain_liquid.v1", "capability.receive_liquid.v1"],
    parameterSchemaId: "schema.action_parameters.add_indicator.v1",
    preconditionIds: ["precondition.equipment.indicator_not_added.v1"],
    mechanicalAdapterId: "mechanical-adapter.erlenmeyer_flask.v1",
    eventContractId: "event-contract.add_indicator_legacy.v1",
    behavior: "discrete"
  },
  "action.dispense.v1": {
    source: [
      "capability.contain_liquid.v1",
      "capability.dispense_liquid.v1",
      "capability.measure_volume.v1"
    ],
    target: ["capability.contain_liquid.v1", "capability.receive_liquid.v1"],
    parameterSchemaId: "schema.action_parameters.dispense.v1",
    preconditionIds: [
      "precondition.equipment.burette_has_liquid.v1",
      "precondition.equipment.dispense_within_available_volume.v1",
      "precondition.equipment.indicator_added.v1"
    ],
    mechanicalAdapterId: "mechanical-adapter.burette.v1",
    eventContractId: "event-contract.add_titrant.v1",
    behavior: "continuous"
  },
  "action.read_volume.v1": {
    source: ["capability.measure_volume.v1"],
    target: [],
    parameterSchemaId: "schema.action_parameters.read_volume.v1",
    preconditionIds: [],
    mechanicalAdapterId: "mechanical-adapter.burette.v1",
    eventContractId: "event-contract.read_meniscus.v1",
    behavior: "discrete"
  }
} as const;

describe("LC2-101 capability-based action contracts", () => {
  it("pins the new snapshot while retaining the legacy snapshot reference", () => {
    expect(ACTION_REGISTRY_SNAPSHOT_ID).toBe("actions.2.0.0");
    expect(actionRegistry.snapshotId).toBe(ACTION_REGISTRY_SNAPSHOT_ID);
    expect(LEGACY_ACTION_REGISTRY_SNAPSHOT_IDS).toEqual(["actions.1.0.0"]);
    expect(Object.isFrozen(LEGACY_ACTION_REGISTRY_SNAPSHOT_IDS)).toBe(true);
  });

  it("maps every existing action to its exact bounded contract", () => {
    expect(actionRegistry.list().map(({ id }) => id)).toEqual(
      Object.keys(EXPECTED_ACTION_CONTRACTS)
    );

    for (const [actionId, expected] of Object.entries(
      EXPECTED_ACTION_CONTRACTS
    )) {
      const action = actionRegistry.get(actionId);
      expect(action.requiredSourceCapabilityIds).toEqual(expected.source);
      expect(action.requiredTargetCapabilityIds).toEqual(expected.target);
      expect(action.parameterSchemaId).toBe(expected.parameterSchemaId);
      expect(action.preconditionIds).toEqual(expected.preconditionIds);
      expect(action.mechanicalAdapterId).toBe(expected.mechanicalAdapterId);
      expect(action.emittedEventContractId).toBe(expected.eventContractId);
      expect(action.behavior).toBe(expected.behavior);
    }
  });

  it("matches all current actor and target component capabilities", () => {
    for (const action of actionRegistry.list()) {
      for (const componentId of action.actorComponentIds) {
        const capabilities = componentRegistry.get(componentId).capabilityIds;
        expect(
          action.requiredSourceCapabilityIds.every((id) =>
            capabilities.includes(id)
          ),
          `${componentId} source capabilities for ${action.id}`
        ).toBe(true);
      }
      for (const componentId of action.targetComponentIds) {
        const capabilities = componentRegistry.get(componentId).capabilityIds;
        expect(
          action.requiredTargetCapabilityIds.every((id) =>
            capabilities.includes(id)
          ),
          `${componentId} target capabilities for ${action.id}`
        ).toBe(true);
      }
    }
  });

  it("rejects a mismatched equipment fixture without inferring a fallback", () => {
    const dispense = actionRegistry.get("action.dispense.v1");
    const indicatorBottle = componentRegistry.get(
      "component.indicator_bottle.v1"
    );

    expect(
      dispense.requiredSourceCapabilityIds.filter(
        (id) => !indicatorBottle.capabilityIds.includes(id)
      )
    ).toEqual(["capability.measure_volume.v1"]);
    expect(componentRegistry.has("component.indicator_bottle.closest.v1")).toBe(
      false
    );
  });

  it("resolves parameter schemas exactly and retains readable v1 metadata", () => {
    for (const action of actionRegistry.list()) {
      const schema = actionParameterSchemaRegistry.get(
        action.parameterSchemaId
      );
      expect(schema.actionIds).toContain(action.id);
      expect(schema.additionalProperties).toBe(false);
      expect(action.parameters).toEqual(schema.parameters);
    }

    expect(
      actionParameterSchemaRegistry.get("schema.action_parameters.dispense.v1")
        .parameters
    ).toEqual([
      expect.objectContaining({
        key: "volumeML",
        minimum: 0.01,
        maximum: 50,
        authoredMaximumKey: "maxVolumeMLPerAction"
      }),
      expect.objectContaining({
        key: "durationS",
        minimum: 0.01,
        maximum: 600
      })
    ]);

    expect(() =>
      actionParameterSchemaRegistry.get(
        "schema.action_parameters.dispense.closest.v1"
      )
    ).toThrowError(
      new SupportingRegistryError(
        "registry.unknown_id",
        "action parameter schema",
        "schema.action_parameters.dispense.closest.v1"
      )
    );
  });

  it("resolves every precondition, error, event, and adapter reference exactly", () => {
    const mechanicalAdapterIds = new Set<string>(
      componentRegistry
        .list()
        .map(({ mechanicalAdapterId }) => mechanicalAdapterId)
    );
    const stateSchemaIds = new Set(
      componentRegistry.list().map(({ stateSchemaId }) => stateSchemaId)
    );

    for (const action of actionRegistry.list()) {
      for (const preconditionId of action.preconditionIds) {
        const precondition = equipmentPreconditionRegistry.get(preconditionId);
        expect(stateSchemaIds.has(precondition.stateSchemaId)).toBe(true);
      }
      for (const errorCode of action.possibleErrorCodes) {
        expect(labActionErrorContractRegistry.get(errorCode).id).toBe(
          errorCode
        );
      }
      const eventContract = actionEventContractRegistry.get(
        action.emittedEventContractId
      );
      expect(
        eventContract.eventTypeIds.map(
          (eventTypeId) => eventTypeRegistry.get(eventTypeId).semanticEventType
        )
      ).toEqual(action.emittedSemanticEventTypes);
      expect(mechanicalAdapterIds.has(action.mechanicalAdapterId)).toBe(true);
    }

    expect(
      mechanicalAdapterIds.has("mechanical-adapter.burette.closest.v1")
    ).toBe(false);
    expect(
      actionEventContractRegistry.get("event-contract.fill_burette.v1")
        .eventTypeIds
    ).toEqual(["fill_burette", "refill_burette"]);

    const unknownReferences = [
      [
        equipmentPreconditionRegistry,
        "precondition.equipment.burette.closest.v1"
      ],
      [labActionErrorContractRegistry, "action-error.closest.v1"],
      [actionEventContractRegistry, "event-contract.closest.v1"]
    ] as const;
    for (const [registry, unknownId] of unknownReferences) {
      expect(registry.has(unknownId)).toBe(false);
      expect(() => registry.get(unknownId)).toThrowError(
        expect.objectContaining({
          code: "registry.unknown_id",
          registryKind: registry.kind,
          registryId: unknownId
        })
      );
    }
  });

  it("preserves exact v1 action mappings and the legacy indicator alias", () => {
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
    expect(actionRegistry.get("action.add_indicator.v1")).toMatchObject({
      actorComponentIds: ["component.erlenmeyer_flask.v1"],
      targetComponentIds: ["component.erlenmeyer_flask.v1"],
      engineActionType: "select_indicator",
      emittedSemanticEventTypes: ["select_indicator"]
    });
    expect(
      actionRegistry.list().filter(({ behavior }) => behavior === "continuous")
    ).toHaveLength(1);
    expect(actionRegistry.get("action.dispense.v1").behavior).toBe(
      "continuous"
    );
  });

  it("returns deeply immutable action and contract metadata", () => {
    const dispense = actionRegistry.get("action.dispense.v1");
    const schema = actionParameterSchemaRegistry.get(
      dispense.parameterSchemaId
    );
    const eventContract = actionEventContractRegistry.get(
      dispense.emittedEventContractId
    );

    expect(Object.isFrozen(actionRegistry.list())).toBe(true);
    expect(Object.isFrozen(dispense.requiredSourceCapabilityIds)).toBe(true);
    expect(Object.isFrozen(dispense.preconditionIds)).toBe(true);
    expect(Object.isFrozen(dispense.possibleErrorCodes)).toBe(true);
    expect(Object.isFrozen(schema.parameters)).toBe(true);
    expect(Object.isFrozen(schema.parameters[0])).toBe(true);
    expect(Object.isFrozen(eventContract.eventTypeIds)).toBe(true);
  });

  it("keeps deterministic contract files free of framework and network imports", () => {
    const directory = join(
      dirname(fileURLToPath(import.meta.url)),
      "../../../../src/lab-workflows/registries/actions"
    );
    const files = [
      "types.ts",
      "entries.ts",
      "parameterSchemas.ts",
      "preconditions.ts",
      "errorContracts.ts",
      "eventContracts.ts",
      "supportingRegistry.ts",
      "index.ts"
    ];
    const forbidden = [
      "react",
      "three",
      "zustand",
      "supabase",
      "openai",
      "next/",
      "window",
      "document"
    ];

    for (const file of files) {
      const source = readFileSync(join(directory, file), "utf8").toLowerCase();
      for (const token of forbidden) expect(source).not.toContain(token);
    }
  });
});
