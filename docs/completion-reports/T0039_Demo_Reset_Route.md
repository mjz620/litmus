# T0039 — Demo reset route

## Completion Report

### Summary
- Added a demo-scoped reset API/repository and UI that removes ephemeral demo sessions/local trace while preserving fixed seed IDs and production rows.

### Files changed
- `src/lib/demo/reset.ts`, `src/app/api/demo/reset/route.ts`, `src/components/demo/DemoBar.tsx`, `tests/api/demoReset.test.ts`.

### Commands run
- `npm test -- tests/api/demoReset.test.ts`, `npm run build`.

### Build/test results
- Handler delegation/scope tests pass and the reset route builds.

### Manual verification performed
- Reset the local demo trace and verified return to the unchanged seeded hub.

### Risks / limitations
- Database deletion was not exercised without Supabase credentials; the query is explicitly limited to `is_demo=true` and excludes seed IDs.

### Follow-up tickets suggested
- Add configured Supabase reset integration coverage.

### Docs needing update
- `docs/demo/Runbook.md` and `docs/Repo_Current_State.md` updated.
