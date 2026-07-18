"use client";

import { useEffect } from "react";

import {
  DEMO_TRACE_STORAGE_KEY,
  writeDemoTrace
} from "../../lib/demo/demoTrace";
import { isTitrationState, useLabStore } from "../../stores/labStore";

export function DemoTraceRecorder() {
  const sessionId = useLabStore((store) => store.sessionId);
  const state = useLabStore((store) =>
    isTitrationState(store.state) ? store.state : null
  );
  const events = useLabStore((store) => store.eventQueue);
  const studentModel = useLabStore((store) => store.studentModel);
  const coachMessages = useLabStore((store) => store.coachMessages);
  const lastCoachRequest = useLabStore((store) => store.lastCoachRequest);
  const lastCheckpoint = useLabStore((store) => store.lastCheckpoint);
  const runtimeInspection = useLabStore((store) => store.runtimeInspection);
  const labWorkflowContext = useLabStore(
    (store) => store.runtimeConsumerContext
  );
  const normalizedActionTrace = useLabStore(
    (store) => store.runtimeActionTrace
  );

  useEffect(() => {
    if (!sessionId || !state || !studentModel) return;
    writeDemoTrace(localStorage, {
      schemaVersion: "1",
      recordedAt: new Date().toISOString(),
      sessionId,
      state,
      events,
      studentModel,
      coachMessages,
      lastCoachRequest,
      lastCheckpoint,
      runtimeInspection,
      labWorkflowContext,
      normalizedActionTrace
    });
    window.dispatchEvent(
      new StorageEvent("storage", { key: DEMO_TRACE_STORAGE_KEY })
    );
  }, [
    coachMessages,
    events,
    lastCheckpoint,
    lastCoachRequest,
    labWorkflowContext,
    normalizedActionTrace,
    runtimeInspection,
    sessionId,
    state,
    studentModel
  ]);

  return null;
}
