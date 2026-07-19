# Phase 4 — Human Composer Foundation

Phase 4 must deliver useful non-LLM authoring. The teacher UI does not write raw spec objects directly; all domain edits use the shared command service.

## LC2-400 — Pure draft command service and edit invalidation

**Objective:** Implement immutable typed domain commands for editing v2 drafts, with stable errors and automatic validation/Judge invalidation.

**Dependencies:** `LC2-304`.

**Status:** Implemented. `src/lab-workflows/authoring/**` now owns a strict closed command union and one injected-registry command service for equipment, materials, layout, permitted actions, rules/conditions, partial-order dependencies, instructions, objectives, and rubric criteria. Every successful command returns a new deeply frozen v2 draft, increments revision, sets `draft_unvalidated`, and clears deterministic validation and advisory Judge artifacts. Exact registry resolution, availability, component capabilities, action connections, quantity/configuration compatibility, reference paths, duplicate IDs, ordering cycles, revision bounds, and guarded removals have stable error codes. Instruction presentation guidance is the only documented subordinate cascade; equipment, rule, and objective removals reject with complete dependency paths. Strict versioned JSON helpers are explicitly local/fixture-only. Tests reconstruct and revalidate the native titration draft entirely through commands and cover all command variants, invalidation, non-mutation, deterministic sequences, serialization, and platform-neutral imports.

**Read first:** v2 schema/validator, current Author Agent prototype, [`../contract-blueprint.md`](../contract-blueprint.md) “Human and agent authoring boundary.”

**Allowed areas:** `src/lab-workflows/authoring/**`, focused tests/docs.

**Do not touch:** React UI, agent routes/tools, chemistry/runtime transitions, persistence schema.

**Required changes:**

1. Define a closed `LabDraftCommand` union for add/remove/configure equipment, bind material, set layout, permit action, add/remove condition/rule/dependency/instruction/objective/rubric criterion.
2. Parse commands strictly and resolve exact IDs/capability-supported connections through injected read-only registries.
3. Return a new serializable draft and stable result/error; never mutate input.
4. Every successful edit sets `draft_unvalidated`, clears validation/Judge, and updates deterministic revision/edit metadata according to v2 contract.
5. Removing an instance must either reject referenced dependencies with exact paths or perform an explicit documented cascade command; never leave dangling refs silently.
6. Provide save/load serialization helpers only for in-memory/local fixture use; database work waits.

**Tests:** each command success; unknown ID; incompatible connection; duplicate instance/rule; dangling removal; bounds; no mutation; exact invalidation for every edit type; deterministic command sequence; serialization round trip; no LLM/browser/network imports.

**Acceptance:** A test can construct the supported titration setup/rules using commands, validate it, edit it, and observe validation invalidation. No UI/agent is needed.

**Stop:** Do not add commands that write registries or arbitrary JSON paths.

## LC2-401 — Equipment/material library and structured setup editor

**Objective:** Build an accessible teacher interface for supported equipment, exact material bindings, configuration, and bounded 2D bench layout using `LC2-400` commands.

**Dependencies:** `LC2-400`.

**Status:** Implemented. The teacher Composer route projects only verified executable equipment and binding-capable materials from the existing registries. Equipment add/remove/configure, exact material/quantity binding, bounded compatible slot placement, and capability-derived action permissions all execute through `LC2-400`; the React layer does not mutate workflow JSON or infer compatibility. The inspector exposes exact capabilities, actions, configurations, safety constraints, adapter IDs, and performance tier. Stable command dependency errors are visible, every successful edit remains explicitly unvalidated, and Preview/Assign remain disabled. Catalog tests and Playwright coverage verify filtering, exact derived choices, setup editing, rejected referenced removal, keyboard activation, and Chromebook-width containment.

**Allowed areas:** `src/app/teacher/lab-composer/**`, `src/components/teacher/lab-composer/**`, teacher UI state/styles/tests, narrow command client adapter.

**Do not touch:** command semantics, chemistry/runtime internals, agent prompts, persistence schema, student scene.

**Required changes:**

1. Display only registered supported/declared equipment/materials with clear availability and performance/safety status.
2. Add/remove/select equipment through commands.
3. Configure exact presets and bind material/quantity only when container capabilities/policies allow it.
4. Provide a bounded 2D bench/slot editor; no polished 3D graph editor required.
5. Provide inspector for selected instance, capabilities, supported actions, config, binding, safety, and adapter status.
6. Surface stable command errors; every edit visibly marks draft unvalidated and disables preview/assign.
7. Keep keyboard operation, focus, contrast, empty/loading/error states, and Chromebook viewport usable.

**Tests/manual:** library filters; add/remove/config/bind/layout commands; unsupported connection absent/disabled; command error; edit invalidation; keyboard; common viewports; no raw registry ID free-text entry; serialized setup matches reducer output.

**Acceptance:** A teacher can assemble the supported titration physical setup without an LLM, but cannot preview until later validation/preview work.

**Stop:** Do not calculate chemistry, allow arbitrary materials, or duplicate the command logic in React state.

## LC2-402 — Workflow constraints, instructions, objectives, and rubric editor

**Objective:** Let teachers author typed conditions, partial-order dependencies, success/failure/best-practice rules, presentation guidance, objectives, and rubric mappings through shared commands.

**Dependencies:** `LC2-400`; coordinate UI shell with `LC2-401`.

**Status:** Implemented. The same Composer surface authors objective membership, typed action-evidence and numerical-tolerance rules, severity/recoverability/terminal semantics, partial-order dependencies, presentation-only instructions, and evidence-mapped rubric criteria through the shared command service. Registry/setup-derived selects replace raw registry ID entry, ordering remains a list of explicit edges rather than a total click sequence, and the authored point total is informational until deterministic validation. Reducer errors remain authoritative and edits keep Preview/Assign invalidated. Browser coverage exercises rule, tolerance, instruction, and criterion authoring plus the unvalidated gate.

**Allowed areas:** teacher Composer constraint/inspector components, command client usage, UI tests/styles/docs.

**Do not touch:** deterministic evaluator semantics, agent tools, chemistry, persistence, preview implementation.

**Required changes:**

1. Offer only condition/rule/action/objective choices supported by current exact registries and setup instances.
2. Visualize ordering dependencies as a small accessible list/graph; allow independent rules without forcing total order.
3. Configure recoverable/terminal/severity/tolerance fields with schema bounds.
4. Edit instruction sections separately and reference related rule IDs.
5. Map rubric criteria to objectives/rules/evidence and show total/passing validation state without client-side runnability inference.
6. Show broken/dangling references as draft errors; domain reducer remains authority.
7. Every edit invalidates prior artifacts and preview/assign.

**Tests/manual:** create two independent prerequisites converging on success; add/remove ordering edge; cycle command failure or later validator issue per contract; recoverable/terminal rule; tolerance bounds; objective/rubric mapping; instruction reorder does not alter runtime dependencies; keyboard/viewport.

**Acceptance:** A teacher can express the native titration alternate order and rubric without editing JSON or using an LLM.

**Stop:** Do not add arbitrary formulas, expression builders, or a “golden click sequence” as the only workflow representation.

## LC2-403 — Validation panel, local save/load, and real preview

**Objective:** Complete the human Level 2 authoring loop with deterministic validation, authority-separated status, local/versioned save-load abstraction, and isolated real-runtime preview.

**Dependencies:** `LC2-401`, `LC2-402`.

**Status:** Implemented. The Composer invokes the real v2 validator locally and presents deterministic status, eligibility, issue code/path/severity/safety, passed checks, canonical hash, validator version, registry snapshots, resolved chemistry models/adapters, and explicit legacy-adapter provenance. Deterministic authority and the future advisory Workflow Judge are visually and semantically separate. Strict versioned local draft and preview repositories re-parse every load; invalid envelopes and mismatched preview hashes fail closed. Only an exact current hash with `runnable` and `previewEligible` artifacts enables Preview. The preview route re-evaluates eligibility, supplies the exact saved validated definition to the generic coordinator, labels the session as isolated teacher preview, and runs actions through the existing `ExperimentDefinition.step()` compatibility port. Any command edit or draft load clears validation and closes Preview; Assign remains disabled for Phase 8. Unit/store tests and Playwright cover save/load equality, invalid payloads, exact custom-definition runtime loading, stale/missing hashes, real scene startup, and a real normalized meniscus action/evidence path.

**Allowed areas:** teacher Composer UI, narrow validation API/client if needed, preview routing/session isolation, local repository abstraction, tests/e2e/docs.

**Do not touch:** permanent Supabase schema, agent/Judge implementation, assignment, chemistry, alternate preview engine.

**Required changes:**

1. Invoke the real v2 validator and display status, eligibility, issue code/path/severity/safety, passed checks, exact hash, validator/registry/model/adapter versions.
2. Label deterministic validation authority. Reserve a separate advisory area for future Judge; never infer pass from empty issues.
3. Save/load strict versioned drafts through an interface with a local/in-memory implementation. Loading re-parses strictly.
4. Launch preview only from current hash-matching `runnable`/`previewEligible` result.
5. Preview the exact saved definition through the generic coordinator/student scene and isolate metrics/session labels.
6. Any edit invalidates and prevents relaunch until revalidation.
7. Show legacy adapter status explicitly for migrated titration.

