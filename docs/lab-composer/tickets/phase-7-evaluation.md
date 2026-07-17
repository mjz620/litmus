# Phase 7 — Hybrid Evaluation Integration

Deterministic workflow evaluation, Student Performance Evaluator, Lab Workflow Judge, and Student Coach remain separate consumers with distinct authority.

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
