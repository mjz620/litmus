## Completion Report

### Summary

- Reworked the titration route around a full-width, immersive 3D bench.
- Moved equipment navigation, procedure prompts, status, sound/graphics
  switches, recentering, and coach access into the bench viewport.
- Replaced the permanent precision-controls sidebar with a closed-by-default
  accessibility drawer; it continues to dispatch the same typed experiment
  actions and exposes the same deterministic engine readings.
- Moved the coach into a non-modal bench dialog with a persistent launcher and
  message count. Automatic coach messages no longer interrupt physical work by
  opening over equipment.
- Made Recenter view clear every equipment subview before returning to the
  neutral full-bench camera.
- Replaced the indicator shelf's pull-forward selection with a shelf-to-flask
  addition animation and visible drops; engine state still changes only through
  `select_indicator`.
- Rebuilt the sink as an open basin with a continuous gooseneck faucet and
  connected controls.
- Softened both phenolphthalein display colors so the endpoint projection reads
  as pale/faint pink instead of saturated magenta.
- Restyled the lab session header, retry banner, demo role switcher, guidance
  strip, coach, and accessory cards with a warmer, more playful visual system.
- Kept the notebook and live pH curve available as optional disclosure cards
  below the bench.

### Files changed

- `src/app/demo/student/page.module.css`
- `src/app/demo/student/page.tsx`
- `src/app/lab/[experimentId]/LabRouteShell.tsx`
- `src/app/lab/[experimentId]/page.module.css`
- `src/components/coach/CoachPanel.module.css`
- `src/components/coach/CoachPanel.tsx`
- `src/components/demo/DemoBar.module.css`
- `src/components/demo/DemoBar.tsx`
- `src/components/lab/LabSessionBar.module.css`
- `src/components/lab/LabSessionBar.tsx`
- `src/components/lab/retry/RetryBanner.module.css`
- `src/components/lab/retry/RetryBanner.tsx`
- `src/components/lab/three/ClassroomEnvironment.tsx`
- `src/components/lab/three/IndicatorAddition.tsx`
- `src/components/lab/three/IndicatorShelf.tsx`
- `src/components/lab/three/LabScene.tsx`
- `src/components/lab/three/WashStation.tsx`
- `src/components/lab/three/benchLayout.ts`
- `src/components/lab/three/labPalette.ts`
- `src/components/lab/titration/TitrationScene.module.css`
- `src/components/lab/titration/TitrationScene.tsx`
- `src/components/lab/titration/TitrationWorkspace.module.css`
- `src/components/lab/titration/TitrationWorkspace.tsx`
- `tests/components/sceneProjection.test.ts`
- `tests/e2e/accessibility-refill.spec.ts`
- `tests/e2e/demo-flow.spec.ts`
- `tests/e2e/labHelpers.ts`
- `tests/e2e/procedural-sound.spec.ts`
- `tests/e2e/report-retry-voice.spec.ts`
- `tests/e2e/student-routes.spec.ts`
- `tests/e2e/student-surface.spec.ts`
- `tests/e2e/titration-camera.spec.ts`
- `tests/e2e/titration-controls.spec.ts`
- `tests/e2e/titration-dispense.spec.ts`
- `tests/e2e/titration-equipment.spec.ts`
- `tests/e2e/titration-physical-equipment.spec.ts`

### Commands run

- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run test:e2e`
- `npm run test:e2e -- tests/e2e/titration-equipment.spec.ts`
- `npm run test:e2e -- tests/e2e/titration-physical-equipment.spec.ts tests/e2e/titration-camera.spec.ts`
- `npm run test:e2e -- tests/e2e/demo-flow.spec.ts tests/e2e/report-retry-voice.spec.ts tests/e2e/student-routes.spec.ts tests/e2e/student-surface.spec.ts tests/e2e/titration-equipment.spec.ts`
- `npm run test:e2e -- tests/e2e/procedural-sound.spec.ts`
- `npm run test:e2e -- tests/e2e/titration-equipment.spec.ts --grep 'compact screens'`
- `npm run build`
- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=local-build-anon-key-1234567890 SUPABASE_SERVICE_ROLE_KEY=local-build-service-role-key-1234567890 OPENAI_MOCK_MODE=1 npm run build`
- `npm run dev -- --hostname 127.0.0.1`
- Local Playwright capture scripts for the initial bench, coach dialog,
  precision drawer, and indicator-addition midpoint.

### Build/test results

- TypeScript: passed.
- ESLint: passed.
- Prettier check: passed.
- Vitest: 39 files and 187 tests passed.
- Playwright: 26 tests passed, including physical equipment, recentering,
  keyboard-only precision controls, coach voice/text paths, reduced motion,
  demo flow, answer-leak protection, and a 390 px compact viewport.
- Production build: passed with local placeholder Supabase values and mock
  OpenAI mode.
- The first production-build invocation correctly failed fast because this
  checkout does not provide the required Supabase environment variables.

### Manual verification performed

- Inspected the complete demo/lab composition at 1600 × 1100.
- Opened and inspected the in-bench coach dialog and accessibility drawer.
- Ran the indicator selection from the physical shelf and inspected the
  shelf-to-flask travel, visible drop, camera focus, and activity status.
- Inspected the rebuilt sink and faucet from the overview camera.
- Confirmed that the recenter action exits equipment focus and restores the
  neutral bench.
- Confirmed that automatic coach evidence appears as a badge without obscuring
  the equipment rail.
- Verified compact-viewport bounds for the rail, drawer, coach, and recenter
  control at 390 × 844.

### Risks / limitations

- The indicator travel is a deterministic UI projection of the student's
  selection gesture; it does not model drop count or concentration and does not
  alter chemistry outside `ExperimentDefinition.step()`.
- The precision drawer intentionally overlays the right side of the lab while
  open. Students can close it without losing any engine state.
- Three.js currently emits its upstream `THREE.Clock` deprecation warning in
  browser test logs; no runtime errors were observed.
- A production build still requires real Supabase environment values in the
  deployment environment.

### Follow-up tickets suggested

- Add touch-device usability sessions on representative Chromebook/tablet
  hardware to tune physical stopcock drag distances and projected hotspot size.
- Consider a small, non-blocking coach-message preview beside the badge after
  classroom testing establishes that it does not distract from procedure.

### Docs needing update

- Replace the old lab and demo screenshots in project/Devpost materials with
  the immersive bench and in-bench coach views.
- Document that precision controls, notebook, and pH graph are optional
  accessibility/measurement disclosures rather than the primary lab workflow.
