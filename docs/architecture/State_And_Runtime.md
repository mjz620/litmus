# State and Runtime

## Zustand lab store

```ts
type LabStore = {
  experimentId: string;
  state: unknown;
  studentModel: StudentModel;
  eventQueue: SemanticEvent[];
  coachMessages: CoachMessage[];
  saveStatus: 'idle' | 'pending' | 'saved' | 'error';
  dispatch: (action: ExperimentAction) => void;
  askCoach: (question: string) => Promise<void>;
  checkpoint: () => Promise<void>;
};
```

## Dispatch algorithm

```ts
function dispatch(action) {
  const result = experiment.step(currentState, action);
  setState(result.state);
  updateStudentModel(result.events);
  appendEvents(result.events);
  queueCheckpoint(result.events);
  if (shouldTriggerCoach(result.events)) {
    callCoachAsync(result.events, studentModelSnapshot);
  }
}
```

## Trigger policy

Trigger the coach when:

- event has non-empty `flags`,
- direct student question exists,
- repeated failed attempt for same skill,
- report feedback recommends retry,
- session transition requires explanation.

Do not trigger on routine successful events unless the student directly asks.

## Network behavior

Simulation is never blocked by checkpoint or coach calls. The UI shows save status and keeps the lab interactive.

## Versioning

Persist these versions with events/reports before production use:

- event schema version,
- experiment version,
- model/prompt version,
- rubric version.
