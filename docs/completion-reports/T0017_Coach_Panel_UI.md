# T0017 — Coach panel UI

## Completion Report

### Summary
- Added non-blocking coach messages, loading/error states, editable text questions, and automatic evidence-triggered requests through the shared store.

### Files changed
- `src/components/coach/CoachPanel.tsx`, `src/components/coach/CoachPanel.module.css`, `src/lib/agent/client.ts`, `src/stores/labStore.ts`, `src/app/lab/[experimentId]/LabRouteShell.tsx`.

### Commands run
- `npm run typecheck`, `npm test`, `npm run test:e2e`.

### Build/test results
- Store and browser suites confirm simulation dispatch stays synchronous while coach requests run asynchronously.

### Manual verification performed
- Exercised text submission and flagged-event rendering through the browser demo path.

### Risks / limitations
- Conversation history is session-memory only unless a later persistence ticket stores interventions.

### Follow-up tickets suggested
- Persist/redact coach interventions when production audit requirements are defined.

### Docs needing update
- `docs/Repo_Current_State.md` updated.
