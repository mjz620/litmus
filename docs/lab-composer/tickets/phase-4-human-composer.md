# Phase 4 — Human Composer Foundation

Phase 4 must deliver useful non-LLM authoring. The teacher UI does not write raw spec objects directly; all domain edits use the shared command service.

## LC2-400 — Pure draft command service and edit invalidation

**Objective:** Implement immutable typed domain commands for editing v2 drafts, with stable errors and automatic validation/Judge invalidation.

**Dependencies:** `LC2-304`.

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
