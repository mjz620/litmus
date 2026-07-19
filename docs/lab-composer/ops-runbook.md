# Lab Composer Operations Runbook (LC2-803)

Operational procedures for immutable definition versions, assignment pins, and supported extension.

## Version retention

- `lab_definition_drafts` are mutable teacher-owned working copies. Edits always store `draft_unvalidated` and clear validation/Judge authority.
- `lab_definition_versions` are immutable. Update/delete are rejected by trigger. Retain every approved row referenced by any `assignments` or `sessions` pin.
- Do not garbage-collect a version while any assignment/session FK still points at it (`ON DELETE RESTRICT`).
- Recommended retention: keep all approved versions for the academic year plus one year; archive only after confirming zero live pins and exporting hashes to cold storage.

## Assignment pins

- New assignments store `lab_definition_version_id` + `lab_definition_canonical_hash` and denormalized `experiment_id` / `experiment_version`.
- Assign API reloads the immutable version and rechecks `evaluateLabWorkflowEligibilityV2(..., "assignment")` before insert.
- Idempotency key is unique per `(class_id, assign_idempotency_key)`.
- Students resolve sessions from the pin, never from the latest draft.

## Incident / rollback

1. **Bad approval shipped:** do not mutate the version row. Create a corrected draft, re-validate, approve a new version, and create a replacement assignment. Leave the old pin for in-flight sessions.
2. **Registry/adapter/model break historical replay:** fail closed (`session-definition.stale_implementation.v1`). Restore the required implementation version; never silently upgrade hashes.
3. **Need legacy student titration:** temporary `?runtime=legacy` escape hatch remains until LC2-804 fully removes dual entry. Precipitation remains on the static experiment path.
4. **DB rollback:** migrations `202607190001` and `202607190002` are additive. Rolling forward is preferred; if rolling back, drop only unused pin columns after confirming no production pins.

## Extension checklist (exact IDs required)

When adding equipment, actions, materials, models, conditions, or labs:

1. Register exact IDs in the owned registry modules; never invent IDs in prompts/UI/fixtures.
2. Bump registry snapshot IDs when entry semantics change.
3. Add valid, invalid, and safety-relevant validator tests.
4. Add at least one runnable seed/replay or five-trace case for runtime assembly changes.
5. Keep coach/evaluator positive “stay silent” coverage for new flags.
6. Update architecture / current-system-map / Repo_Current_State only for implemented reality.

## Performance notes

- Generic runtime compiles bindings once per session, not per frame.
- Checkpoints persist events, skill estimates, optional consumer context, and normalized action traces — not per-event full state snapshots.
- Chromebook-class protocol: see [`../project/Chromebook_Performance.md`](../project/Chromebook_Performance.md). Re-run `npm run profile:lab` after material visual changes; solution-preparation Preview reuses the shared setup-driven workspace budget.
