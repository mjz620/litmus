# Lab Composer Implementation Roadmap

> **Historical roadmap:** T0200–T0209 produced the transitional v1 foundation.
> The remaining fixed-family sequence is superseded by the capability-driven
> [`LC2 ticket backlog`](../lab-composer/tickets/README.md). Preserve this file
> for original requirements and compatibility context; do not use it to select
> the next implementation ticket.

## Roadmap principles

This roadmap is deliberately dependency-ordered. It preserves the existing titration engine and semantic event contracts, proves static-to-composed parity before enabling AI-authored runtime variants, and keeps each phase independently testable.

“MVP” means required for the Build Week Lab Composer hero path. “Stretch” means useful after the bounded titration composer loop is stable. A planned example is not a supported runtime capability.

## Phase 0 — docs and schema design

- **Goal:** Agree on product boundaries, registry contracts, `LabWorkflowSpec`, agent responsibilities, evals, migration sequence, and ticket scopes.
- **Non-goals:** No application code, routes, database migrations, or behavior changes.
- **Dependencies:** Existing repo law, titration plugin docs/code, semantic event contract.
- **Verification criteria:** Requested docs exist; terminology/IDs/statuses are consistent; diffs contain documentation only; reviewers can trace every runtime gate.
- **Priority:** MVP foundation.

## Phase 1 — registries

- **Goal:** Implement versioned component, action, reagent, engine-capability, skill, event-flag, safety, configuration, and alias registry types/data for the existing titration surface.
- **Non-goals:** No authoring route/UI, runtime assembly, precipitation/calorimetry implementation, or dynamic registry writes.
- **Dependencies:** Phase 0.
- **Verification criteria:** Exact lookups and unknown-ID failures are tested; existing titration skills/flags map without rewriting history; registry imports remain deterministic and local.
- **Priority:** MVP.

## Phase 2 — `LabWorkflowSpec` and validator

- **Goal:** Implement strict Zod/TypeScript schema plus pure validation passes for schema, IDs, compatibility, safety, event evidence, step reachability, support status, and canonical hashing.
- **Non-goals:** No LLM calls, UI, assembler, or arbitrary auto-repair.
- **Dependencies:** Phase 1.
- **Verification criteria:** Valid fixture passes; mutated IDs/components/engines/flags/safety cases fail with stable codes/paths; identical inputs produce identical decisions; only validator sets support eligibility.
- **Priority:** MVP.

## Phase 3 — migrate titration to workflow spec

- **Goal:** Express the current static titration/pre-lab flow as a checked-in canonical `LabWorkflowSpec` seed without changing engine truth or student behavior.
- **Non-goals:** No AI generation, new titration formulas/actions/flags, precipitation, or calorimetry.
- **Dependencies:** Phases 1–2 and existing titration seed support.
- **Verification criteria:** Seed validates; required action sequence maps to current typed actions; semantic events/ground truth match the current static path in parity tests.
- **Priority:** MVP.

## Phase 4 — runtime assembler for titration

- **Goal:** Resolve a validated titration spec into existing engine/component/action adapters and enforce step/action policy.
- **Non-goals:** No multi-engine workflows, arbitrary component placement, agent calls during simulation, or deletion of static fallback before parity.
- **Dependencies:** Phase 3.
- **Verification criteria:** Canonical seed assembles/runs/replays; exact hash/version gate is enforced; every meaningful action calls `ExperimentDefinition.step()`; student route remains offline-interactive and Chromebook-friendly.
- **Priority:** MVP.

## Phase 5 — Lab Composer teacher UI

- **Goal:** Add prompt entry and structured workflow review/edit/regenerate shell with visible support state.
- **Non-goals:** No fake runnable generation, assignment, dashboard aggregation, or concealment of incomplete backend phases.
- **Dependencies:** Phase 2; can use a checked-in validated seed until agent route exists.
- **Verification criteria:** Teacher can enter the hero prompt, inspect structured fields, edit permitted fields (which invalidates prior validation), and see unsupported states with Preview/Assign disabled.
- **Priority:** MVP.

## Phase 6 — authoring agent API route

- **Goal:** Add a server-only structured-output authoring route with read-only registry tools, request limits, unsupported behavior, and schema parsing.
- **Non-goals:** No client secrets, runtime state mutation, self-validation, judge behavior, or arbitrary tool execution.
- **Dependencies:** Phases 1–2.
- **Verification criteria:** Seed prompts return schema-valid drafts/unvalidated status; unknown capabilities are not invented; unsupported/safety prompts classify honestly; prompt/model versions are recorded.
- **Priority:** MVP.

## Phase 7 — judge agent API route

- **Goal:** Add a separate server-only structured-output critique route bound to a spec/validation hash.
- **Non-goals:** No hard-validation logic, chemistry computation, registry mutation, or runtime approval.
- **Dependencies:** Phase 2 and Judge Agent contract; useful with Phase 6 outputs.
- **Verification criteria:** Seeded pedagogy defects produce path-specific issues; invalid hash fails; judge cannot turn non-runnable validation into preview eligibility; eval fixtures pass.
- **Priority:** MVP.

## Phase 8 — author–validator–judge revision loop

