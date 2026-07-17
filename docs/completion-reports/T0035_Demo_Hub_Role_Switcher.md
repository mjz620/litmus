# T0035 — Demo hub and role switcher

## Completion Report

### Summary
- Added credential-free `/demo` Student, Teacher, and Technical entry points with a persistent role switcher and scoped reset control.

### Files changed
- `src/app/demo/page.tsx`, `src/app/demo/layout.tsx`, `src/components/demo/DemoBar.tsx`, `src/components/demo/DemoBar.module.css`.

### Commands run
- `npm run build`, `npm run test:e2e`.

### Build/test results
- All demo routes prerender/build and require no account or external key.

### Manual verification performed
- Navigated between all three roles through the shared bar.

### Risks / limitations
- Lab Composer is correctly absent because work stops before T0200+ implementation.

### Follow-up tickets suggested
- Add Composer role only after hard validation/runtime tickets complete.

### Docs needing update
- `README.md`, `docs/demo/Runbook.md`, and `docs/Repo_Current_State.md` updated.
