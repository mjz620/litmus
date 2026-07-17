# Repo Current State

This file is living shared memory for ChatGPT, Codex, and the human project owner. Update it after every completed ticket.

## Lab Composer architecture pivot

The repository is now planning a migration from static experiment selection toward AI-authored, composable `LabWorkflowSpec` workflows over verified deterministic lab primitives. The existing titration engine, `ExperimentDefinition.step()` action path, semantic event contracts, StudentModel evidence flow, and deterministic analytics remain non-negotiable.

This documentation update does not implement the registries, workflow schema/validator, runtime assembler, authoring/Judge Agent routes, Composer UI, or persistence. Precipitation and calorimetry examples remain planned/non-runnable until deterministic engine and compatibility work is complete. See `docs/project/Repo_Current_State.md`, `docs/README.md`, and `docs/project/implementation-roadmap-lab-composer.md`.

## Current branch

- `main` (Git initialized; no commits yet).

## Completed tickets

- `T0001 — Project skeleton`
  - Completion report: `docs/completion-reports/T0001_Project_Skeleton.md`
- `T0002 — Install repo docs`
  - Completed manually after the earlier skip decision: `AGENTS.md`,
    `tickets.md`, `README.md`, and `docs/**` now live at the repository root.
  - Completion report:
    `docs/completion-reports/T0002_Install_Repo_Docs.md`.
  - The earlier skip record is retained as superseded decision history:
    `docs/completion-reports/T0002_Skipped.md`.
- `T0003 — Experiment contract scaffold`
  - Completion report:
    `docs/completion-reports/T0003_Experiment_Contract_Scaffold.md`
- `T0004 — Titration engine import`
  - Completion report:
    `docs/completion-reports/T0004_Titration_Engine_Import.md`
- `T0005 — Display formatting helpers`
  - Completion report:
    `docs/completion-reports/T0005_Display_Formatting_Helpers.md`
- `T0006 — Experiment registry`
  - Completion report:
    `docs/completion-reports/T0006_Experiment_Registry.md`
- `T0007 — Lab store scaffold`
  - Completion report:
    `docs/completion-reports/T0007_Lab_Store_Scaffold.md`
- `T0008 — Student route shell`
  - Completion report:
    `docs/completion-reports/T0008_Student_Route_Shell.md`
- `T0009 — 2D titration controls`
  - Completion report:
    `docs/completion-reports/T0009_2D_Titration_Controls.md`
- `T0010 — pH curve component`
  - Completion report:
    `docs/completion-reports/T0010_PH_Curve_Component.md`
- `T0011 — Low-poly 3D lab shell`
  - Completion report:
    `docs/completion-reports/T0011_Low_Poly_3D_Lab_Shell.md`
- `KI-003 — Deterministic burette fill support`
  - Completion report:
    `docs/completion-reports/KI003_Burette_Fill_Support.md`
- `T0047 — Seeded randomized titration session configurations`
  - Completion report:
    `docs/completion-reports/T0047_Randomized_Titration_Configs.md`
- `T0011A — Student lab surface and debug-state separation`
  - Completion report:
    `docs/completion-reports/T0011A_Student_Debug_Surface_Separation.md`
- `T0011B — Detailed interactive high-school chemistry lab`
  - Completion report:
    `docs/completion-reports/T0011B_Interactive_High_School_Lab.md`
- `T0100 — Pure look-camera math module`
  - Completion report:
    `docs/completion-reports/T0100_Pure_Look_Camera_Math_Module.md`
- `T0101 — Remove ceiling; sky dome and diorama walls`
  - Completion report:
    `docs/completion-reports/T0101_Sky_Dome_Diorama_Walls.md`
- `T0102 — BenchCameraControls and OrbitControls removal`
  - Completion report:
    `docs/completion-reports/T0102_Bench_Camera_Controls.md`
- `T0103 — Look mode: activation, edge pan, scroll suppression, keyboard`
  - Completion report:
    `docs/completion-reports/T0103_Look_Mode.md`
