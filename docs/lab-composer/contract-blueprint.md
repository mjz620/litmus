# Capability-Driven Contract Blueprint

This file gives downstream agents a concrete target without authorizing all contracts in one change. Implement only the section named by the active LC2 ticket. Type sketches are normative about responsibility and dependency direction; exact field names may be adjusted only when the active ticket records the reason and updates this document.

## Package layout

Evolve `src/lab-workflows`; do not create a second top-level Lab IR package.

```text
src/lab-workflows/
  schema.ts                         # v1 exports stay stable; version union facade
  schema/
    v2.ts                           # added only in LC2-105
    conditions.ts                   # LC2-104
    migration.ts                    # LC2-106
  hash.ts                           # retain v1 behavior; version-aware facade
  capabilities/
    ids.ts                          # bounded canonical ID unions/constants
    types.ts                        # equipment + chemistry capability contracts
  registries/
    components/                     # evolve in place as equipment definitions
    actions/                        # evolve in place
    reagents/                       # v1 compatibility; material facade/metadata
    materials/                      # only if LC2-102 proves the reagent type cannot evolve cleanly
    configurations/                 # schema/preset metadata
    chemistry-models/               # module contracts/metadata + pure provider resolution
    visual-adapters/                # IDs/metadata only; no React imports
    mechanical-adapters/            # IDs/metadata only; no Three/browser imports
  validation/
    v1.ts                           # extracted facade only if required; behavior frozen
    v2.ts                           # capability/rule validation passes
    issues.ts                       # stable issue catalog/order
  runtime/
    generic/
      definition.ts                 # generic ExperimentDefinition implementation
      coordinator.ts                # normalized action pipeline
      state.ts
      observables.ts
    legacy/                         # explicit compatibility wrappers
  mechanics/                        # pure equipment transitions
  chemistry-models/                 # deterministic module implementations
  evaluation/                       # deterministic workflow constraint evaluator
  events/                           # event envelope/enrichment
  replay/                           # normalized trace schema/runner
  authoring/                        # pure domain commands/reducer, added in Phase 4
  definitions/                      # checked-in serialized v2 supported labs
```

If a folder already has a flat implementation, prefer a small facade and gradual extraction. Do not move unrelated files merely to match this diagram.

## Canonical ID policy

Registry IDs are exact, versioned, and code-backed. They are never accepted from fuzzy matches. The following IDs are **reserved design IDs** for the initial migration; they are not runnable until the ticket that registers and tests them is complete.

### Equipment capabilities

```text
capability.contain_liquid.v1
capability.receive_liquid.v1
capability.dispense_liquid.v1
capability.transfer_liquid.v1
capability.measure_volume.v1
capability.rinse.v1
capability.mix.v1
capability.mount.v1
capability.observe_color.v1
capability.fill_to_mark.v1
```

Do not add mass, temperature, heat, cool, or stir implementations until a ticket includes their mechanics and tests. Their concepts may remain documented as future vocabulary, not verified entries.

### Chemistry capabilities

```text
chemistry.material_ledger.v1
chemistry.volume_conservation.v1
chemistry.solution_mixing.v1
chemistry.concentration_dilution.v1
chemistry.acid_base_equilibrium.v1
chemistry.indicator_response.v1
chemistry.instrument_observables.v1
```

Initial Phase 1 may register capability metadata before every module is implemented. Availability must distinguish `declared` from `verified`, and hard validation must reject non-verified requirements for runnable definitions.

### Adapter and schema IDs

Use categories that make trust boundaries obvious:

```text
schema.equipment_state.<name>.v1
schema.action_parameters.<name>.v1
schema.model_state.<name>.v1
visual-adapter.<name>.v1
mechanical-adapter.<name>.v1
chemistry-model.<name>.v1
quantity-preset.<name>.v1
configuration-preset.<name>.v1
layout-preset.<name>.v1
```

An ID is not a dynamic import path. Runtime code resolves it through a closed code-owned map. Specs cannot provide module names or URLs.

### Existing IDs

Keep current component, action, reagent, configuration, event, flag, skill, safety, engine, seed, and policy IDs readable. Prefer adapting an existing exact ID when its concept is genuinely reusable. Do not rename v1 IDs for aesthetics.

## Equipment definition

Target responsibility:

```ts
interface EquipmentDefinition {
  readonly id: EquipmentDefinitionId;
  readonly version: string;
  readonly displayName: string;
  readonly capabilityIds: readonly EquipmentCapabilityId[];
  readonly supportedActionIds: readonly LabActionId[];
  readonly stateSchemaId: SchemaId;
  readonly defaultConfigurationPresetId: ConfigurationPresetId;
  readonly visualAdapterId: VisualAdapterId;
  readonly mechanicalAdapterId: MechanicalAdapterId;
  readonly performanceTier: "core" | "enhanced" | "restricted";
  readonly safetyPolicyIds: readonly SafetyPolicyId[];
}
```

