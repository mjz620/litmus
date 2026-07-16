# T0006 — Experiment Registry Completion Report

## Completion Report

### Summary

- Added a typed experiment registry with titration registered by
  `acid_base_titration`.
- Added a lightweight titration manifest exposing ID, title, semantic version,
  descriptive metadata, documented readiness weights, and a lazy definition
  loader.
- Added manifest listing, typed lookup, definition loading, and a dedicated
  unknown-experiment error.
- Added registry tests covering metadata, listing, lazy loading, and unknown-ID
  behavior.

### Files changed

- `src/experiments/registry.ts`
- `src/experiments/titration/manifest.ts`
- `tests/experiments/registry.test.ts`
- `docs/Repo_Current_State.md`
- `docs/completion-reports/T0006_Experiment_Registry.md`

### Commands run

- `npm test -- tests/experiments/registry.test.ts`
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm run build`
- `rg` inspection for eager runtime imports

### Build/test results

- Production build passed with Next.js 16.2.10.
- Strict TypeScript, ESLint, and Prettier checks passed.
- Registry tests passed: 1 file, 4 tests.
- Full unit suite passed: 5 files, 25 tests.

### Manual verification performed

- Loaded the titration definition by `acid_base_titration` and confirmed its ID,
  title, `step()`, and `createInitialState()` contract.
- Confirmed unknown manifest lookup throws `UnknownExperimentError`.
- Confirmed unknown async definition loading returns a rejected Promise with the
  same error type.
- Inspected imports and confirmed the registry loads only the lightweight
  manifest at runtime; the manifest uses a dynamic import for the engine. Its
  static titration reference is type-only and is erased from runtime output.

### Risks / limitations

- Metadata includes only stable fields needed now: description, duration,
  difficulty, and readiness weights. UI manifests, stages, thumbnails, and retry
  templates remain future-ticket work.
- Only titration is registered; precipitation is intentionally out of scope.

### Follow-up tickets suggested

- `T0007 — Lab store scaffold`

### Docs needing update

- None after updating `docs/Repo_Current_State.md` and adding this report.
