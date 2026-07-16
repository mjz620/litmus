# tickets.md — LabBench AI Verifiable Ticket Backlog

This file is the source of truth for Codex implementation tasks. Implement exactly one ticket per branch/run. Each ticket includes scope, dependencies, allowed areas, non-goals, acceptance criteria, and manual verification.

## Ticket workflow

1. Choose the next unblocked ticket.
2. Start the suggested branch.
3. Paste the ticket into Codex using `docs/Codex_Ticket_Handoff_Template.md`.
4. Run automatic and manual verification.
5. Paste Codex's completion report into ChatGPT.
6. Update `docs/Repo_Current_State.md`.
7. Add out-of-scope findings to `docs/Known_Issues_And_Followups.md`.

## Dependency map

```text
T0001 → T0002 → T0003 → T0004 → T0005/T0006
T0006 → T0007 → T0008 → T0009 → T0010/T0011
T0011 → T0011A → T0011B → T0012
T0009 + T0014 → T0015 → T0016 → T0017 → T0018
T0013 + T0019/T0020/T0021 → T0022 → T0023
T0024/T0025/T0026 → T0027 → T0028
T0029 + T0035/T0036/T0037/T0038/T0039 = demo loop
T0030/T0031/T0032/T0033/T0034 = report + retry loop
T0040/T0041 = voice
T0042/T0043 = precipitation plugin
T0044/T0045/T0046 = polish and submission
T0009/KI-003 → T0047 → T0048 = randomized titration sessions and refills
```


## T0001 — Project skeleton

**Suggested branch:** `feature/t0001-project-skeleton`  
**Goal:** Create the strict Next.js + TypeScript baseline with scripts and empty route shell.

**Dependencies:** None

**Allowed areas:**

- `src/app/**, package.json, tsconfig.json, next.config.*, eslint/prettier config, tests/**`

**Do not touch:**

- `src/experiments/** chemistry logic, supabase/** migrations beyond empty folder`

**Requirements:**

- Initialize app router, TypeScript strict, baseline scripts, minimal landing page, Vitest and Playwright placeholders.

**Non-goals:**

- No 3D, no chemistry, no auth, no OpenAI routes.

**Acceptance criteria:**

- `npm run build`, `npm run typecheck`, and `npm test` run or have explicit placeholder script behavior; home page renders.

**Manual verification:**

- Run install, dev server, build/typecheck/test; open `/`; check console.

**Completion report required:** yes.


## T0002 — Install repo docs

**Suggested branch:** `feature/t0002-install-repo-docs`  
**Goal:** Place this workflow pack inside the repository and verify links/paths.

**Dependencies:** T0001

**Allowed areas:**

- `AGENTS.md, README.md, docs/**, tickets.md, source-contracts/**, assets/**`

**Do not touch:**

- `src/** implementation code`

**Requirements:**

- Copy docs; ensure file links are relative; do not change product decisions.

**Non-goals:**

- No application behavior changes.

**Acceptance criteria:**

- Docs are present; README explains workflow; AGENTS.md at repo root.

**Manual verification:**

- Open README, AGENTS, tickets; confirm no broken obvious references.

**Completion report required:** yes.


## T0003 — Experiment contract scaffold

**Suggested branch:** `feature/t0003-experiment-contract-scaffold`  
**Goal:** Implement shared experiment contracts and StudentModel update utilities.

**Dependencies:** T0001

**Allowed areas:**

- `src/experiments/shared/**, src/types/**, tests/experiments/**`

**Do not touch:**

- `src/app/** UI, src/lib/agent/**, supabase/**`

**Requirements:**

- Define ExperimentDefinition, SemanticEvent, SkillEvidence, StudentModel, update reducer.

**Non-goals:**

- No titration formulas yet unless imported from source-contracts.

**Acceptance criteria:**

- Type tests pass; StudentModel updates from positive/negative evidence.

**Manual verification:**

- Run unit tests; inspect imports to ensure no React/DB/LLM in core.

**Completion report required:** yes.


## T0004 — Titration engine import

**Suggested branch:** `feature/t0004-titration-engine-import`  
**Goal:** Move/adapt existing titration engine into repo without weakening invariants.

**Dependencies:** T0003

**Allowed areas:**

- `src/experiments/titration/**, tests/experiments/titration.test.ts`

**Do not touch:**

- `src/components/**, src/app/**, src/lib/agent/**`

**Requirements:**

- Port `titration.ts` and tests from `source-contracts`; preserve seeding and semantic events.

**Non-goals:**

- No UI, no coach, no persistence.

**Acceptance criteria:**

- Existing titration tests pass; seed at 22.00 mL works.

**Manual verification:**

- Run titration tests; inspect for forbidden imports.

**Completion report required:** yes.


## T0005 — Display formatting helpers

**Suggested branch:** `feature/t0005-display-formatting-helpers`  
**Goal:** Add display-layer rounding for glassware and pH without changing engine precision.

**Dependencies:** T0004

**Allowed areas:**

- `src/experiments/titration/display.ts, tests/experiments/**`

**Do not touch:**

- `titration engine formulas unless needed only to export raw values`

**Requirements:**

- Format burette to ±0.05 mL and pH display; engine retains floats.

**Non-goals:**

- No UI components.

**Acceptance criteria:**

- Tests prove display rounding differs from full precision state.

**Manual verification:**

- Run tests; inspect raw state remains unrounded.

**Completion report required:** yes.


## T0006 — Experiment registry

**Suggested branch:** `feature/t0006-experiment-registry`  
**Goal:** Create lazy registry for experiments with titration registered.

**Dependencies:** T0004

**Allowed areas:**

- `src/experiments/registry.ts, src/experiments/titration/manifest.ts`

**Do not touch:**

- `UI shell beyond minimal route usage`

**Requirements:**

- Registry exposes id/title/version/load definition/metadata.

**Non-goals:**

- No precipitation implementation yet.

**Acceptance criteria:**

- Registry test can load titration definition by ID.

**Manual verification:**

- Run registry test; verify unknown ID error path.

**Completion report required:** yes.


## T0007 — Lab store scaffold

