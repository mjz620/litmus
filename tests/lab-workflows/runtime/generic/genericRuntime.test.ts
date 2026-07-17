import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GENERIC_LAB_RUNTIME_ERROR_CODES as ERROR,
  GenericLabRuntimeError,
  assembleGenericLabRuntime,
  type NormalizedLabAction
} from "../../../../src/lab-workflows/runtime/generic";
import {
  createComponentRegistry,
  type ComponentRegistryEntry
} from "../../../../src/lab-workflows/registries/components";
import { ENDPOINT_CONTROL_PRELAB_DRAFT } from "../../../../src/lab-workflows/seeds";
import { PRODUCTION_LAB_WORKFLOW_V2_REGISTRIES } from "../../../../src/lab-workflows/validation";
import {
  GENERIC_TEST_CONFIG,
  READ_VOLUME_ACTION,
  createTestGenericPorts,
  validatedMechanicalWorkflow,
  validatedPartialWorkflow
} from "./fixtures";

function expectRuntimeError(
  run: () => unknown,
  code: GenericLabRuntimeError["code"]
): GenericLabRuntimeError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(GenericLabRuntimeError);
    expect(error).toMatchObject({ code });
    return error as GenericLabRuntimeError;
  }
  throw new Error(`Expected ${code}`);
}

