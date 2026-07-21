import type {
  ExperimentDefinition,
  SemanticEvent,
  StepResult
} from "../../../experiments/shared";
import type { ActionParameterDefinition } from "../../registries/actions";
import { ChemistryModelCoordinatorError } from "../../chemistry-models/coordinator";
import { WorkflowEvaluatorError } from "../../evaluation";
import {
  envelopeSemanticEvents,
  linkEnvelopeDiagnoses,
  semanticEventId
} from "../../events";
import {
  applyExecutedMaterialAction,
  initializeMaterialLedger,
  quantityToIntegerUnits,
  validateMaterialLedger
} from "../../chemistry-models/material-ledger";
import type { MaterialLedger } from "../../chemistry-models/material-ledger";
import {
  NativeInitializationPresetError,
  resolveNativeInitializationPreset,
  type NativeEquipmentFieldOverride
} from "../../seeds/nativeInitializationPresets";
import {
  GENERIC_LAB_RUNTIME_ERROR_CODES as ERROR,
  GenericLabRuntimeError
} from "./errors";
import {
  mergeEquipmentObservables,
  projectEquipmentObservables
} from "./equipmentObservables";
import {
  genericChemistryProjectionSchema,
  genericEquipmentStateSchema,
  genericLabConfigSchema,
  genericLegacyCompatibilityStateSchema,
  genericLabStateSchema,
  genericMaterialActionSchema,
  normalizedLabActionSchema,
  semanticEventSchema
} from "./schemas";
import type { CompiledGenericRuntime } from "./compile";
import {
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  type CompiledActionBinding,
  type CompiledEquipmentBinding,
  type GenericEquipmentState,
  type GenericChemistryProjection,
  type GenericLabConfig,
  type GenericLabState,
  type GenericLegacyRuntimeAdapterPort,
  type GenericLegacyRuntimeProjection,
  type GenericMechanicalAdapterPort,
  type GenericMechanicalTransition,
  type GenericPortCheck,
  type GenericRuntimeProvenance,
  type GenericStateValue,
  type NormalizedActionParameter,
  type NormalizedLabAction
} from "./types";
import { deepFreeze, sameIds } from "./utils";

export type GenericLabDefinition = ExperimentDefinition<
  GenericLabConfig,
  GenericLabState,
  NormalizedLabAction
>;

