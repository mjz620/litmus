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
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  assembleGenericLabRuntime,
  createLegacyTitrationRuntimePorts,
  parseLegacyTitrationCompatibilityState,
  type GenericLabRuntime,
  type GenericLabRuntimeTransition,
  type GenericLabState,
  type NormalizedLabAction
} from "../lab-workflows/runtime";
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
}

export interface SetupDrivenTitrationSession {
  readonly mode: "setup_driven_v2";
  getState(): Readonly<TitrationState>;
  getGenericState(): Readonly<GenericLabState>;
  getInspection(): Readonly<SetupDrivenRuntimeInspection>;
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

  return createSession(runtime);
}

function createSession(
  runtime: GenericLabRuntime
): SetupDrivenTitrationSession {
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

  return Object.freeze({
    mode: "setup_driven_v2" as const,
    getState: projectedState,
    getGenericState: runtime.getState,
    getInspection: inspection,
    dispatch(action: NormalizedLabAction) {
      const transition = runtime.dispatch(action);
      return Object.freeze({
        state: projectedState(),
        events: transition.events,
        inspection: inspection()
      });
    }
  });
}
