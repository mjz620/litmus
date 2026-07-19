# LC2 Capability-Driven Ticket Backlog

These are the authoritative implementation tickets for the capability-driven Lab Composer overhaul. The old `T0210`–`T0220` tickets are superseded and must not be executed.

Downstream agents normally implement one ticket per run under `AGENTS.md`. The repository owner may explicitly authorize a broader documentation/planning run, but implementation dependencies and gates still apply.

## Status

| Ticket | Status | Notes |
| --- | --- | --- |
| `LC2-000` | Complete | Architecture audit and migration plan |
| `LC2-001` | Optional gap ticket | Use only for a concrete missing black-box characterization; do not duplicate existing tests |
| `LC2-100` | Complete | Bounded capability vocabularies and backward-compatible equipment metadata |
| `LC2-101` | Complete | Capability-based action contracts and exact supporting metadata registries |
| `LC2-102` | Complete | Reusable material, quantity, and configuration-schema metadata |
| `LC2-102A` | Complete | Corrective parity registration for bromothymol blue, methyl orange, and distilled-water rinse support |
| `LC2-103` | Complete | Chemistry-model contracts and exact verified-provider resolver; production providers remain empty |
| `LC2-104` | Complete | Strict bounded condition, rule, instruction, rubric/evidence, and diagnosis contracts |
| `LC2-104A` | Complete | Narrow event-observation condition/evidence correction required for lossless v1 migration |
| `LC2-105` | Complete | Strict v2 draft/validated schemas plus an explicit schema-version facade |
| `LC2-106` | Complete | Pure v1-to-v2 migration, the narrow completion-policy compatibility correction, and domain-separated v2 hashing with frozen v1 compatibility |
| `LC2-107` through `LC2-403` | Complete | Capability validator, generic runtime/evaluator/replay, setup-driven titration migration, shared authoring commands, human Composer, validation, save/load, and exact-hash preview are implemented; see phase specifications for compatibility limits |
| `LC2-403A` | Complete | Exact registered/authored bounds now reach physical and precision controls; invalid/stale actions fail closed in-simulation without state, evidence, replay, or checkpoint mutation |
| `LC2-404` | Complete | Five-stage guided Composer, progressive technical disclosure, monotonic undo/redo invalidation, issue routing, preview return, and common-viewport coverage |
| `LC2-405` through `LC2-408` | Complete | Atomic dependency-aware removal, full-width drag/drop setup, graph/Outline workflow editing, Define/Assess relationships, separate view state, and integrated accessibility are implemented and verified |
| `LC2-408A` | Complete | Manual input, direct-manipulation feedback, teacher-facing language, and dialog/graph usability are corrected and verified |
| `LC2-409` | Complete | Verified 3D teacher arrangement over exact registered poses with a locked student layout and List fallback |
| `LC2-410` | Complete | Draft persistence and unsaved-change protection (QA TEACHER-002, S1) |
| `LC2-411` | Complete | Explicit reagent–container pairing and container exclusivity (QA TEACHER-005, S2) |
| `LC2-411A` | Complete | Indicator shelf reflects bound indicators; pairing dead-end guidance |
| `LC2-412` | Complete | Blank-lab start and titration as an explicit template (QA TEACHER-001, S1) |
| `LC2-413` | Complete | Eliminate silent authoring failures (QA TEACHER-003/004, S2) |
| `LC2-414` | Complete | Plausibility validation for measurements, points, and duration (QA SYSTEM-002/TEACHER-007, S2) |
| `LC2-415` | Ready | Teacher-language and raw-error containment pass (QA TEACHER-008/006, S2) |
| `LC2-416` | Ready | Workflow ordering attribution, error specificity, and preview/WebGL fallback (QA WORKFLOW-001/SETUP-001/PREVIEW-002, S3) |
| `LC2-417` | Complete | Reframed the setup-driven Preview around registered equipment, labeled completed conditioning clearly, and returned bounded local Coach guidance when the live service or route is unavailable |
| `LC2-500` | Complete | Registered family-neutral solution-preparation equipment, poses, materials, actions, visuals, and conserved mechanics |
| `LC2-501` | Complete | Added the bounded deterministic concentration/dilution provider over the shared ledger, volume, and mixing capabilities |
| `LC2-501A` | Complete | Added additive schema 2.1 material initialization, strict decimal/range/unit/safety validation, shared commands, Composer controls, migration, and deterministic model initialization |
| `LC2-502` | Complete | Serialized, hash-pinned solution preparation is command-recreatable and passes the mandatory five-trace generic-runtime suite |
| `LC2-503` | Complete | Both labs use shared human authoring, setup-driven Preview, exact validation, replay, and the documented passing Level 2 gate |
| `LC2-600` | Complete | Added separately versioned, server-only exact discovery and atomic shared-command tools with bounded audit metadata |
| `LC2-601` | Complete | Added the bounded capability generation route, authoritative validation, real five-trace execution, diagnostic revision, budgets, and fail-closed outcomes |
| `LC2-602` | Complete | Added explicit proposal accept/reject/revise controls, plain-language assumptions and deterministic evidence, exact local handoff checks, edit invalidation, and real Preview |
| `LC2-603` | Complete | Streams plain-language authoring progress, extends the live time budget, and recovers retryable live failures through the verified local author without exposing private reasoning or adding a summarizer call |
| `LC2-604` | Complete | Prevents supported dilution requests from being turned into unnecessary titration clarification and recovers live non-runnable dilution drafts through the verified local author |
| `LC2-700` | Complete | Added exact assigned-definition/runtime provenance, authored-rubric evidence citations, uncertainty/version logs, deterministic score ceilings/fallback, and legacy compatibility |
| `LC2-701` | Complete | Added the independently versioned exact-hash advisory Judge, capability/trace provenance checks, ten bounded review dimensions, evidence/path citations, model defenses, and deterministic fallback |
| `LC2-702` | Complete | Added authority-separated teaching review UI, command-only suggestions, candidate validation/five-trace/rejudge gating, stale blocking, fixed budgets, termination reasons, and history |
| `LC2-703` | Complete | Added exact versioned authored context, diagnosis/evidence/action grounding, four authority labels, deterministic silence, bounded fallback, and legacy compatibility |
| `LC2-704` | Complete | Added a dedicated plain-language Composer AI review tab that projects the bounded Author → deterministic checks → advisory Judge → teacher-approved revision cycle without exposing private model reasoning or changing authority |
| `LC2-800` | Complete | Added authenticated RLS-protected drafts and immutable, server-revalidated approved definition versions without attaching assignments |
| `LC2-801` | Complete | Assignment/session pins, assignment eligibility, Composer Assign, setup-driven titration defaults, historical legacy resolver |
| `LC2-802` | Complete | Production-path integration coverage for approve/assign/resolve, stale pins, legacy static rows, and default setup-driven student entry |
| `LC2-803` | Complete | Ops/retention/extension runbook, Chromebook follow-up notes, docs synced to implemented persistence reality |
| `LC2-804` | Complete | Retired titration dual-path opt-in as the primary mode; retained precipitation, historical adapters, and null-pin legacy resolver |
| `LC2-805` | Complete | Student `/assignments/[id]` loads pinned definition into session init; class page lists start links |
| `LC2-806` | Ready (physical residual) | Automated dual-lab gates green; dated physical Chromebook pass still required before `LC2-808` |
| `LC2-807` | Complete | Family Author v1 route returns 410; capability author is the sole production path |
| `LC2-808` | Blocked by `LC2-806` physical sign-off | Remove titration `?runtime=legacy` student escape hatch after hardware verification |