function fail(
  code: GenericLabRuntimeError["code"],
  message: string,
  details: GenericLabRuntimeError["details"] = {}
): never {
  throw new GenericLabRuntimeError(code, message, details);
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function valueMatches(
  value: GenericStateValue,
  field: CompiledEquipmentBinding["stateFields"][number]
): boolean {
  if (value === null) return field.nullable;
  switch (field.valueType) {
    case "boolean":
      return typeof value === "boolean";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "string":
      return typeof value === "string";
    case "string_array":
      return (
        Array.isArray(value) &&
        value.every((entry) => typeof entry === "string")
      );
    case "enum":
      return typeof value === "string" && field.allowedValues.includes(value);
  }
}

function validateEquipment(
  candidate: unknown,
  program: CompiledGenericRuntime["program"]
): readonly GenericEquipmentState[] {
  const parsed = genericEquipmentStateSchema.array().safeParse(candidate);
  if (!parsed.success) {
    fail(
      ERROR.invalidState,
      "Mechanical port returned invalid equipment state."
    );
  }
  if (parsed.data.length !== program.equipment.length) {
    fail(
      ERROR.portContractMismatch,
      "Mechanical transition changed the equipment instance set."
    );
  }
  const seen = new Set<string>();
  for (const state of parsed.data) {
    if (seen.has(state.instanceId)) {
      fail(
        ERROR.portContractMismatch,
        `Duplicate equipment ${state.instanceId}.`
      );
    }
    seen.add(state.instanceId);
    const binding = program.equipment.find(
      ({ instanceId }) => instanceId === state.instanceId
    );
    if (
      !binding ||
      state.equipmentDefinitionId !== binding.equipmentDefinitionId ||
      state.stateSchemaId !== binding.stateSchemaId
    ) {
      fail(
        ERROR.portContractMismatch,
        `Equipment state ${state.instanceId} does not match its compiled binding.`,
        { equipmentInstanceId: state.instanceId }
      );
    }
    const fieldKeys = new Set<string>();
    for (const field of state.fields) {
      if (fieldKeys.has(field.key)) {
        fail(
          ERROR.portContractMismatch,
          `Duplicate state field ${field.key} on ${state.instanceId}.`
        );
      }
      fieldKeys.add(field.key);
      const definition = binding.stateFields.find(
        ({ key }) => key === field.key
      );
      if (!definition || !valueMatches(field.value, definition)) {
        fail(
          ERROR.portContractMismatch,
          `State field ${field.key} does not match ${binding.stateSchemaId}.`,
          { equipmentInstanceId: state.instanceId, stateField: field.key }
        );
      }
    }
    if (fieldKeys.size !== binding.stateFields.length) {
      fail(
        ERROR.portContractMismatch,
        `Equipment state ${state.instanceId} omits registered fields.`,
        { equipmentInstanceId: state.instanceId }
      );
    }
  }
  return parsed.data;
}

/**
 * Resolve the mechanic that will apply this action.
 *
 * An action nominates one apparatus's adapter (`pour_liquid` names the
 * calorimeter's), which would pin every pour to that one vessel. So prefer an
 * adapter belonging to a participating equipment instance that supports both
 * this equipment and this action, and fall back to the action's nominee. This
 * is what lets a beaker and a calorimeter both receive the same pour while
 * each keeps its own mechanics.
 */
function adapterFor(
  compiled: CompiledGenericRuntime,
  binding: CompiledActionBinding,
  participantEquipmentDefinitionIds: readonly string[] = []
): GenericMechanicalAdapterPort {
  const participantAdapter = compiled.ports.mechanicalAdapters.find(
    (candidate) =>
      candidate.supportedActionIds.includes(binding.permission.actionId) &&
      participantEquipmentDefinitionIds.some((equipmentDefinitionId) =>
        candidate.supportedEquipmentDefinitionIds.includes(
          equipmentDefinitionId
        )
      )
  );
  if (participantAdapter) return participantAdapter;

  const adapter = compiled.ports.mechanicalAdapters.find(
    ({ adapterId }) => adapterId === binding.mechanicalAdapterId
  );
  if (!adapter) {
    fail(
      ERROR.portUnavailable,
      `Mechanical adapter ${binding.mechanicalAdapterId} is unavailable.`,
      { adapterId: binding.mechanicalAdapterId }
    );
  }
  return adapter;
}

function legacyAdapterFor(
  compiled: CompiledGenericRuntime
): GenericLegacyRuntimeAdapterPort | null {
  const compatibility = compiled.program.provenance.compatibility;
  if (!compatibility) return null;
  const matches = (compiled.ports.legacyRuntimeAdapters ?? []).filter(
    ({ runtimeAdapterId }) =>
      runtimeAdapterId === compatibility.runtimeAdapterId
  );
  if (matches.length !== 1) {
    fail(
      ERROR.portUnavailable,
      `Legacy runtime adapter ${compatibility.runtimeAdapterId} is unavailable.`,
      { adapterId: compatibility.runtimeAdapterId }
    );
  }
  return matches[0]!;
}

function parseLegacyProjection(
  candidate: GenericLegacyRuntimeProjection,
  compiled: CompiledGenericRuntime,
  allowEvents: boolean
): GenericLegacyRuntimeProjection {
  const compatibilityState = genericLegacyCompatibilityStateSchema.safeParse(
    candidate.compatibilityState
  );
  const compatibility = compiled.program.provenance.compatibility;
  if (
    !compatibilityState.success ||
    !compatibility ||
    compatibilityState.data.runtimeAdapterId !==
      compatibility.runtimeAdapterId ||
    compatibilityState.data.runtimeAdapterVersion !==
      compatibility.runtimeAdapterVersion
  ) {
    fail(
      ERROR.portContractMismatch,
      "Legacy port returned incompatible serialized state."
    );
  }
  const equipment = validateEquipment(candidate.equipment, compiled.program);
  let materialLedger;
  try {
    materialLedger = validateMaterialLedger(candidate.materialLedger);
  } catch {
    fail(
      ERROR.portContractMismatch,
      "Legacy port returned an invalid material projection."
    );
  }
  const chemistry = genericChemistryProjectionSchema.safeParse(
    candidate.chemistry
  );
  const events = semanticEventSchema.array().safeParse(candidate.events);
  if (
    !chemistry.success ||
    !events.success ||
    (!allowEvents && events.data.length > 0) ||
    new Set(candidate.materialInstanceIds).size !==
      candidate.materialInstanceIds.length
  ) {
    fail(
      ERROR.portContractMismatch,
      "Legacy port returned an invalid deterministic projection."
    );
  }
  return deepFreeze({
    compatibilityState: compatibilityState.data,
    equipment,
    materialLedger,
    chemistry: chemistry.data,
    events: events.data,
    materialInstanceIds: [...candidate.materialInstanceIds].sort()
  });
}

function assertCheck(
  check: GenericPortCheck,
  code: typeof ERROR.preconditionFailed | typeof ERROR.safetyRejected,
  fallback: string
): void {
  if (!check.ok) {
    fail(code, check.message || fallback, { reasonCode: check.reasonCode });
  }
}

function runCheck(
  check: () => GenericPortCheck,
  code: typeof ERROR.preconditionFailed | typeof ERROR.safetyRejected,
  fallback: string
): void {
  let result: GenericPortCheck;
  try {
    result = check();
  } catch {
    fail(code, fallback, { reasonCode: "port.check_threw" });
  }
  assertCheck(result, code, fallback);
}

function assertProvenance(
  actual: GenericRuntimeProvenance,
  expected: GenericRuntimeProvenance
): void {
  if (!sameJson(actual, expected)) {
    fail(
      ERROR.invalidState,
      "State provenance does not match the compiled lab definition."
    );
  }
}

function sameIdSet(left: readonly string[], right: readonly string[]): boolean {
  const sortedRight = [...right].sort();
  return (
    left.length === right.length &&
    [...left].sort().every((id, index) => id === sortedRight[index])
  );
}

function assertStateMatchesProgram(
  state: GenericLabState,
  compiled: CompiledGenericRuntime
): void {
  const compatibility = compiled.program.provenance.compatibility;
  if (
    (compatibility === null) !== (state.compatibilityState === null) ||
    (compatibility !== null &&
      (state.compatibilityState?.runtimeAdapterId !==
        compatibility.runtimeAdapterId ||
        state.compatibilityState.runtimeAdapterVersion !==
          compatibility.runtimeAdapterVersion))
  ) {
    fail(
      ERROR.invalidState,
      "State compatibility provenance does not match the compiled definition."
    );
  }
  validateEquipment(state.equipment, compiled.program);
  const ledger = validateMaterialLedger(state.materialLedger);
  const materialById = new Map(
    compiled.program.materials.map((material) => [
      material.instanceId,
      material
    ])
  );
  if (
    ledger.materials.length !== materialById.size ||
    ledger.materials.some((material) => {
      const compiledMaterial = materialById.get(material.materialInstanceId);
      return (
        !compiledMaterial ||
        material.materialProfileId !== compiledMaterial.materialProfileId ||
        material.materialVersion !== compiledMaterial.materialVersion ||
        material.unitId !== compiledMaterial.quantityUnitId ||
        quantityToIntegerUnits(material.initialAmount, material.unitId) !==
          quantityToIntegerUnits(
            compiledMaterial.quantityAmount,
            compiledMaterial.quantityUnitId
          ) ||
        material.locations.some(
          ({ equipmentInstanceId }) =>
            !compiled.program.equipment.some(
              ({ instanceId }) => instanceId === equipmentInstanceId
            )
        )
      );
    })
  ) {
    fail(
      ERROR.invalidState,
      "State material ledger does not match the compiled lab definition."
    );
  }
  if (
    !sameIdSet(
      state.permissionAttempts.map(({ permissionId }) => permissionId),
      compiled.program.actions.map(({ permission }) => permission.id)
    )
  ) {
    fail(
      ERROR.invalidState,
      "State permission attempts do not match the compiled lab definition."
    );
  }
  if (
    state.diagnoses.length !== compiled.program.rules.length ||
    state.diagnoses.some((diagnosis, index) => {
      const rule = compiled.program.rules[index];
      return (
        !rule ||
        diagnosis.ruleId !== rule.id ||
        diagnosis.severity !== rule.severity ||
        diagnosis.recoverable !== rule.recoverable ||
        !sameIds(diagnosis.objectiveIds, rule.objectiveIds)
      );
    })
  ) {
    fail(
      ERROR.invalidState,
      "State diagnoses do not match the compiled workflow rules."
    );
  }
  const expectedModels = compiled.program.provenance.resolvedChemistryModels;
  if (
    state.chemistry.modelStates.length !== expectedModels.length ||
    state.chemistry.modelStates.some(
      (model, index) =>
        expectedModels[index]?.modelId !== model.modelId ||
        expectedModels[index]?.version !== model.modelVersion ||
        new Set(model.fields.map(({ key }) => key)).size !== model.fields.length
    )
  ) {
    fail(
      ERROR.invalidState,
      "State model projections do not match validated model provenance."
    );
  }
  const observableIds = new Set<string>();
  for (const observable of state.chemistry.observables) {
    if (
      observableIds.has(observable.observableId) ||
      !compiled.program.registeredObservableIds.includes(
        observable.observableId
      ) ||
      (observable.unitId !== undefined &&
        !compiled.program.registeredUnitIds.includes(observable.unitId))
    ) {
      fail(
        ERROR.invalidState,
        "State observable projections do not match registered observables."
      );
    }
    observableIds.add(observable.observableId);
  }
  if (
    state.eventSequence !== state.eventEnvelopes.length ||
    state.eventEnvelopes.some((envelope, index) => {
      const binding = compiled.program.actions.find(
        ({ permission }) =>
          permission.id === envelope.normalizedAction.permissionId
      );
      return (
        envelope.sequence !== index ||
        envelope.eventId !== semanticEventId(state.sessionId, index) ||
        envelope.actionSequence > state.sequence ||
        envelope.sourceEquipmentInstanceId !==
          envelope.normalizedAction.sourceEquipmentInstanceId ||
        !sameIds(
          envelope.targetEquipmentInstanceIds,
          envelope.normalizedAction.targetEquipmentInstanceIds
        ) ||
        new Set(envelope.materialInstanceIds).size !==
          envelope.materialInstanceIds.length ||
        new Set(envelope.ruleEvidenceIds).size !==
          envelope.ruleEvidenceIds.length ||
        envelope.ruleEvidenceIds.some(
          (ruleId) => !compiled.program.rules.some(({ id }) => id === ruleId)
        ) ||
        !binding ||
        !binding.emittedSemanticEventTypes.includes(envelope.payload.type)
      );
    })
  ) {
    fail(
      ERROR.invalidState,
      "State event envelopes are not a contiguous compiled-runtime trace."
    );
  }
  const derivedStatus = deriveWorkflowStatus(
    compiled.program.rules,
    state.diagnoses,
    state.workflowStatus === "failed" ? "failed" : "in_progress"
  );
  if (derivedStatus !== state.workflowStatus) {
    fail(
      ERROR.invalidState,
      "State workflow status does not match its deterministic diagnoses."
    );
  }
}

function requiredParameter(
  supplied: readonly NormalizedActionParameter[],
  definition: ActionParameterDefinition,
  actionId: string
): NormalizedActionParameter | null {
  const matches = supplied.filter(({ key }) => key === definition.key);
  if (matches.length > 1) {
    fail(
      ERROR.parameterInvalid,
      `Action ${actionId} repeats parameter ${definition.key}.`,
      { actionId, parameterKey: definition.key }
    );
  }
  const parameter = matches[0] ?? null;
  if (!parameter && definition.required) {
    fail(
      ERROR.parameterInvalid,
      `Action ${actionId} requires parameter ${definition.key}.`,
      { actionId, parameterKey: definition.key }
    );
  }
  return parameter;
}

function validateParameters(
  binding: CompiledActionBinding,
  action: NormalizedLabAction
): void {
  const known = new Set(binding.parameters.map(({ key }) => key));
  for (const supplied of action.parameters) {
    if (!known.has(supplied.key)) {
      fail(
        ERROR.parameterInvalid,
        `Action ${action.actionId} does not accept ${supplied.key}.`,
        { actionId: action.actionId, parameterKey: supplied.key }
      );
    }
  }
  for (const definition of binding.parameters) {
    const supplied = requiredParameter(
      action.parameters,
      definition,
      action.actionId
    );
    if (!supplied) continue;
    if (definition.valueType === "number") {
      if (supplied.valueType !== "number") {
        fail(ERROR.parameterInvalid, `${definition.key} must be numeric.`);
      }
      const maximumKey = definition.authoredMaximumKey;
      const minimumKey = definition.authoredMinimumKey;
      const authoredMaximum = maximumKey
        ? binding.permission.authoredLimits?.[maximumKey]
        : undefined;
      const authoredMinimum = minimumKey
        ? binding.permission.authoredLimits?.[minimumKey]
        : undefined;
      const details: Record<string, GenericLabRuntimeError["details"][string]> =
        {
          actionId: action.actionId,
          parameterKey: definition.key,
          submittedValue: supplied.value
        };
      if (definition.minimum !== undefined) {
        details.registeredMinimum = definition.minimum;
      }
      if (definition.maximum !== undefined) {
        details.registeredMaximum = definition.maximum;
      }
      if (authoredMinimum !== undefined) {
        details.authoredMinimum = authoredMinimum;
      }
      if (authoredMaximum !== undefined) {
        details.authoredMaximum = authoredMaximum;
      }
      const effectiveMinimum = Math.max(
        definition.minimum ?? Number.NEGATIVE_INFINITY,
        authoredMinimum ?? Number.NEGATIVE_INFINITY
      );
      const effectiveMaximum = Math.min(
        definition.maximum ?? Number.POSITIVE_INFINITY,
        authoredMaximum ?? Number.POSITIVE_INFINITY
      );
      if (Number.isFinite(effectiveMinimum)) {
        details.effectiveMinimum = effectiveMinimum;
      }
      if (Number.isFinite(effectiveMaximum)) {
        details.effectiveMaximum = effectiveMaximum;
      }
      if (
        (definition.minimum !== undefined &&
          supplied.value < definition.minimum) ||
        (definition.maximum !== undefined &&
          supplied.value > definition.maximum) ||
        (authoredMinimum !== undefined && supplied.value < authoredMinimum) ||
        (authoredMaximum !== undefined && supplied.value > authoredMaximum)
      ) {
        fail(
          ERROR.parameterInvalid,
          `${definition.key} is outside the registered action bounds.`,
          details
        );
      }
    } else {
      if (
        supplied.valueType !== definition.valueType ||
        typeof supplied.value !== "string" ||
        (definition.allowedValues !== undefined &&
          !definition.allowedValues.includes(supplied.value))
      ) {
        fail(
          ERROR.parameterInvalid,
          `${definition.key} is not an allowed ${definition.valueType} value.`,
          { actionId: action.actionId, parameterKey: definition.key }
        );
      }
    }
  }
}

function assertCapabilities(
  required: readonly string[],
  binding: CompiledEquipmentBinding | null,
  actionId: string,
  role: "source" | "target"
): void {
  if (
    required.length > 0 &&
    (!binding ||
      required.some(
        (capabilityId) =>
          !binding.capabilityIds.includes(
            capabilityId as (typeof binding.capabilityIds)[number]
          )
      ))
  ) {
    fail(
      ERROR.capabilityMismatch,
      `${actionId} ${role} capabilities do not match the compiled connection.`,
      { actionId, equipmentRole: role }
    );
  }
}

function resolveAction(
  compiled: CompiledGenericRuntime,
  state: GenericLabState,
  action: NormalizedLabAction
): {
  readonly binding: CompiledActionBinding;
  readonly source: GenericEquipmentState | null;
  readonly targets: readonly GenericEquipmentState[];
} {
  const binding = compiled.program.actions.find(
    ({ permission }) => permission.id === action.permissionId
  );
  if (!binding) {
    fail(
      ERROR.permissionUnavailable,
      `Permission ${action.permissionId} is not compiled for this lab.`,
      { permissionId: action.permissionId }
    );
  }
  if (
    binding.permission.actionId !== action.actionId ||
    binding.permission.sourceEquipmentInstanceId !==
      action.sourceEquipmentInstanceId ||
    !sameIds(
      binding.permission.targetEquipmentInstanceIds,
      action.targetEquipmentInstanceIds
    )
  ) {
    fail(
      ERROR.permissionMismatch,
      `Action ${action.actionId} does not match permission ${action.permissionId}.`,
      { actionId: action.actionId, permissionId: action.permissionId }
    );
  }

  const diagnoses = new Map(
    state.diagnoses.map((diagnosis) => [diagnosis.ruleId, diagnosis.status])
  );
  const availability = binding.permission.availability;
  if (
    availability.allSatisfiedRuleIds.some(
      (ruleId) => diagnoses.get(ruleId) !== "satisfied"
    ) ||
    availability.allUnsatisfiedRuleIds.some(
      (ruleId) => diagnoses.get(ruleId) === "satisfied"
    )
  ) {
    fail(
      ERROR.permissionUnavailable,
      `Permission ${action.permissionId} is not currently available.`,
      { permissionId: action.permissionId }
    );
  }

  const attempts =
    state.permissionAttempts.find(
      ({ permissionId }) => permissionId === action.permissionId
    )?.count ?? 0;
  if (
    binding.permission.maxAttempts !== undefined &&
    attempts >= binding.permission.maxAttempts
  ) {
    fail(
      ERROR.attemptLimitExceeded,
      `Permission ${action.permissionId} exceeded its attempt limit.`,
      {
        permissionId: action.permissionId,
        maxAttempts: binding.permission.maxAttempts
      }
    );
  }

  const source = action.sourceEquipmentInstanceId
    ? (state.equipment.find(
        ({ instanceId }) => instanceId === action.sourceEquipmentInstanceId
      ) ?? null)
    : null;
  const targets = action.targetEquipmentInstanceIds.map((instanceId) => {
    const target = state.equipment.find(
      ({ instanceId: candidate }) => candidate === instanceId
    );
    if (!target) {
      fail(
        ERROR.permissionMismatch,
        `Unknown target equipment ${instanceId}.`,
        { equipmentInstanceId: instanceId }
      );
    }
    return target;
  });
  const sourceBinding = source
    ? (compiled.program.equipment.find(
        ({ instanceId }) => instanceId === source.instanceId
      ) ?? null)
    : null;
  assertCapabilities(
    binding.requiredSourceCapabilityIds,
    sourceBinding,
    action.actionId,
    "source"
  );
  for (const target of targets) {
    const targetBinding =
      compiled.program.equipment.find(
        ({ instanceId }) => instanceId === target.instanceId
      ) ?? null;
    assertCapabilities(
      binding.requiredTargetCapabilityIds,
      targetBinding,
      action.actionId,
      "target"
    );
  }
  validateParameters(binding, action);
  return { binding, source, targets };
}

function parseTransition(
  candidate: GenericMechanicalTransition,
  compiled: CompiledGenericRuntime,
  action: NormalizedLabAction
): GenericMechanicalTransition {
  const equipment = validateEquipment(candidate.equipment, compiled.program);
  const events = semanticEventSchema.array().safeParse(candidate.events);
  if (!events.success) {
    fail(ERROR.portContractMismatch, "Mechanical port emitted invalid events.");
  }
  const actionBinding = compiled.program.actions.find(
    ({ permission }) => permission.id === action.permissionId
  );
  if (
    !actionBinding ||
    events.data.some(
      ({ type }) => !actionBinding.emittedSemanticEventTypes.includes(type)
    )
  ) {
    fail(
      ERROR.portContractMismatch,
      "Mechanical port emitted an event outside its registered contract.",
      { actionId: action.actionId }
    );
  }
  const parsedMaterialAction = candidate.materialAction
    ? genericMaterialActionSchema.safeParse(candidate.materialAction)
    : null;
  if (parsedMaterialAction && !parsedMaterialAction.success) {
    fail(
      ERROR.portContractMismatch,
      "Mechanical port returned an invalid material-action signal."
    );
  }
  const materialAction = parsedMaterialAction?.data ?? null;
  const transferMaterialIds = materialAction
    ? [
        ...new Set(
          materialAction.transfers.map(
            ({ materialInstanceId }) => materialInstanceId
          )
        )
      ]
    : [];
  if (
    materialAction &&
    (materialAction.actionId !== action.actionId ||
      materialAction.sourceEquipmentInstanceId !==
        action.sourceEquipmentInstanceId ||
      !sameIds(
        materialAction.targetEquipmentInstanceIds,
        action.targetEquipmentInstanceIds
      ) ||
      !sameIds(materialAction.materialInstanceIds, transferMaterialIds) ||
      materialAction.materialInstanceIds.some(
        (id) =>
          !compiled.program.materials.some(
            ({ instanceId }) => instanceId === id
          )
      ) ||
      materialAction.transfers.some((transfer) => {
        const material = compiled.program.materials.find(
          ({ instanceId }) => instanceId === transfer.materialInstanceId
        );
        return (
          transfer.sourceEquipmentInstanceId !==
            action.sourceEquipmentInstanceId ||
          !action.targetEquipmentInstanceIds.includes(
            transfer.targetEquipmentInstanceId
          ) ||
          !material ||
          transfer.materialProfileId !== material.materialProfileId ||
          transfer.unitId !== material.quantityUnitId
        );
      }))
  ) {
    fail(
      ERROR.portContractMismatch,
      "Mechanical port returned an invalid material-action signal."
    );
  }
  return { equipment, materialAction, events: events.data };
}

function applyEquipmentFieldOverrides(
  equipment: readonly GenericEquipmentState[],
  overrides: readonly NativeEquipmentFieldOverride[]
): readonly GenericEquipmentState[] {
  let next = equipment;
  for (const override of overrides) {
    const state = next.find(
      ({ instanceId }) => instanceId === override.equipmentInstanceId
    );
    if (!state) {
      fail(
        ERROR.transitionRejected,
        `Initialization preset targets unknown equipment ${override.equipmentInstanceId}.`,
        { equipmentInstanceId: override.equipmentInstanceId }
      );
    }
    const known = new Set(state.fields.map(({ key }) => key));
    for (const key of Object.keys(override.fields)) {
      if (!known.has(key)) {
        fail(
          ERROR.transitionRejected,
          `Initialization preset writes unknown field ${override.equipmentInstanceId}.${key}.`,
          { equipmentInstanceId: override.equipmentInstanceId, stateField: key }
        );
      }
    }
    const seeded: GenericEquipmentState = {
      ...state,
      fields: state.fields.map((field) =>
        Object.hasOwn(override.fields, field.key)
          ? { key: field.key, value: override.fields[field.key]! }
          : { ...field }
      )
    };
    next = next.map((candidate) =>
      candidate.instanceId === seeded.instanceId ? seeded : candidate
    );
  }
  return next;
}

/**
 * Merge registered equipment-owned observables into the chemistry projection.
 * The chemistry models own solution truth; measurement observables owned by an
 * apparatus (for example the burette meniscus reading) project from equipment
 * state so rules and evidence can reference them without any model faking
 * equipment knowledge.
 */
function withEquipmentObservables(
  program: CompiledGenericRuntime["program"],
  chemistry: GenericChemistryProjection,
  equipment: readonly GenericEquipmentState[]
): GenericChemistryProjection {
  const projected = projectEquipmentObservables(program, equipment);
  if (projected.length === 0) return chemistry;
  return {
    ...chemistry,
    observables: mergeEquipmentObservables(chemistry.observables, projected)
  };
}

function incrementAttempts(
  state: GenericLabState,
  permissionId: string
): GenericLabState["permissionAttempts"] {
  return state.permissionAttempts.map((entry) =>
    entry.permissionId === permissionId
      ? { ...entry, count: entry.count + 1 }
      : entry
  );
}

function deriveWorkflowStatus(
  rules: CompiledGenericRuntime["program"]["rules"],
  diagnoses: GenericLabState["diagnoses"],
  previous: GenericLabState["workflowStatus"] = "in_progress"
): GenericLabState["workflowStatus"] {
  if (previous === "failed") return "failed";
  const diagnosisById = new Map(
    diagnoses.map((diagnosis) => [diagnosis.ruleId, diagnosis])
  );
  if (
    rules.some(
      (rule) =>
        rule.terminal && diagnosisById.get(rule.id)?.status === "violated"
    )
  ) {
    return "failed";
  }
  /*
   * Ordering rules are recorded and scored, but they do not gate completion.
   *
   * `rule_satisfied_before` latches once violated, so treating ordering rules
   * as gating meant a single out-of-order step made a lab permanently
   * unwinnable while still reporting `in_progress` — every control stayed
   * enabled and nothing ever explained why the run would not finish. The
   * violation still stands on the diagnosis record and still costs the
   * student the matching rubric criterion; it just no longer traps them.
   *
   * An ordering mistake serious enough to end the attempt is expressed by
   * marking the rule `terminal`, which is checked above and still fails the
   * workflow outright.
   */
  const gatingRules = rules.filter(
    ({ kind }) => kind === "required" || kind === "success"
  );
  const blockingViolation = rules.some(
    (rule) =>
      (rule.kind === "failure" || rule.kind === "forbidden") &&
      diagnosisById.get(rule.id)?.status === "violated"
  );
  return gatingRules.some(({ kind }) => kind === "success") &&
    gatingRules.every(
      ({ id }) => diagnosisById.get(id)?.status === "satisfied"
    ) &&
    !blockingViolation
    ? "completed"
    : "in_progress";
}

export function createGenericLabDefinition(
  compiled: CompiledGenericRuntime
): GenericLabDefinition {
  const program = compiled.program;

  function createInitialState(
    input: GenericLabConfig,
    seed?: Partial<GenericLabState>
  ): GenericLabState {
    const config = genericLabConfigSchema.safeParse(input);
    if (!config.success) {
      fail(ERROR.invalidConfig, "Generic lab configuration is invalid.");
    }
    if (
      config.data.workflowId !== program.provenance.workflowId ||
      config.data.workflowRevision !== program.provenance.workflowRevision ||
      config.data.workflowHash !== program.provenance.workflowHash
    ) {
      fail(
        ERROR.invalidConfig,
        "Generic lab configuration provenance does not match the compiled definition."
      );
    }
    if (seed && Object.keys(seed).length > 0) {
      fail(
        ERROR.invalidConfig,
        "Generic runtime resume seeds are not supported by LC2-200."
      );
    }
    const authoredMaterialLedger = initializeMaterialLedger(
      program.materials.map((material) => ({
        materialInstanceId: material.instanceId,
        materialProfileId: material.materialProfileId,
        materialVersion: material.materialVersion,
        containerInstanceId: material.containerInstanceId,
        amount: material.quantityAmount,
        unitId: material.quantityUnitId
      }))
    );
    const legacyAdapter = legacyAdapterFor(compiled);
    let materialLedger: MaterialLedger;
    let equipment: readonly GenericEquipmentState[];
    let chemistry: GenericChemistryProjection;
    let compatibilityState: GenericLabState["compatibilityState"];
    if (legacyAdapter) {
      try {
        const projection = parseLegacyProjection(
          legacyAdapter.initialize(
            deepFreeze({
              config: config.data,
              program,
              authoredMaterialLedger
            })
          ),
          compiled,
          false
        );
        materialLedger = projection.materialLedger;
        equipment = projection.equipment;
        chemistry = projection.chemistry;
        compatibilityState = projection.compatibilityState;
      } catch (error) {
        if (error instanceof GenericLabRuntimeError) throw error;
        fail(
          ERROR.transitionRejected,
          `Legacy adapter ${legacyAdapter.runtimeAdapterId} rejected initialization.`,
          { adapterId: legacyAdapter.runtimeAdapterId }
        );
      }
    } else {
      /*
       * Native initialization presets are registered deterministic seeds: the
       * preset first re-locates authored materials (so mechanical
       * initializers derive contained volumes from material truth), then
       * overrides the mechanical-history fields the ledger cannot express.
       * The chemistry models re-derive their state from the same seeded
       * equipment and ledger, so no serialized engine state is involved.
       */
      const initialization = program.workflow.initialization ?? null;
      let equipmentFieldOverrides: readonly NativeEquipmentFieldOverride[] = [];
      let simulatedElapsedSeconds = 0;
      materialLedger = authoredMaterialLedger;
      if (initialization) {
        const preset = resolveNativeInitializationPreset(
          initialization.presetId
        );
        if (!preset) {
          fail(
            ERROR.portUnavailable,
            `No native initialization preset is registered for ${initialization.presetId}.`,
            { presetId: initialization.presetId }
          );
        }
        try {
          const seeded = preset.createSeed(
            deepFreeze({ program, authoredMaterialLedger })
          );
          materialLedger = validateMaterialLedger(seeded.materialLedger);
          equipmentFieldOverrides = seeded.equipmentFieldOverrides;
          simulatedElapsedSeconds = seeded.simulatedElapsedSeconds;
        } catch (error) {
          if (error instanceof GenericLabRuntimeError) throw error;
          fail(
            ERROR.transitionRejected,
            error instanceof NativeInitializationPresetError
              ? error.message
              : `Initialization preset ${initialization.presetId} rejected this bench.`,
            { presetId: initialization.presetId }
          );
        }
      }
      const initialized = program.equipment.map((binding) => {
        const adapter = compiled.ports.mechanicalAdapters.find(
          ({ adapterId }) => adapterId === binding.mechanicalAdapterId
        );
        if (!adapter) {
          fail(
            ERROR.portUnavailable,
            `Mechanical adapter ${binding.mechanicalAdapterId} is unavailable.`
          );
        }
        try {
          return adapter.initializeEquipment(
            deepFreeze({ binding, materialLedger })
          );
        } catch {
          fail(
            ERROR.transitionRejected,
            `Mechanical adapter ${adapter.adapterId} rejected initialization.`,
            { adapterId: adapter.adapterId }
          );
        }
      });
      equipment = validateEquipment(
        applyEquipmentFieldOverrides(initialized, equipmentFieldOverrides),
        program
      );
      try {
        chemistry = genericChemistryProjectionSchema.parse(
          compiled.ports.models.initialize(
            deepFreeze({
              program,
              equipment: deepFreeze(equipment),
              materialLedger,
              ...(simulatedElapsedSeconds > 0
                ? { simulatedElapsedSeconds }
                : {})
            })
          )
        );
        chemistry = withEquipmentObservables(program, chemistry, equipment);
      } catch (error) {
        if (error instanceof GenericLabRuntimeError) throw error;
        if (error instanceof ChemistryModelCoordinatorError) {
          fail(
            ERROR.transitionRejected,
            "Model coordinator rejected initialization.",
            { reasonCode: error.code, ...error.details }
          );
        }
        fail(
          ERROR.transitionRejected,
          "Model coordinator rejected initialization."
        );
      }
      compatibilityState = null;
    }
    let diagnoses;
    try {
      diagnoses = compiled.ports.evaluator.evaluate(
        deepFreeze({
          rules: program.rules,
          equipmentBindings: program.equipment,
          actionBindings: program.actions,
          equipment,
          materialLedger,
          observables: chemistry.observables,
          eventEnvelopes: [],
          currentEventIds: [],
          previousDiagnoses: [],
          permissionAttempts: program.actions.map(({ permission }) => ({
            permissionId: permission.id,
            count: 0
          })),
          currentAction: null,
          sequence: 0,
          studentResponses: []
        })
      );
    } catch (error) {
      if (error instanceof WorkflowEvaluatorError) {
        fail(
          ERROR.transitionRejected,
          "Workflow evaluator rejected initialization.",
          { reasonCode: error.code, ...error.details }
        );
      }
      fail(
        ERROR.transitionRejected,
        "Workflow evaluator rejected initialization."
      );
    }
    const state = genericLabStateSchema.safeParse({
      schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
      sessionId: config.data.sessionId,
      provenance: program.provenance,
      sequence: 0,
      equipment,
      materialLedger,
      chemistry,
      workflowStatus: deriveWorkflowStatus(program.rules, diagnoses),
      diagnoses,
      permissionAttempts: program.actions.map(({ permission }) => ({
        permissionId: permission.id,
        count: 0
      })),
      eventSequence: 0,
      eventEnvelopes: [],
      compatibilityState
    });
    if (!state.success) {
      fail(ERROR.portContractMismatch, "Ports produced invalid initial state.");
    }
    assertStateMatchesProgram(state.data, compiled);
    return deepFreeze(state.data) as GenericLabState;
  }

  function step(
    inputState: GenericLabState,
    inputAction: NormalizedLabAction
  ): StepResult<GenericLabState> {
    const stateResult = genericLabStateSchema.safeParse(inputState);
    if (!stateResult.success) {
      fail(ERROR.invalidState, "Generic lab state is invalid.");
    }
    const actionResult = normalizedLabActionSchema.safeParse(inputAction);
    if (!actionResult.success) {
      fail(ERROR.invalidAction, "Normalized lab action is invalid.");
    }
    const state = deepFreeze(stateResult.data) as GenericLabState;
    const action = deepFreeze(actionResult.data) as NormalizedLabAction;
    assertProvenance(state.provenance, program.provenance);
    assertStateMatchesProgram(state, compiled);
    if (state.workflowStatus !== "in_progress") {
      fail(
        ERROR.workflowTerminal,
        `Workflow is already ${state.workflowStatus}.`,
        { workflowStatus: state.workflowStatus }
      );
    }
    const resolved = resolveAction(compiled, state, action);

    runCheck(
      () =>
        compiled.ports.safetyPolicy.check(
          deepFreeze({
            action,
            selectedPolicyIds: program.safetyPolicyIds,
            ...(action.sourceEquipmentInstanceId
              ? {
                  sourceEquipmentInstanceId: action.sourceEquipmentInstanceId
                }
              : {}),
            targetEquipmentInstanceIds: action.targetEquipmentInstanceIds
          })
        ),
      ERROR.safetyRejected,
      "A deterministic safety policy rejected the action."
    );

    const mechanicalContext = deepFreeze({
      binding: resolved.binding,
      action,
      source: resolved.source,
      targets: resolved.targets,
      equipment: state.equipment,
      materialLedger: state.materialLedger,
      chemistry: state.chemistry,
      preconditions: resolved.binding.preconditions
    });
    const legacyAdapter = legacyAdapterFor(compiled);
    let equipment;
    let materialLedger = state.materialLedger;
    let chemistry;
    // Annotated in place by the model coordinator below, so it needs a
    // declared type rather than relying on inference from a later branch.
    let events: readonly Readonly<SemanticEvent>[] | undefined;
    let materialAction = null;
    let materialInstanceIds: readonly string[] = [];
    let compatibilityState = state.compatibilityState;
    if (legacyAdapter) {
      if (!state.compatibilityState) {
        fail(
          ERROR.invalidState,
          "Legacy session state is missing its serialized compatibility state."
        );
      }
      const legacyContext = deepFreeze({
        program,
        mechanical: mechanicalContext,
        compatibilityState: state.compatibilityState,
        chemistry: state.chemistry,
        materialLedger: state.materialLedger
      });
      runCheck(
        () => legacyAdapter.checkPreconditions(legacyContext),
        ERROR.preconditionFailed,
        "The legacy equipment precondition rejected the action."
      );
      try {
        const projection = parseLegacyProjection(
          legacyAdapter.apply(legacyContext),
          compiled,
          true
        );
        if (
          projection.events.some(
            ({ type }) =>
              !resolved.binding.emittedSemanticEventTypes.includes(type)
          )
        ) {
          fail(
            ERROR.portContractMismatch,
            "Legacy port emitted an event outside its registered contract."
          );
        }
        equipment = projection.equipment;
        materialLedger = projection.materialLedger;
        chemistry = projection.chemistry;
        events = deepFreeze([...projection.events]);
        materialInstanceIds = projection.materialInstanceIds;
        compatibilityState = projection.compatibilityState;
      } catch (error) {
        if (error instanceof GenericLabRuntimeError) throw error;
        fail(
          ERROR.transitionRejected,
          `Legacy adapter ${legacyAdapter.runtimeAdapterId} rejected the transition.`,
          { adapterId: legacyAdapter.runtimeAdapterId }
        );
      }
    } else {
      const adapter = adapterFor(
        compiled,
        resolved.binding,
        [resolved.source, ...resolved.targets]
          .filter((participant) => participant != null)
          .map(({ equipmentDefinitionId }) => equipmentDefinitionId)
      );
      runCheck(
        () => adapter.checkPreconditions(mechanicalContext),
        ERROR.preconditionFailed,
        "An equipment precondition rejected the action."
      );
      let mechanical;
      try {
        mechanical = parseTransition(
          adapter.apply(mechanicalContext),
          compiled,
          action
        );
      } catch (error) {
        if (error instanceof GenericLabRuntimeError) throw error;
        fail(
          ERROR.transitionRejected,
          `Mechanical adapter ${adapter.adapterId} rejected the transition.`,
          { adapterId: adapter.adapterId }
        );
      }
      materialAction = mechanical.materialAction;
      if (materialAction) {
        try {
          materialLedger = applyExecutedMaterialAction(
            state.materialLedger,
            materialAction,
            program.equipment.map(({ instanceId, measurement }) => ({
              equipmentInstanceId: instanceId,
              capacityML: measurement?.capacityML ?? null
            }))
          );
        } catch {
          fail(
            ERROR.transitionRejected,
            "Material ledger rejected the mechanical transition."
          );
        }
      }
      equipment = mechanical.equipment;
      try {
        chemistry = genericChemistryProjectionSchema.parse(
          compiled.ports.models.transition(
            deepFreeze({
              program,
              previous: state.chemistry,
              action,
              equipment,
              materialLedger,
              materialAction
            })
          )
        );
        chemistry = withEquipmentObservables(program, chemistry, equipment);
      } catch (error) {
        if (error instanceof GenericLabRuntimeError) throw error;
        if (error instanceof ChemistryModelCoordinatorError) {
          fail(
            ERROR.transitionRejected,
            "Model coordinator rejected the transition.",
            { reasonCode: error.code, ...error.details }
          );
        }
        fail(
          ERROR.transitionRejected,
          "Model coordinator rejected the transition."
        );
      }
      events = deepFreeze([...mechanical.events]);
      if (compiled.ports.models.annotateEvents) {
        // Captured so the comparison closures below read a narrowed value.
        const mechanicalEvents = events;
        let annotated: unknown;
        try {
          annotated = compiled.ports.models.annotateEvents(
            deepFreeze({
              program,
              modelStates: chemistry.modelStates,
              action,
              materialAction,
              equipment,
              materialLedger,
              events
            })
          );
        } catch (error) {
          if (error instanceof GenericLabRuntimeError) throw error;
          if (error instanceof ChemistryModelCoordinatorError) {
            fail(
              ERROR.transitionRejected,
              "Model coordinator rejected event annotation.",
              { reasonCode: error.code, ...error.details }
            );
          }
          fail(
            ERROR.transitionRejected,
            "Model coordinator rejected event annotation."
          );
        }
        const parsedAnnotated = semanticEventSchema
          .array()
          .safeParse(annotated);
        if (
          !parsedAnnotated.success ||
          parsedAnnotated.data.length !== mechanicalEvents.length ||
          parsedAnnotated.data.some(
            (event, index) => event.type !== mechanicalEvents[index]!.type
          )
        ) {
          fail(
            ERROR.portContractMismatch,
            "Model coordinator returned an invalid annotated event sequence."
          );
        }
        if (
          parsedAnnotated.data.some(
            ({ type }) =>
              !resolved.binding.emittedSemanticEventTypes.includes(type)
          )
        ) {
          fail(
            ERROR.portContractMismatch,
            "Annotated events fall outside the registered event contract."
          );
        }
        events = deepFreeze([...parsedAnnotated.data]);
      }
    }
    const newEnvelopes = envelopeSemanticEvents({
      sessionId: state.sessionId,
      nextEventSequence: state.eventSequence,
      actionSequence: state.sequence + 1,
      action,
      materialAction,
      materialInstanceIds,
      events
    });
    const unlinkedEnvelopes = [...state.eventEnvelopes, ...newEnvelopes];
    const permissionAttempts = incrementAttempts(state, action.permissionId);
    let diagnoses;
    try {
      diagnoses = compiled.ports.evaluator.evaluate(
        deepFreeze({
          rules: program.rules,
          equipmentBindings: program.equipment,
          actionBindings: program.actions,
          equipment,
          materialLedger,
          observables: chemistry.observables,
          eventEnvelopes: unlinkedEnvelopes,
          currentEventIds: newEnvelopes.map(({ eventId }) => eventId),
          previousDiagnoses: state.diagnoses,
          permissionAttempts,
          currentAction: action,
          sequence: state.sequence + 1,
          studentResponses: []
        })
      );
    } catch (error) {
      if (error instanceof WorkflowEvaluatorError) {
        fail(
          ERROR.transitionRejected,
          "Workflow evaluator rejected the transition.",
          { reasonCode: error.code, ...error.details }
        );
      }
      fail(
        ERROR.transitionRejected,
        "Workflow evaluator rejected the transition."
      );
    }

    const next = genericLabStateSchema.safeParse({
      ...state,
      sequence: state.sequence + 1,
      equipment,
      materialLedger,
      chemistry,
      workflowStatus: deriveWorkflowStatus(
        program.rules,
        diagnoses,
        state.workflowStatus
      ),
      diagnoses,
      permissionAttempts,
      eventSequence: state.eventSequence + newEnvelopes.length,
      eventEnvelopes: linkEnvelopeDiagnoses(unlinkedEnvelopes, diagnoses),
      compatibilityState
    });
    if (!next.success) {
      fail(
        ERROR.portContractMismatch,
        "Ports produced invalid transition state."
      );
    }
    const result: StepResult<GenericLabState> = {
      state: deepFreeze(next.data) as GenericLabState,
      events: [...events]
    };
    deepFreeze(result);
    return result;
  }

  const skills = program.definitionMetadata.skills.map((skill) => ({
    ...skill
  }));
  const reportRubric = program.definitionMetadata.reportRubric.map(
    (criterion) => ({ ...criterion })
  );
  deepFreeze(skills);
  deepFreeze(reportRubric);
  return {
    id: program.definitionMetadata.id,
    title: program.definitionMetadata.title,
    skills,
    reportRubric,
    createInitialState,
    step,
    getGroundTruth(inputState: GenericLabState) {
      const state = genericLabStateSchema.safeParse(inputState);
      if (!state.success)
        fail(ERROR.invalidState, "Generic lab state is invalid.");
      assertProvenance(state.data.provenance, program.provenance);
      return deepFreeze({
        values: { ...state.data.chemistry.groundTruth.values },
        notes: [...state.data.chemistry.groundTruth.notes]
      });
    }
  };
}
