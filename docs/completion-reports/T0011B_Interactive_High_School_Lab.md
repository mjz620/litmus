# T0011B — Detailed interactive high-school chemistry lab

## Completion Report

### Summary

- Replaced the placeholder low-poly bench with a recognizable high-school
  chemistry classroom built from the ticket's written art direction (the
  project owner chose not to supply the reference photo, so no photo was used
  or committed): black phenolic lab islands on warm wood cabinetry with door
  panels and hardware, a second background island, wood-framed glass-front
  storage cabinets with bottle silhouettes, a service counter with sink basin
  and gooseneck faucet, whiteboard, walls, and a ceiling with emissive light
  panels.
- Added `src/components/lab/three/benchLayout.ts` as the single spatial
  source of truth. The burette is derived bottom-up from the flask rim plus an
  explicit clearance, so the tip cannot intersect or enter the flask by
  construction, and `tests/components/benchLayout.test.ts` asserts the
  geometry invariants (tip above rim, tip over mouth, part stacking, resting
  on surfaces, graduations inside the tube, camera poses inside the room).
- Rebuilt the burette with correct proportions: support stand with base, rod,
  clamp arm and jaws; thin glass tube; runtime canvas-texture graduations
  (1 mL minor ticks, 5 mL long ticks, labeled every 10 mL on a frosted strip,
  legible in the focused view; no image assets committed); stopcock barrel
  with PTFE handle; tapered delivery tip; and an engine-projected liquid
  column whose meniscus ring tracks `state.buretteAvailableML` against the
  graduated span.
- Rebuilt the Erlenmeyer flask as a lathe profile with a distinct conical
  body, shoulder, neck, and rim lip, containing a liquid cone and surface
  whose color remains the engine-observed indicator projection.
- Applied selective photorealism to glassware: `meshPhysicalMaterial` with
  transmission, IOR 1.5, thickness, low roughness, and clearcoat, lit by a
  locally generated PMREM RoomEnvironment (no CDN fetch). A lower-cost
  transparent-standard fallback activates automatically without WebGL2 and via
  a user-facing "Reduced graphics" toggle, preserving shape, liquid level,
  markings, and affordances.
- Made the burette, flask/indicator, and meniscus selectable through both 3D
  pointer interaction (hover envelope highlight, pointer cursor, purpose text)
  and keyboard-focusable DOM equipment buttons that announce name and purpose
  via an `aria-live` info line. Selection tweens the camera to a
  layout-defined focused pose (instant under `prefers-reduced-motion`), the
  meniscus view follows the liquid surface at eye level, and "← Back to full
  bench" or Escape restores the overview.
- Split the 2D precision controls into contextual groups (burette →
  prepare/deliver, flask → indicator, meniscus → reading) driven by a pure,
  unit-tested mapping in `src/components/lab/titration/equipment.ts`. With no
  selection every group renders, so all existing precision actions stay
  reachable; all dispatches remain the existing typed actions — no swirl or
  new action semantics were added.
- Kept the performance posture: demand frameloop (with `invalidate()`-driven
  camera tweens), DPR capped at 1.5, shared module-level materials, primitive
  geometry only, no shadows or postprocessing, and the three.js scene chunk is
  now lazy-loaded via `next/dynamic` so route navigation no longer waits on
  it.

### Files changed

- `src/components/lab/three/benchLayout.ts` — new spatial truth module
  (dimensions, derived stacking, camera poses, liquid-level mapping).
- `src/components/lab/three/ClassroomEnvironment.tsx` — new classroom set
  dressing; replaces the deleted `LabBench.tsx`.
- `src/components/lab/three/glassMaterials.tsx` — new quality-switched glass
  and liquid materials.
- `src/components/lab/three/SceneEnvironment.tsx` — new local RoomEnvironment
  PMREM attachment.
- `src/components/lab/three/CameraRig.tsx` — new pose tween + orbit limits
  (overview-only clamping).
- `src/components/lab/three/Burette.tsx`, `ErlenmeyerFlask.tsx` — rebuilt
  models.
- `src/components/lab/three/LabScene.tsx` — new composition with equipment
  pointer handlers, hover highlights, and meniscus hotspot.
- `src/components/lab/titration/equipment.ts` — new equipment metadata and
  contextual-group mapping.
