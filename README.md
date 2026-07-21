<p align="center">
  <img src="src/app/icon.svg" width="88" height="88" alt="Litmus logo: a test strip with a teal reacted tip">
</p>

<h1 align="center">Litmus</h1>

<p align="center">
  A deterministic virtual chemistry lab where students rehearse real technique and teachers author evidence-backed practice.
</p>

<p align="center">
  <a href="https://litmus-lab.vercel.app"><strong>Open the live app</strong></a>
  ·
  <a href="https://litmus-lab.vercel.app/demo">Guided demo</a>
</p>

## What Litmus does

Litmus helps high-school chemistry students practise a laboratory procedure before they reach a physical bench. Students manipulate registered equipment, take instrument readings, make technique mistakes, and see deterministic consequences without consuming materials.

Teachers use the Lab Composer to assemble supported workflows from verified equipment, materials, actions, chemistry models, rules, and evidence criteria. AI can propose structure, coach a student, and review pedagogy, but it cannot invent chemistry or override the validator.

The governing rule is:

> Deterministic code owns chemistry, state, validation, replay, and scoring truth. AI provides bounded pedagogy and authoring assistance.

## Available laboratory experiences

- **Acid–base titration** — condition and fill a burette, read the meniscus, control delivery near the endpoint, and compare strong- and weak-acid behaviour.
- **Solution preparation** — condition a volumetric pipette, transfer an aliquot, dilute to the mark, and mix a visibly diluted copper(II) nitrate solution.
- **Silver chloride precipitation** — mix conserved solution quantities, compare the reaction quotient with Ksp, observe precipitation, and reason from ionic evidence.
- **Dissolution calorimetry** — tare a centigram balance, weigh ammonium nitrate, transfer the solid, measure the temperature change, and determine molar enthalpy from the mass the student actually measured.

Every meaningful student action flows through `ExperimentDefinition.step()`. The UI projects engine-owned state; it does not calculate pH, solubility, mass, or enthalpy.

## Lab Composer

The Composer is a capability-safe authoring workspace rather than a free-form code generator. Teachers can:

- edit student-facing metadata and learning objectives;
- arrange verified equipment and bind registered materials;
- enable only compatible typed actions;
- connect procedural and evidence rules in a graph or accessible outline;
- inspect dependency impact before removing referenced content;
- map objectives to rubric criteria and deterministic evidence;
- request a bounded AI draft, inspect the Author → Litmus checks → Judge loop, and decide whether to apply suggestions;
- validate, preview, save, approve, and assign an exact immutable workflow version.

Preview and assignment remain unavailable until the current workflow hash has a matching runnable validation result. Judge approval is advisory and cannot bypass that gate.

## Architecture
```
┌── STUDENT'S BROWSER (Chromebook-class hardware) ─────────────────────────┐
│                                                                          │
│   React 19 + Next.js UI  ◄──projects state──┐   React Three Fiber        │
│   panels, readings, a11y text               │   3D bench (three.js),     │
│           │ typed actions                   │   on-demand render loop    │
│           ▼                                 │            ▲               │
│   Zustand session store ────────────────────┘            │               │
│           │                                              │               │
│           ▼                                              │               │
│   ┌── DETERMINISTIC LAB RUNTIME (TypeScript) ────────────────────────┐   │
│   │  registries  → closed catalog: equipment, actions, materials,    │   │
│   │                units, observables, placements                    │   │
│   │  mechanics   → reusable technique: pour, dispense, tare, weigh   │   │
│   │  chemistry   → acid–base, precipitation/Ksp, thermal/enthalpy    │   │
│   │  ledger      → integer-unit mass & volume conservation           │   │
│   │  replay      → bit-identical re-execution from the action trace  │   │
│   └──────────────────────────┬───────────────────────────────────────┘   │
│                              │ semantic events + observables             │
└──────────────────────────────┼───────────────────────────────────────────┘
                               │ HTTPS (batched checkpoints)
                               ▼
┌── VERCEL SERVERLESS FUNCTIONS (Next.js route handlers, Node) ────────────┐
│   auth + per-user rate-limit guard on every model-reaching route         │
│   /api/sessions/checkpoint · /api/coach · /api/evaluate                  │
│   /api/lab-composer/author/capability · /api/lab-composer/judge          │
└──────────┬──────────────────────────────────────────┬────────────────────┘
           ▼                                          ▼
┌── SUPABASE ────────────────────────┐   ┌── OPENAI RESPONSES API ────────┐
│  Postgres + Auth + Row Level       │   │  GPT-5.6                       │
│  Security                          │   │  Coach · Evaluator             │
│  sessions, events, skill_estimates │   │  Author Agent · Judge Agent    │
│  classes, assignments, definitions │   │  (structured outputs, typed    │
│                                    │   │   tools, no chemistry math)    │
└────────────────────────────────────┘   └────────────────────────────────┘
```

