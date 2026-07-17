# Lab Composer Migration Playbook

This is the operational strangler plan. It tells agents how to preserve old data and behavior while introducing the capability-driven path. An active ticket may perform only its named slice.

## Compatibility anchors that cannot change silently

1. `LabWorkflowSpec` v1 parsing behavior and strict unknown-field rejection.
2. Canonical hashes for every existing v1 fixture.
3. The canonical endpoint-control workflow's supported action sequence and failure behavior.
4. Titration state transitions, ground truth, observables, flags, evidence reasons, and report behavior.
5. Every meaningful action's passage through `ExperimentDefinition.step()`.
6. Existing student routes, gestures, keyboard controls, camera behavior, accessibility names, and demo URLs until setup-driven parity.
7. Coach deterministic trigger and positive stay-silent behavior.
8. Checkpoint idempotency, event ordering, nonblocking simulation, and old payload readability.
9. Existing static assignments and sessions without Composer provenance.
10. Validator authority over preview/assignment and Judge non-authority.

Any intentional visible behavior change requires a decision record in [`../lab-composer-architecture.md`](../lab-composer-architecture.md), a compatibility strategy, and tests for old and new behavior.

## Stage A — Freeze v1 behavior

Before changing a v1 public type:

- record fixture hashes from `tests/lab-workflows/hash.test.ts` and canonical seed tests;
- retain [`currentArchitectureCharacterization.test.ts`](../../tests/lab-workflows/currentArchitectureCharacterization.test.ts) until replacement compatibility assertions exist;
- identify all imports with `rg` before moving or renaming an export;
- keep old type aliases/export paths when extracting files;
- do not modify the canonical seed to make v2 migration easier.

Required output of this stage is evidence, not a refactor.

## Stage B — Extend registries without changing compatibility authority yet

Phase 1 first adds capability/schema/adapter metadata alongside v1 fields.

- Existing entries retain `compatibleFamilyIds` and `compatibleEngineIds` until v2 validator/runtime no longer reads them.
- New capability fields may be required on current entries only after all existing entries are updated in the same ticket.
- If a field is introduced optionally for staged rollout, the ticket must state when it becomes required and test both states.
- Registry snapshot IDs must change whenever entry semantics change. Old snapshot IDs remain resolvable for persisted validation artifacts where required.
- An entry with metadata but no implementation is `declared` or `planned`, never `verified`.

Do not add dilution entries during general contract tickets except the exact minimum test fixture explicitly authorized. Production dilution IDs belong to Phase 5.

## Stage C — Introduce the schema-version union

Recommended facade:

```ts
type LabWorkflowDraft = LabWorkflowDraftV1 | LabWorkflowDraftV2;
type ValidatedLabWorkflowSpec =
  | ValidatedLabWorkflowSpecV1
  | ValidatedLabWorkflowSpecV2;
type LabWorkflowSpec = LabWorkflowSpecV1 | LabWorkflowSpecV2;
```

Implementation note: LC2-105 exports this behavior through the separately named `versionedLabWorkflowDraftSchema`, `versionedValidatedLabWorkflowSpecSchema`, and `versionedLabWorkflowSpecSchema` facades. Historical unversioned aliases remain pinned to v1 because the validator, runtime, and author-agent consumers are still v1-only. LC2-106 made the hash facade version-aware while preserving v1 bytes exactly; LC2-107 must promote validator-facing consumers deliberately. This avoids passing v2 into v1 normalization or accidentally widening legacy consumers.

Keep explicit versioned exports as well. Do not discriminate the union only by `supportStatus`; v1 and v2 share statuses. Parsing order is:

1. Inspect `schemaVersion` as untrusted input.
2. Dispatch to the exact strict schema.
3. Reject unknown versions with one stable issue/error.
4. Never coerce an absent version to latest.

`familyId`, `engineId`, `engineConfigId`, `initializationPresetId`, `reagents`, and ordered `steps` remain v1 fields. Do not make them optional inside v1.

## Stage D — Migrate v1 to v2 deterministically

`migrateLabWorkflowV1ToV2()` is a pure data transform. It does not validate, execute the engine, or make a draft runnable.

Migration procedure:

