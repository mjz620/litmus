# T0120 — Burette stopcock junction rebuild

## Completion Report

### Summary

- Re-derived the 0.090 m lower burette assembly into a 0.040 m tapered
  delivery tip, 0.032 m stopcock housing, and 0.018 m tube junction.
- Added explicit top/bottom Y coordinates and radii for every segment so the
  tip, housing, junction, and tube share exact boundaries without gaps or
  radius jumps.
- Rebuilt the lower Three.js meshes from those layout constants, including a
  glass housing around the horizontal barrel.
- Kept the PTFE handle stem and paddle as distinct meshes for the future T0131
  drag target.
- Preserved the delivery-tip clearance, tube coordinates, graduation span, and
  every `getBuretteLiquidTopY` result.
- Replaced the flat liquid ring with a shallow concave lathed meniscus. The
  mapped liquid height and eye-level camera identify its center-bottom reading
  point; the surface rises toward the glass wall so the upper edge is not the
  measurement reference.
- Expanded layout tests with exact boundary, radius, coordinate-preservation,
  barrel/housing, reservation-height, midpoint-projection, and meniscus-reading
  invariants.

### Files changed

- `src/components/lab/three/benchLayout.ts`
- `src/components/lab/three/Burette.tsx`
- `tests/components/benchLayout.test.ts`
- `docs/Repo_Current_State.md`
- `docs/completion-reports/T0120_Burette_Stopcock_Junction_Rebuild.md`

### Commands run

- Repository guidance and source inspection with `rg`, `sed`, and `git status`
- `npx prettier --write src/components/lab/three/benchLayout.ts src/components/lab/three/Burette.tsx tests/components/benchLayout.test.ts`
- `npm test -- tests/components/benchLayout.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run build`
- `npm run test:e2e`
- Temporary Playwright visual capture for overview, burette-focus, and
  meniscus-focus inspection; the temporary specification was removed
- `git diff --check`

### Build/test results

- Production build passed.
- Strict TypeScript passed.
- ESLint passed.
- Prettier and diff-whitespace checks passed.
- Targeted bench-layout suite passed: 1 file, 28 tests.
- Full unit/component suite passed: 15 files, 100 tests.
- Full Playwright suite passed in Chromium: 16 tests.
- Exact tests confirm:
  - delivery outlet remains at 1.170 m;
  - tube remains at 1.260–1.900 m;
  - graduations remain at 1.330–1.830 m over a 0.500 m span;
  - the 25 mL midpoint projection remains 1.580 m;
  - every adjacent lower segment shares both boundary Y and radius.

### Manual verification performed

- Filled the burette and inspected the full-bench overview: the lower assembly
  reads as one apparatus above the flask with no floating sections.
- Inspected the burette focus pose: the glass tube narrows through the junction
  into the stopcock housing and delivery tip without visible air gaps.
- Delivered 25 mL and inspected the eye-level meniscus pose: the selection
  guide intersects the center-bottom reading height while the concave liquid
  surface rises toward the tube wall.
- Confirmed the horizontal glass barrel passes through the housing and the
  light PTFE stem/paddle remain visually separate.
- Confirmed no temporary visual test file remains in the repository.

### Risks / limitations

- The concave meniscus is deliberately shallow and stylized for the narrow
  low-poly tube. The selected-meniscus guide remains the strongest visual cue,
  but it is positioned at the correct bottom reading reference.
- The existing burette focus pose is unchanged; the planned wider composition
  remains T0132 scope.
- Materials and colors remain unchanged except for applying the existing
  meniscus material to the new curved surface; palette centralization remains
  T0141 scope.
- The existing upstream Three/R3F `THREE.Clock` development warning remains
  unrelated to this ticket.

### Follow-up tickets suggested

- `T0121 — Flask refinement and graduations`
- `T0132 — Contextual prompts and wide burette pose`, including explicit
  bottom-of-meniscus reading guidance

### Docs needing update

- None after updating `docs/Repo_Current_State.md` and adding this completion
  report.