**Tests/manual:** valid/invalid/safety/stale statuses; issue navigation; save/reload equality; invalid saved payload; edit invalidation; preview exact hash; stale URL fail closed; real action/event/diagnosis path; return/edit/revalidate; keyboard/common viewport/e2e.

**Acceptance:** Without an LLM, a teacher or fixture can assemble, configure, constrain, validate, save, load, preview, and replay the supported titration definition.

**Stop:** Do not call local draft storage assignment persistence or add the Judge route. Permanent immutable storage arrives in Phase 8.

## LC2-403A — Preview action-boundary enforcement and domain-error containment

**Objective:** Correct the setup-driven preview defect in which an interaction can dispatch a normalized action outside its exact registered or authored parameter bounds and allow the resulting deterministic runtime error to escape into the Next.js development overlay.

**Dependencies:** `LC2-403`.

**Status:** Implemented on 2026-07-18. Browser reproduction showed that rapid physical stopcock detent changes could flush a `0.005–0.01 mL` fragment: the gesture residue threshold was `0.005 mL`, while the registered dispense action minimum is `0.01 mL`. Typed runtime failures then escaped the store into the Next.js overlay, and an in-flight gesture could continue after permission changed. The setup projection now carries registered, authored, and effective numeric bounds; physical and precision controls consume the same effective range; sub-minimum detent fragments are retained until valid or returned on cancel; action volume is normalized downward at the existing six-decimal engine precision; and permission changes or rejected dispatches close without another commit. The generic runtime remains strict and reports submitted/registered/authored/effective bounds. The setup-driven store contains only typed runtime/session action failures, preserves the last valid state/evidence/replay/checkpoint, and exposes an accessible dismissible in-lab alert; unknown legacy/programming errors still throw. Focused reducer, scene, runtime, store, and exact-hash Composer Playwright coverage prove boundary behavior and non-mutation.

**Read first:** the exact preview workflow and its `authoredLimits`; action parameter schemas; generic runtime `validateParameters`; setup-driven scene projection; `TitrationControls`; `useDispenseGesture`; store dispatch; current component/store/runtime/e2e tests.

**Allowed areas:** setup-driven student controls and gesture adapter, student-store error presentation, generic runtime error details, focused component/store/runtime/e2e tests, and this ticket's status documentation.

**Do not touch:** chemistry formulas or truth, registered action bounds, workflow hashes except when an intentional schema-owned artifact requires regeneration, legacy runtime behavior unrelated to error containment, assignment/persistence, agent/Judge code, or the generic runtime's fail-closed policy.

**Required changes:**

1. Add a deterministic reproduction that records the exact normalized action generated by the physical stopcock at the workflow's `maxVolumeMLPerAction` boundary. Characterize whether the observed failure is floating-point accumulation, a stale projected limit, an unavailable-action affordance, or another adapter defect before selecting the fix.
2. Keep the generic runtime strict: a value genuinely above a registered or authored maximum must still be rejected. Do not add a broad epsilon or silently widen the workflow contract.
3. Make the continuous gesture adapter consume the current effective per-action limit and ensure every emitted commit is finite, positive, and no greater than the remaining effective allowance. Normalize only at the UI/mechanical adapter boundary using a documented unit precision; preserve total delivered volume and duration across split commits.
4. Re-check the effective limit at dispatch time so a changed projection, action availability transition, or completed rule cannot leave an in-flight gesture authorized by stale state. Stop and close the valve safely when permission becomes unavailable.
5. Keep manual precision controls aligned with the same projected permission and bounds. Show the exact permitted range and reject invalid input before dispatch without duplicating chemistry or validator logic.
6. Catch known typed runtime/session action errors at the student interaction boundary. Preserve the last valid state and trace, stop active manipulation, and render an accessible in-simulation alert with a useful corrective action. Unknown programming errors must remain observable and must not be mislabeled as student mistakes.
7. Extend structured parameter-error details to include the action ID, parameter key, submitted value, registered minimum/maximum, and effective authored minimum/maximum where present. Do not expose secrets or serialize runtime state into the error.
8. Ensure unavailable setup-driven actions are disabled in both accessible controls and 3D interaction affordances; an unavailable action must not reach `ExperimentDefinition.step()`.
9. Preserve the invariant that every accepted meaningful action still reaches the generic coordinator and `ExperimentDefinition.step()`. UI containment must not create a second state-transition path.

**Tests/manual:** exact-boundary stopcock delivery; many animation-frame partitions; one representable value above the authored maximum remains rejected; manual input at/below/above bounds; projected permission becoming unavailable during a gesture; unavailable 3D action; expected typed error renders in-lab without a React/Next.js crash overlay; unexpected error remains observable; state/event/trace unchanged after rejection; legacy-path regression; keyboard/pointer/visibility-change gesture endings; standard Composer preview e2e using its exact saved hash.

**Acceptance:** The exact validated Composer preview can perform its physical and precision-control actions at the authored boundary without crashing. Invalid actions remain deterministically rejected, the student receives an actionable in-lab message, and rejected actions do not mutate state, evidence, replay, or checkpoints.

**Stop:** Do not weaken hard validation, increase the `0.5 mL` authored limit to hide the defect, catch every exception indiscriminately, or move chemistry/action truth into React.

## LC2-404 — Guided Composer information architecture and authoring UX

**Objective:** Turn the functionally complete but expert-oriented Composer into a clear, task-based authoring experience that a teacher can use without understanding registry IDs, Lab IR structure, or the implementation order of domain commands.

**Dependencies:** `LC2-403A`.

**Status:** Implemented on 2026-07-18. The teacher Composer now presents the existing command-driven draft as five stable tasks—Define, Set up, Workflow, Assess, and Validate & preview—without using those stages as runtime truth or mutating the draft during navigation. Each task exposes a structural draft checklist that explicitly does not claim runnability; exact IDs, capability lists, adapters, versions, and hashes moved behind accessible Technical details disclosures. Setup action choices are filtered to combinations supported by the current equipment, rules and evidence use teacher-facing descriptions, validation issues identify and focus the responsible stage, and deterministic validator, advisory Judge, Preview, and future Assign authority remain separate.

Successful command outputs remain the only authored edit path. A teacher-only history adapter round-trips strict serialized snapshots, restores authored content as a new monotonic revision, clears validation/Judge authority, and requires revalidation after undo, redo, or load. The exact working draft is held in session storage across isolated Preview navigation but returns unvalidated. Focused presentation components provide stage navigation/context/footer controls without introducing another reducer or styling system. Component and Playwright coverage proves non-mutating stage navigation, strict history restoration, capability-filtered authoring, issue routing, keyboard focus, no horizontal overflow at 768/1024/1366/1600 widths, save/load, stale Preview gating, and exact-hash runtime preview.

**Read first:** the implemented `LC2-400` command service; the complete current Composer component and styles; catalog and local repository adapters; validation/preview eligibility; existing Composer Playwright tests; product design language used by the landing, experiment-selection, and student lab routes.

**Allowed areas:** `src/app/teacher/lab-composer/**`, `src/components/teacher/lab-composer/**`, teacher-only UI state/history helpers, focused component/e2e/accessibility tests, and Composer documentation. Use the existing shared design system and authoring command service.

**Do not touch:** command semantics, registries, Lab IR/schema/hashing, deterministic validator/evaluator/runtime, chemistry, student scene, agent/Judge routes, permanent persistence, assignment, or raw workflow mutation from React.

**Required changes:**

1. Replace the monolithic editing presentation with five stable teacher tasks: **Define**, **Set up**, **Workflow**, **Assess**, and **Validate & preview**. These are presentation stages, not runtime ordering constraints.
2. Keep the draft available across stages and preserve exact command-service output. Moving between stages must never mutate the draft, mark a rule satisfied, or imply deterministic validation.
3. Give every stage a plain-language purpose, a compact completion/readiness summary, and one obvious primary action. Readiness may summarize structural presence and real command/validator results but must never infer runnability client-side.
4. Use progressive disclosure. Keep exact IDs, adapter versions, capability lists, configuration schemas, and hash provenance in an accessible **Technical details** disclosure or inspector; show teacher-facing names, units, descriptions, and consequences by default.
5. In **Set up**, keep the equipment/material library, bench, and selected-instance inspector visually connected. Selecting an item must reveal only compatible configuration, binding, placement, and action choices derived from the existing catalogs and command service.
6. In **Workflow**, present rules by pedagogical role—required, success, failure, safety, and best practice—and show ordering dependencies as explicit “must happen before” relationships. Independent rules must remain visibly independent; do not introduce a golden click sequence.
7. In **Assess**, make objective-to-rubric-to-evidence mappings readable in one place. Show missing mappings and point-total issues using validator/command results, not an alternate UI scoring system.
8. In **Validate & preview**, lead with a concise actionable issue list. Each issue must identify its stage and focus or navigate to the relevant control when possible. Keep deterministic validator authority, advisory Judge status, compatibility provenance, Preview, and future Assign authority visibly separate.
9. Add safe client-side undo/redo over immutable successful command results. Undo/redo must restore a strict draft snapshot, increment or otherwise preserve revision semantics through a documented command/history adapter, clear stale validation/Judge artifacts, and never restore eligibility from history without revalidation.
10. Preserve save/load behavior and provide persistent, consistently placed Previous, Next, Save, Validate, and Preview actions as appropriate. Disabled actions must explain why.
11. Provide deliberate empty, first-use, selected, invalid, validating, runnable, and preview-return states. Do not require teachers to discover functionality through empty select boxes or internal terminology.
12. Split the oversized UI into focused presentation components with explicit props while leaving compatibility and domain decisions in existing catalogs/commands. Do not create a second Composer state model or styling system.
13. Match the established LabBench typography, surfaces, controls, focus states, spacing, and scientific visual language. Avoid generic dashboard styling, decorative effects, or excessive cards.
14. Keep the workflow usable by keyboard and screen reader at Chromebook-class desktop widths and supported narrower viewports. Stage changes and validation navigation must manage focus predictably and announce status changes.

