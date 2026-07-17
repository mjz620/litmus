# Capability-Driven Lab Composer Architecture

**Status:** Phase 0 architecture correction; **Last audited:** 2026-07-17
**Scope of this document:** characterize the current repository, preserve the original workflow intention, and define an incremental migration. It does not claim that the target contracts or Level 2 runtime are implemented.

## Executive conclusion

The repository already has a strong deterministic boundary: an `ExperimentDefinition` owns scientific truth, every simulation action enters through `step()`, semantic events feed the `StudentModel`, and checkpoints, replay, coaching, and evaluation consume the resulting records. Those contracts should be extended, not replaced.

The current Lab Composer is nevertheless a **titration workflow assembler**, not yet a laboratory composer. `LabWorkflowSpec` v1 requires one family, one engine, one initialization preset, and a totally ordered list of steps. Hard validation, action compatibility, seed replay, runtime assembly, and state projection all resolve through `family.acid_base_titration.v1` and `engine.titration.v1`. The production student routes do not load Composer definitions; the titration and precipitation interfaces each select a fixed workspace.

The correction is a versioned evolution of the existing Lab IR and registries:

> A lab is a validated composition of reusable equipment, exact registered materials, typed actions, bounded deterministic chemistry capabilities, workflow constraints, and assessment rules. Titration is one authored lab, not the architecture.

“Deterministic” describes how scientific truth is calculated. It does not require one hard-coded engine family per authored experiment.

## Sources inspected

This audit used implementation, tests, fixtures, product documentation, architecture documentation, AI prompts, persistence paths, and demo flows rather than inferring intent only from code.

- Core contracts and engines: [`src/experiments`](../src/experiments), especially [`shared/experiment.ts`](../src/experiments/shared/experiment.ts), [`titration/titration.ts`](../src/experiments/titration/titration.ts), and [`precipitation/precipitation.ts`](../src/experiments/precipitation/precipitation.ts).
- Composer IR, registries, validation, seeds, runtime, and adapters: [`src/lab-workflows`](../src/lab-workflows).
- Student runtime and scene: [`src/stores/labStore.ts`](../src/stores/labStore.ts), [`src/components/lab/useLabSession.ts`](../src/components/lab/useLabSession.ts), and [`src/components/lab`](../src/components/lab).
- Coach and evaluation: [`src/lib/agent`](../src/lib/agent), [`src/app/api/coach`](../src/app/api/coach), and the student report route under [`src/app/lab`](../src/app/lab).
- Persistence and demo paths: [`src/lib/persistence`](../src/lib/persistence), [`src/app/api/sessions`](../src/app/api/sessions), [`src/lib/demo`](../src/lib/demo), and [`supabase`](../supabase).
- Product and architecture intention: [`product/lab-composer.md`](product/lab-composer.md), [`architecture/composable-lab-runtime.md`](architecture/composable-lab-runtime.md), [`experiments/lab-workflow-schema.md`](experiments/lab-workflow-schema.md), [`ai/lab-authoring-agent.md`](ai/lab-authoring-agent.md), [`ai/lab-workflow-judge-agent.md`](ai/lab-workflow-judge-agent.md), and [`project/implementation-roadmap-lab-composer.md`](project/implementation-roadmap-lab-composer.md).
- Characterization and compatibility evidence: [`tests/lab-workflows`](../tests/lab-workflows), [`tests/experiments`](../tests/experiments), [`tests/coach`](../tests/coach), [`tests/api`](../tests/api), [`tests/persistence`](../tests/persistence), and [`tests/demo`](../tests/demo).

## Current architecture

### Student runtime

```text
route experiment ID
  -> static experiment manifest
  -> experiment-specific session config
  -> experiment-specific workspace
  -> typed experiment action
  -> ExperimentDefinition.step()
  -> state + compact SemanticEvent[]
  -> in-memory StudentModel
  -> asynchronous coach/checkpoint consumers
  -> report evaluator and teacher analytics
```

There are two registered experiment plugins:

- `acid_base_titration`, backed by a deterministic titration definition and a purpose-built 3D workspace.
- `precipitation_solubility`, backed by a deterministic precipitation definition and a separate form-oriented workspace.

The store preserves the important invariant that meaningful actions call `ExperimentDefinition.step()`. It also contains explicit experiment-ID branches and unions of each engine's config, state, and action types. The route shell selects between `TitrationWorkspace` and `PrecipitationWorkspace`; it is not setup-driven.

### Composer v1

```text
LabWorkflowSpec 1.0.0
  -> exact registry lookup
  -> family/engine compatibility checks
  -> canonical hash + validation artifact
  -> titration-specific assembler
  -> current ordered step
  -> exact titration action adapter
  -> existing titration ExperimentDefinition.step()
  -> projected titration component state + legacy SemanticEvent[]
```

The implemented Composer surface currently includes:

- Exact component, action, reagent, engine, skill, event/flag, configuration, and safety registries.
- A bounded Zod `LabWorkflowSpec` v1 schema.
- Canonical hashing and a current-hash validation/eligibility gate.
- A verified canonical titration workflow fixture and replay validation.
- A titration-specific runtime assembler and exact adapters.
- An initial server-side Lab Authoring Agent route with constrained registry inspection and deterministic validation.
- Stage 1A exact capability, equipment, action, material, quantity, configuration-schema, and chemistry-model metadata contracts.
- A pure deterministic chemistry-model provider resolver over injected verified metadata; the production model registry is intentionally empty.

It does **not** yet include:

- Structured v2 condition/rule/diagnosis schemas or a v2 workflow validator.
- A v2 constraint-based workflow evaluator or structured diagnoses.
- A setup-driven production student runtime/scene.
- A teacher visual composer or shared editing command layer.
- Composer draft/version persistence, preview, approval, or assignment.
- A Lab Workflow Judge implementation.
- A second lab using a shared generic Composer runtime.
- An agent command loop that edits the same domain model as the human composer and executes trace suites.

### LabWorkflowSpec v1

The v1 schema is a useful existing Lab IR, but it presently makes these runtime-shaping fields mandatory:

- `familyId`
- one `engineId` and `engineConfigId`
- one `initializationPresetId`
- component instances with fixed placement slots
- exact reagent bindings
- `steps[]` with a contiguous numeric `order`
- actions and observations nested under the current step
- coach triggers, rubric criteria, retries, and safety constraints
- validation and advisory Judge artifacts

Hard validation correctly rejects unknown IDs, registry incompatibilities, unsupported safety configurations, stale hashes, and stale registry snapshots. It also treats family compatibility and exact sequential step order as authoritative. That is the primary contract seam to evolve, not a reason to create a second Lab IR.

### Registries