- `T0110 — Interactable wrapper, hover labels, equipment extension`
  - Completion report:
    `docs/completion-reports/T0110_Interactable_Hover_Equipment_Extension.md`
- `T0111 — Selection state to labUiStore`
  - Completion report:
    `docs/completion-reports/T0111_Selection_State_LabUiStore.md`
- `T0112 — Indicator shelf, wash station, physical indicator selection`
  - Completion report:
    `docs/completion-reports/T0112_Indicator_Shelf_Wash_Station.md`
- `T0120 — Burette stopcock junction rebuild`
  - Completion report:
    `docs/completion-reports/T0120_Burette_Stopcock_Junction_Rebuild.md`
- `T0121 — Flask refinement and graduations`
  - Completion report:
    `docs/completion-reports/T0121_Flask_Refinement_Graduations.md`
- `T0130 — Dispense gesture reducer and hold-to-dispense control`
  - Completion report:
    `docs/completion-reports/T0130_Dispense_Gesture_Hold_Control.md`
- `T0131 — 3D stopcock drag and stream animation`
  - Completion report:
    `docs/completion-reports/T0131_Stopcock_Drag_Stream_Animation.md`
- `T0132 — Contextual prompts and wide burette focus pose`
  - Completion report:
    `docs/completion-reports/T0132_Contextual_Prompts_Wide_Burette_Pose.md`
- `T0140 — In-lab design-system specification`
  - Completion report:
    `docs/completion-reports/T0140_In_Lab_Design_System_Specification.md`
- `T0141 — Apply palette, materials, and lighting`
  - Completion report:
    `docs/completion-reports/T0141_Apply_Palette_Materials_Lighting.md`
- `Post-T0141 — Visible concave burette meniscus correction`
  - Completion report:
    `docs/completion-reports/Post_T0141_Meniscus_Curvature_Correction.md`
- `Post-T0141 — Immersive student bench alcove`
  - Completion report:
    `docs/completion-reports/Post_T0141_Immersive_Bench_Alcove.md`

## Current folder structure

Current application and test structure:

```text
src/
  app/
    dev/
      lab/
        [experimentId]/
          DevLabShell.tsx
          page.module.css
          page.tsx
    experiments/
      page.module.css
      page.tsx
    globals.css
    lab/
      [experimentId]/
        LabRouteShell.tsx
        page.module.css
        page.tsx
    layout.tsx
    page.tsx
  components/
    lab/
      LabNotebook.module.css
      LabNotebook.tsx
      LabSessionBar.module.css
      LabSessionBar.tsx
      PHCurve.tsx
      useLabSession.ts
      three/
        BenchCameraControls.tsx
        benchLayout.ts
        Burette.tsx
        cameraMath.ts
        ClassroomEnvironment.tsx
        ErlenmeyerFlask.tsx
        glassMaterials.tsx
        IndicatorShelf.tsx
        Interactable.tsx
        labPalette.ts
        LabScene.tsx
        SceneEnvironment.tsx
        sceneProjection.ts
        SkyDome.tsx
        WashStation.tsx
      titration/
        equipment.ts
        procedureStage.ts
        TitrationControls.module.css
        TitrationControls.tsx
        TitrationScene.module.css
        TitrationScene.tsx
        TitrationWorkspace.module.css
        TitrationWorkspace.tsx
        useDispenseGesture.ts
        useTitrationIntents.ts
    ui/
      ExperimentCard.module.css
      ExperimentCard.tsx
      experimentRoutes.ts
  experiments/
    registry.ts
    shared/
      experiment.ts
      index.ts
    titration/
      display.ts
      manifest.ts
      sessionConfig.ts
      titration.ts
  stores/
    labUiStore.ts
    labStore.ts
  types/
    index.ts
tests/
  components/
    benchLayout.test.ts
    buretteInteraction.test.ts
    cameraMath.test.ts
    dispenseGesture.test.ts
    equipment.test.ts
    erlenmeyerFlask.test.ts
    labPalette.test.ts
    labUiStore.test.ts
    PHCurve.test.ts
    procedureStage.test.ts
    sceneProjection.test.ts
    titrationIntents.test.ts
  e2e/
    home.spec.ts
    student-routes.spec.ts
    student-surface.spec.ts
    titration-camera.spec.ts
    titration-controls.spec.ts
    titration-dispense.spec.ts
    titration-equipment.spec.ts
    titration-physical-equipment.spec.ts
  experiments/
    experiment.test.ts
    registry.test.ts
    titration-session-config.test.ts
    titration-display.test.ts
    titration.test.ts
  stores/
    labStore.test.ts
  unit/
    skeleton.test.ts
```

