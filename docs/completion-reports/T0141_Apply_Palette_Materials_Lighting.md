# T0141 — Apply palette, materials, and lighting

## Completion Report

### Summary

- Added `labPalette.ts` as the only source of hexadecimal colors used by the 3D
  scene, including projected liquid colors, procedural labels and graduations,
  interaction states, the sky shader, and the reduced-quality background.
- Applied the T0140 material rules across the classroom, burette, flask,
  indicator shelf, wash station, and shared glass/liquid materials. Nonzero
  metalness is restricted to actual fixture-metal parts.
- Added the approved high-quality-only PCF shadow key with a 512 × 512 map,
  exactly six outer-glass casters, and the island top plus flask tile as its two
  receivers. Reduced graphics remains shadow-free.
- Kept measurement decals unlit and ordered above glass/liquid. High-quality
  liquids render after transmitted shells so engine-projected colors remain
  visible without hiding graduations.
- Applied the warm cream, near-black, teal, warning, error, focus, sizing,
  radius, shadow, and reduced-motion tokens to both lab route boundaries and
  their student-facing CSS modules.
- Added pure luminance-ratio coverage requiring at least 4:1 contrast between
  graduation ink and the burette/every projected flask liquid color.
- Preserved geometry, chemistry calculations, typed actions, Zustand semantics,
  and existing `data-*` test contracts.

### Files changed

- `src/components/lab/three/labPalette.ts`
- `src/components/lab/three/glassMaterials.tsx`
- `src/components/lab/three/ClassroomEnvironment.tsx`
- `src/components/lab/three/Burette.tsx`
- `src/components/lab/three/ErlenmeyerFlask.tsx`
- `src/components/lab/three/SkyDome.tsx`
- `src/components/lab/three/IndicatorShelf.tsx`
- `src/components/lab/three/WashStation.tsx`
- `src/components/lab/three/Interactable.tsx`
- `src/components/lab/three/LabScene.tsx`
- `src/components/lab/three/sceneProjection.ts`
- `src/app/lab/[experimentId]/page.module.css`
- `src/app/dev/lab/[experimentId]/page.module.css`
- `src/components/lab/LabNotebook.module.css`
- `src/components/lab/LabSessionBar.module.css`
- `src/components/lab/titration/TitrationWorkspace.module.css`
- `src/components/lab/titration/TitrationScene.module.css`
- `src/components/lab/titration/TitrationControls.module.css`
- `tests/components/labPalette.test.ts`
- `tests/components/sceneProjection.test.ts`
- `docs/Repo_Current_State.md`
- `docs/completion-reports/T0141_Apply_Palette_Materials_Lighting.md`

### Commands run

- Repository inspection with `rg`, `rg --files`, `sed`, and `git status`
- `npx prettier --write` on T0141 files and the updated projection test
- `npm test -- tests/components/labPalette.test.ts tests/components/sceneProjection.test.ts tests/components/erlenmeyerFlask.test.ts tests/components/benchLayout.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run build`
- `npm run test:e2e`
- `git diff --check`
- Local `npm run dev -- --hostname 127.0.0.1`
- One-off headless Chromium/SwiftShader visual capture for high and reduced
  graphics at burette, meniscus, and flask focus poses
- Source audits confirming no 3D hex literals outside `labPalette.ts` and no
  non-fixture use of nonzero metalness

### Build/test results

- Production build passed.
- Strict TypeScript passed.
- ESLint passed.
- Prettier and diff-whitespace checks passed.
- Full unit/component suite passed: 19 files, 129 tests.
- Full Playwright suite passed in Chromium: 17 tests.
- Browser verification captured zero application console errors or page errors.
  The existing upstream `THREE.Clock` deprecation warning remains visible in
  server-forwarded browser diagnostics.

### Manual verification performed

- Compared the implemented high and reduced tiers against the T0140 design
  system and the pre-pass scene. Both use the same geometry, liquid levels,
  semantic colors, and measurement locations.
- Checked overview, burette, meniscus, flask, and past-endpoint states in
  headless Chromium with software WebGL at 1600 × 1400.
- Confirmed that the wide burette pose shows the tube top and flask together in
  both tiers and that past-endpoint pink remains visible through high-tier
  transmitted glass.
- Confirmed burette ticks/numerals, the bottom-reading meniscus ring, and flask
  25/50/75/100 mL graduations remain legible in both tiers.
- Confirmed the student UI reads as warm cream surfaces with near-black text,
  teal actions/selection/focus, consistent 44 px controls, and reduced-motion
  transition suppression.
- Retained the T0140 SwiftShader result for the exact shadow scope: +2.1%
  median forced-frame interval and six additional draw calls. No physical
  Chromebook-class device was available for a hardware rerun.

### Risks / limitations

- The shadow rollback gate has only the documented relative SwiftShader result;
  it still needs validation on physical Chromebook-class hardware when one is
  available. Reduced graphics remains the shadow-free fallback.
- High-tier liquids intentionally render after transmitted glass to avoid the
  renderer sampling transparent liquid out of the shell. The liquid remains
  vessel-clipped, while decals and reading marks render later and stay legible.
- `THREE.Clock` emits an upstream deprecation warning during WebGL e2e runs;
  it is not an application console error and was not introduced by this ticket.
- No external visual reference image was supplied; conformance was checked
  against `docs/design-system.md`, the written ticket, and the rendered scene.

### Follow-up tickets suggested

- `T0142 — Procedural sound` remains the next optional ticket.
- Validate the high-tier shadow rollback threshold on physical
  Chromebook-class hardware when available.

### Docs needing update

- None after updating `docs/Repo_Current_State.md` and adding this completion
  report.
