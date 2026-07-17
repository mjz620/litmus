# Current Lab Composer System Map

**Audited:** 2026-07-17
**Purpose:** give implementation agents a factual map of the repository before they extend contracts. “Current” means implemented in source, not merely planned in documentation.

## Support status legend

- **Implemented:** code and focused tests exist.
- **Transitional:** implemented and required for compatibility, but not the target abstraction.
- **Prototype:** implemented but must not be treated as production-complete.
- **Missing:** no implementation exists.

## Core deterministic runtime

| Surface | Status | Source | Existing evidence | Instruction |
| --- | --- | --- | --- | --- |
| `ExperimentDefinition` | Implemented, reusable | [`src/experiments/shared/experiment.ts`](../../src/experiments/shared/experiment.ts) | experiment/store tests | Preserve `step()` as the only meaningful action transition |
| `SemanticEvent` and `SkillEvidence` | Implemented, requires additive extension | same file | experiment, coach, persistence tests | Preserve legacy payload fields; add event metadata through a versioned envelope |
| `StudentModel` fold | Implemented, reusable | same file | store/coach tests | Do not move it into LLM or persistence code |
| Titration truth | Implemented compatibility oracle | [`src/experiments/titration/titration.ts`](../../src/experiments/titration/titration.ts) | [`tests/experiments/titration.test.ts`](../../tests/experiments/titration.test.ts) and related tests | Adapt before decomposing; never copy its formulas into Composer/UI |
| Titration replay | Implemented | [`src/experiments/titration/replay.ts`](../../src/experiments/titration/replay.ts) | [`tests/experiments/titration-replay.test.ts`](../../tests/experiments/titration-replay.test.ts) | Keep old trace compatibility |
| Precipitation truth | Implemented static experiment | [`src/experiments/precipitation`](../../src/experiments/precipitation) | precipitation tests | Do not call it generic Composer support; migrate only in a later explicit ticket |
| Static experiment registry | Implemented, transitional | [`src/experiments/registry.ts`](../../src/experiments/registry.ts) | registry tests | Keep until setup-driven runtime parity and historical routing are proven |

## LabWorkflowSpec v1 and registries

| Surface | Status | Source | Current coupling |
| --- | --- | --- | --- |
| v1 strict schema | Implemented | [`src/lab-workflows/schema.ts`](../../src/lab-workflows/schema.ts) | requires family, one engine, one seed, and ordered steps |
| canonical hash | Implemented | [`src/lab-workflows/hash.ts`](../../src/lab-workflows/hash.ts) | excludes only support/validation/Judge artifacts; array order is significant |
| hard validator and eligibility | Implemented | [`src/lab-workflows/validation.ts`](../../src/lab-workflows/validation.ts) | family/engine are compatibility authority; step order is exact |
| component registry | Implemented, transitional | [`src/lab-workflows/registries/components`](../../src/lab-workflows/registries/components) | titration components only; visual IDs are concrete export names; no capability/mechanical adapter IDs |
| action registry | Implemented, transitional | [`src/lab-workflows/registries/actions`](../../src/lab-workflows/registries/actions) | maps directly to titration action types and family/engine compatibility |
| reagent registry | Implemented, transitional | [`src/lab-workflows/registries/reagents`](../../src/lab-workflows/registries/reagents) | exact supported profiles but named as reagents and engine/family scoped |
| engine registry | Implemented, transitional | [`src/lab-workflows/registries/engines`](../../src/lab-workflows/registries/engines) | only `engine.titration.v1`; must not be cloned for dilution |
| skills | Implemented | [`src/lab-workflows/registries/skills`](../../src/lab-workflows/registries/skills) | availability currently derived from family/runtime support |
| events/flags | Implemented, transitional | [`src/lab-workflows/registries/event-flags`](../../src/lab-workflows/registries/event-flags) | exact titration event mapping; no normalized action/rule evidence metadata |
| configurations | Implemented, transitional | [`src/lab-workflows/registries/configurations`](../../src/lab-workflows/registries/configurations) | heterogeneous categories share one family-scoped entry type |
| safety | Implemented, limited | [`src/lab-workflows/registries/safety`](../../src/lab-workflows/registries/safety) | current virtual titration policies only |

Focused evidence lives under [`tests/lab-workflows`](../../tests/lab-workflows). The Phase 0 coupling baselines are in [`currentArchitectureCharacterization.test.ts`](../../tests/lab-workflows/currentArchitectureCharacterization.test.ts).

## Composer runtime and fixture

| Surface | Status | Source | Instruction |
| --- | --- | --- | --- |
| canonical titration workflow | Implemented | [`src/lab-workflows/seeds/endpointControlPrelab.ts`](../../src/lab-workflows/seeds/endpointControlPrelab.ts) | Keep readable and hash-stable; migrate with a golden v1-to-v2 fixture |
| seed replay validator | Implemented, transitional | [`src/lab-workflows/seedReplay.ts`](../../src/lab-workflows/seedReplay.ts) | Do not add more family cases; replace with normalized trace runner later |
| titration adapter | Implemented, transitional | [`src/lab-workflows/adapters/titration`](../../src/lab-workflows/adapters/titration) | Make legacy dependency visible; retain through parity and historical replay |
| titration workflow assembler | Implemented, transitional | [`src/lab-workflows/runtime/titrationRuntime.ts`](../../src/lab-workflows/runtime/titrationRuntime.ts) | Current steps are runtime control flow; do not generalize by adding family switches |
| generic coordinator | Missing | future `src/lab-workflows/runtime/generic/**` | Build only after v2 contracts/validator exist |
| constraint evaluator/diagnoses | Missing | future `src/lab-workflows/evaluation/**` | Consume observables/events; never calculate chemistry |
| chemistry module resolution | Missing | future `src/lab-workflows/chemistry-models/**` | Resolve exact verified modules, not one engine per lab |