**Tests/manual:** complete the supported titration authoring path across all five stages; stage navigation does not edit; setup choices remain capability-filtered; rule independence and dependency editing; rubric mapping; command failure appears beside the relevant task; edit/undo/redo invalidates validation; save/load equality; validation issue navigation; stale Preview remains disabled; exact runnable Preview opens and returns without losing the draft; no primary-path raw registry IDs; keyboard-only and screen-reader landmarks/status; 1024×768, 1366×768, and wide desktop containment; no horizontal page overflow; existing command/catalog/runtime tests unchanged.

**Acceptance:** A teacher unfamiliar with the Lab IR can understand where they are, what remains, and why Preview is or is not available; can author, save, validate, and preview the currently supported titration workflow without consulting repository documentation; and produces the same strict command-service draft and validation artifact as before the redesign.

**Stop:** Do not replace capability-driven authoring with experiment-family templates, hide validator failures, add a second draft reducer, make the stage sequence runtime truth, or broaden the ticket into second-lab, agent, Judge, assignment, or chemistry work.

## LC2-405 — Atomic editing and dependency-aware removal

**Objective:** Extend the shared authoring command layer with atomic multi-command transactions and deterministic dependency-aware removal plans so teachers can remove authored content without React inventing cascade semantics or leaving dangling references.

**Dependencies:** `LC2-404`.

**Status:** Complete.

**Read first:** the complete `src/lab-workflows/authoring/**` command service and tests; v2 draft schema, canonical hash, validation/Judge invalidation, and exact registry contracts; current Composer removal affordances and dependency-error presentation.

**Allowed areas:** `src/lab-workflows/authoring/**`, `tests/lab-workflows/authoring/**`, narrow contract exports, focused fixture/docs updates.

**Do not touch:** React UI, chemistry/runtime/evaluator semantics, registries, persistence schema, agent/Judge routes, Preview eligibility rules, or arbitrary JSON-path mutation.

**Required changes:**

1. Add `applyLabDraftTransaction()` over the existing closed command union. It accepts strict typed commands and an expected revision, applies every command or none, increments the revision exactly once, and invalidates deterministic validation and advisory Judge artifacts exactly once. Failure returns no changed draft plus the failing command index and stable dependency details.
2. Preserve `applyLabDraftCommand()` as the public one-command form of the same transaction behavior. Existing one-command success, error, immutability, revision, and invalidation contracts must remain compatible.
3. Add deterministic removal inspection for objective, equipment, rule, material binding, permitted action, instruction, and rubric criterion targets. The public contract must include:

   ```ts
   type LabDraftRemovalTarget =
     | { kind: "objective"; objectiveId: string }
     | { kind: "equipment"; instanceId: string }
     | { kind: "rule"; ruleId: string }
     | { kind: "material"; instanceId: string }
     | { kind: "permitted_action"; permissionId: string }
     | { kind: "instruction"; instructionId: string }
     | { kind: "rubric_criterion"; criterionId: string };

   interface LabDraftRemovalImpact {
     sourceRevision: number;
     sourceDraftHash: string;
     target: LabDraftRemovalTarget;
     references: readonly RemovalReference[];
     compatibilityEffects: readonly CompatibilityEffect[];
     allowedResolutions: readonly RemovalResolutionKind[];
   }
   ```

   Exact subordinate field shapes must be strict, serializable, bounded, and documented. References report affected kinds, exact IDs, and paths. Compatibility effects describe compatibility-role consequences without claiming runnability.
4. Every removal plan pins its source revision and canonical draft hash. Applying a stale plan fails closed without mutation, even when the target still exists.
5. Add an `apply_removal` command whose requested resolution is selected from the inspected target's bounded resolution kinds. Core code recomputes the impact and dependency cleanup; callers never supply arbitrary paths or a client-authored cascade.
6. Support these deterministic resolution semantics:
   - objective: reassign references to another existing objective, detach references only where another objective remains and the strict schema permits it, or remove dependent content explicitly;
   - equipment: remove its layout placement, contained material bindings, action permissions, equipment-dependent rules, safety/presentation references, and compatibility-role binding;
   - rule: remove ordering edges, availability references, related instructions, rubric evidence mappings, and presentation references;
   - material binding, permitted action, instruction, and rubric criterion: clean only their exact registered dependencies.
7. Core compatibility equipment may be removed only through an explicit confirmed removal resolution. The resulting strict draft remains `draft_unvalidated`, has no current validation/Judge artifacts, and cannot inherit Preview eligibility. Compatibility restoration and revalidation are later explicit actions.
8. Add the explicit closed commands required by the inspectors and later UI: update metadata, replace rule, replace instruction, replace rubric criterion, remove material binding, and remove permitted action. Parse payloads strictly and reuse the same registry/reference validation as their add forms.
9. Keep direct strict removal commands available. They must continue to reject unresolved dependencies rather than silently cascading.
10. Return deeply frozen, strict-schema-parseable drafts and deterministic, stable error/reference ordering. No successful or failed operation may mutate its input, and no operation may depend on browser, network, LLM, or React code.

**Tests:** atomic multi-command success; atomic rollback with failing command index; exactly one revision increment and one invalidation; stale transaction and stale removal-plan rejection; deterministic impact/reference ordering; objective reassignment, permitted detach, and destructive dependent-content removal; optional and compatibility-role equipment removal; rule/material/action/instruction/criterion cleanup; direct strict removal still rejects dangling references; schema parse, serialization, deep freeze, no input mutation, and platform-neutral imports. Then run the full unit suite, lint, typecheck, production build, and Composer Playwright suite.

**Acceptance:** Core tests can inspect and explicitly resolve every supported removal target, including removal of compatibility-owned equipment into a strict but unvalidated draft. Transactions are all-or-nothing, revisions advance once, stale plans fail closed, and the resulting dependency cleanup is derived entirely by deterministic authoring code.

**Stop:** Do not put dependency traversal in React, accept caller-supplied paths, infer compatibility from `familyId`, weaken strict direct-removal behavior, preserve stale validation/Preview authority, or add a second draft/event model.

## LC2-406 — Full-width workspace and drag-and-drop setup

**Objective:** Rebuild Set up as an accessible full-width authoring workspace where verified equipment and materials can be placed through pointer, touch, click, or keyboard interactions over registered slots and the `LC2-405` command layer.

**Dependencies:** `LC2-405`.

**Status:** Complete.

**Read first:** `LC2-405` transaction/removal contracts; current Composer shell, stage chrome, setup catalog/inspector, styles, history adapter, and Playwright coverage; registered layout slots, equipment/material compatibility metadata, and reduced-motion/accessibility conventions.

**Allowed areas:** `src/app/teacher/lab-composer/**`, `src/components/teacher/lab-composer/**`, teacher-only non-authoritative interaction/view state, focused component/e2e/accessibility tests, `package.json`/lockfile for `@dnd-kit/core`, and Composer docs.

**Do not touch:** LabWorkflowSpec layout semantics, physical scene coordinates, registries, command/removal semantics, chemistry/runtime/evaluator code, persistence schema, agent/Judge routes, or Preview eligibility authority.

**Required changes:**

1. Add `@dnd-kit/core` and load the setup interaction code only from the teacher Composer route. Do not introduce a second drag-and-drop or layout dependency.
2. Add a Composer-specific workspace shell with a maximum width of `120rem`, `1rem` narrow gutters and `1.5rem` gutters from `1024px`, compact page header, `1.25rem–2rem` vertical padding, and `0.75rem–1rem` panel gaps. No fixed/floating footer or toolbar may obscure authoring content.
3. At wide widths, render an `18rem` library, flexible bench, and `22rem` inspector. Around `1024px`, keep library and bench visible and move the inspector into a selected-item drawer. On narrow screens use a single-column bench while retaining every click and keyboard action.
4. Drag equipment definitions from the verified library to compatible registered placement slots. Incompatible slots stay visible, disabled, and expose an exact reason. Adding and placing uses one `applyLabDraftTransaction()` call and creates one Undo entry. Canceled or rejected drops do not mutate the draft or history.
5. Drag existing equipment between registered slots through `set_layout`. Do not store free-form coordinates or treat pointer position as workflow truth.
6. Drag registered material chips onto compatible container instances to create exact bindings. Expose the same material, quantity/configuration, compatibility, and error information through non-drag controls.
7. Provide a visible removal zone and an inspector Remove action. Both open the same accessible impact dialog over `LC2-405` inspection. Required compatibility equipment can be removed after explicit warning that deterministic validation and Preview eligibility will be unavailable until compatibility is restored.
8. Provide keyboard/click equivalents for every drag action: Add to slot, Move to slot, Bind material, Replace, and Remove. Pointer drag must never be the only path.
9. Replace the action dropdown cluster with an inspector section listing only exact compatible interactions for the selected equipment. Enabling and removing interactions use typed permission commands; no UI-authored compatibility inference or raw ID entry is permitted.
10. Render expected command/removal failures beside the affected library item, slot, chip, or inspector control. Reserve the global error banner for storage failures and unexpected system errors.
11. Preserve strict save/load/history/invalidation behavior. One Undo reverses an entire add-and-place transaction, and any successful edit clears prior deterministic validation/Judge authority.
12. Keep focus restoration, live status announcements, Escape cancellation, touch targets, reduced motion, and Chromebook-class performance usable at all supported widths.

