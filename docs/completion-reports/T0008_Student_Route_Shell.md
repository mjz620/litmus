# T0008 — Student Route Shell Completion Report

## Completion Report

### Summary

- Added a guest-accessible `/experiments` catalog sourced from registry
  manifests.
- Added a centralized route mapping between the readable `/lab/titration` slug
  and canonical `acid_base_titration` engine ID.
- Added `/lab/[experimentId]` validation with Next.js 404 behavior for unknown
  slugs.
- Added a client lab shell that initializes T0007's Zustand store and renders
  loading, error, and ready state summaries.
- Added responsive, keyboard-visible route/card styling without 3D, experiment
  controls, coach, authentication, or persistence behavior.
- Added Playwright coverage for catalog-to-lab navigation, initialized state, and
  invalid routes.

### Files changed

- `src/app/experiments/page.tsx`
- `src/app/experiments/page.module.css`
- `src/app/lab/[experimentId]/page.tsx`
- `src/app/lab/[experimentId]/LabRouteShell.tsx`
- `src/app/lab/[experimentId]/page.module.css`
- `src/components/ui/ExperimentCard.tsx`
- `src/components/ui/ExperimentCard.module.css`
- `src/components/ui/experimentRoutes.ts`
- `tests/e2e/student-routes.spec.ts`
- `docs/Repo_Current_State.md`
- `docs/Known_Issues_And_Followups.md`
- `docs/completion-reports/T0008_Student_Route_Shell.md`

### Commands run

- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run build`
- `npm run test:e2e`
- `rg` inspection for duplicated chemistry and forbidden dependencies

### Build/test results

- Production build passed and emitted static `/experiments` plus dynamic
  `/lab/[experimentId]` routes.
- Strict TypeScript, ESLint, and Prettier checks passed.
- Unit suite passed: 6 files, 29 tests.
- Playwright passed: 3 tests, including the new student routes and 404 path.

### Manual verification performed

- Opened `/experiments` as a guest and confirmed the registry-backed titration
  card renders without authentication.
- Followed “Start practice” to `/lab/titration` and confirmed the shell reaches
  Ready with `0.00 mL`, four skills, and zero events.
- Confirmed browser console and page errors remain empty on the catalog/lab path.
- Opened `/lab/not-a-real-experiment` and confirmed HTTP 404 plus the Next.js
  not-found surface.
- Inspected route code and confirmed it does not implement chemistry formulas,
  coach behavior, database access, or full 3D controls.

### Risks / limitations

- The initial practice config is imported from the established titration module
  on the server because registry metadata does not yet expose default configs.
- The placeholder bench is intentionally non-interactive; precise 2D controls are
  T0009 work and 3D is later work.
- Titration manifest duration currently says 20 minutes while the product card
  specification says 8–12 minutes; recorded as KI-002 rather than changing the
  T0006-owned manifest in this ticket.

### Follow-up tickets suggested

- `T0009 — 2D titration controls`
- Resolve KI-002 when experiment metadata is next in scope.

### Docs needing update

- None after updating repo state, recording KI-002, and adding this report.
