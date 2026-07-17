# T0132 — Contextual prompts and wide burette focus pose

## Completion Report

### Summary

- Re-authored the burette focus camera so the actual 1.900 m tube top and
  0.928 m flask base remain visible together at the scene's 42° vertical FOV.
- Added a pure camera-projection invariant that guards both extrema inside a
  0.95 normalized-device-coordinate safety margin.
- Added a slim, non-interactive, polite live prompt over the simulation panel.
- Drove prompt copy from the unchanged `getProcedureStage` state machine for
  preparation, titrant addition, result recording, and report submission.
- Added a near-endpoint prompt that recommends the Dropwise detent using only
  recent observed curve points and existing engine-authored semantic evidence.
- Gave existing endpoint-overshoot evidence precedence over the near-endpoint
  prompt and retained the bottom-of-meniscus reading instruction.
- Exposed procedure stage and the display-only near-endpoint projection as
  scene data attributes for deterministic inspection.

### Files changed

- `src/components/lab/three/benchLayout.ts`
- `src/components/lab/titration/TitrationScene.tsx`
- `tests/components/benchLayout.test.ts`
- `docs/Repo_Current_State.md`
- `docs/completion-reports/T0132_Contextual_Prompts_Wide_Burette_Pose.md`

### Commands run

- Repository guidance and source inspection with `rg`, `sed`, and `git diff`
- `npx prettier --write src/components/lab/three/benchLayout.ts src/components/lab/titration/TitrationScene.tsx tests/components/benchLayout.test.ts`
- `npm test -- tests/components/benchLayout.test.ts tests/components/procedureStage.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run build`
- `npm run test:e2e`
- Local `npm run dev -- --hostname 127.0.0.1`
- One-off headless Chromium prompt-sequence, endpoint, visual-capture, and
  console-error checks using the repository SwiftShader flag
- `git diff --check`

### Build/test results

- Production build passed.
- Strict TypeScript passed.
- ESLint passed.
- Prettier and diff-whitespace checks passed.
- Targeted layout and procedure-stage tests passed: 2 files, 35 tests.
- Full unit/component suite passed: 18 files, 127 tests.
- Full unchanged Playwright suite passed in Chromium: 17 tests.
- Manual browser runs produced zero console errors or page errors.

### Manual verification performed

- Focused a filled burette at a 1600 × 1200 viewport and visually confirmed
  that the tube top, graduation span, lower junction, stopcock, delivery tip,
  and complete flask are simultaneously visible.
- Followed the prompt from initial preparation through rinse/fill, first
  addition, near-endpoint addition, endpoint overshoot, and result recording.
- Confirmed the near-endpoint prompt recommends switching to Dropwise after an
  observed steep curve segment and that endpoint overshoot instead instructs
  the student to close the stopcock and record the reading.
- Confirmed the result-recording prompt tells the student to read the bottom of
  the concave meniscus.
- Verified the focused endpoint scene retained both the burette and flask while
  `data-flask-color` projected the engine's pink observation.

### Risks / limitations

- The endpoint pink remains visually subtle through the current high-quality
  transmitted glass material. T0141 owns the coordinated palette/material
  treatment after the T0140 design-system specification.
- Near-endpoint guidance is deliberately observational: it appears only after
  the existing curve or engine semantic evidence indicates proximity. The UI
  does not calculate equivalence point or any other chemistry ground truth.
- The prompt uses a local inline visual token to keep this ticket within its
  listed files; T0141 can move that styling into the final design-system CSS.
- The existing upstream Three/R3F `THREE.Clock` deprecation warning remains
  unrelated to this ticket.

### Follow-up tickets suggested

- `T0140 — Design-system specification`
- `T0141 — Apply palette, materials, and lighting` after T0140
- `T0142 — Procedural sound` (optional)

### Docs needing update

- None after updating `docs/Repo_Current_State.md` and adding this completion
  report.
