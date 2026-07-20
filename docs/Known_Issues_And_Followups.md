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

## KI-004 — Checkpoint updates are idempotent but not monotonic

- Date: 2026-07-17
- Found during ticket: T0022
- Severity: high
- Area: persistence / checkpoint ordering and acknowledgements
- Description: Event insertion is protected by stable client event IDs and
  database uniqueness, but mutable session and skill rows currently use
  last-write-wins upserts. A delayed or out-of-order checkpoint could regress a
  skill estimate or clear `final_state`/`completed_at` because omitted completion
  fields are written as `null`. The Supabase repository also reports attempted
  event count as `acceptedEvents`, rather than the number actually inserted
  after conflict handling.
- Suggested follow-up ticket: add a monotonic checkpoint revision/sequence gate;
  preserve existing completion fields on partial checkpoints; reject or ignore
  stale skill/session updates; return accurate inserted/deduplicated event
  counts; and test duplicate, delayed, reordered, retry, and concurrent-tab
  delivery against the database constraint path.
- Do not fix until: the baseline checkpoint route and queue tickets are complete
  and a persistence-hardening ticket explicitly owns the migration, repository,
  and integration-test changes.
- Update (2026-07-20, Phase 5 native flip): the native `/lab/titration`
  practice route now checkpoints through the same lab-store queue and route as
  the strangler did, so its exposure to this issue is identical — idempotent
  event inserts, non-monotonic session/skill upserts. The flip does not widen
  the exposure; the native assignment route still performs no checkpoint
  writes at all (pre-existing gap, see titration-legacy-retirement.md).

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
- Update (2026-07-20, Phase 5 native flip): not mooted by the native default.
  The catalog card still reads `manifest.metadata.estimatedMinutes` (20), and
  the native workflow metadata (`native-full-titration.v2.json`) also says 20
  against the specified 8–12. When the legacy manifest is deleted (see
  titration-legacy-retirement.md) the fix moves to the native workflow
  metadata, which requires a deliberate hash re-pin.

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
  action and remaining-volume state, and emits unflagged semantic fill events.
  T0048 subsequently added positive bounded custom refills, independent current
  reading/availability/cumulative delivery, multi-fill replay/checkpoints, and
  refill-required configurations without changing chemistry formulas.
  Obsolete as of 2026-07-20: the Phase 5 native default runs fill/refill as
  registered burette mechanics in the generic runtime; the legacy engine's
  fill contract survives only on the `?runtime=legacy`/`setup-v2` rollback
  paths scheduled for deletion in titration-legacy-retirement.md.

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

- Physical screen-reader and lowest-tier Chromebook validation.
- Offline IndexedDB and monotonic checkpoint write hardening.
- Credentialed Supabase RLS/auth/reset integration tests.
- Live Realtime microphone and procedural-sound listening checks.
- Calorimetry only after the bounded Lab Composer titration path is stable.
- Teacher-authored rubrics and rich trend charts after MVP.