| Registry | Current useful contract | Current coupling |
| --- | --- | --- |
| Capabilities | Exact bounded equipment/chemistry IDs, category separation, availability, and exclusive chemistry-provider policy | Metadata is present, but the v1 validator/runtime does not consume it and chemistry providers remain unimplemented |
| Components | Exact IDs, state metadata, capabilities, actions, accessibility, safety, exact state/config/visual/mechanical references, performance tier | Component union remains titration-only; the v1 adapter still consumes a deprecated concrete visual export name and family compatibility metadata |
| Actions | Exact IDs, bounded parameter schemas, source/target capabilities, preconditions, errors, event contracts, adapters, and behavior mode | `engineActionType` and family/engine fields remain explicit v1 compatibility metadata; no generic coordinator consumes the new contracts yet |
| Reagents/materials | Exact verified HCl, NaOH, three deterministic indicators, distilled water, quantity presets, container capabilities, initialization schemas, and safety metadata | The material facade intentionally shares v1 reagent entries; water rinse remains a legacy action parameter without an invented physical quantity, and legacy family/engine/component fields remain v1 authority |
| Engines | Deterministic definition identity and exact supported IDs | Only `engine.titration.v1`; a family is the compatibility authority and assembly boundary |
| Skills | Exact learning-objective/evidence metadata and support visibility | Runtime support is inferred through family/engine availability; precipitation skill remains planned in Composer despite a standalone engine |
| Events/flags | Exact mapping from workflow IDs to engine semantic values | Mappings are titration-engine-specific; events lack stable runtime event IDs and sequences |
| Configurations | Exact presets for engine, seed, components, actions, observations, policies, placement, device, units, schemas, and quantities | Schema metadata is deliberately declared until v2 hard validation consumes it; legacy entries remain readable |
| Chemistry models | Framework-free module/metadata/implementation contracts plus exact verified-provider/dependency resolution | Production provider metadata and executable registrations are empty until the authorized compatibility/model tickets |
| Safety | Exact allow-list and deterministic validation hooks | Current entries cover the virtual titration setup, not capability/material/action policies generally |

### Titration truth layer

The titration `ExperimentDefinition` is deterministic and local. It owns initial state, pH and equivalence behavior, volume effects, indicator response, endpoint/flow flags, skill evidence, and report ground truth. No UI or LLM recomputes those values. It is both a scientific truth layer and a collection of titration-specific equipment mechanics today.

This implementation remains the compatibility oracle during migration. The first generic path should adapt its verified behavior before any formulas or semantics are decomposed. Later bounded model modules may extract reusable aqueous-solution capabilities only behind parity tests.

### Runtime assembler and adapters

`assembleTitrationWorkflow()` accepts only the validated titration spec. Its snapshot includes exact literal IDs for `engine.titration.v1` and `acid_base_titration`, a `TitrationState`, a current step index, and projected component views. The assembler sorts steps, allows only actions nested under the current step, adapts them to the titration action union, calls the existing definition's `step()`, and applies one of two hard-coded completion policies.

This adapter is explicit and safe, but it is not generic. A direct titration engine action can be valid while the Composer runtime rejects it solely because another ordered step is current. The new Phase 0 characterization test records that distinction.

### Equipment and 3D scene

The titration scene is composed in code from fixed apparatus:

- burette and stand;
- Erlenmeyer flask;
- indicator shelf;
- wash station;
- fixed poses and bench layout;
- titration-specific controls, prompts, measurement displays, and camera interactions.

These visual and interaction implementations are valuable adapter candidates. The current `LabScene`, `TitrationScene`, `labUiStore`, equipment IDs, and procedure staging assume their topology rather than loading instances and layout from serialized setup data. The precipitation experiment uses a different static interface. `ClassroomEnvironment` can remain shared room infrastructure while the active bench becomes setup-driven.

### Semantic events, StudentModel, replay, checkpoints, and persistence

The current `SemanticEvent` is compact and serializable: `type`, simulated time, observations, flags, and skill evidence. This is the shared contract for StudentModel folding, coach context, replay assertions, persistence, evaluator inputs, and teacher analytics. It does not contain a stable event ID, monotonic sequence, normalized action ID, equipment instance IDs, workflow rule IDs, or diagnosis references.

Checkpoint envelopes add a client event ID and monotonic sequence around events, and writes are queued so simulation does not wait on the network. Session records can retain a `workflowVersionId`, but the repository does not yet persist immutable workflow-definition versions. Assignments still point to static experiment identity. Titration has action replay through the same deterministic `step()` path; the demo trace schema is titration-state-specific.

### Student coach

The deterministic trigger policy calls the coach for questions, retries, flags, or repeated negative evidence and deliberately stays silent on routine success. Model output is structured and forbidden from determining chemistry. The coach currently receives experiment state, recent events, and StudentModel context. It does not receive typed workflow diagnoses, the active authored rule, or a generalized equipment/action context.

The trigger policy and stay-silent semantics are reusable. The request context requires a backward-compatible extension after diagnoses exist; the model must remain advisory and asynchronous.

### Student report evaluator

The evaluator consumes the assigned experiment, final state, events, StudentModel, and student report. Its response is structured and has a deterministic fallback. The current rubric dimensions and retry recommendation types are fixed around the shipped experience; they are not yet derived from an authored Composer rubric, constraint diagnoses, or evidence mappings.

The evaluator remains distinct from deterministic truth. It may later judge coherence, mastery, misconceptions, and unusual valid approaches from authored objectives, rubric, event evidence, diagnoses, final observables, and responses. It must never reconstruct chemistry from prose.

### Lab Workflow Judge

The product, prompt, schema, and evaluation documents define an independent advisory Judge for the authored lab. The workflow schema already has a place for a hash-bound critique. No executable Judge route currently exists. Judge approval cannot override hard validation, and this missing service is not a Level 2 blocker.

### Lab Authoring Agent

The prototype author route has strict structured output, rate limits, registry inspection, a deterministic mock, and hard validation. Its tools search by supported family and return existing components, reagents, and one engine. It cannot yet use shared human-authoring domain commands, assemble capabilities, execute generic traces, or revise a draft through a bounded loop. It should remain described as a prototype—not completed Level 3—until the Level 2 gate passes.

### Saved-state and assignment compatibility

Existing persisted sessions and demo traces identify static experiment versions and may optionally carry workflow provenance. They do not embed arbitrary authored chemistry. Migration must preserve:

- old checkpoint payload parsing and idempotent event writes;
- deterministic replay through the definition version that created the session;
- static experiment assignments and demo routes;
- legacy v1 fixtures and canonical hashes;
- historical coach/evaluator inputs;
- sessions without any Composer workflow version.

