# T0004 — Titration Engine Import Completion Report

## Completion Report

### Summary

- Ported the established deterministic acid-base titration engine into the
  repository application structure.
- Adapted the engine to use T0003's shared experiment contract without adding UI,
  network, database, or agent dependencies.
- Preserved strong-acid and weak-acid chemistry, indicator behavior, ground
  truth, typed actions, semantic flags/evidence, and intermediate-state seeding.
- Ported the established truth tests, including the controlled-success silence
  case and the 22.00 mL demo seed.

### Files changed

- `src/experiments/titration/titration.ts`
- `tests/experiments/titration.test.ts`
- `docs/Repo_Current_State.md`
- `docs/completion-reports/T0004_Titration_Engine_Import.md`

### Commands run

- `npm test -- tests/experiments/titration.test.ts`
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm run build`
- Targeted Prettier validation
- `rg` forbidden-import and browser-API inspection

### Build/test results

- Production build passed with Next.js 16.2.10.
- Strict TypeScript check passed.
- ESLint and Prettier checks passed.
- Titration truth tests passed: 1 file, 10 tests.
- Full unit suite passed: 3 files, 16 tests.
- Forbidden-import inspection found no React, Next.js, Three.js, Supabase,
  OpenAI, browser API, or network imports in the titration core.

### Manual verification performed

- Confirmed a 22.00 mL seed backfills a curve ending at 22.00 mL.
- Confirmed fast addition near equivalence emits flow-rate and overshoot flags
  with negative endpoint-control evidence.
- Confirmed controlled dropwise addition near equivalence does not emit the
  flow-rate flag.
- Inspected the engine boundary and confirmed chemistry remains deterministic and
  local.

### Risks / limitations

- The engine intentionally matches the established source contract; invalid seed
  rejection is deferred to `T0033 — Adaptive retry seed validation`.
- Display rounding remains embedded only in emitted observations/curve points as
  established by the source. Dedicated display-layer helpers are T0005 work.

### Follow-up tickets suggested

- `T0005 — Display formatting helpers`
- `T0006 — Experiment registry`

### Docs needing update

- None after updating `docs/Repo_Current_State.md` and adding this report.
