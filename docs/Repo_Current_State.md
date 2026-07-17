# Repo Current State

This file is the living implementation record for LabBench AI. Root `AGENTS.md` and `tickets.md` remain authoritative.

## Current implementation

The pre–Lab Composer sequence is complete through T0048, together with the existing T0100–T0141 UX overhaul and optional T0142 procedural sound.

The project owner approved the normative T0140 design system on 2026-07-17 with no requested revisions, completing its final manual acceptance gate.

Implemented runtime paths now include:

- deterministic acid–base titration with seeded variation, custom fills/refills, endpoints up to two configured burette capacities, cumulative pH curve, current meniscus reading, reports, and targeted retries;
- deterministic precipitation/solubility with exact supported solution IDs, typed actions, semantic events, product prediction, and net ionic evidence;
- one shared `ExperimentDefinition.step()` action path feeding semantic events, in-memory StudentModel, non-blocking coaching, versioned checkpoints/replay, structured report evaluation, demo trace, and deterministic teacher analytics;
- Supabase schema/RLS/seed plus separated public/server/service clients, Google role scaffold, classes/join codes, dashboard/roster/detail routes, and idempotent checkpoint writes;
- no-auth Student/Teacher/Technical demo, scoped reset, editable hold-to-talk transcription, keyboard/reduced-motion support, Chromebook-oriented demand-rendered 3D, and gesture-gated WebAudio cues.

The transitional Lab Composer v1 foundation is implemented through the initial Author Agent route:

- exact component, action, reagent, engine, skill, event/flag, configuration, and safety registries for the currently supported titration workflow;
- strict `LabWorkflowSpec` `1.0.0`, canonical hashing, deterministic hard validation, current-hash eligibility, and mutation/safety coverage;
- a checked-in endpoint-control titration workflow, deterministic seed replay gate, and titration-specific runtime assembler/adapters that call the existing `ExperimentDefinition.step()`;
- a server-only constrained Author Agent prototype and `/api/lab-composer/author` route with structured output, exact read-only registry tools, limits, and deterministic test behavior.

Capability-driven Stage 1A (`LC2-100`–`LC2-103`) is also implemented:

- closed equipment and chemistry capability vocabularies with explicit availability;
- backward-compatible equipment/action contracts with exact schema, adapter, precondition, error, and event references;
- material-profile, quantity-preset, and configuration-schema metadata over the existing v1 registries, including all three deterministic indicators and distilled-water rinse support;
- deterministic chemistry-model provider/dependency resolution over injected verified metadata, with no production chemistry modules registered yet.

`LC2-104/104A` add the first v2 constraint contract layer, which `LC2-106` narrowly extends for lossless migration: a closed thirteen-kind condition union, bounded workflow rules, presentation-only instruction sections, typed rubric evidence mappings, tagged JSON-safe evidence values, and structured diagnoses. Event/observation variants keep semantic-event observations distinct from chemistry observables; the exact registered-completion-policy variant preserves legacy completion semantics without permitting authored code.

`LC2-105` adds strict v2 draft/validated schemas for setup, layout, action permissions, coach/retry policy, rubric, safety, presentation, explicit legacy compatibility, migration provenance, and validation artifacts. A separately named schema-version facade parses either version; existing unversioned aliases intentionally remain v1-only while legacy consumers migrate.

`LC2-106` adds a pure exact v1-to-v2 migration with frozen registry provenance and stable generated constraints. Unsupported or unmapped semantics fail closed, and every migrated draft is unvalidated. Hashing now dispatches by schema version: v1 outputs remain frozen and v2 hashes a strict JSON payload under an exact schema domain.

This is not yet a capability-driven runtime. Family/engine IDs remain v1 compatibility authority, ordered steps remain runtime control flow, and the production student scene is fixed. V2 hard validation, the Workflow Judge, generic capability runtime, constraint evaluator, human Composer, second shared-runtime lab, immutable definition persistence, and assignment gates are missing. Existing optional `workflowVersionId` fields remain provenance seams only.

## Deterministic/AI boundary

