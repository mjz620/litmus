# T0002 — Install Repo Docs Superseded Skip Record

> **Superseded on 2026-07-15:** The project owner subsequently moved
> `AGENTS.md`, `tickets.md`, `README.md`, and `docs/**` to the repository root.
> T0002 is now treated as manually completed. This file remains only as decision
> history.

## Decision

`T0002 — Install repo docs` was initially skipped at the project owner's
direction on 2026-07-15. That decision was later superseded the same day by the
root documentation layout described above.

## Reason

At the time of the initial decision, the complete workflow pack was present at
`labbench_codex_workflow_pack/`, so copying it appeared unnecessary. The project
owner later chose to commit the workflow law, backlog, and documentation with the
main repository while retaining the rest of the pack as ignored reference data.

## Current outcome

T0002 is now treated as **manually completed**, not skipped. `AGENTS.md`,
`tickets.md`, `README.md`, and `docs/**` live at the repository root and are
eligible to be committed with the application.

Future agents should read `AGENTS.md`, `tickets.md`, `README.md`, and `docs/**`
from the repository root. The ignored workflow pack is local reference material,
not the committed documentation source. Resources that remain only in the pack,
including the established `source-contracts/**`, may still be consulted when a
ticket explicitly calls for them.

## Verification

- Confirmed root `AGENTS.md` is present.
- Confirmed root `tickets.md` is present.
- Confirmed root `README.md` is present.
- Confirmed root `docs/` is present.
- Confirmed `labbench_codex_workflow_pack/source-contracts/` is present.
- Confirmed `labbench_codex_workflow_pack/assets/` is present.
- Confirmed `.gitignore` excludes `labbench_codex_workflow_pack/`.

## Next ticket

- `T0004 — Titration engine import`
