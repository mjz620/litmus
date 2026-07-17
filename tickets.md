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
T0100 → T0102 → T0103 (+T0101) = first-person camera and diorama slice
T0102 → T0110, T0103 → T0111, T0110+T0111 → T0112 = focus interaction framework
T0101 → T0120 → T0121 = glassware rebuild
T0111 → T0130, T0120+T0130 → T0131 → T0132 = direct-manipulation titration
T0140 → T0141, T0131 → T0142 = in-lab visual design system (UX overhaul, see docs/handoffs/UX_Overhaul_Handoff.md)
T0200 → T0201/T0202; T0202 → T0203; T0201/T0202/T0203 → T0204 → T0205 → T0206 = Lab Composer contracts and hard validation
T0201/T0202/T0203/T0204/T0206 → T0207 → T0208 = canonical titration workflow and runtime assembly
T0204/T0205/T0206 → T0209/T0210 → T0211 = author–validator–judge loop
T0208/T0211 → T0212 → T0213/T0214 → T0215 = teacher Composer and preview
T0215 → T0216 → T0218; T0215 → T0217 = assignment, coach, and analytics integration
T0206/T0209/T0210/T0211 → T0219; T0213/T0214/T0215/T0217/T0218/T0219 → T0220 = evals and judge-demo polish
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


## T0100 — Pure look-camera math module

**Suggested branch:** `feature/t0100-look-camera-math`
**Goal:** Create the pure math module for first-person edge-pan camera control (dead zone, speed scaling, momentum, limits).

**Dependencies:** None (part of the in-lab UX overhaul; see `docs/handoffs/UX_Overhaul_Handoff.md`)

**Allowed areas:**

- `src/components/lab/three/cameraMath.ts, tests/components/**`

**Do not touch:**

- `chemistry engine, stores, existing scene components`

**Requirements:**

- Pure TypeScript, no three/React imports: `LookState {yaw, pitch, yawVelocity, pitchVelocity}`, `computeEdgePanInput(ndc, config)` (central dead zone ~0.25 NDC radius → zero; smoothstep-eased speed scaling to canvas edge; max ~1.2 rad/s), `stepLook(state, input, dtS, config)` (acceleration toward input, exponential momentum decay, hard clamp to configured limits), `lookToTarget(position, yaw, pitch, distance)`, `isSettled(state, input)`.

**Non-goals:**

- No renderer integration; no changes to CameraRig.

**Acceptance criteria:**

- Unit tests cover dead-zone-zero, monotonic speed with cursor distance, clamp enforcement, and momentum decaying to settled; module has no three imports.

**Manual verification:**

- Run unit tests; inspect imports.

**Completion report required:** yes.


## T0101 — Remove ceiling; sky dome and diorama walls

**Suggested branch:** `feature/t0101-sky-dome-diorama`
**Goal:** Replace the clip-prone ceiling with an open-top diorama: procedural gradient sky dome and lowered trimmed walls.

**Dependencies:** None

**Allowed areas:**

- `src/components/lab/three/ClassroomEnvironment.tsx, src/components/lab/three/SkyDome.tsx, src/components/lab/three/LabScene.tsx, src/components/lab/three/benchLayout.ts, tests/components/**`

**Do not touch:**

- `chemistry engine, stores, camera components, glassware`

**Requirements:**

- Delete the `CeilingLights` component (ceiling slab + emissive panels; they are not real light sources — the three lights in LabScene stay).
- Lower back/left walls to ~1.9 m with a thin contrasting top-edge trim box; add a wall-height constant to `benchLayout.ts`.
- New `SkyDome.tsx`: one BackSide sphere (r≈30, 16×12 segments) with a small ShaderMaterial lerping 2–3 pastel colors by world Y; WebGL1-compatible; keep the existing background color as low-quality fallback.

**Non-goals:**

- No full classroom rebuild, no external skybox assets, no palette overhaul (T0141).

**Acceptance criteria:**

- No geometry above wall height except the dome; e2e suite green including the zero-console-error invariant.

**Manual verification:**

- Open the lab; confirm no void or clipping is visible at any camera angle; check low-quality toggle.

**Completion report required:** yes.


## T0102 — BenchCameraControls and OrbitControls removal

**Suggested branch:** `feature/t0102-bench-camera-controls`
**Goal:** Replace the orbit/scroll camera with a fixed first-person bench viewpoint and port the pose tween to a custom controller.

**Dependencies:** T0100

**Allowed areas:**

- `src/components/lab/three/BenchCameraControls.tsx, src/components/lab/three/CameraRig.tsx (delete), src/components/lab/three/benchLayout.ts, src/components/lab/three/LabScene.tsx, src/components/lab/titration/TitrationScene.tsx (instruction copy only), tests/components/**`

**Do not touch:**

- `chemistry engine, stores, equipment geometry`

**Requirements:**

- `benchLayout.ts`: add `BENCH_VIEW` (fixed standing pose, eye ≈ [0.2, 1.58, 1.55], target over the equipment anchor) and `LOOK_LIMITS` (~±55° yaw, −35°/+20° pitch); delete `ORBIT_LIMITS` and its tests; add invariants for the new constants.
- `BenchCameraControls.tsx` replaces `CameraRig.tsx`: port the 0.65 s easeInOutCubic pose tween and reduced-motion snap verbatim, using `camera.lookAt` instead of OrbitControls target. Fixed camera position in overview; focused `CAMERA_POSES` tween as today. No zoom, orbit, or roll.
- Remove all OrbitControls usage; update the "drag to look around and scroll to zoom" copy.

**Non-goals:**

- No edge-pan input yet (T0103).

**Acceptance criteria:**

- No OrbitControls import remains; `titration-equipment.spec.ts` passes unmodified; reduced motion snaps poses.

**Manual verification:**

- Open the lab; confirm scroll no longer zooms and drag no longer orbits; focus/back tweens still work.

**Completion report required:** yes.


## T0103 — Look mode: activation, edge pan, scroll suppression, keyboard

**Suggested branch:** `feature/t0103-look-mode`
**Goal:** Add click-to-activate cursor edge-panning with strict bounds, scroll containment, release paths, and keyboard/reduced-motion support.

**Dependencies:** T0102

**Allowed areas:**

- `src/components/lab/titration/TitrationScene.tsx, src/stores/labUiStore.ts, src/components/lab/three/BenchCameraControls.tsx, tests/e2e/titration-camera.spec.ts, tests/components/**`

**Do not touch:**

- `chemistry engine, labStore.ts, equipment geometry`