## Implementation classification

| Part | Classification | Architectural treatment |
| --- | --- | --- |
| `ExperimentDefinition` and `step()` invariant | Reusable unchanged | Generic lab runtime implements or adapts this contract; no meaningful action bypasses it |
| Titration scientific truth and current behavior | Reusable through an adapter | Use as compatibility oracle, then extract bounded model capabilities only with parity evidence |
| Precipitation scientific truth | Reusable through an adapter | Remains standalone until supported capabilities and setup are declared; it is not evidence of generic Composer support today |
| Static experiment manifest loading | Titration-specific but temporarily necessary | Preserve production routes until setup-driven parity; remove experiment-family dispatch only after migration |
| Compact semantic event fields and skill evidence | Requiring a backward-compatible contract extension | Add a versioned envelope/metadata for stable identity, actions, instances, and rule evidence |
| StudentModel fold | Reusable unchanged initially | Continue consuming evidence; future objective/rubric mappings may extend context without network dependency |
| Store checkpoint and coach queues | Reusable through an adapter | Generic session store can retain nonblocking consumers while replacing experiment-ID unions incrementally |
| Checkpoint repository and API | Reusable through an adapter | Add immutable lab version provenance without breaking v1 payloads or idempotency |
| `LabWorkflowSpec` v1 | Requiring a backward-compatible contract extension | Evolve as schema v2; keep strict v1 parser and deterministic migration |
| Canonical hashing and current-hash eligibility | Reusable through an adapter | Preserve v1 hash exactly; domain-separate v2 hashes and bind validation to exact migrated/current content |
| Hard validation framework | Reusable through an adapter | Replace family authority with exact capability, schema, adapter, material, model, rule, and safety resolution |
| Component registry | Reusable through an adapter | Stage 1A added equipment capabilities and exact references while preserving v1 fields; future runtime tickets consume them |
| Action registry | Reusable through an adapter | Stage 1A added source/target capabilities, schemas, preconditions, errors, events, behavior, and adapter IDs without changing execution |
| Reagent registry | Reusable through an adapter | Stage 1A added a material facade and quantity/container metadata while preserving exact v1 material values and authority |
| Engine registry | Obsolete only after replacement parity | Keep the titration adapter while chemistry-model capabilities replace engine/family compatibility authority |
| Skill registry | Reusable through an adapter | Map exact objectives to evidence and rubric semantics independent of lab family |
| Event/flag registries | Requiring a backward-compatible contract extension | Retain exact mappings and add action/rule/equipment evidence contracts plus compatibility versions |
| Configuration registry | Reusable through an adapter | Stage 1A added exact schema/quantity facets; v2 validation must enforce declared versus verified availability |
| Safety registry | Reusable through an adapter | Resolve policies against exact material/action/equipment capabilities; validator retains veto authority |
| Titration runtime assembler and adapters | Titration-specific but temporarily necessary | Explicit compatibility path behind a flag until serialized titration has action, event, replay, and visual parity |
| Fixed titration equipment visuals | Reusable through an adapter | Register exact visual and mechanical adapters without importing React/Three into core contracts |
| Fixed `LabScene`, controls, and `labUiStore` topology | Obsolete only after replacement parity | Setup-driven scene and interaction state eventually replace them; preserve current route during comparison |
| Precipitation static workspace | Titration-specific but temporarily necessary | Despite its name, this category means a fixed experiment UI; leave untouched until a scoped migration ticket |
| Coach trigger policy and structured response | Reusable through an adapter | Add diagnoses/rule context without changing deterministic trigger authority or stay-silent behavior |
| Student report evaluator | Requiring a backward-compatible contract extension | Consume authored objectives/rubric/diagnoses/evidence and retain deterministic fallback |
| Author Agent prototype | Requiring a backward-compatible contract extension | Move to the shared command service and executable trace loop only after Level 2 |
| Workflow Judge route | Missing | Implement later as advisory, independently versioned, exact-hash-bound critique |
| Teacher visual composer and domain commands | Missing | Build the non-LLM Level 2 authoring path first |
| Immutable definition/version persistence and assignment approval | Missing | Add versioned storage and exact assignment pins in a persistence-owned ticket |
| Generic runtime, constraint evaluator, diagnoses, and second reusable lab | Missing | Central Level 2 proof; no family dispatcher |

## Exact coupling points

The current system is coupled at several independent layers. Fixing only the runtime assembler would leave family dispatch elsewhere.

1. The v1 schema requires `familyId`, one `engineId`, and one initialization preset.
2. Engine entries own supported component, action, reagent, config, event, flag, and family lists.
3. Component, action, reagent, configuration, skill, event/flag, and safety validation all compare family and/or engine IDs.
4. Action entries map directly to the titration action union through `engineActionType`.
5. Runtime types contain literal titration engine/definition IDs and `TitrationState`.
6. The assembler resolves only the titration adapter and two hard-coded completion policies.
7. Ordered workflow steps act as exclusive runtime control flow, not presentation guidance.
8. Seed replay knows the exact titration engine and initialization preset.
9. The production route and store dispatch by static experiment ID, not a validated setup.
10. The 3D scene imports a fixed equipment graph and fixed layout.
11. Coach and evaluator context is experiment-oriented and has no structured workflow diagnosis.
12. Persistence stores session workflow provenance but not an immutable validated lab-definition version.
13. Author Agent tools discover families and one engine, not capabilities and shared commands.

## Original Workflow Feature Intention

The original workflow feature was intended to let teachers and a constrained AI author pedagogy over verified deterministic primitives. The intended lifecycle was: prompt or edit a structured draft, resolve exact registry IDs, validate locally, optionally obtain an advisory pedagogical critique, preview, explicitly approve, assign, run through deterministic simulation, and consume the same evidence in coaching and evaluation. The current implementation narrows that intention to titration, but it does not invalidate the lifecycle.

### Teacher perspective

**Deliberate behavior:** A teacher describes a learning objective and constraints, receives an editable structured workflow with visible support status, previews only a current validated result, sees hard validation separately from advisory Judge critique, and explicitly approves assignment.

**Current limitation:** There is no teacher Composer UI, preview, persisted draft/version, or assignment path. The author prototype can only assemble a family-oriented titration workflow.

**Semantics to preserve:** Exact IDs, visible assumptions and support limits, validation invalidation after edit, separate validator/Judge authority, explicit approval, and immutable assigned versions.

**Adaptable extension:** The teacher edits a physical setup and constraints through the same capability-checked domain commands available to the agent. Family becomes optional catalog metadata.

### Student perspective

**Deliberate behavior:** Students receive clear instructions and contextual coaching while manipulating real deterministic simulation state. Alternate behavior may create evidence, warnings, retries, or progress without allowing the LLM to mutate state.

