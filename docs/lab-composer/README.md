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

The repository currently has the transitional Composer foundation through the initial author route:

- exact v1 registries for the supported titration workflow;
- `LabWorkflowSpec` `1.0.0`;
- canonical hashing, hard validation, and current-hash eligibility;
- canonical titration seed and replay validation;
- a titration-specific runtime assembler that still uses ordered steps as control flow;
- an initial family-oriented Lab Authoring Agent route.

It does not have the capability-driven contracts, v2 schema/migration, generic runtime, constraint evaluator, setup-driven student scene, human visual composer, second adaptable lab, shared agent command loop, Workflow Judge route, or immutable definition assignment storage.

The next unblocked implementation ticket is `LC2-100`. `LC2-001` is optional only if review identifies a concrete legacy behavior not already covered by existing tests. Do not start UI or agent work first.

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
