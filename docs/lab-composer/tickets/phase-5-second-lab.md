# Phase 5 — Second Adaptable Lab

Phase 5 proves reuse with dilution or solution preparation. It must use the same v2 schema, validator, generic `ExperimentDefinition`, mechanics/model coordinator, constraint evaluator, events, replay, human Composer, and student scene as titration.

Implementation status: `LC2-500` through `LC2-503` are complete. The checked-in schema-2.1 sodium-chloride solution-preparation definition is recreated by one shared command transaction, pinned to its canonical hash, validated against exact registries, and exercised through the generic coordinator with canonical, alternate-valid, recoverable, terminal, and tolerance-boundary traces. The same setup-driven student Preview and human Composer now run both native solution preparation and compatibility titration without family dispatch. All ten Level 2 criteria are recorded in [`../level-2-gate.md`](../level-2-gate.md); Phase 6 is unblocked.

## LC2-500 — Reusable dilution equipment and action mechanics

**Objective:** Register and implement the minimum reusable physical primitives for a bounded volumetric dilution/solution-preparation setup.

**Dependencies:** `LC2-409`.

**Allowed areas:** equipment/action/config/material adapter registries, pure mechanics, UI visual adapters for new equipment, focused tests/docs.

**Do not touch:** generic coordinator architecture, new experiment/family engine, dilution chemistry formulas, agent/persistence code, separate student route.

**Required changes:**

1. Register exact verified definitions for volumetric pipette, volumetric flask, wash bottle, and only additional container(s) the selected setup truly requires.
2. Add exact visual/mechanical/state/config/schema/safety/capability metadata and implementations.
3. Register typed reusable transfer, fill-to-mark, rinse, and mix actions only where current mechanics require new IDs; reuse existing actions when semantics match exactly.
4. Implement source availability, capacity, transfer, residual/rinse, fill-to-mark tolerance, and mixing mechanical state without concentration calculations.
5. Add visual adapters to the same setup-driven scene map; preserve active equipment clarity/performance.
6. Add water/stock material profiles and quantity/config presets only with exact verified data and policies needed by the chosen lab.

**Tests/manual:** exact registry resolution; capabilities/connections; parameter/precondition bounds; transfer/receive/conservation; incompatible equipment/material; rinse/fill-to-mark/mix states; visual adapter/keyboard interactions; common viewports/performance; no family runtime/page.

**Acceptance:** Human Composer can place/configure/bind the new physical setup, and generic mechanics can execute material deltas without chemistry results.

**Stop:** If a new action is merely a lab-specific instruction rather than reusable physical behavior, express it as rules/instructions, not an action definition.

## LC2-501 — Bounded concentration/dilution chemistry capability

**Objective:** Implement a verified deterministic concentration/dilution module over the shared material ledger, volume conservation, and solution mixing capabilities.

**Dependencies:** `LC2-500`, `LC2-202`.

**Allowed areas:** chemistry-owned model module files/tests, exact material/config capability metadata, narrow observable registry updates/docs.

**Do not touch:** UI, rules/prompts, generic coordinator branching, new family engine, acid-base formulas unless shared behavior is explicitly proven and scoped.

**Required changes:**

1. Implement only bounded aqueous concentration/dilution behavior required by the selected registered material profiles.
2. Consume executed material ledger deltas and verified profile/config parameters.
3. Provide exact concentration/volume and instrument observables with documented units/precision.
4. Depend explicitly on material ledger, volume conservation, and solution mixing capabilities.
5. Reject unsupported phases/reactions/identities rather than approximating.
6. Keep deterministic state serializable and replay-stable.

**Tests:** known registered presets; volume/concentration conservation; partial transfer; final fill; insufficient mix state if observable semantics require it; exact tolerance/precision; unsupported material/phenomenon; repeated/reordered valid mechanical sequence determinism; no network/UI imports.

**Acceptance:** The generic model coordinator resolves and executes concentration/dilution capability without an `engine.dilution` or lab-family branch.

**Stop:** Do not build universal equilibrium/reaction support or hard-code the expected student target into the module.

## LC2-501A — Bounded teacher-authored concentrations for registered solutions

**Objective:** Let a teacher enter a custom concentration for an exact registered aqueous material profile without adding a code fixture or quantity preset for every value, while keeping identity, units, supported ranges, safety, hashing, chemistry, and runtime truth deterministic.

**Dependencies:** `LC2-501`, `LC2-408`.

**Allowed areas:** versioned `LabWorkflowSpec` material-initialization contracts and migration, material/configuration/unit/safety registries, v2 validator, shared authoring commands, material inspector UI, generic model initialization adapters, focused tests/docs.

**Do not touch:** arbitrary chemical identities or formulas, LLM chemistry, family dispatch, unrelated equipment mechanics, unbounded numeric input, legacy v1 material values/hashes, or a separate concentration-specific Lab IR.

**Required changes:**

1. Evolve the existing Lab IR through an explicit additive schema version (for example `2.1.0`) and provide deterministic migration from `2.0.0`; do not silently change the meaning of `2.0.0` or create another definition format.
2. Separate registered chemical identity from authored initialization values. Add concentration-configurable profiles only for identities whose deterministic model and safety range are verified. Preserve existing concentration-encoded v1 profiles as legacy-readable compatibility entries.
3. Add a strict material-initialization variant equivalent to:

   ```ts
   interface BoundedConcentrationInitialization {
     kind: "bounded_concentration";
     configurationSchemaId: RegistryId;
     concentration: {
       decimalValue: string;
       unitId: RegistryId;
     };
   }
   ```

   Exact field names belong to the implementation, but the value must be canonical decimal data—not a formula, non-finite JavaScript number, free-form unit, serialized model state, or prose.
