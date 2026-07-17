# Lab Composer Verification Playbook

Every LC2 ticket must run focused tests and the repository-wide gates appropriate to its risk. A green unit suite is not enough for schema migration, runtime parity, student UI, persistence, or agent safety.

## Baseline commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

The production build requires valid-looking Supabase environment variables. For a local compile-only check, use non-secret placeholders that satisfy [`src/lib/env.ts`](../../src/lib/env.ts); never commit them. Record both an environment-gate failure and the successful placeholder build if applicable.

Run `npm run format:check` only when the whole worktree is expected to be formatted. In a dirty worktree, format/check the files owned by the ticket and do not rewrite unrelated user files.

## Focused command patterns

```bash
npm test -- tests/lab-workflows/<area>.test.ts
npm test -- tests/lab-workflows/<directory>
npm test -- tests/experiments/titration.test.ts tests/experiments/titration-replay.test.ts
npm test -- tests/coach
npm test -- tests/persistence tests/api/checkpoint.test.ts
npm run test:e2e -- <spec>
```

Use the repository's actual Playwright argument syntax if it differs. Do not update snapshots blindly; inspect differences.

## Mandatory test properties by change type

### Registry or capability change

- exact known-ID lookup;
- unknown ID failure;
- duplicate ID failure;
- immutable/read-only list result;
- every cross-reference resolves;
- declared versus verified availability;
- source/target capability match and mismatch;
- schema/visual/mechanical/model adapter exact resolution;
- no forbidden framework/network imports;
- snapshot/version change when semantics change.

### Schema change

- valid minimum and representative full document;
- invalid/missing required field;
- unknown key rejection at every new strict object boundary;
- invalid enum/discriminator/version;
- numeric/list/text bounds;
- non-JSON/function/non-finite input rejection;
- valid, invalid, and safety-relevant fixtures;
- draft versus validator-owned field trust boundary;
- stale validation after every authored edit type.

### v1-to-v2 migration/hash change

- existing v1 fixtures parse unchanged;
- existing v1 hash golden values unchanged;
- deterministic migration output fixture;
- stable local IDs and provenance;
- every v1 field mapped or explicit failure;
- migrated output unvalidated;
- strict ordered behavior preserved through explicit constraints;
- v2 domain-separated hash stable;
- semantically meaningful v2 edit changes hash;
- validation/Judge artifact change does not change content hash when intentionally excluded.

### Hard validator change

- one positive and one negative test per pass;
- exact issue code, path, severity, and deterministic ordering;
- unknown capability/model/material/action/adapter rejection;
- material/container mismatch;
- unsupported connection;
- action parameter/precondition rejection;
- missing/ambiguous/cyclic chemistry model resolution;
- contradictory/cyclic rules;
- unreachable success where statically detectable;
- tolerance bounds;
- safety veto precedence;
- Judge approval non-authority;
- current hash and registry snapshot eligibility;
- input not mutated and no network/time/random dependency except injected values.

### Runtime/mechanics/model change

- every meaningful action invokes `ExperimentDefinition.step()` exactly once;
- capability, permission, state, parameter, and safety rejection occurs before mutation;
- immutable prior state;
- material/volume conservation;
- deterministic module ordering;
- registered observable derivation;
- semantic event/evidence/diagnosis output;
- same seed/actions produce deep-equal output;
- unsupported capability fails closed;
- no family-only dispatch;
- no OpenAI/Supabase/browser dependency;
- continuous input cancels safely on pointer loss, visibility loss, route change, and invalid state when applicable.

### Constraint evaluator change

- multiple valid orders;
- required and success conditions;
- forbidden and failure conditions;
- ordering constraints;
- recoverable and terminal violations;
- exact tolerance boundary inside/equal/outside;
- pending state before evidence;
- stable evidence event IDs;
- repeated evaluation idempotency;
- contradiction/cycle handling;
- best-practice positive and “stay silent” cases;
- no import from chemistry formula implementations.

### Event/replay/checkpoint change

- stable event IDs and strictly monotonic sequence;
- compact payload, no per-event full state snapshot;
- legacy `SemanticEvent` fields preserved;
- StudentModel fold compatibility;
- action/equipment/material/rule references exact;
- replay equality after serialization round trip;
- old trace/checkpoint fixtures readable;
- idempotent duplicate writes;
- network failure does not block or roll back simulation state;
- version/provenance pinning.

### Setup-driven UI change

- exact visual adapter resolution and unknown adapter failure UI;
- equipment/layout loaded from definition rather than family/page switch;
- controls derived from valid typed actions;
- no chemistry calculation/state mutation in UI;
- loading, empty, invalid, stale, unsupported, safety, success, and runtime-error states;
- keyboard focus order and visible focus;
- accessible names/status announcements;
- reduced motion;
- no panel overlap at 1366×768, 1440×900, 1600×900, and tall desktop;
- current titration gestures, indicator, wash setup, stopcock, measurements, coach pop-up, and reset recommendation behavior remain compatible with current tests;
- camera and scene remain coherent at all reachable directions;
- screenshots compared, not blindly regenerated.

### Human composer change

