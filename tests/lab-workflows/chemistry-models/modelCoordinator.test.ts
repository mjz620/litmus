import { describe, expect, it, vi } from "vitest";

import {
  CAPABILITY_REGISTRY_ENTRIES,
  createCapabilityRegistry,
  type ChemistryCapabilityId
} from "../../../src/lab-workflows/capabilities";
import {
  CHEMISTRY_MODEL_COORDINATOR_ERROR_CODES as COORDINATOR_ERROR,
  createChemistryModelCoordinator,
  type GenericChemistryModuleRegistration
} from "../../../src/lab-workflows/chemistry-models/coordinator";
import { hashLabWorkflowSpec } from "../../../src/lab-workflows/hash";
import { LIQUID_MECHANICAL_ADAPTERS } from "../../../src/lab-workflows/mechanics";
import {
  createChemistryModelRegistry,
  type ChemistryModelId,
  type ChemistryModelMetadataEntry
} from "../../../src/lab-workflows/registries/chemistry-models";
import {
  GENERIC_LAB_RUNTIME_ERROR_CODES,
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  assembleGenericLabRuntime,
  type GenericRuntimePorts,
  type GenericStateField,
  type NormalizedLabAction
} from "../../../src/lab-workflows/runtime/generic";
import {
  PRODUCTION_LAB_WORKFLOW_V2_REGISTRIES,
  type LabWorkflowV2RegistryContext,
  validateLabWorkflowSpecV2
} from "../../../src/lab-workflows/validation";
import {
  createRunnableLiquidTransferV2Draft,
  createRunnableMechanicalV2Draft
} from "../validation/v2Fixtures";
import {
  READ_VOLUME_ACTION,
  createTestGenericPorts
} from "../runtime/generic/fixtures";
import type { ExecutedMaterialAction } from "../../../src/lab-workflows/chemistry-models/material-ledger";

const MODEL_IDS = {
  ledger: "chemistry-model.test.coordinator_ledger.v1",
  volume: "chemistry-model.test.coordinator_volume.v1",
  mixing: "chemistry-model.test.coordinator_mixing.v1"
} as const satisfies Record<string, ChemistryModelId>;

const MODEL_METADATA = [
  metadata(MODEL_IDS.ledger, ["chemistry.material_ledger.v1"]),
  metadata(
    MODEL_IDS.volume,
    ["chemistry.volume_conservation.v1"],
    ["chemistry.material_ledger.v1"]
  ),
  metadata(
    MODEL_IDS.mixing,
    ["chemistry.solution_mixing.v1"],
    ["chemistry.volume_conservation.v1"]
  )
] as const;

const FILL_ACTION: NormalizedLabAction = {
  schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  permissionId: "permission.fill_transfer_burette",
  actionId: "action.fill.v1",
  sourceEquipmentInstanceId: "water_source",
  targetEquipmentInstanceIds: ["transfer_burette"],
  parameters: [{ key: "volumeML", valueType: "number", value: 10 }]
};

function metadata(
  id: ChemistryModelId,
  providedCapabilityIds: readonly ChemistryCapabilityId[],
  requiredCapabilityIds: readonly ChemistryCapabilityId[] = []
): ChemistryModelMetadataEntry {
  return {
    id,
    version: "1.0.0",
    displayName: id,
    providedCapabilityIds,
    requiredCapabilityIds,
    availability: "verified"
  };
}

function registries(): LabWorkflowV2RegistryContext {
  const verifiedIds = new Set<ChemistryCapabilityId>([
    "chemistry.material_ledger.v1",
    "chemistry.volume_conservation.v1",
    "chemistry.solution_mixing.v1"
  ]);
  return {
    ...PRODUCTION_LAB_WORKFLOW_V2_REGISTRIES,
    capabilities: createCapabilityRegistry(
      CAPABILITY_REGISTRY_ENTRIES.map((entry) =>
        entry.kind === "chemistry" && verifiedIds.has(entry.id)
          ? { ...entry, availability: "verified" as const }
          : entry
      )
    ),
    chemistryModels: createChemistryModelRegistry(MODEL_METADATA)
  };
}

