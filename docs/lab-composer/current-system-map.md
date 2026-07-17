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

## Versioned LabWorkflowSpec contracts and registries

| Surface | Status | Source | Current coupling |
| --- | --- | --- | --- |
| v1 strict schema | Implemented | [`src/lab-workflows/schema.ts`](../../src/lab-workflows/schema.ts) | requires family, one engine, one seed, and ordered steps |
| v2 strict schema | Implemented, structural only | [`src/lab-workflows/schema/v2.ts`](../../src/lab-workflows/schema/v2.ts) | parses bounded draft/validated shapes but grants no runnability |
| version-aware canonical hash | Implemented | [`src/lab-workflows/hash.ts`](../../src/lab-workflows/hash.ts) | v1 bytes remain frozen; v2 uses a frozen schema domain and rejects non-JSON input; only support/validation/Judge artifacts are excluded |
| pure v1-to-v2 migration | Implemented, non-authoritative | [`src/lab-workflows/schema/migration.ts`](../../src/lab-workflows/schema/migration.ts) | exact mappings only; stable IDs/provenance; always emits `draft_unvalidated` with null validation/Judge artifacts |
| v1 hard validator and eligibility | Implemented | [`src/lab-workflows/validation.ts`](../../src/lab-workflows/validation.ts) | family/engine are compatibility authority; step order is exact; v2 is not accepted yet |
| capability registry | Implemented contract metadata | [`src/lab-workflows/capabilities`](../../src/lab-workflows/capabilities) | exact equipment/chemistry categories and honest availability; no capability-driven runtime consumer yet |
| component registry | Implemented, transitional | [`src/lab-workflows/registries/components`](../../src/lab-workflows/registries/components) | current equipment has exact capabilities and state/config/visual/mechanical references; the titration adapter still consumes the deprecated concrete visual export name for v1 compatibility |
| action registry | Implemented, transitional | [`src/lab-workflows/registries/actions`](../../src/lab-workflows/registries/actions) | exact source/target capabilities, parameter schemas, preconditions, errors, event contracts, adapters, and behavior mode coexist with unchanged titration engine/family mappings |
| reagent/material registry | Implemented, transitional | [`src/lab-workflows/registries/reagents`](../../src/lab-workflows/registries/reagents) | `materialRegistry` is a facade over exact HCl, NaOH, three engine-supported indicators, and distilled water; quantity/config/schema metadata is present, while v1 engine/family/component fields remain authority |
| engine registry | Implemented, transitional | [`src/lab-workflows/registries/engines`](../../src/lab-workflows/registries/engines) | only `engine.titration.v1`; must not be cloned for dilution |
| skills | Implemented | [`src/lab-workflows/registries/skills`](../../src/lab-workflows/registries/skills) | availability currently derived from family/runtime support |
| events/flags | Implemented, transitional | [`src/lab-workflows/registries/event-flags`](../../src/lab-workflows/registries/event-flags) | exact titration event mapping; no normalized action/rule evidence metadata |
| configurations | Implemented, transitional | [`src/lab-workflows/registries/configurations`](../../src/lab-workflows/registries/configurations) | one registry now distinguishes legacy entries, declared strict schema metadata, and verified code-owned quantity presets |
| safety | Implemented, limited | [`src/lab-workflows/registries/safety`](../../src/lab-workflows/registries/safety) | current virtual titration policies only |

Focused evidence lives under [`tests/lab-workflows`](../../tests/lab-workflows). The Phase 0 coupling baselines are in [`currentArchitectureCharacterization.test.ts`](../../tests/lab-workflows/currentArchitectureCharacterization.test.ts).

### Stage 1A registry provenance

| Registry | Current snapshot | Historical snapshot retained |
| --- | --- | --- |
| capabilities | `capabilities.1.0.0` | none |
| components | `components.2.0.0` | `components.1.0.0` |
| actions | `actions.2.0.0` | `actions.1.0.0` |
| reagents/materials | `reagents.2.1.0` | `reagents.1.0.0`, `reagents.2.0.0` |
| configurations | `configurations.2.1.0` | `configurations.1.0.0`, `configurations.2.0.0` |
| engines | `engines.1.1.0` | `engines.1.0.0` |
| chemistry-model metadata | `chemistry-models.1.0.0` | none |

