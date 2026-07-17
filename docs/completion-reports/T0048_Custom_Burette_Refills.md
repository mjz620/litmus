# T0048 — Custom burette refills and refill-required titrations

## Completion Report

### Summary
- Replaced the one-fill assumption with positive bounded custom fills/refills, separate cumulative delivery/current reading/availability, unflagged semantic refill events, stable charting, multi-fill session generation, checkpoint/retry/replay preservation, and accessible full/custom UI.

### Files changed
- `src/experiments/titration/titration.ts`, `src/experiments/titration/sessionConfig.ts`, `src/experiments/titration/replay.ts`, `src/experiments/titration/retry.ts`, `src/components/lab/titration/TitrationControls.tsx`, `src/components/lab/titration/TitrationScene.tsx`, `src/components/lab/titration/useTitrationIntents.ts`, `src/app/lab/[experimentId]/LabRouteShell.tsx`, `tests/experiments/titration*.test.ts`, `tests/stores/labStore.test.ts`, `tests/e2e/accessibility-refill.spec.ts`.

### Commands run
- `npm test`, `npm run typecheck`, `npm run build`, `npm run test:e2e`.

### Build/test results
- Engine tests complete a 60 mL endpoint after refill; partial/full validation, current meniscus, cumulative curve, seed, retry, checkpoint, replay, and valid-refill stay-silent cases pass.

### Manual verification performed
- Completed keyboard-only 50 mL delivery plus 12.5 mL custom refill; verified final cumulative 50.00 mL, 37.50 mL reading, 12.50 mL available, two fill records, and `read_meniscus` event.

### Risks / limitations
- Generated endpoints are bounded to two fills, though the engine safely supports additional valid refills.

### Follow-up tickets suggested
- Future Composer configuration registries must encode the same engine-owned capacity and exact action contract rather than duplicating validation.

### Docs needing update
- `README.md` and `docs/Repo_Current_State.md` updated; future Lab Composer registry/schema docs must add explicit custom-fill compatibility when T0200+ begins.