**Suggested branch:** `feature/t0007-lab-store-scaffold`  
**Goal:** Create Zustand lab store that dispatches typed experiment actions.

**Dependencies:** T0006

**Allowed areas:**

- `src/stores/labStore.ts, tests/stores/**`

**Do not touch:**

- `3D components, coach API, DB`

**Requirements:**

- Store loads experiment, keeps state/model/events, dispatches step results.

**Non-goals:**

- No network checkpoint, no coach call.

**Acceptance criteria:**

- Dispatching titration action updates state and event queue.

**Manual verification:**

- Run store tests; manually inspect no network calls.

**Completion report required:** yes.


## T0008 — Student route shell

**Suggested branch:** `feature/t0008-student-route-shell`  
**Goal:** Create `/experiments` and `/lab/[experimentId]` shell with route loading.

**Dependencies:** T0006, T0007

**Allowed areas:**

- `src/app/experiments/**, src/app/lab/[experimentId]/**, src/components/ui/**`

**Do not touch:**

- `engine formulas, coach, DB`

**Requirements:**

- Experiment cards; lab route loads registry and initializes state.

**Non-goals:**

- No full 3D scene yet.

**Acceptance criteria:**

- Opening `/lab/titration` shows initialized lab shell and state summary.

**Manual verification:**

- Run dev; open routes; check invalid experiment 404/error.

**Completion report required:** yes.


## T0009 — 2D titration controls

**Suggested branch:** `feature/t0009-2d-titration-controls`  
**Goal:** Build precise 2D controls for core titration actions.

**Dependencies:** T0008

**Allowed areas:**

- `src/components/lab/titration/**, src/app/lab/[experimentId]/**`

**Do not touch:**

- `engine formulas, coach, DB`

**Requirements:**

- Controls for rinse, fill, indicator, add titrant, read meniscus.

**Non-goals:**

- No R3F polish, no AI.

**Acceptance criteria:**

- User can drive engine through controls and see state change.

**Manual verification:**

- Open lab; add titrant; verify state and pH/volume update.

**Completion report required:** yes.


## T0010 — pH curve component

**Suggested branch:** `feature/t0010-ph-curve-component`  
**Goal:** Render pH curve from engine state.

**Dependencies:** T0009

**Allowed areas:**

- `src/components/lab/PHCurve.tsx, tests/components/**`

**Do not touch:**

- `engine curve generation logic unless tests expose bug`

**Requirements:**

- Add accessible SVG/canvas chart; no heavyweight chart dependency unless justified.

**Non-goals:**

- No analytics charts.

**Acceptance criteria:**

- Curve updates when titrant added; graceful empty-state.

**Manual verification:**

- Open lab; add titrant; inspect curve and console.

**Completion report required:** yes.


## T0011 — Low-poly 3D lab shell

**Suggested branch:** `feature/t0011-low-poly-3d-lab-shell`  
**Goal:** Add R3F bench scene deriving visuals from titration state.

**Dependencies:** T0009

**Allowed areas:**

- `src/components/lab/three/**, src/components/lab/titration/TitrationScene.tsx`

**Do not touch:**

- `engine, coach, DB`

**Requirements:**

- Burette/flask/bench visuals; level/color state projections; orbit/drag controls appropriate for Chromebook.

**Non-goals:**

- No freeform physics, no photorealism.

**Acceptance criteria:**

- Scene renders and does not own chemistry state.

**Manual verification:**

- Open lab; verify visuals change after controls; check console/FPS roughly.

**Completion report required:** yes.


## T0011A — Student lab surface and debug-state separation

**Suggested branch:** `feature/t0011a-student-debug-surface-separation`
**Goal:** Replace the raw engine-state sidebar with a student-facing lab
notebook, move internal analytics to a separate development testing route, and
prevent internal truth or answers from appearing in the student experience.

**Dependencies:** T0011, T0047

**Allowed areas:**

- `src/app/lab/**, src/app/dev/lab/**, src/components/lab/**, tests/components/**, tests/e2e/**`

**Do not touch:**

- `chemistry formulas, semantic event meanings, StudentModel calculations, coach behavior, database schema`

**Requirements:**

- Remove the production-facing “Initialized state summary” and all raw internal
  fields from the normal student surface, including experiment IDs, session
  seeds, skills tracked, event counts, and engine status labels.
- Establish two clearly separated routes that reuse the same experiment engine,
  Zustand store, action controls, seeded configuration generator, and shared lab
  session components:
  - `/lab/[experimentId]` is the student route and contains no raw analytics or
    answer-bearing internal state;
  - `/dev/lab/[experimentId]` is the developer testing route and may display the
    raw state/configuration, session seed, unknown ground truth, skills,
    semantic-event counts, and test controls needed to inspect the simulation.
- Make `/dev/lab/[experimentId]` development-only: it must return 404 or
  otherwise be unreachable in production builds. Do not rely on a hidden link
  or visual obscurity as access control.
- Give the developer route an unmistakable “Developer testing” banner and a
  link back to the corresponding student route so screenshots or user tests
  cannot confuse it with the product experience.
- Support the same explicit `?seed=<recorded-seed>` replay parameter on both
  routes. The dev route should show the active seed and deterministic generated
  configuration; the student route must use them without visibly revealing
  them.
- Never display the generated unknown analyte concentration, equivalence volume,
  ground truth, or other answer-bearing engine values to the student.
- Replace the sidebar with a student lab notebook/session panel containing only
  pedagogically appropriate information: objective, current procedure stage,
  known analyte sample volume, standardized titrant concentration, selected
  indicator, student-recorded burette readings/observations, and the live pH
  curve when appropriate.
- Preserve a compact developer analytics summary on the dev route with status,
  canonical experiment ID, session ID/seed, full config and raw state, current
  StudentModel skill estimates/flags, and semantic-event count. T0012 will add
  the detailed collapsible event/evidence inspector to this route.
- Add a top session bar placeholder for experiment title, stage, save status,
  reset/help controls, and eventual report navigation without implementing
  persistence, coach, report, or reset behavior early.
