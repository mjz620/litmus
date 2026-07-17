# T0021 — Supabase client and env validation

## Completion Report

### Summary
- Added separate browser, cookie-aware server, and server-only service-role clients plus strict public/server environment validation.

### Files changed
- `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/service.ts`, `src/lib/supabase/index.ts`, `src/lib/env.ts`, `next.config.ts`, `.env.example`, `tests/unit/env.test.ts`.

### Commands run
- `npm test -- tests/unit/env.test.ts`, `npm run typecheck`, missing-env `npm run build` (expected failure), configured `npm run build`, client-static-bundle secret scan.

### Build/test results
- The real production build entrypoint names all missing persistence variables and exits nonzero; a configured production build passes; the service role is absent from the client bundle.

### Manual verification performed
- Inspected client boundaries and the production browser build for service-role imports.

### Risks / limitations
- Credentialed Supabase connectivity was not tested in this environment.

### Follow-up tickets suggested
- Add deployment smoke checks with secret redaction.

### Docs needing update
- `.env.example`, `README.md`, and `docs/Repo_Current_State.md` updated.
