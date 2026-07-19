# Capability-Driven Lab Composer: Downstream Agent Guide

This directory is the implementation handoff for the capability-driven Lab Composer migration. It converts the epic and the Phase 0 audit into instructions that can be executed safely by coding agents with limited repository context.

## Authority and interpretation

Use this order when instructions appear to conflict:

1. [`AGENTS.md`](../../AGENTS.md) remains repository law.
2. The active `LC2-*` ticket in [`tickets/README.md`](tickets/README.md) defines the allowed change for that run.
3. [`../lab-composer-architecture.md`](../lab-composer-architecture.md) defines the target architecture and migration rationale.
4. This execution pack supplies concrete file paths, interfaces, tests, and handoff procedure.
5. The old `T0200`–`T0220` tickets and [`../architecture/composable-lab-runtime.md`](../architecture/composable-lab-runtime.md) describe the implemented transitional v1 design. They are compatibility references, not the target runtime architecture.

Do not execute `T0210`–`T0220` as written. Their fixed-family sequencing is superseded by `LC2-*`. Useful Judge, UI, persistence, and evaluation requirements have been retained in the new tickets at the correct dependency stage.

## Mandatory reading for every LC2 ticket

Read these files before editing:

1. [`AGENTS.md`](../../AGENTS.md)
2. the exact active ticket under [`tickets`](tickets/README.md)
3. [`../lab-composer-architecture.md`](../lab-composer-architecture.md)
4. [`current-system-map.md`](current-system-map.md)
5. the relevant section of [`contract-blueprint.md`](contract-blueprint.md)
6. [`migration-playbook.md`](migration-playbook.md)
7. [`verification-playbook.md`](verification-playbook.md)
8. [`../Repo_Current_State.md`](../Repo_Current_State.md)

Then inspect every source and test file named by the active ticket. Documentation sketches are not a substitute for reading the current implementation.

## Current safe starting point

The foundational capability layers include:

- exact v1 registries for the supported titration workflow;
- `LabWorkflowSpec` `1.0.0`;
- version-aware canonical hashing with frozen v1 bytes and a domain-separated v2 preimage;
- canonical titration seed and replay validation;
- a titration-specific runtime assembler that still uses ordered steps as control flow;
- an initial family-oriented Lab Authoring Agent route retained as a frozen compatibility prototype alongside the completed, separately versioned capability-author route and teacher-controlled Composer handoff;
- exact equipment and chemistry capability vocabularies with explicit declared/verified/restricted availability;
- backward-compatible equipment and action definitions with exact state/configuration/visual/mechanical/schema/precondition/error/event-contract references;
- reusable material-profile metadata over the existing reagent registry, including all three deterministic indicator choices and distilled water, with exact quantity and configuration-schema metadata;
- framework-free chemistry-model contracts and deterministic exact provider resolution, plus one exact compatibility-scoped provider that delegates titration truth to the existing engine and is unavailable to native labs.
- strict bounded v2 building blocks for the closed thirteen-kind workflow-condition union, rules, presentation-only instructions, typed rubric evidence mappings, tagged structured evidence values, and diagnoses;
- strict `LabWorkflowSpec` v2 draft/validated schemas with setup, layout, action availability, coach/retry, rubric, safety, presentation, compatibility, provenance, and validation-artifact data;
- a separately named schema-version facade that parses v1 or v2 while historical unversioned aliases remain pinned to v1;
- pure exact v1-to-v2 migration that preserves all supported v1 setup, workflow, coach, retry, rubric, safety, and presentation semantics or fails closed;
- version-aware hashing that preserves v1 bytes and uses the frozen `lab-workflow-spec\0schema=2.0.0\0` domain for strict JSON-safe v2 content.
- strict version-dispatched v2 hard validation with injected registry provenance, exact capability/setup/action/material/model/rule/evidence/safety resolution, graph checks, deterministic issue ordering, current-hash artifact revalidation, and Judge non-authority.
- a framework-free generic `ExperimentDefinition` coordinator that compiles exact validated bindings once, admits only current contract-runnable v2 artifacts, dispatches typed actions through exact code-owned ports, and keeps Preview/Assign closed.
- a serializable conserved material ledger, typed executed-transfer deltas, exact quantity/capacity enforcement, and code-owned liquid equipment adapters for bounded fill, dispense, rinse projection, and read mechanics;
- one validated chemistry-free distilled-water transfer fixture that executes through the generic coordinator without family dispatch.

Subsequent tickets through `LC2-409` add executable compatibility-scoped chemistry resolution, the evaluator/event/trace path, setup-driven titration, shared human authoring commands, exact-hash Preview, and the pose-driven 3D Composer bench. Phase 5 adds the second adaptable lab through the same coordinator, student Preview, and Composer. Phase 6 adds the bounded capability author over the shared commands and its explicit teacher-controlled handoff. Phase 7 adds the authored-rubric evaluator, independent exact-hash advisory Workflow Judge, bounded teacher-controlled revision orchestration, and diagnosis-aware Student Coach. Immutable definition assignment storage remains Phase 8 work. Production student defaults remain on the v1 titration compatibility path.

