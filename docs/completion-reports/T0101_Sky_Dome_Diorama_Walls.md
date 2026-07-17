# T0101 — Remove ceiling; sky dome and diorama walls

## Completion Report

### Summary

- Removed the classroom ceiling slab and its four decorative emissive panels;
  the three real scene lights remain unchanged.
- Added shared `WALLS` constants for a 1.9 m open-top diorama with a thin
  contrasting cap along the back and left walls.
- Lowered the whiteboard and glass-front cabinets beneath the wall cap and
  shortened the support-stand rod to the same cap while preserving clamp
  clearance.
- Added a single 30 m, 16×12-segment back-sided sky sphere with a WebGL1/GLSL
  ES 1.00-compatible three-color pastel gradient.
- Rendered the dome only for the high-quality path; reduced graphics continues
  to use the established solid background fallback.
- Extended layout invariants for the wall/trim boundary, wall-cap geometry,
  and sky-dome dimensions.

### Files changed

- `src/components/lab/three/ClassroomEnvironment.tsx`
- `src/components/lab/three/SkyDome.tsx`
- `src/components/lab/three/LabScene.tsx`
- `src/components/lab/three/benchLayout.ts`
- `tests/components/benchLayout.test.ts`
- `docs/Repo_Current_State.md`
- `docs/completion-reports/T0101_Sky_Dome_Diorama_Walls.md`

### Commands run

- Repository context inspection with `find`, `rg`, `sed`, and `git status`
- `npm test -- tests/components/benchLayout.test.ts`
- `npx prettier --write ...` on T0101-owned source/test files
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run build`
- `npm run test:e2e`
- Local `npm run dev -- --hostname 127.0.0.1`
- Headless Chromium screenshots of high- and reduced-quality canvas output
- `git diff --check`

### Build/test results

- Production build passed.
- Strict TypeScript passed.
- ESLint passed.
- Prettier and diff-whitespace checks passed.
- Full unit/component suite passed: 13 files, 77 tests.
- Bench-layout coverage passed: 1 file, 16 tests.
- Full Playwright suite passed in Chromium: 13 tests, including reduced
  graphics and the existing zero-console-error checks.

### Manual verification performed

- Inspected a 1366×768 high-quality SwiftShader capture and confirmed the
  ceiling is absent, the open wall edge has a contrasting trim, and the warm
  procedural horizon fills the open sky without a void.
- Inspected the same view after enabling Reduced graphics and confirmed the sky
  dome is removed while the established solid background remains behind the
  open walls.
- Confirmed the lowered wall cabinets and whiteboard remain below the trim.
- Confirmed the support rod still extends above its clamp and reaches the
  burette tube top; the tube, rod, trim, and wall all stay at or below the
  shared 1.9 m cap.
- The screenshot pass captured no browser console errors or page errors.

### Risks / limitations

- The shader colors are intentionally local pending T0141, which will move all
  3D hex colors into the shared palette module.
- Visual verification used Chromium with SwiftShader; a real Chromebook GPU
  pass remains useful for final performance and color evaluation.
- The existing upstream Three/R3F `THREE.Clock` deprecation warning still
  appears in development server output; it is not a browser console error and
  is unrelated to this ticket.

### Follow-up tickets suggested

- `T0102 — BenchCameraControls and OrbitControls removal`
- `T0120 — Burette stopcock junction rebuild` remains dependent on this ticket.

### Docs needing update

- None after updating `docs/Repo_Current_State.md` and adding this completion
  report.
