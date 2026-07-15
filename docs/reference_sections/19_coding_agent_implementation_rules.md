# 19. Coding-agent implementation rules
These rules should also be copied into `AGENTS.md`.

## 19.1 Non-negotiable invariants

1. No chemistry calculations in React components, R3F components, API prompts, or database queries.
2. No direct mutation of plugin state.
3. No browser-side OpenAI secret.
4. No LLM-authored scientific ground truth.
5. No LLM-authored teacher percentages or readiness scores.
6. Every API request and response validated at runtime.
7. Every experiment action is typed.
8. Every meaningful state change flows through `step()`.
9. Every event is serializable and versionable.
10. No simulation action waits for network completion.
11. UI is a projection of state, not a second source of truth.
12. Demo Mode must use the same engine and agent routes as production.
13. Seeded demo data may be synthetic but must satisfy the live schema.
14. New flags require tests and tutor/eval coverage.
15. Positive “stay silent” cases require tests.

## 19.2 Work package boundaries

### Agent A — 3D lab shell

**Inputs:** `experiment.ts`, `titration.ts`, UI manifest.  
**Owns:** `components/lab/*`, R3F scene assets.  
**Must not edit:** chemistry functions or event semantics.  
**Acceptance:** visual state derives exclusively from typed experiment state; actions dispatch typed `TitrationAction`; 30 FPS target.

### Agent B — coach orchestration

**Inputs:** semantic event schema, StudentModel, trigger policy requirements.  
**Owns:** `lib/agent/*`, `/api/coach`.  
**Must not edit:** chemistry calculations.  
**Acceptance:** structured outputs validate; tool calls allowlisted; controlled dropwise test returns silent.

### Agent C — persistence/auth

**Inputs:** schema and RLS requirements.  
**Owns:** migrations, Supabase utilities, checkpoint route.  
**Must not edit:** experiment logic.  
**Acceptance:** idempotent event writes; student/teacher isolation; offline queue does not block UI.

### Agent D — teacher dashboard

**Inputs:** analytics definitions and query layer.  
**Owns:** teacher routes/components.  
**Must not calculate metrics with an LLM.**  
**Acceptance:** class metrics trace to real rows; filters work; demo class displays seeded and live judge session.

### Agent E — report evaluator and Adaptive Retry

**Inputs:** ground truth, rubric, retry templates.  
**Owns:** `/api/evaluate`, report UI, retry selector.  
**Acceptance:** evidence-linked scores; retry state server-validated; parent session persisted.

### Agent F — precipitation plugin

**Inputs:** ExperimentDefinition contract.  
**Owns:** `experiments/precipitation/*`.  
**Must not duplicate shell, coach, persistence, or evaluator.**  
**Acceptance:** plugin registers through common registry and passes truth tests.

### Agent G — voice

**Inputs:** coach request contract.  
**Owns:** voice button and ephemeral token route.  
**Acceptance:** transcript is visible/editable; text fallback; voice uses same tutor memory/context.

## 19.3 Integration owner responsibilities

The human project owner must personally review:

- chemistry correctness,
- architecture boundary violations,
- pedagogical quality,
- model prompt/eval behavior,
- cross-workstream integration,
- final demo path.

Agents generate implementation volume; the human controls truth, coherence, and product judgment.

---