1. Strictly parse v1 input.
2. Resolve every v1 ID exactly against compatibility mapping tables owned by the migration module.
3. Copy stable workflow/local IDs where their meaning survives.
4. Translate component instances into equipment instances with exact current config, visual, mechanical, and layout references.
5. Translate reagents into exact material bindings and quantity presets. No quantity may be rounded or inferred from prose.
6. Translate engine requirements into exact chemistry capability requirements and an explicit legacy compatibility descriptor.
7. Translate every allowed action into a v2 permitted action binding.
8. Translate each ordered step into an instruction section.
9. Add strict precedence edges between consecutive required v1 steps so migrated behavior is unchanged.
10. Translate per-step action scope into explicit rule/action availability constraints. Do not rely only on presentation order.
11. Translate expected observations, completion policies, retries, coach triggers, rubric, and safety through exact mapping tables.
12. Record `sourceSchemaVersion`, original v1 hash, migration version, and source registry snapshots.
13. Output `draft_unvalidated` with null validation and Judge critique.

Failure is explicit for any unmapped ID or unsupported semantic. Never drop a field silently, invent a closest ID, or emit a partially runnable approximation.

Implemented compatibility details: event-flag conditions retain their exact event-type scope; registered completion policies carry bounded evidence-rule IDs; optional v1 steps are rejected because no skip behavior is characterized; and safety text/severity must exactly match the registered policy.

Golden migration assertions:

- input v1 canonical hash is unchanged;
- migrated v2 JSON is stable across runs;
- migrated local IDs are stable;
- the output is unvalidated;
- strict precedence matches current runtime rejection/acceptance;
- migrated output has its own stable domain-separated v2 hash but remains unvalidated;
- editing either setup or rules invalidates validation.

## Stage E — Version-aware hashing

Preserve `hashLabWorkflowSpec(v1)` output exactly. Do not prepend a new domain string to v1 input.

For v2, canonicalize the strict hashable v2 payload and hash using the frozen preimage prefix:

```text
lab-workflow-spec\0schema=2.0.0\0<canonical-json>
```

LC2-106 freezes that exact UTF-8 byte representation, with no BOM, newline, Unicode normalization, or trailing delimiter. It excludes only root validator/Judge-owned `supportStatus`, `validation`, and `judgeCritique` artifacts; compatibility and migration provenance remain hashed.

Never hash unvalidated raw object shape, JavaScript object insertion order, wall-clock validation time, or LLM prose outside the schema. The v2 preflight rejects explicit `undefined`, sparse/custom arrays, non-finite numbers, non-plain objects, cycles, symbols, accessors, and non-enumerable properties before strict schema parsing. Historical v1 optional-`undefined` normalization remains unchanged for compatibility.

## Stage F — Run v1 and v2 validators side by side

The validator facade dispatches by schema version. v1 decisions remain unchanged. v2 validation runs ordered passes with stable issue sorting:

1. strict structural parse;
2. unique local IDs and exact registry resolution;
3. equipment configuration/schema/visual/mechanical adapter resolution;
4. material/container/quantity compatibility;
5. action capability, parameter, source/target, and adapter compatibility;
6. chemistry capability/provider/dependency resolution;
7. rule/condition references, types, tolerance bounds, ordering cycles, contradictions, and detectable reachability;
8. rubric/objective/evidence consistency;
9. coach/instruction/rule references;
10. deterministic safety policy checks;
11. support status, hash, registry snapshots, preview, and assignment eligibility.

Warnings cannot make an otherwise invalid draft runnable. Judge critique is ignored for hard validation.

## Stage G — Introduce the generic runtime beside the legacy assembler

Do not rename `assembleTitrationWorkflow()` to “generic.” Add the generic coordinator separately and retain the old assembler for comparison/historical replay.

Feature flags should distinguish:

- legacy static student route;
- setup-driven migrated titration route;
- optional development technical comparison.

The generic coordinator may use an explicit legacy titration adapter at first. Its snapshot must identify that compatibility dependency. It cannot switch on catalog family.

Runtime comparison for each characterization trace:

- same initial scientific state;
- same accepted/rejected action at the same logical point;
- same final state within exact/ticket-defined numeric equality;
- same ground truth;
- same legacy event payloads/flags/evidence;
- additional v2 event IDs/diagnoses allowed only outside the legacy payload;
- deterministic replay equality.

## Stage H — Replace rigid ordered control with explicit constraints

Migrated v1 retains strict precedence, proving compatibility. A native v2 titration definition can relax only edges that are scientifically/procedurally unnecessary and must add alternate valid trace tests.

For every rule type test:

