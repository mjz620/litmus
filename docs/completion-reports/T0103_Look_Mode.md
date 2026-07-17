# T0103 — Look mode: activation, edge pan, scroll suppression, keyboard

## Completion Report

### Summary

- Added `labUiStore` with focused, hovered, and look-active presentation state
  plus the specified setters and focus-clear action.
- Added click-to-activate look mode through the Canvas `onPointerMissed`
  callback, a `data-look-active` scene attribute, and the polite live
  instruction chip.
- Added explicit overview guidance telling students to click the simulation
  panel to initiate panning and then move toward its edges.
- Extended `BenchCameraControls` to sample window pointer movement into canvas
  NDC, use the T0100 edge-pan/integration math, apply the T0102 look limits, and
  keep the demand render loop active only while input or momentum remains.
- Added Escape, outside-frame pointer-down, and window-blur release paths.
- Added frame-local non-passive wheel/touchmove containment that is mounted
  before activation and prevents default only while look mode is active,
  avoiding a Safari first-wheel race without changing body overflow.
- Added an accessible focusable camera frame with arrow-key look steps and an
  HTML “Recenter view” button.
- Moved the active cursor/touch state, live chip, and recenter-button
  presentation out of JSX and into the existing scene CSS module.
- Added reduced-motion behavior that disables cursor-driven continuous pan and
  momentum while retaining discrete arrow-key steps.
- Added browser coverage for activation, edge pan, release paths, scroll
  containment, outside page scrolling, keyboard/recenter behavior, reduced
  motion, and zero console errors.

### Files changed

- `src/stores/labUiStore.ts`
- `src/components/lab/three/BenchCameraControls.tsx`
- `src/components/lab/titration/TitrationScene.module.css`
- `src/components/lab/titration/TitrationScene.tsx`
- `tests/e2e/titration-camera.spec.ts`
- `docs/Repo_Current_State.md`
- `docs/completion-reports/T0103_Look_Mode.md`

### Commands run

- Repository context/source inspection with `rg`, `sed`, and `git status`
- `npx prettier --write ...` on T0103-owned files
- `/Users/mingjiazhang/.nvm/versions/node/v22.17.0/bin/node node_modules/playwright/cli.js install webkit`
- `/Users/mingjiazhang/.nvm/versions/node/v22.17.0/bin/node node_modules/playwright/cli.js install chromium`
- Temporary WebKit-only Playwright config and camera smoke execution; temporary
  files removed after validation
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run build`
- `npm run test:e2e -- tests/e2e/titration-camera.spec.ts`
- `npm run test:e2e`
- Headless WebKit launch and wheel-event diagnostics
- `rg` checks for body-overflow locking, inline styles, and active touch rules
- `git diff --check`

### Build/test results

- Production build passed.
- Strict TypeScript passed.
- ESLint passed.
- Prettier and diff-whitespace checks passed.
- Full unit/component suite passed: 13 files, 80 tests.
- New camera e2e coverage passed in Chromium: 2 tests.
- Full Playwright suite passed in Chromium: 15 tests.
- Temporary WebKit/Safari-engine camera smoke passed: 2 tests covering
  activation guidance, frame-local wheel cancellation, outside page scrolling,
  keyboard/recenter changes, Escape/blur release, reduced-motion edge stillness,
  and zero console errors.
- Existing equipment/controls specs remain green, including equipment-focus
  Escape behavior while look mode is inactive.
- No body-overflow locking is present in the look-mode implementation.
- Playwright Chromium, Chromium headless shell, FFmpeg, and WebKit browser
  caches are installed locally after validation.

### Manual verification performed

- Activated look mode by clicking an empty upper canvas area and confirmed
  `data-look-active="true"` plus the visible/live instruction chip.
- Confirmed the overview copy visibly instructs students to click the
  simulation panel to initiate panning.
- Confirmed cursor dwell near an edge moves the bounded view and moving to the
  dead zone lets momentum settle and the demand loop go cold.
- Confirmed wheel input over the active frame leaves `window.scrollY`
  unchanged, while wheel input outside the frame scrolls the page.
- Confirmed ArrowLeft/Right/Up/Down produce discrete bounded view changes and
  Recenter view resets orientation.
- Confirmed Escape, clicking the Reduced graphics control outside the frame,
  and a dispatched window blur each release look mode.
- Emulated reduced motion and confirmed a 500 ms edge dwell leaves the view
  unchanged while an arrow key still changes it.
- Chromium and WebKit checks captured zero console errors or page errors.
- Confirmed in WebKit that a cancelable DOM wheel event dispatched on the
  active frame is prevented and leaves `window.scrollY` unchanged, while wheel
  input outside the frame scrolls the page.
- Confirmed in WebKit that reduced motion keeps an edge dwell visually still
  and retains discrete arrow-key look.

### Risks / limitations

- `focused` and `hovered` exist in `labUiStore` as required, but current
  equipment selection/hover ownership remains in the existing React state
  until T0111 explicitly migrates it.
- Keyboard and recenter commands use narrowly scoped custom window events to
  cross the DOM/R3F boundary without expanding the store beyond the ticket's
  specified shape.
- The checked-in Playwright project remains Chromium-only. Playwright WebKit's
  synthetic `page.mouse.wheel` targets the document root regardless of pointer
  position, so WebKit frame containment was verified with a cancelable DOM
  wheel event plus outside-page wheel scrolling in a temporary smoke.
- The local Playwright installer stalled while extracting browsers under Node
  24; running the same project installer under the available Node 22 runtime
  completed successfully. This is a local tooling issue, not an application
  runtime dependency.
- The existing upstream Three/R3F `THREE.Clock` development warning remains
  unrelated to this ticket.

### Follow-up tickets suggested

- `T0110 — Interactable wrapper, hover labels, equipment extension`
- `T0111 — Selection state to labUiStore`

### Docs needing update

- None after updating `docs/Repo_Current_State.md` and adding this completion
  report.
