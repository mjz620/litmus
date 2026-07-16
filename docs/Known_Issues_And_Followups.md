# Known Issues and Followups

When Codex notices something outside the active ticket, it should record it here rather than fixing it automatically.

## Template

```md
## KI-000 — Title

- Date:
- Found during ticket:
- Severity: low | medium | high
- Area:
- Description:
- Suggested follow-up ticket:
- Do not fix until:
```

## Current issues

## KI-002 — Titration duration metadata conflicts with product specification

- Date: 2026-07-15
- Found during ticket: T0008
- Severity: low
- Area: experiment metadata / student catalog
- Description: `src/experiments/titration/manifest.ts` reports an estimated
  duration of 20 minutes, while `docs/reference_sections/6_student_experience.md`
  specifies 8–12 minutes for the titration card. T0008 displays the manifest as
  the registry source of truth and does not override it in UI code.
- Suggested follow-up ticket: correct the manifest duration when experiment
  metadata is next in scope.
- Do not fix until: a ticket permits edits to the T0006-owned titration manifest.

## Resolved issues

## KI-003 — Titration engine has no fill-burette action or state

- Date: 2026-07-15
- Found during ticket: T0009
- Severity: medium
- Area: experiment contract / titration procedure
- Description: T0009 and the product specifications require a burette fill
  control, but `TitrationAction` has no `fill_burette` action and
  `TitrationState` has no filled/available-volume state. The current engine
  implicitly permits addition immediately. The UI presents a disabled “Burette
  filled by default” status instead of creating local simulation state or
  emitting a semantically false event.
- Suggested follow-up ticket: add a deliberately reviewed typed fill action,
  engine state transition, semantic event, and truth tests before procedural
  completeness or 3D fill interactions are claimed.
- Do not fix until: a chemistry/experiment-core ticket explicitly authorizes the
  contract and engine change.
- Resolved: 2026-07-15. The project owner explicitly authorized the KI-003 plan.
  The engine now starts with an empty burette, exposes a typed `fill_burette`
  action and remaining-volume state, enforces single-fill capacity constraints,
  and emits an unflagged semantic fill event. The UI dispatches that action and
  renders engine-owned availability.

## KI-001 — Root README fails the global Prettier check

- Date: 2026-07-15
- Found during ticket: T0003
- Severity: low
- Area: documentation / formatting
- Description: A repository-root `README.md` appeared outside T0003 and is not
  formatted according to the current Prettier configuration. It was preserved
  unchanged, so `npm run format:check` reports that file even though all
  T0003-owned files pass targeted formatting validation.
- Suggested follow-up ticket: documentation hygiene pass when root documentation
  ownership is next addressed.
- Do not fix until: the project owner explicitly includes the root README in a
  documentation ticket or requests the formatting change.
- Resolved: 2026-07-15. The project owner moved documentation to the repository
  root and explicitly requested a documentation update; `README.md` was then
  formatted and updated to describe the committed/local-reference split.

## Future followups already expected

- More advanced accessibility alternatives for all 3D actions.
- Offline IndexedDB write queue hardening.
- Calorimetry plugin after core demo is stable.
- Teacher-authored rubrics after MVP.
- Rich trend charts after MVP.