The important boundaries are deliberately boring:

- chemistry models are local, deterministic, and replayable;
- material quantities use conserved scaled-integer ledgers;
- the React and Three.js layers only render registered state and dispatch typed actions;
- OpenAI calls are server-only, bounded, and never block a simulation action;
- Supabase persistence is separated from chemistry and protected by RLS;
- mock mode uses the same schemas and application routes as live mode.

## How OpenAI and Codex are used

GPT-5.6 is used only on server-side, bounded language tasks through the OpenAI Responses API. It never runs the chemistry simulation, writes directly to a registry, or becomes the source of a score.

| Surface         | GPT-5.6 receives                                                             | GPT-5.6 may return                                       | Deterministic or human control that remains authoritative                                   |
| --------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Composer Author | A teacher request plus read-only, typed capability-tool results              | Atomic draft commands over exact registered capabilities | Schema, registry, safety, compatibility, and real-runtime trace validation                  |
| Student Coach   | Semantic events, diagnoses, available actions, and authored workflow context | A concise, evidence-grounded hint or reflection question | The experiment engine; the coach cannot mutate a session or calculate chemistry             |
| Evaluator       | The authored rubric, submitted response, and verified event/evidence context | Structured feedback tied to supplied evidence            | Engine-owned observables, event history, and rubric ground truth                            |
| Workflow Judge  | A validated workflow candidate and its validation/trace evidence             | Advisory instructional critique                          | The validator and explicit teacher approval; Judge approval cannot make a workflow runnable |

Responses are parsed against strict schemas, checked against the supplied IDs and evidence, rate-limited, and safely fall back when a live model response is unavailable or invalid. Simulation actions remain synchronous and never wait for an OpenAI call.

Codex was used during development as the primary engineering collaborator, not as a runtime dependency. Under human product direction, Codex implemented the large majority of the application, including:

- the deterministic `ExperimentDefinition.step()` engine architecture and the acid–base titration, solution-preparation, silver-chloride precipitation, and dissolution-calorimetry experiences;
- the reusable 3D laboratory, registered equipment visuals, camera and gesture interactions, precision controls, keyboard alternatives, reduced-motion support, and Chromebook-oriented rendering path;
- the capability-driven Lab Composer: strict workflow schemas, exact registries, shared authoring commands, equipment/material setup, graph and outline editors, rubric/evidence mapping, deterministic validation, canonical hashing, Preview, replay, immutable approval, and assignment workflows;
- the bounded OpenAI integrations for Composer Author proposals, Student Coach guidance, evidence-linked evaluation, and advisory Workflow Judge review, including schema enforcement, rate limits, trace verification, and deterministic fallbacks;
- Google authentication, Supabase schema and RLS policies, idempotent checkpoints, teacher-owned drafts, immutable workflow versions, class and assignment persistence, replay provenance, and deterministic teacher analytics;
- the guest and authenticated product routes, guided demo surfaces, responsive design system, accessibility behavior, deployment configuration, and project documentation; and
- the strict TypeScript, Vitest, Playwright, chemistry-conservation, replay, API, RLS, accessibility, viewport, and production-build test coverage used to verify those systems.

Codex also translated product requirements into scoped implementation tickets, reproduced browser-level failures, reviewed compatibility boundaries, and maintained the architecture and release documentation throughout development.

## Quick start

Requirements: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Guest experiments and the guided demo work without authentication.

Install Chromium before running browser tests:

