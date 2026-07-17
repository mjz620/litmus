# T0014 — Coach trigger policy

## Completion Report

### Summary
- Added a pure trigger policy for flags, direct questions, and repeated negative evidence while keeping routine controlled work and valid refills silent.

### Files changed
- `src/lib/agent/triggerPolicy.ts`, `tests/coach/triggerPolicy.test.ts`.

### Commands run
- `npm test -- tests/coach/triggerPolicy.test.ts`, `npm run eval:coach`.

### Build/test results
- Overshoot, repeated-failure, direct-question, controlled-success, and refill stay-silent cases pass.

### Manual verification performed
- Inspected deterministic decisions and reason strings in the test output.

### Risks / limitations
- Policy uses a bounded recent-event window and does not model long-term history outside StudentModel.

### Follow-up tickets suggested
- Add workflow-registered trigger IDs only after hard Lab Composer registries exist.

### Docs needing update
- `docs/Repo_Current_State.md` updated.
