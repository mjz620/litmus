# T0029 — Demo seed data

## Completion Report

### Summary
- Added schema-valid synthetic teacher/student/class/session/event/skill/report rows plus an equivalent local fixture whose metrics are derived at runtime.

### Files changed
- `supabase/seed.sql`, `src/lib/analytics/demoFixture.ts`, `tests/demo/seedData.test.ts`.

### Commands run
- `npm test -- tests/demo/seedData.test.ts tests/analytics/classAnalytics.test.ts`.

### Build/test results
- Seed shape/IDs and locally derived dashboard values pass deterministic tests.

### Manual verification performed
- Inspected FK ordering, demo tags, event payload shape, and non-hardcoded aggregate use.

### Risks / limitations
- SQL seed application was not run without a local Supabase instance.

### Follow-up tickets suggested
- Add `supabase db reset` to CI.

### Docs needing update
- `docs/Repo_Current_State.md` updated.