**Current limitation:** Production UI is fixed per experiment. Composer v1 makes one ordered step the exclusive action gate, even when the engine safely accepts another order.

**Semantics to preserve:** Typed actions, deterministic feedback, stable objective/instruction presentation, accessible controls, recoverable retry behavior, and current titration interaction parity.

**Adaptable extension:** A validated setup determines equipment, layout, materials, available actions, measurements, instructions, and rule feedback. Constraint dependencies reject only scientifically, procedurally, or safely invalid actions/orders.

### Deterministic runtime perspective

**Deliberate behavior:** The runtime resolves exact supported primitives, requires a current hash-matching validation result, applies all meaningful actions through `ExperimentDefinition.step()`, and emits semantic evidence without network dependency.

**Current limitation:** Runtime eligibility and assembly are selected through one family/engine adapter, while ordered steps double as control flow.

**Semantics to preserve:** Local deterministic truth, exact adapter resolution, validation veto, seeded replay, immutable transitions, and no LLM involvement in scientific state.

**Adaptable extension:** One generic `ExperimentDefinition<LabRuntimeConfig, LabRuntimeState, NormalizedLabAction>` coordinates capability validation, equipment transitions, bounded chemistry-model transitions, events, and workflow diagnoses. Existing titration enters through an explicit compatibility adapter until equivalent modules are proven.

### Evaluator perspective

**Deliberate behavior:** Deterministic evidence and final state support structured pedagogical evaluation and a deterministic fallback; the LLM can judge writing and mastery but not calculate hidden truth.

**Current limitation:** Rubric dimensions and retry types are fixed and do not consume authored workflow criteria or diagnoses.

**Semantics to preserve:** Evidence-grounded output, evaluator/model/prompt versioning, uncertainty, fallback behavior, and separation from chemistry calculation.

**Adaptable extension:** Both deterministic and LLM evaluation consume the exact assigned definition, shared learning objectives/rubric semantics, event IDs, diagnoses, final observables, and student responses. Alternate valid approaches receive credit because the constraint evaluator identifies them as valid.

### Student coach perspective

**Deliberate behavior:** A deterministic trigger decides when coaching is warranted, routine success stays silent, and structured comments cannot mutate the simulation or claim chemistry authority.

**Current limitation:** Coach context does not identify active rules, permitted alternatives, structured diagnoses, or authored presentation guidance.

**Semantics to preserve:** Asynchronous calls, positive stay-silent cases, bounded responses, deterministic trigger authority, and evidence-grounded guidance.

**Adaptable extension:** The coach receives exact active objective/rule IDs and deterministic diagnoses. It explains or scaffolds them; it does not create a rule or physical result.

### Lab Workflow Judge perspective

**Deliberate behavior:** An independent advisory service reviews the authored lab for alignment, clarity, flexibility, fairness, safety presentation, feasibility, and teacher usability. Its critique binds to the exact spec hash.

**Current limitation:** Only documentation and schema support exist; the route is not implemented. The planned dimensions also predate explicit partial-order flexibility and generated trace evidence.

**Semantics to preserve:** Separate prompt/model versioning, exact-hash critique, advisory authority, visible issues and strengths, and inability to override validator failure.

**Adaptable extension:** The Judge receives the exact draft, deterministic validation, capability summary, rubric, and executed valid/invalid/tolerance trace results. It critiques alternate-path quality but cannot make the draft runnable.

### Persistence and replay perspective

**Deliberate behavior:** Semantic events are compact shared records, checkpoints are idempotent and nonblocking, seeded actions replay through deterministic code, and assignments preserve what a student was expected to run.

**Current limitation:** There is no immutable LabWorkflowSpec version store; `workflowVersionId` is only optional session provenance, and event identity is supplied by checkpoint envelopes rather than the semantic event itself.

**Semantics to preserve:** Network-independent simulation, compact event storage, monotonic checkpoint sequence, old payload readability, exact engine/definition version provenance, and historical replay.

**Adaptable extension:** Persist immutable approved definition versions and hashes. Sessions and assignments pin the exact version, registry snapshots, validator version, runtime compatibility version, and migration provenance. Event envelopes add stable action/equipment/rule evidence without snapshotting all state on every event.

## Visible behavior transition record

Every ticket that changes visible behavior must update this table or add an equivalent decision record.

| Surface | Previous behavior | Proposed behavior | Reason | Compatibility strategy | Transition evidence |
| --- | --- | --- | --- | --- | --- |
| Student route | Route ID selects a fixed titration or precipitation workspace | Validated definition selects a setup-driven workspace | One UI should render supported laboratory compositions | Keep current route behind compatibility flag until visual/action parity | Existing route/e2e tests plus side-by-side serialized titration tests |
| Action availability | Fixed controls plus current v1 step gate | Capability-, state-, safety-, and rule-checked typed actions | Accept alternate valid orders and reusable mechanics | v1 migration emits strict precedence constraints that reproduce the old sequence | Current architecture characterization and v1/v2 trace equivalence tests |
| Scene composition | Titration scene imports fixed equipment and positions | Scene resolves exact equipment/visual adapters and serialized layout | Make setup authorable without one page per lab | Reuse current visuals as adapters; compare screenshots and interaction traces | Titration visual parity and adapter-resolution tests |
| Instructions | Ordered steps are presentation and runtime control | Instruction sections reference rule IDs; constraints own correctness | Separate guidance from executable truth | Preserve v1 text and order after migration | Fixture snapshot and accessibility tests |
| Coach | Triggered from experiment events and StudentModel | Same trigger policy plus rule/diagnosis context | Give adaptable, evidence-grounded guidance | Add optional request fields and preserve legacy fallback | Trigger/stay-silent tests and diagnosis-context tests |
| Student evaluation | Fixed rubric/retry response for static experiment | Assigned objectives/rubric and diagnoses feed structured evaluation | Assess authored labs consistently | Version request/response and retain deterministic fallback | Legacy evaluator fixtures plus authored-rubric evidence tests |
| Replay | Titration action replay and experiment-version checkpoints | Normalized actions replay against pinned definition/model/adapter versions | Historical reproducibility across authored labs | Keep legacy replay adapter indefinitely for existing records | Old fixture replay plus migrated definition replay equality |
| Authoring | Family-oriented agent draft generation | Human and agent share bounded domain commands | Make Level 2 usable without LLM and constrain Level 3 | Feature-flag prototype; migrate after command service exists | Command reducer tests, trace-suite execution, injection tests |
| Assignment | Static experiment identity; optional workflow provenance | Explicit teacher approval pins immutable runnable definition version | Prevent stale or unvalidated execution | Continue resolving old static assignments through a legacy adapter | Persistence migration and assignment eligibility tests |