- Preserve access to every existing precision action and retain clear keyboard
  focus order at Chromebook widths.

**Non-goals:**

- No engine, persistence, coach, report, or procedure-grading changes.
- No detailed event-by-event inspector; that remains T0012. T0011A includes only
  the baseline developer analytics page needed to separate internal data from
  the student route.
- No visual redesign of the 3D room; that belongs to T0011B.

**Acceptance criteria:**

- The normal `/lab/titration` page contains no visible session seed, internal
  experiment ID, skill count, event count, raw engine-state heading, unknown
  analyte concentration, or equivalence volume.
- `/dev/lab/titration` displays the deterministic seed/configuration, raw state,
  skill summary, flags, and event count in development while using the same
  engine state and typed action flow as `/lab/titration`.
- A production build returns 404 for `/dev/lab/titration`; the developer page
  and its answer-bearing content are not shipped as an accessible production
  student route.
- The student can identify the objective, known sample volume, standardized
  titrant concentration, current stage, selected indicator, and their recorded
  measurements without seeing the answer.
- A regression test explicitly proves that the unknown analyte concentration is
  absent from visible student text for several randomized session seeds.
- Route tests prove a shared seed produces matching underlying configuration on
  the student and dev pages without exposing that configuration on the student
  page.
- Existing controls, pH curve, 3D projections, and deterministic engine tests
  remain green.

**Manual verification:**

- Open several seeded and unseeded titration sessions; confirm no unknown
  concentration or internal diagnostic data is visible.
- Open the same seeds on `/dev/lab/titration`; confirm the raw configuration,
  state, skills, flags, and event count are available and update after actions.
- Run or preview a production build and confirm `/dev/lab/titration` returns
  404.
- Complete rinse, fill, indicator selection, titrant addition, and meniscus
  recording; confirm the notebook shows only student-appropriate information.
- Navigate the page keyboard-only at a Chromebook-sized viewport and inspect the
  browser console.

**Completion report required:** yes.


## T0011B — Detailed interactive high-school chemistry lab

**Suggested branch:** `feature/t0011b-interactive-high-school-lab`
**Goal:** Replace the placeholder low-poly bench with a polished, recognizable
high-school chemistry lab whose equipment can be selected and operated through
contextual controls.

**Dependencies:** T0011A

**Allowed areas:**

- `src/components/lab/three/**, src/components/lab/titration/**, src/app/lab/**, tests/components/**, tests/e2e/**, docs/assets/**`

**Do not touch:**

- `chemistry formulas, experiment action semantics, StudentModel, coach behavior, persistence, database schema`

**Requirements:**

- Use the project owner's supplied high-school laboratory photo as art
  direction. Recreate the environmental character without reproducing people:
  black phenolic lab islands, warm wood cabinetry, glass-front storage, sinks
  and faucets, classroom ceiling/light panels, and believable chemistry-room
  background detail.
- Treat the source classroom photo as private reference material. Do not commit
  the original image or any identifiable student likeness; a cropped,
  de-identified environment reference may enter `docs/assets/**` only with
  explicit owner approval.
- Move from placeholder primitive silhouettes to a moderate-detail,
  performance-conscious style. Equipment must remain lightweight enough for
  Chromebook hardware but may not look like featureless blocks.
- Apply selective photorealism to the scientific glassware even though the
  surrounding classroom remains moderately stylized. Burette and flask glass
  should use physically based transparent/transmissive materials with believable
  index of refraction, thickness, roughness, reflections, edge highlights, and
  restrained environmental lighting.
- Make the glass walls, liquid, meniscus, printed graduations, and background
  visibly separable. Glassware may not look like an opaque pastel solid or a
  single translucent cone/cylinder.
- Provide a lower-cost glass-material fallback for weak WebGL devices or reduced
  graphics settings while preserving vessel shape, liquid level, markings, and
  interaction affordances.
- Model the burette with correct proportions, visible graduation ticks and
  readable major-volume markings, a clamp, stopcock, tip, liquid column, and
  meniscus. Model the Erlenmeyer flask with a distinct neck, rim, glass wall, and
  contained liquid surface.
- Correct all spatial relationships: the burette tip must stop above the flask
  opening, must never intersect or pass through the flask, and equipment must
  rest on or attach to the appropriate bench/stand surfaces without visible
  clipping.
- Add hover and keyboard-focus affordances for interactive equipment, including
  a subtle outline/highlight, equipment name, concise purpose, and pointer/focus
  feedback.
- Make the burette, flask, indicator, and meniscus selectable. Selection moves
  or frames the camera to a focused view and shows only that object's contextual
  controls:
  - burette: rinse, fill, and stopcock/delivery controls;
  - flask/indicator: select indicator, inspect color, and a typed swirl action
    only if a separate engine ticket authorizes it;
  - meniscus: eye-level detailed view and reading input.
- Keep precision-critical actions in accessible 2D overlays/panels while making
  their entry point spatially connected to the selected 3D equipment.
- Provide a clear way to exit the focused view and return to the full bench.
- Preserve engine-owned liquid level and color projections. The scene may not
  calculate chemistry or dispatch an action that does not exist in the typed
  experiment contract.
- Use optimized reusable geometry/materials, demand rendering, bounded DPR, and
  lazy loading. Use environment/reflection lighting only at a tightly bounded
  cost. Avoid physics, required post-processing, photogrammetry, large textures,
  or uncontrolled polygon counts.

**Non-goals:**

- No photorealistic digital twin of the entire classroom, freeform pouring
  physics, avatars, student likenesses, decorative clutter that harms
  performance, or chemistry logic in the scene. Selective glassware realism is
  explicitly in scope.
- No new swirl or procedural action semantics unless separately authorized in an
  experiment-core ticket.
- No coach panel or persistence behavior.

**Acceptance criteria:**

- The default scene is recognizably a high-school chemistry lab rather than an
  empty generic table, with the specified cabinetry, black work surface, sink
  context, and classroom set dressing visible at an appropriate level of detail.
- Automated geometry assertions and visual/manual inspection prove the burette
  tip is above the flask opening with no intersection across default and focused
  camera views.