The future persistence folder `supabase/` has not been created yet.

## Workflow path convention

- Repository-owned paths in `tickets.md` are now used as written. This includes
  `AGENTS.md`, `tickets.md`, `README.md`, `docs/**`, `src/**`, and `tests/**`.
- `labbench_codex_workflow_pack/` remains available locally only as a reference
  bundle and is excluded by `.gitignore`; it is not a committed source-of-truth
  location.
- Resources that were not moved to the root, notably `source-contracts/**`, may
  still be read from the ignored workflow pack when a ticket explicitly calls
  for them. Production implementation always belongs in the repository-root
  paths specified by the ticket.

## Installed dependencies

- `next@16.2.10`
- `react@19.2.7`
- `react-dom@19.2.7`
- `typescript@5.9.3`
- `eslint@9.39.2`
- `eslint-config-next@16.2.10`
- `prettier@3.8.2`
- `vitest@4.1.10`
- `@playwright/test@1.58.2`
- `@react-three/drei@10.7.7`
- `@react-three/fiber@9.6.1`
- `three@0.185.1`
- `zustand@5.0.14`
- React and Node TypeScript declarations
- `postcss@8.5.10` enforced as a security override

## Available scripts

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test"
}
```

## Build/test status

- `npm run build` — passed.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run format:check` — passed; canonical workflow/specification documents are
  excluded from automatic rewriting and retain their source formatting.
- `npm test` — passed, 19 files and 133 tests.
- `npm run test:e2e` — passed in Chromium, 17 tests.
- `npm audit` — 0 vulnerabilities.

## Known issues

- See `docs/Known_Issues_And_Followups.md`.

## Next recommended ticket

- `T0201 — Component registry types and titration component entries` for the Lab Composer pivot.
- `T0142 — Procedural sound` remains optional and should not block the composer dependency chain.

## Notes for next Codex run

- Read root `AGENTS.md` and `tickets.md`; these are the committed sources of
  truth.
- Treat T0002 as completed manually. Its prior skip record is superseded history.
- Use `labbench_codex_workflow_pack/` only for local reference material that has
  no root counterpart, such as the established source contracts.
- Apply the workflow path convention above when reading ticket paths.
- KI-003 is resolved with a single pre-run burette fill and deterministic
  remaining-volume state. Mid-run refills remain out of scope.
- T0047 creates a fresh client-side session seed, generates a deterministic valid
  analyte/titrant configuration locally, stores the seed with engine state, and
  supports replay through `/lab/titration?seed=<recorded-seed>`.
- T0048 remains blocked until both T0023 and T0033 are complete. Do not add
  refills or configurations requiring more than one burette fill early.
- The R3F scene uses primitive/lathe geometry, a demand-driven render loop,
  capped device-pixel ratio, a fixed standing overview camera, and no physics,
  external models, image assets, or post-processing. High quality uses one
  tightly scoped 512² shadow-casting key; reduced graphics remains entirely
  shadow-free. The scene chunk is lazy-loaded with `next/dynamic`.
- The 3D burette level projects `state.buretteAvailableML`; flask color projects
  the latest engine-emitted `observedColor`. The scene does not compute pH or
  own experiment actions.
- Headless Chromium uses its software WebGL renderer in Playwright so the scene
  is exercised in browser tests.