**Requirements:**

- New Zustand `labUiStore.ts`: `{focused, hovered, lookActive}` + setters.
- Activate via `<Canvas onPointerMissed>`; overlay chip with aria-live instructions; `data-look-active` attribute.
- While active: window pointermove → NDC → `computeEdgePanInput`/`stepLook` per frame, chaining `invalidate()` until settled. Release on Escape, click outside the canvas frame, or window blur.
- Scroll containment on the canvas frame only (`{passive:false}` + preventDefault, `touch-action: none`); never lock body overflow.
- Canvas frame `tabIndex=0` + `role="application"`; arrow-key discrete look steps; "Recenter view" button. Reduced motion: step-look only, no momentum or continuous pan.

**Non-goals:**

- No equipment interaction changes; no mobile e2e.

**Acceptance criteria:**

- New e2e: activation/release, `window.scrollY` unchanged over active canvas while page scrolls outside it, arrow-key look, reduced motion via `page.emulateMedia`, zero console errors; existing specs green.

**Manual verification:**

- Full look-around session in Chrome and Safari; wheel over/outside the canvas; Escape and click-outside release; keyboard-only pass.

**Completion report required:** yes.


## T0110 — Interactable wrapper, hover labels, equipment extension

**Suggested branch:** `feature/t0110-interactable-hover`
**Goal:** Standardize 3D hover/click affordances (scale pulse + emissive highlight + label chip) and extend the equipment contract to five interactables.

**Dependencies:** T0102

**Allowed areas:**

- `src/components/lab/titration/equipment.ts, src/components/lab/three/Interactable.tsx, src/components/lab/three/LabScene.tsx, src/components/lab/titration/TitrationScene.tsx, tests/components/equipment.test.ts`

**Do not touch:**

- `chemistry engine, stores, camera controller internals`

**Requirements:**

- `equipment.ts`: add `indicatorShelf` (controlGroups `["indicator"]`) and `washStation` (controlGroups `["prepare"]`); existing three entries unchanged.
- `Interactable.tsx` generalizes the ad-hoc `equipmentHandlers`: pointer events with stopPropagation, cursor management, hover = scale pulse (1.0→1.04) + emissive tint on the existing highlight-shell pattern, drei `<Html>` label chip (aria-hidden). No postprocessing dependencies.

**Non-goals:**

- No new bench geometry yet (T0112); no renames of existing equipment.

**Acceptance criteria:**

- Five equipment-bar buttons (three original names unchanged); hover shows chip + highlight; `equipment.test.ts` extended (not rewritten) and green.

**Manual verification:**

- Hover and keyboard-focus each interactable; confirm labels and highlights.

**Completion report required:** yes.


## T0111 — Selection state to labUiStore

**Suggested branch:** `feature/t0111-selection-to-ui-store`
**Goal:** Move equipment selection/hover from TitrationWorkspace React state into the shared UI store.

**Dependencies:** T0103

**Allowed areas:**

- `src/components/lab/titration/TitrationWorkspace.tsx, src/components/lab/titration/TitrationScene.tsx, src/stores/labUiStore.ts, tests/components/**`

**Do not touch:**

- `labStore.ts, chemistry engine, scene geometry`

**Requirements:**

- `focused`/`hovered` live in `labUiStore`; `data-selected-equipment` reads from `focused` with identical name and semantics; Escape precedence: release look first, then clear focus.

**Non-goals:**

- No behavior changes visible to e2e.

**Acceptance criteria:**

- `titration-equipment.spec.ts` passes unmodified.

**Manual verification:**

- Select/exit each equipment via buttons and 3D clicks; Escape behavior in and out of look mode.

**Completion report required:** yes.


## T0112 — Indicator shelf, wash station, physical indicator selection

**Suggested branch:** `feature/t0112-indicator-shelf-wash-station`
**Goal:** Add physical indicator bottles and a wash station to the bench with focused views and direct bottle-click actions.

**Dependencies:** T0110, T0111

**Allowed areas:**

- `src/components/lab/three/IndicatorShelf.tsx, src/components/lab/three/WashStation.tsx, src/components/lab/three/benchLayout.ts, src/components/lab/three/LabScene.tsx, src/components/lab/titration/useTitrationIntents.ts, src/components/lab/titration/TitrationScene.tsx, tests/components/**, tests/e2e/**`

**Do not touch:**

- `chemistry engine, labStore.ts, existing control groups' HTML behavior`

**Requirements:**

- `benchLayout.ts`: `SHELF` block (riser at back of island, x≈−0.55, z≈0.05), `WASH` block (beside the burette stand), `CAMERA_POSES.indicatorShelf` and `.washStation`.
- `IndicatorShelf.tsx`: three stylized dropper bottles color-capped per indicator; per-bottle hotspots in shelf focus; selected bottle pulled forward.
- `WashStation.tsx`: squeeze wash bottle with CanvasTexture "Distilled water" label, titrant reagent bottle, funnel; existing SinkAndFaucet stays as set dressing.
- `useTitrationIntents.ts` is the only new dispatcher (dispatches stay in `src/components/lab/titration/`): bottle click → `select_indicator`; titrant bottle → `rinse_burette {solvent:"titrant"}`; wash bottle → `rinse_burette {solvent:"water"}`; funnel → `fill_burette`. Scene components report gesture facts only. Update the stale "sole dispatcher" docstrings in `LabScene.tsx` and `equipment.ts`.

**Non-goals:**

- No dispensing gestures (T0130/T0131); HTML `<select>` and prepare buttons keep working unchanged.

**Acceptance criteria:**

- e2e: focus shelf, click a bottle, complete a titration, assert `data-flask-color` changes past endpoint; unit tests for the intents mapping; scene files import no store dispatch.

**Manual verification:**

- Pick each indicator physically and via the dropdown; run rinse/fill from the wash station and from burette-focus HTML controls.

**Completion report required:** yes.


## T0120 — Burette stopcock junction rebuild

**Suggested branch:** `feature/t0120-burette-junction-rebuild`
**Goal:** Eliminate the burette's floating parts by making the tube → stopcock → tip assembly geometrically continuous.

**Dependencies:** T0101

**Allowed areas:**

- `src/components/lab/three/benchLayout.ts, src/components/lab/three/Burette.tsx, tests/components/benchLayout.test.ts`

**Do not touch:**

- `chemistry engine, getBuretteLiquidTopY behavior, graduation span`

**Requirements:**

