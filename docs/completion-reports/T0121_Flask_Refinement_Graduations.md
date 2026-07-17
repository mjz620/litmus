# T0121 — Flask refinement and graduations

## Completion Report

### Summary

- Preserved the existing Erlenmeyer lathe and all layout constants that feed
  the burette derivation.
- Added three ordered interpolation points through the body-to-neck shoulder
  transition for a smoother blend.
- Applied a light stylized-proportion pass by broadening the flat foot while
  retaining the same maximum base radius, neck, rim, and total height.
- Added a cached CanvasTexture graduation decal with 25, 50, 75, and 100 mL
  labels on a frosted high-contrast backing.
- Wrapped the decal around the existing conical body below the shoulder so it
  follows the flask slope without adding or rebuilding the silhouette.
- Added explicit late render ordering for the decal after visual testing found
  that transmitted high-quality glass otherwise sorted over the markings.
- Kept the same geometry and markings in high- and low-quality paths; only the
  established glass and liquid materials continue to vary by quality.
- Added pure profile and graduation tests covering extents, point ordering,
  bounded wall slopes, shoulder interpolation, conical radius behavior, label
  order, and decal placement.

### Files changed

- `src/components/lab/three/ErlenmeyerFlask.tsx`
- `tests/components/erlenmeyerFlask.test.ts`
- `docs/Repo_Current_State.md`
- `docs/completion-reports/T0121_Flask_Refinement_Graduations.md`

### Commands run

- Repository guidance and source inspection with `rg`, `sed`, and `git status`
- `npx prettier --write src/components/lab/three/ErlenmeyerFlask.tsx tests/components/erlenmeyerFlask.test.ts`
- `npm test -- tests/components/erlenmeyerFlask.test.ts tests/components/benchLayout.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run build`
- `npm run test:e2e`
- Local `npm run dev -- --hostname 127.0.0.1`
- Headless Chromium focus-view capture in high and reduced graphics with
  bromothymol-blue endpoint liquid
- `git diff --check`

### Build/test results

- Production build passed.
- Strict TypeScript passed.
- ESLint passed.
- Prettier and diff-whitespace checks passed.
- Targeted flask/layout tests passed: 2 files, 34 tests.
- Full unit/component suite passed: 16 files, 106 tests.
- Full Playwright suite passed in Chromium: 16 tests.
- The browser visual pass produced zero console errors or page errors.

### Manual verification performed

- Completed a deterministic bromothymol-blue titration past endpoint and opened
  the flask focus with blue projected engine state.
- Inspected the high-quality glass path: 25/50/75/100 mL labels remained
  readable over the bright transmitted liquid and white tile, while upper
  markings crossed the darker bench region.
- Inspected reduced graphics: all four labels remained readable over blue
  liquid and the near-black bench.
- Confirmed the shoulder reads as a gradual body-to-neck blend without a radius
  step, and the outer flask silhouette remains recognizable and unchanged in
  overall extent.
- Confirmed the decal remains below the shoulder and follows the tapered body.

### Risks / limitations

- The flask markings are approximate educational graduations, not volumetric
  calibration; the Erlenmeyer remains scientifically presented as a vessel,
  not precision measuring glassware.
- High-quality transmitted liquid can appear visually pale over a bright
  environment even though the engine-projected color is unchanged. The dark
  graduation ink remains legible; broader material tuning remains T0141 scope.
- The decal’s frosted backing is intentionally prominent for middle/high-school
  readability and may be refined when palette/material tokens are centralized.
- The existing upstream Three/R3F `THREE.Clock` development warning remains
  unrelated to this ticket.

### Follow-up tickets suggested

- `T0130 — Dispense gesture reducer and hold-to-dispense control`
- `T0141 — Apply palette, materials, and lighting`

### Docs needing update

- None after updating `docs/Repo_Current_State.md` and adding this completion
  report.