Stage 1A preserves the misleading v1 `visualAdapterId` concrete export-name field because the current titration adapter consumes it. The canonical exact reference is temporarily exposed as `visualAdapterDefinitionId`; a later compatibility migration may rename that field only when it also moves the legacy export name behind the explicit adapter. Do not treat the deprecated v1 field as an exact registry ID.

Rules:

- State schema describes serializable mechanical state, not authored runtime state values.
- Equipment knows physical capabilities and supported action contracts.
- Equipment does not know lab family, expected endpoint, correct reagent, success, grading, workflow order, or learning objectives.
- Core registry types cannot import React, Three.js, Zustand, Supabase, OpenAI, DOM, or browser APIs.
- Visual/mechanical implementations are resolved by exact IDs in UI/runtime-owned maps.

## Action definition

```ts
interface LabActionDefinition {
  readonly id: LabActionId;
  readonly version: string;
  readonly requiredSourceCapabilityIds: readonly EquipmentCapabilityId[];
  readonly requiredTargetCapabilityIds: readonly EquipmentCapabilityId[];
  readonly parameterSchemaId: SchemaId;
  readonly preconditionIds: readonly EquipmentPreconditionId[];
  readonly mechanicalAdapterId: MechanicalAdapterId;
  readonly possibleErrorCodes: readonly LabActionErrorCode[];
  readonly emittedEventContractId: EventContractId;
  readonly behavior: "discrete" | "continuous";
}
```

Rules:

- Parameter values are parsed before any state transition.
- Capability and state checks fail with stable errors before a mechanical adapter runs.
- Action definitions do not contain formulas, material reaction truth, experiment scoring, or sequence requirements.
- Continuous gestures may create bounded normalized actions; state changes still enter `step()`.
- Existing `action.dispense.v1`, `action.fill.v1`, `action.rinse.v1`, `action.read_volume.v1`, `action.select_indicator.v1`, and `action.add_indicator.v1` remain the first compatibility cases.

## Materials and quantity/configuration presets

Target responsibility:

```ts
interface MaterialProfile {
  readonly id: MaterialProfileId;
  readonly version: string;
  readonly displayName: string;
  readonly phase: "aqueous_solution" | "indicator" | "pure_liquid";
  readonly usageModes: readonly (
    | "material_binding"
    | "legacy_action_parameter"
  )[];
  readonly providedChemistryCapabilityIds: readonly ChemistryCapabilityId[];
  readonly compatibleContainerCapabilityIds: readonly EquipmentCapabilityId[];
  readonly initializationPresetSchemaId: SchemaId;
  readonly quantityPresetIds: readonly QuantityPresetId[];
  readonly safetyPolicyIds: readonly SafetyPolicyId[];
  readonly availability: "declared" | "verified" | "restricted";
}

interface MaterialBinding {
  readonly instanceId: string;
  readonly materialProfileId: MaterialProfileId;
  readonly containerInstanceId: string;
  readonly quantityPresetId: QuantityPresetId;
}
```

Concentrations and other verified scientific parameters live in code-owned material/configuration presets, not authored free-form fields. A v2 definition may select an exact allowed preset but cannot write chemical formulas or serialized model state.

Current compatibility note: phenolphthalein, bromothymol blue, and methyl orange each have exact one- and two-drop presets matching the deterministic engine/UI choices. Distilled water is also an exact verified profile because the current engine supports a deterministic water-rinse action. Its `usageModes` contains only `legacy_action_parameter`, and it intentionally has no quantity preset because the legacy action exposes no physical rinse volume or consumable ledger. Do not invent one; a later mechanical/material-ledger ticket must define and test that quantity before v2 material binding treats it as consumable inventory.

## Chemistry model modules

```ts
interface ChemistryModelModule<TState = unknown> {
  readonly id: ChemistryModelId;
  readonly version: string;
  readonly providedCapabilityIds: readonly ChemistryCapabilityId[];
  readonly requiredCapabilityIds: readonly ChemistryCapabilityId[];
  initialize(context: ModelInitializationContext): TState;
  applyMaterialAction(
    action: ExecutedMaterialAction,
    state: Readonly<TState>
  ): ModelTransition<TState>;
  deriveObservables(state: Readonly<TState>): ChemistryObservables;
}
```

Resolution rules:

1. Definition declares required capability IDs, not module implementation IDs unless an explicit compatibility pin is needed.
2. Validator finds an exact verified provider set with no missing capability, ambiguity, duplicate exclusive provider, or dependency cycle.
3. Runtime records the resolved module IDs/versions in validation/session provenance.
4. Module application order is deterministic and derived from declared dependencies with a stable ID tie-break.
5. A module receives executed material deltas, not UI events or prose.
6. Modules never call a network service or LLM and never execute authored code.

