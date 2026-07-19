import { describe, expect, it } from "vitest";

import type { TitrationAction } from "../../../src/experiments/titration/titration";
import {
  STRICT_MIGRATED_TITRATION_V2_DRAFT,
  TITRATION_V2_EXPECTED_HASH,
  TITRATION_V2_SOURCE_HASH,
  TITRATION_V2_SOURCE_MIGRATION_VERSION,
  TITRATION_V2_SOURCE_V1_CONTENT_HASH,
  TITRATION_V2_SOURCE_V1_VALIDATED_HASH,
  validateStrictMigratedTitrationV2
} from "../../../src/lab-workflows/definitions/titration";
import { hashLabWorkflowSpec } from "../../../src/lab-workflows/hash";
import {
  GENERIC_LAB_RUNTIME_ERROR_CODES,
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  assembleGenericLabRuntime,
  assembleTitrationWorkflow,
  createLegacyTitrationRuntimePorts,
  type LabWorkflowRuntimeCommand,
  type NormalizedLabAction
} from "../../../src/lab-workflows/runtime";
import { migrateLabWorkflowV1ToV2 } from "../../../src/lab-workflows/schema/migration";
import {
  ENDPOINT_CONTROL_PRELAB_DRAFT,
  ENDPOINT_CONTROL_PRELAB_EXPECTED_HASH,
  ENDPOINT_CONTROL_PRELAB_REPLAY_ACTIONS,
  ENDPOINT_CONTROL_PRELAB_REPLAY_SESSION_SEED,
  ENDPOINT_CONTROL_PRELAB_VALIDATION_TIME
} from "../../../src/lab-workflows/seeds";
import { validateLabWorkflowSpec } from "../../../src/lab-workflows/validation";

const V2_CHECKED_AT = "2026-07-18T02:00:00.000Z";

function normalizedAction(action: TitrationAction): NormalizedLabAction {
  const base = {
    schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
    sourceEquipmentInstanceId: "titrant_burette",
    targetEquipmentInstanceIds: []
  } as const;
  switch (action.type) {
    case "read_meniscus":
      return {
        ...base,
        permissionId: "migration.permission.s1.a1",
        actionId: "action.read_volume.v1",
        parameters: [
          { key: "reportedML", valueType: "number", value: action.reportedML }
        ]
      };
    case "add_titrant":
      return {
        ...base,
        permissionId: "migration.permission.s2.a1",
        actionId: "action.dispense.v1",
        targetEquipmentInstanceIds: ["analyte_flask"],
        parameters: [
          { key: "volumeML", valueType: "number", value: action.volumeML },
          { key: "durationS", valueType: "number", value: action.durationS }
        ]
      };
    default:
      throw new Error(`The strict migrated trace does not use ${action.type}.`);
  }
}

function legacyCommand(
  workflowStepId: string,
  action: TitrationAction
): LabWorkflowRuntimeCommand {
  const normalized = normalizedAction(action);
  return {
    stepId: workflowStepId,
    actionId: normalized.actionId,
    actorComponentInstanceId: normalized.sourceEquipmentInstanceId!,
    targetComponentInstanceIds: normalized.targetEquipmentInstanceIds,
    parameters: Object.fromEntries(
      normalized.parameters.map(({ key, value }) => [key, value])
    )
  };
}

function validatedV1() {
  const outcome = validateLabWorkflowSpec(ENDPOINT_CONTROL_PRELAB_DRAFT, {
    checkedAt: ENDPOINT_CONTROL_PRELAB_VALIDATION_TIME
  });
  expect(outcome.schemaValid).toBe(true);
  if (!outcome.schemaValid) throw new Error("Expected the canonical v1 seed.");
  return outcome.spec;
}

function createGenericRuntime(sessionId: string) {
  const workflow = validateStrictMigratedTitrationV2(V2_CHECKED_AT);
  return assembleGenericLabRuntime(
    workflow,
    {
      schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
      sessionId,
      sessionSeed: ENDPOINT_CONTROL_PRELAB_REPLAY_SESSION_SEED,
      workflowId: workflow.id,
      workflowRevision: workflow.revision,
      workflowHash: workflow.validation.canonicalSpecHash
    },
    createLegacyTitrationRuntimePorts(workflow)
  );
}

