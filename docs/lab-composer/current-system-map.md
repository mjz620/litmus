# Current Lab Composer System Map

**Audited:** 2026-07-18
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
| capability registry | Implemented | [`src/lab-workflows/capabilities`](../../src/lab-workflows/capabilities) | reusable transfer, rinse, fill-to-mark, mix, and bounded concentration/dilution capabilities are verified |
| component registry | Implemented, transitional | [`src/lab-workflows/registries/components`](../../src/lab-workflows/registries/components) | titration plus family-neutral volumetric pipette/flask and wash bottle have exact state/config/visual/mechanical references; the v1 adapter still consumes deprecated concrete visual names only for legacy titration |
| action registry | Implemented, transitional | [`src/lab-workflows/registries/actions`](../../src/lab-workflows/registries/actions) | exact native transfer/conditioning/fill-to-mark/mix contracts coexist with unchanged nullable legacy engine mappings |
| reagent/material registry | Implemented, transitional | [`src/lab-workflows/registries/reagents`](../../src/lab-workflows/registries/reagents) | exact titration profiles, distilled water, fixed sodium-chloride compatibility stock, and a separately registered sodium-chloride identity with bounded schema 2.1 concentration authoring |
| engine registry | Implemented, transitional | [`src/lab-workflows/registries/engines`](../../src/lab-workflows/registries/engines) | only `engine.titration.v1`; must not be cloned for dilution |
| skills | Implemented | [`src/lab-workflows/registries/skills`](../../src/lab-workflows/registries/skills) | availability currently derived from family/runtime support |
| events/flags | Implemented, transitional | [`src/lab-workflows/registries/event-flags`](../../src/lab-workflows/registries/event-flags) | exact titration and native preparation action-event contracts; workflow evidence remains evaluator-owned |
| configurations | Implemented, transitional | [`src/lab-workflows/registries/configurations`](../../src/lab-workflows/registries/configurations) | exact titration and solution-preparation equipment/layout/quantity metadata |
| safety | Implemented, limited | [`src/lab-workflows/registries/safety`](../../src/lab-workflows/registries/safety) | separate verified virtual titration and solution-preparation notices plus restricted open flame |

Focused evidence lives under [`tests/lab-workflows`](../../tests/lab-workflows). The Phase 0 coupling baselines are in [`currentArchitectureCharacterization.test.ts`](../../tests/lab-workflows/currentArchitectureCharacterization.test.ts).

### Stage 1A registry provenance

| Registry | Current snapshot | Historical snapshot retained |
| --- | --- | --- |
| capabilities | `capabilities.2.0.0` | `capabilities.1.0.0`, `capabilities.1.1.0` |
| components | `components.3.0.0` | `components.1.0.0`, `components.2.0.0`, `components.2.1.0` |
| actions | `actions.3.0.0` | `actions.1.0.0`, `actions.2.0.0` |
| reagents/materials | `reagents.3.1.0` | `reagents.1.0.0`, `reagents.2.0.0`, `reagents.2.1.0`, `reagents.2.2.0`, `reagents.3.0.0` |
| configurations | `configurations.3.1.0` | `configurations.1.0.0` through `configurations.3.0.0` |
| scene placements | `scene-placements.2.0.0` | `scene-placements.1.0.0` |
| engines | `engines.1.1.0` | `engines.1.0.0` |
| chemistry-model metadata | `chemistry-models.2.0.0` | `chemistry-models.1.0.0`, `chemistry-models.1.1.0` |

The capability and chemistry-model snapshots are not added to v1 validation artifacts because the v1 validator does not consume them. Component/action/reagent/configuration snapshot bumps make artifacts carrying their old snapshots stale until revalidation, while canonical v1 workflow content hashes remain unchanged. The v2 validator now records every registry authority it consults, including capabilities, models, action subcontracts, and the engine registry used only by an explicit legacy compatibility descriptor.

### V2 constraint contract building blocks

