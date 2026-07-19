# Phase 8 — Persistence, Assignment, Hardening, and Cleanup

Persistence work is additive and must preserve old static assignments, sessions, checkpoints, and historical replay. No approved definition is mutable.

## Status

| Ticket | Status |
| --- | --- |
| `LC2-800` | Complete |
| `LC2-801` | Complete |
| `LC2-802` | Complete |
| `LC2-803` | Complete |
| `LC2-804` | Complete — see [`../legacy-retirement-inventory.md`](../legacy-retirement-inventory.md) |
| `LC2-805` | Complete — `/assignments/[assignmentId]` + class start links |
| `LC2-806` | Ready residual — physical Chromebook pass still required |
| `LC2-807` | Complete — Author v1 route returns 410 Gone |
| `LC2-808` | Blocked — remove `?runtime=legacy` after `LC2-806` physical sign-off |

## LC2-800 — Immutable definition versions and draft persistence

**Objective:** Add RLS-protected persistence for mutable teacher drafts and immutable approved validated definition versions with exact provenance.

**Dependencies:** `LC2-408`; ideally after schemas stabilize through Phase 7.

**Read first:** current Supabase migrations/RLS, persistence repositories, checkpoint API/idempotency, class/assignment schema, migration section of the playbook.

**Allowed areas:** `supabase/**`, `src/lib/supabase/**`, `src/lib/persistence/**`, dedicated Composer draft/version APIs, DB/API tests/docs.

**Do not touch:** chemistry/runtime/validator logic, agent prompts, student UI beyond typed client contracts, existing row deletion.

**Required changes:**

1. Add additive tables/columns for teacher-owned drafts and immutable definition versions, final naming justified against current schema.
2. Store strict schema version/spec, canonical hash, validation artifact, registry/model/adapter/migration versions, support status, creator/approver/timestamps, and optional advisory critique provenance.
3. Server re-parses and revalidates; never trusts client validation fields.
4. Editing updates/creates only unvalidated drafts and invalidates artifacts.
5. Approval creates an immutable version after current eligibility and explicit teacher action.
6. Enforce unique/idempotency keys and immutable constraints/triggers or repository rules.
7. Add RLS for owner/class roles; service-role remains server-only; demo isolation explicit.

**Tests/manual:** migration; strict invalid/stale/non-runnable rejection; edit invalidation; immutable approved row; idempotent approval; cross-teacher/student denial; old rows unaffected; rollback review; local DB queries redacted; no secret client bundle.

**Acceptance:** Exact validated definitions can be stored immutably only after explicit approval; persistence cannot confer runnability independently.

**Stop:** Do not attach assignments or delete legacy fields yet.

## LC2-801 — Assignment/session pins and historical replay resolution

**Objective:** Assign exact approved versions, pin sessions/runtime provenance, and resolve both v2 and legacy historical replay.

**Dependencies:** `LC2-800`.

**Allowed areas:** assignment/session persistence/API/teacher UI integration, replay version resolver, DB/API/e2e tests/docs.

**Do not touch:** chemistry formulas, validator semantics, agent/Judge authority, legacy record deletion.

**Required changes:**

1. Add exact immutable definition-version/hash reference to new assignments and sessions while retaining old experiment/version fields.
2. Require explicit authenticated teacher approval/assignment and server-side current immutable eligibility recheck.
3. Make assign calls idempotent and class-authorized.
4. Resolve session initialization from the pinned version, registry/model/adapter versions, never current latest draft.
5. Persist normalized trace/event envelope/checkpoint provenance compactly.
6. Route old static assignments/sessions through explicit legacy resolver and retain required adapters.
7. Make historical replay fail explicitly if a required implementation version is unavailable; never silently upgrade.

**Tests/manual:** valid assignment/session; duplicate; stale/non-runnable/unapproved; unauthorized; old assignment/session; exact version after newer edit; historical replay; checkpoint idempotency; demo/guest isolation; teacher approval UI; RLS.

**Acceptance:** Students always run the exact approved definition assigned, and old sessions remain readable/replayable.

**Stop:** Do not drop static experiment/version columns or legacy adapters.

## LC2-802 — End-to-end production flow and compatibility release gate

**Objective:** Validate the complete teacher/agent/validation/Judge/approval/assignment/student/coach/evaluator/analytics flow for both labs through production paths.

**Dependencies:** `LC2-700`, `LC2-702`, `LC2-703`, `LC2-801`.

**Allowed areas:** integration/e2e/eval fixtures, narrow bug fixes inside owned systems, demo/technical inspection, docs/runbooks.

**Do not touch:** broad redesign, new chemistry/lab, legacy deletion, weakening tests/gates.

**Required scenarios:**

