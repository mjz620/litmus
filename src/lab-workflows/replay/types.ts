import type { z } from "zod";

import type {
  GenericLabRuntimeTransition,
  GenericLabState,
  GenericRuntimePorts
} from "../runtime/generic";
import type { LabWorkflowV2RegistryContext } from "../validation";
import type { ValidatedLabWorkflowSpecV2 } from "../schema/v2";
import type {
  genericLabActionTraceSchema,
  genericTraceStudentResponseSchema
} from "./schemas";

export type GenericLabActionTrace = z.infer<typeof genericLabActionTraceSchema>;
export type GenericTraceStudentResponse = z.infer<
  typeof genericTraceStudentResponseSchema
>;

export interface GenericTraceReplayOptions {
  readonly workflow: Readonly<ValidatedLabWorkflowSpecV2>;
  readonly ports: GenericRuntimePorts;
  readonly registries?: LabWorkflowV2RegistryContext;
}

export interface GenericTraceReplayResult {
  readonly trace: Readonly<GenericLabActionTrace>;
  readonly states: readonly Readonly<GenericLabState>[];
  readonly transitions: readonly GenericLabRuntimeTransition[];
  readonly finalState: Readonly<GenericLabState>;
}

export type GenericTraceSuiteCaseKind =
  | "valid"
  | "alternate_valid"
  | "recoverable_mistake"
  | "terminal_mistake"
  | "tolerance_boundary";

export interface GenericTraceSuiteCase {
  readonly kind: GenericTraceSuiteCaseKind;
  readonly trace: GenericLabActionTrace;
}