**Tests/manual:** pointer and keyboard add, move, bind, replace, and remove; incompatible slot/container rejection with reason; canceled drag non-mutation; one Undo restores an entire drop transaction; optional removal; compatibility-role removal produces an unvalidated Preview-blocked draft; removal-zone/inspector dialog parity; local item error placement; save/load/history regression; keyboard and screen-reader flow; reduced motion; visual containment at 768, 1024×768, 1366×768, 1600px, and ultrawide widths with no page overflow, excessive margins, obscured controls, or overlapping panels. Then run the full unit suite, lint, typecheck, production build, and Composer Playwright suite.

**Acceptance:** A teacher can assemble and revise the supported setup by drag-and-drop or equivalent keyboard controls using only verified definitions, registered slots, exact material connections, atomic commands, and the shared removal inspector. The serialized strict draft is identical regardless of interaction method.

**Stop:** Do not add physical/free-form coordinates, family templates, raw registry ID entry, client-side compatibility rules, a second history model, or setup-specific runtime control flow.

## LC2-407 — Graph-first workflow editor

**Objective:** Replace the form-heavy Workflow stage with an accessible node graph that directly projects existing typed rules and partial-order dependencies while retaining a fully equivalent Outline view.

**Dependencies:** `LC2-406`.

**Status:** Complete.

**Read first:** v2 rule/condition/ordering schemas and validator graph checks; `LC2-405` replace/removal/transaction commands; current Workflow UI, teacher-facing rule descriptions, view-state/history adapters, and Composer accessibility/e2e tests.

**Allowed areas:** `src/components/teacher/lab-composer/**`, teacher-only graph/view-state repository, focused component/e2e/accessibility tests, `package.json`/lockfile for `@xyflow/react`, and Composer docs.

**Do not touch:** LabWorkflowSpec or canonical hash for graph positions, rule/evaluator semantics, validator cycle authority, registries, runtime/chemistry, agent/Judge routes, persistence schema, or a separate graph workflow model.

**Required changes:**

1. Add `@xyflow/react`; do not add a separate graph-layout package. Load it only in the teacher Composer route and avoid rendering unnecessary graph chrome on constrained viewports.
2. Project every non-ordering workflow rule as one node and every `rule_satisfied_before` rule as one directed edge. Node/edge IDs must deterministically map back to the existing typed rule IDs; the graph is never authoritative workflow data.
3. Connecting handles dispatches `add_ordering_dependency`. Deleting an edge removes that exact ordering dependency through a strict command. Self-edges, duplicates, cycles, stale revisions, and unknown endpoints fail without draft mutation and render beside the attempted relationship.
4. Use deterministic in-house layout: horizontal position from topological depth and stable within-depth ordering by pedagogical role then rule ID. Do not introduce layout randomness or a hidden total order. Independent rules explicitly show “No prerequisite.”
5. Give nodes bounded, accessible role treatments for Required, Success, Failure, Safety, Best practice, and Scoring. Color may support but never solely communicate role, severity, failure, or selection.
6. Provide a verified rule palette. Dropping or selecting a rule type opens a bounded inspector; no rule is added until its typed condition and required fields are complete.
7. Edit condition, objective references, severity, recoverability, terminal behavior, tolerance, and points through `replace_rule`. Removing a node opens the shared `LC2-405` impact dialog and applies only a selected deterministic resolution.
8. Keep an always-available Outline view containing the same nodes, relationships, descriptions, add/edit/remove controls, errors, and ordering operations. Graph and Outline must dispatch the same commands and produce byte-equivalent strict drafts.
9. Treat graph node positions, viewport, selection, and Graph/Outline preference as non-authoritative Composer view state. They never enter LabWorkflowSpec, hashing, validation, replay, Preview, or runtime state.
10. Save view state separately alongside local drafts with its own version and draft identity. Missing, corrupt, or stale positions fall back to deterministic layout. Undo/redo and draft load prune view entries for removed rules without editing the strict draft.
11. Disable decorative animation under reduced motion. Do not render a minimap below wide desktop widths. Preserve keyboard navigation, focus order, screen-reader descriptions, zoom-independent controls, and touch usability.

**Tests/manual:** add/edit/delete nodes; connect/disconnect exact dependencies; multiple valid orders and independent nodes remain independent; self/duplicate/cycle/stale rejection and non-mutation; removal-impact dialog; graph/Outline command parity and serialized equality; view positions/preferences never alter workflow hash or validation; corrupt/stale view-state fallback; undo/redo pruning; keyboard-only and screen-reader relationships; reduced-motion behavior; supported viewport containment and Chromebook performance. Then run the full unit suite, lint, typecheck, production build, and Composer Playwright suite.

**Acceptance:** The default Workflow editor makes procedural relationships legible as a graph while the Outline exposes the same complete authoring surface. Both edit only the existing typed rules through shared commands, and no graph presentation state can affect deterministic workflow identity or execution.

**Stop:** Do not introduce graph-owned rules/edges, a layout package, graph coordinates in LabWorkflowSpec, a golden click sequence, client-side cycle repair, animated decoration that ignores user preference, or prose conditions.

## LC2-408 — Define, Assess, and integrated usability hardening

**Objective:** Complete the relationship-focused Composer by making Define and Assess fully command-editable, unifying destructive dialogs and non-authoritative view persistence, and hardening the full author-save-validate-preview loop before Phase 5.

**Dependencies:** `LC2-407`.

**Status:** Complete.

**Read first:** `LC2-405` through `LC2-407`; current Define/Assess/Validate stages, metadata/objective/rubric commands, validator issue contracts, local draft envelopes, Preview eligibility, authority displays, dialog/focus conventions, architecture and dependency docs.

**Allowed areas:** `src/lab-workflows/authoring/**` only for narrowly missing strict commands identified by this ticket, `src/app/teacher/lab-composer/**`, `src/components/teacher/lab-composer/**`, teacher-only local draft/view persistence adapters, focused authoring/component/e2e/accessibility tests, and Lab Composer architecture/backlog docs.

**Do not touch:** chemistry/runtime/evaluator truth, schema/registries unless an explicit blocker is documented and split into a schema-owned ticket, agent/Judge implementation, permanent persistence/assignment, Preview eligibility authority, or a second rubric/validity model.

**Required changes:**

1. In Define, edit title, student summary, grade band, duration, difficulty, and objectives through strict shared commands. No React component may patch the draft directly.
2. When a teacher unchecks a referenced objective, inspect its removal impact before dispatch. If another objective is selected, default to deterministic reference reassignment; expose destructive dependent-content removal as a secondary explicitly confirmed action.
3. In Assess, present Objectives → Rubric criteria → Evidence rules as a readable three-column relationship workspace. Selecting an objective filters or highlights its criteria and the corresponding Workflow graph/Outline evidence without changing the draft.
4. Add and edit rubric criteria in a bounded inspector through add/`replace_rubric_criterion` commands. Evidence choices must resolve exact existing rules and typed evidence mappings; no alternate scoring formula or free-form evidence ID is permitted.
5. Display missing mappings, point totals, passing-threshold conflicts, and fairness issues from current deterministic validator results. Authored-structure summaries may describe presence only and must not infer validity or runnability.
6. Use one accessible Composer dialog primitive for removal impact and other bounded confirmations. It must trap focus, label title/description, support Escape cancellation where safe, distinguish destructive confirmation, prevent stale-plan application, and restore focus to the invoking control.
7. Persist non-authoritative graph positions, Graph/Outline preference, inspector selection, and other approved view state separately from the strict draft. Retain compatibility with existing saved draft envelopes; old drafts load with deterministic default view state and unchanged workflow hashes.
8. Ensure save/load, undo/redo, objective reassignment, removal, and preview return prune stale selections/positions while preserving monotonic revision and invalidation semantics. View-state changes alone must not create Undo entries or invalidate validation.
9. Keep separate, explicit authority displays for deterministic validation, advisory Judge status, compatibility support, Preview eligibility, and future Assign. Only a current hash-matching `runnable` result may enable Preview; Judge or structural readiness cannot override it.
10. Update stage readiness to summarize authored structure only. Empty, invalid, stale, validating, runnable, and preview-return states must explain the next action without exposing raw dependency errors as the primary teacher experience.
11. Complete keyboard-only and screen-reader navigation across library/bench/inspector, graph/Outline, objective/criterion/evidence relationships, dialogs, validation issues, and Preview return. Maintain containment and unobscured controls across the required viewport matrix.
12. Update `docs/lab-composer-architecture.md`, the phase ticket backlog, dependency map, and relevant current-state documentation. Make `LC2-500` and later Composer integrations depend on `LC2-408`; identify any schema, registry, migration, or documentation follow-up without implementing future-ticket work.

