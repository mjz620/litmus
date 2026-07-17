# Phase 1 — Capability-Driven Contract Evolution

Phase 1 changes deterministic contracts and validation only. It does not create a generic runtime, new student UI, dilution lab, agent tools, Judge route, or persistence schema.

## LC2-100 — Capability vocabularies and equipment contract extension

**Objective:** Add bounded equipment/chemistry capability ID contracts and extend the current component registry toward reusable equipment definitions without changing v1 validation behavior.

**Dependencies:** `LC2-000`.

**Read first:** current component types/entries/tests, all current visual equipment exports, [`../contract-blueprint.md`](../contract-blueprint.md) sections “Canonical ID policy” and “Equipment definition.”

**Allowed areas:**

- `src/lab-workflows/capabilities/**`
- `src/lab-workflows/registries/components/**`
- matching `tests/lab-workflows/**`
- narrow Composer docs updates

**Do not touch:** action/reagent/engine behavior, validator semantics, runtime, chemistry engines, React/Three components, agents, stores, persistence.

**Required changes:**

1. Define exact read-only unions/constants for the initial capability IDs reserved in the blueprint.
2. Distinguish equipment capabilities from chemistry capabilities at the type level.
3. Add `displayName`, `capabilityIds`, `stateSchemaId`, `defaultConfigurationPresetId`, `visualAdapterId`, and `mechanicalAdapterId` metadata to the equipment/component definition contract.
4. Preserve current component IDs and existing v1 fields/exports. Use exact adapter IDs rather than direct component types.
5. Add deterministic read-only lookup/list behavior and stable duplicate/unknown errors for any new registry facade.
6. Mark capability availability honestly; metadata alone does not make a mechanic or chemistry module verified.
7. Bump component/capability registry snapshot versions when semantics change and document the old snapshot compatibility expectation.

**Tests:** exact known/unknown/duplicate resolution; capability category separation; current component entries contain correct bounded capabilities; adapter/schema/config IDs are exact strings; returned collections cannot mutate registry state; forbidden-import scan; existing v1 registry/validator tests stay green.

**Acceptance:** Existing titration v1 validates identically; no runtime consumes family-independent capabilities yet; core files import no React/Three/browser/OpenAI/Supabase modules.

**Manual verification:** Compare each capability on burette, flask, reagent bottle, and indicator bottle to current actual mechanics. Do not claim wash, transfer, or measurement behavior not implemented by the current component.

**Stop:** If an exact schema/config/adapter ID has no current registry home, add only the contract/reference authorized here and mark it declared. Do not implement the adapter.

## LC2-101 — Capability-based action contracts

**Objective:** Extend the action registry with source/target capability requirements, parameter schema IDs, equipment preconditions, error/event contracts, mechanical adapter IDs, and behavior mode while retaining exact v1 action mappings.

**Dependencies:** `LC2-100`.

**Allowed areas:** `src/lab-workflows/registries/actions/**`, supporting capability/schema metadata required only for these entries, matching tests/docs.

**Do not touch:** runtime execution, titration action semantics, UI gestures, chemistry, validator v2, new dilution actions, agent tools.

**Required changes:**

1. Extend `ActionRegistryEntry` or introduce a backward-compatible versioned action definition facade.
2. Map current action IDs to required source/target capabilities based on actual behavior.
3. Replace inline parameter shape as future authority with an exact `parameterSchemaId`, while keeping v1 parameter metadata readable until migration.
4. Add exact precondition IDs and possible stable error codes; definitions describe checks but do not execute state changes.
5. Add `mechanicalAdapterId`, `emittedEventContractId`, and `behavior: discrete | continuous`.
6. Retain `engineActionType`, family, and engine fields only as explicit v1 compatibility metadata.
7. Do not add formulas, scoring, expected endpoint, correct reagent, or workflow order.

**Tests:** current source/target capability match; one mismatched equipment fixture; parameter schema exact resolution; precondition/error/event/adapter resolution; continuous classification for dispense if appropriate; cross-reference completeness; v1 action adapter tests unchanged.

**Acceptance:** Every current v1 action has exact compatibility metadata, and no generic execution path exists yet. Unknown adapters/schemas fail exact lookup rather than falling back.

**Stop:** If an action's actual semantics combine two conceptual operations, preserve it as a legacy mapping and record the future split; do not change engine behavior here.

## LC2-102 — Material profiles, quantities, and configuration schema metadata

**Objective:** Evolve exact reagent/configuration data into reusable material profiles and bounded quantity/configuration presets while preserving every v1 reagent ID and value.

**Dependencies:** `LC2-100`, coordinate with `LC2-101` IDs.

**Allowed areas:** reagent/material/configuration registries under `src/lab-workflows/registries/**`, matching tests/docs.

