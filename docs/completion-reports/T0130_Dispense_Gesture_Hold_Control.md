# T0130 — Dispense gesture reducer and hold-to-dispense control

## Completion Report

### Summary

- Added a pure, timestamp-driven dispense reducer with closed, dropwise, slow,
  and open flow detents at 0, 0.05, 0.2, and 1.0 mL/s.
- Added volume-conserving segment commits at 0.5 mL, accepted detent changes,
  valve exhaustion, and every gesture termination path.
- Added 100 ms detent-change debouncing, available-volume clamping, automatic
  closure at an empty burette, numerical-residue rejection below 0.005 mL, and
  guards against non-positive durations.
- Added the one-click dropwise behavior as one 0.05 mL addition over 1 second.
- Added a thin React hook that samples `performance.now()` through animation
  frames only while dispensing and sends each committed segment through the
  existing typed `add_titrant` action.
- Added Escape, window-blur, pointer-cancel, button-blur, and document-hidden
  termination handling, all of which close the active valve and commit any
  valid remainder.
- Added a flow-detent selector and pointer/Space-key hold button to the existing
  deliver controls while retaining the original volume/duration form.
- Added reducer tests for rate integrity, conservation, debounce behavior,
  clamping, residue handling, all termination paths, and integration with the
  real titration engine's `flow_rate_high_near_endpoint` flag.
- Added browser coverage for a three-second slow hold, segmented engine events,
  burette-fill reduction, Space-key operation, auto-repeat protection, and the
  exact one-drop shortcut.

### Files changed

- `src/components/lab/titration/useDispenseGesture.ts`
- `src/components/lab/titration/TitrationControls.tsx`
- `tests/components/dispenseGesture.test.ts`
- `tests/e2e/titration-dispense.spec.ts`
- `docs/Repo_Current_State.md`
- `docs/completion-reports/T0130_Dispense_Gesture_Hold_Control.md`

### Commands run

- Repository guidance and source inspection with `rg`, `sed`, and `git status`
- `npx prettier --write src/components/lab/titration/useDispenseGesture.ts src/components/lab/titration/TitrationControls.tsx tests/components/dispenseGesture.test.ts tests/e2e/titration-dispense.spec.ts`
- `npm test -- tests/components/dispenseGesture.test.ts`
- `npm test -- tests/components/dispenseGesture.test.ts tests/experiments/titration.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run build`
- `npm run test:e2e -- tests/e2e/titration-dispense.spec.ts`
- `npm run test:e2e -- tests/e2e/titration-dispense.spec.ts tests/e2e/titration-controls.spec.ts tests/e2e/titration-equipment.spec.ts`
- `npm run test:e2e`
- Local `npm run dev -- --hostname 127.0.0.1`
- Headless Chromium interaction checks against the deterministic
  `t0130-hold` dev seed
- `git diff --check`

### Build/test results

- Production build passed.
- Strict TypeScript passed.
- ESLint passed.
- Prettier and diff-whitespace checks passed.
- Targeted dispense reducer tests passed: 1 file, 16 tests.
- Targeted reducer plus unchanged titration-engine tests passed: 2 files,
  29 tests.
- Full unit/component suite passed: 17 files, 122 tests.
- Full Playwright suite passed in Chromium: 17 tests.
- The new browser test and manual browser pass produced zero console errors or
  page errors.

### Manual verification performed

- Prepared and filled a deterministic burette, then exercised dropwise, slow,
  and open detents through the rendered hold control.
- Confirmed a short dropwise Space-key press dispatched exactly 0.05 mL over
  1 second.
- Held slow flow for approximately 3.1 seconds and confirmed additions
  committed while the pointer remained down, the live pH reading updated, and
  the burette fill decreased.
- Used the retained manual volume/duration form after hold dispensing and
  confirmed it continued to dispatch through the engine.
- Approached the 12.50 mL equivalence volume, opened the valve, and confirmed
  the real semantic event and StudentModel state contained
  `flow_rate_high_near_endpoint`.
- Confirmed the valve read closed after release and no browser console or page
  errors were produced.

### Risks / limitations

- Chemistry updates are intentionally segmented: slow flow reaches the 0.5 mL
  threshold about every 2.5 seconds, while open flow reaches it about every
  0.5 seconds; any valid remainder commits immediately when the gesture ends.
- Dropwise presses lasting up to one second are normalized to the educational
  one-drop shortcut. Longer dropwise holds preserve the continuous 0.05 mL/s
  rate.
- The selected detent remains selected after the active valve closes, matching
  a stopcock setting while avoiding accidental continued flow.
- T0130 adds no 3D stopcock target, liquid stream, drip, or flask ripple; those
  remain explicitly scoped to T0131.
- The existing upstream Three/R3F `THREE.Clock` deprecation warning remains
  unrelated to this ticket.

### Follow-up tickets suggested

- `T0131 — 3D stopcock drag and stream/drip animation`
- `T0132 — Contextual prompts and wide burette pose`

### Docs needing update

- None after updating `docs/Repo_Current_State.md` and adding this completion
  report.