- Burette graduation marks and major labels remain legible in its focused view.
- In focused views the burette and flask read as glass: backgrounds remain
  partially visible through them, edges catch light, the contained liquid and
  meniscus remain distinct, and transparency does not hide graduations or
  interaction highlighting.
- Pointer hover and keyboard focus identify each selectable equipment item; a
  student can select the burette, flask, indicator, and meniscus and receive the
  correct contextual panel.
- Existing typed actions still flow through the lab store and
  `ExperimentDefinition.step()`; the 3D scene owns no chemistry truth.
- The scene remains usable at a Chromebook viewport, respects reduced motion,
  and meets the current performance budget or records measured limitations.

**Manual verification:**

- Compare the lab's environmental composition with the supplied high-school lab
  reference, ignoring the people in the photo.
- Inspect the burette closely from multiple views; verify graduations, clamp,
  stopcock, meniscus, glass transparency/reflections, and the gap above the
  flask.
- Inspect the flask against both light and dark classroom backgrounds; verify
  the glass walls, liquid boundary, color, and rim remain visually distinct.
- Hover, keyboard-focus, select, and exit every equipment view; complete the
  existing titration procedure using contextual controls.
- Test at a Chromebook-sized viewport with reduced motion and inspect FPS,
  loading behavior, accessibility names, and the browser console.

**Completion report required:** yes.


## T0012 — Student event inspector dev panel

**Suggested branch:** `feature/t0012-student-event-inspector-dev-panel`  
**Goal:** Add collapsible development event inspector.

**Dependencies:** T0011A, T0011B

**Allowed areas:**

- `src/components/lab/EventInspector.tsx, src/app/dev/lab/**`

**Do not touch:**

- `coach implementation, DB`

**Requirements:**

- Show recent SemanticEvents, StudentModel, session seed, and raw engine state
  for debugging.
- Mount the inspector only on `/dev/lab/[experimentId]` behind an explicit
  collapsible affordance; none of these values may appear in the normal student
  lab notebook or production student route.

**Non-goals:**

- No production technical demo yet.

**Acceptance criteria:**

- Inspector displays event types/flags/evidence and internal state after actions
  in development, and production/student-surface tests prove it is absent.

**Manual verification:**

- Trigger mistake; inspect event fields.

**Completion report required:** yes.


## T0013 — Checkpoint queue scaffold

**Suggested branch:** `feature/t0013-checkpoint-queue-scaffold`  
**Goal:** Create async persistence queue interface with no-op/local implementation.

**Dependencies:** T0007

**Allowed areas:**

- `src/lib/persistence/**, src/stores/labStore.ts, tests/persistence/**`

**Do not touch:**

- `Supabase migrations, teacher UI`

**Requirements:**

- Queue event batches without blocking simulation; expose saveStatus.

**Non-goals:**

- No real DB writes yet.

**Acceptance criteria:**

- Dispatch remains synchronous; queue status changes to saved/error in mocked tests.

**Manual verification:**

- Run tests; simulate failed checkpoint; lab state still updates.

**Completion report required:** yes.


## T0014 — Coach trigger policy

**Suggested branch:** `feature/t0014-coach-trigger-policy`  
**Goal:** Implement pure function deciding whether coach should be called.

**Dependencies:** T0004, T0007

**Allowed areas:**

- `src/lib/agent/triggerPolicy.ts, tests/coach/**`

**Do not touch:**

- `OpenAI API route, UI components`

**Requirements:**

- Trigger on flags/questions/repeated failures; stay silent on routine success.

**Non-goals:**

- No model calls.

**Acceptance criteria:**

- Tests cover overshoot triggers and controlled addition silence.

**Manual verification:**

- Run coach trigger tests.

**Completion report required:** yes.


## T0015 — Coach API schema

**Suggested branch:** `feature/t0015-coach-api-schema`  
**Goal:** Create `/api/coach` route with request/response validation and mock mode.

**Dependencies:** T0014

**Allowed areas:**

- `src/app/api/coach/**, src/lib/agent/schemas.ts, tests/api/**`

**Do not touch:**

- `UI wiring, engine formulas`

**Requirements:**

- Validate request; return deterministic mock response when no API key/test mode.

**Non-goals:**

- No production prompt complexity yet.

**Acceptance criteria:**

- API rejects invalid payload; valid flagged event returns structured response.

**Manual verification:**

- Run API tests; curl/post sample payload.

**Completion report required:** yes.


## T0016 — Coach prompt and structured output

**Suggested branch:** `feature/t0016-coach-prompt-and-structured-output`  
**Goal:** Add production coach prompt, structured output parsing, and refusal rules.

**Dependencies:** T0015

**Allowed areas:**

- `src/lib/agent/**, src/app/api/coach/**, tests/coach/**`

**Do not touch:**

- `chemistry engine, teacher UI`

**Requirements:**

- Implement constrained tutor role and schema validation.

**Non-goals:**

- No voice, no evaluator.

**Acceptance criteria:**

- Structured response validates; off-topic request refused; event evidence referenced.

**Manual verification:**

- Run tests with mock model; inspect prompt for no chain-of-thought request.

**Completion report required:** yes.


## T0017 — Coach panel UI

**Suggested branch:** `feature/t0017-coach-panel-ui`  
**Goal:** Wire coach panel to trigger policy and `/api/coach`.

**Dependencies:** T0015, T0014, T0009

**Allowed areas:**

- `src/components/coach/**, src/app/lab/**, src/stores/labStore.ts`

**Do not touch:**

- `engine formulas, DB schema`

**Requirements:**

- Show messages, loading, text question input, non-blocking calls.

**Non-goals:**

- No voice yet.

**Acceptance criteria:**

- Mistake yields coach message; routine success stays quiet; text question works.

**Manual verification:**

- Open lab; trigger overshoot; ask text question.

**Completion report required:** yes.


## T0018 — Coach eval harness v1

**Suggested branch:** `feature/t0018-coach-eval-harness-v1`  
**Goal:** Add headless seeded scenarios for coach behavior.

**Dependencies:** T0016

**Allowed areas:**

- `tests/coach/**, scripts/evals/**, package.json`