## Target architecture

```text
human composer ---------+
                        | shared typed domain commands
constrained agent ------+
                        v
                 LabWorkflowSpec v2 draft
                        |
          exact registries + hard validator
                        |
            current hash-matching runnable version
                        |
     setup-driven scene + normalized student intent
                        |
                        v
 generic ExperimentDefinition.step(normalized action)
   | capability/parameter/state/safety validation
   | equipment mechanical transition
   | material ledger transition
   | resolved deterministic chemistry modules
   | derived registered observables
   | structured semantic event envelope
   | constraint evaluation + diagnoses
                        |
        +---------------+----------------+
        |               |                |
  StudentModel       checkpoint       replay/analytics
        |                                |
      coach                       student evaluator
                                         |
                                teacher evidence view
```

There must be no runtime branch selected solely from `familyId`. Optional family metadata may support search, cataloging, and teacher navigation.

### Equipment mechanics

The component registry evolves in place. Core contracts contain serializable IDs and metadata only; React, Three.js, and browser types stay in adapter packages.

```ts
interface EquipmentDefinition<State> {
  id: EquipmentDefinitionId;
  version: string;
  displayName: string;
  capabilityIds: EquipmentCapabilityId[];
  supportedActionIds: LabActionId[];
  stateSchemaId: SchemaId;
  defaultConfigurationPresetId: ConfigurationPresetId;
  visualAdapterId: VisualAdapterId;
  mechanicalAdapterId: MechanicalAdapterId;
  performanceTier: PerformanceTier;
  safetyPolicyIds: SafetyPolicyId[];
}
```

The implemented Stage 1A equipment vocabulary is deliberately bounded to contain/receive/dispense/transfer liquid, measure volume, rinse, mix, mount, observe color, and fill to mark. Transfer, mix, and fill-to-mark are declared rather than verified. Mass, temperature, heating, cooling, and stirring remain future concepts until a scoped mechanic ticket adds code and tests. Equipment never owns experiment success, expected reagent identity, endpoint truth, or required student sequence.

### Typed actions

The action registry evolves in place. Each action declares exact source/target capabilities, a parameter schema ID, applicable equipment-state conditions, mechanical adapter ID, possible deterministic errors, emitted event contract, and discrete/continuous behavior. It contains no chemistry formula or scoring rule.

The action pipeline is:

```text
intent -> normalized typed action -> capability/parameter/state validation
       -> mechanical transition -> material/chemistry transition
       -> semantic events -> workflow diagnoses -> consumers
```

Every meaningful action still enters the generic `ExperimentDefinition.step()` or an explicit legacy definition adapter. Visual adapters never mutate scientific state directly.

### Registered materials and configurations

The reagent registry evolves toward exact material profiles while keeping v1 reagent IDs readable. Authored definitions bind only verified profile IDs and bounded quantity/configuration preset IDs. They cannot serialize formulas, arbitrary chemical identity, concentration formulas, or engine state.

```ts
interface MaterialBinding {
  instanceId: string;
  materialProfileId: RegistryId;
  containerInstanceId: string;
  quantityPresetId: RegistryId;
}
```

Physical compatibility is validated against container/equipment capabilities, material policy metadata, exact schema versions, and safety policies.

### Deterministic chemistry-model capabilities

Verified modules provide bounded capabilities such as material ledger, volume conservation, solution mixing, concentration/dilution, acid-base equilibrium, indicator response, solubility/precipitation, thermal energy, and instrument observables.

```ts
interface ChemistryModelModule {
  id: ChemistryModelId;
  version: string;
  providedCapabilityIds: ChemistryCapabilityId[];
  requiredCapabilityIds: ChemistryCapabilityId[];
  initialize(context: ModelInitializationContext): ModelState;
  applyMaterialAction(
    action: ExecutedMaterialAction,
    state: ModelState
  ): ModelTransition;
  deriveObservables(state: ModelState): ChemistryObservables;
}
```

Validation resolves an exact compatible, acyclic set of modules for the required capabilities. Unsupported phenomena remain unsupported. A module cannot import UI, Supabase, OpenAI, or arbitrary authored code. This is not a universal chemistry simulator.

### LabWorkflowSpec v2

The existing workflow schema remains the Lab IR. Version 2 should add:

- metadata and learning objectives;
- equipment instances and exact configurations;
- exact material bindings and quantity presets;
- physical layout;
- required chemistry-model capabilities;
- permitted normalized actions;
- typed workflow constraints and presentation guidance;
- assessment rubric and objective/evidence mappings;
- safety requirements;
- validation, migration, support, and version metadata.

`familyId` becomes optional catalog metadata. Engine identity is replaced as compatibility authority by exact equipment, action, material, adapter, model-capability, and policy resolution. A legacy adapter descriptor may remain explicit on migrated v1 definitions while titration parity work is active.

### Constraint-based workflow evaluator

Student instructions remain ordered presentation, but executable workflow truth is expressed by typed conditions and rule dependencies:

- required, success, failure, and forbidden conditions;
- partial-order dependencies;
- recoverable and terminal mistakes;
- numerical tolerances;
- best-practice and scoring rules;
- learning-objective mappings.

Conditions are discriminated, inspectable data. Initial types include equipment state equals, equipment capability present, material bound to container, action observed, action count in range, observable within tolerance, event flag present/absent, rule satisfied before another, forbidden state never reached, and student response submitted.

The evaluator reads registered observables and semantic evidence. It never recomputes pH, concentration, mass, temperature, or other chemistry truth.

```ts
interface WorkflowDiagnosis {
  ruleId: string;
  status: "satisfied" | "violated" | "pending";
  severity: "info" | "best-practice" | "procedural" | "conceptual" | "safety";
  recoverable: boolean;
  objectiveIds: string[];
  evidenceEventIds: string[];
  expected?: StructuredEvidenceValue;
  observed?: StructuredEvidenceValue;
}
```

### Structured event evolution

Preserve the current semantic payload and add a versioned event envelope containing a stable event ID, monotonic session sequence, normalized action ID, equipment/material instance references, workflow rule evidence, and optional checkpoint reference. Full before/after state snapshots should not be attached to every event.

Compatibility consumers continue to see the current `type`, simulated time, observation, flags, and skill evidence fields. A session-level adapter can enrich legacy engine events without changing their scientific content.

### Setup-driven scene and controls

The student surface loads only a current runnable definition, resolves exact visual and mechanical adapters, positions equipment from validated layout, binds materials, derives current permitted actions, and renders shared measurement/control primitives. Global controls stay stable; active equipment, objective, next guidance, measurement, warnings, and optional coach content retain distinct visual hierarchy.

