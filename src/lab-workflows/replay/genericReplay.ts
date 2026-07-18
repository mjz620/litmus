import type { ValidatedLabWorkflowSpecV2 } from "../schema/v2";
import {
  GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
  assembleGenericLabRuntime,
  type GenericRuntimeProvenance,
  type NormalizedLabAction
} from "../runtime/generic";
import { deepFreeze } from "../runtime/generic/utils";
import { LAB_TRACE_ERROR_CODES as ERROR, LabTraceError } from "./errors";
import {
  GENERIC_LAB_ACTION_TRACE_SCHEMA_VERSION,
  genericLabActionTraceSchema
} from "./schemas";
import type {
  GenericLabActionTrace,
  GenericTraceReplayOptions,
  GenericTraceReplayResult,
  GenericTraceStudentResponse,
  GenericTraceSuiteCase
} from "./types";

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function traceProvenanceForWorkflow(
  workflow: Readonly<ValidatedLabWorkflowSpecV2>
): GenericRuntimeProvenance {
  return {
    workflowId: workflow.id,
    workflowRevision: workflow.revision,
    workflowHash: workflow.validation.canonicalSpecHash,
    validatorVersion: workflow.validation.validatorVersion,
    registrySnapshots: Object.entries(
      workflow.validation.registrySnapshotIds
    )
      .sort(([left], [right]) => compare(left, right))
      .map(([registryId, snapshotId]) => ({ registryId, snapshotId })),
    resolvedAdapters: workflow.validation.resolvedAdapters.map((entry) => ({
      ...entry
    })),
    resolvedChemistryModels:
      workflow.validation.resolvedChemistryModels.map((entry) => ({
        ...entry,
        providedCapabilityIds: [...entry.providedCapabilityIds]
      }))
  };
}

export interface CreateGenericLabActionTraceInput {
  readonly traceId: string;
  readonly sessionId: string;
  readonly sessionSeed: string;
  readonly workflow: Readonly<ValidatedLabWorkflowSpecV2>;
  readonly actions: readonly NormalizedLabAction[];
  readonly studentResponses?: readonly GenericTraceStudentResponse[];
}

export function createGenericLabActionTrace(
  input: CreateGenericLabActionTraceInput
): GenericLabActionTrace {
  return deepFreeze(
    genericLabActionTraceSchema.parse({
      schemaVersion: GENERIC_LAB_ACTION_TRACE_SCHEMA_VERSION,
      runtimeSchemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
      traceId: input.traceId,
      sessionId: input.sessionId,
      sessionSeed: input.sessionSeed,
      provenance: traceProvenanceForWorkflow(input.workflow),
      actions: input.actions,
      studentResponses: input.studentResponses ?? []
    })
  );
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function replayGenericLabActionTrace(
  input: unknown,
  options: GenericTraceReplayOptions
): GenericTraceReplayResult {
  const parsed = genericLabActionTraceSchema.safeParse(input);
  if (!parsed.success) {
    throw new LabTraceError(
      ERROR.schemaInvalid,
      "Generic lab action trace schema is invalid."
    );
  }
  const trace = deepFreeze(parsed.data);
  const expectedProvenance = traceProvenanceForWorkflow(options.workflow);
  if (!sameJson(trace.provenance, expectedProvenance)) {
    throw new LabTraceError(
      ERROR.provenanceMismatch,
      "Trace provenance does not match the exact validated workflow.",
      { workflowId: options.workflow.id }
    );
  }

  const runtime = assembleGenericLabRuntime(
    options.workflow,
    {
      schemaVersion: GENERIC_LAB_RUNTIME_SCHEMA_VERSION,
      sessionId: trace.sessionId,
      workflowId: trace.provenance.workflowId,
      workflowRevision: trace.provenance.workflowRevision,
      workflowHash: trace.provenance.workflowHash
    },
    options.ports,
    options.registries ? { registries: options.registries } : {}
  );
  const states = [runtime.getState()];
  const transitions = [];
  try {
    for (const action of trace.actions) {
      const transition = runtime.dispatch(action);
      transitions.push(transition);
      states.push(transition.state);
    }
  } catch (error) {
    if (error instanceof LabTraceError) throw error;
    throw new LabTraceError(ERROR.replayRejected, "Trace action replay was rejected.", {
      cause: error instanceof Error ? error.name : "unknown"
    });
  }
  return deepFreeze({
    trace,
    states,
    transitions,
    finalState: runtime.getState()
  });
}

export function runGenericTraceSuite(
  cases: readonly GenericTraceSuiteCase[],
  optionsFor: (testCase: GenericTraceSuiteCase) => GenericTraceReplayOptions
): readonly GenericTraceReplayResult[] {
  return cases.map((testCase) => {
    const replay = replayGenericLabActionTrace(
      testCase.trace,
      optionsFor(testCase)
    );
    const recoverableViolation = replay.states.some((state) =>
      state.diagnoses.some(
        ({ status, recoverable }) => status === "violated" && recoverable
      )
    );
    const valid =
      testCase.kind === "terminal_mistake"
        ? replay.finalState.workflowStatus === "failed"
        : testCase.kind === "recoverable_mistake"
          ? recoverableViolation && replay.finalState.workflowStatus === "completed"
          : replay.finalState.workflowStatus === "completed";
    if (!valid) {
      throw new LabTraceError(
        ERROR.suiteCaseInvalid,
        `Trace suite case ${testCase.kind} did not demonstrate its declared outcome.`,
        { kind: testCase.kind }
      );
    }
    return replay;
  });
}
