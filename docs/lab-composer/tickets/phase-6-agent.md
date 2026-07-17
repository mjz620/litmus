# Phase 6 — Agent Command Layer and Generation Loop

Phase 6 begins only after `LC2-503` records a passing Level 2 gate. The current family-oriented Author Agent remains a prototype/legacy endpoint until migrated or versioned explicitly.

## LC2-600 — Server-side registry search and shared-command tools

**Objective:** Expose a strict server-only allow-list of read-only discovery tools and draft-editing tools that wrap the same `LC2-400` command service used by the human Composer.

**Dependencies:** `LC2-503` and passing Level 2 gate.

**Read first:** current author route/prompt/schemas/tools/tests; shared commands; two supported definitions; agent boundaries docs.

**Allowed areas:** `src/lib/agent/lab-authoring/**`, new versioned capability-author tools, `src/app/api/lab-composer/**`, `tests/ai/lab-composer/**`, narrow command adapters/docs.

**Do not touch:** registries, chemistry/runtime implementations, Judge, persistence/assignment, human command semantics.

**Required changes:**

1. Version the new author contract/prompt independently from the legacy family-oriented route; keep compatibility or feature flag explicit.
2. Implement exact allow-listed search/inspect tools for equipment, materials, actions, objectives, capabilities, conditions, models, safety, and configurations.
3. Implement edit tools solely by parsing and calling shared domain commands.
4. Return bounded structured summaries, exact IDs, availability, capability/connection constraints, and command errors.
5. Prevent registry writes, adapter creation, arbitrary code, formula fields, dynamic tool names, and raw validation status mutation.
6. Keep server-only credentials, rate/size/time limits, audit metadata, and no chain-of-thought.

**Tests:** every allowed tool; unknown tool; unknown/invented ID; command parity with human reducer; no registry mutation; prompt injection; oversized/recursive payload; server-only import; fixed limits; unsupported capability remains unavailable; legacy route compatibility.

**Acceptance:** An agent can inspect and edit an unvalidated v2 draft only through exact shared commands. It cannot validate, simulate, approve, or assign by assertion.

**Stop:** Do not provide a generic “patch JSON,” “write spec,” registry mutation, shell/code execution, or arbitrary expression tool.

## LC2-601 — Bounded generation, validation, executable traces, and revision loop

**Objective:** Implement the capability-driven author sequence with visible assumptions, deterministic validation, mandatory real trace execution, and bounded revision.

**Dependencies:** `LC2-600`.

**Allowed areas:** versioned author orchestration/routes/tests/eval fixtures/docs.

**Do not touch:** Judge implementation, assignment, runtime truth, registries, human command semantics.

**Required changes:**

1. Parse teacher objective/constraints and return explicit assumptions/questions without chain-of-thought.
2. Map only to exact registered objectives/capabilities/equipment/materials through tools.
3. Build/edit draft through commands.
4. Run the real deterministic validator; discard agent-supplied status/artifacts.
5. For eligible drafts, generate five typed action traces: valid, alternate valid, recoverable, terminal/conceptual, tolerance boundary.
6. Execute traces through real generic replay/evaluator and return bounded results/evidence IDs.
7. Revise only through commands using validator/trace diagnostics, within explicit attempts/calls/tokens/time/cost limits.
8. Revalidate every revision and stop unsupported/safety-rejected requests early.
9. Return editable draft, assumptions, validation, executed trace summary, versions/costs, and unresolved limitations.

**Tests:** first-pass valid; alternate-order trace; invalid draft repaired; unrepairable limit; unsupported/unsafe; invented ID blocked; fake expected trace ignored; prompt injection; runtime/tool/model failure; timeout/rate limit; exact hash lineage; every revision invalidates prior artifacts; deterministic mock/fallback.

**Acceptance:** Supported requests yield an editable current validated draft only when real traces pass. Unsupported requests remain clearly non-runnable. No Judge call yet.

**Stop:** Do not let successful traces override validator failure or let the agent provide expected chemistry truth.

## LC2-602 — Agent draft handoff to human Composer

**Objective:** Present capability-authored drafts in the same human Composer with assumptions, compatibility, validation, trace evidence, costs, and explicit teacher control.

**Dependencies:** `LC2-601`, `LC2-403`.

**Allowed areas:** teacher Composer agent integration UI, route client adapters, tests/e2e/docs.

**Do not touch:** assignment persistence, Judge, chemistry/runtime, registry editing.

**Required changes:**

1. Load agent output as a normal v2 draft in the shared command-backed editor.
2. Show assumptions, support/legacy adapter status, validation authority, trace outcomes/evidence, limits/cost/model/prompt versions.
3. Allow teacher edits through shared commands; immediately invalidate validation/traces/future Judge.
4. Support explicit reject, regenerate/revise within remaining budget, revalidate, and real preview.
5. Keep Preview disabled for stale/non-runnable drafts and Assign absent/disabled until persistence phase.
6. Clearly label deterministic results versus model-authored suggestions.

**Tests/manual:** valid/unsupported/safety/limited output; edit invalidation; stale trace; preview exact hash; keyboard/common viewport; no chain-of-thought; teacher-visible assumptions; deterministic fallback.

**Acceptance:** Agent output is an editable proposal using the same human authoring path, not a separate opaque template or automatic assignment.

**Stop:** Do not label this complete Level 3 until Judge, persistence/approval, and end-to-end hardening tickets pass; state current scope accurately.