4. Register exact code-owned unit, configuration-schema, material-profile, chemistry-capability, and safety-range metadata. Each supported material declares its bounds, decimal precision, allowed units, required model capability, and safety policy. Do not guess chemical safety limits; stop if verified ranges are unavailable.
5. Canonicalize accepted decimal input deterministically for hashing and replay while preserving teacher-visible significant digits separately when pedagogically useful. Reject exponent tricks, locale-dependent commas, excess precision, negative or zero values where unsupported, overflow, `NaN`, and infinities.
6. Extend hard validation to require an exact verified material profile, compatible initialization schema, supported concentration unit/range/precision, compatible container, resolved deterministic model provider, and all concentration-dependent safety policies. Validator, Judge, and agent output cannot widen the range.
7. Add shared authoring commands to set, change, and clear concentration initialization. Every edit invalidates validation and Judge artifacts. Human and future agent authoring must use these same commands.
8. Add an accessible teacher inspector control with explicit unit, permitted range, validation feedback, and normalized preview. Do not expose concentration controls for profiles that are not registered as authorable.
9. Feed normalized concentration into the verified chemistry-model initialization path. UI, workflow rules, prompts, and evaluators must not calculate concentration, pH, equivalence point, or expected outcomes.
10. Keep exact-preset workflows readable and executable. Migration must not rewrite legacy `0.100 M` definitions into editable custom values unless the teacher explicitly changes them.

**Tests/manual:** schema `2.0.0` compatibility and migration to the new version; canonical decimal round trip; minimum/maximum and just-inside/just-outside values; precision/unit rejection; unknown/unverified material/schema/model/safety IDs; container mismatch; concentration edit changes hash and clears validation/Judge artifacts; save/load/replay equality; deterministic initialization and observables for at least two accepted concentrations; unsupported concentration remains non-runnable; teacher keyboard/error/units UX; static no-formula-in-UI and no-family-dispatch checks.

**Acceptance:** A teacher can author at least two non-preset concentrations for each explicitly supported registered solution identity, validate them deterministically, save/load them, and execute them through the same generic model/runtime path without new experiment-family code or per-value registry entries.

**Stop:** “Custom” means any canonical value inside an explicitly verified material/model/safety range. It does not mean arbitrary chemicals, arbitrary units, unsupported ranges, authored formulas, or bypassing exact registry and model resolution.

## LC2-502 — Serialized dilution definition and executable trace suite

**Objective:** Author a complete v2 dilution/solution-preparation definition using the same commands/validator/runtime/evaluator, with multiple valid orders and meaningful mistakes.

**Dependencies:** `LC2-501A`.

**Allowed areas:** `src/lab-workflows/definitions/dilution/**` or selected neutral setup name, trace fixtures/tests, minimal registry entries required by exact setup/docs.

**Do not touch:** new engine/family runtime, separate evaluator/event system, hard-coded UI page, agent generation.

**Required changes:**

1. Build the definition through the shared command service or prove it round-trips through those commands.
2. Bind exact equipment/material/config/layout/model capabilities/actions.
3. Express correctness with conditions/partial orders, not a total click sequence.
4. Include objectives, instruction guidance, safety, rubric, recoverable/terminal rules, and deterministic tolerance.
5. Validate current hash and execute the mandatory five-trace suite.
6. Derive expected scientific outcomes from actual runtime observables in assertions.

**Tests:** valid canonical; alternate valid order; recoverable mistake corrected; terminal/major conceptual mistake; just-inside/equal/just-outside tolerance; save/load/replay; evidence/diagnosis/objective/rubric mapping; no family dispatch; same generic coordinator identity as titration.

**Acceptance:** Both titration and dilution definitions pass through the same generic runtime/evaluator and have inspectable events/diagnoses/replay.

**Stop:** Do not weaken validation to admit the lab. Missing support remains non-runnable until exact primitives/modules are implemented.

## LC2-503 — Second-lab student rendering, human authoring, and Level 2 gate

**Objective:** Render, author, validate, save/load, preview, and replay the second lab through the same student scene and human Composer, then produce explicit Level 2 evidence.

**Dependencies:** `LC2-502`.

**Allowed areas:** setup-driven student/teacher UI adapters, tests/e2e/performance/docs/status.

**Do not touch:** agent/Judge routes, immutable assignment persistence, new hard-coded lab page, legacy cleanup.

**Required changes:**

1. Expose the definition through setup selection/catalog metadata without using family for runtime dispatch.
2. Render new equipment via exact visual adapters and actions via shared control primitives.
3. Author/recreate the setup/rules through human commands.
4. Preview all five traces and inspect events/diagnoses/observables.
5. Verify save/load/replay and edit invalidation.
6. Run Level 2 gate checklist and publish evidence in implementation status/completion report.

**Tests/manual:** student interaction e2e; teacher authoring/preview e2e; both labs same coordinator; alternate orders; failures/tolerance; a11y/common viewports; Chromebook performance; offline-after-load; no family dispatch static check.

**Acceptance:** All ten Level 2 criteria in [`../../lab-composer-architecture.md`](../../lab-composer-architecture.md) are demonstrably satisfied without an LLM. Only then may Phase 6 start.

**Stop:** If any gate is missing, mark Level 2 incomplete and create a focused gap ticket. Do not start agent migration or claim Level 3.