[`src/lab-workflows/schema/conditions.ts`](../../src/lab-workflows/schema/conditions.ts) now defines the closed thirteen-kind condition union, bounded rules, presentation-only instruction sections, typed rubric evidence mappings, tagged structured evidence values, and structured diagnoses. The additive event, observation, and registered-completion-policy variants preserve v1 evidence and completion semantics without treating them as chemistry observables. The registered completion condition is a closed compatibility primitive resolved by deterministic code; it is not an authored executable expression. [`src/lab-workflows/schema/v2.ts`](../../src/lab-workflows/schema/v2.ts) composes these into strict v2 draft/validated contracts and a separately named schema-version facade. Existing unversioned schema/type aliases remain pinned to v1 during migration so old consumers cannot accidentally accept v2. These schemas perform structural validation only; [`src/lab-workflows/validation/v2.ts`](../../src/lab-workflows/validation/v2.ts) now performs exact reference/capability/model/safety resolution, static graph checks, provenance, and fail-closed eligibility. Runtime condition evaluation remains missing until `LC2-203`.

[`src/lab-workflows/schema/migration.ts`](../../src/lab-workflows/schema/migration.ts) implements the pure `LC2-106` v1-to-v2 transform. It strictly parses v1, uses exact code-owned mappings, freezes the migration-version registry snapshots, preserves every supported authored semantic, translates ordered steps into explicit completion/precedence/action-availability constraints, and always clears validation/Judge authority. Unmapped quantities or IDs, rewritten safety policies, optional steps, incomplete completion evidence, and other uncharacterized semantics fail with stable migration codes and paths. [`src/lab-workflows/hash.ts`](../../src/lab-workflows/hash.ts) preserves historical v1 canonicalization and hashes v2 over the exact UTF-8 preimage `lab-workflow-spec\0schema=2.0.0\0<canonical-json>`. Migrated titration now validates as contract-runnable only when the exact `runtime-adapter.titration.v1` descriptor is present; removing it leaves the compatibility-scoped chemistry model unresolved. Preview and assignment remain closed.

## Composer runtime and fixture

| Surface | Status | Source | Instruction |
| --- | --- | --- | --- |
| canonical titration workflow | Implemented | [`src/lab-workflows/seeds/endpointControlPrelab.ts`](../../src/lab-workflows/seeds/endpointControlPrelab.ts) | Keep the v1 source readable and hash-stable; its deterministic v2 migration is frozen by the checked-in golden snapshot |
| seed replay validator | Implemented, transitional | [`src/lab-workflows/seedReplay.ts`](../../src/lab-workflows/seedReplay.ts) | Do not add more family cases; replace with normalized trace runner later |
| titration adapter | Implemented, transitional | [`src/lab-workflows/adapters/titration`](../../src/lab-workflows/adapters/titration) | Make legacy dependency visible; retain through parity and historical replay |
| titration workflow assembler | Implemented, transitional | [`src/lab-workflows/runtime/titrationRuntime.ts`](../../src/lab-workflows/runtime/titrationRuntime.ts) | Current steps are runtime control flow; do not generalize by adding family switches |
| generic coordinator | Implemented and Composer Preview-enabled | [`src/lab-workflows/runtime/generic`](../../src/lab-workflows/runtime/generic) | Compiles current-hash runnable v2 definitions, coordinates exact mechanics/models/evaluation/events/replay, and selects atomic legacy compatibility only by validated adapter ID; Assign remains closed |
| reusable liquid mechanics and material ledger | Implemented and native Preview-enabled | [`src/lab-workflows/mechanics`](../../src/lab-workflows/mechanics), [`src/lab-workflows/chemistry-models/material-ledger`](../../src/lab-workflows/chemistry-models/material-ledger) | Exact adapters and conserved transfer deltas support bounded solution-preparation actions through the generic coordinator; unsupported semantics fail closed |
| constraint contracts | Implemented, structural only | [`src/lab-workflows/schema/conditions.ts`](../../src/lab-workflows/schema/conditions.ts) | Closed bounded data; parsing does not resolve IDs or make a workflow runnable |
| constraint evaluator/diagnoses | Implemented and Preview-enabled | [`src/lab-workflows/evaluation`](../../src/lab-workflows/evaluation) | Consumes registered observables and semantic evidence without calculating chemistry; shared student Preview exposes plain-language evidence and diagnoses |
| chemistry model contracts/resolution | Implemented for legacy titration and bounded native dilution | [`src/lab-workflows/registries/chemistry-models`](../../src/lab-workflows/registries/chemistry-models), [`src/lab-workflows/chemistry-models/concentration-dilution`](../../src/lab-workflows/chemistry-models/concentration-dilution) | exact provider/dependency resolution selects either the scoped legacy titration adapter or the family-neutral shared-liquid plus concentration modules; unsupported identities fail closed |