The corrective `LC2-410`–`LC2-416` pass (from [`../../qa/strict-product-judge-report.md`](../../qa/strict-product-judge-report.md)) precedes further feature work. The release-blocking `LC2-410`–`LC2-414` tickets are complete. Phases 5–8 core gates plus `LC2-805`/`LC2-807` are complete; `LC2-806` physical sign-off remains before `LC2-808`.

## Dependency map

```text
LC2-000
  -> LC2-100
  -> LC2-101
  -> LC2-102
  -> LC2-103
LC2-101/102/102A/103 -> LC2-104 -> LC2-104A -> LC2-105 -> LC2-106 -> LC2-107

LC2-107 -> LC2-200 -> LC2-201 -> LC2-202
LC2-200/202 -> LC2-203 -> LC2-204 -> LC2-205

LC2-205 -> LC2-300 -> LC2-301 -> LC2-302 -> LC2-303 -> LC2-304

LC2-304 -> LC2-400 -> LC2-401/402 -> LC2-403 -> LC2-403A -> LC2-404
  -> LC2-405 -> LC2-406 -> LC2-407 -> LC2-408 -> LC2-408A -> LC2-409

LC2-409 -> LC2-410 -> LC2-411 -> LC2-412 -> LC2-413 -> LC2-414 -> LC2-415 -> LC2-416
LC2-410/411/412/413/414 (QA release blockers) -> LC2-500 -> LC2-501 -> LC2-501A -> LC2-502 -> LC2-503

LC2-503 + Level 2 gate -> LC2-600 -> LC2-601 -> LC2-602

LC2-502 -> LC2-700
LC2-602 -> LC2-701 -> LC2-702 -> LC2-704
LC2-204 + LC2-503 -> LC2-703

LC2-408 -> LC2-800 -> LC2-801
LC2-700/702/703/801 -> LC2-802 -> LC2-803 -> LC2-804

LC2-801 -> LC2-805
LC2-803 -> LC2-806
LC2-602 + LC2-804 inventory -> LC2-807
LC2-806 + manual sign-off -> LC2-808
```

