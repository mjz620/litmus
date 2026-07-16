# T0011A — Student lab surface and debug-state separation

## Completion Report

### Summary

- Removed the production-facing "Initialized state summary" sidebar and every
  raw internal field it leaked from the student route: unknown analyte
  concentration, session seed, internal experiment ID, skills-tracked count,
  events-recorded count, and engine status labels.
- Extracted session initialization into a shared
  `src/components/lab/useLabSession.ts` hook so `/lab/[experimentId]` and the
  new `/dev/lab/[experimentId]` route provably use the same Zustand store,
  seeded configuration generator, engine definition, and typed action flow.
- Replaced the student sidebar with a lab notebook
  (`src/components/lab/LabNotebook.tsx`) containing only pedagogically
  appropriate information: objective, current procedure stage, known sample
  volume (concentration explicitly labeled unknown), standardized titrant
  concentration, selected indicator, student-recorded burette readings
  (reported values only, never `trueML`/`errorML`), and visible observations
  (solution color, measured pH). The live pH curve remains on the student page.
- Added a top session bar (`src/components/lab/LabSessionBar.tsx`) with
  experiment title, stage, save-status placeholder, and disabled Reset/Help/
  Report placeholder controls. No persistence, coach, report, or reset
  behavior was implemented.
- Added a pure display projection
  (`src/components/lab/titration/procedureStage.ts`) mapping engine state and
  recorded events to a student-facing stage label. It reads existing state
  fields only and owns no chemistry.
- Created the developer testing route `src/app/dev/lab/[experimentId]/` with a
  hard `notFound()` when `NODE_ENV === "production"`, an unmistakable
  "Developer testing route" banner, a link back to the corresponding student
  route (preserving `?seed=`), the same shared workspace/controls/curve, and a
  compact analytics panel: status, route and canonical experiment IDs, session
  ID, active seed, event count, latest raw event with flags, StudentModel
  skill estimates/evidence/flags, full generated configuration JSON, and raw
  engine state JSON. The detailed collapsible event inspector remains T0012.
- Removed the raw "Latest engine event" type/flags block from
  `TitrationControls`; raw event diagnostics now render only on the dev route.
- Both routes support the same explicit `?seed=<recorded-seed>` replay
  parameter. The dev route displays the active seed and generated
  configuration; the student route uses them without revealing them.

### Files changed

- `src/app/lab/[experimentId]/LabRouteShell.tsx` — student shell reworked; raw
  sidebar removed.
- `src/app/lab/[experimentId]/page.module.css` — dropped header/state-list
  styles now owned by components.
- `src/app/dev/lab/[experimentId]/page.tsx` — new dev-only server page
  (production 404).
- `src/app/dev/lab/[experimentId]/DevLabShell.tsx` — new developer analytics
  shell.
- `src/app/dev/lab/[experimentId]/page.module.css` — new dev route styles.
- `src/components/lab/useLabSession.ts` — new shared session hook.
- `src/components/lab/LabNotebook.tsx` + `LabNotebook.module.css` — new
  student notebook panel.
- `src/components/lab/LabSessionBar.tsx` + `LabSessionBar.module.css` — new
  session bar placeholder.
- `src/components/lab/titration/procedureStage.ts` — new pure stage
  projection.
- `src/components/lab/titration/TitrationControls.tsx` + `.module.css` — raw
  event feedback block removed.
- `tests/components/procedureStage.test.ts` — new unit tests.
- `tests/e2e/student-routes.spec.ts` — seed/replay assertions moved to the dev
  route; student assertions target the notebook; dev banner/back-link test
  added.
- `tests/e2e/student-surface.spec.ts` — new leak-regression tests across
  multiple randomized seeds and a shared-seed route-parity test.
- `tests/e2e/titration-controls.spec.ts` — updated for the notebook-based
  student surface.

### Commands run

- `npm run typecheck`
- `npm run lint`
- `npm run format:check` (after `npx prettier --write` on three new/changed files)
- `npm test`
- `npm run build`
- `npm run test:e2e`
- `npm run start` (production server) + `curl` status checks

### Build/test results

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run format:check` — passed.
- `npm test` — passed, 10 files, 47 tests.
- `npm run build` — passed; `/dev/lab/[experimentId]` compiled as a dynamic
  route.
- `npm run test:e2e` — passed, 11 tests in Chromium.

### Manual verification performed

- Production build served with `npm run start`: `/lab/titration` returned 200;
  `/dev/lab/titration` and `/dev/lab/titration?seed=replay-alpha` returned 404.
- E2E-driven flows (fresh and seeded sessions on both routes) confirmed: the
  student page shows no seed, unknown concentration, internal IDs, or counts;
  the dev route shows seed, configuration, raw state, skills, flags, and event
  count, and they update after actions (event count and StudentModel assertions
  exercised through the shared store in e2e flows).
- Full procedure exercised through e2e at desktop/Chromebook-class viewport
  (1280×720): rinse, fill, indicator selection, titrant addition, meniscus
  recording; notebook showed only student-appropriate values; browser console
  captured zero errors in every spec.
- All interactive elements remain native links/buttons/inputs in document
  order, preserving keyboard focus order; a human keyboard-only sweep at a
  physical Chromebook is still recommended (see risks).

### Risks / limitations

- The production 404 check is a manual/scripted step because the Playwright
  webServer runs `next dev`; there is no automated CI gate for it yet.
- Stage labels in `procedureStage.ts` are titration-specific display strings
  kept in the UI layer; other experiments will need their own projection when
  they gain a notebook.
- The leak regression asserts specific render formats (e.g. "M <analyte>"
  adjacency). A future redesign of how concentrations are rendered should
  extend these patterns.
- The "guest-" session-ID prefix is asserted absent from student text; if the
  session ID format changes, the assertion needs updating.

### Follow-up tickets suggested

- Add an automated production-build smoke check (build + start + 404 probe for
  `/dev/**`) to CI when a CI pipeline ticket exists.
- T0012 (event inspector) can now mount inside the dev route's analytics
  column as planned.

### Docs needing update

- `docs/Repo_Current_State.md` — updated in this run (structure, test counts,
  next recommended ticket).
