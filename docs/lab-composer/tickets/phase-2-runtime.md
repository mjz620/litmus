# Phase 2 — Generic Runtime and Constraint Evaluator

Phase 2 creates deterministic local runtime infrastructure. It does not switch the production student route, add the human Composer, implement dilution production entries, or expose agent/Judge tools.

## LC2-200 — Generic lab state and action coordinator scaffold

**Status:** Implemented on 2026-07-17.

**Objective:** Implement a generic `ExperimentDefinition<GenericLabConfig, GenericLabState, NormalizedLabAction>` coordinator that validates and dispatches typed actions through exact capability/adapter contracts.

**Dependencies:** `LC2-107`.

**Read first:** existing shared experiment contract, v1 titration runtime/types/errors, action/component registries, [`../contract-blueprint.md`](../contract-blueprint.md) “Generic runtime contract.”

**Allowed areas:** `src/lab-workflows/runtime/generic/**`, pure runtime adapter maps/interfaces, `tests/lab-workflows/runtime/generic/**`, narrow exports/docs.

**Do not touch:** existing titration assembler/engine behavior, production store/UI/routes, chemistry formulas, agent/persistence code.

**Required changes:**

1. Define serializable generic config/state/action types with exact validated-definition provenance.
2. Compile a validated v2 definition into immutable equipment/action/material/model/rule bindings once at initialization.
3. Implement pre-transition resolution: action ID, source/targets, global permission binding, capabilities, parameter schema, equipment preconditions, safety policy, exact mechanical adapter.
4. Define mechanical/model/evaluator ports but use only minimal deterministic test doubles until their tickets.
5. Implement `createInitialState`, `step`, and ground-truth/observable boundary without family dispatch.
6. Guarantee no network/browser/framework imports and no dynamic module path from the spec.

**Tests:** only eligible current-hash v2 accepted; unknown/stale/non-runnable rejected; action/capability/connection/parameter/precondition/safety failures occur before mutation; `step()` invoked once per action; immutable prior state; deterministic output with injected ports; static no-family-dispatch/import checks.

**Acceptance:** A small test-only validated v2 setup can initialize and execute a no-chemistry mechanical action. No production lab claims generic support yet.

**Stop:** Do not use `Record<string, unknown>` as the permanent state model or add `switch (familyId)`. Missing mechanics/model behavior is a port error until later tickets.

**Implementation note:** The scaffold uses a dedicated internal runtime-admission check that authoritatively revalidates the v2 artifact and tolerates only LC2-107's deliberate Preview gate. It does not alter Preview/Assign eligibility. Exact mechanical, precondition, safety, model, and evaluator behavior is supplied through code-owned ports; LC2-200 registers no production implementation.

## LC2-201 — Reusable equipment mechanics and material ledger

**Status:** Implemented on 2026-07-17.

**Objective:** Implement the minimum pure mechanical transitions and material ledger/volume conservation needed by current titration compatibility actions.

**Dependencies:** `LC2-200`.

**Allowed areas:** `src/lab-workflows/mechanics/**`, initial deterministic `chemistry-models/material-ledger/**` and volume module, exact adapter registration, focused tests.

**Do not touch:** titration formulas/events, acid-base truth, UI, dilution-specific components/actions, workflow evaluator, agents/persistence.

**Required changes:**

1. Define serializable equipment state projections and material location/quantity ledger.
2. Implement exact adapters for bounded contain/receive/dispense/rinse/fill/read mechanics only where current verified actions support them.
3. Produce typed `ExecutedMaterialAction` deltas; mechanics do not calculate pH/concentration/indicator response.
4. Enforce capacity, nonnegative quantity, source availability, target acceptance, and conservation.
5. Keep legacy action adapter separate; do not change existing engine.
6. Register executable adapter maps in code, never through authored import paths.

**Tests:** fill/dispense/rinse/read happy paths; empty source; over-capacity; negative/non-finite amount; incompatible source/target; exact conservation; immutable state; deterministic deltas; unknown adapter; repeated replay equality.

**Acceptance:** Generic coordinator can execute verified mechanical/material deltas with no chemistry formulas and no family awareness.

**Stop:** If existing titration rinse semantics include engine-specific evidence/conditioning, represent that through the later legacy adapter, not a generic mechanic guess.

