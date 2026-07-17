import { expect, vi } from "vitest";

import {
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  type GenericEquipmentState,
  type GenericLabConfig,
  type GenericMechanicalAdapterPort,
  type GenericMechanicalContext,
  type GenericRuntimePorts,
  type GenericWorkflowEvaluationContext,
  type NormalizedLabAction
} from "../../../../src/lab-workflows/runtime/generic";
import { hashLabWorkflowSpec } from "../../../../src/lab-workflows/hash";
import type { ValidatedLabWorkflowSpecV2 } from "../../../../src/lab-workflows/schema/v2";
import { validateLabWorkflowSpecV2 } from "../../../../src/lab-workflows/validation";
import {
  createMigratedEndpointV2Draft,
  createRunnableMechanicalV2Draft
} from "../../validation/v2Fixtures";

export const GENERIC_TEST_CHECKED_AT = "2026-07-17T22:00:00.000Z";

export function validatedMechanicalWorkflow(
  catalogId?: string
): ValidatedLabWorkflowSpecV2 {
  const draft = createRunnableMechanicalV2Draft();
  if (catalogId) draft.catalog = { familyId: catalogId };
  const outcome = validateLabWorkflowSpecV2(draft, {
    checkedAt: GENERIC_TEST_CHECKED_AT
  });
  expect(outcome.schemaValid).toBe(true);
  if (!outcome.schemaValid) throw new Error("Expected schema-valid fixture");
  expect(outcome.validation).toMatchObject({
    status: "runnable",
    runnable: true,
    previewEligible: false,
    assignmentEligible: false
  });
  return outcome.spec;
}

export function validatedPartialWorkflow(): ValidatedLabWorkflowSpecV2 {
  const outcome = validateLabWorkflowSpecV2(createMigratedEndpointV2Draft(), {
    checkedAt: GENERIC_TEST_CHECKED_AT
  });
  expect(outcome.schemaValid).toBe(true);
  if (!outcome.schemaValid) throw new Error("Expected schema-valid fixture");
  expect(outcome.validation.runnable).toBe(false);
  return outcome.spec;
}

export const GENERIC_TEST_CONFIG: GenericLabConfig = Object.freeze({
  schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  sessionId: "generic-runtime-test-session",
  workflowId: "workflow.meniscus_reading.validation_fixture.v2",
  workflowRevision: 1,
  workflowHash: hashLabWorkflowSpec(createRunnableMechanicalV2Draft())
});

export const READ_VOLUME_ACTION: NormalizedLabAction = Object.freeze({
  schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  permissionId: "permission.read_measurement_burette",
  actionId: "action.read_volume.v1",
  sourceEquipmentInstanceId: "measurement_burette",
  targetEquipmentInstanceIds: Object.freeze([]),
  parameters: Object.freeze([
    Object.freeze({
      key: "reportedML",
      valueType: "number" as const,
      value: 12.35
    })
  ])
});

function initialBuretteState(): GenericEquipmentState {
  return {
    instanceId: "measurement_burette",
    equipmentDefinitionId: "component.burette.v1",
    stateSchemaId: "schema.equipment_state.burette.v1",
    fields: [
      { key: "capacityML", value: 50 },
      { key: "availableML", value: 0 },
      { key: "deliveredML", value: 12.35 },
      { key: "conditionedWith", value: null },
      { key: "filled", value: false },
      { key: "stopcockDetent", value: "closed" },
      { key: "meniscusReadingML", value: 12.35 }
    ]
  };
}

export interface TestGenericPorts extends GenericRuntimePorts {
  readonly mechanicalAdapters: readonly [GenericMechanicalAdapterPort];
}

export function createTestGenericPorts(
  options: {
    readonly preconditionAllowed?: boolean;
    readonly safetyAllowed?: boolean;
    readonly applyThrows?: boolean;
  } = {}
): TestGenericPorts {
  const adapter: GenericMechanicalAdapterPort = {
    adapterId: "mechanical-adapter.burette.v1",
    adapterVersion: "1.0.0",
    supportedEquipmentDefinitionIds: ["component.burette.v1"],
    supportedActionIds: ["action.read_volume.v1"],
    supportedPreconditionIds: [],
    initializeEquipment: vi.fn(() => initialBuretteState()),
    checkPreconditions: vi.fn(() =>
      options.preconditionAllowed === false
        ? {
            ok: false as const,
            reasonCode: "test.precondition_rejected",
            message: "Test precondition rejected the action."
          }
        : { ok: true as const }
    ),
    apply: vi.fn((context: GenericMechanicalContext) => {
      if (options.applyThrows) throw new Error("test adapter failure");
      const reported = context.action.parameters.find(
        ({ key }) => key === "reportedML"
      );
      if (!reported || reported.valueType !== "number") {
        throw new Error("validated parameter missing");
      }
      return {
        equipment: context.equipment,
        materialAction: null,
        events: [
          {
            type: "read_meniscus",
            tSim: 1,
            observation: {
              reportedML: reported.value,
              trueML: 12.35,
              errorML: reported.value - 12.35
            },
            flags: [],
            evidence: [
              {
                skillId: "meniscus_reading",
                delta: 1,
                reason: "meniscus_read_ok"
              }
            ]
          }
        ]
      };
    })
  };

  return {
    mechanicalAdapters: [adapter],
    safetyPolicy: {
      supportedPolicyIds: ["safety.virtual_titration_ppe_notice.v1"],
      check: vi.fn(() =>
        options.safetyAllowed === false
          ? {
              ok: false as const,
              reasonCode: "test.safety_rejected",
              message: "Test safety policy rejected the action."
            }
          : { ok: true as const }
      )
    },
    models: {
      supportedModels: [],
      initialize: vi.fn(() => ({
        modelStates: [],
        observables: [
          {
            observableId: "observable.burette_reading_ml.v1",
            value: 12.35,
            unitId: "unit.ml.v1"
          }
        ],
        groundTruth: {
          values: { "observable.burette_reading_ml.v1": 12.35 },
          notes: ["Supplied by the injected test projection port."]
        }
      })),
      transition: vi.fn(({ previous }) => previous)
    },
    evaluator: {
      evaluate: vi.fn(({ rules, events }: GenericWorkflowEvaluationContext) =>
        rules.map((rule) => ({
          ruleId: rule.id,
          status:
            events.length > 0 && rule.id === "rule.meniscus_observed"
              ? ("satisfied" as const)
              : ("pending" as const),
          severity: rule.severity,
          recoverable: rule.recoverable,
          objectiveIds: [...rule.objectiveIds],
          evidenceEventIds: []
        }))
      )
    }
  };
}