**Do not touch:**

- `UI, DB`

**Requirements:**

- Run scenarios and print catch-rate/false-intervention table.

**Non-goals:**

- No full eval dashboard.

**Acceptance criteria:**

- Command runs; includes at least one positive stay-silent scenario.

**Manual verification:**

- Run eval command; inspect table.

**Completion report required:** yes.


## T0019 — Supabase schema migration

**Suggested branch:** `feature/t0019-supabase-schema-migration`  
**Goal:** Create database migrations for profiles/classes/sessions/events/skills/interventions/reports.

**Dependencies:** T0013

**Allowed areas:**

- `supabase/migrations/**, supabase/seed.sql`

**Do not touch:**

- `experiment engine, UI other than env docs`

**Requirements:**

- Implement schema with constraints and indexes.

**Non-goals:**

- No RLS policy complexity beyond baseline if split needed.

**Acceptance criteria:**

- Local migration applies cleanly; tables exist.

**Manual verification:**

- Run supabase local migration or SQL validation; inspect schema.

**Completion report required:** yes.


## T0020 — RLS policies

**Suggested branch:** `feature/t0020-rls-policies`  
**Goal:** Add RLS policies for student/teacher/demo access.

**Dependencies:** T0019

**Allowed areas:**

- `supabase/migrations/**, tests/db/**`

**Do not touch:**

- `UI, engine`

**Requirements:**

- Students own rows; teachers read owned classes; demo controlled.

**Non-goals:**

- No dashboard UI.

**Acceptance criteria:**

- RLS tests or SQL fixtures prove isolation.

**Manual verification:**

- Run DB tests or manually query with test roles.

**Completion report required:** yes.


## T0021 — Supabase client and env validation

**Suggested branch:** `feature/t0021-supabase-client-and-env-validation`  
**Goal:** Add server/client Supabase utilities and environment validation.

**Dependencies:** T0019

**Allowed areas:**

- `src/lib/supabase/**, src/lib/env.ts, .env.example`

**Do not touch:**

- `UI routes beyond minimal use`

**Requirements:**

- Separate server/client clients; no secrets in browser.

**Non-goals:**

- No auth UI yet.

**Acceptance criteria:**

- Build fails clearly on missing required server env in production mode; client has no service key.

**Manual verification:**

- Run typecheck; inspect bundle/client env usage.

**Completion report required:** yes.


## T0022 — Session checkpoint route

**Suggested branch:** `feature/t0022-session-checkpoint-route`  
**Goal:** Implement `/api/sessions/checkpoint` idempotent writes.

**Dependencies:** T0013, T0019, T0021

**Allowed areas:**

- `src/app/api/sessions/checkpoint/**, src/lib/persistence/**, tests/api/**`

**Do not touch:**

- `teacher UI, coach prompt`

**Requirements:**

- Write sessions/events/skill estimates/final state; handle duplicates.

**Non-goals:**

- No auth UI unless required for server identity.

**Acceptance criteria:**

- Duplicate client_event_id does not duplicate event rows.

**Manual verification:**

- Run API tests; POST same checkpoint twice.

**Completion report required:** yes.


## T0023 — Wire real checkpoint queue

**Suggested branch:** `feature/t0023-wire-real-checkpoint-queue`  
**Goal:** Connect lab store checkpoint queue to API route with retry and save status.

**Dependencies:** T0022, T0009

**Allowed areas:**

- `src/lib/persistence/**, src/stores/labStore.ts, src/components/lab/**`

**Do not touch:**

- `teacher UI`

**Requirements:**

- Async checkpoint meaningful events and skills; visible save state.

**Non-goals:**

- No offline IndexedDB unless trivial.

**Acceptance criteria:**

- Lab remains interactive when checkpoint fails; retries possible.

**Manual verification:**

- Simulate network failure; dispatch action; verify state updates.

**Completion report required:** yes.


## T0024 — Auth role scaffold

**Suggested branch:** `feature/t0024-auth-role-scaffold`  
**Goal:** Add Google auth flow and role profile creation.

**Dependencies:** T0021, T0020

**Allowed areas:**

- `src/app/auth/**, src/components/auth/**, src/lib/supabase/**`

**Do not touch:**

- `lab core, coach`

**Requirements:**

- One-click Google sign-in; role selection or default handling; no password flows.

**Non-goals:**

- No required auth for demo/student practice.

**Acceptance criteria:**

- Guest can still open lab; signed-in user gets profile row.

**Manual verification:**

- Test guest path and sign-in path if env available.

**Completion report required:** yes.


## T0025 — Classes and join codes

**Suggested branch:** `feature/t0025-classes-and-join-codes`  
**Goal:** Implement class creation and student join by code.

**Dependencies:** T0024, T0019

**Allowed areas:**

- `src/app/teacher/classes/**, src/app/join/**, src/components/teacher/**, src/lib/classes/**`

**Do not touch:**

- `teacher analytics, lab engine`

**Requirements:**

- Teacher creates class; join code attaches student.

**Non-goals:**

- No detailed dashboard metrics yet.

**Acceptance criteria:**

- Class row and class_members row created.

**Manual verification:**

- Create class; join with test student; inspect rows.

**Completion report required:** yes.


## T0026 — Teacher analytics query layer

**Suggested branch:** `feature/t0026-teacher-analytics-query-layer`  
**Goal:** Implement deterministic analytics functions.

**Dependencies:** T0019, T0022

**Allowed areas:**

- `src/lib/analytics/**, tests/analytics/**`

**Do not touch:**

- `teacher UI styling, LLM summaries`

**Requirements:**

- Compute readiness, skill averages, needs attention, misconceptions.

**Non-goals:**

- No LLM-generated metrics.

**Acceptance criteria:**

- Fixture rows produce expected numbers.

**Manual verification:**

- Run analytics tests with fixed fixture.

**Completion report required:** yes.


## T0027 — Teacher dashboard overview

**Suggested branch:** `feature/t0027-teacher-dashboard-overview`  
**Goal:** Build `/teacher/classes/[classId]` overview using analytics layer.

**Dependencies:** T0026, T0025