- Fix the known defect: the 0.042 m stopcock reservation is only spanned by a 0.022 m barrel (~0.010 m air gaps above and below), and the tip cone top (r 0.0075) never meets the tube (r 0.017).
- Re-derive the junction so adjacent segments share exact boundary Y and radius: tube bottom → tapering junction → stopcock housing around the horizontal barrel → tip cone. Tip clearance over the flask and the graduation span are unchanged.
- Keep the PTFE handle a distinct mesh (future T0131 drag target).

**Non-goals:**

- No dispensing interaction; no material/palette changes.

**Acceptance criteria:**

- New continuity invariant tests (no gaps, no radius jumps between adjacent segments); existing benchLayout tests green.

**Manual verification:**

- Inspect the burette from overview, focus, and meniscus poses; confirm one coherent apparatus.

**Completion report required:** yes.


## T0121 — Flask refinement and graduations

**Suggested branch:** `feature/t0121-flask-refinement`
**Goal:** Smooth the Erlenmeyer profile and add readable volume graduations without rebuilding the lathe.

**Dependencies:** T0120 (shares glassware files; keep diffs separable)

**Allowed areas:**

- `src/components/lab/three/ErlenmeyerFlask.tsx, src/components/lab/three/Burette.tsx (minor cleanups), tests/components/**`

**Do not touch:**

- `chemistry engine, liquid color projection, FLASK layout constants used by burette derivation`

**Requirements:**

- The lathe profile is fundamentally sound — do not rebuild. Add 2–3 shoulder interpolation points, a graduation CanvasTexture decal (25/50/75/100 mL, reusing the Burette graduation-texture pattern), and a light stylized-proportion pass.

**Non-goals:**

- No new flask silhouette; no palette work.

**Acceptance criteria:**

- Graduations legible at the flask focus pose; no radius discontinuities; low-quality path unaffected.

**Manual verification:**

- Inspect flask in focus view against light and dark backgrounds at both quality tiers.

**Completion report required:** yes.


## T0130 — Dispense gesture reducer and hold-to-dispense control

**Suggested branch:** `feature/t0130-dispense-gesture`
**Goal:** Add a truthful continuous-dispense gesture that commits segmented typed `add_titrant` actions, with an accessible hold-button front-end.

**Dependencies:** T0111

**Allowed areas:**

- `src/components/lab/titration/useDispenseGesture.ts, src/components/lab/titration/TitrationControls.tsx, tests/components/**, tests/e2e/**`

**Do not touch:**

- `chemistry engine (import in tests only), labStore.ts, tests/experiments/**`

**Requirements:**