1. Human-authored titration save/validate/preview/approve/assign/run/report.
2. Human-authored dilution same path.
3. Agent-authored supported draft with assumptions/traces/Judge/teacher edit/revalidation/approval.
4. Unsupported and safety-rejected request remains non-runnable.
5. Alternate valid order receives correct coach/evaluator treatment.
6. Recoverable and terminal mistakes produce correct diagnoses/coaching/evaluation.
7. Stale edit/hash/critique/assignment attempts fail closed.
8. Model/network failure uses deterministic fallback and simulation continues.
9. Old static assignment/session/demo still works.
10. Technical inspector shows exact hashes, versions, events, diagnoses, traces, and authority separation.

**Tests/manual:** full unit/type/lint/build; targeted DB/RLS; Playwright common viewports/keyboard; offline-after-load; performance; deterministic trace suite repeated; no console errors; screenshot comparison; demo isolation.

**Acceptance:** All epic completion criteria are evidenced except legacy cleanup, which remains gated.

**Stop:** Bugs requiring architecture expansion become focused tickets; do not hide failures with mocks or skip assertions.

## LC2-803 — Chromebook performance, storage, operations, and extension documentation

**Objective:** Harden generic runtime/scene/event storage/agent limits and document supported extension procedure before legacy removal.

**Dependencies:** `LC2-802`.

**Allowed areas:** profiling/performance fixes, bounded schema/event storage improvements, scripts/runbooks/extension docs/tests.

**Do not touch:** chemistry semantics, new features/labs, legacy deletion, unmeasured rewrites.

**Required changes:**

1. Profile both labs on representative Chromebook-class settings and current desktop viewports.
2. Verify rule/model compilation is session-initialized, not per frame/action unnecessarily.
3. Bound event/diagnosis/trace/checkpoint storage and confirm no per-event full state snapshots.
4. Verify lazy visual loading and interaction frame budget.
5. Verify agent/Judge rate/token/time/cost limits and failure observability.
6. Publish operational runbook, version-retention policy, incident/rollback procedure, and exact extension guide for equipment/action/material/model/condition/lab additions.
7. Update all architecture/schema/registry/agent/evaluator/persistence/demo docs to implemented reality.

**Tests/manual:** profiler/benchmark scripts; storage growth; long session; reload/replay; slow device/reduced graphics; offline/network failures; accessibility; runbook drill; full gates.

**Acceptance:** Performance and operational evidence is recorded, extension steps enforce exact IDs/tests, and docs no longer overclaim support.

**Stop:** Do not optimize by reducing scientific precision, skipping validation, dropping evidence, or hiding unsupported adapters.

## LC2-804 — Legacy path removal after parity and retention proof

**Objective:** Remove only obsolete fixed-family Composer/student runtime paths whose replacement parity, persistence migration, historical replay, and rollback evidence is complete.

**Dependencies:** `LC2-803` and explicit repository-owner approval.

**Allowed areas:** legacy runtime/UI routing cleanup, compatibility flag removal, obsolete docs/tests replaced by equivalent coverage.

**Do not touch:** historical adapter versions still referenced by saved sessions, chemistry semantics, unrelated static precipitation path unless separately migrated and authorized.

**Required changes:**

1. Produce a dependency/reference inventory for every proposed deletion.
2. Confirm legacy removal checklist in [`../migration-playbook.md`](../migration-playbook.md).
3. Retain v1 schema/hash/migration and any adapter needed for old definitions/sessions.
4. Remove dead feature flags/duplicate route/store/scene code only after production path tests cover behavior.
5. Update status/docs/tickets and rollback/version-retention runbook.
6. Obtain explicit teacher/student manual verification evidence and owner approval recorded in completion report.

**Tests/manual:** all old fixture parsing/replay; new production e2e; old URLs/assignments/session playback; full gates; no family dispatch in remaining generic path; bundle/dependency check; rollback drill.

**Acceptance:** The active product uses one capability-driven setup/runtime path for supported labs while historical records remain reproducible. No behavior is removed merely because it is “legacy.”

**Stop:** If any saved version or production/demo route still requires the code, retain it and document the blocker.

---

## Phase 8 follow-up tickets

These close remaining seams documented in [`../legacy-retirement-inventory.md`](../legacy-retirement-inventory.md) and the `LC2-801`–`804` completion report. They are independently reviewable; do not reopen Phase 8 gates already marked complete.

## LC2-805 — Student assignment entry loads the pinned definition

**Objective:** Let a student open a class assignment and initialize a session from the exact pinned `lab_definition_version_id` / hash, never from the latest draft or an unpinned seed when a pin exists.

**Dependencies:** `LC2-801`.

**Allowed areas:** teacher roster/class assignment list UI, student assignment entry route, session init / `useLabSession` / lab store wiring to `resolveSessionDefinition`, checkpoint pin fields, API/e2e tests/docs.

