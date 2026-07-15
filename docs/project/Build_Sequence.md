# Build Sequence

## Phase 0 — repository foundation

- Next.js/TypeScript strict setup.
- Formatting, linting, Vitest, Playwright.
- Basic route skeletons.
- Environment validation.
- `AGENTS.md` and workflow docs.

Exit: build/test scripts run.

## Phase 1 — truth layer

- Experiment contract.
- Titration engine and tests.
- Display rounding helpers.
- StudentModel reducer.
- Retry seed validation.

Exit: all headless chemistry tests pass.

## Phase 2 — vertical student slice

- Lab store.
- Titration 3D/2D controls.
- pH graph.
- Event inspector.
- Complete titration without AI/DB.

Exit: full titration works offline.

## Phase 3 — coach

- Trigger policy.
- `/api/coach`.
- Structured output.
- Hint escalation.
- Text questions.
- Initial coach eval harness.

Exit: seeded mistakes are caught; controlled success stays quiet.

## Phase 4 — persistence and teacher loop

- Supabase schema/RLS.
- Google auth.
- Class creation/join.
- Checkpoint route.
- Teacher dashboard.
- Seed demo class.

Exit: real student session changes teacher analytics after refresh.

## Phase 5 — report and retry

- Report form.
- `/api/evaluate`.
- Rubric UI.
- Retry selector.
- Endpoint-control retry.

Exit: mistake → feedback → retry → updated evidence works end to end.

## Phase 6 — judge environment and voice

- `/demo` hub.
- 22.00 mL seed.
- Role switcher.
- Technical inspector.
- Demo reset.
- Hold to Ask.

Exit: complete three-minute demo requires no credentials.

## Phase 7 — extensibility and polish

- Precipitation plugin.
- Chromebook performance.
- Accessibility pass.
- Final eval table.
- README/Devpost/video polish.

Exit: prize-submission-ready artifact.
