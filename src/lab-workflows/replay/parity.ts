import type { SemanticEvent } from "../../experiments/shared";
import type { WorkflowDiagnosis } from "../schema/conditions";
import type {
  GenericEquipmentState,
  GenericObservable
} from "../runtime/generic";
import type { GenericTraceReplayResult } from "./types";

export const PARITY_TRACE_SCHEMA_VERSION = "1.0.0" as const;

/**
 * A runtime-implementation-independent projection of one dispatched action.
 * Two runtimes (e.g. the legacy titration compatibility ports and a native
 * capability runtime) agree on a trace exactly when their projections agree,
 * regardless of how each represents internal model state.
 */
export interface ParityStepRecord {
  readonly step: number;
  readonly actionId: string;
  readonly permissionId: string;
  readonly workflowStatus: "in_progress" | "completed" | "failed";
  readonly equipment: readonly ParityEquipmentRecord[];
  readonly observables: readonly GenericObservable[];
  readonly groundTruth: unknown;
  readonly events: readonly SemanticEvent[];
  /** Diagnoses whose serialized form changed relative to the previous step. */
  readonly changedDiagnoses: readonly WorkflowDiagnosis[];
}

export interface ParityEquipmentRecord {
  readonly instanceId: string;
  readonly fields: GenericEquipmentState["fields"];
}

export interface ParityTraceRecord {
  readonly schemaVersion: typeof PARITY_TRACE_SCHEMA_VERSION;
  readonly traceId: string;
  readonly steps: readonly ParityStepRecord[];
  readonly finalWorkflowStatus: "in_progress" | "completed" | "failed";
  readonly finalDiagnoses: readonly WorkflowDiagnosis[];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function projectEquipment(
  equipment: readonly GenericEquipmentState[]
): readonly ParityEquipmentRecord[] {
  return [...equipment]
    .sort((left, right) => compare(left.instanceId, right.instanceId))
    .map((entry) => ({
      instanceId: entry.instanceId,
      fields: [...entry.fields].sort((left, right) =>
        compare(left.key, right.key)
      )
    }));
}

function projectObservables(
  observables: readonly GenericObservable[]
): readonly GenericObservable[] {
  return [...observables].sort((left, right) =>
    compare(left.observableId, right.observableId)
  );
}

function changedDiagnoses(
  previous: readonly WorkflowDiagnosis[],
  next: readonly WorkflowDiagnosis[]
): readonly WorkflowDiagnosis[] {
  const before = new Map(
    previous.map((diagnosis) => [diagnosis.ruleId, JSON.stringify(diagnosis)])
  );
  return next.filter(
    (diagnosis) => before.get(diagnosis.ruleId) !== JSON.stringify(diagnosis)
  );
}

/**
 * Projects a replay into per-step records of everything the lab pedagogy
 * consumes: equipment fields, chemistry observables and ground truth, emitted
 * semantic events (with flags and skill evidence), and diagnosis changes.
 */
export function projectParityTrace(
  replay: GenericTraceReplayResult
): ParityTraceRecord {
  const steps = replay.transitions.map((transition, index) => {
    const previousState = replay.states[index]!;
    const action = replay.trace.actions[index]!;
    return {
      step: index,
      actionId: action.actionId,
      permissionId: action.permissionId,
      workflowStatus: transition.state.workflowStatus,
      equipment: projectEquipment(transition.state.equipment),
      observables: projectObservables(transition.state.chemistry.observables),
      groundTruth: clone(transition.state.chemistry.groundTruth),
      events: clone(transition.events) as SemanticEvent[],
      changedDiagnoses: changedDiagnoses(
        previousState.diagnoses,
        transition.state.diagnoses
      ).map(clone)
    } satisfies ParityStepRecord;
  });
  return {
    schemaVersion: PARITY_TRACE_SCHEMA_VERSION,
    traceId: replay.trace.traceId,
    steps,
    finalWorkflowStatus: replay.finalState.workflowStatus,
    finalDiagnoses: clone([...replay.finalState.diagnoses])
  };
}
