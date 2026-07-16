# Repo Current State

This file is living shared memory for ChatGPT, Codex, and the human project owner. Update it after every completed ticket.

## Current branch

- `main` (Git initialized; no commits yet).

## Completed tickets

- `T0001 — Project skeleton`
  - Completion report: `docs/completion-reports/T0001_Project_Skeleton.md`
- `T0002 — Install repo docs`
  - Completed manually after the earlier skip decision: `AGENTS.md`,
    `tickets.md`, `README.md`, and `docs/**` now live at the repository root.
  - Completion report:
    `docs/completion-reports/T0002_Install_Repo_Docs.md`.
  - The earlier skip record is retained as superseded decision history:
    `docs/completion-reports/T0002_Skipped.md`.
- `T0003 — Experiment contract scaffold`
  - Completion report:
    `docs/completion-reports/T0003_Experiment_Contract_Scaffold.md`
- `T0004 — Titration engine import`
  - Completion report:
    `docs/completion-reports/T0004_Titration_Engine_Import.md`
- `T0005 — Display formatting helpers`
  - Completion report:
    `docs/completion-reports/T0005_Display_Formatting_Helpers.md`
- `T0006 — Experiment registry`
  - Completion report:
    `docs/completion-reports/T0006_Experiment_Registry.md`
- `T0007 — Lab store scaffold`
  - Completion report:
    `docs/completion-reports/T0007_Lab_Store_Scaffold.md`
- `T0008 — Student route shell`
  - Completion report:
    `docs/completion-reports/T0008_Student_Route_Shell.md`
- `T0009 — 2D titration controls`
  - Completion report:
    `docs/completion-reports/T0009_2D_Titration_Controls.md`
- `T0010 — pH curve component`
  - Completion report:
    `docs/completion-reports/T0010_PH_Curve_Component.md`
- `T0011 — Low-poly 3D lab shell`
  - Completion report:
    `docs/completion-reports/T0011_Low_Poly_3D_Lab_Shell.md`
- `KI-003 — Deterministic burette fill support`
  - Completion report:
    `docs/completion-reports/KI003_Burette_Fill_Support.md`
- `T0047 — Seeded randomized titration session configurations`
  - Completion report:
    `docs/completion-reports/T0047_Randomized_Titration_Configs.md`
- `T0011A — Student lab surface and debug-state separation`
  - Completion report:
    `docs/completion-reports/T0011A_Student_Debug_Surface_Separation.md`

## Current folder structure

Current application and test structure:

```text
src/
  app/
    dev/
      lab/
        [experimentId]/
          DevLabShell.tsx
          page.module.css
          page.tsx
    experiments/
      page.module.css
      page.tsx
    globals.css
    lab/
      [experimentId]/
        LabRouteShell.tsx
        page.module.css
        page.tsx
    layout.tsx
    page.tsx
  components/
    lab/
      LabNotebook.module.css
      LabNotebook.tsx
      LabSessionBar.module.css
      LabSessionBar.tsx
      PHCurve.tsx
      useLabSession.ts
      three/
        Burette.tsx
        ErlenmeyerFlask.tsx
        LabBench.tsx
        LabScene.tsx
        sceneProjection.ts
      titration/
        procedureStage.ts
        TitrationControls.module.css
        TitrationControls.tsx
        TitrationScene.module.css
        TitrationScene.tsx
    ui/
      ExperimentCard.module.css
      ExperimentCard.tsx
      experimentRoutes.ts
  experiments/
    registry.ts
    shared/
      experiment.ts
      index.ts
    titration/
      display.ts
      manifest.ts
      sessionConfig.ts
      titration.ts
  stores/
    labStore.ts
  types/
    index.ts
tests/
  components/
    PHCurve.test.ts
    procedureStage.test.ts
    sceneProjection.test.ts
  e2e/
    home.spec.ts
    student-routes.spec.ts
    student-surface.spec.ts
    titration-controls.spec.ts
  experiments/
    experiment.test.ts
    registry.test.ts
    titration-session-config.test.ts
    titration-display.test.ts
    titration.test.ts
  stores/
    labStore.test.ts
  unit/
    skeleton.test.ts
```

