import type { ExperimentId } from "../experiments/registry";
import type {
  TitrationAction,
  TitrationState
} from "../experiments/titration/titration";
import {
  TITRATION_V2_EXPECTED_HASH,
  validateStrictMigratedTitrationV2
} from "../lab-workflows/definitions/titration";
import {
  createLabWorkflowConsumerContext,
  type LabWorkflowConsumerContext
} from "../lab-workflows/consumers";
import {
  createGenericLabActionTrace,
  type GenericLabActionTrace
} from "../lab-workflows/replay";
import {
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  assembleGenericLabRuntime,
  createLegacyTitrationRuntimePorts,
  parseLegacyTitrationCompatibilityState,
  type GenericLabRuntime,
  type GenericLabRuntimeTransition,
  type GenericLabState,
  type NormalizedLabAction
} from "../lab-workflows/runtime";
import { componentRegistry } from "../lab-workflows/registries/components";
import type { WorkflowDiagnosis } from "../lab-workflows/schema/conditions";

export const SETUP_DRIVEN_TITRATION_RUNTIME_FLAG = "setup-v2" as const;
export const SETUP_DRIVEN_TITRATION_WORKFLOW_ID =
  "workflow.endpoint_control_prelab.seed.v1" as const;
export const SETUP_DRIVEN_TITRATION_VALIDATION_TIME =
  "2026-07-18T03:00:00.000Z" as const;

export type LabSessionRuntimeMode = "legacy" | "setup_driven_v2";

export interface SetupDrivenLabSelection {
  readonly workflowId: typeof SETUP_DRIVEN_TITRATION_WORKFLOW_ID;
  readonly workflowHash: typeof TITRATION_V2_EXPECTED_HASH;
}

export const STRICT_TITRATION_SETUP_SELECTION: SetupDrivenLabSelection =
  Object.freeze({
    workflowId: SETUP_DRIVEN_TITRATION_WORKFLOW_ID,
    workflowHash: TITRATION_V2_EXPECTED_HASH
  });

export interface SetupDrivenRuntimeInspection {
  readonly mode: "setup_driven_v2";
  readonly workflowId: string;
  readonly workflowRevision: number;
  readonly workflowHash: string;
  readonly validatorVersion: string;
  readonly runtimeSchemaVersion: string;
  readonly sequence: number;
  readonly eventSequence: number;
  readonly runtimeAdapterId: string;
  readonly runtimeAdapterVersion: string;
  readonly engineId: string;
  readonly engineVersion: string;
  readonly experimentDefinitionId: string;
  readonly experimentDefinitionVersion: string;
  readonly chemistryModels: readonly {
    readonly modelId: string;
    readonly version: string;
  }[];
  readonly eventIds: readonly string[];
  readonly diagnoses: readonly WorkflowDiagnosis[];
}

export interface SetupDrivenEquipmentProjection {
  readonly instanceId: string;
  readonly equipmentDefinitionId: string;
  readonly visualAdapterDefinitionId: string;
  readonly placementSlotId: string;
  readonly label: string;
  readonly capabilityIds: readonly string[];
  readonly stateFields: Readonly<
    Record<string, boolean | null | number | string | readonly string[]>
  >;
}

export interface SetupDrivenMaterialProjection {
  readonly instanceId: string;
  readonly materialProfileId: string;
  readonly containerInstanceId: string;
  readonly locations: readonly {
    readonly equipmentInstanceId: string;
    readonly amount: number;
  }[];
}

export interface SetupDrivenActionProjection {
  readonly permissionId: string;
  readonly actionId: string;
  readonly sourceEquipmentInstanceId: string | null;
  readonly targetEquipmentInstanceIds: readonly string[];
  readonly available: boolean;
  readonly attemptsUsed: number;
  readonly maxAttempts: number | null;
  readonly authoredLimits: Readonly<Record<string, number>>;
}