## Production student UI and state

| Surface | Status | Source | Coupling / migration rule |
| --- | --- | --- | --- |
| route shell | Implemented, transitional | [`src/app/lab/[experimentId]/LabRouteShell.tsx`](../../src/app/lab/[experimentId]/LabRouteShell.tsx) | Selects titration vs precipitation workspace by state/experiment; preserve behind compatibility flag |
| session hook | Implemented, transitional | [`src/components/lab/useLabSession.ts`](../../src/components/lab/useLabSession.ts) | Builds experiment-specific configs |
| lab store | Implemented, transitional | [`src/stores/labStore.ts`](../../src/stores/labStore.ts) | Explicit experiment unions/branches, but actions do call `step()` |
| titration workspace/scene | Implemented, compatibility target | [`src/components/lab/titration`](../../src/components/lab/titration) | Keep behavior and accessibility until setup-driven parity |
| pose-driven 3D equipment graph | Implemented for current verified adapters | [`src/components/lab/three/LabScene.tsx`](../../src/components/lab/three/LabScene.tsx), [`src/lab-workflows/registries/scene-placements`](../../src/lab-workflows/registries/scene-placements) | Exact registered poses drive equipment, linked apparatus alignment, focus cameras, and indicator paths; no authored coordinates |
| precipitation workspace | Implemented static UI | [`src/components/lab/precipitation`](../../src/components/lab/precipitation) | Do not copy this page pattern for dilution |
| setup-driven student scene | Implemented for compatibility titration and native solution preparation | [`src/components/lab/titration/setupDrivenScene.ts`](../../src/components/lab/titration/setupDrivenScene.ts), [`src/components/lab/setup-driven`](../../src/components/lab/setup-driven) | Resolves exact visual adapters, poses, and typed controls from validated setup; Composer Preview uses the same generic coordinator while production defaults remain unchanged |

The ongoing visual overhaul in these files belongs to the user and may be present as uncommitted work. Contract agents must not rewrite or reset it.

## Coach, evaluator, and agents

| Surface | Status | Source | Migration rule |
| --- | --- | --- | --- |
| deterministic coach trigger | Implemented for legacy evidence and v2 diagnoses | [`src/lib/agent/triggerPolicy.ts`](../../src/lib/agent/triggerPolicy.ts), [`src/lib/agent/coach.ts`](../../src/lib/agent/coach.ts), and [`tests/coach`](../../tests/coach) | Questions/retries remain explicit; flags, repeated negative evidence, and violated diagnoses are local trigger inputs; routine success remains silent and event reasons remain deduplicated in the store |
| coach API/model | Implemented with legacy and diagnosis-aware v2 adapters | [`src/app/api/coach`](../../src/app/api/coach), [`src/lib/agent/authoredCoach.ts`](../../src/lib/agent/authoredCoach.ts), [`src/lib/agent/authoredCoachSchemas.ts`](../../src/lib/agent/authoredCoachSchemas.ts) | V2 rechecks current definition eligibility/hash plus exact objective/instruction/rule/diagnosis/evidence/action projections; output is advisory-only, four-way authority-labeled, timeout-bounded, and unable to mutate/reset/control the workflow; invalid/down providers use deterministic authored guidance while legacy sessions retain the old contract |
| student report evaluator | Implemented with legacy and authored-rubric contracts | [`src/app/api/evaluate`](../../src/app/api/evaluate), [`src/lib/agent/evaluator.ts`](../../src/lib/agent/evaluator.ts), [`src/lib/agent/authoredEvaluator.ts`](../../src/lib/agent/authoredEvaluator.ts) | Legacy sessions retain the four fixed dimensions/retry behavior; v2 requires an exact current definition and matching generic runtime provenance, cites only supplied evidence IDs, never projects hidden ground truth to the model, and falls back to deterministic authored-rubric scoring |
| Author Agent legacy endpoint | Retired (410 Gone) | [`src/app/api/lab-composer/author`](../../src/app/api/lab-composer/author) | Family v1 route is hard-retired; use capability author only |
| Capability author tools | Implemented, server-only | [`src/lib/agent/lab-authoring/capabilityTools.server.ts`](../../src/lib/agent/lab-authoring/capabilityTools.server.ts) | Eleven fixed bounded tools expose exact metadata and edit only the server-owned unvalidated draft through the shared human command transaction service; validation, simulation, approval, and assignment are not tools |
| Capability author loop and Composer handoff | Implemented, teacher-controlled | [`src/lib/agent/lab-authoring/capabilityAuthor.ts`](../../src/lib/agent/lab-authoring/capabilityAuthor.ts), [`src/app/api/lab-composer/author/capability`](../../src/app/api/lab-composer/author/capability), [`src/components/teacher/lab-composer/ComposerAgentWorkspace.tsx`](../../src/components/teacher/lab-composer/ComposerAgentWorkspace.tsx) | Shows assumptions separately from deterministic validation and five real traces; an exact locally revalidated proposal enters the normal command editor only after explicit teacher acceptance; teacher edits stale generated evidence and close Preview until revalidation; unsupported/safety/limited results remain non-runnable |
| Workflow Judge | Implemented, advisory-only | [`src/lib/agent/lab-workflow-judge`](../../src/lib/agent/lab-workflow-judge), [`src/app/api/lab-composer/judge`](../../src/app/api/lab-composer/judge) | Requires current preview eligibility plus exact validation, derived capability summary, and all five hash-bound executed trace summaries; bounded critique cites exact paths/evidence and cannot alter workflow validation or eligibility |
| Composer teaching-review loop | Implemented, bounded and teacher-controlled | [`src/components/teacher/lab-composer/ComposerJudgePanel.tsx`](../../src/components/teacher/lab-composer/ComposerJudgePanel.tsx), [`src/components/teacher/lab-composer/composerJudgeCycle.ts`](../../src/components/teacher/lab-composer/composerJudgeCycle.ts) | Validator and advisory status remain separate; accepted suggestions are fixed shared commands tested on a candidate draft; only a runnable revalidation, five fresh real traces, and a matching follow-up review commit the change; three-call/two-revision/page-session and time/token/cost limits terminate the loop |
| shared human/agent command service | Implemented for both authoring paths | [`src/lab-workflows/authoring`](../../src/lab-workflows/authoring) | Human edits and server-owned agent edits use the same strict transaction service; the client accepts only a normal v2 draft and never a raw patch |

