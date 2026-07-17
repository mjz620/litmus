# T0042 — Precipitation engine

## Completion Report

### Summary
- Added a deterministic local precipitation/solubility plugin with exact solution IDs, ion decomposition, insoluble-pair lookup, product/color/spectator output, net ionic equations, typed actions, skills, flags, and ground truth.

### Files changed
- `src/experiments/precipitation/precipitation.ts`, `tests/experiments/precipitation.test.ts`.

### Commands run
- `npm test -- tests/experiments/precipitation.test.ts`, `npm run typecheck`.

### Build/test results
- Four precipitate truth cases, a no-reaction case, misconception evidence, and positive stay-silent behavior pass.

### Manual verification performed
- Inspected registry independence: the engine imports no React, browser, database, or AI code.

### Risks / limitations
- Supported ions/reactions are an explicit bounded teaching set, not a general solubility solver.

### Follow-up tickets suggested
- New solution IDs require deterministic truth and compatibility coverage before Composer registration.

### Docs needing update
- `README.md` and `docs/Repo_Current_State.md` updated; future Lab Composer docs must mark only these exact IDs supported.
