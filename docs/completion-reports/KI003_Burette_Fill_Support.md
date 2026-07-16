# KI-003 — Deterministic Burette Fill Support

## Completion Report

### Summary

- Added an engine-owned `buretteAvailableML` state field and typed
  `fill_burette` action.
- Made initial burettes empty, required a fill before delivery, consumed
  available volume during addition, and enforced single-fill preparation and
  capacity constraints with deterministic engine errors.
- Emitted an unflagged, evidence-free fill semantic event so routine preparation
  remains a positive stay-silent case.
- Replaced the disabled fill placeholder with an actionable control and rendered
  engine-owned remaining volume in the controls and state summary.
- Updated seeded test states and added engine, store, and browser coverage.

### Files changed

- `src/experiments/titration/titration.ts`
- `src/components/lab/titration/TitrationControls.tsx`
- `src/components/lab/titration/TitrationControls.module.css`
- `src/app/lab/[experimentId]/LabRouteShell.tsx`
- `tests/experiments/titration.test.ts`
- `tests/experiments/titration-display.test.ts`
- `tests/stores/labStore.test.ts`
- `tests/e2e/titration-controls.spec.ts`
- `tests/e2e/student-routes.spec.ts`
- `docs/Known_Issues_And_Followups.md`
- `docs/Repo_Current_State.md`
- `docs/completion-reports/KI003_Burette_Fill_Support.md`

### Commands run

- `npm test -- tests/experiments/titration.test.ts tests/experiments/titration-display.test.ts tests/stores/labStore.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npx prettier --write ...` on ticket-owned files
- `npm run test:e2e -- tests/e2e/titration-controls.spec.ts`
- `npm test`
- `npm run build`
- `npm run test:e2e`
- Targeted `rg`, `sed`, `git diff`, and `git status` inspections

### Build/test results

- Production build passed.
- Strict TypeScript, ESLint, and Prettier checks passed.
- Unit suite passed: 6 files and 33 tests.
- Playwright passed in Chromium: 4 tests.
- The initial sandboxed Playwright attempt could not bind port 3000; the focused
  suite passed after receiving local-server permission. The first full run then
  exposed an ambiguous legacy `0.00 mL` locator after the new availability row
  was added; the assertion was scoped to labeled rows and all four tests passed
  on rerun.

### Manual verification performed

- Inspected the engine transition to confirm filling does not mutate chemistry,
  add flags, or add skill evidence.
- Confirmed through the browser test that Add titrant begins disabled, rinse and
  fill dispatch successfully, preparation controls lock after filling, remaining
  volume changes from 50.00 mL to 49.90 mL, meniscus recording still works, and
  no browser errors occur.
- Confirmed the state summary labels initial delivered and available volumes
  separately.

### Risks / limitations

- This MVP behavior supports one pre-run fill. Mid-run refills would require
  separating current burette reading from cumulative titrant delivery.
- Intermediate seeds must explicitly provide a consistent
  `buretteAvailableML`; broader runtime seed validation remains reserved for
  T0033.
- Existing conditioning, dilution, chemistry, and meniscus semantics were left
  unchanged.

### Follow-up tickets suggested

- Continue with `T0010 — pH curve component`.
- Consider refill-capable burette readings only if repeated fills become a
  product requirement.

### Docs needing update

- None. KI-003, repository state, and this completion report are updated.