- domain command succeeds with exact supported IDs;
- unknown/unsupported command fails with stable error and no mutation;
- every edit invalidates validation/Judge and disables preview/assign;
- equipment/material connection choices are capability-filtered;
- setup/rules serialize and reload exactly;
- undo/edit behavior where in ticket;
- no LLM required;
- validator panel and Judge panel authority remain visually separate;
- preview uses the real runtime and exact hash.

### Agent/Judge change

- server-only secrets and imports;
- strict request/response schemas;
- exact tool allow-list;
- tool output IDs only; no invented IDs/adapters/materials/models;
- no registry mutation or executable code;
- agent edits only through shared commands;
- validation before trace/finalization;
- traces execute rather than assert prose results;
- unsupported request remains non-runnable;
- prompt injection resistance;
- visible assumptions;
- fixed call/revision/token/time/cost limits;
- stale validation/Judge hashes rejected;
- Judge cannot change runnability;
- no chain-of-thought exposure;
- deterministic fallback/error behavior.

### Evaluator/coach change

- exact assigned definition/rubric/objective versions;
- deterministic diagnoses reach consumer;
- output cites evidence IDs;
- alternate valid approach receives credit;
- uncertainty and model/prompt/rubric versions logged;
- no chemistry recomputation or prose reconstruction of hidden state;
- deterministic fallback;
- existing trigger and stay-silent cases remain green;
- slow/down model never blocks simulation.

### Persistence/assignment change

- forward and rollback-safe additive migration review;
- immutable approved versions;
- edit creates unvalidated draft/new version rather than overwrite;
- server-side current hash/eligibility recheck;
- explicit teacher approval;
- assignment pins exact version/hash;
- old rows/sessions/assignments readable;
- RLS owner/class/student separation;
- idempotent create/assign/checkpoint calls;
- historical replay resolves exact adapters/models;
- demo isolation and synthetic labels;
- no secrets or service-role key in client.

## Required executable trace suite

For every native v2 runnable definition, store normalized typed actions and run them against the real runtime:

| Trace | Expected evaluator outcome |
| --- | --- |
| canonical valid | all required/success rules satisfied; no failure/forbidden violation |
| alternate valid order | same valid completion without violating unnecessary ordering |
| recoverable mistake | structured violation with `recoverable: true`; later correction succeeds |
| terminal/conceptual mistake | failure diagnosis with correct severity/terminal behavior |
| tolerance boundary | exact boundary behavior plus just-inside and just-outside cases |

Expected chemistry values come from runtime observables/ground truth in the test, not hand-calculated in workflow prose or UI fixtures.

## Titration parity matrix

Compare legacy and generic paths for at least:

- seeded initialization;
- water and titrant rinse consequences;
- burette fill/refill and capacity bounds;
- indicator choice/addition and one-time behavior;
- meniscus correct/misread evidence;
- controlled endpoint approach;
- high flow near endpoint;
- endpoint overshoot;
- report ground truth and retry eligibility;
- replay and checkpoint provenance;
- coach trigger and correct-action silence.

Compare state fields, observables, legacy semantic event payloads, flags, evidence, and final ground truth. If a v2 envelope adds metadata, compare its embedded legacy payload separately.

## No-family-dispatch verification

Before declaring generic reuse:

```bash
rg -n "familyId|family\." src/lab-workflows/runtime src/lab-workflows/mechanics src/lab-workflows/chemistry-models src/lab-workflows/evaluation
```

Every match must be absent, catalog/provenance-only, or explicitly legacy-adapter code. Add a static test that prevents `familyId` reads in generic runtime entrypoints if practical.

Also verify the same coordinator function/definition factory is called by both titration and dilution tests. Two wrappers that immediately branch by lab identity do not count.

## Performance gates

Target Chromebook-class behavior:

- no network wait in `step()`;
- no per-frame workflow validation or rule graph rebuild;
- precompile validated rules/action bindings once per session;
- bounded registry/spec sizes enforced by schema;
- avoid cloning full event trace/state on every frame or continuous pointer tick;
- lazy-load visual adapters where practical without dynamic paths from authored data;
- keep active 3D equipment visually primary and avoid unbounded scene clutter.

Record before/after runtime or scene profiling for tickets that change continuous gestures, scene equipment count, rule evaluation, or event storage.

## Manual release gates

Before changing a compatibility flag default or deleting a legacy path:

1. Start from a clean deterministic seed.
2. Run both supported labs through valid and mistake traces.
3. Test common desktop resolutions and keyboard-only operation.
4. Inspect browser console/network failures.
5. Verify offline-after-load simulation still runs.
6. Compare technical inspector events, diagnoses, hashes, and versions.
7. Verify coach/evaluator fallback with model/network unavailable.
8. Save/reload/preview/replay the exact definition.
9. Verify non-runnable and stale definitions fail closed.
10. Record screenshot paths, timings, test commands, and remaining differences in the completion report.

## Completion evidence format

In addition to the repository completion report, every LC2 ticket should state:

- **Ticket:** exact LC2 ID and scope.
- **Architectural effect:** which coupling was removed or compatibility seam added.
- **Compatibility:** old behavior/data preserved and evidence.
- **Schema/registry impact:** new/changed IDs and snapshot/version behavior.
- **Migration impact:** old fixtures/sessions affected or explicitly unaffected.
- **Runtime authority:** confirmation that deterministic validation/chemistry remain authoritative.
- **Manual evidence:** routes, states, screenshots, traces, or DB checks actually performed.