function action(overrides: Partial<NormalizedLabAction>): NormalizedLabAction {
  return {
    ...structuredClone(READ_VOLUME_ACTION),
    ...overrides
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("generic LabWorkflowSpec v2 runtime scaffold", () => {
  it("compiles once and dispatches a deterministic no-chemistry action through ExperimentDefinition.step()", () => {
    const workflow = validatedMechanicalWorkflow();
    const ports = createTestGenericPorts();
    const runtime = assembleGenericLabRuntime(
      workflow,
      GENERIC_TEST_CONFIG,
      ports
    );
    const initial = runtime.getState();
    const before = structuredClone(initial);
    const stepSpy = vi.spyOn(runtime.definition, "step");

    const transition = runtime.dispatch(READ_VOLUME_ACTION);

    expect(stepSpy).toHaveBeenCalledTimes(1);
    expect(
      ports.mechanicalAdapters[0].initializeEquipment
    ).toHaveBeenCalledTimes(1);
    expect(ports.mechanicalAdapters[0].apply).toHaveBeenCalledTimes(1);
    expect(initial).toEqual(before);
    expect(runtime.getState()).toBe(transition.state);
    expect(transition).toMatchObject({
      state: {
        sequence: 1,
        provenance: {
          workflowId: workflow.id,
          workflowHash: workflow.validation.canonicalSpecHash
        },
        permissionAttempts: [
          { permissionId: "permission.read_measurement_burette", count: 1 }
        ]
      },
      events: [
        {
          type: "read_meniscus",
          observation: { reportedML: 12.35, trueML: 12.35, errorML: 0 }
        }
      ]
    });
    expect(runtime.definition.getGroundTruth(transition.state)).toEqual({
      values: { "observable.burette_reading_ml.v1": 12.35 },
      notes: ["Supplied by the injected test projection port."]
    });
    expect(Object.isFrozen(runtime.program)).toBe(true);
    expect(Object.isFrozen(runtime.program.actions[0])).toBe(true);
    expect(Object.isFrozen(initial)).toBe(true);
    expect(Object.isFrozen(transition.state)).toBe(true);
    expect(Object.isFrozen(transition.events)).toBe(true);
    const mechanicalContext = vi.mocked(ports.mechanicalAdapters[0].apply).mock
      .calls[0]![0];
    const modelContext = vi.mocked(ports.models.transition).mock.calls[0]![0];
    const evaluatorContext = vi.mocked(ports.evaluator.evaluate).mock
      .calls[1]![0];
    expect(Object.isFrozen(mechanicalContext)).toBe(true);
    expect(Object.isFrozen(mechanicalContext.action)).toBe(true);
    expect(Object.isFrozen(mechanicalContext.equipment)).toBe(true);
    expect(Object.isFrozen(modelContext)).toBe(true);
    expect(Object.isFrozen(evaluatorContext)).toBe(true);

    const second = assembleGenericLabRuntime(
      validatedMechanicalWorkflow(),
      GENERIC_TEST_CONFIG,
      createTestGenericPorts()
    ).dispatch(READ_VOLUME_ACTION);
    expect(second).toEqual(transition);
  });

  it("rejects capability-provenance drift before initialization", () => {
    const entries = structuredClone(
      PRODUCTION_LAB_WORKFLOW_V2_REGISTRIES.components.list()
    ) as ComponentRegistryEntry[];
    const buretteIndex = entries.findIndex(
      ({ id }) => id === "component.burette.v1"
    );
    const burette = entries[buretteIndex];
    if (!burette) throw new Error("Expected burette registry entry");
    entries[buretteIndex] = {
      ...burette,
      capabilityIds: burette.capabilityIds.filter(
        (id) => id !== "capability.measure_volume.v1"
      )
    };
    const ports = createTestGenericPorts();

    expectRuntimeError(
      () =>
        assembleGenericLabRuntime(
          validatedMechanicalWorkflow(),
          GENERIC_TEST_CONFIG,
          ports,
          {
            registries: {
              ...PRODUCTION_LAB_WORKFLOW_V2_REGISTRIES,
              components: createComponentRegistry(entries)
            }
          }
        ),
      ERROR.workflowIneligible
    );
    expect(
      ports.mechanicalAdapters[0].initializeEquipment
    ).not.toHaveBeenCalled();
    expect(ports.mechanicalAdapters[0].apply).not.toHaveBeenCalled();
  });

  it("rejects non-v2, unvalidated, partial, hash-stale, snapshot-stale, and artifact-tampered definitions before port initialization", () => {
    const current = validatedMechanicalWorkflow();
    const staleHash = structuredClone(current);
    staleHash.metadata.title = "Edited after validation";
    const staleSnapshot = structuredClone(current);
    staleSnapshot.validation.registrySnapshotIds.actions = "actions.0.0.0";
    const staleAdapters = structuredClone(current);
    staleAdapters.validation.resolvedAdapters.pop();
    const cases: unknown[] = [
      null,
      ENDPOINT_CONTROL_PRELAB_DRAFT,
      validatedPartialWorkflow(),
      staleHash,
      staleSnapshot,
      staleAdapters
    ];

    for (const candidate of cases) {
      const ports = createTestGenericPorts();
      expectRuntimeError(
        () => assembleGenericLabRuntime(candidate, GENERIC_TEST_CONFIG, ports),
        ERROR.workflowIneligible
      );
      expect(
        ports.mechanicalAdapters[0].initializeEquipment
      ).not.toHaveBeenCalled();
      expect(ports.mechanicalAdapters[0].apply).not.toHaveBeenCalled();
    }
  });

  it("rejects invalid permissions, connections, and parameters inside step before mechanics", () => {
    const invalidActions: readonly NormalizedLabAction[] = [
      action({ permissionId: "permission.unknown" }),
      action({ actionId: "action.fill.v1" }),
      action({ sourceEquipmentInstanceId: undefined }),
      action({ targetEquipmentInstanceIds: ["measurement_burette"] }),
      action({ parameters: [] }),
      action({
        parameters: [{ key: "reportedML", valueType: "number", value: 50.01 }]
      }),
      action({
        parameters: [
          { key: "reportedML", valueType: "number", value: 12.35 },
          { key: "unexpected", valueType: "string", value: "no" }
        ]
      }),
      action({
        parameters: [{ key: "reportedML", valueType: "string", value: "12.35" }]
      })
    ];
    const ports = createTestGenericPorts();
    const runtime = assembleGenericLabRuntime(
      validatedMechanicalWorkflow(),
      GENERIC_TEST_CONFIG,
      ports
    );
    const initial = runtime.getState();
    const stepSpy = vi.spyOn(runtime.definition, "step");

    for (const invalid of invalidActions) {
      expect(() => runtime.dispatch(invalid)).toThrow(GenericLabRuntimeError);
      expect(runtime.getState()).toBe(initial);
    }
    expect(stepSpy).toHaveBeenCalledTimes(invalidActions.length);
    expect(ports.mechanicalAdapters[0].apply).not.toHaveBeenCalled();
  });

  it("enforces deterministic precondition and safety ports before mechanical mutation", () => {
    for (const testCase of [
      {
        ports: createTestGenericPorts({ preconditionAllowed: false }),
        code: ERROR.preconditionFailed
      },
      {
        ports: createTestGenericPorts({ safetyAllowed: false }),
        code: ERROR.safetyRejected
      }
    ]) {
      const runtime = assembleGenericLabRuntime(
        validatedMechanicalWorkflow(),
        GENERIC_TEST_CONFIG,
        testCase.ports
      );
      const initial = runtime.getState();
      expectRuntimeError(
        () => runtime.dispatch(READ_VOLUME_ACTION),
        testCase.code
      );
      expect(runtime.getState()).toBe(initial);
      expect(testCase.ports.mechanicalAdapters[0].apply).not.toHaveBeenCalled();
    }
  });

  it("enforces permission attempt limits before another mechanical transition", () => {
    const ports = createTestGenericPorts();
    const runtime = assembleGenericLabRuntime(
      validatedMechanicalWorkflow(),
      GENERIC_TEST_CONFIG,
      ports
    );
    runtime.dispatch(READ_VOLUME_ACTION);
    runtime.dispatch(READ_VOLUME_ACTION);
    runtime.dispatch(READ_VOLUME_ACTION);
    const afterThree = runtime.getState();

    expectRuntimeError(
      () => runtime.dispatch(READ_VOLUME_ACTION),
      ERROR.attemptLimitExceeded
    );
    expect(runtime.getState()).toBe(afterThree);
    expect(ports.mechanicalAdapters[0].apply).toHaveBeenCalledTimes(3);
  });

  it("fails closed for missing or rejected exact ports and unsupported resume seeds", () => {
    const ports = createTestGenericPorts();
    expectRuntimeError(
      () =>
        assembleGenericLabRuntime(
          validatedMechanicalWorkflow(),
          GENERIC_TEST_CONFIG,
          { ...ports, mechanicalAdapters: [] }
        ),
      ERROR.portUnavailable
    );
    expectRuntimeError(
      () =>
        assembleGenericLabRuntime(
          validatedMechanicalWorkflow(),
          GENERIC_TEST_CONFIG,
          {
            ...ports,
            mechanicalAdapters: [
              {
                ...ports.mechanicalAdapters[0],
                adapterVersion: "2.0.0"
              }
            ]
          }
        ),
      ERROR.portContractMismatch
    );
    expectRuntimeError(
      () =>
        assembleGenericLabRuntime(
          validatedMechanicalWorkflow(),
          GENERIC_TEST_CONFIG,
          {
            ...ports,
            safetyPolicy: { ...ports.safetyPolicy, supportedPolicyIds: [] }
          }
        ),
      ERROR.portUnavailable
    );

    const rejectedPorts = createTestGenericPorts({ applyThrows: true });
    const rejected = assembleGenericLabRuntime(
      validatedMechanicalWorkflow(),
      GENERIC_TEST_CONFIG,
      rejectedPorts
    );
    const initial = rejected.getState();
    expectRuntimeError(
      () => rejected.dispatch(READ_VOLUME_ACTION),
      ERROR.transitionRejected
    );
    expect(rejected.getState()).toBe(initial);

    const compiled = assembleGenericLabRuntime(
      validatedMechanicalWorkflow(),
      GENERIC_TEST_CONFIG,
      createTestGenericPorts()
    );
    expectRuntimeError(
      () =>
        compiled.definition.createInitialState(GENERIC_TEST_CONFIG, {
          sequence: 1
        }),
      ERROR.invalidConfig
    );
    expectRuntimeError(
      () =>
        compiled.definition.createInitialState({
          ...GENERIC_TEST_CONFIG,
          workflowHash:
            "sha256:0000000000000000000000000000000000000000000000000000000000000000"
        }),
      ERROR.invalidConfig
    );
  });

  it("does not use network, clocks, randomness, or catalog metadata for behavior", () => {
    const fetchSpy = vi.fn(() => {
      throw new Error("network forbidden");
    });
    const dateSpy = vi.spyOn(Date, "now");
    const randomSpy = vi.spyOn(Math, "random");
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");
    vi.stubGlobal("fetch", fetchSpy);

    const firstWorkflow = validatedMechanicalWorkflow(
      "family.acid_base_titration.v1"
    );
    const firstPorts = createTestGenericPorts();
    const first = assembleGenericLabRuntime(
      firstWorkflow,
      {
        ...GENERIC_TEST_CONFIG,
        workflowHash: firstWorkflow.validation.canonicalSpecHash
      },
      firstPorts
    ).dispatch(READ_VOLUME_ACTION);

    const secondWorkflow = validatedMechanicalWorkflow(
      "family.precipitation_solubility.v1"
    );
    const second = assembleGenericLabRuntime(
      secondWorkflow,
      {
        ...GENERIC_TEST_CONFIG,
        workflowHash: secondWorkflow.validation.canonicalSpecHash
      },
      createTestGenericPorts()
    ).dispatch(READ_VOLUME_ACTION);

    expect(first.events).toEqual(second.events);
    expect(first.state.equipment).toEqual(second.state.equipment);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(dateSpy).not.toHaveBeenCalled();
    expect(randomSpy).not.toHaveBeenCalled();
    expect(timeoutSpy).not.toHaveBeenCalled();
  });
});
