# Phase 3 — Titration Migration

Phase 3 proves compatibility by moving the shipped titration through the generic path behind a flag. It must not delete or rewrite the legacy student path.

## LC2-300 — Explicit titration compatibility mechanics/model adapter

**Status:** Implemented. The generic coordinator uses an atomic, serialized compatibility port selected by exact runtime-adapter ID; production routing is unchanged. Normalized report submission remains deferred because the action registry has no report action contract.

**Objective:** Wrap current titration initialization, actions, truth, observables, events, and ground truth behind explicit generic runtime ports without changing chemistry.

**Dependencies:** `LC2-205`.

**Allowed areas:** `src/lab-workflows/adapters/titration/**`, `src/lab-workflows/runtime/legacy/**`, narrow chemistry-model legacy adapter, parity tests/docs.

**Do not touch:** titration formulas/event meanings, production route/UI/store, v1 assembler deletion, dilution, agents/persistence.

**Required changes:**

1. Implement exact mappings from normalized v2 actions/equipment/material bindings to current `TitrationAction` and config/seed.
2. Delegate the actual scientific transition to the existing titration `ExperimentDefinition.step()`.
3. Project existing state into generic equipment/material/observable views without duplicating formulas.
4. Enrich returned legacy events with v2 envelopes; preserve payload exactly.
5. Expose legacy adapter/model IDs and versions in runtime provenance.
6. Fail exact mapping errors; no fuzzy action/equipment/reagent substitution.

**Tests:** characterization matrix from verification playbook; state/ground truth/observable/event/flag/evidence parity for rinse, fill/refill, indicator, meniscus, controlled dispense, high flow, overshoot, report/retry; same action calls legacy `step()` exactly once; replay equality; unknown mapping failure.

**Acceptance:** Generic coordinator can run legacy titration truth through an explicit, visibly legacy compatibility adapter with deterministic parity.

**Stop:** Do not extract acid-base formulas into new modules here. That is a separate future chemistry ticket after adapter parity.

## LC2-301 — Serialized v2 titration definition and v1 equivalence

**Objective:** Check in the migrated canonical titration as a validated-capable serialized v2 definition and prove its strict migrated behavior matches v1.

**Dependencies:** `LC2-300`, `LC2-106`, `LC2-107`.

**Allowed areas:** `src/lab-workflows/definitions/titration/**`, seeds/migration fixtures, tests/docs.

**Do not touch:** student UI, canonical v1 seed content/hash, new native relaxed workflow, agents/persistence.

**Required changes:**

1. Generate or encode v2 from the deterministic migration mapping, not a separately hand-diverged template.
2. Pin exact equipment/material/config/layout/action/capability/legacy adapter/rule/instruction/rubric/safety IDs.
3. Validate at test/runtime boundary; do not trust checked-in validation artifacts as current without recheck.
4. Store golden v1 hash, migrated v2 hash, migration version, and registry snapshots.
5. Run equivalent v1 assembler and generic trace sequences.

**Tests:** v1 hash unchanged; deterministic migration equals checked-in v2 source; v2 validator runnable; strict precedence/action gate equivalence; state/event/diagnosis/replay parity; stale version/hash failure.

**Acceptance:** Titration is representable as a serialized v2 definition, but production still defaults to legacy UI/runtime.

**Stop:** Do not relax workflow order in this compatibility definition. A later native variant may remove unnecessary edges with alternate-order tests.

## LC2-302 — Setup-driven session loader and store path behind a flag

**Objective:** Load the validated v2 titration definition into the generic coordinator through a production-adjacent store/session path without replacing the existing route.

**Dependencies:** `LC2-301`.

**Allowed areas:** narrow setup-runtime store/session adapters under `src/stores/**`, `src/components/lab/useLabSession.ts`, `src/app/lab/**`, generic runtime adapters, integration/e2e tests.

**Do not touch:** broad visual scene conversion, chemistry, authoring UI, persistence schema, old store path deletion.

**Required changes:**