describe("serialized strict migrated titration v2 definition", () => {
  it("is the exact deterministic v1 migration with pinned provenance and hashes", () => {
    expect(STRICT_MIGRATED_TITRATION_V2_DRAFT).toEqual(
      migrateLabWorkflowV1ToV2(ENDPOINT_CONTROL_PRELAB_DRAFT)
    );
    expect(ENDPOINT_CONTROL_PRELAB_EXPECTED_HASH).toBe(
      TITRATION_V2_SOURCE_V1_VALIDATED_HASH
    );
    expect(hashLabWorkflowSpec(ENDPOINT_CONTROL_PRELAB_DRAFT)).toBe(
      TITRATION_V2_SOURCE_V1_CONTENT_HASH
    );
    expect(STRICT_MIGRATED_TITRATION_V2_DRAFT.provenance).toMatchObject({
      migrationVersion: TITRATION_V2_SOURCE_MIGRATION_VERSION,
      sourceSpecHash: TITRATION_V2_SOURCE_V1_CONTENT_HASH
    });
    expect(TITRATION_V2_SOURCE_HASH).toBe(TITRATION_V2_EXPECTED_HASH);
    expect(Object.isFrozen(STRICT_MIGRATED_TITRATION_V2_DRAFT.rules)).toBe(
      true
    );
  });

  it("revalidates the serialized source against current exact registries", () => {
    const workflow = validateStrictMigratedTitrationV2(V2_CHECKED_AT);
    expect(workflow).toMatchObject({
      supportStatus: "runnable",
      validation: {
        runnable: true,
        canonicalSpecHash: TITRATION_V2_EXPECTED_HASH,
        registrySnapshotIds: expect.objectContaining({
          capabilities: "capabilities.2.0.0",
          actions: "actions.3.0.0",
          chemistryModels: "chemistry-models.2.0.0",
          components: "components.3.1.0",
          configurations: "configurations.4.0.0",
          scenePlacements: "scene-placements.2.0.0",
          materials: "reagents.4.0.0"
        })
      },
      compatibility: {
        runtimeAdapterId: "runtime-adapter.titration.v1",
        engineId: "engine.titration.v1"
      }
    });
  });

  it("produces equivalent strict v1 and generic state, events, and completion", async () => {
    const legacy = await assembleTitrationWorkflow(validatedV1(), {
      sessionSeed: ENDPOINT_CONTROL_PRELAB_REPLAY_SESSION_SEED
    });
    const generic = createGenericRuntime("strict-v2-equivalence");

    for (const replayItem of ENDPOINT_CONTROL_PRELAB_REPLAY_ACTIONS) {
      legacy.dispatch(
        legacyCommand(replayItem.workflowStepId, replayItem.action)
      );
      generic.dispatch(normalizedAction(replayItem.action));
    }

    const legacyFinal = legacy.getSnapshot();
    const genericFinal = generic.getState();
    expect(
      JSON.parse(genericFinal.compatibilityState!.serializedState)
    ).toEqual(legacyFinal.engineState);
    expect(genericFinal.eventEnvelopes.map(({ payload }) => payload)).toEqual(
      legacyFinal.semanticEvents
    );
    expect(genericFinal.workflowStatus).toBe("completed");
    expect(legacyFinal.status).toBe("completed");
    expect(
      genericFinal.diagnoses.every(({ status }) => status !== "violated")
    ).toBe(true);
  });

  it("preserves the strict precedence gate in both runtime paths", async () => {
    const dispense = ENDPOINT_CONTROL_PRELAB_REPLAY_ACTIONS.find(
      ({ action }) => action.type === "add_titrant"
    );
    if (!dispense) throw new Error("Expected a canonical dispense action.");
    const legacy = await assembleTitrationWorkflow(validatedV1(), {
      sessionSeed: ENDPOINT_CONTROL_PRELAB_REPLAY_SESSION_SEED
    });
    const generic = createGenericRuntime("strict-v2-precedence");

    expect(() =>
      legacy.dispatch(legacyCommand(dispense.workflowStepId, dispense.action))
    ).toThrow();
    expect(() =>
      generic.dispatch(normalizedAction(dispense.action))
    ).toThrowError(
      expect.objectContaining({
        code: GENERIC_LAB_RUNTIME_ERROR_CODES.permissionUnavailable
      })
    );
  });

  it("fails closed when a once-valid definition or registry artifact becomes stale", () => {
    const workflow = validateStrictMigratedTitrationV2(V2_CHECKED_AT);
    const edited = structuredClone(workflow);
    edited.metadata.title = "Stale edited title";
    expect(() =>
      assembleGenericLabRuntime(
        edited,
        {
          schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
          sessionId: "stale-v2-hash",
          sessionSeed: ENDPOINT_CONTROL_PRELAB_REPLAY_SESSION_SEED,
          workflowId: edited.id,
          workflowRevision: edited.revision,
          workflowHash: edited.validation.canonicalSpecHash
        },
        createLegacyTitrationRuntimePorts(workflow)
      )
    ).toThrowError(
      expect.objectContaining({
        code: GENERIC_LAB_RUNTIME_ERROR_CODES.workflowIneligible
      })
    );

    const staleSnapshots = structuredClone(workflow);
    staleSnapshots.validation.registrySnapshotIds.actions = "actions.0.0.0";
    expect(() =>
      assembleGenericLabRuntime(
        staleSnapshots,
        {
          schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
          sessionId: "stale-v2-registry",
          sessionSeed: ENDPOINT_CONTROL_PRELAB_REPLAY_SESSION_SEED,
          workflowId: staleSnapshots.id,
          workflowRevision: staleSnapshots.revision,
          workflowHash: staleSnapshots.validation.canonicalSpecHash
        },
        createLegacyTitrationRuntimePorts(workflow)
      )
    ).toThrowError(
      expect.objectContaining({
        code: GENERIC_LAB_RUNTIME_ERROR_CODES.workflowIneligible
      })
    );
  });
});