## Production student UI and state

| Surface | Status | Source | Coupling / migration rule |
| --- | --- | --- | --- |
| route shell | Implemented, transitional | [`src/app/lab/[experimentId]/LabRouteShell.tsx`](../../src/app/lab/[experimentId]/LabRouteShell.tsx) | Selects titration vs precipitation workspace by state/experiment; preserve behind compatibility flag |
| session hook | Implemented, transitional | [`src/components/lab/useLabSession.ts`](../../src/components/lab/useLabSession.ts) | Builds experiment-specific configs |
| lab store | Implemented, transitional | [`src/stores/labStore.ts`](../../src/stores/labStore.ts) | Explicit experiment unions/branches, but actions do call `step()` |
| titration workspace/scene | Implemented, compatibility target | [`src/components/lab/titration`](../../src/components/lab/titration) | Keep behavior and accessibility until setup-driven parity |
| fixed 3D equipment graph | Implemented, adapter candidates | [`src/components/lab/three/LabScene.tsx`](../../src/components/lab/three/LabScene.tsx) and neighboring equipment files | Resolve exact visual adapters later; do not import these from core contracts |
| precipitation workspace | Implemented static UI | [`src/components/lab/precipitation`](../../src/components/lab/precipitation) | Do not copy this page pattern for dilution |
| setup-driven student scene | Missing | future setup runtime/UI files | One rendering path for serialized supported setups |

The ongoing visual overhaul in these files belongs to the user and may be present as uncommitted work. Contract agents must not rewrite or reset it.

## Coach, evaluator, and agents

| Surface | Status | Source | Migration rule |
| --- | --- | --- | --- |
| deterministic coach trigger | Implemented | [`src/lib/agent/triggerPolicy.ts`](../../src/lib/agent/triggerPolicy.ts), [`src/lib/agent/coach.ts`](../../src/lib/agent/coach.ts), and [`tests/coach`](../../tests/coach) | Preserve question/retry/flag/negative-evidence triggers and positive stay-silent tests |
| coach API/model | Implemented | [`src/app/api/coach`](../../src/app/api/coach) | Add optional diagnosis/rule context only after those contracts exist; no state mutation |
| student report evaluator | Implemented | [`src/app/api/evaluate`](../../src/app/api/evaluate) and evaluator agent files | Later consume authored rubric/diagnoses/evidence IDs; keep deterministic fallback |
| Author Agent prototype | Prototype | [`src/lib/agent/lab-authoring`](../../src/lib/agent/lab-authoring), [`src/app/api/lab-composer/author`](../../src/app/api/lab-composer/author) | Family-oriented and not Level 3; freeze until shared command service exists |
| Workflow Judge | Missing | no source directory | Implement in Phase 7, not before Level 2 |
| shared human/agent command service | Missing | future `src/lab-workflows/authoring/**` | Human composer must use it before agent tools wrap it |

## Persistence, assignments, replay, and demo

| Surface | Status | Source | Limitation / rule |
| --- | --- | --- | --- |
| checkpoint queue/API | Implemented | [`src/lib/persistence`](../../src/lib/persistence), [`src/app/api/sessions`](../../src/app/api/sessions) | Nonblocking/idempotent; optional `workflowVersionId` is provenance only |
| Supabase sessions/events/assignments | Implemented for static experiments | [`supabase`](../../supabase) | No immutable Composer definition/version authority yet |
| demo trace/reset | Implemented, titration-specific | [`src/lib/demo`](../../src/lib/demo), [`src/app/demo`](../../src/app/demo) | Preserve old demo; later add a versioned generic fixture through production paths |
| immutable lab-definition versions | Missing | persistence-owned future ticket | Required before assignment |
| definition-pinned historical replay | Missing | future persistence/runtime integration | Must retain legacy engine/adapter versions |

## Existing test suites that must remain green

Do not duplicate these wholesale. Extend them when the corresponding contract changes.

- Chemistry and replay: `tests/experiments/**`
- Store and action path: `tests/stores/**`
- Student controls/scenes: `tests/components/**`, `tests/e2e/titration-*.spec.ts`
- Coach: `tests/coach/**`, `tests/api/coach.test.ts`
- Evaluator/report/retry: evaluator API, report, and retry tests under `tests/api`, `tests/components`, and `tests/e2e`
- Persistence/checkpoints: `tests/persistence/**`, `tests/api/checkpoint.test.ts`, `tests/db/**`
- Demo: `tests/demo/**`, `tests/e2e/demo-flow.spec.ts`
- Composer v1: `tests/lab-workflows/**`
- Author prototype: `tests/ai/lab-composer/authoring/**`

## Known documentation traps

- [`../Repo_Current_State.md`](../Repo_Current_State.md) historically said no Composer runtime existed. It must remain updated after each LC2 milestone.
- [`../project/Repo_Current_State.md`](../project/Repo_Current_State.md) described T0200 as next. That sequence is superseded.
- The old `T0210` Judge ticket appears next in numeric order but must not be implemented before the Level 2 capability runtime and human composer.
- Examples in product/schema docs are not runnable registry entries.
- A static precipitation engine does not prove Composer reuse.
- `familyId` may remain for cataloging; it is not a runtime dispatch or compatibility key in the target.
