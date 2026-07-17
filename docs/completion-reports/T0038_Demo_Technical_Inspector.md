# T0038 — Demo technical inspector

## Completion Report

### Summary
- Added a technical view of real engine state, semantic events, StudentModel, coach payload/messages, checkpoint, and deterministic eval gate.

### Files changed
- `src/components/demo/DemoTechnicalInspector.tsx`, `src/components/demo/useDemoTrace.ts`, `src/app/demo/technical/page.tsx`.

### Commands run
- `npm run typecheck`, `npm run build`, `npm run eval:coach`.

### Build/test results
- Technical route builds and reads the versioned trace without exposing secrets or hidden model reasoning.

### Manual verification performed
- Generated a demo trace and inspected each panel in sequence.

### Risks / limitations
- The inspector shows raw educational runtime objects and is intended only for the judge demo.

### Follow-up tickets suggested
- Add redacted workflow validation/runtime panels after Lab Composer exists.

### Docs needing update
- `docs/demo/Demo_Script.md`, `docs/demo/Runbook.md`, and `docs/Repo_Current_State.md` updated.