**Tests/manual:** metadata and objective command editing; referenced objective reassign and destructive removal; three-column objective/criterion/evidence selection and edit; validator-owned missing mapping/total/fairness display; stale dialog plan rejection, Escape, focus trap, destructive confirmation, and focus restoration; old/new saved envelope compatibility; graph/view state remains hash-neutral; save/load/undo/redo/preview-return pruning; separate authority displays and Preview gate; complete supported titration authoring and deterministic validation; remove/reassign Meniscus Reading and Endpoint Control without raw dependency errors; remove compatibility equipment, observe blocked Preview, restore compatible setup, and revalidate; keyboard-only and screen-reader navigation; 768, 1024×768, 1366×768, 1600px, and ultrawide containment with no overflow or overlap; full unit, lint, typecheck, production build, and Composer Playwright suite.

**Acceptance:** A teacher can define, assemble, relate, assess, remove/reassign, save, load, undo/redo, validate, and preview the supported titration through one accessible capability-driven workspace. The strict draft remains the only authoring model, view state is hash-neutral, and every invalid intermediate draft keeps Preview closed until deterministic validation succeeds again.

**Stop:** Do not calculate rubric or chemistry truth in UI, let Judge override hard validation, persist view data inside LabWorkflowSpec, add assignment/persistence/agent features, bypass the shared command layer, or begin `LC2-500` work in this ticket.

## LC2-408A — Teacher-language and direct-manipulation corrective pass

**Objective:** Correct the shipped Composer interaction failures and remove implementation vocabulary from the teacher path without changing authoring commands, workflow truth, compatibility authority, or Preview eligibility.

**Dependencies:** `LC2-408`.

**Status:** Complete on 2026-07-18. Manual input values are captured before React state updates, teacher-facing Composer copy no longer exposes hashes, schema paths, registry/adapter IDs, or Technical details, and the shared removal dialog now uses plain grouped impact descriptions with comfortable spacing. Setup equipment/material dragging has a live overlay, Workflow nodes follow the pointer, visible handles create the same ordering command as the first/next form, and the graph controls use labeled symbols. Define, Set up, Workflow, and Assess use simpler task language while the UI explicitly identifies acid-base titration as the current verified simulation boundary. The strict draft, removal planning, command dispatch, validation invalidation, hash-neutral view state, and Preview gate are unchanged. The full 491-test unit suite, lint, typecheck, production build, and all 12 Composer Playwright scenarios pass; manual responsive captures at 768, 1024, and 1600 pixels show no horizontal overflow.

**Allowed areas:** `src/app/teacher/lab-composer/**`, `src/components/teacher/lab-composer/**`, focused Composer component/e2e/accessibility tests, and Composer status/backlog documentation.

**Do not touch:** authoring command/removal semantics, schemas, registries, chemistry/runtime/evaluator truth, persistence/assignment, agent/Judge implementation, or the current verified runtime surface.

**Required changes:**

1. Capture input and checkbox values synchronously before React state-updater callbacks. Manual typing, selection, and criterion/rule checkbox editing must never dereference a released synthetic event.
2. Remove teacher-facing raw hashes, schema paths, registry IDs, adapter IDs, and Technical details disclosures. Validator and command failures retain their exact internal contracts but render as plain-language guidance and stage links.
3. Give the shared impact dialog comfortable inner spacing, plain resolution labels, grouped human descriptions of affected content, and no draft-hash or raw-path language.
4. Add visible drag overlays for equipment/material setup dragging and update Workflow node positions during pointer movement. Canceled drags remain non-mutating and saved graph positions remain non-authoritative.
5. Make Workflow connections discoverable and operable from visible node handles and an equivalent plain-language “first/next” form. Add labeled symbol controls for zoom in, zoom out, and fit-to-view.
6. Re-project the Workflow graph and Outline immediately after every successful rule or relationship edit. Changed labels and conditions must update in place; removed nodes and edges must disappear without a refresh or view switch; stale graph selection and saved positions must be pruned.
7. Simplify Define, Assess, Workflow, and Set up copy. Add clear spacing between definition saving and objectives. Explain that placement choices reflect what the current verified simulation can actually run, and state honestly that the current verified catalog is acid-base titration without introducing family dispatch or fake generic support.
8. Keep all click/keyboard alternatives, focus behavior, strict command dispatch, validation invalidation, history, save/load, Preview gating, and narrow-viewport containment intact.

**Tests/manual:** manual-style typing and checkbox regression with page-error capture; equipment/material drag overlay follows the pointer and cancel does not edit; graph node follows pointer; handle-created and form-created ordering edges use the same command; editing a rule immediately updates its node and Outline entry; removing a rule or ordering relationship immediately removes its node/edge and prunes stale selection/position state; symbol controls have accessible names; no teacher-visible Technical details, raw hash, or schema path; impact-dialog spacing; Define/Assess/Workflow/Set up screenshots at supported widths; full unit, lint, typecheck, production build, and Composer Playwright suite.

**Acceptance:** A teacher can type, select, drag, connect, remove, and assess without a runtime error or implementation vocabulary. The interface clearly communicates the present verified titration limit while the strict draft, command, validation, hash, and runtime boundaries remain unchanged.

**Stop:** Do not broaden the runtime or registry catalog to imply unsupported labs, weaken validation, move dependency cleanup into React, or place view coordinates into the workflow spec.

## LC2-409 — Verified 3D equipment arrangement

**Objective:** Make the real setup-driven 3D bench the default Set up editor so teachers can arrange equipment through verified code-owned poses while the strict draft continues to store only registered placement IDs.

**Dependencies:** `LC2-408A`.

**Status:** Complete. The strict draft still stores only registered placement IDs. A versioned scene-placement registry now owns exact poses, yaw variants, footprints, and assembly anchors; validation rejects unknown poses, visual mismatches, overlaps, broken alignment, and stale pose authority. The setup-driven student scene projects equipment and indicator paths from those poses. Set up defaults to a demand-rendered 3D bench where the actual models follow pointer movement and snap to safe registered positions, while an always-available List exposes the same exact moves. The burette/flask station moves through one `set_layout` edit and one Undo entry. No chemistry, free coordinates, physics, student movement, room authoring, family dispatch, or second-lab entries were added.

**Allowed areas:** deterministic configuration/scene-placement registry metadata and validation, setup-driven visual projection, shared Three.js bench composition, teacher Composer Set up UI, focused authoring/validation/scene/e2e/performance tests, and Composer architecture/status documentation.

**Do not touch:** chemistry formulas or event truth, normalized student action semantics, workflow/rubric contracts, persistence/assignment, Author/Judge agents, second-lab equipment, arbitrary authored transforms, room/lighting authoring, or family-based dispatch.

**Required changes:**

1. Add an exact versioned scene-placement registry containing code-owned position, allowed yaw, footprint, assembly anchor, compatible equipment/visual adapter IDs, and compatibility metadata. The strict workflow draft continues to store only `equipmentInstanceId` and `placementSlotId`; authored XYZ/rotation values are forbidden.
2. Preserve every current placement ID as the current visual pose. Register at least one additional complete verified arrangement so each supported setup can move between meaningful configurations. Any semantic pose change requires a new placement ID and registry snapshot.
3. Extend deterministic v2 validation to reject unknown scene poses, incompatible equipment/visual adapters, overlapping registered footprints, and broken assembly alignment. Preview remains closed for invalid or stale placement authority.
4. Resolve setup-driven student equipment, hit targets, camera focus poses, burette stream/flask alignment, indicator movement paths, and preparation equipment from the exact validated scene placements rather than fixed world positions. Do not change scientific state or action dispatch.
5. Make the real 3D bench the default Set up editor. During a teacher drag, the selected model follows the pointer as transient view state, compatible anchors are visible, and release snaps to one exact registered pose. Invalid/canceled drops do not mutate the draft.
6. Move linked equipment as a verified assembly. Moving the current burette apparatus moves its receiving flask atomically through the existing `set_layout` command, increments revision once, invalidates validation once, and creates one Undo entry.
7. Allow only registered yaw variants and show rotation controls only where a verified alternative exists. Room, lighting, and cameras remain automatic; camera targets derive from the selected pose.
8. Keep an always-available List view with equivalent Move to, Rotate, Reset, Replace, and Remove controls. It is the keyboard/screen-reader and WebGL-unavailable fallback and uses the same shared commands.
9. Dynamically load the editor only for Set up, retain demand rendering and existing performance tiers, respect reduced motion, and avoid per-frame validation or workflow mutation.
10. Update architecture, dependency maps, and current-state documentation. Make `LC2-500` depend on `LC2-409` without implementing any Phase 5 equipment or chemistry.

**Tests/manual:** exact placement lookup/unknown/duplicate/immutability/snapshot tests; valid and invalid alignment/collision/adapter validation; current-draft visual/hash compatibility; atomic assembly move and one-step Undo; pointer-following model, valid snap, invalid/canceled non-mutation, rotation, reset, List parity, keyboard/focus/status, WebGL fallback, save/load/revalidate/Preview; setup-driven student action/replay parity; camera/stream/indicator path projection; reduced motion and Chromebook demand rendering; 768, 1024×768, 1366×768, 1600px, and ultrawide containment; full unit, lint, typecheck, production build, Composer Playwright, and setup-driven student Playwright suites.

