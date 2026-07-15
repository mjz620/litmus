# MVP Technical Design

## Stack

- Next.js App Router + TypeScript strict.
- React + React Three Fiber + drei for lab shell.
- Zustand for lab state and event queues.
- Vitest for engine/unit tests.
- Playwright for critical route smoke tests.
- Supabase Postgres/Auth/RLS for persistence and roles.
- OpenAI server-side routes for coach/evaluator/voice token flows.

## Architectural thesis

```text
UI is a projection of state.
Experiment engine is the source of chemistry truth.
Semantic events are the source of learning evidence.
AI transforms evidence into pedagogy, not physics.
Database connects student evidence to teacher insight.
```

## Required repo structure

```text
src/
  app/
    page.tsx
    experiments/page.tsx
    lab/[experimentId]/page.tsx
    lab/[experimentId]/report/page.tsx
    teacher/classes/page.tsx
    teacher/classes/[classId]/page.tsx
    teacher/classes/[classId]/students/[studentId]/page.tsx
    demo/page.tsx
    demo/student/page.tsx
    demo/teacher/page.tsx
    demo/technical/page.tsx
    api/coach/route.ts
    api/evaluate/route.ts
    api/realtime-token/route.ts
    api/sessions/checkpoint/route.ts
    api/demo/reset/route.ts
  components/
    lab/
    coach/
    teacher/
    demo/
    ui/
  experiments/
    registry.ts
    shared/
    titration/
    precipitation/
  lib/
    agent/
    analytics/
    persistence/
    supabase/
    demo/
  stores/
    labStore.ts
  types/
    index.ts
supabase/
  migrations/
  seed.sql
tests/
  experiments/
  coach/
  api/
  e2e/
```

## Runtime sequence

```text
Student action
  ↓
Zustand dispatch(action)
  ↓
ExperimentDefinition.step(state, action)
  ↓
New deterministic state + semantic events
  ↓
Update in-memory StudentModel
  ↓
Render state immediately
  ↓
Queue event checkpoint asynchronously
  ↓
If trigger-worthy, call /api/coach asynchronously
  ↓
Persist coach intervention
  ↓
Teacher dashboard reads aggregates from persisted rows
```

## Degradation behavior

- If OpenAI is unavailable: chemistry and report form continue; coach panel shows unavailable state.
- If Supabase is unavailable: lab continues; checkpoint queue retries; teacher dashboard may show stale data.
- If voice is unavailable: text input remains primary.
- If WebGL is weak: reduce visual detail; preserve precision controls.

## MVP build order

1. Repo skeleton.
2. Experiment contract and titration truth tests.
3. Lab store and student UI slice without AI/DB.
4. Coach route and trigger policy.
5. Persistence/auth/checkpoints.
6. Teacher dashboard.
7. Report evaluator and Adaptive Retry.
8. Demo environment.
9. Voice.
10. Precipitation plugin and polish.
