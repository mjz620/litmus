# T0010 — pH Curve Component Completion Report

## Completion Report

### Summary

- Added a dependency-free SVG pH curve component driven exclusively by the
  engine-owned `state.curve`.
- Added fixed pH axis labels, titrant-volume axis labels, current-point
  highlighting, and a current numeric readout.
- Added an accessible chart name, description, and text summary containing point
  count, current volume, and current pH.
- Added a graceful empty state before the first titrant addition.
- Mounted the component in the lab shell and extended browser coverage to confirm
  it updates after a typed titrant action.

### Files changed

- `src/components/lab/PHCurve.tsx`
- `src/app/lab/[experimentId]/LabRouteShell.tsx`
- `tests/components/PHCurve.test.ts`
- `tests/e2e/titration-controls.spec.ts`
- `vitest.config.ts`
- `docs/Repo_Current_State.md`
- `docs/completion-reports/T0010_PH_Curve_Component.md`

### Commands run

- `npm test -- tests/components/PHCurve.test.ts`
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm run build`
- `npm run test:e2e`

### Build/test results

- Production build passed with no chart dependency added.
- Strict TypeScript, ESLint, and Prettier checks passed.
- Component tests passed: 1 file, 3 tests.
- Full unit/component suite passed: 8 files, 39 tests.
- Playwright passed: 5 tests, including the live chart update.

### Manual verification performed

- Opened `/lab/titration` and confirmed the chart initially displays “Add
  titrant to record the first pH measurement.”
- Filled the burette and added 0.10 mL over four seconds.
- Confirmed the empty state was replaced by an SVG chart with one plotted point.
- Confirmed the accessible chart summary reported `0.10 mL` and `pH 1.00`.
- Confirmed the current numeric readout and axes were visible.
- Confirmed no browser console or uncaught page errors occurred.

### Risks / limitations

- The chart uses a standard fixed pH domain of 0–14 and clamps only visual
  coordinates to that range; underlying engine values remain unchanged and are
  still reported numerically.
- With one measurement the chart renders a point; the connecting polyline begins
  when a second point exists.
- This is an experiment chart only, not a reusable analytics-chart system.

### Follow-up tickets suggested

- `T0011 — Low-poly 3D lab shell`

### Docs needing update

- None after updating `docs/Repo_Current_State.md` and adding this report.