- `src/components/lab/titration/TitrationWorkspace.tsx` — new owner of
  selection state (scene + contextual controls + Escape handling), lazy-loads
  the scene.
- `src/components/lab/titration/TitrationScene.tsx` + `.module.css` —
  equipment buttons, purpose info line, reduced-graphics toggle,
  `data-selected-equipment`, WebGL2 quality detection.
- `src/components/lab/titration/TitrationControls.tsx` — renders contextual
  control groups; delivery group titled "Add titrant (stopcock)".
- `src/app/lab/[experimentId]/LabRouteShell.tsx` — composes
  `TitrationWorkspace`.
- `src/app/dev/lab/[experimentId]/DevLabShell.tsx` — same one-line
  composition swap (see risks: minor allowed-areas deviation).
- `tests/components/benchLayout.test.ts`, `tests/components/equipment.test.ts`
  — new unit tests (20 tests).
- `tests/e2e/titration-equipment.spec.ts` — new selection/contextual-panel
  flow completing the full titration, plus reduced-graphics toggle coverage.
- `tests/e2e/titration-controls.spec.ts` — extended 3D readiness timeout for
  software-rendered WebGL under parallel test load.

### Commands run

- `npm run typecheck`, `npm run lint`, `npm run format:check` (after
  `prettier --write` on changed files)
- `npm test`, `npm run test:e2e`, `npm run build`
- `npm run start` + `curl` production smoke checks
- Headless Chromium screenshot script (scratchpad) for visual inspection of
  the overview and each focused view

### Build/test results

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run format:check` — passed.
- `npm test` — passed, 12 files, 67 tests (includes 14 bench-layout geometry
  and 6 equipment-mapping tests).
- `npm run test:e2e` — passed, 13 tests in Chromium (software WebGL).
- `npm run build` — passed; production smoke: `/lab/titration` 200,
  `/dev/lab/titration` 404.

### Manual verification performed

- Screenshot inspection at a 1366×768 Chromebook-class viewport: the overview
  reads as a chemistry classroom (black worktops, wood cabinets, glass-front
  storage, sink/faucet, ceiling panels); the burette focused view shows
  legible graduation ticks and labels, clamp, stopcock, and tip; the flask
  focused view shows transparent glass with visible background, distinct
  liquid, rim, and the burette tip above the mouth with clear separation; the
  meniscus view frames the reading line at eye level with a teal reading
  ring.
- Completed the full procedure through contextual panels via e2e: select
  burette → rinse/fill, flask → indicator, burette → deliver titrant,
  meniscus → record reading; Escape exit and full-bench restoration verified;
  zero console errors recorded by the specs.
- Keyboard path: equipment buttons are native DOM buttons in document order
  with `aria-pressed` state; focus announces name/purpose through the
  `aria-live` info line (asserted in e2e).
- Reduced motion honored (camera snaps instead of tweening);
  reduced-graphics toggle verified in e2e.

### Risks / limitations

- `DevLabShell.tsx` (in `src/app/dev/lab/**`, not in the ticket's allowed
  areas which predate the T0011A dev route) received a one-line composition
  swap to the shared `TitrationWorkspace`; without it the dev route would have
  diverged from the shared workspace contract established in T0011A.
- FPS could only be sanity-checked under SwiftShader (software WebGL), where
  the scene initializes in a few seconds and demand rendering keeps idle cost
  near zero; a real-Chromebook GPU profile is still recommended. The
  "Reduced graphics" toggle and automatic WebGL1 fallback are the documented
  mitigations.
- Physically based transmission renders flat under SwiftShader; on GPU-less
  environments the glass reads translucent rather than refractive. The
  fallback material path is identical in shape/markings.
- The e2e 3D readiness gates use a 30 s timeout because parallel software-GL
  contexts initialize slowly; on developer hardware readiness is typically
  under a second.
- drei's OrbitControls logs an upstream `THREE.Clock` deprecation warning in
  the browser console (a warning, not an error; not caught by the specs'
  error listeners).

### Follow-up tickets suggested

- T0045 (Chromebook performance pass) should profile on real target hardware
  and may tune DPR, transmission resolution, and geometry segment counts.
- Consider a small visual-regression harness (screenshot diffs of the four
  canonical views) once the art direction stabilizes.

### Docs needing update

- `docs/Repo_Current_State.md` — updated in this run.
