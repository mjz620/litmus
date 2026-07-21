import type { ExperimentId } from "../experiments/registry";
import type {
  TitrationAction,
  TitrationState
} from "../experiments/titration/titration";
import {
  TITRATION_V2_EXPECTED_HASH,
  validateStrictMigratedTitrationV2,
  validateFullTitrationV2,
  FULL_TITRATION_V2_SOURCE_HASH
} from "../lab-workflows/definitions/titration";
import {
  NATIVE_FULL_TITRATION_V2_EXPECTED_HASH,
  NATIVE_FULL_TITRATION_WORKFLOW_ID,
  validateNativeFullTitrationV2
} from "../lab-workflows/definitions/titration/native-full-titration";
import {
  NATIVE_ENDPOINT_DRILL_V2_EXPECTED_HASH,
  NATIVE_ENDPOINT_DRILL_WORKFLOW_ID,
  validateNativeEndpointDrillV2
} from "../lab-workflows/definitions/titration/native-endpoint-drill";
import {
  ACID_BASE_TITRATION_MODEL_ID,
  INDICATOR_PROFILE_IDS,
  type IndicatorId
} from "../lab-workflows/chemistry-models/acid-base";
import { materialRegistry } from "../lab-workflows/registries/reagents";
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
  createCapabilityGenericRuntimePorts,
  createLegacyTitrationRuntimePorts,
  parseLegacyTitrationCompatibilityState,
  type GenericLabRuntime,
  type GenericLabRuntimeTransition,
  type GenericLabState,
  type NormalizedLabAction
} from "../lab-workflows/runtime";
import { componentRegistry } from "../lab-workflows/registries/components";
import type { WorkflowDiagnosis } from "../lab-workflows/schema/conditions";
import type { ValidatedLabWorkflowSpecV2 } from "../lab-workflows/schema/v2";
import { evaluateLabWorkflowEligibilityV2 } from "../lab-workflows/validation";

export const SETUP_DRIVEN_TITRATION_RUNTIME_FLAG = "setup-v2" as const;
/** Temporary escape hatch through LC2-803; removed from student entry in LC2-804. */
export const LEGACY_TITRATION_RUNTIME_FLAG = "legacy" as const;
/** Opt into the mid-procedure endpoint-control drill. */
export const ENDPOINT_DRILL_TITRATION_RUNTIME_FLAG = "endpoint-drill" as const;
/** Opt into the capability-native titration runtime (no legacy engine). */
export const NATIVE_TITRATION_RUNTIME_FLAG = "native" as const;
export const SETUP_DRIVEN_TITRATION_WORKFLOW_ID =
  "workflow.endpoint_control_prelab.seed.v1" as const;
export const SETUP_DRIVEN_TITRATION_VALIDATION_TIME =
  "2026-07-18T03:00:00.000Z" as const;

export type LabSessionRuntimeMode = "legacy" | "setup_driven_v2" | "native_v2";

export interface SetupDrivenLabSelection {
  readonly workflowId: string;
  readonly workflowHash: string;
}

export const STRICT_TITRATION_SETUP_SELECTION: SetupDrivenLabSelection =
  Object.freeze({
    workflowId: SETUP_DRIVEN_TITRATION_WORKFLOW_ID,
    workflowHash: TITRATION_V2_EXPECTED_HASH
  });

export const FULL_TITRATION_WORKFLOW_ID =
  "workflow.acid_base_titration.full.v2" as const;

/**
 * The complete strangler procedure from a clean bench. Since the Phase 5
 * default flip this is the `?runtime=setup-v2` rollback path;
 * STRICT_TITRATION_SETUP_SELECTION is its mid-titration endpoint-control
 * drill (`?runtime=setup-v2&drill` and the retry flow).
 */
export const FULL_TITRATION_SETUP_SELECTION: SetupDrivenLabSelection =
  Object.freeze({
    workflowId: FULL_TITRATION_WORKFLOW_ID,
    workflowHash: FULL_TITRATION_V2_SOURCE_HASH
  });

/**
 * The capability-native full titration — the student default since the Phase 5
 * flip: the same authored procedure as FULL_TITRATION_SETUP_SELECTION,
 * executed by the generic capability ports with no legacy compatibility
 * adapter.
 */
