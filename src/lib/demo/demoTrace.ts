import type { SemanticEvent, StudentModel } from "../../experiments/shared";
import type { TitrationState } from "../../experiments/titration/titration";
import type { CoachMessage } from "../../stores/labStore";
import type { AnyCoachRequest } from "../agent/schemas";
import type { CheckpointRequest } from "../persistence";
import type { ClassAnalyticsInput } from "../analytics/classAnalytics";
import type { LabWorkflowConsumerContext } from "../../lab-workflows/consumers";
import type { GenericLabActionTrace } from "../../lab-workflows/replay";
import type { SetupDrivenRuntimeInspection } from "../../stores/setupDrivenLabSession";

export const DEMO_TRACE_STORAGE_KEY = "labbench.demo.trace.v1";
export const DEMO_LIVE_STUDENT_ID = "00000000-0000-4000-8000-000000000299";

export interface DemoTrace {
  schemaVersion: "1";
  recordedAt: string;
  sessionId: string;
  state: TitrationState;
  events: SemanticEvent[];
  studentModel: StudentModel;
  coachMessages: CoachMessage[];
  lastCoachRequest: AnyCoachRequest | null;
  lastCheckpoint: CheckpointRequest | null;
  runtimeInspection?: SetupDrivenRuntimeInspection | null;
  labWorkflowContext?: LabWorkflowConsumerContext | null;
  normalizedActionTrace?: GenericLabActionTrace | null;
}

export function readDemoTrace(
  storage: Pick<Storage, "getItem">
): DemoTrace | null {
  try {
    const raw = storage.getItem(DEMO_TRACE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoTrace;
    return parsed.schemaVersion === "1" && typeof parsed.sessionId === "string"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

export function writeDemoTrace(
  storage: Pick<Storage, "setItem">,
  trace: DemoTrace
): void {
  storage.setItem(DEMO_TRACE_STORAGE_KEY, JSON.stringify(trace));
}

export function extendAnalyticsWithDemoTrace(
  fixture: ClassAnalyticsInput,
  trace: DemoTrace | null
): ClassAnalyticsInput {
  if (!trace) return fixture;
  const updatedAt = trace.recordedAt;
  return {
    ...fixture,
    students: [
      ...fixture.students,
      { id: DEMO_LIVE_STUDENT_ID, name: "Your demo session" }
    ],
    sessions: [
      ...fixture.sessions,
      {
        id: trace.sessionId,
        studentId: DEMO_LIVE_STUDENT_ID,
        experimentId: "acid_base_titration",
        experimentVersion: "1.0.0",
        completedAt: trace.state.submitted ? updatedAt : undefined
      }
    ],
    skillEstimates: [
      ...fixture.skillEstimates,
      ...Object.entries(trace.studentModel.skills).map(([skillId, skill]) => ({
        sessionId: trace.sessionId,
        studentId: DEMO_LIVE_STUDENT_ID,
        skillId,
        mastery: skill.mastery,
        evidenceCount: skill.evidenceCount,
        updatedAt
      }))
    ],
    events: [
      ...fixture.events,
      ...trace.events.map((event) => ({
        sessionId: trace.sessionId,
        type: event.type,
        flags: event.flags,
        tSim: event.tSim
      }))
    ]
  };
}