The migrated titration page remains behind a compatibility flag until the setup-driven path matches action semantics, camera/equipment interaction, accessibility, coach/evaluator inputs, replay, and key screenshots. No separate hard-coded page is added for dilution.

### Human composer before agent generation

A pure domain command service or reducer owns add/remove/configure equipment, bind material, set layout, permit action, add conditions/dependencies/rubric/objectives, and validate. The first UI may be a structured 2D bench, libraries, inspector, constraints editor, validation panel, and preview. It must show legacy-adapter and support status explicitly.

Only after this Level 2 path works without an LLM may the agent call the same exact allow-listed commands, execute typed trace suites, request advisory Judge critique, revise within a budget, and present an editable draft for explicit teacher approval.

## Schema, hashing, and migration strategy

1. Keep the exact strict `LabWorkflowSpec` v1 parser and v1 canonical hash behavior.
2. Define a discriminated `schemaVersion` union for v1 and v2 in the existing package; do not create a disconnected IR.
3. Implement a pure deterministic `migrateV1ToV2()` adapter. Unknown v1 registry IDs remain errors; no fuzzy substitution is allowed.
4. Translate v1 ordered steps into presentation sections plus strict precedence constraints and action-scoping rules that reproduce current titration behavior. Native v2 definitions may omit irrelevant precedence edges and allow multiple orders.
5. Preserve original v1 hash and migration version in provenance. Compute a separately domain-tagged v2 canonical hash so equal JSON under different schema semantics cannot collide operationally.
6. Any edit creates an unvalidated draft and invalidates prior validation/Judge artifacts.
7. Validation records exact schema, validator, registry snapshot, adapter, model-module, and migration versions. Only a current matching `runnable` result is preview/assignment eligible.
8. Judge critique remains separately hash-bound and non-authoritative.
9. Saved v1 fixtures remain readable and replayable. Migration results receive golden snapshot tests before production use.

## Persistence and assignment migration

Persistence changes belong to later persistence-owned tickets and should be additive:

- add immutable lab-definition version records with schema version, canonical hash, validation artifact, registry snapshots, compatibility/migration provenance, approval actor/time, and support status;
- make assignments pin an immutable approved definition version and hash;
- make sessions pin assignment/definition/runtime compatibility versions while retaining the static experiment fields required by old rows;
- retain old checkpoint and demo request schemas and resolve them through explicit legacy adapters;
- version normalized action traces and event envelopes for deterministic historical replay;
- never overwrite an approved version after an edit; create a new unvalidated draft/version;
- retain old engine/adapter code as long as historical records require it.

## Compatibility requirements and evidence

| Invariant | Current evidence | Required migration evidence |
| --- | --- | --- |
| Titration state transitions and truth remain deterministic | `tests/experiments/titration.test.ts`, display/session tests | Legacy vs generic trace state, ground-truth, observable, and event equality |
| Meaningful actions call `ExperimentDefinition.step()` | Engine/store/runtime tests | Coordinator spy/contract tests for both migrated titration and second lab |
| Current UI-visible titration behavior remains available | Component and titration e2e suites | Feature-flag comparison, common viewport screenshots, keyboard/gesture parity |
| Events and StudentModel evidence remain compatible | Engine, store, coach, and current architecture tests | Legacy event enrichment and event-v2 consumer compatibility tests |
| Coach triggers and positive silence are deterministic | `tests/coach/triggerPolicy.test.ts`, coach API/eval tests | Diagnosis-aware context plus unchanged legacy/stay-silent cases |
| Evaluator remains evidence-grounded with fallback | Evaluator API/report tests | Authored-rubric/evidence-ID tests, alternate-valid credit, no chemistry reconstruction |
| Replay is deterministic | `tests/experiments/titration-replay.test.ts`, Composer seed replay tests | v1 migration replay equality and normalized action replay for two labs |
| Checkpoints remain nonblocking and idempotent | checkpoint API/queue/persistence tests | Version-pinned action/event replay and old payload migration tests |
| Demo mode uses production paths | demo trace/reset/seed/e2e tests | Composer version fixture using the same generic runtime and validator |
| Invalid/stale drafts cannot run | schema/hash/validation/runtime tests | v2 capability/model/rule/stale-hash/Judge-nonauthority tests |
| Multiple valid orders are accepted | Missing; v1 intentionally rejects alternate order | Partial-order evaluator and two valid executable traces |
| No family-only runtime dispatch | Missing | Static contract test and two serialized labs through one coordinator |

## Level 2 gate

Level 3 must not be claimed until tests and a non-LLM teacher/fixture path demonstrate all of the following:

1. Equipment is assembled from reusable definitions.
2. Material bindings and setup configuration are validated.
3. Actions are capability-checked.
4. The same generic runtime executes more than one lab setup.
5. At least two valid procedural orders are accepted.
6. Success, failure, recoverability, and tolerance rules work.
7. Semantic events and diagnoses are inspectable.
8. A setup can be saved, loaded, previewed, and replayed.
9. Existing titration behavior remains compatible.
10. No runtime branch is selected solely from a family ID.

The existing author prototype remains behind its current limited surface and must not be presented as completed Level 3 before this gate.

## Rejected alternatives

| Alternative | Decision and reason |
| --- | --- |
| New unrelated `LabDefinition` IR beside `LabWorkflowSpec` | Rejected. The existing schema already owns metadata, setup, workflow, rubric, safety, validation, and Judge artifacts. Versioned evolution avoids duplicate hashing, persistence, and assignment authority. Revisit only if a concrete incompatible requirement is proven in a scoped schema ticket. |
| `switch (familyId)` to select a new engine per lab type | Rejected. It reproduces the current coupling and makes dilution/standardization/solution preparation bespoke families rather than compositions. |
| Universal chemistry simulator | Rejected. Only bounded verified modules and registered profiles are in scope; unsupported phenomena remain unsupported. |
| Arbitrary expression language for workflow rules | Rejected. Executable or free-form expressions weaken validation, inspection, safety, replay, and agent constraints. Use typed condition unions. |
| Keep ordered steps as the only runtime truth | Rejected. It prevents alternate valid orders and mixes presentation with scientific/procedural constraints. Migrated v1 retains equivalent strict precedence explicitly. |
| Put formulas or success rules in equipment/action entries | Rejected. Equipment owns mechanics, actions own contracts, chemistry modules own truth, and workflow/rubric rules own assessment. |
| Let agent generate registry IDs, materials, code, or expected trace results | Rejected. Agent output must use exact read-only registry/tool results and execute typed traces against deterministic runtime. |
| Replace the current titration path immediately | Rejected. The strangler path retains it until automated and manual parity, fixture migration, and historical replay are proven. |
| Use camera/UI restrictions to hide incomplete setup rendering | Rejected for the Composer architecture. Setup validation and scene adapters must produce a coherent supported scene; UI cannot disguise invalid physical composition. |