- Pure reducer + thin hook. Detents: closed 0, dropwise 0.05, slow 0.2, open 1.0 mL/s (deliberately above the engine's 0.5 mL/s near-endpoint flag threshold).
- While held: `pendingML += rate × dt` from `performance.now()` deltas. Commit `add_titrant {volumeML, durationS}` when pendingML ≥ 0.5, on detent change (~100 ms debounce), and on gesture end. Every termination path (pointer-up, Escape, blur, pointercancel, visibilitychange) closes the valve and commits.
- Guards before dispatch: clamp to available (auto-close at empty), drop residues < 0.005 mL, never dispatch durationS ≤ 0. Single click at dropwise = one drop `{0.05 mL, 1 s}`.
- Deliver group gains a detent selector + "Hold to dispense" button (pointer and Space-key hold, auto-repeat guarded), driven by the same hook. The volume/duration form stays.

**Non-goals:**

- No 3D drag yet (T0131).

**Acceptance criteria:**

- Reducer tests: volume conservation, per-segment rate equals detent, clamping, closure on every end path; integration test feeds a fast-near-endpoint timeline into the real `titration.step` and asserts `flow_rate_high_near_endpoint`; e2e hold flow decreases `data-burette-fill`; `titration.test.ts` untouched and green.

**Manual verification:**

- Hold at each detent; verify live color/pH updates mid-hold and honest flags near the endpoint on the dev route.

**Completion report required:** yes.


## T0131 — 3D stopcock drag and stream animation

**Suggested branch:** `feature/t0131-stopcock-drag`
**Goal:** Make the physical stopcock handle draggable across the dispense detents with a visible titrant stream and flask ripple.

**Dependencies:** T0120, T0130

**Allowed areas:**

- `src/components/lab/three/Burette.tsx, src/components/lab/three/ErlenmeyerFlask.tsx, src/components/lab/titration/TitrationScene.tsx, tests/components/**`

**Do not touch:**

- `chemistry engine, useDispenseGesture reducer semantics`

**Requirements:**

- Handle drag via `setPointerCapture`, rotating across the same reducer detents; falling stream (thin cylinder) + drip + flask ripple while dispensing; `data-dispensing` attribute and pending-mL readout; animation invalidates only while dispensing, then the demand loop goes cold.
- pointercancel/blur closes and commits.

**Non-goals:**

- Do not e2e the canvas drag (flaky under swiftshader) — reducer + HTML hold path cover the logic; manual verification instead.

**Acceptance criteria:**

- Drag traverses detents; every interruption path closes the valve; demand loop idle when closed; existing e2e green.

**Manual verification:**

- Full drag-driven titration in burette focus; interrupt with Escape/blur/tab-switch mid-pour.

**Completion report required:** yes.


## T0132 — Contextual prompts and wide burette focus pose

**Suggested branch:** `feature/t0132-prompts-and-burette-pose`
**Goal:** Re-frame the burette focus view to show tube, graduations, stopcock, and flask simultaneously, and add stage-driven contextual prompts.

**Dependencies:** T0130 (prompts reference dispensing); pose work depends only on T0102

**Allowed areas:**

- `src/components/lab/three/benchLayout.ts, src/components/lab/titration/TitrationScene.tsx, tests/components/benchLayout.test.ts`

**Do not touch:**

- `procedureStage.ts logic, chemistry engine`

**Requirements:**

- Re-author `CAMERA_POSES.burette` (≈ position [BURETTE.x+0.55, 1.32, BURETTE.z+1.05]) so tube top (≈1.72) and flask base (≈0.93) both fit the 42° FOV; add a frustum-height invariant test.
- Slim aria-live prompt strip over the canvas driven by `getProcedureStage`, suggesting the next physical step; near the endpoint (from state already available — no new chemistry) suggest switching to dropwise.

**Non-goals:**

- No stage-machine changes.

**Acceptance criteria:**

- Pose invariant test green; prompts follow the stage machine; students can watch the flask color while reading burette volume.

**Manual verification:**

- Run a titration in burette focus; confirm color change and volume are simultaneously visible.

**Completion report required:** yes.


## T0140 — In-lab design-system specification

**Suggested branch:** `feature/t0140-design-system-spec`
**Goal:** Author the design-system document unifying the app around a whimsical, colorful, scientifically legible educational-game aesthetic.

**Dependencies:** None (doc-only; informed by phases 1–4 outcomes)

**Allowed areas:**

- `docs/design-system.md`

**Do not touch:**

- `any code`

**Requirements:**

- Cover: palette (near-black bench, warm wood, saturated indicator accents, pastel sky); low-poly modeling and shape-language conventions; material rules (roughness ~0.8, metalness on fixtures only); lighting/shadow plan (evaluate one shadow-casting key light with castShadow limited to glassware, decision recorded with a perf measurement); hover/selection states; typography and UI tokens (buttons, cards, tooltips, contextual menus); camera-transition and animation timing table; synthesized-sound opportunities; interactable-affordance rules; measurement-legibility rules (graduation contrast, meniscus ring). Audience: middle/high-school students — playful without being childish.

**Non-goals:**

- No code changes; application is T0141.

**Acceptance criteria:**

- Document reviewed by project owner; every rule is concrete enough for T0141 to implement without interpretation.

**Manual verification:**

- Read-through against reference images and current scene.

**Completion report required:** yes.


## T0141 — Apply palette, materials, and lighting

**Suggested branch:** `feature/t0141-apply-design-system`
**Goal:** Apply the T0140 design system across the 3D scene and lab UI.

**Dependencies:** T0140, T0103, T0112, T0121, T0132

**Allowed areas:**

- `src/components/lab/three/labPalette.ts, src/components/lab/three/**, src/components/lab/**/*.module.css, src/app/**/*.css, tests/components/**`

**Do not touch:**

- `chemistry engine, stores, action semantics, test data attributes`

**Requirements:**

- New `labPalette.ts` is the only place 3D hex colors live; material/lighting pass over ClassroomEnvironment, glassMaterials, Burette, ErlenmeyerFlask, SkyDome; CSS token pass over lab modules; palette unit test with a luminance-ratio helper asserting graduation-vs-liquid legibility.

**Non-goals:**

- No geometry or interaction changes.

**Acceptance criteria:**

- Both quality tiers conform to the spec; full e2e suite green including zero-console-error invariant.

**Manual verification:**

- Side-by-side against reference images; legibility check of all measurements at both quality tiers.

**Completion report required:** yes.


## T0142 — Procedural sound (optional)

**Suggested branch:** `feature/t0142-procedural-sound`
**Goal:** Add synthesized, gesture-gated sound feedback (drip, valve click, endpoint chime) with a mute toggle.

**Dependencies:** T0131

**Allowed areas:**

- `src/components/lab/three/labSounds.ts, src/components/lab/titration/**, tests/components/**`

**Do not touch:**

- `chemistry engine, stores`

**Requirements:**

- WebAudio synthesis only (no audio files): drip = filtered noise burst, valve = short click, endpoint = two-note chime; sounds trigger only from user gestures (no autoplay violations); accessible mute toggle; respects reduced-motion/quiet preferences where sensible.

**Non-goals:**

- No music, no external audio assets.

**Acceptance criteria:**

- Sounds fire on the corresponding gestures and never before first user interaction; mute persists for the session; e2e suite unaffected.

**Manual verification:**

- Complete a titration with sound on and muted; check autoplay console warnings.

**Completion report required:** yes.


# Lab Composer / Composable Workflow Architecture

These tickets implement **AI-authored lab workflows over verified deterministic lab primitives**. They do not authorize arbitrary chemistry generation. Complete one ticket per branch/run, preserve the existing titration truth layer and semantic event contract, and follow the Lab Composer invariants in `AGENTS.md`.

## T0200 — Lab Composer docs and schema alignment freeze

**Suggested branch:** `docs/t0200-lab-composer-alignment`

**Goal:** Review and freeze the Phase 0 vocabulary, canonical IDs, field ownership, support statuses, and ticket dependencies before implementation begins.

**Dependencies:** None; uses the Lab Composer documentation set as input.

**Allowed areas:** `AGENTS.md`, `README.md`, `tickets.md`, `docs/**`.

**Do not touch:** `src/**`, `tests/**`, `supabase/**`, package/dependency files, existing chemistry formulas or application behavior.

**Requirements:** Cross-check product, runtime, schema, component/skill registry, agent, demo, eval, roadmap, and current-state docs; resolve naming contradictions; keep legacy skill aliases explicit; label planned IDs/examples as non-runnable until implemented.

**Non-goals:** No runtime types, Zod schemas, registry code, agent routes, UI, or database work.

**Acceptance criteria:** Recommended reading order is complete; all required final statuses and agent/validator boundaries agree; `rg` finds no claim of arbitrary supported chemistry; documentation-only diff is reviewable.

**Manual verification:** Follow `docs/README.md` in order; compare all `WorkflowSupportStatus` values and legacy aliases; inspect `git diff -- docs AGENTS.md tickets.md README.md`.

**Completion report instructions:** Use the exact `AGENTS.md` completion report and list every created/modified doc, consistency decision, open question, and commands run.

## T0201 — Component registry types and titration component entries

**Suggested branch:** `feature/t0201-component-registry-types`

**Goal:** Implement strict deterministic component-registry types and verified entries for the currently implemented titration apparatus only.

**Dependencies:** T0200.

**Allowed areas:** `src/lab-workflows/registries/components/**`, `tests/lab-workflows/registries/components/**`.

**Do not touch:** `src/experiments/titration/**` formulas/events, React/Three UI, agent routes, Supabase, precipitation/calorimetry runtime entries.

**Requirements:** Exact versioned IDs; state/action/event/precision/visual-adapter/safety/family/performance metadata; unknown-ID error; entries for existing burette, Erlenmeyer flask, reagent bottle, and indicator bottle only where current behavior is truly backed; no chemistry formulas.

**Non-goals:** No visual refactor, action adapters, workflow schema, validator, future balance/calorimeter/Bunsen availability, or dynamic registry writes.

**Acceptance criteria:** Strict TypeScript compiles; lookup/list APIs are deterministic/read-only; duplicate/unknown IDs fail in tests; entries do not claim unsupported actions/components.

**Manual verification:** Inspect imports for React/Three/OpenAI/Supabase/browser APIs; compare each implemented entry with current titration UI/actions; run focused tests and typecheck.

**Completion report instructions:** Use the `AGENTS.md` report; enumerate implemented versus intentionally planned component IDs and test commands/results.

## T0202 — Supporting action, reagent, engine, event-flag, and safety registry types

**Suggested branch:** `feature/t0202-workflow-supporting-registries`

**Goal:** Implement minimal read-only registry contracts/data required to describe the existing titration engine and its verified workflow capabilities.

**Dependencies:** T0200; coordinate exact component roles with T0201.

**Allowed areas:** `src/lab-workflows/registries/{actions,reagents,engines,event-flags,safety,configurations}/**`, matching `tests/lab-workflows/registries/**`.

**Do not touch:** Chemistry/UI/agent/persistence code; precipitation/calorimetry as verified engines; runtime assembly; new experiment actions or flags.

**Requirements:** Exact IDs and typed lookups; map only existing titration actions, reagent/config profiles, current flags/events, seed capability, and safety notices; stable unknown/duplicate errors; positive stay-silent evidence metadata.

**Non-goals:** No validator, schemas beyond entry contracts, arbitrary concentrations, safety inference, action execution, or fuzzy lookup.

**Acceptance criteria:** All cross-references resolve in tests; current `flow_rate_high_near_endpoint`, `endpoint_overshoot`, `meniscus_misread`, and `burette_not_conditioned` capabilities are represented accurately; planned families remain unavailable.

**Manual verification:** Compare registry entries to `TitrationAction` and emitted events; run focused tests/typecheck; verify no LLM or browser imports.

**Completion report instructions:** Use the `AGENTS.md` report; list supported IDs, excluded/planned capabilities, compatibility assertions, and commands/results.

## T0203 — Skill registry types and legacy alias resolution

**Suggested branch:** `feature/t0203-skill-registry-types`

**Goal:** Implement canonical pedagogical skill entries and deterministic legacy alias resolution without rewriting historical event data.

**Dependencies:** T0200 and capability shapes from T0202.

**Allowed areas:** `src/lab-workflows/registries/skills/**`, `tests/lab-workflows/registries/skills/**`.

**Do not touch:** Existing raw titration events/skill rows, analytics UI, agent routes, chemistry engines, database migrations.

**Requirements:** Canonical entries from `skill-registry.md`; availability derived from verified family capability; aliases for `volumetric_reading`, `sig_figs`, `net_ionic_equation`, and `sign_convention`; exact canonical output for authors.

**Non-goals:** No historical data rewrite, embeddings/search service, LLM extraction, teacher metrics migration, or claiming planned skills are runnable.

**Acceptance criteria:** Canonical and alias lookup tests pass; unknown/ambiguous skills are explicit; titration availability is accurate; precipitation/calorimetry remain planned until engine support.

**Manual verification:** Query all documented canonical IDs and aliases in focused tests; inspect availability output; run typecheck.

**Completion report instructions:** Use the `AGENTS.md` report; include alias decisions, verified/planned skill counts, and test commands/results.

## T0204 — `LabWorkflowSpec` Zod schema and inferred TypeScript types

**Suggested branch:** `feature/t0204-lab-workflow-zod-schema`

**Goal:** Implement the versioned schema/types and strict parsing boundary documented in `lab-workflow-schema.md`.

**Dependencies:** T0201, T0202, T0203.

**Allowed areas:** `src/lab-workflows/schema/**`, `tests/lab-workflows/schema/**`.

**Do not touch:** Validators beyond structural parse helpers, runtime assembler, agents/routes/UI, chemistry engine, persistence.

**Requirements:** Strict Zod objects; enums/statuses; bounds for obvious structural values; draft validation fields present; reject unknown keys/functions/non-JSON data; export inferred types without parallel handwritten drift.

**Non-goals:** No registry resolution, compatibility/safety decisions, canonical hashing, auto-repair, or runtime execution.

**Acceptance criteria:** Full valid fixture parses; malformed/extra/invalid enum/range fixtures fail with stable paths; TypeScript types are inferred; draft vs validator-owned fields are documented/tested at trust boundaries.

**Manual verification:** Run schema tests/typecheck; inspect public exports and ensure application code cannot mistake LLM-supplied validation fields for trusted output.

**Completion report instructions:** Use the `AGENTS.md` report; list schema deviations/clarifications, fixtures, and commands/results.

## T0205 — Pure hard workflow validator

**Suggested branch:** `feature/t0205-hard-workflow-validator`

**Goal:** Implement deterministic registry, compatibility, safety, event-evidence, reachability, support-status, and canonical-hash validation.

**Dependencies:** T0201–T0204.

**Allowed areas:** `src/lab-workflows/validation/**`, `tests/lab-workflows/validation/validator-core.test.ts`.

**Do not touch:** LLM/agent code, UI, runtime assembler, chemistry formulas/events, Supabase, auto-correction.

**Requirements:** Pure injected registry snapshots/time; stable issue codes/paths/order; exact ID resolution; component/action/reagent/engine/event/safety checks; step prerequisites/completion reachability; authoritative status/eligibility; hash excludes validator/judge artifacts.

**Non-goals:** No seed action replay (covered with integration tests), pedagogical judging, network calls, fuzzy fallback, or mutation of input.

**Acceptance criteria:** Canonical structural fixture passes; each validation pass has positive/negative focused coverage; safety precedence and judge non-authority are tested; identical inputs produce identical decision/hash.

**Manual verification:** Run focused validator tests repeatedly; inspect dependency graph for purity; compare two identical results excluding injected time.

**Completion report instructions:** Use the `AGENTS.md` report; enumerate validator passes/issue codes, known deferred checks, and commands/results.

## T0206 — Workflow validation mutation and seed-replay tests

**Suggested branch:** `test/t0206-workflow-validation-tests`

**Goal:** Build comprehensive hard-validation fixtures, one-field mutation cases, and the first deterministic titration seed replay gate.

**Dependencies:** T0204, T0205, existing titration engine/seed tests; T0201–T0203 fixtures.

**Allowed areas:** `tests/lab-workflows/validation/**`, `tests/lab-workflows/fixtures/**`, minimal test-only helpers under `src/lab-workflows/testing/**`.

**Do not touch:** Production validator semantics unless a separately reported blocker is unavoidable, agents/UI/persistence, chemistry formulas/events.

**Requirements:** Invalid IDs for every registry category; incompatible action/reagent/flag; restricted component/unsafe mix; stale validation/hash; judge-approve override attempt; deterministic seed replay; positive controlled-addition stay-silent case.

**Non-goals:** No UI/E2E, production assembler, model calls, or new family support.

**Acceptance criteria:** Named hard eval fixtures pass at 100%; failures assert code/path/status/eligibility; canonical action sequence produces expected titration events and terminal observable state.

**Manual verification:** Run focused suite twice; review mutation matrix against `lab-composer-evals.md`; run full unit tests/typecheck.

**Completion report instructions:** Use the `AGENTS.md` report; provide fixture matrix coverage, seed/replay evidence, and commands/results.

## T0207 — Canonical titration workflow migration

**Suggested branch:** `feature/t0207-titration-workflow-spec`

**Goal:** Encode the current supported titration pre-lab as a checked-in validated seed-spec source and prove engine/event parity.

**Dependencies:** T0206.

**Allowed areas:** `src/lab-workflows/seeds/titration/**`, `tests/lab-workflows/seeds/**`, documentation clarifications if contract mismatch is found.

**Do not touch:** Titration formulas/event meanings/UI behavior, authoring routes, assembler, persistence, precipitation/calorimetry.

**Requirements:** Exact verified IDs only; current engine/config/seed/action/event flags; endpoint/meniscus rubric/triggers/retry; canonical validation generated in test/runtime, not trusted from hand-authored fields.

**Non-goals:** No AI-generated variants, new actions/skills/flags, component extraction, or student route switch.

**Acceptance criteria:** Seed parses/validates runnable; parity test runs the workflow action path through existing `step()` and matches semantic events/observable state; unknown versions fail.

**Manual verification:** Inspect spec against current static flow; run seed, validator, titration, and typecheck suites.

**Completion report instructions:** Use the `AGENTS.md` report; record exact pinned versions/hash behavior, parity evidence, and commands/results.

## T0208 — Titration runtime assembler MVP

**Suggested branch:** `feature/t0208-titration-runtime-assembler`

**Goal:** Assemble only a validated runnable titration workflow into existing engine and component/action adapters.

**Dependencies:** T0207.

**Allowed areas:** `src/lab-workflows/runtime/**`, narrow titration adapter files under `src/lab-workflows/adapters/titration/**`, `tests/lab-workflows/runtime/**`.

**Do not touch:** Chemistry formulas/events, broad 3D refactor, agents/UI/routes/persistence, multi-engine/branching workflows.

**Requirements:** Require matching runnable validation/hash/snapshots; exact adapter resolution; engine-owned initial state; step/action allow-list; all meaningful actions call `ExperimentDefinition.step()`; forward semantic events unchanged.

**Non-goals:** No generated code execution, fuzzy fallback, chemistry in assembler/components, dynamic imports from specs, or AI/network during simulation.

**Acceptance criteria:** Canonical seed assembles/completes/replays; invalid/stale/non-runnable inputs fail closed; disallowed action is rejected; event sequence matches T0207; test demonstrates simulation network independence.

**Manual verification:** Run runtime/seed/titration/full unit tests and typecheck; inspect imports and action call path; profile no new continuous work.

**Completion report instructions:** Use the `AGENTS.md` report; describe trust gates, adapter scope, replay result, performance risk, and commands/results.

## T0209 — Lab Authoring Agent API route

**Suggested branch:** `feature/t0209-lab-authoring-agent-route`

**Goal:** Add a server-only, rate-limited structured-output route that authors unvalidated workflow drafts using read-only registry tool contracts.

**Dependencies:** T0204–T0206; registries available from T0201–T0203.

**Allowed areas:** `src/lib/agent/lab-authoring/**`, `src/app/api/lab-composer/author/**`, `tests/ai/lab-composer/authoring/**`.

**Do not touch:** Runtime assembler/engine/UI/persistence, judge route, validator authority, client secrets.

**Requirements:** Request/output schemas; exact tool allow-list; prompt/version metadata; unvalidated output status; unsupported/partial/safety language; no chain-of-thought; request/cost/time limits; deterministic fallback error shape.

**Non-goals:** No judge calls, revision loop, auto-assignment, registry writes, chemistry truth, or arbitrary tool execution.

**Acceptance criteria:** Supported seed returns a schema-valid draft referencing tool-returned IDs; aspirin/vague/unknown capability seeds remain non-runnable; prompt injection cannot add IDs/tools; secrets remain server-only.

**Manual verification:** Run mocked route/eval tests; inspect client bundle/import graph; send hero and unsupported requests locally and inspect structured output.

**Completion report instructions:** Use the `AGENTS.md` report; include prompt/tool/model versions, unsupported cases, security/limit behavior, and commands/results.

## T0210 — Lab Workflow Judge Agent API route

**Suggested branch:** `feature/t0210-workflow-judge-agent-route`

**Goal:** Add a separate server-only structured critique route bound to an eligible workflow and matching hard-validation hash.

**Dependencies:** T0204–T0206.

**Allowed areas:** `src/lib/agent/lab-workflow-judge/**`, `src/app/api/lab-composer/judge/**`, `tests/ai/lab-composer/judge/**`.

**Do not touch:** Author route, runtime/engine/UI/persistence, validator decisions, registry writes.

**Requirements:** Eight scoring dimensions; structured issue severities/recommendations; exact path/evidence expectations; reject stale hash; policy preventing approval from conferring runtime eligibility; no chemistry calculations/IDs invention/chain-of-thought.

**Non-goals:** No automatic revision, hard safety/runnability evaluation, simulation mutation, or generic debate UI.

**Acceptance criteria:** Seeded rubric/trigger/clarity defects produce useful structured issues; good workflow can approve only alongside runnable validation; non-runnable/stale inputs cannot enable preview; bad-critique evals are rejected/flagged.

**Manual verification:** Run mocked route/eval tests; submit good/bad hash fixtures; inspect outputs for path specificity and prohibited chemistry claims.

**Completion report instructions:** Use the `AGENTS.md` report; list judge prompt/model/schema versions, authority guards, eval outcomes, and commands/results.

## T0211 — Author–validator–judge revision loop

**Suggested branch:** `feature/t0211-composer-revision-loop`

**Goal:** Orchestrate bounded generation, validation, eligible critique, revision, revalidation, and final status as a testable server workflow.

**Dependencies:** T0209, T0210.

**Allowed areas:** `src/lib/agent/lab-composer/**`, `src/app/api/lab-composer/generate/**`, `tests/ai/lab-composer/orchestration/**`.

**Do not touch:** Teacher UI/runtime engine/persistence/dashboard, individual validator semantics, unlimited background jobs.

**Requirements:** Initial + maximum two revisions; validator errors prioritized; safety/unsupported early stop; stale validation/critique discarded on every revision; per-call/total latency and cost caps; final trace without chain-of-thought.

**Non-goals:** No autonomous assignment, open-ended tool loop, hidden retries beyond cap, or judge override.

**Acceptance criteria:** Tests cover first-pass approval, validator repair, judge repair, unresolved limit, safety rejection, unsupported, tool/model failure, and hash lineage; final runtime eligibility always equals hard result.

**Manual verification:** Run deterministic mocked orchestration cases; inspect call counts/hash transitions; exercise hero prompt with configured service/fallback.

**Completion report instructions:** Use the `AGENTS.md` report; include state machine, revision/call limits, trace examples, and commands/results.

## T0212 — Teacher Lab Composer prompt and workflow review UI

**Suggested branch:** `feature/t0212-teacher-lab-composer-ui`

**Goal:** Build the teacher-facing prompt, generation progress, structured workflow review, editable-field, regenerate, and reject surface.

**Dependencies:** T0211; may use canonical seed fallback for development.

**Allowed areas:** `src/app/teacher/lab-composer/**`, `src/components/teacher/lab-composer/**`, UI tests/styles.

**Do not touch:** Chemistry/runtime validator logic, agent prompt internals, persistence/dashboard, student lab components beyond navigation.

**Requirements:** Hero prefill option; show skills/family/components/reagents/steps/triggers/rubric/retry/status; teacher edits only marked fields; edits reset visible validation; unsupported results keep Preview/Assign disabled; accessible loading/errors.

**Non-goals:** No validator/judge detail panels (separate tickets), preview, assignment, freeform registry editing, or mobile-first 3D redesign.

**Acceptance criteria:** Component/UI tests cover prompt, structured result, edit invalidation, regenerate/reject, unsupported/failed/loading states; no hidden raw chain-of-thought; Chromebook viewport remains usable.

**Manual verification:** Generate hero/unsupported result; edit title and a structural field; confirm validation reset/controls disabled; keyboard/screen-size check.

**Completion report instructions:** Use the `AGENTS.md` report; include states/screens manually checked, accessibility notes, and commands/results.

## T0213 — Deterministic validator result panel

**Suggested branch:** `feature/t0213-validator-result-panel`

**Goal:** Add an authoritative, accessible panel for final support status, eligibility, passed checks, warnings/errors, issue paths, and versions/hash.

**Dependencies:** T0212 and T0205 result contract.

**Allowed areas:** Lab Composer teacher components/styles/tests for the validator panel only.

**Do not touch:** Validator logic, judge panel, runtime/chemistry, persistence, agent routes.

**Requirements:** Distinguish warnings/errors/safety; expose issue code/path/suggestions; label deterministic authority; show stale/unvalidated state; never infer pass from empty issue array on client.

**Non-goals:** No auto-fix, validation computation in UI, judge scoring, preview implementation.

**Acceptance criteria:** Rendering tests cover all statuses, safety rejection, stale result, long issue list, and accessibility; Preview/Assign enablement consumes server eligibility rather than panel heuristics.

**Manual verification:** Inspect valid/partial/unsupported/safety fixtures at Chromebook viewport and by keyboard; confirm hash/version detail is expandable.

**Completion report instructions:** Use the `AGENTS.md` report; list status fixtures, accessibility checks, and commands/results.

## T0214 — Advisory Judge Agent critique panel

**Suggested branch:** `feature/t0214-judge-critique-panel`

**Goal:** Display hash-bound Judge Agent scores, issues, strengths, recommendation, and revision history without conflating them with validation.

**Dependencies:** T0212, T0210; visual coexistence with T0213.

**Allowed areas:** Lab Composer teacher components/styles/tests for the critique panel only.

**Do not touch:** Judge prompt/route semantics, validator/runtime/chemistry, persistence.

**Requirements:** Advisory label; eight dimensions; blocker/medium/low; path-linked revisions; stale-hash state; before/after summary; no chain-of-thought.

**Non-goals:** No automatic revision button behavior beyond existing regenerate callback, support-status mutation, or chemistry explanation.

**Acceptance criteria:** Rendering tests cover approve/revise/partial/reject, stale/missing critique, long text, and coexistence with validator failure; UI never enables preview from judge approval alone.

**Manual verification:** View seeded critique and revision at Chromebook viewport; keyboard through expandable items; compare authority labels with validator panel.

**Completion report instructions:** Use the `AGENTS.md` report; include states/accessibility/manual comparisons and commands/results.

## T0215 — Preview-as-student flow

**Suggested branch:** `feature/t0215-composer-student-preview`

**Goal:** Launch an isolated student preview from the exact validated runnable workflow using the T0208 assembler and normal lab/coach paths.

**Dependencies:** T0208, T0212–T0214.

**Allowed areas:** `src/app/teacher/lab-composer/**`, narrow preview/session routing under `src/app/lab/**`, `src/lib/demo/**`, preview integration/e2e tests.

**Do not touch:** Chemistry formulas/events, assignment persistence, teacher analytics, alternate preview engine, non-runnable bypass.

**Requirements:** Require current runnable status/hash/snapshots; preview-scoped session label/isolation; exact workflow version; back-to-composer; edit invalidates launch; no production metric pollution.

**Non-goals:** No class assignment, arbitrary workflow fork, separate coach/engine, or preview of partial/unsupported drafts.

**Acceptance criteria:** Hero preview loads/completes; stale/non-runnable URLs fail closed; intentional endpoint error emits current engine flags; reload preserves/reconstructs pinned preview; no console errors.

**Manual verification:** Generate hero, preview, overshoot, return/edit, confirm old preview eligibility is gone; run e2e and Chromebook viewport check.

**Completion report instructions:** Use the `AGENTS.md` report; document trust/isolation gates, event evidence, e2e/manual results, and commands.

## T0216 — Immutable workflow assignment persistence

**Suggested branch:** `feature/t0216-composer-assignment-persistence`

**Goal:** Persist approved workflow versions/validation provenance and attach them idempotently to class assignments/sessions.

**Dependencies:** T0215 plus persistence/auth foundation tickets.

**Allowed areas:** `supabase/**`, `src/lib/supabase/**`, `src/lib/persistence/**`, `src/app/api/sessions/**`, dedicated assignment route/tests.

**Do not touch:** Chemistry/validator/agent logic, teacher metrics formulas, student UI except minimal typed client contract.

**Requirements:** Immutable spec/version/hash; validator/registry/engine/rubric versions; teacher approval; runnable/hash gate server-side; idempotency; RLS; demo/guest isolation; historical replay linkage.

**Non-goals:** No mutable workflow overwrite, arbitrary client JSON trust, analytics UI, or automatic approval.

**Acceptance criteria:** Migration/API/RLS/idempotency tests pass; non-runnable/stale assignment rejected; duplicate request returns same assignment; session references exact workflow version.

**Manual verification:** Assign hero twice, inspect rows/constraints, attempt unauthorized/non-runnable assignment, open linked session; run DB/route tests.

**Completion report instructions:** Use the `AGENTS.md` report; include migration/RLS/idempotency/replay details, manual queries (redacted), and commands/results.

## T0217 — Student Coach compatibility with composed workflows

**Suggested branch:** `feature/t0217-composer-coach-compatibility`

**Goal:** Pass validated workflow step/skill/trigger policy into the existing Student Coach without changing engine truth or synchronous dispatch.

**Dependencies:** T0215 and existing coach trigger/API tickets.

**Allowed areas:** `src/lib/agent/**`, `src/app/api/coach/**`, narrow workflow context adapters, `tests/coach/**`, composer coach evals.

**Do not touch:** Chemistry formulas/events, validator status, author/judge behavior, teacher dashboard, simulation mutation.

**Requirements:** Registered trigger IDs only; event-grounded context; workflow/rubric version; direct questions; cooldown/hint levels; positive controlled-addition stay-silent; validated retry-template request only.

**Non-goals:** No chemistry calculation, unconstrained chat, workflow editing, synchronous LLM dependency, or new flags.

**Acceptance criteria:** High-flow/overshoot/meniscus fixtures trigger relevant responses; correct dropwise success stays silent; unknown trigger rejected; simulation proceeds when coach is slow/down; existing coach tests remain green.

**Manual verification:** Preview hero error/success paths with network delay/failure; inspect event linkage and no state mutation; run coach eval/unit/e2e tests.

**Completion report instructions:** Use the `AGENTS.md` report; include trigger/silent-case evidence, failure behavior, and commands/results.

## T0218 — Teacher dashboard workflow-version integration

**Suggested branch:** `feature/t0218-composer-teacher-analytics`

**Goal:** Show deterministic assignment/workflow provenance and canonical skill readiness for composed workflow sessions.

**Dependencies:** T0216, T0217, existing teacher analytics/dashboard foundation.

**Allowed areas:** `src/app/teacher/**`, `src/components/teacher/**`, `src/lib/analytics/**`, analytics tests.

**Do not touch:** Chemistry/agent prompts/validator, raw-event rewriting, LLM numeric metrics, unrelated dashboard redesign.

**Requirements:** Workflow title/version/hash reference; assignment grouping; canonical/legacy skill alias resolution; event/coach/report provenance; preview/demo labels; deterministic aggregates only.

**Non-goals:** No LLM summaries that create numbers, new readiness formula without ticket, or mutation of historical evidence.

**Acceptance criteria:** Seeded and live composer sessions produce correct counts/readiness/misconceptions; aliases do not double-count; wrong class/workflow excluded; analytics unit/query/UI tests pass.

**Manual verification:** Complete/preview hero mistake then inspect teacher row/detail; compare displayed numbers to persisted fixtures/query output; run focused/full tests.

**Completion report instructions:** Use the `AGENTS.md` report; include deterministic formulas/provenance, alias behavior, manual comparison, and commands/results.

## T0219 — Lab Composer eval harness

**Suggested branch:** `test/t0219-lab-composer-eval-harness`

**Goal:** Implement the versioned hard/author/judge/revision seed matrix and release-gate reporting from `lab-composer-evals.md`.

**Dependencies:** T0206, T0209–T0211; integrate later runtime/coach fixtures without expanding this ticket.

**Allowed areas:** `tests/evaluation/lab-composer/**`, `src/lib/evaluation/lab-composer/**`, eval scripts/fixtures and minimal docs.

**Do not touch:** Production chemistry/validator/agent semantics, UI, persistence, unrelated CI architecture.

**Requirements:** Pass/planned/unsupported/unsafe prompts; schema/ID/component/engine/safety/flag/replay checks; skill/trigger/rubric/hint/false-confidence/revision metrics; pinned versions; no hidden retries/cherry-picking.

**Non-goals:** No production auto-tuning, judge-as-hard-validator, new family implementation, or external benchmark dependency.

**Acceptance criteria:** Named hard gates are 100%; false runnable claims are zero; report separates deterministic from model metrics and before/after repair; aspirin/gas/electroplating/open-flame/unsafe/vague prompts classify correctly.

**Manual verification:** Run harness twice; inspect JSON/table artifacts and failed-case diagnostics; review a sample of author/judge outputs against labels.

**Completion report instructions:** Use the `AGENTS.md` report; include dataset/version/counts, metric results, known variance, and exact commands.

## T0220 — Lab Composer judge-demo polish

**Suggested branch:** `feature/t0220-lab-composer-judge-demo`

**Goal:** Deliver the three-minute `/demo` Composer → validate → critique/revise → student mistake/coach → teacher → technical story using production paths.

**Dependencies:** T0213–T0215, T0217–T0219; T0216/T0218 or documented demo-scoped equivalents.

**Allowed areas:** `src/app/demo/**`, `src/lib/demo/**`, `supabase/seed.sql`, demo e2e/tests, demo documentation corrections.

**Do not touch:** Forked chemistry/coach/validator/dashboard logic, broad feature work, unsupported family implementation, expensive assets/rendering.

**Requirements:** Composer card/prefill; reliable schema-valid cached agent fallback labeled seeded; real validation/revalidation; real preview/engine events/StudentModel/dashboard path; technical inspector artifacts; reset isolation; no auth/secrets/chain-of-thought.

**Non-goals:** No fake screenshots/events, arbitrary chemistry, new engine family, voice requirement, or production-data mutation.

**Acceptance criteria:** Clean-reset script completes under three minutes; hero aha under two minutes; intentional overshoot triggers coach; teacher row updates; inspector shows matching hashes/artifacts; unsupported aspirin row visible; Chromebook/no-console-error e2e passes.

**Manual verification:** Rehearse script three times with live and fallback agent modes; test reset/isolation/offline-after-load/keyboard/reduced graphics; run demo e2e and performance smoke.

**Completion report instructions:** Use the `AGENTS.md` report; include timed runs, live/fallback behavior, real-path evidence, performance/accessibility results, risks, and commands.