1. Add an explicit compatibility/feature flag defaulting to legacy unless project owner authorizes otherwise.
2. Resolve exact eligible definition/hash before initializing generic store state.
3. Dispatch normalized typed actions through the generic definition's `step()`.
4. Preserve asynchronous coach/checkpoint/evaluator hooks through adapters; simulation cannot await them.
5. Provide technical/development inspection of definition hash, adapter/model versions, events, diagnoses, and legacy/generic mode.
6. Fail closed with accessible error state for invalid/stale/missing adapters.

**Tests:** both flags initialize; same seeded action trace parity; every action `step()` path; coach/checkpoint queue nonblocking; reload/invalid URL/error; no family dispatch; old precipitation/static routes unaffected.

**Acceptance:** A development/flagged student session can run serialized titration through generic state/action coordination before the scene is generalized.

**Stop:** Do not make the new flag default or delete experiment-ID branches used by legacy routes.

## LC2-303 — Setup-driven titration scene and reusable controls

**Objective:** Render the v2 equipment/layout/action projection using current visual assets and interaction behavior, with visual and accessibility parity.

**Dependencies:** `LC2-302`.

**Allowed areas:** `src/components/lab/**`, `src/app/lab/**`, UI-owned visual adapter registry/map, UI tests/e2e/styles/docs.

**Do not touch:** chemistry formulas/events, core schema/validator, agent/persistence code, legacy scene deletion.

**Required changes:**

1. Create exact UI-owned map from registered visual adapter IDs to existing Burette, flask, indicator, wash station, and environment components.
2. Load equipment instances and bounded layout from the validated definition.
3. Project generic mechanical/material state into discriminated adapter props.
4. Derive visible actions/controls from current runtime action availability and diagnoses.
5. Route gestures/intents to normalized actions only; never mutate scientific state in UI.
6. Preserve current indicator detail/one-time addition, wash selection/setup, stopcock visibility/gesture, titrant/refill, measurements, coach pop-up, and checkpoint reset recommendation behavior already present in the user worktree.
7. Keep global controls/panels stable and avoid active bench overlap.
8. Add unknown/missing adapter error state; no dynamic import path from spec.

**Tests/manual:** current component/e2e suite under both paths where feasible; exact adapter resolution; keyboard/reduced motion; common viewports; camera/world containment; interaction traces; screenshot comparison; console/network check; Chromebook performance smoke.

**Acceptance:** Flagged setup-driven titration is visually and interactively comparable to the current scene, and all scientific changes still flow through generic `step()`.

**Stop:** Do not generalize by making all current titration props optional. Use exact adapter contracts and add only reusable UI primitives proven here.

## LC2-304 — Titration consumer parity and native partial-order proof

**Objective:** Complete setup-driven titration integration with coach, evaluator/report, checkpoint/replay, demo, and technical inspector, then prove at least one scientifically valid alternate action order in a native v2 definition without changing the strict migrated fixture.

**Dependencies:** `LC2-303`.

**Allowed areas:** narrow adapters across coach/evaluator/checkpoint/demo/technical UI, native titration v2 definition/trace fixture, integration/e2e tests/docs.

**Do not touch:** agent/Judge generation, immutable persistence schema, legacy path deletion, chemistry formulas.

**Required changes:**

1. Pass exact definition/rubric/objective/event/diagnosis provenance through existing consumer adapters while retaining legacy requests.
2. Keep coach trigger policy/stay-silent behavior and evaluator deterministic fallback.
3. Checkpoint/replay the versioned normalized trace and legacy payload compatibility locally; database version storage waits for Phase 8.
4. Add demo/technical inspection without forking runtime logic.
5. Create a separate native v2 titration definition or fixture that removes only proven-unnecessary precedence edges.
6. Execute two valid orders and required mistake/tolerance traces.

**Tests:** consumer parity suites; old request/fixture compatibility; two valid native orders; recoverable/terminal/tolerance diagnoses; same chemistry truth; replay; demo path; no family dispatch; full e2e/performance/a11y gates.

**Acceptance:** Phase 3 has a feature-flagged setup-driven titration path with scientific, event, consumer, replay, and visual parity plus a constraint-based alternate-order proof. Legacy remains available.

**Stop:** Do not call the system Level 2 complete yet; human authoring/save/load/preview and second-lab reuse remain missing.