export interface SetupDrivenLabProjection {
  readonly workflowId: string;
  readonly workflowHash: string;
  readonly equipment: readonly SetupDrivenEquipmentProjection[];
  readonly materials: readonly SetupDrivenMaterialProjection[];
  readonly actions: readonly SetupDrivenActionProjection[];
  readonly availablePermissionIds: readonly string[];
  readonly diagnoses: readonly WorkflowDiagnosis[];
}

export const SETUP_DRIVEN_SESSION_ERROR_CODES = Object.freeze({
  selectionInvalid: "setup-session.selection_invalid.v1",
  experimentUnsupported: "setup-session.experiment_unsupported.v1",
  actionUnsupported: "setup-session.action_unsupported.v1",
  projectionInvalid: "setup-session.projection_invalid.v1"
} as const);

export type SetupDrivenSessionErrorCode =
  (typeof SETUP_DRIVEN_SESSION_ERROR_CODES)[keyof typeof SETUP_DRIVEN_SESSION_ERROR_CODES];

export class SetupDrivenSessionError extends Error {
  readonly code: SetupDrivenSessionErrorCode;

  constructor(code: SetupDrivenSessionErrorCode, message: string) {
    super(message);
    this.name = "SetupDrivenSessionError";
    this.code = code;
  }
}

export interface CreateSetupDrivenTitrationSessionInput {
  readonly experimentId: ExperimentId;
  readonly sessionId: string;
  readonly sessionSeed: string;
  readonly selection: SetupDrivenLabSelection;
}

export interface SetupDrivenTitrationTransition {
  readonly state: Readonly<TitrationState>;
  readonly events: GenericLabRuntimeTransition["events"];
  readonly inspection: Readonly<SetupDrivenRuntimeInspection>;
  readonly projection: Readonly<SetupDrivenLabProjection>;
}

export interface SetupDrivenTitrationSession {
  readonly mode: "setup_driven_v2";
  getState(): Readonly<TitrationState>;
  getGenericState(): Readonly<GenericLabState>;
  getInspection(): Readonly<SetupDrivenRuntimeInspection>;
  getProjection(): Readonly<SetupDrivenLabProjection>;
  getConsumerContext(): Readonly<LabWorkflowConsumerContext>;
  getActionTrace(): Readonly<GenericLabActionTrace>;
  dispatch(action: NormalizedLabAction): SetupDrivenTitrationTransition;
}

export function resolveLabSessionRuntimeMode(
  experimentId: ExperimentId,
  requestedFlag: string | undefined
): LabSessionRuntimeMode {
  return experimentId === "acid_base_titration" &&
    requestedFlag === SETUP_DRIVEN_TITRATION_RUNTIME_FLAG
    ? "setup_driven_v2"
    : "legacy";
}

export function normalizeSetupDrivenTitrationAction(
  action: Readonly<TitrationAction>
): NormalizedLabAction {
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
      throw new SetupDrivenSessionError(
        SETUP_DRIVEN_SESSION_ERROR_CODES.actionUnsupported,
        `The strict setup-driven titration definition does not permit ${action.type}.`
      );
  }
}

export function createSetupDrivenTitrationSession(
  input: CreateSetupDrivenTitrationSessionInput
): SetupDrivenTitrationSession {
  if (input.experimentId !== "acid_base_titration") {
    throw new SetupDrivenSessionError(
      SETUP_DRIVEN_SESSION_ERROR_CODES.experimentUnsupported,
      "The setup-driven titration session cannot load another experiment."
    );
  }
  if (
    input.selection.workflowId !== SETUP_DRIVEN_TITRATION_WORKFLOW_ID ||
    input.selection.workflowHash !== TITRATION_V2_EXPECTED_HASH
  ) {
    throw new SetupDrivenSessionError(
      SETUP_DRIVEN_SESSION_ERROR_CODES.selectionInvalid,
      "The requested setup-driven definition ID or hash is not eligible."
    );
  }

  const workflow = validateStrictMigratedTitrationV2(
    SETUP_DRIVEN_TITRATION_VALIDATION_TIME
  );
  if (
    workflow.id !== input.selection.workflowId ||
    workflow.validation.canonicalSpecHash !== input.selection.workflowHash
  ) {
    throw new SetupDrivenSessionError(
      SETUP_DRIVEN_SESSION_ERROR_CODES.selectionInvalid,
      "The current validated definition does not match the requested source."
    );
  }

  const runtime = assembleGenericLabRuntime(
    workflow,
    {
      schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
      sessionId: input.sessionId,
      sessionSeed: input.sessionSeed,
      workflowId: workflow.id,
      workflowRevision: workflow.revision,
      workflowHash: workflow.validation.canonicalSpecHash
    },
    createLegacyTitrationRuntimePorts(workflow)
  );

  return createSession(runtime, input.sessionSeed);
}