- pending before sufficient evidence;
- satisfied with exact evidence IDs;
- violated with expected/observed values;
- recoverable versus terminal behavior;
- repeated evaluation idempotency;
- replay equality;
- relevant positive stay-silent case.

The evaluator consumes chemistry observables; it cannot import acid-base or dilution formulas.

## Stage I — Migrate the student scene with parity flag

Sequence:

1. Resolve current titration equipment components through exact visual adapter IDs while keeping existing fixed route.
2. Build a setup-driven scene loader that accepts the validated definition and runtime projection.
3. Render the same apparatus positions from serialized bounded layout.
4. Derive controls from currently valid typed actions.
5. Keep current titration intent hooks/gestures behind adapters; do not let them mutate state directly.
6. Run current component/e2e tests against both paths where possible.
7. Compare screenshots at 1366×768, 1440×900, 1600×900, and a tall desktop viewport.
8. Verify keyboard, reduced motion, camera containment, loading, error, and reset flows.
9. Default to the new route only after parity evidence is recorded.

Do not delete the fixed route in Phase 3. Cleanup belongs to `LC2-804` after persistence and historical replay are complete.

## Stage J — Human composer before agent migration

The pure authoring reducer is the only write path for v2 drafts. UI state may hold selection/inspector state, but domain edits call commands.

Every edit must:

- produce a new serializable draft;
- fail with a stable error for unsupported IDs/connections;
- invalidate validation/Judge artifacts;
- keep preview/assign disabled;
- preserve undo/redo or command history according to its ticket;
- never execute chemistry or call an agent.

Preview calls the real validator and generic runtime. A local fixture can supply a draft, but preview cannot mock a runnable result.

## Stage K — Prove reuse with dilution

Dilution/solution preparation must add only reusable primitives and the bounded concentration/dilution capability. It may not add:

- `engine.dilution.*`;
- `familyId` runtime cases;
- a `/lab/dilution` hard-coded workspace;
- dilution formulas in UI, rules, prompts, or fixture expected values;
- a second coordinator/evaluator/event system.

Required real trace suite:

1. one valid trace;
2. a valid trace with alternate allowed preparation order;
3. one recoverable procedural mistake;
4. one terminal or major conceptual mistake;
5. exact tolerance boundary inside/outside traces.

All traces execute the same generic definition/coordinator/evaluator used by migrated titration.

## Stage L — Migrate the agent after Level 2

Freeze the current family-oriented author route until the shared command layer and two-lab runtime pass the Level 2 gate.

The new agent sequence:

1. parse teacher objective/constraints and expose assumptions;
2. search exact registered objectives/capabilities/equipment/materials;
3. issue shared domain commands;
4. validate draft deterministically;
5. generate typed normalized traces, not prose outcomes;
6. execute traces with the real runtime/evaluator;
7. request advisory Judge critique only when deterministically eligible;
8. revise through commands within a fixed attempt/cost/time budget;
9. revalidate after every revision;
10. return an editable draft and evidence; never assign automatically.

No route may trust agent-supplied validation, trace results, adapter IDs, or expected chemistry.

## Stage M — Add immutable persistence and assignment

Use additive migrations. Suggested entities, finalized by the persistence ticket:

- `lab_definition_drafts` or equivalent mutable teacher-owned draft records;
- immutable `lab_definition_versions` containing strict spec, canonical hash, validation provenance, support status, and approval metadata;
- assignment reference to exact approved version/hash;
- session reference to exact assigned version plus runtime/model/adapter versions;
- normalized action trace/event envelope versioning.

Rules:

- Editing creates/updates an unvalidated draft, never an approved immutable version.
- Approval creates an immutable version after server-side eligibility recheck.
- Assignment rechecks current hash/status and pins the immutable version.
- Old static assignments and sessions remain readable through explicit legacy resolution.
- RLS prevents students from writing definitions/approval and teachers from accessing other classes.
- Demo data uses the same schema and paths with explicit synthetic/demo labels.

## Legacy removal checklist

No old path may be removed until all are true:

- migrated titration parity tests pass;
- setup-driven student verification passes;
- old and new saved definitions/sessions replay;
- assignment migration is deployed and reversible;
- coach/evaluator/analytics consume new evidence with legacy fallback;
- both supported labs pass performance/a11y/e2e gates;
- no production or demo route depends on the legacy path;
- teacher and student manual verification is recorded;
- rollback procedure and historical adapter retention are documented.
