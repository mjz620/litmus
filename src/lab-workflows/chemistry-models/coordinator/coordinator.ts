import type { SemanticEvent } from "../../../experiments/shared";
import {
  genericObservableSchema,
  genericStateFieldSchema,
  semanticEventSchema
} from "../../runtime/generic/schemas";
import type {
  CompiledChemistryModelBinding,
  CompiledGenericLabProgram,
  GenericChemistryProjection,
  GenericModelAnnotationContext,
  GenericModelCoordinatorPort,
  GenericModelInitializationContext,
  GenericModelState,
  GenericModelTransitionContext,
  GenericObservable,
  GenericStateField
} from "../../runtime/generic/types";
import { deepFreeze } from "../../runtime/generic/utils";
import {
  CHEMISTRY_MODEL_COORDINATOR_ERROR_CODES as ERROR,
  ChemistryModelCoordinatorError
} from "./errors";
import type {
  CreateChemistryModelCoordinatorOptions,
  GenericChemistryActionContext,
  GenericChemistryModule,
  GenericChemistryModuleRegistration
} from "./types";

function fail(
  code: ChemistryModelCoordinatorError["code"],
  message: string,
  details: Readonly<Record<string, string>> = {}
): never {
  throw new ChemistryModelCoordinatorError(code, message, details);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  const a = [...new Set(left)].sort(compareStrings);
  const b = [...new Set(right)].sort(compareStrings);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function canonicalFields(
  input: unknown,
  modelId: string
): readonly GenericStateField[] {
  const parsed = genericStateFieldSchema.array().max(256).safeParse(input);
  if (!parsed.success) {
    fail(ERROR.modelStateInvalid, `Model ${modelId} returned invalid state.`, {
      modelId
    });
  }
  const keys = new Set<string>();
  for (const field of parsed.data) {
    if (keys.has(field.key)) {
      fail(
        ERROR.modelStateInvalid,
        `Model ${modelId} returned duplicate state field ${field.key}.`,
        { modelId, fieldKey: field.key }
      );
    }
    keys.add(field.key);
  }
  return deepFreeze(
    [...parsed.data]
      .sort((left, right) => compareStrings(left.key, right.key))
      .map((field) => ({ ...field }))
  );
}

function assertRegistrationMatches(
  registration: GenericChemistryModuleRegistration,
  binding: CompiledChemistryModelBinding
): void {
  const implementation = registration.module;
  if (implementation.version !== binding.modelVersion) {
    fail(
      ERROR.implementationVersionMismatch,
      `Chemistry model ${binding.modelId} implementation version does not match validation.`,
      {
        modelId: binding.modelId,
        expectedVersion: binding.modelVersion,
        actualVersion: implementation.version
      }
    );
  }
  if (
    registration.metadataId !== binding.modelId ||
    implementation.id !== binding.modelId ||
    !sameSet(
      implementation.providedCapabilityIds,
      binding.providedCapabilityIds
    ) ||
    !sameSet(
      implementation.requiredCapabilityIds,
      binding.requiredCapabilityIds
    )
  ) {
    fail(
      ERROR.implementationContractMismatch,
      `Chemistry model ${binding.modelId} implementation contract does not match validation.`,
      { modelId: binding.modelId }
    );
  }
}

function modelStateFor(
  states: readonly GenericModelState[],
  binding: CompiledChemistryModelBinding
): GenericModelState {
  const matches = states.filter(({ modelId }) => modelId === binding.modelId);
  if (matches.length === 0) {
    fail(
      ERROR.modelStateMissing,
      `Model state ${binding.modelId} is missing.`,
      {
        modelId: binding.modelId
      }
    );
  }
  if (matches.length > 1) {
    fail(
      ERROR.modelStateDuplicate,
      `Model state ${binding.modelId} is duplicated.`,
      { modelId: binding.modelId }
    );
  }
  const state = matches[0]!;
  if (state.modelVersion !== binding.modelVersion) {
    fail(
      ERROR.modelStateInvalid,
      `Model state ${binding.modelId} has the wrong version.`,
      { modelId: binding.modelId }
    );
  }
  return state;
}

function deriveProjection(
  program: Readonly<CompiledGenericLabProgram>,
  modules: ReadonlyMap<string, GenericChemistryModule>,
  modelStates: readonly GenericModelState[]
): GenericChemistryProjection {
  const observables: GenericObservable[] = [];
  const owners = new Map<string, string>();
  for (const binding of program.chemistryModels) {
    const implementation = modules.get(binding.modelId)!;
    const state = modelStateFor(modelStates, binding);
    let derived: unknown;
    try {
      derived = implementation.deriveObservables(deepFreeze([...state.fields]));
    } catch {
      fail(
        ERROR.observableDerivationRejected,
        `Chemistry model ${binding.modelId} rejected observable derivation.`,
        { modelId: binding.modelId }
      );
    }
    const parsed = genericObservableSchema.array().max(256).safeParse(derived);
    if (!parsed.success) {
      fail(
        ERROR.observableDerivationRejected,
        `Chemistry model ${binding.modelId} returned invalid observables.`,
        { modelId: binding.modelId }
      );
    }
    for (const observable of parsed.data) {
      if (
        !observable.observableId.startsWith("observable.") ||
        !program.registeredObservableIds.includes(observable.observableId) ||
        (observable.unitId !== undefined &&
          !program.registeredUnitIds.includes(observable.unitId))
      ) {
        fail(
          ERROR.observableUnregistered,
          `Chemistry model ${binding.modelId} emitted unregistered observable ${observable.observableId}.`,
          { modelId: binding.modelId, observableId: observable.observableId }
        );
      }
      const existingOwner = owners.get(observable.observableId);
      if (existingOwner) {
        fail(
          ERROR.observableDuplicate,
          `Observable ${observable.observableId} has multiple owners.`,
          {
            modelId: binding.modelId,
            ownerModelId: existingOwner,
            observableId: observable.observableId
          }
        );
      }
      owners.set(observable.observableId, binding.modelId);
      observables.push({ ...observable });
    }
  }
  observables.sort((left, right) =>
    compareStrings(left.observableId, right.observableId)
  );
  const values: Record<string, number> = {};
  for (const observable of observables) {
    if (typeof observable.value === "number") {
      values[observable.observableId] = observable.value;
    }
  }
  for (const binding of program.chemistryModels) {
    const implementation = modules.get(binding.modelId)!;
    if (!implementation.deriveGroundTruthValues) continue;
    const state = modelStateFor(modelStates, binding);
    let derived: Readonly<Record<string, number>>;
    try {
      derived = implementation.deriveGroundTruthValues(
        deepFreeze(state.fields.map((field) => ({ ...field })))
      );
    } catch {
      fail(
        ERROR.groundTruthInvalid,
        `Chemistry model ${binding.modelId} rejected ground-truth derivation.`,
        { modelId: binding.modelId }
      );
    }
    if (typeof derived !== "object" || derived === null) {
      fail(
        ERROR.groundTruthInvalid,
        `Chemistry model ${binding.modelId} returned invalid ground truth.`,
        { modelId: binding.modelId }
      );
    }
    for (const [key, value] of Object.entries(derived)) {
      if (
        key.length === 0 ||
        key.length > 240 ||
        typeof value !== "number" ||
        !Number.isFinite(value)
      ) {
        fail(
          ERROR.groundTruthInvalid,
          `Chemistry model ${binding.modelId} returned an invalid ground-truth value for ${key}.`,
          { modelId: binding.modelId, groundTruthKey: key }
        );
      }
      if (Object.hasOwn(values, key)) {
        fail(
          ERROR.groundTruthCollision,
          `Ground-truth value ${key} has multiple owners.`,
          { modelId: binding.modelId, groundTruthKey: key }
        );
      }
      values[key] = value;
    }
  }
  const notes: string[] = [];
  for (const binding of program.chemistryModels) {
    const implementation = modules.get(binding.modelId)!;
    if (!implementation.deriveGroundTruthNotes) continue;
    const state = modelStateFor(modelStates, binding);
    let derived: readonly string[];
    try {
      derived = implementation.deriveGroundTruthNotes(
        deepFreeze(state.fields.map((field) => ({ ...field })))
      );
    } catch {
      fail(
        ERROR.groundTruthInvalid,
        `Chemistry model ${binding.modelId} rejected ground-truth note derivation.`,
        { modelId: binding.modelId }
      );
    }
    if (
      !Array.isArray(derived) ||
      derived.length > 256 ||
      derived.some(
        (note) =>
          typeof note !== "string" || note.length === 0 || note.length > 4_000
      )
    ) {
      fail(
        ERROR.groundTruthInvalid,
        `Chemistry model ${binding.modelId} returned invalid ground-truth notes.`,
        { modelId: binding.modelId }
      );
    }
    notes.push(...derived);
  }
  return deepFreeze({
    modelStates: modelStates.map((state) => ({
      ...state,
      fields: state.fields.map((field) => ({ ...field }))
    })),
    observables,
    groundTruth: { values, notes }
  });
}

export function createChemistryModelCoordinator(
  options: CreateChemistryModelCoordinatorOptions
): GenericModelCoordinatorPort {
  const registrations = new Map<string, GenericChemistryModuleRegistration>();
  for (const registration of options.registrations) {
    if (registrations.has(registration.metadataId)) {
      fail(
        ERROR.duplicateImplementation,
        `Duplicate chemistry implementation ${registration.metadataId}.`,
        { modelId: registration.metadataId }
      );
    }
    registrations.set(registration.metadataId, registration);
  }

  function compatibleModules(
    program: Readonly<CompiledGenericLabProgram>
  ): ReadonlyMap<string, GenericChemistryModule> {
    const selected = new Map<string, GenericChemistryModule>();
    for (const binding of program.chemistryModels) {
      const registration = registrations.get(binding.modelId);
      if (!registration) {
        fail(
          ERROR.missingImplementation,
          `No chemistry implementation is registered for ${binding.modelId}.`,
          { modelId: binding.modelId }
        );
      }
      assertRegistrationMatches(registration, binding);
      selected.set(binding.modelId, registration.module);
    }
    return selected;
  }

  function initialize(
    context: Readonly<GenericModelInitializationContext>
  ): GenericChemistryProjection {
    const modules = compatibleModules(context.program);
    const modelStates: GenericModelState[] = [];
    const moduleContext = deepFreeze({
      equipmentBindings: context.program.equipment,
      materialBindings: context.program.materials,
      equipment: context.equipment,
      materialLedger: context.materialLedger,
      ...(context.simulatedElapsedSeconds !== undefined
        ? { simulatedElapsedSeconds: context.simulatedElapsedSeconds }
        : {})
    });
    for (const binding of context.program.chemistryModels) {
      const implementation = modules.get(binding.modelId)!;
      let fields: unknown;
      try {
        fields = implementation.initialize(moduleContext);
      } catch {
        fail(
          ERROR.initializationRejected,
          `Chemistry model ${binding.modelId} rejected initialization.`,
          { modelId: binding.modelId }
        );
      }
      modelStates.push({
        modelId: binding.modelId,
        modelVersion: binding.modelVersion,
        fields: canonicalFields(fields, binding.modelId)
      });
    }
    return deriveProjection(context.program, modules, modelStates);
  }

  function actionContextFor(context: {
    readonly action: GenericModelTransitionContext["action"];
    readonly materialAction: GenericModelTransitionContext["materialAction"];
    readonly equipment: GenericModelTransitionContext["equipment"];
    readonly materialLedger: GenericModelTransitionContext["materialLedger"];
  }): Readonly<GenericChemistryActionContext> {
    return deepFreeze({
      action: context.action,
      materialAction: context.materialAction
        ? { ...context.materialAction }
        : null,
      equipment: context.equipment,
      materialLedger: context.materialLedger
    });
  }

  function transition(
    context: Readonly<GenericModelTransitionContext>
  ): GenericChemistryProjection {
    const modules = compatibleModules(context.program);
    const previousStates = context.program.chemistryModels.map((binding) =>
      modelStateFor(context.previous.modelStates, binding)
    );
    const actionContext = actionContextFor(context);
    const nextStates: GenericModelState[] = [];
    for (
      let index = 0;
      index < context.program.chemistryModels.length;
      index += 1
    ) {
      const binding = context.program.chemistryModels[index]!;
      const implementation = modules.get(binding.modelId)!;
      const previous = previousStates[index]!;
      if (
        !implementation.applyActionTransition &&
        context.materialAction === null
      ) {
        // Exact previous behavior: a mechanical-only action leaves a
        // material-action-driven module's state untouched.
        nextStates.push(previous);
        continue;
      }
      let transition: unknown;
      try {
        transition = implementation.applyActionTransition
          ? implementation.applyActionTransition(
              actionContext,
              deepFreeze(previous.fields.map((field) => ({ ...field })))
            )
          : implementation.applyMaterialAction(
              deepFreeze({ ...context.materialAction! }),
              deepFreeze(previous.fields.map((field) => ({ ...field })))
            );
      } catch {
        fail(
          ERROR.transitionRejected,
          `Chemistry model ${binding.modelId} rejected the material transition.`,
          { modelId: binding.modelId }
        );
      }
      if (
        typeof transition !== "object" ||
        transition === null ||
        !("state" in transition)
      ) {
        fail(
          ERROR.modelStateInvalid,
          `Chemistry model ${binding.modelId} returned no transition state.`,
          { modelId: binding.modelId }
        );
      }
      nextStates.push({
        modelId: binding.modelId,
        modelVersion: binding.modelVersion,
        fields: canonicalFields(
          (transition as { readonly state: unknown }).state,
          binding.modelId
        )
      });
    }
    return deriveProjection(context.program, modules, nextStates);
  }

  function annotateEvents(
    context: Readonly<GenericModelAnnotationContext>
  ): readonly SemanticEvent[] {
    const modules = compatibleModules(context.program);
    const actionContext = actionContextFor(context);
    let events: readonly SemanticEvent[] = deepFreeze(
      semanticEventSchema.array().max(256).parse(context.events)
    );
    for (const binding of context.program.chemistryModels) {
      const implementation = modules.get(binding.modelId)!;
      if (!implementation.annotateEvents) continue;
      const state = modelStateFor(context.modelStates, binding);
      let annotated: unknown;
      try {
        annotated = implementation.annotateEvents(
          actionContext,
          deepFreeze(state.fields.map((field) => ({ ...field }))),
          events
        );
      } catch {
        fail(
          ERROR.eventAnnotationInvalid,
          `Chemistry model ${binding.modelId} rejected event annotation.`,
          { modelId: binding.modelId }
        );
      }
      const parsed = semanticEventSchema.array().max(256).safeParse(annotated);
      if (!parsed.success) {
        fail(
          ERROR.eventAnnotationInvalid,
          `Chemistry model ${binding.modelId} returned invalid annotated events.`,
          { modelId: binding.modelId }
        );
      }
      if (
        parsed.data.length !== events.length ||
        parsed.data.some((event, index) => event.type !== events[index]!.type)
      ) {
        fail(
          ERROR.eventAnnotationInvalid,
          `Chemistry model ${binding.modelId} changed the annotated event sequence.`,
          { modelId: binding.modelId }
        );
      }
      events = deepFreeze(parsed.data);
    }
    return events;
  }

  return Object.freeze({
    supportedModels: Object.freeze(
      [...registrations.values()]
        .map(({ module: implementation }) =>
          Object.freeze({
            modelId: implementation.id,
            modelVersion: implementation.version
          })
        )
        .sort((left, right) => compareStrings(left.modelId, right.modelId))
    ),
    assertCompatible: (program: Readonly<CompiledGenericLabProgram>) => {
      void compatibleModules(program);
    },
    initialize,
    transition,
    annotateEvents
  });
}