The future persistence folder `supabase/` has not been created yet.

## Workflow path convention

- Repository-owned paths in `tickets.md` are now used as written. This includes
  `AGENTS.md`, `tickets.md`, `README.md`, `docs/**`, `src/**`, and `tests/**`.
- `labbench_codex_workflow_pack/` remains available locally only as a reference
  bundle and is excluded by `.gitignore`; it is not a committed source-of-truth
  location.
- Resources that were not moved to the root, notably `source-contracts/**`, may
  still be read from the ignored workflow pack when a ticket explicitly calls
  for them. Production implementation always belongs in the repository-root
  paths specified by the ticket.

## Installed dependencies

- `next@16.2.10`
- `react@19.2.7`
- `react-dom@19.2.7`
- `typescript@5.9.3`
- `eslint@9.39.2`
- `eslint-config-next@16.2.10`
- `prettier@3.8.2`
- `vitest@4.1.10`
- `@playwright/test@1.58.2`
- `@react-three/drei@10.7.7`
- `@react-three/fiber@9.6.1`
- `three@0.185.1`
- `zustand@5.0.14`
- React and Node TypeScript declarations
- `postcss@8.5.10` enforced as a security override

## Available scripts

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test"
}
```

## Build/test status

- `npm run build` — passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run format:check` — passed; canonical workflow/specification documents are
  excluded from automatic rewriting and retain their source formatting.
- `npm test` — passed, 10 files and 47 tests.
- `npm run test:e2e` — passed in Chromium, 11 tests.
- `npm audit` — 0 vulnerabilities.

## Known issues

- See `docs/Known_Issues_And_Followups.md`.

## Next recommended ticket

- `T0011B — Detailed interactive high-school chemistry lab`.

## Notes for next Codex run

- Read root `AGENTS.md` and `tickets.md`; these are the committed sources of
  truth.
- Treat T0002 as completed manually. Its prior skip record is superseded history.
- Use `labbench_codex_workflow_pack/` only for local reference material that has
  no root counterpart, such as the established source contracts.
- Apply the workflow path convention above when reading ticket paths.
- KI-003 is resolved with a single pre-run burette fill and deterministic
  remaining-volume state. Mid-run refills remain out of scope.
- T0047 creates a fresh client-side session seed, generates a deterministic valid
  analyte/titrant configuration locally, stores the seed with engine state, and
  supports replay through `/lab/titration?seed=<recorded-seed>`.
- T0048 remains blocked until both T0023 and T0033 are complete. Do not add
  refills or configurations requiring more than one burette fill early.
- T0011 adds a low-poly R3F bench using primitive geometry, a demand-driven
  render loop, capped device-pixel ratio, constrained orbit controls, and no
  physics, models, textures, shadows, or post-processing.
- The 3D burette level projects `state.buretteAvailableML`; flask color projects
  the latest engine-emitted `observedColor`. The scene does not compute pH or
  own experiment actions.
- Headless Chromium uses its software WebGL renderer in Playwright so the scene
  is exercised in browser tests.
- T0011A is complete. `/lab/[experimentId]` is strictly student-facing (lab
  notebook, session bar, no seeds/IDs/counts/unknown concentration), while
  `/dev/lab/[experimentId]` carries the internal diagnostics, returns 404 in
  production builds, and shares the same `useLabSession` hook, store, and
  engine flow. Leak-regression and shared-seed parity e2e tests guard the
  separation.
- Implement `T0011B` next. Replace the placeholder scene
  with the owner-directed high-school chemistry lab environment, correct
  burette/flask intersections, add fine equipment details and selective
  physically based photorealism for the glassware, and connect selectable 3D
  equipment to contextual precision controls.
- T0012 now depends on T0011A/T0011B and must keep raw events, StudentModel,
  seeds, and engine state inside an inspector mounted only on the dev testing
  route.
- Produce completion report.
