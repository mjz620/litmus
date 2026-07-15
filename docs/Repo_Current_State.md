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

## Current folder structure

Current application and test structure:

```text
src/
  app/
    globals.css
    layout.tsx
    page.tsx
  experiments/
    shared/
      experiment.ts
      index.ts
  types/
    index.ts
tests/
  e2e/
    home.spec.ts
  experiments/
    experiment.test.ts
  unit/
    skeleton.test.ts
```

Future-ticket folders such as `components`, `stores`, and `supabase` have not
been created yet.

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
- `npm test` — passed, 2 files and 6 tests.
- `npm run test:e2e` — passed in Chromium, 1 test.
- `npm audit` — 0 vulnerabilities.

## Known issues

- See `docs/Known_Issues_And_Followups.md`.

## Next recommended ticket

- `T0004 — Titration engine import`.

## Notes for next Codex run

- Read root `AGENTS.md` and `tickets.md`; these are the committed sources of
  truth.
- Treat T0002 as completed manually. Its prior skip record is superseded history.
- Use `labbench_codex_workflow_pack/` only for local reference material that has
  no root counterpart, such as the established source contracts.
- Apply the workflow path convention above when reading ticket paths.
- Implement only `T0004` next.
- Port the established titration engine from
  `labbench_codex_workflow_pack/source-contracts/` without weakening the shared
  contract or chemistry invariants.
- Produce completion report.