```bash
npx playwright install chromium
```

## Environment configuration

Keep `OPENAI_MOCK_MODE=1` for deterministic local development. For live AI, provide `OPENAI_API_KEY`, set the flag to `0`, and select the desired server-side models. The production deployment currently uses GPT-5.6 for authoring, judging, coaching, and evaluation.

| Variable                                                        | Used for                               | Exposure     |
| --------------------------------------------------------------- | -------------------------------------- | ------------ |
| `NEXT_PUBLIC_SUPABASE_URL`                                      | Supabase project URL                   | Browser-safe |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                 | Authenticated browser access under RLS | Browser-safe |
| `SUPABASE_SERVICE_ROLE_KEY`                                     | Server persistence operations          | Server only  |
| `OPENAI_API_KEY`                                                | Live bounded AI routes                 | Server only  |
| `OPENAI_MOCK_MODE`                                              | Deterministic mock/live switch         | Server only  |
| `OPENAI_COACH_MODEL`, `OPENAI_COACH_V2_MODEL`                   | Student coaching                       | Server only  |
| `OPENAI_EVALUATOR_MODEL`, `OPENAI_EVALUATOR_V2_MODEL`           | Evidence-linked evaluation             | Server only  |
| `OPENAI_LAB_AUTHOR_MODEL`, `OPENAI_LAB_CAPABILITY_AUTHOR_MODEL` | Composer proposals                     | Server only  |
| `OPENAI_LAB_WORKFLOW_JUDGE_MODEL`                               | Advisory workflow review               | Server only  |
| `NEXT_PUBLIC_ADOBE_FONTS_STYLESHEET`                            | Optional approved Adobe font project   | Browser-safe |

Never prefix an OpenAI key or Supabase service-role key with `NEXT_PUBLIC_`.

## Useful routes

- `/experiments` — credential-free student practice catalog.
- `/lab/calorimetry` — balance-driven ammonium nitrate dissolution lab.
- `/lab/silver-chloride` — Ksp precipitation lab.
- `/lab/solution-preparation` — volumetric dilution lab.
- `/lab-composer` — shared teacher/student Composer entry point.
- `/demo` — isolated guided Student, Teacher, and Composer demo paths.
- `/teacher/classes` — authenticated class readiness workspace.

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

`npm run profile:lab` records a reproducible browser performance sample for the 3D path. The application targets Chromebook-class hardware, supports keyboard equivalents for every lab action, respects reduced motion, and provides a reduced-graphics mode.

## Repository map

- `src/experiments/` — deterministic experiment engines and shared contracts.
- `src/lab-workflows/` — schemas, registries, validation, hashing, generic runtime, replay, and chemistry models.
- `src/components/lab/` — student controls and registered 3D presentation.
- `src/components/teacher/lab-composer/` — teacher authoring, validation, AI review, and Preview UI.
- `src/lib/agent/` — bounded server-side Coach, Author, Evaluator, and Judge integrations.
- `src/lib/persistence/`, `src/lib/analytics/`, `supabase/` — checkpoints, deterministic analytics, database schema, and RLS.
- `tests/` — chemistry, conservation, replay, accessibility, API, component, and browser coverage.

## Deployment

The production project is deployed on Vercel at [litmus-lab.vercel.app](https://litmus-lab.vercel.app). Configure all secrets through the host's environment-variable manager; `.vercelignore` prevents local environment files from entering CLI deployment uploads.

For Supabase authentication, allow the deployed `/auth/callback` URL in the project's redirect configuration. Core guest practice remains available when authentication or cloud persistence is unavailable.

## Product boundaries

Litmus prepares students for hands-on laboratory work; it does not replace a physical laboratory, safety instruction, or teacher judgment. The Composer can only use exact registered capabilities. It cannot generate arbitrary chemistry formulas, executable code, unknown equipment, or free-form physical coordinates.

Start with [`PRODUCT.md`](PRODUCT.md), [`DESIGN.md`](DESIGN.md), and [`AGENTS.md`](AGENTS.md) for product intent, visual rules, and repository invariants. The detailed implementation record is in [`docs/Repo_Current_State.md`](docs/Repo_Current_State.md).