- **Goal:** Orchestrate initial authoring, hard validation, eligible critique, up to two revisions, rehash/revalidation, and final support status.
- **Non-goals:** No unbounded autonomous loop, hidden status override, background runtime agent, or automatic assignment.
- **Dependencies:** Phases 6–7.
- **Verification criteria:** Exact state-transition tests cover pass, repairable validation error, judge revision, unsupported, safety rejection, stale critique, and revision-limit outcomes; latency/call caps are visible.
- **Priority:** MVP.

## Phase 9 — preview as student

- **Goal:** Launch a preview-scoped session from an immutable runnable spec using the Phase 4 runtime.
- **Non-goals:** No assignment persistence, teacher metric pollution, or preview of non-runnable drafts.
- **Dependencies:** Phases 4–5 and final validation from Phase 8 or checked-in seed.
- **Verification criteria:** Matching hash/status required; intentional endpoint mistake emits real events and coach trigger input; preview data is isolated/labeled; reload/replay is stable.
- **Priority:** MVP.

## Phase 10 — assignment persistence

- **Goal:** Persist immutable workflow versions, validation artifact/version/hash, registry snapshots, teacher approval, class assignment linkage, and session workflow reference idempotently.
- **Non-goals:** No mutable assignment pointer, schema-free JSON trust, or auth requirement for core demo.
- **Dependencies:** Phase 9 and persistence/auth foundations.
- **Verification criteria:** Only runnable matching-hash workflows can be assigned; duplicate writes are idempotent; historical assignments preserve versions; RLS/demo isolation tests pass.
- **Priority:** MVP for real teacher loop; demo may use scoped ephemeral assignment first.

## Phase 11 — Student Coach integration

- **Goal:** Supply workflow step/skill/trigger policy to the existing coach while keeping semantic events authoritative and simulation non-blocking.
- **Non-goals:** No coach-authored chemistry, new unconstrained chat, state mutation, or trigger on every successful action.
- **Dependencies:** Phases 4 and 9; existing coach route/StudentModel work.
- **Verification criteria:** Registered mistake flags trigger evidence-linked hints, controlled success stays silent, direct questions work, unknown trigger IDs are rejected, and no workflow changes engine truth.
- **Priority:** MVP.

## Phase 12 — teacher dashboard integration

- **Goal:** Group deterministic readiness/evidence by workflow version, assignment, and canonical skill while preserving legacy skill aliases.
- **Non-goals:** No LLM-generated metrics, rewriting raw historical events, or fabricated completion data.
- **Dependencies:** Phases 10–11 and teacher analytics foundation.
- **Verification criteria:** Demo/student session updates class aggregates from persisted rows; workflow title/version and evidence provenance are visible; alias calculations are deterministic.
- **Priority:** MVP for full judge story; can follow assignment persistence.

## Phase 13 — eval harness

- **Goal:** Automate hard fixtures, author/judge structured-output cases, unsupported/safety prompts, revision behavior, replay, and false-confidence metrics.
- **Non-goals:** No reliance on subjective aggregate score for safety/runnability, hidden cherry-picking, or model-only evals.
- **Dependencies:** Starts with Phase 2 fixtures; expands through Phases 6–12.
- **Verification criteria:** Gates in `docs/evaluation/lab-composer-evals.md` run in CI or a documented command; failures identify version/fixture; canonical replay and safety rejection are 100%.
- **Priority:** MVP, built incrementally rather than deferred.

## Phase 14 — judge demo polish

- **Goal:** Deliver the reliable three-minute `/demo` composer → validation → critique → revision → preview mistake → coach → teacher → technical story.
- **Non-goals:** No fake runtime data, broad new chemistry family, expensive rendering, or fragile live-agent dependency without fallback.
- **Dependencies:** Minimum Phases 4–9, 11, 13; Phase 10/12 production paths or demo-scoped equivalents.
- **Verification criteria:** Script completes under three minutes after reset; cached schema-valid agent fallback is labeled; validation/events/StudentModel/dashboard trace is real; no auth/secrets; Chromebook profile is smooth.
- **Priority:** MVP Build Week polish.

## Post-MVP/stretch expansion

Once the titration composer path is stable, implement precipitation and then calorimetry as independent deterministic engine/component tickets. Each family earns `verified` status only after truth tests, registry compatibility, seed replay, coach/evaluator coverage, and runtime assembly tests. Multi-family workflows, richer component placement, teacher-created rubric templates, and school-specific registry policy are stretch architecture, not implied MVP behavior.

## What not to attempt before the deadline

- Arbitrary chemistry generation or runtime-generated formulas/physics.
- Organic synthesis, reflux, filtration/recrystallization, gas collection, electroplating, or open-flame workflows.
- Implementing precipitation or calorimetry merely to make every example runnable before titration parity is proven.
- Multi-engine or branching workflow graphs beyond the minimal validated linear-step MVP.
- LLM-authored registry entries, reagent identities/concentrations, safety rules, event flags, or engine configurations.
- Automatic assignment without teacher preview/approval.
- Judge Agent authority over validation or safety.
- A general-purpose student chatbot or agent mutation of simulation state.
- Replacing `ExperimentDefinition.step()` or removing the existing titration truth layer.
- High-cost fluid/thermal/particle physics, external 3D asset pipelines, or architecture that threatens Chromebook performance.
- New persistence/analytics abstractions before immutable workflow versioning and deterministic provenance are clear.
- Hiding unsupported requests behind a generated narrative or non-functional preview.

The strongest deadline outcome is one polished, bounded titration workflow composed from a spec, visibly hard-validated and independently critiqued, then run through the real student/coach/teacher loop.