- T0011A is complete. `/lab/[experimentId]` is strictly student-facing (lab
  notebook, session bar, no seeds/IDs/counts/unknown concentration), while
  `/dev/lab/[experimentId]` carries the internal diagnostics, returns 404 in
  production builds, and shares the same `useLabSession` hook, store, and
  engine flow. Leak-regression and shared-seed parity e2e tests guard the
  separation.
- T0011B is complete. The scene is a high-school chemistry classroom built
  from the ticket's written art direction (no reference photo was supplied or
  committed). `src/components/lab/three/benchLayout.ts` is the single spatial
  source of truth with geometry-invariant unit tests; the burette tip
  clearance above the flask is guaranteed by construction. Glassware uses
  physically based transmission with a local PMREM RoomEnvironment and a
  reduced-graphics/WebGL1 fallback. Burette, flask/indicator, and meniscus are
  selectable (3D pointer + keyboard DOM buttons); selection frames the camera
  (reduced-motion snaps) and narrows the 2D controls to contextual groups via
  `src/components/lab/titration/equipment.ts`. No new action semantics were
  added; no swirl action exists.
- T0100 adds a pure TypeScript look-camera math module with radial smoothstep
  edge-pan input, acceleration toward target angular velocity, exponential
  release damping, hard yaw/pitch clamps, world-space look-target conversion,
  and settled-state detection. It imports no React or Three.js code and is
  ready for the later BenchCameraControls integration.
- T0101 removes the ceiling slab and decorative emissive panels, originally
  capped the back/left diorama walls at 1.9 m with contrasting trim, and adds a
  30 m low-segment WebGL1 shader sky dome for the high-quality path. Reduced
  graphics keeps the solid background fallback. The later immersive-alcove
  correction raises the close walls while preserving the open shell and dome.
- T0102 removes OrbitControls and the old CameraRig. BenchCameraControls owns a
  fixed `BENCH_VIEW` standing pose, directly applies `camera.lookAt`, and keeps
  the established 0.65 s ease-in-out focus tween plus reduced-motion snap.
  Focused equipment poses are unchanged; there is no zoom, orbit, pan, or roll.
  `LOOK_LIMITS` are relative to the neutral bench view and keep the maximum
  upward look below the wall-top sightline for T0103.
- T0103 adds click-to-activate look mode through Canvas `onPointerMissed`, with
  radial edge pan, bounded momentum, demand-loop settling, arrow-key steps, and
  an HTML recenter control. The overview instructions explicitly tell students
  to click the simulation panel to initiate panning. Escape, outside
  pointer-down, window blur, or equipment focus release look mode. Frame-local
  non-passive wheel/touch listeners are mounted before activation and suppress
  input only while the Zustand look flag is active, avoiding a Safari
  first-wheel race; body overflow is never changed. Active cursor/touch state,
  the live chip, and recenter styling live in the scene CSS module. Reduced
  motion disables continuous pan and momentum while retaining discrete
  keyboard steps. Chromium's permanent camera spec and a temporary WebKit
  camera smoke both pass.
- T0110 extends the equipment registry from three entries to five while
  preserving the original names and control mappings. `Indicator shelf` maps
  to indicator controls and `Wash station` maps to preparation controls. The
  reusable `Interactable` wrapper owns stop-propagating pointer handlers, a
  demand-loop 1.0→1.04 hover pulse, an emissive translucent highlight shell,
  and an aria-hidden Drei HTML label. LabScene uses it for all five equipment
  entries, and equipment-bar keyboard focus drives the same 3D affordance
  through the existing hover callback.
- T0111 makes `labUiStore.focused` and `.hovered` the shared source of truth for
  the workspace, equipment bar, 3D affordances, camera pose, contextual
  controls, and `data-selected-equipment`. TitrationScene no longer receives
  selection callbacks/props or owns local hover state. Workspace unmount
  cleanup prevents global UI state from leaking across routes. Escape handling
  checks look mode first and only clears focus when look mode is inactive; the
  existing camera capture handler provides the same precedence for canvas
  input.
