# T0025 — Classes and join codes

## Completion Report

### Summary
- Added teacher class creation with unambiguous random join codes and a validated security-definer student join RPC/action.

### Files changed
- `src/lib/classes/classes.ts`, `src/app/teacher/classes/actions.ts`, `src/app/teacher/classes/page.tsx`, `src/app/join/actions.ts`, `src/app/join/page.tsx`, `supabase/migrations/202607170002_rls_policies.sql`, `tests/unit/classes.test.ts`.

### Commands run
- `npm test -- tests/unit/classes.test.ts`, `npm run typecheck`, `npm run build`.

### Build/test results
- Join-code format/entropy fixtures pass and class/join routes compile.

### Manual verification performed
- Inspected role checks, exact uppercase lookup, and idempotent membership insertion.

### Risks / limitations
- Live two-account class creation/join was not possible without Supabase auth credentials.

### Follow-up tickets suggested
- Add credentialed teacher/student integration coverage.

### Docs needing update
- `README.md` and `docs/Repo_Current_State.md` updated.