## Phase specifications

- [Phase 0 — remaining characterization](phase-0-characterization.md)
- [Phase 1 — capability-driven contracts](phase-1-contracts.md)
- [Phase 2 — generic runtime and constraint evaluator](phase-2-runtime.md)
- [Phase 3 — titration migration](phase-3-titration.md)
- [Phase 4 — human Composer foundation](phase-4-human-composer.md)
- [Phase 5 — second adaptable lab](phase-5-second-lab.md)
- [Phase 6 — agent command layer](phase-6-agent.md)
- [Phase 7 — hybrid evaluation](phase-7-evaluation.md)
- [Phase 8 — persistence, assignment, hardening, and cleanup](phase-8-persistence.md)

## Universal ticket rules

Every LC2 ticket must:

- preserve the repository invariants in `AGENTS.md`;
- start from exact current source rather than documentation assumptions;
- fail closed on unknown IDs, adapters, models, schemas, versions, or stale validation;
- add focused tests appropriate to the changed contract;
- preserve existing v1 behavior unless the ticket explicitly includes compatibility migration;
- avoid unrelated refactors and dependencies;
- update implementation status when a capability becomes actually runnable;
- complete the full report required by `AGENTS.md` plus the LC2 evidence fields in [`../verification-playbook.md`](../verification-playbook.md).

## Phase gates

### Enter Phase 2 only when

- v2 strict schema, migration, hash, and validator pass;
- capability/action/material/model references resolve exactly;
- v1 parsing/hashes remain stable.

### Enter Phase 4 only when

- migrated titration runs through the generic coordinator behind a flag;
- deterministic state/event/replay parity is proven;
- the legacy route remains available.

### Enter Phase 5 only when

- a human/fixture can create, validate, save/load, and preview a v2 setup without an LLM.

### Enter Phase 6 only when the Level 2 gate passes

- two labs use the same coordinator/evaluator;
- no family dispatch;
- alternate valid orders and mistake/tolerance traces execute;
- human Composer commands are the sole draft-editing domain path.

### Remove legacy code only in `LC2-804`

Parity, persistence migration, historical replay, e2e, performance, and manual sign-off are prerequisites.