interface ModuleFixture {
  readonly registrations: readonly GenericChemistryModuleRegistration[];
  readonly calls: string[];
  readonly applySpies: readonly ReturnType<typeof vi.fn>[];
}

function fieldValue(fields: readonly GenericStateField[], key: string): number {
  const value = fields.find((field) => field.key === key)?.value;
  if (typeof value !== "number") throw new Error(`Missing numeric ${key}`);
  return value;
}

function modules(
  options: {
    readonly duplicateObservable?: boolean;
    readonly unregisteredObservable?: boolean;
  } = {}
): ModuleFixture {
  const calls: string[] = [];
  const applySpies: ReturnType<typeof vi.fn>[] = [];
  const registrations = MODEL_METADATA.map((entry, index) => {
    const initialize = vi.fn((context: unknown) => {
      calls.push(`initialize:${entry.id}`);
      expect(Object.isFrozen(context)).toBe(true);
      return [{ key: "accumulator", value: index === 2 ? 50 : 0 }];
    });
    const apply = vi.fn(
      (
        action: Readonly<ExecutedMaterialAction>,
        state: readonly GenericStateField[]
      ) => {
        calls.push(`apply:${entry.id}`);
        expect(Object.isFrozen(action)).toBe(true);
        expect(Object.isFrozen(state)).toBe(true);
        const amount = action.transfers.reduce(
          (sum: number, transfer: { readonly amount: number }) =>
            sum + transfer.amount,
          0
        );
        return {
          state: [
            {
              key: "accumulator",
              value:
                fieldValue(state, "accumulator") +
                (index === 2 ? -amount : amount)
            }
          ]
        };
      }
    );
    applySpies.push(apply);
    return {
      metadataId: entry.id,
      module: {
        id: entry.id,
        version: entry.version,
        providedCapabilityIds: entry.providedCapabilityIds,
        requiredCapabilityIds: entry.requiredCapabilityIds,
        initialize,
        applyMaterialAction: apply,
        deriveObservables: vi.fn((state: readonly GenericStateField[]) => {
          calls.push(`derive:${entry.id}`);
          if (index !== 2 && !options.duplicateObservable) return [];
          return [
            {
              observableId: options.unregisteredObservable
                ? "observable.test.unregistered.v1"
                : "observable.burette_reading_ml.v1",
              value: fieldValue(state, "accumulator"),
              unitId: "unit.ml.v1"
            }
          ];
        })
      }
    } satisfies GenericChemistryModuleRegistration;
  });
  return {
    registrations: [registrations[2]!, registrations[0]!, registrations[1]!],
    calls,
    applySpies
  };
}

function runtimePorts(
  registrations: readonly GenericChemistryModuleRegistration[]
): GenericRuntimePorts {
  return {
    mechanicalAdapters: LIQUID_MECHANICAL_ADAPTERS,
    safetyPolicy: {
      supportedPolicyIds: ["safety.virtual_titration_ppe_notice.v1"],
      check: () => ({ ok: true })
    },
    models: createChemistryModelCoordinator({ registrations }),
    evaluator: {
      evaluate: ({ rules }) =>
        rules.map((rule) => ({
          ruleId: rule.id,
          status: "pending" as const,
          severity: rule.severity,
          recoverable: rule.recoverable,
          objectiveIds: [...rule.objectiveIds],
          evidenceEventIds: []
        }))
    }
  };
}

function validatedLiquid(registryContext: LabWorkflowV2RegistryContext) {
  const draft = createRunnableLiquidTransferV2Draft();
  draft.requiredChemistryCapabilityIds = ["chemistry.solution_mixing.v1"];
  const result = validateLabWorkflowSpecV2(draft, {
    checkedAt: "2026-07-17T23:30:00.000Z",
    registries: registryContext
  });
  expect(result.schemaValid).toBe(true);
  if (!result.schemaValid)
    throw new Error("Expected schema-valid model fixture");
  expect(result.validation).toMatchObject({ runnable: true });
  return { draft, workflow: result.spec };
}