- T0112 adds layout-owned shelf and wash-station blocks plus focused camera
  poses. The shelf contains three color-capped dropper bottles whose focused
  hotspots select the existing indicators and pull the selected bottle
  forward. The wash station contains a CanvasTexture-labeled distilled-water
  squeeze bottle, titrant bottle, and funnel. Scene components report gesture
  facts only; `useTitrationIntents` is the sole new dispatcher and maps those
  facts to the existing `select_indicator`, `rinse_burette`, and
  `fill_burette` actions. The permanent physical-equipment e2e covers all three
  indicator bottles, water/titrant rinse, funnel fill, a deterministic
  past-endpoint color change, and zero console errors while the unchanged HTML
  controls remain green.
- T0120 rebuilds the burette lower assembly as four continuous regions: tube,
  tapering junction, stopcock housing, and delivery tip. Every adjacent pair
  shares its exact Y boundary and radius; the horizontal glass barrel passes
  through the housing and the PTFE stem/paddle remain distinct future drag
  targets. The outlet stays at 1.170 m, the tube stays at 1.260–1.900 m, and
  the 0.500 m graduation span stays at 1.330–1.830 m, so
  `getBuretteLiquidTopY` is numerically unchanged. The rendered liquid surface
  is now a shallow concave lathed meniscus whose center-bottom is the mapped
  reading height; its wall edge rises above that point, and the eye-level
  meniscus camera continues to target the bottom rather than the common-error
  upper edge.
- T0121 preserves the Erlenmeyer lathe, base radius, neck, rim, and total height
  while adding three intermediate shoulder points and a slightly broader flat
  foot for a smoother stylized blend. A cached CanvasTexture wraps
  25/50/75/100 mL ticks and labels around the conical body below the shoulder.
  The decal uses an explicit late render order so the same markings remain
  legible through both transmitted high-quality glass and the reduced-graphics
  fallback, including over bright liquid/tile and near-black bench regions.
  Pure profile tests guard ordered heights, bounded wall slopes, preserved
  extents, graduation ordering, and decal placement.
- T0130 adds a pure timestamp-driven dispense reducer with closed, dropwise,
  slow, and open detents at 0/0.05/0.2/1.0 mL/s. It conserves available volume
  across 0.5 mL threshold commits, debounced detent changes, empty-burette
  auto-close, and all release/cancel/blur/visibility termination paths while
  dropping numerical residues below 0.005 mL. A thin hook runs animation
  frames only while the valve is open and dispatches existing typed
  `add_titrant` actions. The deliver controls retain the manual form and add a
  pointer/Space hold button; a short dropwise press produces exactly one
  0.05 mL, 1 second drop. Reducer integration tests exercise the real
  `flow_rate_high_near_endpoint` engine flag, and Chromium covers a segmented
  three-second slow hold plus Space auto-repeat protection.
- T0131 makes the distinct PTFE stopcock handle draggable in burette focus.
  A 120 px downward travel rotates the handle through closed, dropwise, slow,
  and open angles and feeds those detents into a physical instance of the
  unchanged T0130 controller. Pointer capture plus Escape, blur,
  pointer-cancel, and hidden-document guards close and commit every active
  gesture. Active flow renders a detent-scaled cylinder stream, falling drop,
  and flask-surface ripple; only the active frame callback chains
  `invalidate()`, and a manual WebGL counter measured zero draw calls during a
  600 ms post-close idle window. TitrationScene exposes physical
  `data-dispensing`/`data-pending-ml` state and a live pending-volume badge.
  Pure tests guard monotonic drag/detent mapping and increasing visual weight.
- T0132 widens the burette focus to position
  `[BURETTE.x + 0.55, 1.32, BURETTE.z + 1.25]` and targets
  `[BURETTE.x, 1.4, BURETTE.z]`. A projection invariant uses the same 42°
  vertical FOV as the scene and confirms the actual 1.900 m tube top and
  0.928 m flask base both remain inside a 0.95 normalized-device-coordinate
  safety margin. The focused view therefore keeps the full graduated tube,
  stopcock, and flask visible together. A slim polite live prompt now follows
  the unchanged procedure-stage machine across preparation, addition, result
  recording, and submission. Its near-endpoint branch uses only the existing
  observed curve and engine-authored semantic evidence, recommends Dropwise,
  and performs no new chemistry calculation. Endpoint-overshoot evidence takes
  precedence so the prompt instead tells the student to close the stopcock and
  record the reading. The recording prompt reinforces reading the bottom of
  the concave meniscus.
