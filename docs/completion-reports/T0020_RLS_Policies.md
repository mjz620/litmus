# T0020 — RLS policies

## Completion Report

### Summary
- Enabled RLS on every student/teacher table, added recursive-policy-safe helper functions, scoped student/teacher access, denied direct anonymous table access, and added a transactional pgTAP isolation fixture.

### Files changed
- `supabase/migrations/202607170002_rls_policies.sql`, `supabase/tests/rls_isolation.sql`, `tests/db/schema.test.ts`.

### Commands run
- `npm test -- tests/db/schema.test.ts`, `npm run lint`, transactional isolation fixture against disposable PostgreSQL 17.

### Build/test results
- Policy structure tests pass, and all eight live fixture assertions passed for student, outsider, and teacher session/event/class/profile visibility.

### Manual verification performed
- Reviewed every policy predicate and service-route-only anonymous/demo boundary, then executed the exact fixture with a local assertion shim standing in only for pgTAP reporting.

### Risks / limitations
- The isolation semantics ran in real PostgreSQL; the hosted Supabase JWT/auth integration itself remains uncredentialed in this environment.

### Follow-up tickets suggested
- Execute the same fixture through `supabase test db` in CI and add assignment-specific policy cases when assignments become active.

### Docs needing update
- `README.md` and `docs/Repo_Current_State.md` updated.
