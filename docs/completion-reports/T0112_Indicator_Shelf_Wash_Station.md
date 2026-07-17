# T0112 — Indicator shelf, wash station, physical indicator selection

## Completion Report

### Summary

- Added `SHELF` and `WASH` spatial blocks plus focused camera poses to the
  shared bench layout.
- Added a raised indicator shelf with three stylized dropper bottles,
  indicator-specific cap colors, focused child hotspots, projected name chips,
  and a pulled-forward selected bottle.
- Added a wash station with a squeeze bottle, a legible CanvasTexture
  “Distilled water” label, titrant reagent bottle, funnel, and focused
  preparation hotspots.
- Wrapped both new stations in the existing `Interactable` selection and hover
  system without changing the sink set dressing.
- Added `useTitrationIntents` as the sole new dispatcher, translating scene
  gesture facts into the existing `select_indicator`, `rinse_burette`, and
  `fill_burette` actions.
- Kept scene components free of store or dispatch imports and left the
  chemistry engine, lab store, indicator dropdown, and HTML preparation
  controls unchanged.
- Added layout invariants, pure intent-mapping tests, and a permanent physical
  equipment e2e covering every indicator bottle, both rinse solvents, funnel
  fill, and a deterministic past-endpoint flask color.

### Files changed

- `src/components/lab/three/benchLayout.ts`
- `src/components/lab/three/IndicatorShelf.tsx`
- `src/components/lab/three/WashStation.tsx`
- `src/components/lab/three/LabScene.tsx`
- `src/components/lab/titration/TitrationScene.tsx`
- `src/components/lab/titration/useTitrationIntents.ts`
- `src/components/lab/titration/equipment.ts`
- `tests/components/benchLayout.test.ts`
- `tests/components/titrationIntents.test.ts`
- `tests/e2e/titration-physical-equipment.spec.ts`
- `docs/Repo_Current_State.md`
- `docs/completion-reports/T0112_Indicator_Shelf_Wash_Station.md`

### Commands run

- Repository guidance and source inspection with `rg`, `sed`, `find`, and
  `git status`
- Deterministic seed derivation with a local Node script
- `npx prettier --write ...` on T0112-owned files
- `npm test -- tests/components/titrationIntents.test.ts tests/components/benchLayout.test.ts`
- `npm run test:e2e -- tests/e2e/titration-physical-equipment.spec.ts`
- `npm run test:e2e -- tests/e2e/titration-physical-equipment.spec.ts tests/e2e/titration-equipment.spec.ts tests/e2e/titration-controls.spec.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run build`
- `npm run test:e2e`
- Local `npm run dev -- --hostname 127.0.0.1`
- Focused shelf and wash-station canvas screenshot inspection
- Scene-dispatch static scan and `git diff --check`

### Build/test results

- Production build passed.
- Strict TypeScript passed.
- ESLint passed.
- Prettier and diff-whitespace checks passed.
- Targeted layout and intent tests passed: 2 files, 27 tests.
- Full unit/component suite passed: 15 files, 93 tests.
- Targeted physical-equipment, unchanged equipment, and unchanged controls e2e
  specifications passed: 4 tests.
- Full Playwright suite passed in Chromium: 16 tests.
- Static scanning confirmed `IndicatorShelf`, `WashStation`, and `LabScene`
  import no lab store and call no dispatcher.
- The physical-equipment e2e recorded zero console errors or page errors.

### Manual verification performed

- Inspected focused canvas captures for both new stations in reduced graphics.
  The shelf frames all three bottles and projected names; the selected
  phenolphthalein bottle is pulled forward.
- Confirmed the wash bottle, titrant bottle, and funnel are visually distinct,
  the “Distilled water” decal is readable, and each projected chip sits on its
  matching object.
- Exercised all three physical indicator hotspots and confirmed the unchanged
  dropdown reflected each engine-backed selection.
- Exercised water rinse, titrant conditioning, and funnel fill from the focused
  wash station.
- Re-ran the unchanged equipment/controls browser paths to verify the dropdown
  and burette-focus HTML rinse/fill controls still work.
- Completed the deterministic `t0112-physical-3` titration past its 20.00 mL
  equivalence point and confirmed methyl orange changed the flask projection
  to yellow.

### Risks / limitations

- Projected hotspot chips are intentionally pointer-active visual targets while
  focused. They remain aria-hidden because the existing indicator dropdown and
  preparation buttons provide the keyboard/screen-reader interaction path.
- The new 3D material colors are local pending the centralized palette work in
  T0141.
- The distilled-water CanvasTexture is cached for the page lifetime; it is not
  recreated per render.
- The existing upstream Three/R3F `THREE.Clock` development warning remains
  unrelated to this ticket.

### Follow-up tickets suggested

- `T0120 — Burette stopcock junction rebuild`
- `T0141 — Apply palette, materials, and lighting`

### Docs needing update

- None after updating `docs/Repo_Current_State.md` and adding this completion
  report.
