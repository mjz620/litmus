# T0043 — Precipitation UI registration

## Completion Report

### Summary
- Registered the precipitation manifest/card/route and added accessible shared-shell controls for verified solution selection, mixing, observation, prediction, equation evidence, coach, and checkpoints.

### Files changed
- `src/experiments/precipitation/manifest.ts`, `src/experiments/registry.ts`, `src/components/ui/experimentRoutes.ts`, `src/components/lab/precipitation/PrecipitationWorkspace.tsx`, `src/app/lab/[experimentId]/LabRouteShell.tsx`, `src/stores/labStore.ts`.

### Commands run
- `npm test -- tests/experiments/registry.test.ts tests/experiments/precipitation.test.ts tests/stores/labStore.test.ts`, `npm run build`, `npm run test:e2e`.

### Build/test results
- Registry/store tests pass, both experiment cards render, and the production route builds through the shared shell.

### Manual verification performed
- Opened `/lab/precipitation`, mixed silver nitrate/sodium chloride, and inspected the real semantic event.

### Risks / limitations
- The ticket intentionally provides a 2D workspace, not a bespoke 3D precipitation scene/report.

### Follow-up tickets suggested
- Add Composer registry entries only after exact component/action compatibility contracts are implemented.

### Docs needing update
- `README.md` and `docs/Repo_Current_State.md` updated; schema/registry follow-up is T0200+.