**Allowed areas:**

- `src/app/teacher/classes/[classId]/**, src/components/teacher/**`

**Do not touch:**

- `analytics formulas, engine`

**Requirements:**

- Cards for completion/readiness/misconceptions/needs attention.

**Non-goals:**

- No student detail page yet unless linked placeholder.

**Acceptance criteria:**

- Dashboard displays deterministic values from fixture/live rows.

**Manual verification:**

- Open class; compare displayed numbers to fixture.

**Completion report required:** yes.


## T0028 — Teacher roster and student detail

**Suggested branch:** `feature/t0028-teacher-roster-and-student-detail`  
**Goal:** Add roster filters and student evidence detail page.

**Dependencies:** T0027

**Allowed areas:**

- `src/app/teacher/classes/[classId]/students/**, src/components/teacher/**`

**Do not touch:**

- `analytics formulas, coach prompt`

**Requirements:**

- Roster columns; skill cards; evidence timeline; report section placeholder.

**Non-goals:**

- No editable teacher rubrics.

**Acceptance criteria:**

- Click student; evidence events and skills displayed.

**Manual verification:**

- Open seeded student; verify evidence timeline.

**Completion report required:** yes.


## T0029 — Demo seed data

**Suggested branch:** `feature/t0029-demo-seed-data`  
**Goal:** Create schema-valid demo class seed data.

**Dependencies:** T0019, T0026

**Allowed areas:**

- `supabase/seed.sql, src/lib/demo/**, tests/demo/**`

**Do not touch:**

- `production auth logic except demo tagging`

**Requirements:**

- Seed class, students, sessions, events, skill estimates, reports.

**Non-goals:**

- No fake hardcoded dashboard metrics.

**Acceptance criteria:**

- Teacher demo displays seeded rows from DB or local fixture path.

**Manual verification:**

- Run seed; open analytics; verify counts.

**Completion report required:** yes.


## T0030 — Report form UI

**Suggested branch:** `feature/t0030-report-form-ui`  
**Goal:** Add student report route/form for titration.

**Dependencies:** T0009, T0023

**Allowed areas:**

- `src/app/lab/[experimentId]/report/**, src/components/lab/report/**`

**Do not touch:**

- `evaluator API internals`

**Requirements:**

- Procedure, data analysis, concept explanation, sources of error fields.

**Non-goals:**

- No LLM evaluation yet.

**Acceptance criteria:**

- Report form can submit mock and preserve session state.

**Manual verification:**

- Complete lab; open report; submit dummy; no crash.

**Completion report required:** yes.


## T0031 — Evaluator API

**Suggested branch:** `feature/t0031-evaluator-api`  
**Goal:** Implement `/api/evaluate` structured rubric endpoint with validation/mock mode.

**Dependencies:** T0030, T0016

**Allowed areas:**

- `src/app/api/evaluate/**, src/lib/agent/evaluator*.ts, tests/api/**`

**Do not touch:**

- `coach route unless shared schemas, UI beyond response consumption`

**Requirements:**

- Return evidence-linked rubric.

**Non-goals:**

- No adaptive retry UI yet.

**Acceptance criteria:**

- Invalid payload rejected; valid payload returns four rubric dimensions.

**Manual verification:**

- Run API tests; inspect evidenceEventTypes.

**Completion report required:** yes.


## T0032 — Feedback UI

**Suggested branch:** `feature/t0032-feedback-ui`  
**Goal:** Render rubric feedback and recommended retry from evaluator.

**Dependencies:** T0031, T0030

**Allowed areas:**

- `src/components/lab/report/**, src/app/lab/[experimentId]/report/**`

**Do not touch:**

- `engine formulas`

**Requirements:**

- Show scores, feedback, evidence chips, retry CTA if present.

**Non-goals:**

- No retry launch logic yet.

**Acceptance criteria:**

- Submitting report shows rubric feedback.

**Manual verification:**

- Manual submit; inspect UI and console.

**Completion report required:** yes.


## T0033 — Adaptive retry seed validation

**Suggested branch:** `feature/t0033-adaptive-retry-seed-validation`  
**Goal:** Implement retry template selection and seed validation for titration.

**Dependencies:** T0004, T0032

**Allowed areas:**

- `src/experiments/titration/retry.ts, tests/experiments/**`

**Do not touch:**

- `UI beyond simple function tests`

**Requirements:**

- Endpoint-control and burette-conditioning templates produce valid seeds.

**Non-goals:**

- No retry route UI yet.

**Acceptance criteria:**

- Tests validate allowed seeds and reject invalid ones.

**Manual verification:**

- Run retry tests.

**Completion report required:** yes.


## T0034 — Adaptive retry UI flow

**Suggested branch:** `feature/t0034-adaptive-retry-ui-flow`  
**Goal:** Start child retry session from feedback and update evidence.

**Dependencies:** T0033, T0023, T0032

**Allowed areas:**

- `src/app/lab/**, src/components/lab/retry/**, src/stores/labStore.ts`

**Do not touch:**

- `teacher analytics formulas`

**Requirements:**

- Launch retry state; parent_session_id; success feedback.

**Non-goals:**

- No new experiment types.

**Acceptance criteria:**

- Endpoint retry starts near 22 mL and records child session evidence.

**Manual verification:**

- Trigger retry; complete controlled addition; inspect event/model update.

**Completion report required:** yes.


## T0035 — Demo hub and role switcher

**Suggested branch:** `feature/t0035-demo-hub-and-role-switcher`  
**Goal:** Create `/demo` hub and persistent demo bar.

**Dependencies:** T0008

**Allowed areas:**

- `src/app/demo/**, src/components/demo/**`

**Do not touch:**

- `engine, coach, DB unless minimal display`

**Requirements:**

- Hub cards and role switcher; no auth.

**Non-goals:**

- No final seeded student path unless separate ticket.

**Acceptance criteria:**

- Incognito opens `/demo`; switcher visible.

**Manual verification:**

- Open `/demo` incognito; click cards.

**Completion report required:** yes.


## T0036 — Demo student seeded route