**Acceptance:** A teacher can arrange the actual supported 3D equipment, save/reload/undo the resulting registered layout, validate it, and Preview the exact same locked student arrangement. The model follows the pointer while editing, every completed placement is a verified registered pose, linked apparatus remains functional, and deterministic validation is still the sole Preview authority.

**Stop:** Do not store free-form coordinates, add a physics engine, permit student rearrangement, author the room/camera/lighting, weaken exact placement validation, add second-lab registry entries, or fork the strict draft/runtime/scene model.

## LC2-410 through LC2-416 — Strict Product Judge corrective pass

Source: the adversarial QA review recorded in [`../../qa/strict-product-judge-report.md`](../../qa/strict-product-judge-report.md), with the language inventory in [`../../qa/teacher-language-inventory.md`](../../qa/teacher-language-inventory.md) and reproduction steps in [`../../qa/reproduction-checklist.md`](../../qa/reproduction-checklist.md). Confirmed reproductions live in `tests/lab-workflows/authoring/qaReproductions.test.ts`.

These tickets harden the shipped human Composer before Phase 5. `LC2-410`, `LC2-412` (S1) and `LC2-411`, `LC2-413`, `LC2-414` (S2) are release blockers and must be complete before `LC2-500` feature work. They do not add chemistry, agents, assignment, or the second lab.

### LC2-410 — Draft persistence and unsaved-change protection

**Objective:** Stop the Composer from silently discarding a teacher's unsaved lab on refresh, Back, or accidental navigation (report finding TEACHER-002, S1).

**Dependencies:** `LC2-409`.

**Status:** Implemented on 2026-07-18. The working draft now autosaves (debounced) to a dedicated `labbench.composer.working-draft.v1` key after each edit; on mount the Composer restores that autosave when there is no preview-return draft, as a new unvalidated draft that keeps Preview closed until revalidation, and shows a plain restore notice. A `beforeunload` guard fires only when the current draft hash differs from the last named-save baseline, and a named Save resets that baseline. Autosave degrades to in-memory with a teacher-facing notice when storage is unavailable, and a corrupt autosave is discarded rather than blocking the builder. For maximum loss-safety the autosave mirrors the live draft even after a named Save (so a refresh restores the exact working state); the strict draft, hashing, validation invalidation, and Preview authority are unchanged. Repository unit tests cover the working-draft round trip and a new Composer e2e proves an edit survives a refresh; the full 503-test unit suite and all 14 Composer Playwright scenarios pass.

**Read first:** `LabComposer.tsx` draft state, mount effect, and `COMPOSER_RETURN_DRAFT_KEY` handling; `localRepository.ts` draft repository and key prefixes; `draftHistory.ts` snapshot restore; existing Composer Playwright coverage.

**Allowed areas:** `src/app/teacher/lab-composer/**`, `src/components/teacher/lab-composer/**`, the local draft/autosave adapter, focused component/e2e tests, and this ticket's status.

**Do not touch:** authoring command/removal semantics, schema/hash, validator/runtime/chemistry, permanent persistence, agent/Judge routes, or Preview eligibility authority.

**Required changes:**

1. Autosave the working draft to a dedicated versioned local key (separate from named saves and the one-shot preview-return key) after each successful edit, debounced and without adding Undo entries or mutating the strict draft.
2. On mount, restore the autosaved working draft when present (after the existing preview-return restore takes precedence), as a new unvalidated draft that requires revalidation before Preview. A first-ever load with no autosave still seeds the current default.
3. Add a `beforeunload` guard that warns about unsaved changes only when the working draft differs from the last named save / initial seed, and clear it once saved.
4. Clear the autosave entry on explicit named Save (so a saved lab is the source of truth) and when the teacher starts a new lab (`LC2-412`).
5. Keep autosave resilient to storage failures: a full or unavailable `localStorage` must degrade to in-memory only with a teacher-friendly notice, never a raw exception (coordinate with `LC2-415`).

**Tests/manual:** edit → reload restores the edit rather than the default seed; `beforeunload` fires only with unsaved changes; named Save clears the dirty flag; autosave never creates Undo entries or changes the workflow hash; storage-failure fallback shows a friendly notice; keyboard/viewport unchanged. Then full unit, lint, typecheck, build, Composer Playwright.

**Acceptance:** A teacher who edits and then refreshes/navigates keeps their lab (or is explicitly warned before losing it). Autosave is non-authoritative: restored drafts are unvalidated and Preview stays closed until revalidation.

**Stop:** Do not treat autosave as assignment persistence, store view state inside the strict draft, or restore Preview eligibility from storage.

### LC2-411 — Explicit reagent–container pairing and container exclusivity