function createSession(
  runtime: GenericLabRuntime,
  sessionSeed: string
): SetupDrivenTitrationSession {
  const actions: NormalizedLabAction[] = [];

  function projectedState(): Readonly<TitrationState> {
    const compatibility = runtime.getState().compatibilityState;
    if (!compatibility) {
      throw new SetupDrivenSessionError(
        SETUP_DRIVEN_SESSION_ERROR_CODES.projectionInvalid,
        "The generic runtime did not provide its exact compatibility state."
      );
    }
    return parseLegacyTitrationCompatibilityState(
      compatibility.serializedState
    );
  }

  function inspection(): Readonly<SetupDrivenRuntimeInspection> {
    const state = runtime.getState();
    const compatibility = state.provenance.compatibility;
    if (!compatibility) {
      throw new SetupDrivenSessionError(
        SETUP_DRIVEN_SESSION_ERROR_CODES.projectionInvalid,
        "The generic runtime did not provide compatibility provenance."
      );
    }
    return Object.freeze({
      mode: "setup_driven_v2" as const,
      workflowId: state.provenance.workflowId,
      workflowRevision: state.provenance.workflowRevision,
      workflowHash: state.provenance.workflowHash,
      validatorVersion: state.provenance.validatorVersion,
      runtimeSchemaVersion: state.schemaVersion,
      sequence: state.sequence,
      eventSequence: state.eventSequence,
      runtimeAdapterId: compatibility.runtimeAdapterId,
      runtimeAdapterVersion: compatibility.runtimeAdapterVersion,
      engineId: compatibility.engineId,
      engineVersion: compatibility.engineVersion,
      experimentDefinitionId: compatibility.experimentDefinitionId,
      experimentDefinitionVersion: compatibility.experimentDefinitionVersion,
      chemistryModels: Object.freeze(
        state.provenance.resolvedChemistryModels.map(({ modelId, version }) =>
          Object.freeze({ modelId, version })
        )
      ),
      eventIds: Object.freeze(
        state.eventEnvelopes.map(({ eventId }) => eventId)
      ),
      diagnoses: state.diagnoses
    });
  }

  function projection(): Readonly<SetupDrivenLabProjection> {
    const state = runtime.getState();
    const workflow = runtime.program.workflow;
    const placements = new Map(
      workflow.layout.placements.map((placement) => [
        placement.equipmentInstanceId,
        placement.placementSlotId
      ])
    );
    const equipment = runtime.program.equipment.map((binding) => {
      if (!componentRegistry.has(binding.equipmentDefinitionId)) {
        throw new SetupDrivenSessionError(
          SETUP_DRIVEN_SESSION_ERROR_CODES.projectionInvalid,
          `Equipment definition ${binding.equipmentDefinitionId} is no longer registered.`
        );
      }
      const definition = componentRegistry.get(binding.equipmentDefinitionId);
      const authored = workflow.equipment.find(
        ({ instanceId }) => instanceId === binding.instanceId
      );
      const current = state.equipment.find(
        ({ instanceId }) => instanceId === binding.instanceId
      );
      const placementSlotId = placements.get(binding.instanceId);
      if (!authored || !current || !placementSlotId) {
        throw new SetupDrivenSessionError(
          SETUP_DRIVEN_SESSION_ERROR_CODES.projectionInvalid,
          `Equipment instance ${binding.instanceId} has an incomplete setup projection.`
        );
      }
      return Object.freeze({
        instanceId: binding.instanceId,
        equipmentDefinitionId: binding.equipmentDefinitionId,
        visualAdapterDefinitionId: definition.visualAdapterDefinitionId,
        placementSlotId,
        label: authored.label,
        capabilityIds: Object.freeze([...binding.capabilityIds]),
        stateFields: Object.freeze(
          Object.fromEntries(
            current.fields.map(({ key, value }) => [
              key,
              Array.isArray(value) ? Object.freeze([...value]) : value
            ])
          )
        )
      });
    });
    const materials = runtime.program.materials.map((binding) => {
      const ledgerEntry = state.materialLedger.materials.find(
        ({ materialInstanceId }) => materialInstanceId === binding.instanceId
      );
      if (!ledgerEntry) {
        throw new SetupDrivenSessionError(
          SETUP_DRIVEN_SESSION_ERROR_CODES.projectionInvalid,
          `Material instance ${binding.instanceId} is missing from the runtime ledger.`
        );
      }
      return Object.freeze({
        instanceId: binding.instanceId,
        materialProfileId: binding.materialProfileId,
        containerInstanceId: binding.containerInstanceId,
        locations: Object.freeze(
          ledgerEntry.locations.map((location) =>
            Object.freeze({ ...location })
          )
        )
      });
    });
    const diagnosisStatus = new Map(
      state.diagnoses.map(({ ruleId, status }) => [ruleId, status])
    );
    const attemptCounts = new Map(
      state.permissionAttempts.map(({ permissionId, count }) => [
        permissionId,
        count
      ])
    );
    const actions = runtime.program.actions.map(({ permission }) => {
      const attemptsUsed = attemptCounts.get(permission.id) ?? 0;
      const available =
        state.workflowStatus === "in_progress" &&
        permission.availability.allSatisfiedRuleIds.every(
          (ruleId) => diagnosisStatus.get(ruleId) === "satisfied"
        ) &&
        permission.availability.allUnsatisfiedRuleIds.every(
          (ruleId) => diagnosisStatus.get(ruleId) !== "satisfied"
        ) &&
        (permission.maxAttempts === undefined ||
          attemptsUsed < permission.maxAttempts);
      return Object.freeze({
        permissionId: permission.id,
        actionId: permission.actionId,
        sourceEquipmentInstanceId: permission.sourceEquipmentInstanceId ?? null,
        targetEquipmentInstanceIds: Object.freeze([
          ...permission.targetEquipmentInstanceIds
        ]),
        available,
        attemptsUsed,
        maxAttempts: permission.maxAttempts ?? null,
        authoredLimits: Object.freeze({ ...(permission.authoredLimits ?? {}) })
      });
    });

    return Object.freeze({
      workflowId: state.provenance.workflowId,
      workflowHash: state.provenance.workflowHash,
      equipment: Object.freeze(equipment),
      materials: Object.freeze(materials),
      actions: Object.freeze(actions),
      availablePermissionIds: Object.freeze(
        actions
          .filter(({ available }) => available)
          .map(({ permissionId }) => permissionId)
      ),
      diagnoses: state.diagnoses
    });
  }

  return Object.freeze({
    mode: "setup_driven_v2" as const,
    getState: projectedState,
    getGenericState: runtime.getState,
    getInspection: inspection,
    getProjection: projection,
    getConsumerContext: () =>
      createLabWorkflowConsumerContext(
        runtime.program.workflow,
        runtime.getState()
      ),
    getActionTrace: () =>
      createGenericLabActionTrace({
        traceId: `${runtime.getState().sessionId}:normalized-actions`,
        sessionId: runtime.getState().sessionId,
        sessionSeed,
        workflow: runtime.program.workflow,
        actions
      }),
    dispatch(action: NormalizedLabAction) {
      const transition = runtime.dispatch(action);
      actions.push(action);
      return Object.freeze({
        state: projectedState(),
        events: transition.events,
        inspection: inspection(),
        projection: projection()
      });
    }
  });
}
