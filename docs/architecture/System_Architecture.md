# System Architecture

## High-level architecture

```mermaid
flowchart LR
  Student[Student Browser] --> UI[Next.js React UI]
  UI --> Store[Zustand Lab Store]
  Store --> Engine[Deterministic Experiment Engine]
  Engine --> Events[Semantic Events]
  Events --> Model[In-memory StudentModel]
  Events --> Queue[Checkpoint Queue]
  Queue --> DB[(Supabase Postgres)]
  Events --> CoachAPI[/api/coach]
  Model --> CoachAPI
  CoachAPI --> OpenAI[OpenAI structured output]
  CoachAPI --> CoachMsg[Coach Message]
  CoachMsg --> UI
  DB --> Teacher[Teacher Dashboard]
  DB --> Demo[Demo Technical Inspector]
```

## Boundary rules

### Chemistry engine

- Pure TypeScript.
- No React.
- No Three.js.
- No database.
- No LLM calls.
- Emits serializable `SemanticEvent[]`.

### UI shell

- Renders state.
- Dispatches typed actions.
- Never computes chemistry truth.
- Can compute presentation-only values such as rounded display strings.

### Coach orchestration

- Consumes current state, recent events, and StudentModel.
- Produces structured intervention objects.
- May call allowed pedagogical tools.
- Does not mutate engine state.

### Persistence

- Writes events, sessions, skill estimates, coach interventions, and reports.
- Checkpoint writes are idempotent.
- Metrics are deterministic SQL/API aggregates.

### Demo

- Uses production logic.
- Adds seeded state and role switcher.
- Does not fork the experiment engine or coach logic.

## Data flow invariants

- Every teacher number must trace to persisted data.
- Every coach claim about a mistake must trace to a semantic event or direct student question.
- Every adaptive retry must be produced from an experiment seed validated by the plugin.
- Every technical demo panel should show real runtime objects, not screenshots.