## Risk register

| Risk | Impact | Mitigation / proof required |
| --- | --- | --- |
| Generic contracts merely hide titration switches | High | Prohibit family-only dispatch; run titration and dilution through one coordinator; inspect dependency graph and static code tests |
| Decomposing titration changes chemistry or event semantics | High | Characterize existing engine first; adapt before extracting; golden state/ground-truth/event replay comparisons |
| v1 migration changes allowed order or grading | High | Translate order to explicit precedence/action constraints; golden v1/v2 trace equivalence |
| Module composition introduces order-dependent numerical drift | High | Exact dependency order, immutable transitions, tolerance policy, deterministic replay across repeated runs |
| Rules accidentally recompute chemistry | High | Conditions may reference only registered observables/evidence; code ownership and tests forbid formulas in evaluator/UI/spec |
| Event v2 bloats checkpoint storage | Medium | Envelope/delta design, checkpoint references, storage/performance benchmark, no per-event full snapshots |
| Adapter/version retirement breaks historical replay | High | Immutable version pins, additive migrations, retention policy, legacy fixtures in CI |
| Visual adapters expose unsupported interactions | High | Current permitted-action projection, exact adapter resolution, e2e interaction tests, no state mutation outside `step()` |
| Composer UI creates invalid transient graphs | Medium | Drafts remain unvalidated/non-runnable; domain commands enforce local shape; validator remains final authority |
| Agent prototype is mistaken for capability-driven Level 3 | Medium | Explicit feature/status labels and Level 2 gate in docs/UI; no assignment without current validation and approval |
| Registry growth harms Chromebook performance | Medium | Snapshot indexes, bounded schema sizes, lazy visual loading, performance tier, benchmark two representative labs |
| Persistence schema creates two assignment authorities | High | One immutable definition-version reference for new assignments; explicit adapter for legacy static assignments |

## Phased ticket plan

Each row is one reviewable ticket unless split further during planning. A ticket must keep the repository runnable, stay within its ownership boundary, add its focused tests, and produce the required completion report. Later tickets are not implicitly authorized by completion of an earlier one.

### Phase 0 — Characterization and architecture correction

| Ticket | Outcome | Non-goal | Evidence |
| --- | --- | --- | --- |
| `LC2-000` (this ticket) | Repository map, original intention, coupling/classification, target architecture, migration/version strategy, risk register, and phased ticket plan | No v2/runtime/UI/agent implementation | This document and current architecture characterization test |
| `LC2-001` | Add missing black-box characterization for report evaluator, production UI-visible workflow behavior, seeded demo, and checkpoint/replay version provenance where existing suites do not already assert it | No behavior change | Focused legacy fixtures and assertions |

### Phase 1 — Capability-driven contract evolution

| Ticket | Outcome | Depends on | Evidence |
| --- | --- | --- | --- |
| `LC2-100` | Add bounded equipment and chemistry capability ID vocabularies plus exact schema/adapter ID contracts to existing registries | `LC2-000` | Valid/duplicate/unknown/exact resolution tests; no React/Three/browser imports |
| `LC2-101` | Extend action contracts with source/target capabilities, parameter schema, equipment-state preconditions, error/event contracts, and behavior mode | `LC2-100` | Capability match, parameter bounds, precondition, unsupported connection, and adapter tests |
| `LC2-102` | Add exact material profiles, quantity presets, container compatibility, and configuration schema metadata while adapting v1 reagent entries | `LC2-100` | Exact ID, binding, quantity, container, safety, and v1 compatibility tests |
| `LC2-103` | Define bounded chemistry-model module contracts and deterministic exact capability resolution; no model extraction yet | `LC2-100` | Missing/duplicate/cyclic/incompatible resolution tests and import-boundary checks |
| `LC2-104` | Add discriminated structured condition, rule, instruction, rubric/evidence, and diagnosis schemas | `LC2-101` | Valid, invalid, safety, tolerance, and contradictory shape tests |
| `LC2-105` | Introduce `LabWorkflowSpec` v2 as the existing IR's versioned union, with optional catalog family and explicit compatibility metadata | `LC2-102`–`104` | Strict parsing, unknown field/ID, size-bound, and support-status tests |
| `LC2-106` | Implement pure v1-to-v2 migration and version-domain-separated v2 hash while freezing v1 hash behavior | `LC2-105` | Golden v1 migration, stable IDs, hash stability, edit invalidation, old fixture parsing |
| `LC2-107` | Extend hard validation to exact capability/action/material/model/rule/safety resolution and unreachable/contradictory constraints | `LC2-106` | Valid, invalid, safety, stale validation, unreachable success, and Judge non-authority tests |

### Phase 2 — Generic runtime and evaluator

| Ticket | Outcome | Depends on | Evidence |
| --- | --- | --- | --- |
| `LC2-200` | Generic lab state/config/action contracts and action coordinator implementing `ExperimentDefinition.step()` | Phase 1 | Every meaningful action step-spy test; no family dispatch; no network import |
| `LC2-201` | Reusable equipment mechanical transitions and material ledger/volume conservation modules for registered actions | `LC2-200` | State/precondition/conservation/replay tests |
| `LC2-202` | Deterministic module coordinator and observable projection with exact dependency resolution | `LC2-201` | Repeatability, module order, unsupported capability, and tolerance tests |
| `LC2-203` | Partial-order constraint evaluator returning structured diagnoses | `LC2-200`, `LC2-202` | Two valid orders, required/forbidden, recoverable/terminal, tolerance boundary, best-practice silence |
| `LC2-204` | Versioned event envelope and diagnosis integration while preserving legacy event payload consumers | `LC2-203` | Stable IDs/sequence, compactness, event/evidence compatibility, StudentModel/coach/checkpoint tests |
| `LC2-205` | Versioned normalized action trace and deterministic replay harness | `LC2-204` | Same-seed equality, altered-action divergence, old trace adapter, network independence |

### Phase 3 — Titration migration

