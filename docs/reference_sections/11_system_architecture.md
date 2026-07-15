# 11. System architecture
![System architecture](assets/system_architecture.png)

## 11.1 Technology choices

### Frontend and server

- Next.js App Router.
- TypeScript strict mode.
- One Vercel deployment.
- React Three Fiber and drei.
- Zustand for session/simulation state.
- Zod for runtime API validation.

### Data and authentication

- Supabase Auth with Google OAuth.
- Supabase Postgres.
- Row-Level Security.
- Guest sessions supported without blocking use.

### AI

- GPT-5.6 configured in one server-only model configuration file.
- Structured outputs for coach and evaluator.
- Tool calling for agent actions.
- Browser voice input via an ephemeral server-issued realtime token or a transcription route.

## 11.2 Architectural boundaries

### Chemistry engine

Owns:

- scientific state,
- calculations,
- tolerances,
- semantic event detection,
- ground truth,
- retry validation,
- deterministic success checks.

Does not own:

- React rendering,
- network calls,
- database access,
- natural-language tutoring.

### 3D/UI shell

Owns:

- rendering state,
- camera and focus transitions,
- interaction controls,
- formatting measurements for display,
- accessibility alternatives.

Does not own:

- chemistry calculations,
- hidden truth,
- semantic mistake detection.

### Tutor orchestration

Owns:

- trigger decisions,
- context packaging,
- model calls,
- tool execution,
- structured response validation,
- hint history.

Does not own:

- chemistry state,
- class metrics,
- direct SQL.

### Persistence

Owns:

- sessions,
- event append,
- skill checkpoints,
- reports,
- class membership,
- assignments,
- teacher queries.

Does not block the local simulation.

## 11.3 Core runtime sequence

```text
1. Student manipulates an object.
2. UI translates interaction into a typed TAction.
3. Zustand calls plugin.step(currentState, action).
4. Engine returns next state + SemanticEvent[].
5. Zustand updates visual state immediately.
6. Each event is folded into the in-memory StudentModel.
7. Event is appended to the local persistence queue.
8. Trigger policy decides whether to call /api/coach.
9. Coach request runs asynchronously; simulation remains interactive.
10. Validated coach response is rendered in the panel.
11. Checkpoint queue flushes event and skill updates to Supabase.
12. Teacher dashboard reads deterministic aggregates from persisted data.
```

## 11.4 Network degradation behavior

| Dependency unavailable | Required behavior |
|---|---|
| OpenAI | Chemistry and 3D continue; show “Coach temporarily unavailable”; queue no model calls |
| Supabase | Session continues; queue events/checkpoints locally; show Offline/Unsynced state |
| Voice service | Text input remains available |
| 3D/WebGL unsupported | Show compatibility message and optional 2D control fallback if implemented |

## 11.5 Suggested repository structure

```text
app/
├── (marketing)/
├── experiments/
├── lab/[experimentId]/
├── student/
├── teacher/
├── demo/
└── api/
    ├── coach/route.ts
    ├── evaluate/route.ts
    ├── realtime-token/route.ts
    └── sessions/checkpoint/route.ts

components/
├── lab/
│   ├── LabShell.tsx
│   ├── LabCanvas.tsx
│   ├── CoachPanel.tsx
│   ├── ToolControlPanel.tsx
│   ├── LabNotebook.tsx
│   └── VoiceAskButton.tsx
├── teacher/
└── demo/

experiments/
├── core/
│   ├── experiment.ts
│   ├── registry.ts
│   ├── retry.ts
│   └── display.ts
├── titration/
│   ├── titration.ts
│   ├── titration.test.ts
│   ├── metadata.ts
│   ├── ui-manifest.ts
│   └── retry-templates.ts
├── precipitation/
└── calorimetry/

lib/
├── agent/
│   ├── coach.ts
│   ├── evaluator.ts
│   ├── tools.ts
│   ├── prompts.ts
│   ├── schemas.ts
│   └── trigger-policy.ts
├── persistence/
│   ├── queue.ts
│   ├── sessions.ts
│   └── checkpoints.ts
├── analytics/
└── supabase/

stores/
├── lab-store.ts
└── demo-store.ts

supabase/
├── migrations/
├── policies/
└── seed/

evals/
├── coach/
├── evaluator/
└── reports/

scripts/
├── seed-demo-class.ts
└── run-headless-scenarios.ts
```

---