function assemble(
  registrations: readonly GenericChemistryModuleRegistration[],
  registryContext = registries()
) {
  const { draft, workflow } = validatedLiquid(registryContext);
  return assembleGenericLabRuntime(
    workflow,
    {
      schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
      sessionId: "coordinator-test-session",
      workflowId: draft.id,
      workflowRevision: draft.revision,
      workflowHash: hashLabWorkflowSpec(draft)
    },
    runtimePorts(registrations),
    { registries: registryContext }
  );
}

describe("deterministic chemistry model coordinator", () => {
  it("initializes and transitions transitive modules in validated dependency order", () => {
    const fixture = modules();
    const runtime = assemble(fixture.registrations);

    expect(
      runtime.program.chemistryModels.map(({ modelId }) => modelId)
    ).toEqual([MODEL_IDS.ledger, MODEL_IDS.volume, MODEL_IDS.mixing]);
    expect(fixture.calls).toEqual([
      `initialize:${MODEL_IDS.ledger}`,
      `initialize:${MODEL_IDS.volume}`,
      `initialize:${MODEL_IDS.mixing}`,
      `derive:${MODEL_IDS.ledger}`,
      `derive:${MODEL_IDS.volume}`,
      `derive:${MODEL_IDS.mixing}`
    ]);

    const initial = structuredClone(runtime.getState());
    const transition = runtime.dispatch(FILL_ACTION);

    expect(
      runtime.getState().chemistry.modelStates.map(({ modelId }) => modelId)
    ).toEqual([MODEL_IDS.ledger, MODEL_IDS.volume, MODEL_IDS.mixing]);
    expect(fixture.calls.slice(6)).toEqual([
      `apply:${MODEL_IDS.ledger}`,
      `apply:${MODEL_IDS.volume}`,
      `apply:${MODEL_IDS.mixing}`,
      `derive:${MODEL_IDS.ledger}`,
      `derive:${MODEL_IDS.volume}`,
      `derive:${MODEL_IDS.mixing}`
    ]);
    expect(transition.state.chemistry).toMatchObject({
      observables: [
        {
          observableId: "observable.burette_reading_ml.v1",
          value: 40,
          unitId: "unit.ml.v1"
        }
      ],
      groundTruth: {
        values: { "observable.burette_reading_ml.v1": 40 },
        notes: []
      }
    });
    expect(initial.chemistry.observables[0]?.value).toBe(50);
    expect(runtime.getState().materialLedger.materials[0]?.locations).toEqual([
      { equipmentInstanceId: "transfer_burette", amount: 10 },
      { equipmentInstanceId: "water_source", amount: 40 }
    ]);
  });

  it("is deterministic across registration order and repeated replay", () => {
    const firstFixture = modules();
    const secondFixture = modules();
    const first = assemble(firstFixture.registrations);
    const second = assemble([...secondFixture.registrations].reverse());

    expect(first.getState().chemistry).toEqual(second.getState().chemistry);
    expect(first.dispatch(FILL_ACTION).state.chemistry).toEqual(
      second.dispatch(FILL_ACTION).state.chemistry
    );
  });

  it("does not apply material transitions for a mechanical-only action", () => {
    const registryContext = registries();
    const draft = createRunnableMechanicalV2Draft();
    draft.requiredChemistryCapabilityIds = ["chemistry.solution_mixing.v1"];
    const result = validateLabWorkflowSpecV2(draft, {
      checkedAt: "2026-07-17T23:31:00.000Z",
      registries: registryContext
    });
    expect(result.schemaValid).toBe(true);
    if (!result.schemaValid) throw new Error("Expected valid fixture");
    const fixture = modules();
    const ports = createTestGenericPorts();
    const coordinator = createChemistryModelCoordinator({
      registrations: fixture.registrations
    });
    const runtime = assembleGenericLabRuntime(
      result.spec,
      {
        schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
        sessionId: "coordinator-null-action",
        workflowId: draft.id,
        workflowRevision: draft.revision,
        workflowHash: hashLabWorkflowSpec(draft)
      },
      { ...ports, models: coordinator },
      { registries: registryContext }
    );

    const before = runtime.getState().chemistry;
    runtime.dispatch(READ_VOLUME_ACTION);

    for (const apply of fixture.applySpies)
      expect(apply).not.toHaveBeenCalled();
    expect(runtime.getState().chemistry).toEqual(before);
  });

  it("fails closed for duplicate, missing, version-drifted, and capability-drifted implementations", () => {
    const fixture = modules();
    expect(() =>
      createChemistryModelCoordinator({
        registrations: [fixture.registrations[0]!, fixture.registrations[0]!]
      })
    ).toThrowError(
      expect.objectContaining({
        code: COORDINATOR_ERROR.duplicateImplementation
      })
    );

    expect(() => assemble(fixture.registrations.slice(1))).toThrowError(
      expect.objectContaining({ code: COORDINATOR_ERROR.missingImplementation })
    );

    const versionDrift = fixture.registrations.map((registration, index) =>
      index === 0
        ? {
            ...registration,
            module: { ...registration.module, version: "0.0.0" }
          }
        : registration
    ) as unknown as GenericChemistryModuleRegistration[];
    expect(() => assemble(versionDrift)).toThrowError(
      expect.objectContaining({
        code: COORDINATOR_ERROR.implementationVersionMismatch
      })
    );

    const capabilityDrift = modules().registrations.map((registration) => ({
      ...registration,
      module:
        registration.module.id === MODEL_IDS.ledger
          ? { ...registration.module, providedCapabilityIds: [] }
          : registration.module
    })) as GenericChemistryModuleRegistration[];
    expect(() => assemble(capabilityDrift)).toThrowError(
      expect.objectContaining({
        code: COORDINATOR_ERROR.implementationContractMismatch
      })
    );
  });

  it("rejects duplicate and unregistered observable ownership", () => {
    expect(() =>
      assemble(modules({ duplicateObservable: true }).registrations)
    ).toThrowError(
      expect.objectContaining({
        code: GENERIC_LAB_RUNTIME_ERROR_CODES.transitionRejected,
        details: expect.objectContaining({
          reasonCode: COORDINATOR_ERROR.observableDuplicate
        })
      })
    );
    expect(() =>
      assemble(modules({ unregisteredObservable: true }).registrations)
    ).toThrowError(
      expect.objectContaining({
        code: GENERIC_LAB_RUNTIME_ERROR_CODES.transitionRejected,
        details: expect.objectContaining({
          reasonCode: COORDINATOR_ERROR.observableUnregistered
        })
      })
    );
  });

  it("rejects malformed and duplicate serializable model fields", () => {
    const fixture = modules();
    const duplicateFields = fixture.registrations.map((registration) =>
      registration.module.id === MODEL_IDS.ledger
        ? {
            ...registration,
            module: {
              ...registration.module,
              initialize: () => [
                { key: "duplicate", value: 1 },
                { key: "duplicate", value: 2 }
              ]
            }
          }
        : registration
    ) satisfies readonly GenericChemistryModuleRegistration[];
    expect(() => assemble(duplicateFields)).toThrowError(
      expect.objectContaining({
        code: GENERIC_LAB_RUNTIME_ERROR_CODES.transitionRejected,
        details: expect.objectContaining({
          reasonCode: COORDINATOR_ERROR.modelStateInvalid
        })
      })
    );

    const malformed = fixture.registrations.map((registration) =>
      registration.module.id === MODEL_IDS.ledger
        ? {
            ...registration,
            module: {
              ...registration.module,
              initialize: () => [
                { key: "not_finite", value: Number.POSITIVE_INFINITY }
              ]
            }
          }
        : registration
    ) as unknown as readonly GenericChemistryModuleRegistration[];
    expect(() => assemble(malformed)).toThrowError(
      expect.objectContaining({
        details: expect.objectContaining({
          reasonCode: COORDINATOR_ERROR.modelStateInvalid
        })
      })
    );
  });

  it("does not call network, wall-clock, randomness, or timers", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const dateSpy = vi.spyOn(Date, "now");
    const randomSpy = vi.spyOn(Math, "random");
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const runtime = assemble(modules().registrations);
    runtime.dispatch(FILL_ACTION);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(dateSpy).not.toHaveBeenCalled();
    expect(randomSpy).not.toHaveBeenCalled();
    expect(timeoutSpy).not.toHaveBeenCalled();
  });
});