The capability and chemistry-model snapshots are not added to v1 validation artifacts because the v1 validator does not consume them. Component/action/reagent/configuration snapshot bumps make artifacts carrying their old snapshots stale until revalidation, while canonical v1 workflow content hashes remain unchanged. LC2-107 owns adding the new authorities to v2 validation provenance.

### V2 constraint contract building blocks

[`src/lab-workflows/schema/conditions.ts`](../../src/lab-workflows/schema/conditions.ts) now defines the closed thirteen-kind condition union, bounded rules, presentation-only instruction sections, typed rubric evidence mappings, tagged structured evidence values, and structured diagnoses. The additive event, observation, and registered-completion-policy variants preserve v1 evidence and completion semantics without treating them as chemistry observables. The registered completion condition is a closed compatibility primitive resolved by deterministic code; it is not an authored executable expression. [`src/lab-workflows/schema/v2.ts`](../../src/lab-workflows/schema/v2.ts) composes these into strict v2 draft/validated contracts and a separately named schema-version facade. Existing unversioned schema/type aliases remain pinned to v1 during migration so old consumers cannot accidentally accept v2. All of these schemas perform structural validation only: exact registry/local-reference resolution, graph checks, artifact freshness, rule compatibility, and runnability remain the responsibility of `LC2-107`, while condition evaluation remains missing until `LC2-203`.

[`src/lab-workflows/schema/migration.ts`](../../src/lab-workflows/schema/migration.ts) implements the pure `LC2-106` v1-to-v2 transform. It strictly parses v1, uses exact code-owned mappings, freezes the migration-version registry snapshots, preserves every supported authored semantic, translates ordered steps into explicit completion/precedence/action-availability constraints, and always clears validation/Judge authority. Unmapped quantities or IDs, rewritten safety policies, optional steps, incomplete completion evidence, and other uncharacterized semantics fail with stable migration codes and paths. [`src/lab-workflows/hash.ts`](../../src/lab-workflows/hash.ts) preserves historical v1 canonicalization and hashes v2 over the exact UTF-8 preimage `lab-workflow-spec\0schema=2.0.0\0<canonical-json>`. These features do not make v2 runnable; the hard validator remains v1-only until `LC2-107`.

## Composer runtime and fixture

| Surface | Status | Source | Instruction |
| --- | --- | --- | --- |
| canonical titration workflow | Implemented | [`src/lab-workflows/seeds/endpointControlPrelab.ts`](../../src/lab-workflows/seeds/endpointControlPrelab.ts) | Keep the v1 source readable and hash-stable; its deterministic v2 migration is frozen by the checked-in golden snapshot |
| seed replay validator | Implemented, transitional | [`src/lab-workflows/seedReplay.ts`](../../src/lab-workflows/seedReplay.ts) | Do not add more family cases; replace with normalized trace runner later |
| titration adapter | Implemented, transitional | [`src/lab-workflows/adapters/titration`](../../src/lab-workflows/adapters/titration) | Make legacy dependency visible; retain through parity and historical replay |
| titration workflow assembler | Implemented, transitional | [`src/lab-workflows/runtime/titrationRuntime.ts`](../../src/lab-workflows/runtime/titrationRuntime.ts) | Current steps are runtime control flow; do not generalize by adding family switches |
| generic coordinator | Missing | future `src/lab-workflows/runtime/generic/**` | Build only after v2 contracts/validator exist |
| constraint contracts | Implemented, structural only | [`src/lab-workflows/schema/conditions.ts`](../../src/lab-workflows/schema/conditions.ts) | Closed bounded data; parsing does not resolve IDs or make a workflow runnable |
| constraint evaluator/diagnoses | Missing | future `src/lab-workflows/evaluation/**` | Consume the implemented contracts plus observables/events; never calculate chemistry |
| chemistry model contracts/resolution | Implemented metadata layer | [`src/lab-workflows/registries/chemistry-models`](../../src/lab-workflows/registries/chemistry-models) | pure exact provider/dependency resolution exists; production metadata is intentionally empty and no chemistry implementation was extracted |

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
