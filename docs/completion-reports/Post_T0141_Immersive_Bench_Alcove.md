# Post-T0141 — Immersive student bench alcove

## Completion Report

### Summary

- Reframed the broad classroom as a compact alcove centered on the active
  student island.
- Removed the distant second island, rear service counter, and both wall-mounted
  glass-front cabinets.
- Moved the sink onto the rear-left corner of the active worktop and refined it
  with a metal rim, dark inset basin, drain, and gooseneck faucet.
- Added a low splashback, framed pastel molecular mural, and scalloped pastel
  garland using the existing centralized 3D palette.
- Raised the alcove walls to keep the open-top seam outside every authored 42°
  camera frustum. The sky dome remains available beyond the open shell without
  making normal views look roofless.
- Preserved all experiment geometry, camera poses, equipment interactions,
  chemistry state, and action semantics.

### Files changed

- `src/components/lab/three/benchLayout.ts`
- `src/components/lab/three/ClassroomEnvironment.tsx`
- `tests/components/benchLayout.test.ts`
- `docs/Repo_Current_State.md`
- `docs/completion-reports/Post_T0141_Immersive_Bench_Alcove.md`

### Commands run

- `rg` and `sed` inspection of room, island, sink, wall, camera, and design
  invariants
- `npx prettier --write src/components/lab/three/benchLayout.ts src/components/lab/three/ClassroomEnvironment.tsx tests/components/benchLayout.test.ts`
- `npm test -- tests/components/benchLayout.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run build`
- `npm run test:e2e`
- `git diff --check`
- Local development server and headless Chromium/SwiftShader captures of the
  student and developer routes in high/reduced overview plus every equipment
  focus pose

### Build/test results

- Production build passed.
- Strict TypeScript and ESLint passed.
- Prettier and diff-whitespace checks passed.
- Focused bench-layout suite passed: 1 file, 32 tests.
- Full unit/component suite passed: 19 files, 133 tests.
- Full Playwright suite passed in Chromium: 17 tests.
- Visual verification captured zero application console errors or page errors.

### Manual verification performed

- Inspected high- and reduced-quality student overviews at 1500 × 1200: the
  active island fills the scene, distant room furniture is absent, and no roof
  seam is visible.
- Inspected burette focus: the full tube/flask framing remains intact against
  the molecular mural, with the pastel garland below the top of frame.
- Inspected indicator-shelf focus: the integrated basin, drain, and faucet are
  clearly visible immediately behind the shelf without intersecting bottles.
- Inspected wash-station and flask focus for wall, mural, sink, and equipment
  clipping.
- Checked the developer route's narrower canvas as a worst-case crop and
  captured zero application errors in both route layouts.

### Risks / limitations

- The integrated sink is visual set dressing. Rinsing and filling continue to
  use the existing wash-station hotspots and typed action dispatcher.
- The 3.0 m walls intentionally hide the open edge from authored cameras. The
  sky dome still exists, but is now mainly a fallback beyond normal sightlines.
- The pastel mural and garland are deliberately simple low-poly primitives to
  preserve Chromebook-class rendering cost.
- The existing upstream `THREE.Clock` deprecation warning remains unrelated.

### Follow-up tickets suggested

- If desired, a future scoped interaction ticket could make the bench sink a
  redundant physical path for the existing water-rinse action.
- `T0142 — Procedural sound` remains the next optional planned ticket.

### Docs needing update

- None after updating `docs/Repo_Current_State.md` and adding this report.
