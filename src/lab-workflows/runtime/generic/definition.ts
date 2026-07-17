import type {
  ExperimentDefinition,
  SemanticEvent,
  StepResult
} from "../../../experiments/shared";
import type { ActionParameterDefinition } from "../../registries/actions";
import {
  GENERIC_LAB_RUNTIME_ERROR_CODES as ERROR,
  GenericLabRuntimeError
} from "./errors";
import {
  genericChemistryProjectionSchema,
  genericEquipmentStateSchema,
  genericLabConfigSchema,
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
  type GenericLabConfig,
  type GenericLabState,
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

function adapterFor(
  compiled: CompiledGenericRuntime,
  binding: CompiledActionBinding
): GenericMechanicalAdapterPort {
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
  validateEquipment(state.equipment, compiled.program);
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
    !sameIdSet(
      state.diagnoses.map(({ ruleId }) => ruleId),
      compiled.program.rules.map(({ id }) => id)
    )
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
      (model) =>
        !expectedModels.some(
          (expected) =>
            expected.modelId === model.modelId &&
            expected.version === model.modelVersion
        )
    )
  ) {
    fail(
      ERROR.invalidState,
      "State model projections do not match validated model provenance."
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
          { actionId: action.actionId, parameterKey: definition.key }
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
  if (
    materialAction &&
    (materialAction.actionId !== action.actionId ||
      materialAction.sourceEquipmentInstanceId !==
        action.sourceEquipmentInstanceId ||
      !sameIds(
        materialAction.targetEquipmentInstanceIds,
        action.targetEquipmentInstanceIds
      ) ||
      materialAction.materialInstanceIds.some(
        (id) =>
          !compiled.program.materials.some(
            ({ instanceId }) => instanceId === id
          )
      ))
  ) {
    fail(
      ERROR.portContractMismatch,
      "Mechanical port returned an invalid material-action signal."
    );
  }
  return { equipment, materialAction, events: events.data };
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
        return adapter.initializeEquipment(binding);
      } catch {
        fail(
          ERROR.transitionRejected,
          `Mechanical adapter ${adapter.adapterId} rejected initialization.`,
          { adapterId: adapter.adapterId }
        );
      }
    });
    const equipment = validateEquipment(initialized, program);
    let chemistry;
    try {
      chemistry = genericChemistryProjectionSchema.parse(
        compiled.ports.models.initialize(
          deepFreeze({ program, equipment: deepFreeze(equipment) })
        )
      );
    } catch (error) {
      if (error instanceof GenericLabRuntimeError) throw error;
      fail(
        ERROR.transitionRejected,
        "Model coordinator rejected initialization."
      );
    }
    let diagnoses;
    try {
      diagnoses = compiled.ports.evaluator.evaluate(
        deepFreeze({
          rules: program.rules,
          equipment,
          observables: chemistry.observables,
          events: [] as SemanticEvent[],
          previousDiagnoses: []
        })
      );
    } catch {
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
      chemistry,
      diagnoses,
      permissionAttempts: program.actions.map(({ permission }) => ({
        permissionId: permission.id,
        count: 0
      })),
      semanticEvents: []
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

    const adapter = adapterFor(compiled, resolved.binding);
    const mechanicalContext = deepFreeze({
      binding: resolved.binding,
      action,
      source: resolved.source,
      targets: resolved.targets,
      equipment: state.equipment,
      preconditions: resolved.binding.preconditions
    });
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

    let chemistry;
    try {
      chemistry = genericChemistryProjectionSchema.parse(
        compiled.ports.models.transition(
          deepFreeze({
            program,
            previous: state.chemistry,
            equipment: mechanical.equipment,
            materialAction: mechanical.materialAction
          })
        )
      );
    } catch {
      fail(
        ERROR.transitionRejected,
        "Model coordinator rejected the transition."
      );
    }

    const events = deepFreeze([...mechanical.events]);
    const semanticEvents = [...state.semanticEvents, ...events];
    let diagnoses;
    try {
      diagnoses = compiled.ports.evaluator.evaluate(
        deepFreeze({
          rules: program.rules,
          equipment: mechanical.equipment,
          observables: chemistry.observables,
          events: semanticEvents,
          previousDiagnoses: state.diagnoses
        })
      );
    } catch {
      fail(
        ERROR.transitionRejected,
        "Workflow evaluator rejected the transition."
      );
    }

    const next = genericLabStateSchema.safeParse({
      ...state,
      sequence: state.sequence + 1,
      equipment: mechanical.equipment,
      chemistry,
      diagnoses,
      permissionAttempts: incrementAttempts(state, action.permissionId),
      semanticEvents
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