**Implementation note:** Generic runtime schema `1.1.0` now carries a strict sorted material ledger with exact profile/version/unit, immutable initial quantity, and split equipment allocations. There are no persisted or route-consumed `1.0.0` generic states; stale scaffold payloads fail closed. The runtime compiles exact quantity presets, initializes apparatus projections from the ledger, validates typed executed-transfer deltas, and applies capacity/conservation before model coordination. Code-owned liquid adapters implement bounded fill, dispense, rinse projection, and read behavior without chemistry formulas or family metadata. An exact 50 mL distilled-water preset provides the chemistry-free integration fixture. Rinse does not consume an invented quantity or reproduce legacy dilution, event flags, or skill evidence. Existing titration runtime behavior is unchanged.

## LC2-202 — Chemistry module coordinator and registered observables

**Objective:** Resolve and run verified deterministic modules in dependency order and expose registered observables without workflow evaluation.

**Dependencies:** `LC2-201`, `LC2-103`.

**Allowed areas:** `src/lab-workflows/chemistry-models/**`, generic runtime integration, focused tests.

**Do not touch:** experiment formulas except through explicit adapter in Phase 3, UI, workflow rules, agents, persistence.

**Required changes:**

1. Compile the exact validated module resolution into session state/provenance.
2. Initialize module state from verified material/equipment/config presets.
3. Apply typed material actions in deterministic dependency order.
4. Derive namespaced registered observables and reject duplicate/ambiguous keys.
5. Keep module states serializable/versioned and isolated.
6. Surface stable runtime errors for missing implementation/version mismatch.
7. Provide test-only bounded modules for coordinator evidence; production acid-base compatibility arrives in `LC2-300`.

**Tests:** initialization/order; transitive dependencies; same seed/actions equality; observable projection; duplicate key/missing implementation/version mismatch; no action means no material transition; network independence; model input immutability.

**Acceptance:** Generic coordinator can execute mechanics plus deterministic synthetic/test model modules. No chemistry result is authored in specs or UI.

**Stop:** Do not create one module that switches on lab identity or attempt a universal aqueous solver.

**Implementation note:** The generic runtime now compiles the validator's exact dependency-ordered model metadata and exact verified observable/unit allow-lists. A code-owned coordinator validates executable ID, version, provided capabilities, and required capabilities before initialization; runs only selected modules; isolates strict serializable field state; skips material transitions for non-material actions; and rejects missing implementations, contract drift, malformed state, and duplicate or unregistered observables with stable reason codes. Numeric registered observables populate deterministic ground truth. Production chemistry-model metadata remains empty and the evidence modules are test-only, so this ticket does not claim acid-base or other production chemistry support.

## LC2-203 — Partial-order workflow evaluator and diagnoses

**Objective:** Implement pure deterministic evaluation of v2 conditions/rules against projected state, registered observables, and semantic evidence.

**Dependencies:** `LC2-200`, `LC2-202`.

**Allowed areas:** `src/lab-workflows/evaluation/**`, generic runtime integration through a narrow port, focused tests/fixtures.

**Do not touch:** chemistry formulas, UI, coach/evaluator LLM, agent/Judge, persistence.

**Required changes:**

1. Compile validated conditions/rules into efficient immutable evaluators once per session.
2. Evaluate every supported condition discriminant exhaustively.
3. Track pending/satisfied/violated status, evidence IDs, severity, recoverable/terminal, expected/observed structured values, objective IDs.
4. Support partial-order dependencies rather than a current-step index.
5. Keep instruction presentation order outside evaluation.
6. Define deterministic session completion/failure from authored success/failure/terminal rules.
7. Do not recompute chemistry; read only registered observables/evidence.

**Tests:** at least two valid action orders; required/success/forbidden/failure/order; recoverable correction; terminal violation; action count; flag present/absent; exact inclusive/exclusive tolerance boundary; pending; idempotent reevaluation; evidence IDs; best-practice satisfied and stay-silent; no chemistry implementation imports.

**Acceptance:** One test setup completes through alternate valid orders, and diagnoses are stable/inspectable/replayable.

**Stop:** If a condition needs arbitrary property access or a formula, add an exact registered observable/condition type in a prerequisite review; never add an expression evaluator.

**Implementation note:** A code-owned pure evaluator now compiles the authored rule set and exact registry adapter mappings once, exhaustively evaluates all thirteen closed condition variants, and returns diagnoses in authored rule order. Runtime evaluation receives post-transition equipment/material/observable state, post-increment action attempts, the exact current normalized action, prior diagnoses, and bounded student responses. Independent requirements accept either order; explicit ordering rules use prior satisfaction and latch their result. Terminal violations dominate success, required/success/ordering rules gate completion, and completed or failed sessions reject further dispatch. Generic runtime schema `1.2.0` adds deterministic `workflowStatus`; no persisted or route-consumed generic `1.1.0` states exist. Temporary evidence references use stable cumulative event indexes until LC2-204 introduces the canonical envelope. The engine-endpoint completion policy remains unavailable to the generic evaluator until the explicit Phase 3 adapter.