**Do not touch:** chemistry formulas, runtime initialization, v2 schema, dilution materials, UI, persistence, prompts.

**Required changes:**

1. Prefer a backward-compatible material facade over a second registry. Create `materials/` only if the ticket documents why `reagents/` cannot evolve without unsafe type drift.
2. Preserve exact HCl, NaOH, and phenolphthalein IDs, concentrations, amounts, and safety metadata.
3. Add exact container capability compatibility, initialization schema ID, quantity preset IDs, provided chemistry capability metadata, and declared/verified/restricted availability.
4. Move authored quantity authority toward exact presets or schema-bounded values; do not allow arbitrary concentration/identity/formula fields.
5. Add configuration schema metadata sufficient for future equipment/action/model/layout preset validation.
6. Retain v1 family/engine fields as compatibility metadata only.

**Tests:** v1 values unchanged; exact material/quantity/config/schema lookup; invalid quantity preset; container mismatch; safety policy resolution; declared versus verified behavior; unknown IDs; v1 workflow validation still passes and hashes remain unchanged.

**Acceptance:** The registry can describe current materials independently of “correct titration role,” but runtime behavior is unchanged.

**Stop:** Do not create water/stock-solution/dilution profiles until Phase 5 unless needed as an existing current titration compatibility profile and backed by code/tests.

## LC2-103 — Chemistry-model contracts and exact capability resolution

**Objective:** Define deterministic module contracts and a pure resolver for exact verified chemistry capability providers without extracting or implementing chemistry modules yet.

**Dependencies:** `LC2-100`; use material capability metadata from `LC2-102` when available.

**Allowed areas:** `src/lab-workflows/capabilities/**`, `src/lab-workflows/registries/chemistry-models/**`, pure resolver tests/docs.

**Do not touch:** experiment formulas, generic runtime, v2 workflow schema, UI, agents, network/persistence.

**Required changes:**

1. Define `ChemistryModelModule` types without browser/framework/network imports.
2. Define metadata entries separately from executable implementation registration.
3. Implement pure exact provider resolution for required capability IDs.
4. Reject unknown, missing, ambiguous exclusive providers, unmet dependencies, duplicate IDs, and cycles with stable codes.
5. Produce deterministic topological order with exact ID tie-break.
6. Track availability so declared but unimplemented providers cannot satisfy runnable validation.
7. Do not register a dilution engine or universal simulator.

**Tests:** zero/one/multiple provider cases; transitive dependency order; stable order across input ordering; missing dependency; cycle; unknown ID; declared provider rejection; immutable input/output; forbidden import scan.

**Acceptance:** Resolver can return metadata for a verified synthetic test registry, but production chemistry behavior is unchanged.

**Stop:** Do not import the titration definition into the contract/resolver. A legacy executable adapter belongs to `LC2-300`.

## LC2-104 — Structured condition, rule, instruction, rubric, and diagnosis schemas

**Objective:** Add strict bounded schemas/types for v2 constraint semantics and structured diagnoses, independent of runtime evaluation.

**Dependencies:** `LC2-101`, `LC2-102`, `LC2-103`.

**Allowed areas:** `src/lab-workflows/schema/conditions.ts` and related schema/type exports, focused tests/docs.

**Do not touch:** top-level v2 LabWorkflowSpec, validator decisions, evaluator runtime, UI, agents, chemistry.

**Required changes:**

1. Implement the closed discriminated condition union from the blueprint.
2. Implement bounded rule kinds, severity, recoverable/terminal flags, objective IDs, and optional score metadata.
3. Implement instruction sections that reference rule IDs but contain no runtime control field.
4. Extend rubric schema semantics for objective/rule/evidence mappings without creating evaluator logic.
5. Define JSON-safe structured evidence values and `WorkflowDiagnosis`.
6. Reject arbitrary expressions, unknown discriminators/keys, non-finite values, unbounded arrays/text, and illegal recoverable+terminal combinations if the contract forbids them.

**Tests:** one valid fixture per condition; invalid discriminator/field/reference shape; exact tolerance inclusive/exclusive representation; illegal bounds; safety severity; JSON-only values; unknown keys; schema size limits; type exhaustiveness.

**Acceptance:** Contracts are inspectable data and contain no executable function/formula/query language.

**Stop:** Do not evaluate conditions or resolve their IDs here.

## LC2-105 — LabWorkflowSpec v2 strict schema union

**Objective:** Add strict `2.0.0` draft/validated schemas and a version-discriminated facade while leaving v1 schemas and exports behaviorally stable.

**Dependencies:** `LC2-102`–`LC2-104`.

**Allowed areas:** `src/lab-workflows/schema.ts`, `src/lab-workflows/schema/v2.ts`, public Composer exports, focused schema tests/docs.

