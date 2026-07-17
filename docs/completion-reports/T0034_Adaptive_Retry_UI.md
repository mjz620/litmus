# T0034 — Adaptive retry UI flow

## Completion Report

### Summary
- Added retry query parsing, focused banner/goals, parent-session linkage, and normal shared lab/store/checkpoint execution for retry sessions.

### Files changed
- `src/components/lab/retry/RetryBanner.tsx`, `src/app/lab/[experimentId]/page.tsx`, `src/app/lab/[experimentId]/LabRouteShell.tsx`, `src/components/lab/useLabSession.ts`, `src/stores/labStore.ts`, `tests/stores/labStore.test.ts`, `tests/e2e/report-retry-voice.spec.ts`.

### Commands run
- `npm run typecheck`, `npm run build`, `npm run test:e2e`.

### Build/test results
- Chromium verifies the 22.00 mL child launch and success message; store tests prove parent provenance and controlled positive child evidence reach the checkpoint envelope.

### Manual verification performed
- Launched an endpoint retry from feedback and performed controlled addition.

### Risks / limitations
- Invalid retry IDs safely fall back to normal practice without a dedicated explanatory page.

### Follow-up tickets suggested
- Add teacher-visible retry completion comparisons when report persistence is expanded.

### Docs needing update
- `docs/Repo_Current_State.md` updated.