## LC2-204 — Semantic event envelope and diagnosis integration

**Objective:** Add stable event identity/sequence/action/equipment/material/rule references while preserving current `SemanticEvent` payload consumers.

**Dependencies:** `LC2-203`.

**Allowed areas:** `src/lab-workflows/events/**`, generic runtime state/integration, narrow shared event compatibility helpers, focused StudentModel/coach/checkpoint tests.

**Do not touch:** existing engine event meanings, database schema, coach prompts, UI redesign, agent routes.

**Required changes:**

1. Implement `SemanticEventEnvelopeV2` or the reviewed equivalent from the blueprint.
2. Generate stable session-scoped event IDs and strictly monotonic sequences deterministically.
3. Embed/preserve exact legacy payload fields for compatibility events.
4. Attach normalized action, equipment/material, and rule evidence references.
5. Link diagnoses to event IDs without full state snapshots.
6. Add adapters so StudentModel and existing legacy consumers can read payloads unchanged.
7. Define serialization bounds and event schema version.

**Tests:** stable IDs/sequence; no duplicate after replay; legacy payload equality; StudentModel fold equality; compactness/no state snapshot fields; exact action/instance/rule refs; multiple events from one action; failed action event policy; serialization round trip; coach/checkpoint compatibility helper.

**Acceptance:** Generic transitions emit inspectable envelopes and diagnoses while existing `SemanticEvent` consumers can still operate through a documented adapter.

**Stop:** Do not change persistence schema or route requests here; create transport adapters only.

**Implementation note:** Generic runtime schema `1.3.0` replaces the cumulative raw-event copy with strict `SemanticEventEnvelopeV2` state and an explicit monotonic event sequence. Successful actions create provisional session-scoped envelopes before evaluation, evaluators cite exact envelope IDs, and the stored envelopes receive authored-order inverse rule links afterward. Envelopes carry the exact normalized action, source/targets, material IDs, action sequence, and unchanged compact legacy payload; no state snapshots are stored. Event payload types are checked against the compiled exact action event contract. `ExperimentDefinition.step()` still returns the legacy payload array, while pure adapters preserve StudentModel folding, coach input, and checkpoint event transport. Failed actions remain atomic and consume no event or action sequence. No persistence route or database schema changed.

## LC2-205 — Versioned normalized action traces and deterministic replay

**Objective:** Define typed action trace storage and execute traces through the real generic `ExperimentDefinition.step()` and workflow evaluator.

**Dependencies:** `LC2-204`.

**Allowed areas:** `src/lab-workflows/replay/**`, generic runtime test helpers that are production-safe, focused tests/fixtures/docs.

**Do not touch:** Supabase schema, student UI, agents, chemistry formulas, legacy trace deletion.

**Required changes:**

1. Add strict bounded trace schema with definition hash/version, registry/model/adapter provenance, session seed, normalized action sequence, and optional structured student responses.
2. Replay by initializing the pinned eligible definition and calling `step()` for each action.
3. Return actual snapshots/events/diagnoses/observables; never accept authored expected chemistry as truth.
4. Add explicit legacy titration replay adapter without changing old trace format.
5. Fail closed on stale/missing versions or action/schema mismatch.

**Tests:** same trace deep equality; serialization round trip; changed action divergence; unknown action/version/hash rejection; legacy trace still runs; all actions call `step()`; network independence; valid/alternate/recoverable/terminal/tolerance synthetic trace suite.

**Acceptance:** The replay harness is ready to characterize migrated titration and later test agent-generated traces against real runtime.

**Stop:** Do not persist traces or let the author agent call this until later tickets authorize those surfaces.

**Implementation note:** `GenericLabActionTrace` `1.0.0` is a strict bounded, JSON-round-trippable contract that pins generic runtime version, workflow hash/revision, validator version, registry snapshots, resolved adapters/models, session ID/seed, normalized actions, and optional bounded student responses. Replay rejects schema or provenance drift before action execution, initializes the exact currently eligible definition, and dispatches every recorded action through the generic runtime/`ExperimentDefinition.step()` path. Results contain actual initial/intermediate/final states, event envelopes, diagnoses, and observables; the trace has no expected-state or expected-chemistry fields. A bounded suite runner executes the five required trace categories against the same runtime. `replayLegacyTitrationActions` delegates to the unchanged legacy replay format. Traces are not persisted and are not exposed to authoring agents in this ticket.