The first titration migration may use an explicit `chemistry-model.legacy_titration.v1` adapter that delegates to existing truth. It must be labeled legacy and removed only after bounded acid-base/indicator modules reproduce characterized behavior.

## LabWorkflowSpec v2 shape

Keep `LabWorkflowSpec` as the existing IR and discriminate primarily by `schemaVersion`.

```ts
interface LabWorkflowSpecV2 {
  readonly schemaVersion: "2.0.0";
  readonly id: string;
  readonly revision: number;
  readonly sourceRequest: string;
  readonly metadata: LabMetadataV2;
  readonly catalog?: { readonly familyId?: string };
  readonly objectiveIds: readonly SkillId[];
  readonly equipment: readonly EquipmentInstanceSpec[];
  readonly materials: readonly MaterialBinding[];
  readonly layout: PhysicalLayoutSpec;
  readonly requiredChemistryCapabilityIds: readonly ChemistryCapabilityId[];
  readonly permittedActions: readonly PermittedActionSpec[];
  readonly rules: readonly WorkflowRule[];
  readonly instructions: readonly InstructionSection[];
  readonly coachPolicy: CoachPolicySpec;
  readonly rubric: RubricSpecV2;
  readonly safetyPolicyIds: readonly SafetyPolicyId[];
  readonly compatibility?: LegacyCompatibilityDescriptor;
  readonly provenance?: MigrationProvenance;
  readonly supportStatus: WorkflowSupportStatus;
  readonly validation: ValidationResultV2 | null;
  readonly judgeCritique: JudgeCritique | null;
}
```

Key rules:

- `familyId` is optional catalog metadata and cannot be read by the runtime coordinator or compatibility validator.
- `equipment` instances reference exact equipment definition/configuration IDs.
- `materials` use exact registered profiles and quantities.
- `layout` is bounded and validated; it contains transforms/slots, not component code.
- `permittedActions` are global lab permissions plus source/target instance bindings. Rules determine correctness.
- `instructions` reference rules but do not control runtime progression.
- New/edited/migrated drafts are unvalidated until deterministic validation produces a matching artifact.

## Structured conditions and rules

Use a closed discriminated union. Initial condition kinds:

```ts
type WorkflowCondition =
  | EquipmentStateEqualsCondition
  | EquipmentCapabilityPresentCondition
  | MaterialBoundToContainerCondition
  | ActionObservedCondition
  | ActionCountWithinRangeCondition
  | ObservableWithinToleranceCondition
  | EventFlagCondition
  | RuleSatisfiedBeforeCondition
  | ForbiddenStateNeverReachedCondition
  | StudentResponseSubmittedCondition;
```

Each condition contains only exact IDs and bounded structured values. No arbitrary expression strings, JavaScript, formula AST, JSONPath, dynamic property lookup, or user-authored query language.

The implemented LC2-104 field contract uses explicit instance/state keys for equipment-state conditions, exact source/target filters for action evidence, explicit finite `minimum`/`maximum` plus `minimumInclusive`/`maximumInclusive` for observable tolerances, and predecessor/successor rule IDs for partial ordering. Equal observable bounds are legal only when both ends are inclusive. Parsing checks shape and bounds only; the hard validator later resolves IDs, state fields, observables, references, cycles, and rule compatibility.

Structured expected/observed values use a closed tagged union: `null`, `boolean`, finite `number` with an optional unit ID, bounded `text`, bounded `text_list`, exact `identifier`, or bounded `identifier_list`. Arbitrary recursive JSON is intentionally unsupported; a new shape requires an explicit contract variant.

```ts
interface WorkflowRule {
  readonly id: string;
  readonly kind:
    | "required"
    | "success"
    | "failure"
    | "forbidden"
    | "ordering"
    | "best_practice"
    | "scoring";
  readonly condition: WorkflowCondition;
  readonly severity:
    | "info"
    | "best-practice"
    | "procedural"
    | "conceptual"
    | "safety";
  readonly recoverable: boolean;
  readonly terminal: boolean;
  readonly objectiveIds: readonly SkillId[];
  readonly points?: number;
}
```

V2 rubric evidence is also typed rather than stored as an undifferentiated string list. Each criterion maps objectives and rules to one or more strict evidence entries of kind `rule_diagnosis`, `semantic_event`, `observable`, or `student_response`, retaining the exact assessment-mode and passing-policy IDs needed for lossless v1 migration. Instruction sections contain only an ID, title, guidance, and related rule IDs; their array order is presentation and never runtime control flow.

Validator checks unique IDs, exact references, legal condition/rule combinations, tolerance bounds, contradictions, cycles in ordering edges, and statically unreachable success where detectable.