- Experiment engines alone own chemistry, state transitions, semantic events, and grading ground truth.
- UI and 3D components dispatch typed actions; they do not reimplement chemistry.
- Coach and evaluator use versioned constrained prompts and structured output over supplied state/events; they never mutate simulation state or calculate chemistry.
- Simulation actions never await OpenAI or Supabase.
- Teacher metrics are pure aggregates over stored-shaped rows.
- Future authored workflows must resolve exact verified IDs, pass deterministic validation, retain immutable hash/version provenance, and use the same engine/action/event path.

## Completed tickets

Foundation and existing UX work:

- T0001–T0011B, KI-003, T0047, T0100–T0103, T0110–T0112, T0120–T0121, T0130–T0132, T0140–T0141, and the post-T0141 visual corrections. Their reports remain in `docs/completion-reports/`.

This implementation sequence:

| Ticket | Result | Completion report |
| --- | --- | --- |
| T0012 | Development event/StudentModel/raw-state inspector | `T0012_Student_Event_Inspector.md` |
| T0013 | Versioned non-blocking checkpoint queue | `T0013_Checkpoint_Queue_Scaffold.md` |
| T0014 | Deterministic coach trigger/silence policy | `T0014_Coach_Trigger_Policy.md` |
| T0015 | Validated coach API/mock schema | `T0015_Coach_API_Schema.md` |
| T0016 | Constrained structured-output coach | `T0016_Coach_Structured_Output.md` |
| T0017 | Non-blocking coach panel/text questions | `T0017_Coach_Panel_UI.md` |
| T0018 | Coach eval command/gates | `T0018_Coach_Eval_Harness.md` |
| T0019 | Indexed Supabase schema | `T0019_Supabase_Schema_Migration.md` |
| T0020 | RLS and pgTAP isolation fixture | `T0020_RLS_Policies.md` |
| T0021 | Separated Supabase clients/env validation | `T0021_Supabase_Client_Env.md` |
| T0022 | Idempotent checkpoint route/repositories | `T0022_Session_Checkpoint_Route.md` |
| T0023 | Store checkpoint wiring/status/retry | `T0023_Real_Checkpoint_Queue.md` |
| T0024 | Google auth and role scaffold | `T0024_Auth_Role_Scaffold.md` |
| T0025 | Classes and exact join codes | `T0025_Classes_Join_Codes.md` |
| T0026 | Deterministic analytics query layer | `T0026_Teacher_Analytics_Query_Layer.md` |
| T0027 | Teacher overview | `T0027_Teacher_Dashboard_Overview.md` |
| T0028 | Roster and evidence detail | `T0028_Teacher_Roster_Student_Detail.md` |
| T0029 | Schema-valid demo seed/fixture | `T0029_Demo_Seed_Data.md` |
| T0030 | Report form/engine submission | `T0030_Report_Form_UI.md` |
| T0031 | Structured report evaluator | `T0031_Evaluator_API.md` |
| T0032 | Evidence-linked feedback/retry CTA | `T0032_Feedback_UI.md` |
| T0033 | Validated retry templates | `T0033_Adaptive_Retry_Seed_Validation.md` |
| T0034 | Retry route/UI/provenance | `T0034_Adaptive_Retry_UI.md` |
| T0035 | Demo hub/role switcher | `T0035_Demo_Hub_Role_Switcher.md` |
| T0036 | 22.00 mL student demo | `T0036_Demo_Student_Seeded_Route.md` |
| T0037 | Live demo teacher row | `T0037_Demo_Teacher_Live_Insertion.md` |
| T0038 | Technical trace | `T0038_Demo_Technical_Inspector.md` |
| T0039 | Scoped demo reset | `T0039_Demo_Reset_Route.md` |
| T0040 | Ephemeral voice-token route | `T0040_Voice_Token_Route.md` |
| T0041 | Hold-to-talk/editable transcript | `T0041_Hold_To_Ask_UI.md` |
| T0042 | Deterministic precipitation engine | `T0042_Precipitation_Engine.md` |
| T0043 | Shared-shell precipitation UI | `T0043_Precipitation_UI_Registration.md` |
| T0044 | Accessibility/keyboard/reduced motion | `T0044_Accessibility_Pass.md` |
| T0045 | Chromebook profile and rendering budget | `T0045_Chromebook_Performance_Pass.md` |
| T0046 | Public README/demo runbook | `T0046_README_Devpost_Prep.md` |
| T0048 | Custom/multi-fill titration | `T0048_Custom_Burette_Refills.md` |
| T0142 | Gesture-gated procedural sound | `T0142_Procedural_Sound.md` |

