# T0111 — Selection state to labUiStore

## Completion Report

### Summary

- Moved equipment focus and hover ownership from component-local React state
  and scene props into the existing `labUiStore.focused` and `.hovered` fields.
- Updated TitrationWorkspace to derive contextual controls and labels directly
  from shared focus state.
- Updated TitrationScene to read/write shared focus and hover state for the
  equipment bar, 3D interactions, camera pose, instructions, cursor state, and
  `data-selected-equipment`.
- Removed TitrationScene's selection props and local hover state without
  changing visible interaction semantics.
- Added workspace unmount cleanup so focus, hover, and look mode do not leak
  through the global store across route changes.
- Enforced Escape precedence in the workspace: release look mode first, then
  clear equipment focus when look mode is inactive. The existing capture-phase
  camera handler preserves the same ordering for active canvas look mode.
- Added focused store coverage for setters and `clearFocus` isolation.

### Files changed

- `src/components/lab/titration/TitrationWorkspace.tsx`
- `src/components/lab/titration/TitrationScene.tsx`
- `src/stores/labUiStore.ts`
- `tests/components/labUiStore.test.ts`
- `docs/Repo_Current_State.md`
- `docs/completion-reports/T0111_Selection_State_LabUiStore.md`

### Commands run

- Repository guidance and source inspection with `rg`, `sed`, and `git status`
- `npx prettier --write ...` on T0111-owned files
- `npm test -- tests/components/labUiStore.test.ts tests/components/equipment.test.ts`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run build`
- `npm run test:e2e -- tests/e2e/titration-equipment.spec.ts tests/e2e/titration-camera.spec.ts`
- `npm run test:e2e`
- Local `npm run dev -- --hostname 127.0.0.1`
- Headless Chromium button, 3D-selection, Back, and Escape verification
- `git diff --check`

### Build/test results

- Production build passed.
- Strict TypeScript passed.
- ESLint passed.
- Prettier and diff-whitespace checks passed.
- New lab UI store tests passed: 1 file, 2 tests.
- Targeted store/equipment tests passed: 2 files, 11 tests.
- Full unit/component suite passed: 14 files, 85 tests.
- The unchanged equipment and camera e2e specifications passed: 4 tests.
- Full Playwright suite passed in Chromium: 15 tests.
- `titration-equipment.spec.ts` passed without modification.

### Manual verification performed

- Selected and exited all five equipment entries through the HTML buttons,
  confirming `data-selected-equipment` reported `burette`, `flask`,
  `meniscus`, `indicatorShelf`, and `washStation` with unchanged semantics.
- Selected and exited the three currently modeled interactables—burette,
  meniscus, and flask—through direct 3D clicks.
- Used the Back button after each selection and confirmed focus returned to
  `none`.
- Focused the burette, pressed Escape, and confirmed shared focus cleared.
- Activated look mode from an empty canvas area, pressed Escape, and confirmed
  look mode released while equipment focus remained clear.
- The browser pass captured zero console errors or page errors.

### Risks / limitations

- A normal UI path prevents equipment focus and look mode from remaining active
  simultaneously: focusing equipment releases look mode, and focused views do
  not activate look mode. Escape precedence is nevertheless explicit in both
  the workspace and active-look capture handler.
- `clearFocus` intentionally changes only `focused`; hover and look state retain
  their independent semantics and have unit coverage.
- Indicator shelf and Wash station still have no physical 3D click targets;
  their geometry and focused camera poses remain T0112 scope.
- The existing upstream Three/R3F `THREE.Clock` development warning remains
  unrelated to this ticket.

### Follow-up tickets suggested

- `T0112 — Indicator shelf, wash station, physical indicator selection`
- `T0130 — Dispense gesture reducer and hold-to-dispense control`

### Docs needing update

- None after updating `docs/Repo_Current_State.md` and adding this completion
  report.
