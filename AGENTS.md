# AGENTS.md — LabBench AI Repo Law

These rules apply to every coding agent run in this repository.

## Operating mode

- Implement one ticket only.
- Do not implement future-ticket features.
- Do not refactor unrelated systems.
- Do not introduce new architecture unless the current ticket explicitly requires it.
- Avoid unnecessary dependencies.
- Use strict TypeScript.
- Keep changes small, reviewable, and testable.
- Prefer explicit interfaces over clever abstractions.
- At the end of the run, provide the required completion report.

## Project invariants

1. Chemistry truth is deterministic and local.
2. GPT/LLM code never computes pH, equivalence point, precipitate identity, heat flow, or grading ground truth.
3. UI never reimplements chemistry; UI dispatches typed actions to experiment engines.
4. Every meaningful action flows through `ExperimentDefinition.step()`.
5. Semantic events are the shared contract for coaching, persistence, replay, evals, and teacher analytics.
6. StudentModel lives in memory during a session and flushes to persistence at checkpoints.
7. Simulation actions never wait on OpenAI or Supabase.
8. Teacher metrics are deterministic aggregates over persisted rows, not LLM-generated numbers.
9. Demo Mode uses the same engine, coach route, checkpoint route, and dashboard path as production.
10. Seeded demo data may be synthetic, but it must satisfy the same schema as real data.
11. New flags require tests and coach/eval coverage.
12. Positive “stay silent” cases require tests.
13. The app must remain usable on Chromebook-class hardware.
14. Auth is never required for the core student demo.
15. API keys and secrets never enter the client bundle.

## File ownership boundaries

### Chemistry / experiment core

Allowed: `src/experiments/**`, `src/core/**`, `tests/experiments/**`.

Do not import React, Three.js, Supabase, OpenAI, or browser-only APIs into chemistry engine files.

### 3D and student UI

Allowed: `src/components/lab/**`, `src/app/lab/**`, `src/stores/**`.

Do not edit chemistry formulas, event semantics, or database schema from a UI ticket.

### Coach / agent orchestration

Allowed: `src/lib/agent/**`, `src/app/api/coach/**`, `tests/coach/**`.

Do not let the LLM mutate simulation state. Do not add unconstrained chat behavior.

### Persistence / auth

Allowed: `supabase/**`, `src/lib/supabase/**`, `src/app/api/sessions/**`, `src/lib/persistence/**`.

Do not edit experiment logic. Checkpoint writes must be idempotent.

### Teacher dashboard

Allowed: `src/app/teacher/**`, `src/components/teacher/**`, `src/lib/analytics/**`.

Do not calculate teacher metrics with an LLM.

### Demo mode

Allowed: `src/app/demo/**`, `src/lib/demo/**`, `supabase/seed.sql`.

Demo mode must not fork core logic.

## Required completion report

Every Codex run must end with:

```md
## Completion Report

### Summary
- ...

### Files changed
- ...

### Commands run
- `...`

### Build/test results
- ...

### Manual verification performed
- ...

### Risks / limitations
- ...

### Follow-up tickets suggested
- ...

### Docs needing update
- ...
```

If a ticket cannot be completed cleanly, stop and report why. Do not continue into unrelated work.