**Do not touch:** validator semantics, chemistry engines, Composer authoring commands, precipitation migration.

**Required changes:**

1. Surface class assignments (title, due date, pinned hash short form) on teacher class and student-facing entry points.
2. Student start URL/action creates or resumes a session with the assignment pin copied onto the session row.
3. Session init calls `resolveSessionDefinition`; on `pinned_v2`, pass the exact validated spec into setup-driven assembly; on `legacy_static`, keep the existing static experiment path.
4. Fail closed with an accessible error when the pin is missing, hash-mismatched, or implementation-stale.
5. Checkpoint writes continue to persist `labDefinitionVersionId` + canonical hash for pinned sessions.

**Tests/manual:** pinned titration and solution-prep assignment start; edited draft after assign does not change student session; unauthorized class denied; null-pin legacy assignment still loads; e2e student path.

**Acceptance:** Assigned students always run the approved definition that was pinned at assign time.

**Stop:** Do not invent a second IR or bypass hard validation.

## LC2-806 — Physical Chromebook and dual-lab performance sign-off

**Objective:** Re-measure setup-driven titration and solution-preparation Preview/student paths on Chromebook-class hardware (or the documented constrained protocol) and record pass/fail against existing budgets.

**Dependencies:** `LC2-803`, `LC2-805` preferred for assignment-path coverage but not required for seed/demo profiling.

**Allowed areas:** `docs/project/Chromebook_Performance.md`, profile scripts, narrow perf fixes inside owned lab/Composer UI, ops runbook cross-links.

**Do not touch:** chemistry precision, evidence semantics, unrelated refactors.

**Required changes:**

1. Run `npm run profile:lab` (and extend if needed) against default `/lab/titration` and solution-prep Preview/student entry.
2. Record FPS, slow-frame %, heap, and qualitative input latency; note reduced-graphics path.
3. Confirm compile-once runtime and no per-event full-state checkpoint growth under a long session.
4. Update Chromebook and ops docs with dated results and any residual limits.

**Tests/manual:** profile script gate; long-session smoke; reduced graphics; offline-after-load coach/evaluator fallback still usable.

**Acceptance:** Both supported labs have dated Chromebook-class evidence; no undocumented perf regression vs the prior titration median.

**Stop:** Do not “optimize” by dropping validation, evidence, or scientific fidelity.

## LC2-807 — Retire Author Agent v1 family route

**Objective:** Remove the frozen family-oriented `/api/lab-composer/author` prototype once the capability-author route is the sole production authoring agent path and zero required callers remain.

**Dependencies:** `LC2-602`, `LC2-804` inventory.

**Allowed areas:** `src/app/api/lab-composer/author/route.ts` and exclusively v1-family tests/docs/fixtures; redirect or 410 for the old path if needed.

**Do not touch:** capability author route (`author/capability`), shared domain commands, registries.

**Required changes:**

1. Inventory all imports, e2e, demo, and docs references to the v1 family author route.
2. Prove capability-author covers every required production/demo authoring entry.
3. Delete or hard-fail the v1 route; replace tests with capability-author equivalents where behavior must remain covered.
4. Update architecture/system-map/docs so they no longer describe the family route as a live path.

**Tests/manual:** capability-author route/e2e green; grep shows no production caller of the deleted path; bundle/dependency check.

**Acceptance:** Only the capability-author agent surface remains for Composer AI authoring.

**Stop:** If any required demo, eval, or teacher path still calls v1, retain it and document the blocker.

## LC2-808 — Remove titration `?runtime=legacy` student escape hatch

**Objective:** Delete the temporary student/demo `?runtime=legacy` entry after hardware sign-off proves setup-driven defaults cover production, demo, and retry needs (or retry is re-expressed on setup-driven).

**Dependencies:** `LC2-806`, teacher/student manual sign-off, `LC2-804` checklist.

**Allowed areas:** `resolveLabSessionRuntimeMode`, lab/demo/dev route query handling, obsolete e2e asserting legacy defaults, docs.

**Do not touch:** null-pin historical session resolver, precipitation static path, historical adapters required for replay.

**Required changes:**

1. Confirm no production or demo URL requires `runtime=legacy` after sign-off.
2. Re-home retry-skill demo behavior onto setup-driven or an explicit non-query entry if still needed.
3. Remove `LEGACY_TITRATION_RUNTIME_FLAG` student routing; keep legacy resolver only for null-pin DB rows.
4. Update migration playbook checklist and legacy inventory.

**Tests/manual:** default titration/demo e2e; precipitation unchanged; old null-pin session replay; full gates; rollback note in ops runbook.

**Acceptance:** Students no longer select a parallel legacy titration engine via query flag; historical static rows remain readable.

**Stop:** If retry demos or a school deployment still depend on the flag, retain it and file a narrower replacement ticket instead of force-deleting.
