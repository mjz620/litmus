# T0131 — 3D stopcock drag and stream animation

## Completion Report

### Summary

- Made the distinct PTFE stopcock handle draggable when the burette is focused,
  with pointer capture and a larger invisible hit area suitable for the narrow
  physical control.
- Added a pure monotonic mapping from 120 px of downward drag travel through
  closed, dropwise, slow, and open stopcock angles.
- Connected physical detents to a dedicated instance of the unchanged T0130
  dispense controller, including a settled-position retry after its existing
  100 ms detent debounce.
- Added release, Escape, blur, pointer-cancel, lost-capture, and hidden-document
  termination handling; each path closes the valve and commits a valid pending
  remainder through the existing reducer.
- Re-grouped the existing handle/stem geometry around the barrel axis so the
  physical meshes rotate coherently without changing the continuous glass
  junction from T0120.
- Added a detent-scaled falling titrant stream and animated drop from the tip to
  the flask liquid surface.
- Added a high-contrast expanding ripple at the flask liquid surface while the
  physical valve is open.
- Kept the Canvas demand-driven: animation chains `invalidate()` only while
  physical dispensing is active and requests one final frame on state changes.
- Added `data-dispensing` and `data-pending-ml` to the scene section plus a live
  pending-volume/closed-valve badge and focused drag instructions.
- Added pure component tests for physical travel clamping, ordered detent
  mapping, exact detent angles, and increasing stream/drip weight by flow rate.

### Files changed

- `src/components/lab/three/Burette.tsx`
- `src/components/lab/three/ErlenmeyerFlask.tsx`
- `src/components/lab/titration/TitrationScene.tsx`
- `tests/components/buretteInteraction.test.ts`
- `docs/Repo_Current_State.md`
- `docs/completion-reports/T0131_Stopcock_Drag_Stream_Animation.md`

### Commands run

- Repository guidance and source inspection with `rg`, `sed`, `find`, and
  `git status`
- `npx prettier --write src/components/lab/three/Burette.tsx src/components/lab/three/ErlenmeyerFlask.tsx src/components/lab/titration/TitrationScene.tsx tests/components/buretteInteraction.test.ts`
- `npm test -- tests/components/buretteInteraction.test.ts tests/components/dispenseGesture.test.ts tests/components/erlenmeyerFlask.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run build`
- `npm run test:e2e -- tests/e2e/titration-dispense.spec.ts tests/e2e/titration-equipment.spec.ts tests/e2e/titration-camera.spec.ts`
- `npm run test:e2e`
- Local `npm run dev -- --hostname 127.0.0.1`
- One-off headless Chromium manual drag, interruption, visual-capture, endpoint,
  and WebGL draw-count checks using the repository SwiftShader flag
- `git diff --check`

### Build/test results

- Production build passed.
- Strict TypeScript passed.
- ESLint passed.
- Prettier and diff-whitespace checks passed.
- Targeted interaction/reducer/flask tests passed: 3 files, 26 tests.
- Full unit/component suite passed: 18 files, 126 tests.
- Full unchanged Playwright suite passed in Chromium: 17 tests.
- No permanent canvas-drag e2e was added, as required by the ticket.
- Manual browser runs produced zero console errors or page errors.

### Manual verification performed

- Focused the burette and dragged the white stopcock handle through the full
  closed → dropwise → slow → open travel; confirmed coherent handle rotation,
  live `data-dispensing`, pending-volume updates, segmented engine events, and
  release-to-close behavior.
- Visually inspected the thin stream and falling drop under the burette focus,
  then temporarily framed the flask during active physical flow to inspect the
  expanding liquid-surface ripple through the glass.
- Completed a deterministic drag-only titration past the 12.50 mL endpoint.
  Physical flow reached 13.83 mL after release, changed the flask projection to
  pink, and produced the real `flow_rate_high_near_endpoint` and
  `endpoint_overshoot` flags.
- Interrupted independent active drags with Escape, window blur,
  pointer-cancel, and a synthetic hidden-document `visibilitychange`; each
  returned `data-dispensing` to false, reset pending volume to 0.000 mL, and
  committed the valid remainder.
- Instrumented WebGL draw calls around the demand loop. After physical closure
  and one settling interval, the draw count remained unchanged for 600 ms,
  confirming the closed scene went cold.

### Risks / limitations

- The 3D path and accessible HTML hold path each own an instance of the same
  unchanged reducer. Normal pointer use cannot operate both at once, but
  deliberately combining a keyboard-held HTML pour with a simultaneous 3D
  drag is not coordinated across the sibling surfaces.
- Physical dragging is enabled only in burette focus; in the overview, the
  existing equipment interaction continues to focus the burette first.
- The current burette focus is intentionally not widened in this ticket; T0132
  owns the camera pose that simultaneously frames the tube top and flask base.
- Headless Chromium does not naturally mark a background page hidden, so the
  tab-switch path was exercised by dispatching `visibilitychange` with
  `document.hidden` set true; the real browser APIs and reducer path are the
  same.
- Stream/ripple colors remain local until T0141 centralizes the 3D palette.
- The existing upstream Three/R3F `THREE.Clock` deprecation warning remains
  unrelated to this ticket.

### Follow-up tickets suggested

- `T0132 — Contextual prompts and wide burette focus pose`
- `T0141 — Apply palette, materials, and lighting`
- `T0142 — Procedural sound`

### Docs needing update

- None after updating `docs/Repo_Current_State.md` and adding this completion
  report.
