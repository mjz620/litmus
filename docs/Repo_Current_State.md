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
- deterministic chemistry-model provider/dependency resolution over injected verified metadata; `LC2-300` now registers one compatibility-scoped provider for the existing titration truth layer without making it available to native labs.

`LC2-104/104A` add the first v2 constraint contract layer, which `LC2-106` narrowly extends for lossless migration: a closed thirteen-kind condition union, bounded workflow rules, presentation-only instruction sections, typed rubric evidence mappings, tagged JSON-safe evidence values, and structured diagnoses. Event/observation variants keep semantic-event observations distinct from chemistry observables; the exact registered-completion-policy variant preserves legacy completion semantics without permitting authored code.

`LC2-105` adds strict v2 draft/validated schemas for setup, layout, action permissions, coach/retry policy, rubric, safety, presentation, explicit legacy compatibility, migration provenance, and validation artifacts. A separately named schema-version facade parses either version; existing unversioned aliases intentionally remain v1-only while legacy consumers migrate.

`LC2-106` adds a pure exact v1-to-v2 migration with frozen registry provenance and stable generated constraints. Unsupported or unmapped semantics fail closed, and every migrated draft is unvalidated. Hashing now dispatches by schema version: v1 outputs remain frozen and v2 hashes a strict JSON payload under an exact schema domain.

`LC2-107` adds strict schema-version-dispatched v2 hard validation and fail-closed eligibility. It resolves exact equipment, configurations, layouts, materials, action contracts, capabilities, model providers, rules, evidence, presentation/coach references, safety, adapters, and registry snapshots; rejects graph contradictions/unreachable success; deterministically orders issues; revalidates artifacts for current-hash eligibility; and treats Judge output as advisory only. V1 validator decisions, hashes, and eligibility remain unchanged.

`LC2-200` adds the framework-free generic runtime scaffold beside the unchanged titration assembler. It implements the existing `ExperimentDefinition` contract, compiles immutable exact v2 equipment/material/action/model/rule/provenance bindings once, validates normalized permissions/connections/capabilities/parameters/attempts/preconditions/safety before mutation, invokes exact injected mechanical/model/evaluator ports, and exposes serializable immutable state, observables, ground truth, events, and diagnoses. The public runtime wrapper calls `ExperimentDefinition.step()` exactly once per dispatch. Only test implementations are registered.

`LC2-201` adds the first production reusable liquid mechanics and conserved material state without changing the legacy titration engine. Generic runtime schema `1.1.0` adds the required ledger; no `1.0.0` scaffold state was persisted or route-consumed. A serializable material ledger retains exact profile, unit, immutable initial quantity, and sorted per-equipment allocations; typed executed-transfer deltas carry exact before/after quantities into the model boundary. Code-owned burette, flask, reagent-bottle, and indicator-bottle adapter registrations initialize equipment projections, while the burette adapter implements bounded fill, dispense, rinse-state, and read mechanics. Capacity, availability, nonnegative quantities, exact micro-milliliter conservation, target acceptance, ambiguity, and replay determinism fail closed. Distilled water now has one exact 50 mL binding preset, enabling a validated chemistry-free transfer fixture through the generic `ExperimentDefinition.step()` path. Generic rinse deliberately consumes no invented volume and emits no legacy dilution/evidence semantics.

`LC2-202`–`LC2-205` complete the generic model coordinator, constraint evaluator, semantic event envelopes, and provenance-pinned normalized trace replay. `LC2-300` adds the explicit atomic titration compatibility seam selected by validated runtime-adapter ID. It serializes complete legacy state for replay, delegates every accepted scientific transition exactly once to the existing titration `ExperimentDefinition.step()`, projects equipment/material/observable/ground-truth views, preserves legacy event payloads inside v2 envelopes, and exposes adapter/model/engine/definition versions in provenance. The 22 mL endpoint seed is reconciled as a conserved 22 mL flask plus 28 mL burette split. The legacy chemistry provider is scoped to `runtime-adapter.titration.v1`, so definitions without that exact compatibility descriptor cannot resolve it.

`LC2-301` checks in the strict migrated endpoint-control titration as serialized v2 JSON generated from the deterministic v1-to-v2 mapping. The source remains explicitly unvalidated; its loader revalidates against current exact registries and pins the migration version, v1 content hash, canonical v1 validation hash, source registry snapshots, and v2 canonical hash. Focused equivalence tests run the same seeded actions through the v1 assembler and generic compatibility runtime and compare strict precedence, final engine state, semantic events, diagnoses, completion, and stale validation rejection.

`LC2-302` adds a production-adjacent setup-driven mode to the existing student session/store rather than a competing state path. The acid-base route selects it only with the exact `?runtime=setup-v2` flag and checked-in workflow ID/hash; missing, invalid, retry, and non-titration requests stay legacy. Store actions permitted by the strict migrated workflow normalize into generic actions, execute through the generic definition's `step()`, and project the adapter-validated titration state for the unchanged UI. Checkpoint and coach consumers remain queued after synchronous simulation, setup state is cleared on legacy reload, initialization fails into the existing accessible error surface, and the development inspector exposes workflow, adapter, model, event, and diagnosis provenance. Canonical workflow hashing now uses a dependency-free synchronous SHA-256 primitive so current-hash validation can execute locally in the browser; known UTF-8 vectors and every frozen workflow hash remain covered.

This is not yet the default production capability-driven student runtime. The production student route/store/scene still default to the legacy path; the exact setup-driven path requires an explicit query flag and retains the existing fixed titration scene. V2 Preview/Assign remain disabled. Human Composer, second shared-runtime lab, agent migration, immutable definition persistence, and assignment gates remain missing. Existing optional `workflowVersionId` fields remain provenance seams only. Normalized report submission is also intentionally deferred because no registered v2 report action contract exists; legacy report truth remains characterized directly.

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
- LC2-100–LC2-205 and LC2-300–LC2-302 capability/equipment/action/material/configuration/chemistry-model/constraint/v2 workflow contracts, migration, platform-neutral version-aware hashing, hard validation/eligibility, generic runtime, liquid mechanics, constraint/event/replay integration, explicit legacy titration compatibility, serialized v2 titration definition, feature-flagged setup-driven student store/session path, and exact tests under `src/lab-workflows/**`, `src/stores/**`, and `tests/**`.

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
npm run typecheck    pass — 2026-07-17 LC2-302
npm run lint         pass — 2026-07-17 LC2-302
npm test             pass — 80 files / 446 tests
npm run build        pass with compile-only local Supabase placeholders — 19 generated pages
npm run test:e2e -- tests/e2e/setup-driven-session.spec.ts    pass — 2 Chromium tests
```

E2E, database/RLS, audit, coach eval, and performance profiling were not rerun during the Phase 0 documentation audit; their last scoped evidence remains in the relevant completion reports and `docs/project/Chromebook_Performance.md`.

## Known issues

- KI-004: checkpoint event insertion is idempotent, but mutable session/skill upserts still need monotonic revision hardening.
- KI-002: titration catalog duration metadata remains inconsistent with one product reference.
- Headless Chromium reports the upstream `THREE.Clock` deprecation as a non-error console information message.
- See `docs/Known_Issues_And_Followups.md` for detail.

## Next ticket boundary

Phase 3 is implemented through `LC2-303`; the next ticket is `LC2-304`, consumer parity and the native partial-order titration proof. The flagged setup-driven path now resolves exact visual adapters, layout, projected state, current controls, and authored action bounds while production still defaults to the legacy path. Follow [`docs/lab-composer/README.md`](lab-composer/README.md) and the exact [`LC2-*` ticket backlog](lab-composer/tickets/README.md).
