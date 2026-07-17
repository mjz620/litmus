# T0036 — Demo student seeded route

## Completion Report

### Summary
- Added the no-auth student demo at a deterministic 22.00 mL endpoint-control state using the same engine, coach, checkpoint, report, and retry paths.

### Files changed
- `src/app/demo/student/page.tsx`, `src/components/demo/DemoTraceRecorder.tsx`, `src/experiments/titration/retry.ts`.

### Commands run
- `npm test -- tests/experiments/titration-retry.test.ts`, `npm run test:e2e`.

### Build/test results
- Seed validity and shared browser lab behavior pass.

### Manual verification performed
- Opened `/demo/student`, confirmed 22.00 mL state, and generated real endpoint evidence.

### Risks / limitations
- Demo instructions intentionally encourage a mistake and should not be reused as normal student copy.

### Follow-up tickets suggested
- None before Lab Composer demo work.

### Docs needing update
- `docs/demo/Demo_Script.md`, `docs/demo/Runbook.md`, and `docs/Repo_Current_State.md` updated.
