# T0110 — Interactable wrapper, hover labels, equipment extension

## Completion Report

### Summary

- Extended `EquipmentId`, `EQUIPMENT`, and `EQUIPMENT_IDS` with `indicatorShelf`
  and `washStation`, preserving the three existing entries and names.
- Mapped Indicator shelf to the indicator control group and Wash station to the
  preparation control group without changing `getVisibleControlGroups`.
- Added a reusable `Interactable` wrapper with stop-propagating pointer
  handlers, demand-loop scale easing from 1.0 to 1.04, an emissive translucent
  highlight shell, and an aria-hidden Drei HTML label chip.
- Preserved the existing hover callback path so pointer hover and equipment-bar
  keyboard focus drive the same cursor, label, shell, and pulse affordances.
- Replaced LabScene's ad-hoc equipment handlers with `Interactable` instances
  for the burette, flask, and meniscus while retaining the selected-meniscus
  reading ring.
- Extended the existing equipment unit tests additively for stable ordering,
  unchanged original names, and the two new control mappings.

### Files changed

- `src/components/lab/titration/equipment.ts`
- `src/components/lab/three/Interactable.tsx`
- `src/components/lab/three/LabScene.tsx`
- `tests/components/equipment.test.ts`
- `docs/Repo_Current_State.md`
- `docs/completion-reports/T0110_Interactable_Hover_Equipment_Extension.md`

### Commands run

- Repository guidance and source inspection with `rg`, `sed`, `find`, and
  `git status`
- `npx prettier --write ...` on T0110-owned files
- `npm test -- tests/components/equipment.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run build`
- `npm run test:e2e -- tests/e2e/titration-equipment.spec.ts`
- `npm run test:e2e`
- Local `npm run dev -- --hostname 127.0.0.1`
- Headless Chromium button/focus/hover/highlight verification
- `git diff --check`

### Build/test results

- Production build passed.
- Strict TypeScript passed.
- ESLint passed after removing redundant direct mutation of the renderer's
  canvas cursor; cursor state remains driven by the existing hover callback and
  scene-frame CSS.
- Prettier and diff-whitespace checks passed.
- Extended equipment tests passed: 1 file, 9 tests.
- Full unit/component suite passed: 13 files, 83 tests.
- The unchanged equipment e2e specification passed: 2 tests.
- Full Playwright suite passed in Chromium: 15 tests.

### Manual verification performed

- Confirmed the equipment bar contains exactly five buttons in order:
  Burette, Flask & indicator, Meniscus, Indicator shelf, and Wash station.
- Keyboard-focused Burette, Flask & indicator, and Meniscus individually and
  confirmed each produced the matching Drei label plus a changed canvas image
  from the highlight shell/pulse.
- Scanned the rendered canvas with pointer movement and confirmed direct 3D
  hover displayed the matching label chip for Burette, Flask & indicator, and
  Meniscus individually.
- Keyboard-focused Indicator shelf and Wash station and confirmed their names
  and purposes appeared in the scene instructions.
- The browser pass captured zero console errors or page errors.
- The unchanged equipment e2e exercised selection, contextual controls, typed
  engine actions, meniscus reading, Escape restoration, and reduced graphics.

### Risks / limitations

- Indicator shelf and Wash station have registry buttons and contextual control
  mappings only. Their physical geometry, camera poses, and child hotspots are
  intentionally deferred to T0112.
- `Burette` and `ErlenmeyerFlask` retain their older optional highlight props
  because those files are outside T0110's allowed edit list; LabScene no longer
  passes those props, so duplicate shells are not rendered.
- The HTML hover-chip styling is local to `Interactable`; T0141 remains the
  planned ticket for centralized 3D palette and material tokens.
- The existing upstream Three/R3F `THREE.Clock` development warning remains
  unrelated to this ticket.

### Follow-up tickets suggested

- `T0111 — Selection state to labUiStore`
- `T0112 — Indicator shelf, wash station, physical indicator selection`

### Docs needing update

- None after updating `docs/Repo_Current_State.md` and adding this completion
  report.
