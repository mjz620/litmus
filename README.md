# LabBench AI

LabBench AI is a browser-based chemistry rehearsal environment for high-school students and teachers. Students practice meaningful lab actions in deterministic simulations, receive evidence-based coaching, submit reports, retry targeted skills, and give teachers a readiness view before physical lab time.

The central boundary is deliberate: **deterministic experiment engines own chemistry and grading truth; AI supports pedagogy.** The coach and report evaluator consume typed state and semantic events. They never calculate pH, equivalence volume, precipitate identity, or simulation state.

## The problem

Many students enter a physical chemistry lab knowing the written procedure but not how their choices affect the result. Equipment access, class time, and individual feedback are especially constrained in under-resourced schools. A useful pre-lab must therefore run on modest hardware, work without an account, and explain mistakes without fabricating science.

## What is implemented

- Deterministic acid–base titration with custom fills/refills, cumulative delivery, pH curve, meniscus evidence, seeded replay, and targeted retries.
- Deterministic precipitation/solubility plugin with verified solution IDs, visible observations, product prediction, and net ionic equation evidence.
- Shared `ExperimentDefinition.step()` action path, semantic events, in-memory `StudentModel`, asynchronous checkpoints, and deterministic teacher aggregates.
- Context-triggered text/voice coaching and structured report evaluation, with credential-free mock behavior for local/demo use.
- Student, teacher, technical, and resettable judge-demo paths; core student practice requires no auth.
- Keyboard-accessible 2D controls, reduced motion/graphics, lazy-loaded demand-rendered 3D, and gesture-gated synthesized audio.
- Transitional Lab Composer contracts: exact capability/equipment/action/material/model registries, strict versioned `LabWorkflowSpec` schemas, pure v1-to-v2 migration, version-aware canonical hashing, deterministic v1 hard validation, a checked-in titration workflow/replay gate, a titration-specific assembler, and an initial constrained Author Agent route.

The Composer foundation now has capability-oriented contracts and a migratable v2 IR, but it is not yet a capability-driven authoring/runtime product. It remains tied to one titration engine, mandatory family metadata, rigid ordered steps, and a fixed student scene. The current migration evolves that v1 IR into reusable equipment/action/material/model capabilities and constraint-based workflows while preserving deterministic truth and existing behavior. Unsupported workflows remain non-runnable.

## Architecture

```text
Student gesture
  → typed experiment action
  → ExperimentDefinition.step()       deterministic/local
  → state + semantic events
      ├─ StudentModel reducer          deterministic/local
      ├─ checkpoint queue              asynchronous/idempotent
      ├─ coach trigger policy          deterministic/local
      │    └─ structured AI response   pedagogy only
      ├─ report evaluator              rubric feedback only
      └─ teacher analytics             deterministic aggregates
```

Key areas:

- `src/experiments/`: chemistry truth, experiment contracts, replay, and plugin registry.
- `src/lab-workflows/`: versioned Composer schemas, exact registries, migration, hashing, v1 validation, canonical workflow, runtime adapters, and the capability-migration package boundary.
- `src/stores/`: typed runtime state and action dispatch.
- `src/lib/agent/`: trigger policy, constrained prompts, and structured response contracts.
- `src/lib/persistence/` and `supabase/`: checkpoint contracts, schema, RLS, and repositories.
- `src/lib/analytics/` and `src/components/teacher/`: deterministic class readiness views.
- `tests/`: chemistry, contracts, API, policy, analytics, replay, and browser flows.

The full documentation reading order is in [`docs/README.md`](docs/README.md). Repository law and ticket scopes live in [`AGENTS.md`](AGENTS.md) and [`tickets.md`](tickets.md).

## Local setup

Requirements: Node.js 20+ and npm.

```bash
npm install
npx playwright install chromium
cp .env.example .env.local
npm run dev
```

Open:

- `http://localhost:3000/experiments` for guest practice.
- `http://localhost:3000/demo` for the credential-free judge flow.
- `http://localhost:3000/dev/lab/titration` for development diagnostics (development builds only).

The deterministic labs, mock coach/evaluator, and demo work with `OPENAI_MOCK_MODE=1` and placeholder/absent backend credentials. For real persistence, create a Supabase project, apply the migrations in `supabase/migrations/`, seed with `supabase/seed.sql` when desired, and supply the values documented in `.env.example`. Keep the service-role and OpenAI keys server-side.

Local development intentionally tolerates absent Supabase values so guest practice remains available. A production build validates all three Supabase deployment values and fails with their names when they are absent or invalid; configure real deployment values before running `npm run build`.

For real structured coaching/evaluation, set `OPENAI_API_KEY`, choose server-side model names, and set `OPENAI_MOCK_MODE=0`. The browser receives only short-lived realtime transcription credentials; it never receives the long-lived API key.

## Demo

The fastest path is `/demo`:

1. Open **Student** and make a controlled or deliberately fast endpoint addition.
2. Ask a text or hold-to-talk question, then inspect evidence-linked coaching.
3. Submit the report and launch the targeted retry.
4. Switch to **Teacher** to see the live demo row merged through the same analytics path.
5. Switch to **Technical** to trace action → event → StudentModel → coach/checkpoint/eval.
6. Use **Reset demo** to clear only demo-scoped state.

See [`docs/demo/Runbook.md`](docs/demo/Runbook.md) for setup and fallback details and [`docs/demo/Demo_Script.md`](docs/demo/Demo_Script.md) for the three-minute narration.

## Quality gates and evals

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run eval:coach
npm run build
npm run test:e2e
```

With a local dev server already running, `npm run profile:lab` records a reproducible 4× CPU-throttled browser sample for the active 3D path. The latest profile and interpretation are in [`docs/project/Chromebook_Performance.md`](docs/project/Chromebook_Performance.md).

Coach evals report mistake recall, routine-success silence, and evidence-linking. Deterministic unit tests remain authoritative for chemistry, safety-relevant validation, replay, persistence idempotency, and teacher metrics.

## Data and security notes

- Core guest/demo practice does not require authentication.
- Production class membership and teacher/student rows are protected by Supabase RLS.
- Checkpoint event IDs and writes are idempotent.
- Simulation dispatch never waits for OpenAI or Supabase.
- API keys and service-role credentials never enter the client bundle.

## Product direction

LabBench is moving toward a capability-driven Composer where a lab is a validated composition of reusable equipment, materials, deterministic chemistry capabilities, workflow constraints, and assessment rules. Titration is one authored lab, not the runtime architecture. The system will use strict schemas, exact registry resolution, canonical hashes, hard validation, executable traces, independent advisory judging, immutable versions, and explicit teacher approval. It will not generate arbitrary chemistry code or bypass `ExperimentDefinition.step()`. Start with [`docs/lab-composer/README.md`](docs/lab-composer/README.md) and [`docs/lab-composer-architecture.md`](docs/lab-composer-architecture.md).