export const NATIVE_FULL_TITRATION_SETUP_SELECTION: SetupDrivenLabSelection =
  Object.freeze({
    workflowId: NATIVE_FULL_TITRATION_WORKFLOW_ID,
    workflowHash: NATIVE_FULL_TITRATION_V2_EXPECTED_HASH
  });

/**
 * The capability-native endpoint-control drill (`?runtime=endpoint-drill`,
 * also `?runtime=native&drill`): the native mirror of
 * STRICT_TITRATION_SETUP_SELECTION, seeded mid-titration at 22 mL by the
 * registered native initialization preset.
 */
export const NATIVE_ENDPOINT_DRILL_SETUP_SELECTION: SetupDrivenLabSelection =
  Object.freeze({
    workflowId: NATIVE_ENDPOINT_DRILL_WORKFLOW_ID,
    workflowHash: NATIVE_ENDPOINT_DRILL_V2_EXPECTED_HASH
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
  readonly executionKind: "native_generic" | "legacy_compatibility";
  readonly runtimeAdapterId: string | null;
  readonly runtimeAdapterVersion: string | null;
  readonly engineId: string | null;
  readonly engineVersion: string | null;
  readonly experimentDefinitionId: string | null;
  readonly experimentDefinitionVersion: string | null;
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
  readonly numericParameterBounds: readonly SetupDrivenNumericParameterBounds[];
}

export interface SetupDrivenNumericParameterBounds {
  readonly parameterKey: string;
  readonly unitId: string | null;
  readonly registeredMinimum: number | null;
  readonly registeredMaximum: number | null;
  readonly authoredMinimum: number | null;
  readonly authoredMaximum: number | null;
  readonly effectiveMinimum: number | null;
  readonly effectiveMaximum: number | null;
}

export interface SetupDrivenLabProjection {
  readonly workflowId: string;
  readonly workflowHash: string;
  readonly equipment: readonly SetupDrivenEquipmentProjection[];
  readonly materials: readonly SetupDrivenMaterialProjection[];
  readonly actions: readonly SetupDrivenActionProjection[];
  readonly availablePermissionIds: readonly string[];
  readonly diagnoses: readonly WorkflowDiagnosis[];
  /*
   * Engine-owned chemistry observables keyed by registered observable id. The
   * UI reads these to project outcomes that belong to the solution rather than
   * to any one apparatus — a precipitate colour, for instance, is owned by the
   * chemistry model and not by the beaker holding it. Values are read-only and
   * never recomputed by the interface.
   */
  readonly observables: Readonly<Record<string, boolean | number | string>>;
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
  /** Exact validated definition supplied only by the isolated Composer preview. */
  readonly workflow?: Readonly<ValidatedLabWorkflowSpecV2>;
}

export interface SetupDrivenTitrationTransition {
  readonly state: Readonly<TitrationState>;
  readonly events: GenericLabRuntimeTransition["events"];
  readonly inspection: Readonly<SetupDrivenRuntimeInspection>;
  readonly projection: Readonly<SetupDrivenLabProjection>;
}

export interface SetupDrivenTitrationSession {
  readonly mode: "setup_driven_v2";
  getWorkflow(): Readonly<ValidatedLabWorkflowSpecV2>;
  getState(): Readonly<TitrationState>;
  getGenericState(): Readonly<GenericLabState>;
  getInspection(): Readonly<SetupDrivenRuntimeInspection>;
  getProjection(): Readonly<SetupDrivenLabProjection>;
  getConsumerContext(): Readonly<LabWorkflowConsumerContext>;
  getActionTrace(): Readonly<GenericLabActionTrace>;
  dispatch(action: NormalizedLabAction): SetupDrivenTitrationTransition;
}

export interface CreateSetupDrivenNativeSessionInput {
  readonly sessionId: string;
  readonly sessionSeed: string;
  readonly selection: SetupDrivenLabSelection;
  readonly workflow: Readonly<ValidatedLabWorkflowSpecV2>;
}

export interface SetupDrivenNativeTransition {
  readonly state: Readonly<GenericLabState>;
  readonly events: GenericLabRuntimeTransition["events"];
  readonly inspection: Readonly<SetupDrivenRuntimeInspection>;
  readonly projection: Readonly<SetupDrivenLabProjection>;
}

export interface SetupDrivenNativeSession {
  readonly mode: "setup_driven_v2";
  getWorkflow(): Readonly<ValidatedLabWorkflowSpecV2>;
  getState(): Readonly<GenericLabState>;
  getGenericState(): Readonly<GenericLabState>;
  getInspection(): Readonly<SetupDrivenRuntimeInspection>;
  getProjection(): Readonly<SetupDrivenLabProjection>;
  getConsumerContext(): Readonly<LabWorkflowConsumerContext>;
  getActionTrace(): Readonly<GenericLabActionTrace>;
  dispatch(action: NormalizedLabAction): SetupDrivenNativeTransition;
}

export function resolveLabSessionRuntimeMode(
  experimentId: ExperimentId,
  requestedFlag: string | undefined
): LabSessionRuntimeMode {
  if (experimentId !== "acid_base_titration") return "legacy";
  // Phase 5 flip: production/demo titration defaults to the capability-native
  // generic runtime (no legacy engine, no compatibility adapter).
  // Explicit ?runtime=legacy retains the static engine for rollback/parity.
  if (requestedFlag === LEGACY_TITRATION_RUNTIME_FLAG) return "legacy";
  // Explicit ?runtime=setup-v2 retains the setup-driven v2 strangler
  // (legacy engine behind the generic runtime) as the rollback path.
  if (requestedFlag === SETUP_DRIVEN_TITRATION_RUNTIME_FLAG) {
    return "setup_driven_v2";
  }
  // Everything else — no flag, ?runtime=native, ?runtime=endpoint-drill
  // (which now selects the native drill definition), or an unknown value —
  // resolves to the native runtime.
  return "native_v2";
}

/**
 * Legacy titration action → the v2 action it corresponds to, with the
 * parameters that action's schema declares.
 */
function titrationActionContract(
  action: Readonly<TitrationAction>
): {
  readonly actionId: string;
  readonly parameters: NormalizedLabAction["parameters"];
} {
  switch (action.type) {
    case "rinse_burette":
      return {
        actionId: "action.rinse.v1",
        parameters: [
          { key: "solvent", valueType: "enum", value: action.solvent }
        ]
      };
    case "fill_burette":
      return {
        actionId: "action.fill.v1",
        parameters: [
          { key: "volumeML", valueType: "number", value: action.volumeML }
        ]
      };
    case "select_indicator":
      return {
        actionId: "action.add_indicator.v1",
        parameters: [
          { key: "indicator", valueType: "enum", value: action.indicator }
        ]
      };
    case "read_meniscus":
      return {
        actionId: "action.read_volume.v1",
        parameters: [
          { key: "reportedML", valueType: "number", value: action.reportedML }
        ]
      };
    case "add_titrant":
      return {
        actionId: "action.dispense.v1",
        parameters: [
          { key: "volumeML", valueType: "number", value: action.volumeML },
          { key: "durationS", valueType: "number", value: action.durationS }
        ]
      };
    default:
      throw new SetupDrivenSessionError(
        SETUP_DRIVEN_SESSION_ERROR_CODES.actionUnsupported,
        `The setup-driven titration definition does not permit ${action.type}.`
      );
  }
}

/**
 * Normalize a legacy titration action against the workflow actually loaded.
 *
 * Permission IDs and equipment bindings are read from the workflow rather than
 * hardcoded: the endpoint drill names its permissions `migration.permission.*`
 * and only permits reading and dispensing, so a hardcoded mapping silently
 * excluded every preparation step of a full procedure.
 */
export function normalizeSetupDrivenTitrationAction(
  action: Readonly<TitrationAction>,
  workflow?: Readonly<ValidatedLabWorkflowSpecV2>
): NormalizedLabAction {
  const contract = titrationActionContract(action);
  const permission = workflow?.permittedActions.find(
    ({ actionId }) => actionId === contract.actionId
  );
  if (workflow && !permission) {
    throw new SetupDrivenSessionError(
      SETUP_DRIVEN_SESSION_ERROR_CODES.actionUnsupported,
      `The loaded workflow does not permit ${contract.actionId}.`
    );
  }

  return {
    schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
    permissionId:
      permission?.id ??
      (contract.actionId === "action.read_volume.v1"
        ? "migration.permission.s1.a1"
        : "migration.permission.s2.a1"),
    actionId: contract.actionId,
    sourceEquipmentInstanceId:
      permission?.sourceEquipmentInstanceId ?? "titrant_burette",
    targetEquipmentInstanceIds: [
      ...(permission?.targetEquipmentInstanceIds ??
        (contract.actionId === "action.dispense.v1" ? ["analyte_flask"] : []))
    ],
    parameters: contract.parameters
  };
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
  const workflow =
    input.workflow ??
    (input.selection.workflowId === FULL_TITRATION_WORKFLOW_ID
      ? validateFullTitrationV2(SETUP_DRIVEN_TITRATION_VALIDATION_TIME)
      : validateStrictMigratedTitrationV2(
          SETUP_DRIVEN_TITRATION_VALIDATION_TIME
        ));
  const eligibility = evaluateLabWorkflowEligibilityV2(workflow, "preview");
  if (
    !eligibility.eligible ||
    workflow.id !== input.selection.workflowId ||
    workflow.validation.canonicalSpecHash !== input.selection.workflowHash
  ) {
    throw new SetupDrivenSessionError(
      SETUP_DRIVEN_SESSION_ERROR_CODES.selectionInvalid,
      "The requested setup-driven definition is stale, ineligible, or does not match its exact ID and hash."
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

  return createSession(runtime, input.sessionSeed, () => {
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
  });
}

export function createSetupDrivenNativeSession(
  input: CreateSetupDrivenNativeSessionInput
): SetupDrivenNativeSession {
  const { workflow } = input;
  const eligibility = evaluateLabWorkflowEligibilityV2(workflow, "preview");
  if (
    workflow.compatibility ||
    !eligibility.eligible ||
    workflow.id !== input.selection.workflowId ||
    workflow.validation.canonicalSpecHash !== input.selection.workflowHash
  ) {
    throw new SetupDrivenSessionError(
      SETUP_DRIVEN_SESSION_ERROR_CODES.selectionInvalid,
      "The requested native definition is stale, ineligible, compatibility-owned, or does not match its exact ID and hash."
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
    createCapabilityGenericRuntimePorts(workflow)
  );
  return createSession(runtime, input.sessionSeed, runtime.getState);
}

export interface CreateSetupDrivenNativeTitrationSessionInput {
  readonly sessionId: string;
  readonly sessionSeed: string;
  readonly selection?: SetupDrivenLabSelection;
  /** Exact validated definition supplied only by isolated preview surfaces. */
  readonly workflow?: Readonly<ValidatedLabWorkflowSpecV2>;
}

/**
 * Resolve the validated capability-native titration workflow for an exact
 * selection ID. Only the two registered native titration definitions exist;
 * any other ID fails closed rather than substituting a definition.
 */
export function resolveNativeTitrationWorkflow(
  workflowId: string
): Readonly<ValidatedLabWorkflowSpecV2> {
  if (workflowId === NATIVE_ENDPOINT_DRILL_WORKFLOW_ID) {
    return validateNativeEndpointDrillV2(SETUP_DRIVEN_TITRATION_VALIDATION_TIME);
  }
  if (workflowId === NATIVE_FULL_TITRATION_WORKFLOW_ID) {
    return validateNativeFullTitrationV2(SETUP_DRIVEN_TITRATION_VALIDATION_TIME);
  }
  throw new SetupDrivenSessionError(
    SETUP_DRIVEN_SESSION_ERROR_CODES.selectionInvalid,
    `No capability-native titration definition is registered for ${workflowId}.`
  );
}

function nativeEquipmentField(
  state: Readonly<GenericLabState>,
  equipmentDefinitionId: string,
  key: string
): boolean | null | number | string | readonly string[] {
  const matches = state.equipment.filter(
    (candidate) => candidate.equipmentDefinitionId === equipmentDefinitionId
  );
  const field = matches[0]?.fields.find((candidate) => candidate.key === key);
  if (matches.length !== 1 || !field) {
    throw new SetupDrivenSessionError(
      SETUP_DRIVEN_SESSION_ERROR_CODES.projectionInvalid,
      `The native bench does not project ${equipmentDefinitionId}.${key} exactly.`
    );
  }
  return field.value;
}

function nativeNumberField(
  state: Readonly<GenericLabState>,
  equipmentDefinitionId: string,
  key: string
): number {
  const value = nativeEquipmentField(state, equipmentDefinitionId, key);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new SetupDrivenSessionError(
      SETUP_DRIVEN_SESSION_ERROR_CODES.projectionInvalid,
      `The native bench field ${equipmentDefinitionId}.${key} is not numeric.`
    );
  }
  return value;
}

export interface NativeTitrationCurvePoint {
  readonly volumeML: number;
  readonly pH: number;
}

/**
 * pH-curve points for the native titration bench, read directly from the
 * engine-emitted `add_titrant` event envelopes (`totalML`, `pH` observation
 * keys). This is a pure projection of runtime truth for the chart — it never
 * computes pH. Seeded drills (near-endpoint presets) begin with no emitted
 * `add_titrant` events, so their curve intentionally starts at the first
 * native measurement rather than back-filling the pre-seeded 0–22 mL prefix.
 */
export function nativeTitrationCurvePoints(
  state: Pick<Readonly<GenericLabState>, "eventEnvelopes">
): readonly NativeTitrationCurvePoint[] {
  const points: NativeTitrationCurvePoint[] = [];
  for (const { payload } of state.eventEnvelopes) {
    if (payload.type !== "add_titrant") continue;
    const volumeML = payload.observation.totalML;
    const pH = payload.observation.pH;
    if (
      typeof volumeML === "number" &&
      Number.isFinite(volumeML) &&
      typeof pH === "number" &&
      Number.isFinite(pH)
    ) {
      points.push(Object.freeze({ volumeML, pH }));
    }
  }
  return Object.freeze(points);
}

/**
 * Project the legacy TitrationState view the existing titration UI consumes
 * from native runtime truth. Every value is engine- or registry-owned: burette
 * and flask numbers come from mechanical equipment state, dilution and
 * molarity from chemistry ground truth, simulated time from the acid-base
 * model projection, and the pH curve from emitted add_titrant observations.
 * Nothing here computes chemistry.
 */
export function projectNativeTitrationState(
  workflow: Readonly<ValidatedLabWorkflowSpecV2>,
  state: Readonly<GenericLabState>,
  sessionSeed: string
): Readonly<TitrationState> {
  const flaskInstanceId = workflow.equipment.find(
    ({ equipmentDefinitionId }) =>
      equipmentDefinitionId === "component.erlenmeyer_flask.v1"
  )?.instanceId;
  const profiles = workflow.materials.map((binding) => ({
    binding,
    profile: materialRegistry.get(binding.materialProfileId)
  }));
  const analyte = profiles.find(
    ({ binding, profile }) =>
      binding.containerInstanceId === flaskInstanceId &&
      profile.providedChemistryCapabilityIds.includes(
        "chemistry.acid_base_equilibrium.v1"
      )
  );
  const titrant = profiles.find(
    ({ binding, profile }) =>
      binding.containerInstanceId !== flaskInstanceId &&
      profile.providedChemistryCapabilityIds.includes(
        "chemistry.acid_base_equilibrium.v1"
      )
  );
  const indicatorProfileId = profiles.find(
    ({ profile }) => INDICATOR_PROFILE_IDS[profile.id] !== undefined
  )?.profile.id;
  const indicator: IndicatorId | undefined = indicatorProfileId
    ? INDICATOR_PROFILE_IDS[indicatorProfileId]
    : undefined;
  if (
    !analyte ||
    !titrant ||
    !indicator ||
    analyte.profile.concentrationM === null ||
    titrant.profile.concentrationM === null
  ) {
    throw new SetupDrivenSessionError(
      SETUP_DRIVEN_SESSION_ERROR_CODES.projectionInvalid,
      "The native titration bench does not bind exact analyte, titrant, and indicator materials."
    );
  }

  const deliveredML = nativeNumberField(
    state,
    "component.burette.v1",
    "deliveredML"
  );
  const totalVolumeML = nativeNumberField(
    state,
    "component.erlenmeyer_flask.v1",
    "totalVolumeML"
  );
  const groundTruth = state.chemistry.groundTruth.values;
  const acidBaseModel = state.chemistry.modelStates.find(
    ({ modelId }) => modelId === ACID_BASE_TITRATION_MODEL_ID
  );
  const tSimCentiseconds = acidBaseModel?.fields.find(
    ({ key }) => key === "tSimCentiseconds"
  )?.value;
  const events = state.eventEnvelopes.map(({ payload }) => payload);
  const fillEvents = events.filter(
    ({ type }) => type === "fill_burette" || type === "refill_burette"
  );
  const filled =
    nativeEquipmentField(state, "component.burette.v1", "filled") === true;
  const observationNumber = (
    observation: Readonly<Record<string, boolean | number | string>>,
    key: string
  ): number => {
    const value = observation[key];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  };

  return {
    config: {
      analyte: {
        name: analyte.profile.displayName,
        type: "strong_acid",
        concentrationM:
          groundTruth.trueAnalyteMolarity ?? analyte.profile.concentrationM,
        volumeML: totalVolumeML - deliveredML
      },
      titrant: {
        name: titrant.profile.displayName,
        concentrationM: titrant.profile.concentrationM
      },
      indicator,
      buretteCapacityML: nativeNumberField(
        state,
        "component.burette.v1",
        "capacityML"
      )
    },
    sessionSeed,
    indicatorAdded:
      nativeEquipmentField(
        state,
        "component.erlenmeyer_flask.v1",
        "indicatorAdded"
      ) === true,
    titrantAddedML: deliveredML,
    buretteAvailableML: nativeNumberField(
      state,
      "component.burette.v1",
      "availableML"
    ),
    buretteReadingML: nativeNumberField(
      state,
      "component.burette.v1",
      "meniscusReadingML"
    ),
    fillCount:
      fillEvents.length +
      (filled && !fillEvents.some(({ type }) => type === "fill_burette")
        ? 1
        : 0),
    fillHistory: fillEvents.map((event) => ({
      requestedML: observationNumber(event.observation, "requestedML"),
      resultingAvailableML: observationNumber(
        event.observation,
        "resultingAvailableML"
      ),
      currentReadingML: observationNumber(
        event.observation,
        "currentReadingML"
      ),
      kind: event.type === "fill_burette" ? "initial" : "refill",
      tSim: event.tSim
    })),
    buretteConditioned:
      nativeEquipmentField(state, "component.burette.v1", "conditionedWith") ===
      "titrant",
    titrantDilutionFactor: groundTruth.titrantDilutionFactor ?? 1,
    tSim:
      typeof tSimCentiseconds === "number" ? tSimCentiseconds / 100 : 0,
    curve: events
      .filter(({ type }) => type === "add_titrant")
      .map((event) => ({
        volumeML: observationNumber(event.observation, "totalML"),
        pH: observationNumber(event.observation, "pH")
      })),
    submitted: false
  };
}

/**
 * Native titration session for `?runtime=native`: the generic capability
 * runtime executes the native full-titration workflow while the session keeps
 * exposing the TitrationState projection the existing titration UI renders.
 * Phase 4 (UI unification) moves the UI onto the generic projection directly.
 */
export function createSetupDrivenNativeTitrationSession(
  input: CreateSetupDrivenNativeTitrationSessionInput
): SetupDrivenTitrationSession {
  const selection = input.selection ?? NATIVE_FULL_TITRATION_SETUP_SELECTION;
  const workflow =
    input.workflow ?? resolveNativeTitrationWorkflow(selection.workflowId);
  const native = createSetupDrivenNativeSession({
    sessionId: input.sessionId,
    sessionSeed: input.sessionSeed,
    selection,
    workflow
  });
  const projectedState = () =>
    projectNativeTitrationState(
      native.getWorkflow(),
      native.getGenericState(),
      input.sessionSeed
    );
  return Object.freeze({
    ...native,
    getState: projectedState,
    dispatch(action: NormalizedLabAction) {
      const transition = native.dispatch(action);
      return Object.freeze({
        state: projectedState(),
        events: transition.events,
        inspection: transition.inspection,
        projection: transition.projection
      });
    }
  });
}

interface SetupDrivenSessionContract<State> {
  readonly mode: "setup_driven_v2";
  getWorkflow(): Readonly<ValidatedLabWorkflowSpecV2>;
  getState(): Readonly<State>;
  getGenericState(): Readonly<GenericLabState>;
  getInspection(): Readonly<SetupDrivenRuntimeInspection>;
  getProjection(): Readonly<SetupDrivenLabProjection>;
  getConsumerContext(): Readonly<LabWorkflowConsumerContext>;
  getActionTrace(): Readonly<GenericLabActionTrace>;
  dispatch(action: NormalizedLabAction): {
    readonly state: Readonly<State>;
    readonly events: GenericLabRuntimeTransition["events"];
    readonly inspection: Readonly<SetupDrivenRuntimeInspection>;
    readonly projection: Readonly<SetupDrivenLabProjection>;
  };
}

function createSession<State>(
  runtime: GenericLabRuntime,
  sessionSeed: string,
  projectedState: () => Readonly<State>
): SetupDrivenSessionContract<State> {
  const actions: NormalizedLabAction[] = [];

  function inspection(): Readonly<SetupDrivenRuntimeInspection> {
    const state = runtime.getState();
    const compatibility = state.provenance.compatibility;
    return Object.freeze({
      mode: "setup_driven_v2" as const,
      workflowId: state.provenance.workflowId,
      workflowRevision: state.provenance.workflowRevision,
      workflowHash: state.provenance.workflowHash,
      validatorVersion: state.provenance.validatorVersion,
      runtimeSchemaVersion: state.schemaVersion,
      sequence: state.sequence,
      eventSequence: state.eventSequence,
      executionKind: compatibility
        ? ("legacy_compatibility" as const)
        : ("native_generic" as const),
      runtimeAdapterId: compatibility?.runtimeAdapterId ?? null,
      runtimeAdapterVersion: compatibility?.runtimeAdapterVersion ?? null,
      engineId: compatibility?.engineId ?? null,
      engineVersion: compatibility?.engineVersion ?? null,
      experimentDefinitionId: compatibility?.experimentDefinitionId ?? null,
      experimentDefinitionVersion:
        compatibility?.experimentDefinitionVersion ?? null,
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
    const actions = runtime.program.actions.map((binding) => {
      const { permission } = binding;
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
        authoredLimits: Object.freeze({ ...(permission.authoredLimits ?? {}) }),
        numericParameterBounds: Object.freeze(
          binding.parameters.flatMap((parameter) => {
            if (parameter.valueType !== "number") return [];
            const authoredMinimum = parameter.authoredMinimumKey
              ? (permission.authoredLimits?.[parameter.authoredMinimumKey] ??
                null)
              : null;
            const authoredMaximum = parameter.authoredMaximumKey
              ? (permission.authoredLimits?.[parameter.authoredMaximumKey] ??
                null)
              : null;
            const registeredMinimum = parameter.minimum ?? null;
            const registeredMaximum = parameter.maximum ?? null;
            return [
              Object.freeze({
                parameterKey: parameter.key,
                unitId: parameter.unitId ?? null,
                registeredMinimum,
                registeredMaximum,
                authoredMinimum,
                authoredMaximum,
                effectiveMinimum:
                  registeredMinimum === null
                    ? authoredMinimum
                    : authoredMinimum === null
                      ? registeredMinimum
                      : Math.max(registeredMinimum, authoredMinimum),
                effectiveMaximum:
                  registeredMaximum === null
                    ? authoredMaximum
                    : authoredMaximum === null
                      ? registeredMaximum
                      : Math.min(registeredMaximum, authoredMaximum)
              })
            ];
          })
        )
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
      diagnoses: state.diagnoses,
      observables: Object.freeze(
        Object.fromEntries(
          state.chemistry.observables.flatMap(({ observableId, value }) =>
            typeof value === "boolean" ||
            typeof value === "number" ||
            typeof value === "string"
              ? [[observableId, value] as const]
              : []
          )
        )
      )
    });
  }

  return Object.freeze({
    mode: "setup_driven_v2" as const,
    getWorkflow: () => runtime.program.workflow,
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