**Suggested branch:** `feature/t0036-demo-student-seeded-route`  
**Goal:** Implement `/demo/student` with titration at 22.00 mL.

**Dependencies:** T0035, T0009, T0033

**Allowed areas:**

- `src/app/demo/student/**, src/lib/demo/**, src/components/demo/**`

**Do not touch:**

- `engine formulas`

**Requirements:**

- Use plugin seed to initialize; guided rail.

**Non-goals:**

- No teacher live insertion yet.

**Acceptance criteria:**

- Demo starts at 22.00 mL; mistake trigger under 20 sec.

**Manual verification:**

- Open route; verify state; trigger overshoot.

**Completion report required:** yes.


## T0037 — Demo teacher live insertion

**Suggested branch:** `feature/t0037-demo-teacher-live-insertion`  
**Goal:** Highlight current judge session in demo teacher dashboard.

**Dependencies:** T0036, T0029, T0027, T0023

**Allowed areas:**

- `src/app/demo/teacher/**, src/lib/demo/**, src/components/teacher/**`

**Do not touch:**

- `analytics formulas`

**Requirements:**

- Seeded data plus live judge session row.

**Non-goals:**

- No fake hardcoded metrics.

**Acceptance criteria:**

- After demo student action/checkpoint, teacher demo shows updated row.

**Manual verification:**

- Run student demo; switch teacher; verify row.

**Completion report required:** yes.


## T0038 — Demo technical inspector

**Suggested branch:** `feature/t0038-demo-technical-inspector`  
**Goal:** Build `/demo/technical` panels showing runtime architecture/evidence.

**Dependencies:** T0036, T0018

**Allowed areas:**

- `src/app/demo/technical/**, src/components/demo/**, src/lib/demo/**`

**Do not touch:**

- `engine formulas, coach prompt`

**Requirements:**

- Panels for engine state, semantic events, StudentModel, coach payload, checkpoint, eval table.

**Non-goals:**

- No screenshots pretending to be live data.

**Acceptance criteria:**

- Technical route shows real/current trace if session exists.

**Manual verification:**

- Open after demo student; verify panels populate.

**Completion report required:** yes.


## T0039 — Demo reset route

**Suggested branch:** `feature/t0039-demo-reset-route`  
**Goal:** Implement `/api/demo/reset` and reset UI behavior.

**Dependencies:** T0037

**Allowed areas:**

- `src/app/api/demo/reset/**, src/lib/demo/**, tests/api/**`

**Do not touch:**

- `production data paths except demo filters`

**Requirements:**

- Clear ephemeral judge data; retain seed data.

**Non-goals:**

- No global destructive truncate.

**Acceptance criteria:**

- Reset leaves seeded teacher rows and clears current judge row.

**Manual verification:**

- Run reset; refresh teacher demo; verify seed remains.

**Completion report required:** yes.


## T0040 — Voice token route

**Suggested branch:** `feature/t0040-voice-token-route`  
**Goal:** Create ephemeral realtime/transcription token endpoint.

**Dependencies:** T0017, T0021

**Allowed areas:**

- `src/app/api/realtime-token/**, src/lib/voice/**, tests/api/**`

**Do not touch:**

- `coach route, UI`

**Requirements:**

- Server-side token/config generation; no long-lived keys client-side.

**Non-goals:**

- No mic UI yet.

**Acceptance criteria:**

- Endpoint validates session; returns ephemeral config or mock.

**Manual verification:**

- Run API test; inspect no secret exposure.

**Completion report required:** yes.


## T0041 — Hold to Ask UI

**Suggested branch:** `feature/t0041-hold-to-ask-ui`  
**Goal:** Add mic button/transcript flow using same coach path.

**Dependencies:** T0040, T0017

**Allowed areas:**

- `src/components/coach/VoiceInput.tsx, src/components/coach/**`

**Do not touch:**

- `coach semantics, engine`

**Requirements:**

- Press/hold, transcript visible/editable, fallback to text.

**Non-goals:**

- No raw audio storage.

**Acceptance criteria:**

- Deny mic -> fallback; transcript sends through `/api/coach`.

**Manual verification:**

- Manual browser mic test; deny permission test.

**Completion report required:** yes.


## T0042 — Precipitation engine

**Suggested branch:** `feature/t0042-precipitation-engine`  
**Goal:** Implement deterministic precipitation plugin core and tests.

**Dependencies:** T0006

**Allowed areas:**

- `src/experiments/precipitation/**, tests/experiments/precipitation.test.ts`

**Do not touch:**

- `shared shell, coach, DB`

**Requirements:**

- Solubility lookup, ion decomposition, net ionic output, semantic events.

**Non-goals:**

- No bespoke UI shell.

**Acceptance criteria:**

- Five truth tests pass; events emitted.

**Manual verification:**

- Run precipitation tests; inspect registry independence.

**Completion report required:** yes.


## T0043 — Precipitation UI registration

**Suggested branch:** `feature/t0043-precipitation-ui-registration`  
**Goal:** Expose precipitation through shared experiment UI.

**Dependencies:** T0042, T0008, T0009

**Allowed areas:**

- `src/experiments/precipitation/manifest.ts, src/components/lab/precipitation/**, src/app/lab/**`

**Do not touch:**

- `titration engine, persistence schema`

**Requirements:**

- Use shared lab shell/coach/persistence.

**Non-goals:**

- No duplicate app route architecture.

**Acceptance criteria:**

- Experiment card opens precipitation; basic mix action works.

**Manual verification:**

- Open `/lab/precipitation`; mix solutions; inspect event.

**Completion report required:** yes.


## T0044 — Accessibility pass

**Suggested branch:** `feature/t0044-accessibility-pass`  
**Goal:** Add keyboard/reduced-motion/accessibility support for core lab actions.

**Dependencies:** T0011, T0017, T0032

**Allowed areas:**

- `src/components/**, src/app/**, tests/e2e/**`

**Do not touch:**

- `engine formulas, DB schema`

**Requirements:**

- Keyboard alternatives, labels, reduced motion, focus order.

**Non-goals:**

- No redesign unrelated screens.

**Acceptance criteria:**

