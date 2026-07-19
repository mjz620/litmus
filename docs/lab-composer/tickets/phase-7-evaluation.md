# Phase 7 — Hybrid Evaluation Integration

Deterministic workflow evaluation, Student Performance Evaluator, Lab Workflow Judge, and Student Coach remain separate consumers with distinct authority.

Implementation status: `LC2-700`–`LC2-704` are complete. The authored-rubric evaluator retains legacy behavior while grounding v2 scoring in an exact current definition and real runtime evidence. The separately versioned Workflow Judge accepts only a current preview-eligible workflow, an exact matching validation/capability summary, and all five hash-bound executed trace summaries. In the Composer, deterministic checker authority and optional teaching advice are visibly separate. A teacher may accept only mapped shared-command suggestions; each candidate is revalidated, reruns all five real scenarios, and is rejudged before it is committed. Fixed page-session call/revision/time/token/cost limits, stale-review blocking, termination reasons, and history prevent an autonomous loop. A dedicated AI review tab now projects that bounded loop in plain language from existing page-session state; it exposes no prompts, hashes, raw tool calls, or private model reasoning. The Student Coach now has an additive v2 contract for exact validated objectives, instructions, rules, diagnoses, evidence, and currently available actions. Deterministic triggers and silence remain authoritative; legacy sessions retain their original adapter; model failure or invalid references use bounded deterministic guidance without blocking the simulation.

## LC2-704 — Composer Agent-loop trace tab

**Objective:** Add a dedicated Composer tab that makes the bounded Author, deterministic checker, scenario runner, advisory Judge, and teacher-approved revision cycle visible for demos and teacher understanding.

**Dependencies:** `LC2-602`, `LC2-702`.

**Allowed areas:** Composer stage navigation/orchestration, a focused teacher-facing trace component, Composer e2e/component tests, and these documents.

**Do not touch:** validator/Judge semantics, chemistry/runtime truth, agent prompts/routes, persistence/assignment, or the Judge budgets.

**Required changes:**

1. Add an accessible dedicated Composer tab that summarizes the current author proposal, deterministic check/scenario evidence, Judge review state, teacher decisions, and bounded limits in one clear sequence; recorded teaching-review decisions remain in page-session order.
2. Use existing local Composer state only; the tab is a projection, not a new agent protocol, persistence format, or source of authority.
3. Make authority legible: Author suggests, LabBench checker and real scenarios decide runnability, Judge advises, and the teacher chooses whether to apply a mapped suggestion.
4. Show clear empty, running, current, stale, stopped, and completed states; retain the existing controls in Define and Check & preview.
5. Never expose prompts, raw tool calls, model chain-of-thought, credentials, canonical hashes, or registry/path internals in this teacher-facing view.
6. Preserve keyboard navigation, responsive layout, existing Preview gating, and all fixed page-session review/revision limits.

**Tests/manual:** empty view; live/finished author proposal; validation/traces; Judge review; teacher accepted and skipped suggestions; stale review; review limit; keyboard stage navigation; no private/technical content; typecheck, lint, full unit suite, production build, and Composer Playwright coverage.

**Acceptance:** A teacher can open one tab and understand what happened in the bounded agent–Judge workflow without learning internal implementation terms or mistaking advisory AI for simulation authority.

**Stop:** Do not add autonomous multi-agent iteration, prompt/chain-of-thought logging, hash/path disclosure, a second model call, or a validation/Judge authority change.

## LC2-700 — Authored-rubric Student Performance Evaluator

**Objective:** Version the report evaluator to consume exact assigned definition objectives/rubric, event evidence, deterministic diagnoses, final observables, and student responses while retaining legacy behavior and deterministic fallback.

**Dependencies:** `LC2-502`; persistence pin may be an injected/test fixture until Phase 8.

**Allowed areas:** evaluator agent/schema/prompt/route, deterministic fallback, report UI adapters, evaluation tests/docs.

**Do not touch:** chemistry/model calculations, workflow validator/evaluator, Judge, authoring, persistence schema.

**Required changes:**

1. Add a versioned evaluator request with exact definition/hash/objective/rubric/runtime/event/diagnosis provenance.
2. Require evidence IDs for claims and criterion results.
3. Expose uncertainty and model/prompt/rubric versions.
4. Credit unusual but deterministically valid approaches based on diagnoses/evidence.
5. Keep written coherence/misconception/mastery judgment semantic; never reconstruct pH/concentration/hidden state from prose.
6. Implement deterministic authored-rubric fallback when model unavailable/invalid.
7. Preserve legacy request/response adapter and fixed retry behavior for old sessions.

**Tests:** both labs; evidence citations; alternate valid credit; recoverable/terminal severity; unsupported evidence rejection; no chemistry recomputation; model failure/invalid output fallback; stale hash; legacy fixtures; prompt injection/student prose resistance.

**Acceptance:** Student evaluation is aligned with the authored rubric and structured evidence, with deterministic truth/fallback authority preserved.

**Stop:** Do not let the model create numeric chemistry truth or mutate diagnoses/simulation.

## LC2-701 — Exact-hash advisory Lab Workflow Judge

**Objective:** Implement the independent Workflow Judge using the exact draft, hard validation, capability summary, rubric, and executed trace results.

**Dependencies:** `LC2-602`.

