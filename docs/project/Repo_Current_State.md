# Repo Current State — Capability-Driven Lab Composer

## Architecture correction

The original Lab Composer direction—structured teacher/AI-authored workflows over verified deterministic primitives—remains valid. The initial implementation narrowed that idea to one family-oriented titration runtime. The current program corrects the runtime boundary without discarding deterministic truth, exact validation, the existing Lab IR, coaching/evaluation evidence, or shipped student behavior.

The governing principle is:

> A lab is a validated composition of reusable equipment, exact materials, deterministic chemistry capabilities, workflow constraints, and assessment rules. Titration is one authored lab, not the architecture.

`familyId` may remain optional catalog metadata. It must not select runtime behavior or compatibility.

## Implemented transitional foundation

Current source includes:

- deterministic titration and precipitation experiment definitions through `ExperimentDefinition.step()`;
- v1 exact registries for the supported titration workflow;
- strict `LabWorkflowSpec` `1.0.0`;
- canonical hashing and deterministic hard validation/eligibility;
- canonical endpoint-control seed and replay validation;
- a titration-specific workflow assembler and exact adapters;
- an initial server-only family-oriented Author Agent route.

These pieces are compatibility inputs. They do not establish a generic Composer or Level 2/Level 3 support.

## Missing capability-driven layers

- equipment and chemistry capability contracts;
- capability-based action/material/model resolution;
- `LabWorkflowSpec` v2 and deterministic v1 migration;
- generic action coordinator and bounded chemistry modules;
- partial-order workflow evaluator and diagnoses;
- structured event envelopes and normalized trace replay;
- setup-driven student scene/runtime;
- non-LLM human visual Composer and shared domain commands;
- second lab through the same runtime;
- capability-driven agent tools and trace/revision loop;
- Lab Workflow Judge implementation;
- authored-rubric evaluator/diagnosis-aware coach integration;
- immutable definition approval, assignment, and historical replay persistence.

## Current authority and next work

- Architecture and risks: [`../lab-composer-architecture.md`](../lab-composer-architecture.md)
- Downstream execution guide: [`../lab-composer/README.md`](../lab-composer/README.md)
- Exact ticket backlog: [`../lab-composer/tickets/README.md`](../lab-composer/tickets/README.md)
- Detailed living implementation record: [`../Repo_Current_State.md`](../Repo_Current_State.md)

`LC2-000` is complete. `LC2-100` is the next normal implementation ticket. The old T0210–T0220 order is superseded. Agent/Judge work waits until the non-LLM Level 2 gate passes.

## Compatibility boundary

- Existing v1 schemas, hashes, fixtures, titration behavior, events, replay, checkpoint payloads, coach/evaluator behavior, and static assignments remain supported through explicit adapters.
- New or edited drafts are unvalidated until a current deterministic hash-matching result is produced.
- Unsupported capabilities remain non-runnable.
- Existing optional `workflowVersionId` is provenance only until Phase 8 persistence implements immutable definition versions and assignment gates.
- Legacy paths are removed only by `LC2-804` after parity, migration, historical replay, performance, and manual verification.