## Generic runtime contract

The generic coordinator should implement the existing experiment abstraction:

```ts
type GenericLabDefinition = ExperimentDefinition<
  GenericLabConfig,
  GenericLabState,
  NormalizedLabAction
>;
```

`step()` order is fixed:

1. Parse normalized action and resolve exact action definition.
2. Resolve source/target equipment instances.
3. Validate permitted action binding, capabilities, parameters, equipment state, and deterministic safety policy.
4. Apply pure mechanical transition.
5. If material moved/changed, produce an `ExecutedMaterialAction` delta.
6. Apply resolved chemistry modules in deterministic dependency order.
7. Derive registered observables.
8. Emit structured semantic event envelope(s).
9. Evaluate workflow rules against state, observables, trace, and evidence.
10. Return new state/events/diagnoses without network waits.

No React component, store, coach, persistence queue, evaluator, or agent may appear inside these steps.

## Event envelope

Preserve the current payload and enrich it at the generic coordinator boundary:

```ts
interface SemanticEventEnvelopeV2 {
  readonly schemaVersion: "2.0.0";
  readonly eventId: string;
  readonly sequence: number;
  readonly actionId: LabActionId;
  readonly sourceInstanceId?: string;
  readonly targetInstanceIds: readonly string[];
  readonly materialInstanceIds: readonly string[];
  readonly ruleEvidenceIds: readonly string[];
  readonly payload: SemanticEvent;
  readonly checkpointRef?: string;
}
```

Generate IDs deterministically from session identity/sequence or through the existing checkpoint idempotency strategy. Do not use wall-clock ordering as scientific truth. Do not attach complete state snapshots to each event.

## Deterministic workflow evaluation

Input:

- validated rules;
- current generic state and equipment projection;
- registered chemistry observables;
- semantic event envelopes;
- prior rule statuses;
- submitted structured responses.

Output:

```ts
interface WorkflowDiagnosis {
  readonly ruleId: string;
  readonly status: "satisfied" | "violated" | "pending";
  readonly severity:
    | "info"
    | "best-practice"
    | "procedural"
    | "conceptual"
    | "safety";
  readonly recoverable: boolean;
  readonly objectiveIds: readonly string[];
  readonly evidenceEventIds: readonly string[];
  readonly expected?: StructuredEvidenceValue;
  readonly observed?: StructuredEvidenceValue;
}
```

The evaluator compares registered values and evidence. It never calls chemistry formulas or infers hidden state from prose.

## Setup-driven UI boundary

Core definition data references exact `visualAdapterId` and `mechanicalAdapterId`. UI-owned maps resolve visual IDs to React/Three components. The scene:

1. accepts only an eligible validated definition/runtime snapshot;
2. renders equipment instances and bounded layout;
3. binds current projected mechanical/material state;
4. derives visible controls from current permitted normalized actions;
5. dispatches intent to the generic store/coordinator;
6. never calculates chemistry or directly mutates runtime state.

Reuse current titration visuals first. Do not create a generalized scene by making every prop optional or by using `Record<string, unknown>` throughout; use discriminated adapter props and exact registry resolution.

## Human and agent authoring boundary

The shared domain command layer is pure and deterministic:

```ts
type LabDraftCommand =
  | AddEquipmentCommand
  | RemoveEquipmentCommand
  | ConfigureEquipmentCommand
  | BindMaterialCommand
  | SetLayoutCommand
  | PermitActionCommand
  | AddConditionCommand
  | AddOrderingConstraintCommand
  | AddSuccessConditionCommand
  | AddFailureConditionCommand
  | AddRubricCriterionCommand
  | AddObjectiveCommand;
```

Every successful edit:

- returns a new v2 draft;
- increments or records draft revision according to the schema ticket;
- clears validation and Judge artifacts;
- sets support status to `draft_unvalidated`;
- produces a stable command result/error;
- never makes the draft runnable by itself.

The human composer calls this reducer directly. Later server-side agent tools wrap the same commands with an exact allow-list. Agent tools cannot write registries, create IDs, call runtime adapters directly, or mark validation success.

## Dependency rules

Enforce these import directions with review and, where practical, tests:

```text
schemas/registries/capabilities
  <- validator, mechanics, chemistry modules, evaluator, runtime
  <- authoring command service
  <- stores/UI adapters
  <- agent routes and persistence adapters
```

Forbidden reverse imports:

- core Composer contracts importing React/Three/Zustand/DOM;
- deterministic runtime importing OpenAI/Supabase/Next route modules;
- chemistry modules importing workflow scoring, coach, evaluator, or UI;
- UI importing chemistry implementations;
- author/Judge agents importing mechanical or chemistry implementations to compute expected results;
- persistence deciding runnability instead of verifying validator artifacts.