## Persistence, assignments, replay, and demo

| Surface | Status | Source | Limitation / rule |
| --- | --- | --- | --- |
| checkpoint queue/API | Implemented | [`src/lib/persistence`](../../src/lib/persistence), [`src/app/api/sessions`](../../src/app/api/sessions) | Nonblocking/idempotent; may pin `labDefinitionVersionId` + hash |
| Supabase sessions/events/assignments | Implemented with optional definition pins | [`supabase`](../../supabase) | Null-pin rows remain legacy static; pinned rows FK to `lab_definition_versions` |
| demo trace/reset | Implemented; titration defaults setup-driven | [`src/lib/demo`](../../src/lib/demo), [`src/app/demo`](../../src/app/demo) | `?runtime=legacy` retains the static retry demo path |
| mutable drafts and immutable lab-definition versions | Implemented | [`src/lib/persistence/labDefinitionRepository.ts`](../../src/lib/persistence/labDefinitionRepository.ts), Composer definition APIs, [`supabase`](../../supabase) | Approval revalidates server-side; Assign uses assignment eligibility |
| definition-pinned historical replay | Implemented | [`src/lib/persistence/sessionDefinitionResolver.ts`](../../src/lib/persistence/sessionDefinitionResolver.ts) | Fail closed on stale implementations; retain legacy adapters for null-pin rows |
| student assignment entry | Implemented | [`src/app/assignments/[assignmentId]`](../../src/app/assignments), [`src/lib/persistence/studentAssignmentLaunch.ts`](../../src/lib/persistence/studentAssignmentLaunch.ts) | Opens the exact pinned definition; null-pin rows stay legacy static; titration pinned path is wired to the student bench |

## Existing test suites that must remain green

Do not duplicate these wholesale. Extend them when the corresponding contract changes.

- Chemistry and replay: `tests/experiments/**`
- Store and action path: `tests/stores/**`
- Student controls/scenes: `tests/components/**`, `tests/e2e/titration-*.spec.ts`
- Coach: `tests/coach/**`, `tests/components/coachPanelPresentation.test.ts`, `tests/stores/labStore.test.ts`, and the setup-driven Coach Playwright case
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
