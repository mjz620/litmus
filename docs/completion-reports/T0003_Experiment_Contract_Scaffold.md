# T0003 — Experiment Contract Scaffold Completion Report

## Completion Report

### Summary

- Added the shared deterministic experiment contract derived from the established
  source contract.
- Added semantic event, skill evidence, ground truth, rubric, step result, and
  StudentModel types.
- Added pure StudentModel initialization and evidence-folding utilities.
- Added type-safe tests covering a mock experiment plus positive and negative
  learning evidence.
- Expanded Vitest discovery to include `tests/experiments/`.

### Files changed

- `src/experiments/shared/experiment.ts`
- `src/experiments/shared/index.ts`
- `src/types/index.ts`
- `tests/experiments/experiment.test.ts`
- `vitest.config.ts`
- `docs/Repo_Current_State.md`
- `docs/Known_Issues_And_Followups.md`
- `docs/completion-reports/T0003_Experiment_Contract_Scaffold.md`

### Commands run

- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npx prettier --check ...`
- `rg` forbidden-import inspection over the experiment core and its tests

### Build/test results

- Production build passed with Next.js 16.2.10.
- Strict TypeScript check passed.
- ESLint passed.
- T0003-owned files passed Prettier validation.
- Vitest passed: 2 files, 6 tests.
- Forbidden-import inspection found no React, Next.js, Three.js, Supabase, or
  OpenAI imports in the experiment core.

### Manual verification performed

- Inspected the shared core and confirmed it contains no UI, database, network,
  LLM, or browser-only imports.
- Confirmed positive evidence raises mastery and negative evidence lowers it.
- Confirmed the reducer returns new model/skill objects rather than mutating the
  prior StudentModel.

### Risks / limitations

- The contract follows `source-contracts/experiment.ts`; experiment registry
  version metadata remains future T0006 work.
- Active flags accumulate uniquely. Flag-resolution policy is not defined by
  T0003 and remains out of scope.
- The root README formatting issue discovered during T0003 was resolved during a
  later documentation-layout update and is retained as resolved KI-001 history.

### Follow-up tickets suggested

- `T0004 — Titration engine import`

### Docs needing update

- None after updating repo state, recording KI-001, and adding this report.