| Ticket | Outcome | Depends on | Evidence |
| --- | --- | --- | --- |
| `LC2-300` | Explicit compatibility mechanical/model adapters around current titration truth | Phase 2 | State, ground-truth, observable, flag, and evidence parity across characterized traces |
| `LC2-301` | Serialized v2 titration definition migrated from the canonical v1 fixture | `LC2-300` | Current hash/validation and strict v1 behavior-equivalence replay |
| `LC2-302` | Setup-driven student runtime loader behind compatibility flag | `LC2-301` | One coordinator, exact adapters, all actions through `step()`, legacy comparison |
| `LC2-303` | Setup-driven titration scene and shared measurement/control primitives using current visuals | `LC2-302` | Visual/action/a11y/camera parity at common aspect ratios and Chromebook performance |
| `LC2-304` | Coach, evaluator, checkpoint, report, demo, and technical inspector parity on setup-driven titration | `LC2-303` | Existing suites on both flags plus event/diagnosis/provenance assertions |

### Phase 4 — Human Composer foundation

| Ticket | Outcome | Depends on | Evidence |
| --- | --- | --- | --- |
| `LC2-400` | Pure shared domain command service/reducer with automatic validation invalidation | Phase 3 | Command/property tests; exact IDs; invalid draft cannot preview |
| `LC2-401` | Equipment/material libraries and structured 2D setup editor | `LC2-400` | Add/remove/configure/bind/layout interaction and accessibility tests |
| `LC2-402` | Constraint/instruction/objective/rubric editor and inspector | `LC2-400` | Multiple-order authoring, dependency, tolerance, safety, undo/edit tests |
| `LC2-403` | Validation panel, compatibility status, preview/test mode, save/load adapter | `LC2-401`, `LC2-402` | Stale invalidation, hard-vs-advisory authority, preview gate, reload equality |

### Phase 5 — Second adaptable lab

| Ticket | Outcome | Depends on | Evidence |
| --- | --- | --- | --- |
| `LC2-500` | Register volumetric pipette/flask, wash bottle, reusable containers, and required transfer/fill/rinse mechanics | Phase 4 | Capability, mechanical, material/container, visual adapter tests |
| `LC2-501` | Add bounded concentration/dilution model capability over the shared ledger/volume modules | `LC2-500` | Conservation, concentration, deterministic observables, boundary tests |
| `LC2-502` | Serialized dilution/solution-preparation setup, constraints, rubric, and trace suite through the same runtime | `LC2-501` | Valid alternate orders, recoverable error, conceptual/terminal error, tolerance boundary, replay |
| `LC2-503` | Render and author the second lab through the same student scene and human composer | `LC2-502` | No new family runtime/page; setup save/load/preview; Chromebook and a11y checks |

### Phase 6 — Agent command layer and generation loop

| Ticket | Outcome | Depends on | Evidence |
| --- | --- | --- | --- |
| `LC2-600` | Server-side exact allow-list tools wrapping shared domain commands and read-only registries | Level 2 gate | No registry mutation/invented IDs/adapters; prompt injection tests |
| `LC2-601` | Bounded author loop with explicit assumptions, validation, typed trace generation/execution, and revision budget | `LC2-600` | Valid/alternate/recoverable/terminal/tolerance traces, invalid revision, unsupported non-runnable output |
| `LC2-602` | Editable agent draft handoff to human Composer with visible costs/status and explicit approval requirement | `LC2-601` | Edit invalidation, no silent substitution, no unvalidated preview/assignment |

### Phase 7 — Hybrid evaluation integration

| Ticket | Outcome | Depends on | Evidence |
| --- | --- | --- | --- |
| `LC2-700` | Extend student evaluator request/result for assigned objectives, rubric, evidence IDs, diagnoses, uncertainty, and version logs | Phase 5 | Alternate-valid credit, no chemistry recomputation, fallback and legacy tests |
| `LC2-701` | Implement independent exact-hash Lab Workflow Judge using validation/capability/trace summary | Phase 6 | Stale hash rejection, advisory-only authority, rubric/objective alignment, injection tests |
| `LC2-702` | Add bounded revise/revalidate/rejudge loop and teacher-visible authority separation | `LC2-701` | Fixed attempt/cost limits, validator veto, every revision invalidates prior artifacts |
| `LC2-703` | Extend coach context with active authored guidance and structured diagnoses | `LC2-204`, Phase 5 | Evidence references, routine-success silence, no state mutation/chemistry claims |

### Phase 8 — Persistence, assignment, hardening, and cleanup

| Ticket | Outcome | Depends on | Evidence |
| --- | --- | --- | --- |
| `LC2-800` | Immutable draft/approved definition version persistence and migrations | Phase 4 | RLS, idempotency, old row compatibility, immutable approval tests |
| `LC2-801` | Assignment/session pins, explicit teacher approval, and historical replay resolution | `LC2-800` | Stale/non-runnable rejection, legacy assignment adapter, exact historical replay |
| `LC2-802` | End-to-end Composer/agent/assignment/student/evaluation flow for titration and dilution | `LC2-801`, Phase 7 | Browser trace suite, common viewports, a11y, deterministic fallback |
| `LC2-803` | Chromebook performance, storage/event compactness, version retention, and operational documentation | `LC2-802` | Benchmarks and runbooks |
| `LC2-804` | Remove obsolete legacy student/runtime paths only after parity and migration evidence | `LC2-803` | No fixture/session regression; explicit teacher/student sign-off; rollback plan |

## Current Phase 0 exit criteria

- Current Composer contracts and implementation status are recorded.
- All named registries, engines, runtime adapters, UI assumptions, state/event consumers, agent surfaces, and persistence requirements are classified.
- Original workflow intention is recorded from each required product perspective.
- The coupling cause is stated at schema, validation, runtime, UI, agent, and persistence layers.
- The target evolves the existing IR and registries rather than silently introducing competitors.
- v1 parsing, hashes, fixtures, runtime behavior, events, and saved sessions have explicit compatibility strategies.
- Later work is split into reviewable tickets and Level 3 is gated on a non-LLM Level 2 proof.

## Known limitations after Phase 0

This ticket deliberately leaves runtime behavior unchanged. Composer remains titration-specific, ordered-step-driven, headless, and separate from the production student scene. The author prototype remains family-oriented. There is no v2 parser, generic runtime, structured diagnosis evaluator, visual teacher composer, second shared-runtime lab, Workflow Judge route, or immutable Composer assignment persistence yet.

## Registry, schema, migration, and documentation follow-ups

- Schema: Phase 1 must define the exact v2 union and v1 migration fixtures before any runtime consumes v2.
- Registries: capability, material, action, schema, adapter, and chemistry-module IDs must be added only with code-backed support and exact-resolution tests.
- Migration: production use requires immutable definition versions, legacy checkpoint/demo adapters, and historical runtime retention.
- Documentation: update the detailed schema, component/action/material registry, state/runtime, author-agent, Judge, evaluator, persistence, demo, and extension guides in the ticket that changes each contract.
- Roadmap: the old fixed-family implementation roadmap remains useful historical evidence but is superseded by the phased ticket plan above for runtime architecture.