- T0140 establishes `docs/design-system.md` as the implementation contract for
  the in-lab visual system. It defines exact 3D and UI palettes, low-poly shape
  rules, matte material ranges with metalness restricted to fixtures, both
  rendering-quality tiers, interaction states, typography, component tokens,
  camera/motion timing, procedural-sound opportunities, and measurement
  legibility. Graduation ink has at least 4.0:1 direct contrast against every
  projected liquid color, including blue and red. A three-run SwiftShader
  comparison measured the proposed single 512² six-caster shadow key at 159
  versus 153 draw calls per frame and a 135.6 versus 132.8 ms median frame
  interval (+2.1%). The spec therefore approves that one shadow only for high
  quality, leaves reduced graphics shadow-free, and requires a 10%/30 FPS
  rollback gate on Chromebook-class hardware. Its T0141 conformance checklist
  required every 3D hex value to be centralized in `labPalette.ts`.
- T0141 applies the T0140 contract to both rendering tiers and the student lab
  UI. `labPalette.ts` is now the sole owner of 3D hexadecimal colors, including
  chemistry-observation projection, sky uniforms, CanvasTexture ink, equipment
  accents, and interaction shells. A pure luminance test guards at least 4:1
  graduation-ink contrast against the burette and every flask liquid color.
  Matte materials use the specified roughness ranges; nonzero metalness is
  limited to fixture rods, faucet/funnel parts, and handles. High quality uses
  the approved PCF 512² key with exactly six outer-glass casters and two
  receivers, while reduced graphics has no transmission, environment map, or
  shadows. Measurement decals render unlit above glass/liquid, and high-tier
  liquids deliberately render after their transmitted shells so semantic
  endpoint colors remain visible. Lab route CSS now exposes the normative warm
  surface, near-black ink, teal action/focus, warning, danger, radius, shadow,
  touch-target, and reduced-motion tokens. Manual high/reduced checks confirmed
  full burette/flask framing and legible burette, meniscus-bottom, and flask
  graduations; the full 17-test Chromium suite remains green with zero captured
  application console errors.
- The post-T0141 meniscus correction removes the burette liquid cylinder's flat
  top cap, which had been drawn after and over the lathed meniscus by the
  high-tier transparency ordering. The concave surface now renders explicitly
  after the open liquid column, rises 4.5 mm from its center-bottom toward the
  wall, and remains clearly curved in high and reduced graphics. The selected
  reading guide is a thin teal ring outside the liquid radius instead of the
  former thick horizontal bar. The volume mapping and camera still target the
  center-bottom, and a monotonic profile test guards that reading invariant.
- The post-T0141 immersive-alcove correction removes the distant second island,
  rear service counter, and both glass-front wall cabinets. The room shell is
  reduced from a broad classroom to a 5.2 × 4.5 m visual alcove around the
  3.1 m student island, with the back wall only 0.95 m behind the worktop. A
  dark inset sink, metal rim/drain, and gooseneck faucet now sit on the rear-left
  of that same island without overlapping the indicator shelf. The sink is set
  dressing; existing wash-station hotspots remain the functional rinse/fill
  controls. A close splashback, pastel molecular mural, and scalloped garland
  replace the storage clutter. Walls rise to 3.0 m, and a 42° frustum invariant
  proves every authored overview/equipment focus remains below the open-top
  seam. The sky dome remains outside the alcove, but normal student views now
  read as an intentional whimsical bench station instead of a roofless room.
- T0012 now depends on T0011A/T0011B and must keep raw events, StudentModel,
  seeds, and engine state inside an inspector mounted only on the dev testing
  route.
- Produce completion report.
