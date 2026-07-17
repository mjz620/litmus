# T0102 — BenchCameraControls and OrbitControls removal

## Completion Report

### Summary

- Replaced the OrbitControls-owned `CameraRig` with a custom
  `BenchCameraControls` component that directly updates camera position and
  calls `camera.lookAt()`.
- Preserved the established 0.65-second `easeInOutCubic` focus tween, demand
  frameloop invalidation, and reduced-motion snap behavior.
- Added `BENCH_VIEW` as the fixed standing overview pose and retained the
  existing burette, flask, and meniscus focused poses unchanged.
- Added relative `LOOK_LIMITS` of approximately ±55° yaw and −35°/+20° pitch
  for the dependent look-mode ticket.
- Removed `ORBIT_LIMITS`, all OrbitControls source/test references, and the
  obsolete `CameraRig.tsx`.
- Updated the scene instructions to describe the fixed full-bench view without
  advertising drag-orbit or scroll-zoom behavior.
- Added layout invariants for room containment, the target being over the
  island, requested limit values, and the upper look bound staying below the
  wall-top sightline.

### Files changed

- `src/components/lab/three/BenchCameraControls.tsx`
- `src/components/lab/three/CameraRig.tsx` — deleted
- `src/components/lab/three/benchLayout.ts`
- `src/components/lab/three/LabScene.tsx`
- `src/components/lab/titration/TitrationScene.tsx` — instruction copy only
- `tests/components/benchLayout.test.ts`
- `docs/Repo_Current_State.md`
- `docs/completion-reports/T0102_Bench_Camera_Controls.md`

### Commands run

- Repository context and source inspection with `rg`, `sed`, and `git status`
- `npm test -- tests/components/benchLayout.test.ts`
- `npx prettier --write ...` on T0102-owned source/test files
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run build`
- `npm run test:e2e -- tests/e2e/titration-equipment.spec.ts`
- `npm run test:e2e`
- `rg` checks for `OrbitControls`, `ORBIT_LIMITS`, and `CameraRig`
- Local `npm run dev -- --hostname 127.0.0.1`
- Headless Chromium camera screenshots and SHA-256 comparisons
- `git diff --check`

### Build/test results

- Production build passed.
- Strict TypeScript passed.
- ESLint passed.
- Prettier and diff-whitespace checks passed.
- Full unit/component suite passed: 13 files, 80 tests.
- Bench-layout coverage passed: 1 file, 19 tests.
- The unchanged `titration-equipment.spec.ts` passed: 2 tests.
- Full Playwright suite passed in Chromium: 13 tests.
- No `OrbitControls`, `ORBIT_LIMITS`, or `CameraRig` references remain in
  `src/**` or `tests/**`.

### Manual verification performed

- Inspected the fixed standing overview at 1366×768 in Chromium/SwiftShader.
- Dragged across an empty area of the canvas and wheeled over it; after forcing
  a harmless quality-toggle redraw to work around SwiftShader compositor loss
  after page scrolling, the overview screenshot hash remained byte-identical.
- Focused the burette and confirmed the canvas changed to the established close
  pose after the 0.65-second tween.
- Used “← Back to full bench” and confirmed the returned canvas was
  byte-identical to the initial fixed overview.
- Emulated `prefers-reduced-motion: reduce`, selected the burette, and confirmed
  screenshots at 50 ms and 800 ms were byte-identical, demonstrating an
  immediate stable snap rather than a continuing tween.
- The manual browser pass captured no console errors or page errors.

### Risks / limitations

- Edge pan, keyboard look, recentering, and scroll containment intentionally
  remain absent until T0103.
- The canvas frame still inherits its existing non-hover `grab` cursor; changing
  interaction cursor/state belongs with T0103's look-mode activation rather
  than this ticket's instruction-copy-only TitrationScene scope.
- SwiftShader can lose portions of a demand-rendered canvas after browser page
  scrolling until the scene is invalidated; this affected screenshot
  comparison only and was separated from camera movement with a controlled
  redraw.
- The upstream Three/R3F `THREE.Clock` development warning remains unrelated to
  this ticket.

### Follow-up tickets suggested

- `T0103 — Look mode: activation, edge pan, scroll suppression, keyboard`
- `T0110 — Interactable wrapper and hover labels` after T0102.

### Docs needing update

- None after updating `docs/Repo_Current_State.md` and adding this completion
  report.