All report paths are relative to `docs/completion-reports/`.

Lab Composer transitional implementation present in source/tests:

- T0201–T0206-equivalent registry, schema, hashing, and hard-validation foundation under `src/lab-workflows/**` and `tests/lab-workflows/**`;
- T0207 canonical titration seed/replay and T0208 titration-specific runtime assembler/adapters;
- T0209 initial Lab Authoring Agent route and tests under `src/lib/agent/lab-authoring/**`, `src/app/api/lab-composer/author/**`, and `tests/ai/lab-composer/authoring/**`.
- LC2-100–LC2-106 capability/equipment/action/material/configuration/chemistry-model/constraint/v2 workflow contracts, migration, version-aware hashing, and exact tests under `src/lab-workflows/**` and `tests/lab-workflows/**`.

The exact historical ticket completion reports were not added for these transitional files. Implementation status is based on current source and passing tests, not assumed ticket completion. T0210–T0220 are superseded by the capability-driven `LC2-*` sequence.

## Key source map

```text
src/experiments/               deterministic contracts/engines/replay/manifests
src/lab-workflows/             Composer v1 registries/schema/hash/validator/seed/runtime and future capability boundary
src/stores/                    shared typed runtime and lab UI state
src/components/lab/            student controls, 3D, reports, retry, inspector
src/lib/agent/                 coach/evaluator policy, prompts, schemas, clients
src/lib/persistence/           checkpoint envelope, queue, transports, repositories
src/lib/analytics/             deterministic teacher aggregates/loaders
src/lib/voice/                 ephemeral token and Realtime transcription client
src/app/api/                   coach/evaluator/checkpoint/voice/demo routes
src/app/demo/                  credential-free judge routes
src/app/teacher/               class overview/roster/student evidence routes
supabase/                      migrations, RLS fixture, and demo seed
tests/                         truth, policy, API, persistence, analytics, and browser tests
```

## Installed runtime dependencies

- Next 16.2.10, React/React DOM 19.2.7, TypeScript 5.9.3.
- React Three Fiber 9.6.1, Drei 10.7.7, Three 0.185.1, Zustand 5.0.14.
- Zod 4.4.3, OpenAI 6.48.0, Supabase JS 2.110.7, Supabase SSR 0.12.3.
- Vitest 4.1.10, Playwright 1.58.2, ESLint 9.39.2, Prettier 3.8.2.

## Latest local verification

```text
npm run typecheck    pass — 2026-07-17 LC2-106
npm run lint         pass — 2026-07-17 LC2-106
npm run format:check pass — 2026-07-17 LC2-106
npm test             pass — 64 files / 369 tests
npm run build        pass with compile-only local Supabase placeholders — 19 generated pages
```

E2E, database/RLS, audit, coach eval, and performance profiling were not rerun during the Phase 0 documentation audit; their last scoped evidence remains in the relevant completion reports and `docs/project/Chromebook_Performance.md`.

## Known issues

- KI-004: checkpoint event insertion is idempotent, but mutable session/skill upserts still need monotonic revision hardening.
- KI-002: titration catalog duration metadata remains inconsistent with one product reference.
- Headless Chromium reports the upstream `THREE.Clock` deprecation as a non-error console information message.
- See `docs/Known_Issues_And_Followups.md` for detail.

## Next ticket boundary

The next normal implementation ticket is `LC2-107`, capability-driven v2 hard validation. Follow [`docs/lab-composer/README.md`](lab-composer/README.md) and the exact [`LC2-*` ticket backlog](lab-composer/tickets/README.md). Do not execute T0210–T0220 as written. Precipitation remains a static exact-ID plugin and is not automatically Composer support.