- Keyboard can complete core titration actions; reduced motion honored.

**Manual verification:**

- Manual keyboard-only path; run accessibility smoke if available.

**Completion report required:** yes.


## T0045 — Chromebook performance pass

**Suggested branch:** `feature/t0045-chromebook-performance-pass`  
**Goal:** Optimize lab scene and bundle for target hardware.

**Dependencies:** T0011, T0036

**Allowed areas:**

- `src/components/lab/three/**, next.config.*, package analysis config`

**Do not touch:**

- `chemistry formulas, DB`

**Requirements:**

- Low-poly, no postprocessing, lazy-load chunks, performance notes.

**Non-goals:**

- No feature additions.

**Acceptance criteria:**

- Target demo path maintains ~30 FPS on constrained profile or documented best effort.

**Manual verification:**

- Run dev/build; use browser performance tools; record result in repo state.

**Completion report required:** yes.


## T0046 — README and Devpost prep

**Suggested branch:** `feature/t0046-readme-and-devpost-prep`  
**Goal:** Create final public README and demo instructions.

**Dependencies:** T0038, T0045

**Allowed areas:**

- `README.md, docs/demo/**, docs/project/**`

**Do not touch:**

- `application code unless link fixes needed`

**Requirements:**

- Clear problem/solution/architecture/setup/demo/evals sections.

**Non-goals:**

- No app behavior changes.

**Acceptance criteria:**

- A fresh reader can run and demo the project.

**Manual verification:**

- Follow README setup on clean checkout or simulate steps.

**Completion report required:** yes.


## T0047 — Seeded randomized titration session configurations

**Suggested branch:** `feature/t0047-randomized-titration-configs`
**Goal:** Give each titration session a varied but valid analyte/titrant pairing that is deterministic for replay.

**Dependencies:** T0009 and the KI-003 resolution

**Allowed areas:**

- `src/experiments/titration/**, src/app/lab/**, src/stores/**, src/lib/persistence/**, tests/experiments/**, tests/stores/**, tests/e2e/**`

**Do not touch:**

- `chemistry formulas, coach behavior, teacher analytics, database schema`

**Requirements:**

- Add a pure local seeded configuration generator with no LLM calls and no new randomization dependency.
- Generate supported positive analyte volume/concentration and titrant concentration combinations, then validate them with engine-owned equivalence-volume logic.
- Guarantee `0 < equivalenceVolumeML <= buretteCapacityML`, so the endpoint is reachable from the single fill available in KI-003.
- Create a fresh seed for each new session while making the same seed reproduce the exact same configuration for replay and tests.
- Retain the generated seed/configuration in session state and existing persistence/replay payloads without blocking simulation actions.

**Non-goals:**

- No configurations requiring refills or more than one burette capacity; those belong to T0048.
- No changes to pH, equivalence-point, dilution, or grading formulas.
- No client-side chemistry validation duplicated from the engine.

**Acceptance criteria:**

- Representative distinct session seeds produce varied configurations, and identical seeds reproduce identical configurations.
- A deterministic multi-seed test proves every generated configuration has finite positive values and an equivalence volume no greater than its burette capacity.
- Opening two new titration sessions uses independently seeded configurations while replaying a recorded seed restores the original configuration.
- Existing titration truth, semantic-event, persistence, and demo tests remain green.

**Manual verification:**

- Open two new `/lab/titration` sessions; confirm their displayed analyte/titrant amounts can differ and each endpoint fits within the available initial fill.
- Replay one recorded seed; confirm the configuration and deterministic results match the original session.

**Completion report required:** yes.


## T0048 — Custom burette refills and refill-required titrations

**Suggested branch:** `feature/t0048-custom-burette-refills`
**Goal:** Support custom partial burette refills and valid titration sessions whose endpoint requires more than one 50 mL burette fill.

**Dependencies:** T0047, T0023, T0033

**Allowed areas:**

- `src/experiments/titration/**, src/components/lab/titration/**, src/app/lab/**, src/stores/**, src/lib/persistence/**, tests/experiments/**, tests/stores/**, tests/e2e/**`

**Do not touch:**

- `chemistry formulas, coach prompt behavior, teacher metric formulas, unrelated experiment plugins`

**Requirements:**

- Replace the single-fill assumption with an explicit custom-volume fill/refill action that accepts a positive requested volume and never exceeds physical burette capacity.
- Permit multiple full or partial fills during one session, including refilling an empty burette with a student-selected amount.
- Separate cumulative titrant delivered to the flask from the current burette meniscus reading and current available volume.
- Keep pH, curve, equivalence, events, reports, persistence, and replay based on cumulative engine-owned delivery across all fills.
- Extend seeded session generation with valid bounded scenarios where `equivalenceVolumeML > buretteCapacityML`, ensuring at least one refill is required and the configured endpoint remains achievable.
- Emit semantic fill/refill events with requested amount, resulting availability, current reading, and whether the action was an initial fill or refill; routine valid refills remain unflagged.
- Add accessible custom-amount input, full-capacity preset, availability/current-reading feedback, and deterministic validation errors to the 2D controls.

**Non-goals:**

- No freeform fluid physics, infinite reservoir, automatic refill, or changes to chemistry ground truth.
- No refill-related mistake flag unless coach/eval coverage is included in this ticket.

**Acceptance criteria:**

- A configured endpoint above 50 mL can be completed only after a refill, with continuous cumulative titrant and pH-curve state.
- Full and custom partial fills update availability and burette reading correctly without exceeding capacity.
- Meniscus evidence uses the current burette reading, while stoichiometry and ground truth use cumulative delivered volume.
- Seed, checkpoint, replay, and retry tests preserve every fill/refill and reproduce the final state.
- Positive valid fill/refill actions have explicit stay-silent coverage; all prior titration tests remain green.

**Manual verification:**

- Run a seeded refill-required titration, empty the first fill, add a custom partial refill, reach the endpoint above 50 mL total delivery, and verify the displayed current reading, cumulative volume, curve, event history, and replayed state.
- Complete the refill flow using keyboard-only controls and check the browser console.

**Completion report required:** yes.
