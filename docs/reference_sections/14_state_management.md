# 14. State management
## 14.1 Zustand lab store

Recommended shape:

```ts
interface LabStore<TState, TAction> {
  experimentId: string;
  sessionId: string;
  mode: SessionMode;
  state: TState;
  studentModel: StudentModel;
  recentEvents: SemanticEvent[];
  interventions: CoachInterventionSummary[];
  focusedObjectId?: string;
  coachStatus: "idle" | "thinking" | "unavailable";
  syncStatus: "saved" | "saving" | "offline" | "error";

  dispatch(action: TAction): void;
  applyCoachResponse(response: CoachResponse): void;
  startRetry(spec: ValidatedRetrySpec<TState>): void;
  flushCheckpoint(): Promise<void>;
}
```

## 14.2 Dispatch algorithm

```ts
function dispatch(action: TAction) {
  const result = experiment.step(get().state, action);
  set({ state: result.state });

  for (const event of result.events) {
    const nextModel = applyEvidence(get().studentModel, event);
    appendRecentEvent(event);
    set({ studentModel: nextModel });
    persistenceQueue.enqueue(event, nextModel);

    if (triggerPolicy.shouldCallCoach(event, nextModel)) {
      void requestCoach(event, nextModel);
    }
  }
}
```

No `await` occurs before updating the simulation state.

---