**Do not touch:** migration, hashing semantics, validator v2, runtime, UI, agents, persistence.

**Required changes:**

1. Preserve explicit `LabWorkflowSpecV1`/draft/validated schemas and compatibility aliases.
2. Add the v2 shape from the blueprint: metadata, optional catalog family, objectives, equipment, materials, layout, chemistry capabilities, permitted actions, rules, instructions, coach policy, rubric, safety, compatibility/provenance, status/artifacts.
3. Dispatch untrusted input strictly by `schemaVersion`; reject absent/unknown versions.
4. Keep v1 family/engine/seed/reagents/steps required.
5. Ensure new/edited v2 drafts require `draft_unvalidated` and null validation/Judge.
6. Bound equipment/material/rule/action/layout/text counts for Chromebook clients.

**Tests:** existing v1 fixtures/types unchanged; minimal/full v2 draft; validated v2 artifact shape; strict unknown-key rejection; invalid version; v1 fields cannot masquerade as v2; status/artifact trust boundary; structural limits.

**Acceptance:** Both versions parse through one facade without coercion; no v2 document is runnable merely because it parses.

**Stop:** Do not make family or legacy engine fields required in v2 except inside an explicit optional compatibility descriptor.

## LC2-106 — Pure v1-to-v2 migration and version-aware hashing

**Objective:** Deterministically migrate existing v1 workflows into behavior-equivalent unvalidated v2 drafts and add frozen v2 hash semantics without changing v1 hashes.

**Dependencies:** `LC2-105`.

**Allowed areas:** `src/lab-workflows/schema/migration.ts`, `src/lab-workflows/hash.ts`, exact migration mapping data, focused fixtures/tests/docs.

**Do not touch:** runtime, chemistry, validator eligibility, canonical v1 seed content, UI, persistence, agents.

**Required changes:** Follow Stage D/E of [`../migration-playbook.md`](../migration-playbook.md) exactly. Map every v1 field or fail. Translate ordered steps into instruction sections plus strict precedence/action-scope constraints. Preserve source v1 hash/migration provenance. Output unvalidated. Freeze domain-separated v2 bytes/hash with golden tests.

**Tests:** current v1 hash goldens unchanged; canonical v1 migration golden; stable IDs/output; missing mapping failure with exact path/code; migrated draft has no trusted artifacts; every v1 semantic represented; v2 hash stability/sensitivity/exclusions; non-JSON rejection.

**Acceptance:** Canonical v1 can migrate and structurally parse as v2, but remains non-runnable pending v2 validation. Existing v1 runtime tests are unchanged.

**Stop:** If a v1 completion/coach/retry/rubric semantic has no v2 representation, stop and extend the relevant Phase 1 schema in a reviewed prerequisite rather than dropping it.

## LC2-107 — Capability-driven v2 hard validator

**Objective:** Add deterministic v2 validation and eligibility passes while preserving exact v1 validator behavior.

**Dependencies:** `LC2-106` and all Phase 1 contracts.

**Allowed areas:** `src/lab-workflows/validation.ts`, `src/lab-workflows/validation/**`, focused validator/fixture tests/docs.

**Do not touch:** runtime execution, chemistry formulas, UI, agents/Judge, persistence.

**Required changes:**

1. Dispatch validator by strict schema version.
2. Keep v1 issue codes/order/status/hash behavior stable.
3. Implement the ordered v2 passes in Stage F of the migration playbook.
4. Resolve equipment, configs, schemas, visual/mechanical adapters, materials, quantities, actions, capabilities, chemistry providers, rules, objectives, evidence, coach/instructions, safety, and snapshots exactly.
5. Detect duplicate references, action connection mismatch, parameter narrowing violations, model dependency failures, rule cycles/contradictions, and statically detectable unreachable success.
6. Compute authoritative support/preview/assignment eligibility from hard results only.
7. Ignore Judge recommendation for runnability.
8. Keep time/registries injected and input immutable.

**Tests:** valid migrated v1-as-v2 fixture; invalid case per pass; safety veto; stale artifact/hash/snapshot; declared-not-verified capability; no family dependency; deterministic issue order; mutation safety; Judge approval override attempt; valid/invalid/safety fixtures required by AGENTS.

**Acceptance:** A current validated v2 spec can be `runnable`, but no generic runtime exists yet. Canonical v1 validation and hash tests remain byte/decision stable.

**Manual verification:** Search v2 validator for family/engine compatibility reads. Only explicit legacy descriptor validation may inspect legacy IDs; they cannot grant capability compatibility.

**Stop:** Do not implement auto-repair or infer missing IDs. Suggested IDs, if returned, come only from exact compatible registry results.