**Objective:** Require each reagent to be paired with a specific container before it enters the setup, and forbid chemically contradictory bindings — a reagent in two containers, or two reagents in one container (report finding TEACHER-005, S2; the repository owner's stated priority).

**Dependencies:** `LC2-410`.

**Status:** Implemented on 2026-07-18. The `bind_material` command now rejects placing a second, different reagent into a container that already holds one, and rejects binding the same reagent profile into more than one container (capability compatibility still enforced separately). Deterministic v2 validation adds a `materialContainerExclusive` check that fails closed on any draft with two reagents in one container or one reagent across two containers, so an imported/edited draft cannot reach runnable/Preview in that state. In Set up, the silent "Best available container" auto-pick is gone: the teacher picks an explicit empty container, "Add material" stays disabled until one is chosen, already-placed reagents and occupied/absent containers show plain pair-first guidance, and the drag-to-container path rejects occupied containers and already-placed reagents with specific reasons. The `qaReproductions.test.ts` TEACHER-005 block now asserts rejection and validation refusal; the "bounded registered controls" e2e pairs distilled water to an explicit reagent bottle. This ticket adds no new glassware or chemistry (that remains Phase 5). Full 503-test unit suite, all 14 Composer Playwright scenarios, typecheck, and lint pass.

**Read first:** `bind_material` parsing/validation in `src/lab-workflows/authoring/service.ts` and `commands.ts`; `materialSupportsContainerCapabilities` and `compatibleContainers` in `catalog.ts`/`registries/reagents`; v2 material/binding schema and `validateLabWorkflowSpecV2` material checks; `ComposerSetupWorkspace.tsx` Material / "Put it in" / "Add material" controls and drag-to-container binding; `qaReproductions.test.ts` TEACHER-005 block.

**Allowed areas:** `src/lab-workflows/authoring/**` (bind_material constraints), `src/lab-workflows/validation/**` (material-binding checks), `src/components/teacher/lab-composer/**` and `catalog.ts` (pairing UI), focused authoring/validation/component/e2e tests, and this ticket's status.

**Do not touch:** chemistry truth, reagent registry science, runtime/evaluator semantics, the second-lab glassware catalog (Phase 5 `LC2-500`), or arbitrary authored chemicals. This ticket constrains pairing over the existing verified glassware only.

**Required changes:**

1. In the authoring command layer, reject a `bind_material` command that would place a second reagent in a container that already holds a different reagent, and reject binding the same reagent profile into more than one container, with stable dependency error codes (reuse `authoring.incompatible.v1`/`authoring.duplicate_id.v1` semantics or add a narrow new code). Capability compatibility remains a separate, still-enforced check.
2. Extend deterministic v2 validation to fail closed on any draft that already contains two reagents in one container or one reagent across two containers, so an imported/edited draft cannot reach `runnable`/Preview in that state. Add valid/invalid/safety tests.
3. In Set up, replace the silent "Best available container" auto-pick: the teacher explicitly chooses (or drags to) a specific container, and "Add material" is disabled until a container is chosen. Pair-first ordering — a reagent cannot be added until a compatible container exists on the bench.
4. Surface the new pairing errors beside the material control in plain language (coordinate wording with `LC2-415`), e.g. "That container already holds another reagent" / "This reagent is already placed in another container."
5. Keep drag-to-container binding and the non-drag controls behaviorally identical and producing byte-equivalent strict drafts.

**Tests/manual:** `qaReproductions.test.ts` acid→base-burette case now returns a command error and the desired `it.fails` validation guard becomes a normal passing assertion (convert it); binding a reagent to a second container is rejected; adding a reagent with no compatible container present is blocked with a reason; "Add material" disabled until a container is chosen (no silent auto-pick); capability-incompatible pairings still rejected; drag and non-drag paths equal; keyboard/viewport. Then full unit, lint, typecheck, build, Composer Playwright.

**Acceptance:** A teacher pairs each reagent with an explicit container; a container holds at most one reagent and a reagent lives in at most one container; the checker refuses to mark contradictory setups runnable; nothing is auto-placed silently.

**Stop:** Do not add new glassware or chemistry here (that is `LC2-500`), invent registry IDs, or move compatibility science into React.

### LC2-411A — Indicator shelf reflects bound indicators; pairing dead-end guidance

**Objective:** Correct two issues found while testing `LC2-411`: the 3D bench indicator shelf rendered all three indicator bottles regardless of what the lab actually contains, and a teacher who picks a material with no available container got a dead-end with unclear next steps.

**Dependencies:** `LC2-411`.

**Status:** Implemented on 2026-07-18. `IndicatorShelf` takes an optional `availableIndicators` list and renders (and re-centers) only those bottles; when omitted it still shows all three, so the student titration scene is unchanged. The Composer 3D bench derives the indicators actually bound into each indicator container from the draft and passes them, so an indicator shelf shows one bottle per bound indicator instead of a fixed three. The "no available container" material help text now explains both recovery paths — add a compatible container, or remove a reagent from one to free it — instead of only "add a container." The composer 3D-bench Playwright scenario (which exercises the new projection) and the full 509-test unit suite pass; typecheck and lint are clean. (Adding more indicator glassware so multiple indicators can coexist remains Phase 5 `LC2-500`.)

**Read first:** `IndicatorShelf.tsx`; `Composer3DSetupEditor.tsx` `visualForPose`; `ComposerSetupWorkspace.tsx` material pairing controls; the reagent registry indicator IDs.

**Allowed areas:** `src/components/lab/three/IndicatorShelf.tsx`, `src/components/teacher/lab-composer/**`, focused tests, and this ticket's status.

**Do not touch:** chemistry/runtime truth, the student titration scene's default behavior, registries beyond referencing existing verified IDs, or new glassware (Phase 5).

**Stop:** Do not add new indicator containers, invent registry IDs, or change the student scene's indicator selection semantics.

### LC2-412 — Blank-lab start and titration as an explicit template

**Objective:** Let a teacher begin a new, minimal lab instead of always inheriting and dismantling the pre-built titration; present titration as one selectable starting template (report finding TEACHER-001, S1).

**Dependencies:** `LC2-410`.

**Status:** Implemented on 2026-07-18. `src/lab-workflows/definitions/blank-lab.ts` exports `createBlankLabDraftV2()`/`BLANK_LAB_V2_DRAFT`: a schema-valid `draft_unvalidated` draft that reuses the verified bench-layout configuration but carries no equipment, materials, actions, objectives, rules, instructions, or grading items, and no legacy titration compatibility/provenance/catalog. A "New lab" menu in the status bar offers "Start from scratch" and "Acid–base titration template"; choosing one guards unsaved changes, clears Undo/redo and autosave, resets selections and the checked baseline, and returns to Define. The Define stage is now keyed on draft id + revision so switching seeds with the same revision number no longer leaves a stale title field. Stage readiness reads sensibly for an empty draft ("Choose at least one objective", "Build the student bench"). Blank-lab unit tests (schema validity, emptiness, no legacy compatibility, not-runnable, command-editable, fresh instances) and a New-lab e2e pass, along with the full 508-test unit suite, all 15 Composer Playwright scenarios, typecheck, and lint.

**Read first:** `NATIVE_TITRATION_V2_DRAFT` and the v2 draft schema's required scaffolding (metadata, layout configuration, empty collections, rubric shell); `LabComposer.tsx` initial draft/seed and status bar; `composerStages.ts` readiness summaries; `draftHistory.ts`; `LC2-410` autosave.

**Allowed areas:** `src/lab-workflows/definitions/**` or a narrow starter-draft factory under authoring for a minimal valid empty draft, `src/components/teacher/lab-composer/**`, `src/app/teacher/lab-composer/**`, focused tests, and this ticket's status.

**Do not touch:** chemistry/runtime, registries beyond referencing existing verified IDs, validator semantics, agents, assignment. Do not invent registry IDs for the blank draft — reuse the existing verified layout configuration and leave equipment/materials/rules/objectives/rubric empty.

**Required changes:**

1. Provide a deterministic minimal starter draft: a schema-valid `LabWorkflowDraftV2` with default editable metadata, the existing verified bench layout configuration, and empty equipment, materials, permitted actions, rules, instructions, objectives, and rubric. It is `draft_unvalidated` and cannot be previewed until the teacher builds and validates it.
2. Add a visible entry point ("New lab") that seeds the starter draft, clears Undo/redo and autosave, and focuses the Define stage. Prompt before discarding unsaved changes (reuse `LC2-410`).
3. Offer titration as an explicit template choice at start (e.g. "Start from scratch" vs "Acid–base titration") rather than forcing it as the default; existing named saves and autosave still load as before.
4. Ensure stage readiness/checklist copy makes sense for an empty draft (guides the teacher to add objectives/equipment) rather than showing zero-count states as errors.

**Tests/manual:** starting a blank lab yields 0 equipment/materials/rules/criteria and a schema-valid unvalidated draft; the checker guides "add at least one objective/equipment" in plain language; New lab prompts before discarding unsaved edits; titration template still reproduces the current default draft; keyboard/viewport. Then full unit, lint, typecheck, build, Composer Playwright.

**Acceptance:** A teacher can create a genuinely new lab from empty, and can still choose titration as a template; the empty draft is schema-valid and Preview stays closed until it is built and validated.

**Stop:** Do not fabricate registry IDs, seed hidden chemistry, or make the blank draft previewable without validation.

### LC2-413 — Eliminate silent authoring failures

**Objective:** Make every rejected edit and every required field visible, so no Add/Save click is a silent no-op (report findings TEACHER-003 and TEACHER-004, S2; input hygiene for DEFINE-001).

**Dependencies:** `LC2-409`.

**Status:** Implemented on 2026-07-18. Every primary Add/Save control now blocks instead of failing silently: the Define stage marks title/summary/objective/duration as required, disables "Save definition" until they are valid, and renders the `metadata` command error; the Workflow stage disables "Add direction" (with a stable rendered `instruction` error), "Add student action", and "Add result range" until their required inputs exist, each with plain guidance for what is missing; the Assess grading-item form keeps its required-field disable and adds a hint for the common no-evidence case. Duration input no longer coerces a cleared field to 0 — it is tracked as text and only accepts a whole number of 1–480 minutes. Full 508-test unit suite, all 16 Composer Playwright scenarios (including a new required-field e2e), typecheck, and lint pass. (0-point rejection and negative/reversed range rejection are `LC2-414`.)

**Read first:** `LabComposer.tsx` `itemErrors` wiring and the un-rendered keys (`metadata`, `objective:*`, `criterion:*`, `removal`, instruction default `command`), the dead `errorPath` state, and the early-return `addInstruction`/`addActionRule`/`addToleranceRule` handlers; `ComposerDefineStage.tsx` required fields and duration input; `ComposerAssessWorkspace.tsx` criterion save.

**Allowed areas:** `src/components/teacher/lab-composer/**`, `src/app/teacher/lab-composer/**`, focused component/e2e/accessibility tests, and this ticket's status.

**Do not touch:** authoring command/removal semantics, validator/runtime/chemistry, schema, agents, persistence.

**Required changes:**

1. Render every command-rejection message beside its control: wire `itemErrors` for Define (metadata, objective), Assess (criterion), removal, and instructions; remove or use the dead `errorPath` state.
2. Disable Add/Save buttons while required inputs are missing, and mark required fields visibly, on the Define, Workflow ("Add direction"/"Add student action"/"Add result range"), and Assess forms — so a click can never be a silent no-op. Where a button stays enabled, a click must produce a visible reason.
3. Fix input hygiene so clearing the Define duration field is treated as empty/invalid rather than silently coercing to `0` (validator enforcement of ≥ 1 minute belongs to `LC2-414`).

**Tests/manual:** a rejected metadata/objective/criterion/removal/instruction edit shows a visible message; "Add direction" is disabled while Title or Guidance is empty; required markers present; clearing duration does not silently become 0; keyboard focus lands on the error; viewport containment. Then full unit, lint, typecheck, build, Composer Playwright.

**Acceptance:** Every failed or blocked edit tells the teacher what happened and what is required; no primary Add/Save control fails silently.

**Stop:** Do not weaken command validation, move dependency logic into React, or introduce a second error model.

### LC2-414 — Plausibility validation for measurements, points, and duration

**Objective:** Make the checker refuse chemically or pedagogically impossible values instead of reporting "Preview is ready" (report findings SYSTEM-002 and TEACHER-007, S2; DEFINE-001 duration).

**Dependencies:** `LC2-413`.

**Status:** Implemented on 2026-07-18. Deterministic v2 validation now rejects an `observable_within_tolerance` condition whose minimum exceeds its maximum, and any negative accepted value (a measured result cannot be negative), via `ruleConditionInvalid` issues — so the checker no longer reports "Preview is ready" for physically impossible ranges. It also rejects any rubric criterion worth `≤ 0` points via `rubricInvalid`. Duration is already schema-bounded to 1–480 minutes (enforced at the `update_metadata` command and now surfaced by `LC2-413`), so no additional validator change was needed. In the UI, "Add result range" is disabled for negative or reversed ranges with a rendered explanation, and the grading-item points input requires ≥ 1 and disables Save at 0. The `qaReproductions.test.ts` SYSTEM-002 block now asserts the negative and reversed ranges never reach runnable, plus a new zero-point rubric test. Full 509-test unit suite (no remaining expected-fails), all 16 Composer Playwright scenarios, typecheck, and lint pass.

**Read first:** `observable_within_tolerance` condition schema and its validation in `src/lab-workflows/validation/**`; rubric criterion and scoring-rule point handling; metadata `estimatedMinutes` bounds; `addToleranceRule`/`addActionRule` and criterion/rule save paths; `qaReproductions.test.ts` SYSTEM-002 block.

**Allowed areas:** `src/lab-workflows/validation/**`, `src/lab-workflows/authoring/**` (bounds on add/replace commands), narrow schema bounds if required with a documented schema-owned note, focused validation/authoring tests, matching Composer UI messages, and this ticket's status.

**Do not touch:** chemistry formulas/truth, evaluator semantics, runtime, agents, assignment, the second lab.

**Required changes:**

1. Reject measurement ranges that are physically impossible for their observable: negative accepted values for a burette reading, and any range where minimum > maximum (currently the reversed case is silently dropped and the negative case passes). Prefer validation-layer rejection with a stable issue code plus a command-layer guard so the range can never be authored; add unit-aware plausibility bounds per observable where the registry supports it.
2. Require rubric criteria and scoring rules to be worth more than `0` points; reject `0` (and negative) point values with a visible reason and fix the auto scoring-guide so full credit is never `0`.
3. Enforce a minimum estimated duration of `≥ 1` minute at validation (paired with the `LC2-413` input hygiene).
4. Surface all three as teacher-facing checker issues that name the responsible stage (reuse the existing issue→stage routing), not raw enum text.

**Tests/manual:** negative and reversed ranges are rejected (convert the `qaReproductions.test.ts` SYSTEM-002 `it.fails` to a passing assertion); 0/negative-point criteria and scoring rules rejected; 0-minute duration rejected; valid ranges/points/durations still pass; issues route to the right stage; safety-relevant behavior covered. Then full unit, lint, typecheck, build, Composer Playwright.

**Acceptance:** The checker fails negative/reversed measurement ranges, 0-point grading, and 0-minute duration with chemistry/pedagogy-oriented messages, and never reports "Preview is ready" for them.

**Stop:** Do not compute chemistry in the validator beyond bounded plausibility, invent observable IDs, or weaken existing hard validation.

### LC2-415 — Teacher-language and raw-error containment pass

**Objective:** Remove implementation vocabulary from the always-visible Composer surface and ensure no raw engine/exception text reaches teachers (report findings TEACHER-008 and TEACHER-006, S2).

**Dependencies:** `LC2-409` (coordinate copy with `LC2-410`–`LC2-414`).

**Status:** Ready.

**Read first:** `docs/qa/teacher-language-inventory.md` in full; `teacherCommandError`/`teacherEquipmentPurpose`/`teacherObjectiveDescription`/`titleCaseIdentifier`; every rendered string and aria-label across the Composer components; the `.message`/`.reason`/`issue.message`/`failureCodes` render sites.

**Allowed areas:** `src/components/teacher/lab-composer/**`, `src/app/teacher/lab-composer/**`, catalog display-text scrubbers, focused component/e2e/accessibility tests, and this ticket's status.

**Do not touch:** authoring command/validator/runtime semantics, schemas, registries (scrub display text only, do not rename IDs), chemistry, agents, persistence.

**Required changes:**

1. Apply the inventory replacements, prioritizing always-visible chrome: "Workflow"→"Steps/Procedure", "Rules"→"Checks", "Authoring task"/"Lab authoring stages"/"Composer navigation"→builder language, "Select an equipment instance."→"Select a piece of equipment to edit.", "validator"/"dependency graph"/"rule inspector", "supported/current simulation"→"lab type", "Bound materials"/"Registered container", "isolated preview", etc.
2. Standardize the visible product name on "Lab builder" (drop "Composer" from aria-labels and Preview links) and pick one metaphor for checks ("cards"/"checks") applied consistently.
3. Route every `.message`/`.reason`/`issue.message`/`failureCodes` through a single teacher-copy mapper (extend the `teacherCommandError` pattern); never render raw `TypeError`/validator text in the alert banner or inline errors. Extend the catalog purpose/description scrubber so registry-sourced text ("verified", "bounded titrant") does not leak.

**Tests/manual:** a rendered-DOM/e2e assertion that none of the banned terms appear in the Composer's visible text or aria-labels on the happy path; forced storage/load/undo failures render friendly copy, not raw messages; catalog-sourced dropdown/action text is plain; screenshots at supported widths. Then full unit, lint, typecheck, build, Composer Playwright.

**Acceptance:** A non-technical teacher never encounters registry/schema/validator/instance/workflow vocabulary or raw exception text on the standard authoring path; product naming and the checks metaphor are consistent.

**Stop:** Do not rename registry IDs, change command/validator behavior, or alter the strict draft.

### LC2-416 — Workflow ordering attribution, error specificity, and preview/WebGL fallback

**Objective:** Resolve the remaining moderate Composer defects: ordering connections attaching to an arbitrary objective, undistinguished graph errors, inconsistent edge removal, the blank 3D bench on WebGL failure, and the collapsed preview-failure message (report findings WORKFLOW-001, SETUP-001, PREVIEW-002, edge-removal consistency; S3).

**Dependencies:** `LC2-415`.

**Status:** Ready.

**Read first:** `LabComposer.tsx` ordering-dependency creation (hardcoded `objectiveIds[0] ?? ""`); `ComposerWorkflowGraph.tsx` connect/self/duplicate handling and edge deletion vs node removal; `Composer3DSetupEditor.tsx` WebGL failure/fallback and pose-resolve `catch`; `ComposerPreview.tsx` failure handling and discarded `failureCodes`.

**Allowed areas:** `src/components/teacher/lab-composer/**`, `src/app/teacher/lab-composer/**`, focused component/e2e/accessibility tests, and this ticket's status.

**Do not touch:** authoring command semantics beyond passing the chosen objective, validator/runtime/chemistry, schema/hash, registries, agents, persistence, Preview eligibility authority.

**Required changes:**

1. Let the teacher choose (or clearly see and confirm) the objective an ordering connection belongs to instead of silently using the first objective or `""`; block creating a connection when no objective exists, with a reason.
2. Give distinct feedback for the three ordering-failure cases (cycle, duplicate connection, same card twice) rather than one generic message, and route edge deletion through the same confirmation model as node/criterion removal (no silent immediate delete).
3. Detect WebGL-context failure and render the accessible fallback ("3D is unavailable — use the list") in place of a blank bench, or default to the accessible list when WebGL is unavailable; keep the pose-resolve failures visible rather than silently dropping equipment.
4. Replace the single collapsed preview-failure message with specific, teacher-friendly reasons derived from `eligibility.failureCodes`/failure kind (missing/stale/ineligible), without exposing raw codes.

**Tests/manual:** ordering connection prompts for/attributes an explicit objective and blocks when none exists; cycle vs duplicate vs self produce distinct messages; edge deletion is confirmed like node removal; WebGL-unavailable renders the fallback, not a blank box; equipment that fails to resolve is reported; preview failures show specific reasons; keyboard/screen-reader/viewport. Then full unit, lint, typecheck, build, Composer Playwright.

**Acceptance:** Ordering relationships have explicit, correct objective attribution with specific error feedback and consistent removal; the 3D bench never renders as an unexplained blank box; preview failures explain themselves. No raw codes or engine terms reach the teacher.

**Stop:** Do not weaken validation, put dependency traversal in React, store view state in the strict draft, or expand into agent/assignment/second-lab work.

### LC2-417 — Student Preview operability and Coach fallback repair

**Objective:** Correct the misleading setup-driven student Preview and make direct student Coach questions reliably return bounded guidance when the live provider is unavailable.

**Status:** Implemented on 2026-07-19. The native setup-driven Preview now frames the registered work surface with a tighter field of view while leaving every resolved equipment pose unchanged. Once pipette conditioning succeeds, its card says that it is complete instead of presenting an unexplained unavailable state; the next measurement step remains actionable. The live legacy Coach call now uses an SDK-level abort before the 15-second route deadline and one bounded retry for transient provider/network failures; malformed structured replies and bounded live failures resolve through the existing deterministic Coach response. If the student cannot reach the Coach route at all, the client presents a brief, safe procedural fallback rather than a raw HTTP failure. A non-persistent health request against the configured model completed successfully in 1.35 seconds on 2026-07-19. None of these advisory paths changes simulation state.

**Dependencies:** `LC2-503`, `LC2-703`.

**Allowed areas:** `src/components/lab/setup-driven/**`, camera-only setup-driven scene presentation, legacy Coach orchestration/route/client presentation, focused student/Coach tests, and this ticket status.

**Do not touch:** workflow schemas, registries, chemistry calculations, runtime action semantics, author/Judge behavior, assignment, or persisted session contracts.

**Required changes:**

1. Reframe the existing registered setup-driven scene so supported equipment is plainly visible at typical Chromebook preview sizes; preserve the exact resolved pose inputs and do not add authored coordinates.
2. Make a completed or exhausted lab step read as completed rather than an unexplained unavailable control; retain disabled controls when the deterministic runtime says the step cannot be applied.
3. When the legacy Coach provider request fails, times out, or returns invalid structured output, return the existing deterministic Coach response instead of a 503; never block the student simulation.
4. Keep the current bounded question, safety refusal, and no-chain-of-thought contracts. Do not expose provider status or raw HTTP errors to students.

**Tests/manual:** setup Preview shows all four registered dilution apparatus at the expected scene framing; completed condition step has clear status and next action stays actionable; direct Coach question receives deterministic guidance with a failing live model; safety/off-topic behavior remains bounded; typecheck, lint, full unit suite, build, and focused Preview/Coach browser coverage.

**Acceptance:** A teacher previewing the dilution sees identifiable apparatus and an understandable next step, and a student can still receive safe, bounded Coach help when the live AI service is down.

**Stop:** Do not change the deterministic lab sequence, rely on the Coach for simulation state, add physical-layout authoring, or make provider availability a student-facing failure.