**Allowed areas:** `src/lib/agent/lab-workflow-judge/**`, `src/app/api/lab-composer/judge/**`, `tests/ai/lab-composer/judge/**`, narrow schema/docs updates.

**Do not touch:** validator/runnability, author tools, runtime/chemistry, assignment, student evaluator.

**Required changes:**

1. Version prompt/schema/model separately from Author and Student Evaluator.
2. Accept only a current structurally valid request containing exact draft/hash, deterministic validation, capability/compatibility summary, objectives/rubric, and real trace summaries.
3. Evaluate objective alignment, pedagogy, flexibility/alternate paths, rubric fairness, meaningful failure cases, clarity, teacher usability, duration feasibility, student level, and under-resourced suitability.
4. Return bounded scores/issues/strengths/recommendation with exact spec paths/evidence references and uncertainty where appropriate.
5. Reject stale hash, missing validation/trace, unsafe/non-runnable eligibility as appropriate for advisory invocation.
6. Enforce that approval changes no validation/status/eligibility.
7. Keep rate/size/time/cost limits, structured output, no chain-of-thought, deterministic error/fallback.

**Tests:** good lab; rigid workflow critique; unfair rubric; missing alternate path; weak failure case; stale hash; non-runnable validator; fake trace; prompt injection; prohibited chemistry claim/ID invention; Judge approval non-authority; server-only secrets; model failure.

**Acceptance:** Judge produces useful exact-hash advisory critique and cannot make a draft previewable/assignable.

**Stop:** Do not implement automatic revision here.

## LC2-702 — Bounded judge revision and authority-separated teacher UI

**Objective:** Integrate Judge critique into a fixed-budget command-based revision/revalidation/retrace/rejudge loop and display it separately from hard validation.

**Dependencies:** `LC2-701`.

**Allowed areas:** Composer orchestration, teacher Judge panel/history, tests/e2e/docs.

**Do not touch:** validator semantics, chemistry/runtime truth, persistence/assignment, unbounded autonomous loops.

**Required changes:**

1. Invoke Judge only after current deterministic validation/required traces are eligible.
2. Convert accepted revision proposals into shared commands; never apply raw JSON patches.
3. Invalidate validation/traces/Judge after each edit, then revalidate and rerun required traces before rejudging.
4. Cap attempts/calls/tokens/time/cost and expose termination reason/history.
5. Display deterministic validator and advisory Judge in separate clearly labeled panels.
6. Teacher chooses whether to accept/reject a suggestion and remains required for final approval later.

**Tests/manual:** first-pass approve; Judge revision repaired; revision causes validator failure and is rejected; stale critique; limit reached; safety/unsupported early stop; authority UI coexistence; edit invalidation; no preview enablement from Judge alone; keyboard/viewport.

**Acceptance:** Judge improves pedagogy within hard boundaries and remains visibly non-authoritative.

**Stop:** Do not auto-assign or continue revision beyond budget.

## LC2-703 — Diagnosis-aware Student Coach

**Objective:** Extend coach context with exact active objectives/instructions/rules and deterministic diagnoses while preserving trigger authority, silence, and nonblocking behavior.

**Status:** Implemented on 2026-07-18. Setup-driven sessions build a separate Coach-only `2.0.0` context from the exact current Preview-eligible definition and generic runtime projections; checkpoint/persistence envelopes remain unchanged. Core code rechecks definition eligibility/hash, context projections, rule/diagnosis/evidence/action references, current availability, and trigger reasons. Unsolicited guidance requires a deterministic violation or an exact authored flag trigger; alternate-valid and routine-success paths return silence without a model call. Direct questions are explicit. Responses label required procedure, safety, optional context, or AI guidance and declare advisory-only/no-state-change/no-reset/no-rule-change authority. Live model output is timeout-bounded and rejected for invented references, chemistry claims, excessive hints, or state/workflow control; deterministic authored guidance handles configured, invalid, unavailable, and slow-provider cases. The legacy request/response route remains intact.

**Dependencies:** `LC2-204`, `LC2-503`; coordinate authored objective semantics with `LC2-700`.

**Allowed areas:** coach schema/prompt/route/context adapters, coach panel integration, tests/evals/docs.

**Do not touch:** deterministic diagnoses, simulation state, chemistry, author/Judge behavior, persistence schema.

**Required changes:**

1. Add optional versioned definition/hash/objective/instruction/rule/diagnosis/evidence context.
2. Keep deterministic trigger policy authoritative for unsolicited coaching and direct-question behavior explicit.
3. Explain current diagnosis and valid recovery using provided evidence; do not invent actions/chemistry/results.
4. Distinguish mandatory procedure, safety, optional context, and AI guidance in structured output/UI.
5. Preserve cooldown/hint levels, positive stay-silent cases, asynchronous failure behavior, and legacy request adapter.

**Tests:** both labs; relevant recoverable/safety/conceptual diagnoses; alternate valid approach not falsely corrected; routine success silent; unknown rule/action rejection; stale hash; slow/down model; no state mutation/chemistry claim; legacy coach suite.

**Acceptance:** Coach gives contextual pop-up guidance grounded in deterministic diagnoses and never blocks or controls simulation.

**Stop:** Do not let the coach add/remove workflow rules or request an automatic checkpoint reset; reset remains a student-confirmed UI/runtime decision.
