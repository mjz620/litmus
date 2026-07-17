# T0033 — Adaptive retry seed validation

## Completion Report

### Summary
- Added deterministic endpoint-control and burette-conditioning retry templates with engine-owned validity checks and preserved seed/fill provenance.

### Files changed
- `src/experiments/titration/retry.ts`, `tests/experiments/titration-retry.test.ts`.

### Commands run
- `npm test -- tests/experiments/titration-retry.test.ts`, `npm run typecheck`.

### Build/test results
- Both templates validate; invalid capacity state is rejected; the 22.00 mL seed rebuilds its curve and fill history.

### Manual verification performed
- Inspected engine-created retry state against the intended skill windows.

### Risks / limitations
- Only the two ticket-approved skills have retry templates.

### Follow-up tickets suggested
- New templates require new deterministic validators and evidence coverage.

### Docs needing update
- `docs/Repo_Current_State.md` updated.