The generic-runtime and setup-driven titration path are implemented through Phase 3, and the capability-safe human Composer is implemented through `LC2-409`. `LC2-500` adds exact family-neutral volumetric-pipette, volumetric-flask, wash-bottle, stock-solution, diluent, pose, visual, transfer, conditioning, fill-to-mark, and mixing contracts. `LC2-501` adds the verified bounded aqueous concentration/dilution model: it consumes the same executed ledger transfers, depends explicitly on the shared ledger/volume/mixing provider, reports concentration to `0.000001 mol/L` and volume to `0.000001 mL`, and rejects unregistered identities or multi-flask setups. `LC2-501A` adds additive schema 2.1 material initialization, canonical bounded decimals, exact registered unit/range/safety/model validation, shared set/change/clear commands, a plain-language teacher control, save/load compatibility, and deterministic initialization for custom sodium-chloride stock values. `LC2-502` adds a checked-in, schema-parsed, canonical-hash-pinned sodium-chloride solution-preparation definition that is recreated through the shared command layer and passes the mandatory five-trace generic-runtime suite. `LC2-503` renders and previews that native workflow through the shared setup-driven student workspace, exposes it as a human-authorable template, verifies save/load/replay and all five paths, and records the passing ten-criterion [Level 2 gate](level-2-gate.md). `LC2-600`–`LC2-602` add exact server-only discovery/edit tools, the bounded validate/trace/revise loop, and a plain-language proposal workspace that requires teacher acceptance and locally verifies the exact draft before Preview. `LC2-700`–`LC2-703` add exact authored-rubric evaluation, advisory teaching review, and Coach context tied to current validated definitions and deterministic runtime diagnoses/evidence. Mixing readiness remains equipment/rule state rather than a second chemistry calculation. Deterministic validation remains the sole Preview authority, and production student defaults remain unchanged.

## Non-negotiable implementation sequence

```text
capability and schema contracts
  -> v1-to-v2 migration and hard validation
  -> generic deterministic runtime and constraint evaluator
  -> titration compatibility migration and parity
  -> human composer and preview
  -> second lab through the same runtime
  -> agent command loop and executable traces
  -> evaluator, Judge, and coach integration
  -> immutable persistence, assignment, hardening, cleanup
```

If a ticket depends on a later arrow, stop. Do not fill the gap with a family switch, hard-coded template, mocked runtime result, or client-side chemistry.

## Working procedure for downstream agents

1. Run `git status --short`. The worktree may contain user changes. Never reset or overwrite them.
2. Confirm dependencies in [`tickets/README.md`](tickets/README.md) are complete in code and tests, not merely documented.
3. Read the active ticket and copy its acceptance checklist into the working plan.
4. Inspect named files and search for all consumers before changing a public type.
5. Add or update the focused test first when a compatibility behavior is at risk.
6. Implement only the active ticket. Use adapters rather than replacing a legacy path prematurely.
7. Run focused tests, typecheck, lint, full unit tests, and any build/e2e gates named by the ticket.
8. Update the implementation status and only those contract docs changed by the ticket.
9. End with the exact `AGENTS.md` completion report, including schema, registry, migration, and documentation follow-ups.

## Stop conditions

Stop and report a blocker instead of guessing when any of these occur:

- a required registry ID is absent from the active ticket or current registry;
- a chemistry capability would require a new formula not authorized by a chemistry-owned ticket;
- a proposed action cannot pass through `ExperimentDefinition.step()`;
- v1 parsing, hash, replay, or student behavior would change without a compatibility test;
- a UI ticket requires a schema, runtime, or persistence change outside its ownership boundary;
- an agent or Judge route would need to self-certify validation;
- a saved session cannot be replayed without deleting or mutating historical data;
- support would require arbitrary authored chemicals, formulas, code, or expressions;
- the only apparent implementation is a `switch` on `familyId`.

## Definition of “generic” in this repository

A path is generic only when:

- it resolves exact registered equipment, actions, materials, adapters, model capabilities, and rules from the validated definition;
- it does not select behavior from `familyId`;
- its meaningful actions enter one generic `ExperimentDefinition.step()` coordinator or an explicit compatibility adapter;
- it executes at least migrated titration and the second adaptable lab without adding a lab-family runtime branch;
- its tests prove multiple valid workflow orders, deterministic replay, and unsupported capability rejection.

Renaming a titration switch to “generic,” accepting `unknown` adapter values, or loading one hard-coded template does not satisfy this definition.

## Execution-pack index

- [`current-system-map.md`](current-system-map.md): exact implemented surfaces, coupling, and source/test references.
- [`contract-blueprint.md`](contract-blueprint.md): proposed package layout, interface responsibilities, reserved IDs, and dependency boundaries.
- [`migration-playbook.md`](migration-playbook.md): v1/v2, runtime, UI, event, replay, and persistence compatibility procedure.
- [`verification-playbook.md`](verification-playbook.md): test matrix, commands, performance targets, and release gates.
- [`tickets/README.md`](tickets/README.md): authoritative LC2 dependency map and per-phase ticket specifications.
- [`downstream-agent-handoff.md`](downstream-agent-handoff.md): copy/paste prompt and completion checklist for one LC2 ticket.
