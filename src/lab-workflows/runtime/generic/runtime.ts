import type { LabWorkflowV2RegistryContext } from "../../validation";
import {
  compileGenericLabProgram,
  type GenericRuntimeCompilationOptions
} from "./compile";
import { createGenericLabDefinition } from "./definition";
import type {
  GenericLabConfig,
  GenericLabRuntime,
  GenericLabRuntimeTransition,
  GenericRuntimePorts,
  NormalizedLabAction
} from "./types";

export interface AssembleGenericLabRuntimeOptions {
  readonly registries?: LabWorkflowV2RegistryContext;
}

export function assembleGenericLabRuntime(
  input: unknown,
  config: GenericLabConfig,
  ports: GenericRuntimePorts,
  options: AssembleGenericLabRuntimeOptions = {}
): GenericLabRuntime {
  const compilationOptions: GenericRuntimeCompilationOptions = {
    ...(options.registries ? { registries: options.registries } : {})
  };
  const compiled = compileGenericLabProgram(input, ports, compilationOptions);
  const definition = createGenericLabDefinition(compiled);
  let state = definition.createInitialState(config);

  function dispatch(action: NormalizedLabAction): GenericLabRuntimeTransition {
    const result = definition.step(state, action);
    state = result.state;
    return Object.freeze({ state, events: result.events });
  }

  return Object.freeze({
    definition,
    program: compiled.program,
    getState: () => state,
    dispatch
  });
}
