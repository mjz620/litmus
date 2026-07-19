# LabBench AI

LabBench AI is a browser-based chemistry rehearsal environment for students and teachers. Students practice supported lab procedures in deterministic simulations; teachers can compose, validate, preview, and review supported lab workflows before assigning them in a future persistence phase.

The core rule is simple: **deterministic code owns chemistry, simulation state, validation, replay, and scoring truth. AI provides bounded pedagogy and authoring assistance.**

## What works today

### Student labs

- Acid–base titration with fills/refills, cumulative delivery, pH progression, meniscus evidence, reports, targeted retries, and seeded replay.
- Precipitation/solubility practice with exact supported solution IDs, observations, product prediction, and net-ionic evidence.
- Sodium-chloride solution preparation: condition a pipette, measure and deliver an aliquot, fill a volumetric flask to the mark, and mix the solution.
- Keyboard-accessible controls, reduced-motion/graphics behavior, demand-rendered 3D, and optional hold-to-talk questions.

### Teacher Lab Composer

The Composer is a supported-workflow builder, not a free-form chemistry generator. Teachers can:

- define student-facing metadata and objectives;
- arrange verified equipment, materials, and permitted actions;
- edit procedural checks in a graph or accessible outline;
- link objectives, rubric criteria, and evidence checks;
- inspect removal impact before deleting referenced content;
- validate, save/load locally, and launch an exact-hash Preview;
- request a bounded AI draft proposal, then explicitly accept, reject, or revise it;
- review the Author → deterministic checks → advisory Judge cycle in the **AI review** tab.

The current supported native workflow is solution preparation. Compatibility titration remains available through the same generic coordinator. Preview is enabled only for a current, deterministically validated runnable workflow; advisory AI and Judge output never override that gate.

### AI boundaries

- The Author Agent can inspect fixed registry data and issue the same typed draft commands as the human Composer.
- The Workflow Judge is advisory and teacher-controlled; accepted suggestions are revalidated and replayed before they can affect a draft.
- The Student Coach receives deterministic state, diagnoses, and semantic evidence. It cannot mutate a simulation or compute chemistry truth.
- Live OpenAI calls are server-only, bounded by timeout/retry limits, and fall back to deterministic local guidance when unavailable.

## Architecture

```text
Student or teacher action
  → typed command / experiment action
  → ExperimentDefinition.step() or draft transaction
  → deterministic state, validation, and semantic evidence
      ├─ replay and checkpoint contracts
      ├─ StudentModel and teacher analytics
      ├─ bounded Coach / Author / Judge requests
      └─ exact-hash Preview eligibility
```

Key directories:

- `src/experiments/` — deterministic legacy experiment engines and shared contracts.
- `src/lab-workflows/` — strict workflow schemas, registries, validation, hashing, generic runtime, replay, and deterministic models.
- `src/components/lab/` — student controls and 3D presentation.
- `src/components/teacher/lab-composer/` — teacher Composer workspace and Preview UI.
- `src/lib/agent/` — server-side bounded Coach, Author, Evaluator, and Judge integrations.
- `src/stores/` — typed client session and runtime state.
- `src/lib/persistence/`, `src/lib/analytics/`, and `supabase/` — checkpointing, deterministic aggregates, and production data boundaries.
- `tests/` — unit, contract, replay, API, and browser coverage.

For the authoritative Composer architecture and active ticket map, start with [`docs/lab-composer/README.md`](docs/lab-composer/README.md) and [`docs/lab-composer/tickets/README.md`](docs/lab-composer/tickets/README.md).

## Local setup

Requirements: Node.js 20+ and npm.

```bash
npm install
npx playwright install chromium
cp .env.example .env
npm run dev
```

For deterministic local development, leave `OPENAI_MOCK_MODE=1`. To exercise live server-side AI, set `OPENAI_API_KEY` and change that flag to `0`. Never expose an OpenAI or Supabase service-role key to the browser.

Useful routes:

- `/` — product overview.
- `/experiments` — guest student practice.
- `/demo` — credential-free Student, Teacher, Composer, and Technical demo paths.
- `/lab-composer` — Lab Composer for students and teachers (cloud save/assign require teacher sign-in).
- `/assignments/[assignmentId]` — student start for a pinned class assignment.
- `/teacher/lab-composer` — redirects to `/lab-composer`.
- `/teacher/lab-composer/preview` — isolated Composer preview.
- `/dev/lab/titration?runtime=setup-v2` — setup-driven development diagnostics.

Guest practice and the demo do not require authentication. Supabase configuration is needed for real persistence, classroom data, and production deployment; see [`.env.example`](.env.example) and `supabase/`.

## Quality gates

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run eval:coach
npm run build
npm run test:e2e
```

`npm run profile:lab` records a reproducible browser performance sample for the active 3D path. See [`docs/project/Chromebook_Performance.md`](docs/project/Chromebook_Performance.md) for the performance target and prior results.

## Current limits

- Lab Composer only supports exact registered equipment, actions, materials, deterministic models, and workflow conditions. It does not author arbitrary formulas, code, or physical coordinates.
- Preview is available for validated supported workflows only. Assignment, immutable definition versions, and production classroom persistence are Phase 8 work.
- The 3D scene is a verified presentation of registered equipment poses; it is not a free-form scene editor.
- AI output is advisory. It cannot create registry IDs, certify validation, change simulation state, or override safety and runtime checks.

## Security and data guarantees

- Meaningful simulation actions continue through `ExperimentDefinition.step()`.
- Semantic events are the shared contract for coaching, persistence, replay, evaluation, and teacher analytics.
- Simulation actions never wait for OpenAI or Supabase.
- Checkpoint writes are idempotent; teacher metrics are deterministic aggregates over persisted evidence.
- Production class data is protected by Supabase RLS.

## Documentation

- [`docs/Repo_Current_State.md`](docs/Repo_Current_State.md) — detailed implementation record.
- [`docs/lab-composer-architecture.md`](docs/lab-composer-architecture.md) — Composer architecture and boundaries.
- [`docs/demo/Runbook.md`](docs/demo/Runbook.md) — demo setup and fallback instructions.
- [`AGENTS.md`](AGENTS.md) — repository engineering rules and completion-report requirements.
