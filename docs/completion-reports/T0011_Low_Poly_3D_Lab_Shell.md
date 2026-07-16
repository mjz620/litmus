# T0011 — Low-Poly 3D Lab Shell Completion Report

## Completion Report

### Summary

- Added a low-poly React Three Fiber lab bench with a burette, stand,
  Erlenmeyer flask, bench, backsplash, and tray built from primitive geometry.
- Projected the engine/store's available burette volume into a bounded liquid
  level and the latest engine-emitted `observedColor` into flask liquid color.
- Added constrained drag/orbit and scroll-zoom controls while retaining the
  existing 2D controls as the only way to dispatch experiment actions.
- Kept the scene lightweight with a demand-driven render loop, capped device
  pixel ratio, standard materials, low polygon counts, and no physics, model
  assets, textures, shadows, animation loop, or post-processing.
- Added accessible scene status and a nonvisual engine-derived summary.

### Files changed

- `package.json`
- `package-lock.json`
- `playwright.config.ts`
- `src/app/lab/[experimentId]/LabRouteShell.tsx`
- `src/app/lab/[experimentId]/page.module.css`
- `src/components/lab/titration/TitrationScene.tsx`
- `src/components/lab/titration/TitrationScene.module.css`
- `src/components/lab/three/Burette.tsx`
- `src/components/lab/three/ErlenmeyerFlask.tsx`
- `src/components/lab/three/LabBench.tsx`
- `src/components/lab/three/LabScene.tsx`
- `src/components/lab/three/sceneProjection.ts`
- `tests/components/sceneProjection.test.ts`
- `tests/e2e/titration-controls.spec.ts`
- `docs/Repo_Current_State.md`
- `docs/completion-reports/T0011_Low_Poly_3D_Lab_Shell.md`

### Commands run

- `npm install three @react-three/fiber @react-three/drei`
- `npx prettier --write ...`
- `npm test -- tests/components/sceneProjection.test.ts`
- `npm test`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm run build`
- `npm run test:e2e`
- `npm audit`
- Local Playwright visual and drag-orbit verification against
  `/lab/titration?seed=t0011-visual-check`

### Build/test results

- Production build passed.
- Strict TypeScript, ESLint, and Prettier checks passed.
- Full unit/component suite passed: 9 files, 41 tests.
- Playwright passed in Chromium: 5 tests, including WebGL scene readiness,
  burette fill-level updates, and the methyl-orange flask changing to red.
- Dependency audit passed with 0 vulnerabilities.

### Manual verification performed

- Opened the seeded titration lab and visually confirmed the low-poly bench,
  burette, stand, flask, backsplash, and tray render together.
- Conditioned and filled the burette, selected methyl orange, and added 0.10 mL
  titrant; confirmed the burette became nearly full and the flask liquid changed
  from colorless to red from engine-emitted observation data.
- Dragged across the canvas and confirmed the constrained orbit view redrew; the
  before/after canvas captures differed, and the scripted 12-step drag completed
  in roughly 248 ms in headless software WebGL.
- Confirmed the browser workflow reported no console errors or uncaught page
  errors. Development output contains an upstream Three/R3F `Clock` deprecation
  warning, but no runtime failure.
- Inspected the scene code and confirmed it imports display/store state only and
  contains no pH, equivalence-point, or indicator chemistry calculations.

### Risks / limitations

- WebGL availability and performance still depend on the student's browser and
  graphics stack; the existing precision controls remain separate from the 3D
  interaction surface.
- The flask color changes only when the deterministic engine emits an
  `observedColor` observation, so changing the indicator alone does not make the
  UI infer a chemistry result.
- The scene is intentionally schematic and omits graduations, pouring physics,
  photorealistic glass, shadows, models, textures, and post-processing.
- React Three Fiber currently emits a development-only upstream deprecation
  warning because it constructs `THREE.Clock`; this does not appear as a browser
  error and does not affect the production build.

### Follow-up tickets suggested

- `T0012 — Student event inspector dev panel`

### Docs needing update

- None after updating `docs/Repo_Current_State.md` and adding this report.
