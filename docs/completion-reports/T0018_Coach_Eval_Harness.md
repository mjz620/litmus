# T0018 — Coach eval harness v1

## Completion Report

### Summary
- Added a repeatable `eval:coach` gate reporting intervention recall, false-intervention rate, and evidence linkage across positive and explicit stay-silent fixtures.

### Files changed
- `tests/coach/evalHarness.test.ts`, `package.json`, `vitest.config.ts`.

### Commands run
- `npm run eval:coach`, `npm test`.

### Build/test results
- Deterministic fixtures report 100% intervention recall, 0% false intervention rate, and 100% evidence linkage.

### Manual verification performed
- Inspected the generated console table and per-scenario decisions.

### Risks / limitations
- Version-one fixtures are intentionally small and do not replace live-model evals.

### Follow-up tickets suggested
- Add model-versioned adversarial, multilingual, and longer-history cases.

### Docs needing update
- `README.md` and `docs/Repo_Current_State.md` updated.
