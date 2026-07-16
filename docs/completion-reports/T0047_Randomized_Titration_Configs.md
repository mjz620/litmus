# T0047 — Seeded Randomized Titration Session Configurations

## Completion Report

### Summary

- Added a pure local seeded generator for varied strong-acid/strong-base
  titration configurations without adding dependencies or changing chemistry
  formulas.
- Validated candidate configurations with the engine-owned equivalence-volume
  function and guaranteed that each endpoint fits within one 50 mL burette fill.
- Created a fresh seed for each new browser session, retained it in titration
  state, and exposed deterministic replay through the `seed` query parameter.
- Displayed the session seed and generated analyte/titrant quantities in the
  engine-state summary.
- Added deterministic multi-seed, state-retention, fresh-session, replay, and
  existing-control regression coverage.

### Files changed

- `src/experiments/titration/sessionConfig.ts`
- `src/experiments/titration/titration.ts`
- `src/app/lab/[experimentId]/page.tsx`
- `src/app/lab/[experimentId]/LabRouteShell.tsx`
- `src/app/lab/[experimentId]/page.module.css`
- `tests/experiments/titration-session-config.test.ts`
- `tests/stores/labStore.test.ts`
- `tests/e2e/student-routes.spec.ts`
- `tests/e2e/titration-controls.spec.ts`
- `docs/Repo_Current_State.md`
- `docs/completion-reports/T0047_Randomized_Titration_Configs.md`

### Commands run

- Targeted `sed`, `rg`, and Git inspections
- `npx prettier --write ...` on ticket-owned files
- `npm test -- tests/experiments/titration-session-config.test.ts tests/experiments/titration.test.ts tests/stores/labStore.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm run test:e2e -- tests/e2e/student-routes.spec.ts tests/e2e/titration-controls.spec.ts`
- `npm test`
- `npm run build`
- `npm run test:e2e`

### Build/test results

- Production build passed.
- Strict TypeScript, ESLint, and Prettier checks passed.
- Vitest passed: 7 files and 36 tests.
- Playwright passed in Chromium: 5 tests.
- The first focused browser run exposed two fixed-configuration assertions that
  were no longer valid after randomization. They were changed to assert current
  engine-derived pH presence and exact seed replay; the focused and full suites
  then passed.

### Manual verification performed

- Confirmed through browser automation that two newly initialized sessions use
  distinct `guest-*` seeds.
- Replayed `replay-alpha` across a reload and confirmed the analyte and titrant
  quantities matched exactly.
- Loaded `replay-beta` and confirmed it produced a different valid
  configuration.
- Confirmed the established rinse, fill, addition, pH, meniscus, event, and
  browser-console checks remain green with randomized configurations.

### Risks / limitations

- T0047 intentionally generates only configurations reachable within one
  burette fill. Refill-required configurations belong to T0048.
- The current repository has no completed checkpoint or adaptive-retry system;
  the seed is retained in engine state and replayable by URL so those future
  systems can persist it without reconstructing randomness.
- The generator stays within the engine's currently supported strong-acid and
  strong-base chemistry rather than broadening scientific scope.

### Follow-up tickets suggested

- Continue the normal backlog with `T0010 — pH curve component`.
- Implement T0048 only after its T0023 and T0033 dependencies are complete.

### Docs needing update

- None. Repository state and this completion report are updated.
