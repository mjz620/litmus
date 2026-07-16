# T0009 — 2D Titration Controls Completion Report

## Completion Report

### Summary

- Added accessible 2D controls for burette rinsing, indicator selection, timed
  titrant addition, coarse/fine/drop volume presets, and meniscus reporting.
- Connected every supported interaction to typed Zustand dispatch and the
  deterministic titration engine.
- Added live engine-derived volume, pH, conditioning, indicator, event, and flag
  feedback without duplicating chemistry in UI code.
- Exposed the engine's implicit filled state honestly as a disabled “filled by
  default” control because no `fill_burette` action or state field exists.
- Added Playwright coverage for the complete supported control sequence.

### Files changed

- `src/components/lab/titration/TitrationControls.tsx`
- `src/components/lab/titration/TitrationControls.module.css`
- `src/app/lab/[experimentId]/LabRouteShell.tsx`
- `src/app/lab/[experimentId]/page.module.css`
- `tests/e2e/titration-controls.spec.ts`
- `tests/e2e/student-routes.spec.ts`
- `docs/Repo_Current_State.md`
- `docs/Known_Issues_And_Followups.md`
- `docs/completion-reports/T0009_2D_Titration_Controls.md`

### Commands run

- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run build`
- `npm run test:e2e`
- `rg` inspection for chemistry duplication and forbidden dependencies

### Build/test results

- Production build passed with the experiment and lab routes intact.
- Strict TypeScript, ESLint, and Prettier checks passed.
- Unit suite passed: 6 files, 29 tests.
- Playwright passed: 4 tests, including the full supported control workflow.

### Manual verification performed

- Rinsed with water and confirmed dilution-risk state/event feedback.
- Rinsed with titrant and confirmed conditioned state.
- Switched to methyl orange and confirmed state-summary UI updated.
- Added 0.10 mL over four seconds and confirmed volume updated to `0.10 mL`, pH
  appeared as `1.00`, and the semantic event was appended.
- Used the displayed reading to submit a meniscus measurement and confirmed the
  `read_meniscus` event and event count update.
- Confirmed the page emitted no browser console or uncaught page errors.
- Inspected UI files and found no chemistry formulas, coach, OpenAI, Supabase, or
  database behavior.

### Risks / limitations

- The established engine has no `fill_burette` action or filled-state field even
  though T0009 and product docs request a fill control. The UI therefore states
  that the burette is filled by default and does not emit a false event. This is
  recorded as KI-003.
- Input validation ensures positive finite additions but does not duplicate
  engine capacity or chemistry constraints.
- No 3D rendering or AI behavior was added.

### Follow-up tickets suggested

- `T0010 — pH curve component`
- Resolve KI-003 through an explicitly scoped engine-contract ticket.

### Docs needing update

- None after updating repo state, recording KI-003, and adding this report.
