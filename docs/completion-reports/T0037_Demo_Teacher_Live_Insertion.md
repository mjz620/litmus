# T0037 — Demo teacher live insertion

## Completion Report

### Summary
- Added a live “Your demo session” roster row derived from the real browser trace and merged through the same deterministic class analytics functions as seeded rows.

### Files changed
- `src/components/demo/DemoTeacherDashboard.tsx`, `src/components/demo/useDemoTrace.ts`, `src/lib/demo/demoTrace.ts`, `tests/demo/demoTrace.test.ts`.

### Commands run
- `npm test -- tests/demo/demoTrace.test.ts tests/analytics/classAnalytics.test.ts`, `npm run build`.

### Build/test results
- Trace insertion changes student/session metrics deterministically and demo routes build.

### Manual verification performed
- Performed a student action, switched to Teacher, and inspected the highlighted live row.

### Risks / limitations
- Without Supabase, cross-tab demo continuity relies on browser localStorage.

### Follow-up tickets suggested
- Exercise the configured database path in deployment smoke tests.

### Docs needing update
- `docs/demo/Runbook.md` and `docs/Repo_Current_State.md` updated.
