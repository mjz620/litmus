# In-Lab UX Overhaul — Implementation Agent Handoff

Master handoff prompt for the in-lab UX overhaul (first-person bench camera,
open-top diorama environment, equipment-focused interactions, rebuilt burette,
direct-manipulation titration, visual design system). It follows the
conventions in `docs/Codex_Ticket_Handoff_Template.md` but covers the full
T0100-block initiative as an ordered sequence.

Usage: paste the entire block below into the implementation agent. If the
agent works better one ticket at a time, paste the constraints header plus a
single `--- T#### ---` block; each ticket stands alone. The corresponding
backlog entries live in `tickets.md` (T0100–T0142).

```md
We are working on LabBench AI, an AI-native pre-lab chemistry rehearsal app
(Next.js 16 App Router, React 19, TypeScript strict, Zustand 5,
@react-three/fiber 9, @react-three/drei 10, three 0.185, Vitest 4, Playwright).

Before coding, review:
- AGENTS.md
- tickets.md
- docs/Repo_Current_State.md
- docs/Manual_Verification_Guide.md
- docs/Known_Issues_And_Followups.md

Mission:
Overhaul the in-lab UX into a colorful low-poly educational-game experience:
fixed first-person bench camera with cursor edge-panning, an open-top diorama
environment (no ceiling), equipment-focused interaction views, physical
indicator/wash-station equipment, a rebuilt burette model, and
direct-manipulation titrant dispensing. Implement the tickets below IN ORDER.
Each ticket is a separate commit with its own verification pass.

═══════════════ HARD CONSTRAINTS — READ FIRST ═══════════════

DO NOT TOUCH (no edits of any kind, in any ticket):
- src/experiments/titration/titration.ts, display.ts, sessionConfig.ts, manifest.ts
- src/experiments/shared/* and src/experiments/registry.ts
- src/stores/labStore.ts
- tests/experiments/*.test.ts and tests/stores/labStore.test.ts
These are the chemistry truth layer. They must remain byte-identical and green.
All new behavior maps onto the EXISTING typed actions: rinse_burette,
fill_burette, select_indicator, add_titrant {volumeML, durationS},
read_meniscus, submit_report — dispatched only via useLabStore.dispatch.

PRESERVE (existing e2e specs must pass; extend additively, never rename):
- data-burette-fill, data-flask-color, data-selected-equipment attributes on
  the scene section in TitrationScene.tsx (semantics unchanged).
- The visible "3D bench ready" status text.
- The three existing equipment button names: "Burette", "Flask & indicator",
  "Meniscus", and the "← Back to full bench" button.
- HTML controls in TitrationControls.tsx remain a complete path through the
  whole experiment (keyboard / reduced-motion / WebGL-fallback users).
- The zero-console-error invariant every e2e spec asserts.

CONVENTIONS:
- No external assets, loaders, or CDNs. Everything stays procedural
  (R3F primitives, latheGeometry, CanvasTexture — see Burette.tsx for the
  CanvasTexture pattern).
- Scene components (src/components/lab/three/*) never compute chemistry and
  never import store dispatch. Dispatches originate only in
  src/components/lab/titration/ (TitrationControls.tsx and the new
  useTitrationIntents.ts). Update the docstrings in LabScene.tsx and
  equipment.ts that state the old "sole dispatcher" rule.
- Keep frameloop="demand": any continuous animation must call invalidate()
  each frame while active and go cold when settled (see the tween in
  CameraRig.tsx:76-93 for the exact pattern).
- Spatial constants live only in src/components/lab/three/benchLayout.ts.
- prefers-reduced-motion: snap camera poses, no momentum, no continuous pan.
- After each ticket: write a completion report in docs/completion-reports/
  (T####_Name.md, same sections as existing reports) and update
  docs/Repo_Current_State.md. Out-of-scope discoveries go in
  docs/Known_Issues_And_Followups.md, not into the diff.

VERIFICATION GATE (run after every ticket; all must pass before moving on):
  npm run typecheck && npm run lint && npm run test && npm run test:e2e

═══════════════ TICKETS, IN ORDER ═══════════════

--- T0100 — Pure look-camera math module (S) ---
New file src/components/lab/three/cameraMath.ts (pure TS, no three/React
imports) + tests/components/cameraMath.test.ts.
Exports:
- interface LookState { yaw; pitch; yawVelocity; pitchVelocity }
- computeEdgePanInput(ndc: {x,y}, config): {yaw,pitch} — central dead zone
  (radius ~0.25 NDC) returns zero; smoothstep-eased speed scaling from
  dead-zone edge to canvas edge; max angular speed ~1.2 rad/s.
- stepLook(state, input, dtS, config): LookState — accelerate toward input
  velocity; exponential momentum decay (velocity *= exp(-damping*dt)) when
  input is zero; hard-clamp yaw/pitch to limits passed in config.
- lookToTarget(position, yaw, pitch, distance): [x,y,z]
- isSettled(state, input): boolean — true when velocities and input are ~zero.
AC: tests cover dead-zone-zero, speed monotonic with cursor distance, clamps,
momentum decays to settled. No three imports.

--- T0101 — Remove ceiling; sky dome + diorama walls (M) ---
Files: src/components/lab/three/ClassroomEnvironment.tsx, new
src/components/lab/three/SkyDome.tsx, LabScene.tsx, benchLayout.ts.
- Delete the CeilingLights component (ceiling slab + emissive panels) from
  ClassroomEnvironment.tsx. They are not real light sources; the three lights
  in LabScene.tsx are untouched.
- Lower back/left walls to ~1.9 m; add a thin contrasting trim box along each
  wall top (diorama read). Add a WALLS height constant to benchLayout.ts.
- New SkyDome.tsx: one sphereGeometry (radius ~30, BackSide, 16×12 segments)
  with a small ShaderMaterial lerping 2–3 pastel colors by world Y (warm
  horizon → soft blue-mint zenith). Must work on WebGL1. Render it in
  LabScene.tsx; keep the existing background color as low-quality fallback.
AC: no geometry above wall height except the dome; e2e suite green.

--- T0102 — BenchCameraControls; delete OrbitControls (L) — deps T0100 ---
Files: new src/components/lab/three/BenchCameraControls.tsx, DELETE
CameraRig.tsx, benchLayout.ts, LabScene.tsx,
tests/components/benchLayout.test.ts.
- benchLayout.ts: add BENCH_VIEW (fixed standing pose: eye ≈ [0.2,1.58,1.55],
  looking at [EQUIPMENT_ANCHOR.x, 1.12, EQUIPMENT_ANCHOR.z]) and LOOK_LIMITS
  (~±55° yaw, −35°/+20° pitch). DELETE ORBIT_LIMITS and its test cases; add
  invariant tests: BENCH_VIEW inside room bounds, target over the island,
  pitch/yaw limits keep the view off the open sky seam.
- BenchCameraControls.tsx replaces CameraRig.tsx in LabScene.tsx. Port the
  existing 0.65 s easeInOutCubic pose tween and reduced-motion snap from
  CameraRig.tsx verbatim, replacing OrbitControls.target plumbing with
  camera.lookAt. Camera position is FIXED at BENCH_VIEW.position in overview;
  focused CAMERA_POSES tween position+target exactly as today. No zoom, no
  orbit, no roll anywhere.
- Remove the OrbitControls import; drei may remain a dependency (used later
  for <Html>). Update the instructions copy in TitrationScene.tsx that says
  "drag to look around and scroll to zoom".
AC: no OrbitControls usage in repo; titration-equipment.spec.ts passes
unmodified; reduced motion snaps poses.

--- T0103 — Look mode: activation, edge pan, scroll suppression, keyboard (L)
    — deps T0102 ---
Files: TitrationScene.tsx, new src/stores/labUiStore.ts,
BenchCameraControls.tsx, new tests/e2e/titration-camera.spec.ts.
- New Zustand store labUiStore.ts: { focused: EquipmentId|null, hovered,
  lookActive, setFocused, setHovered, setLookActive, clearFocus }.
- Activate look mode via <Canvas onPointerMissed> (click that hit no
  equipment) → lookActive=true; show an overlay chip "Looking around — move
  cursor to edges to pan · Esc to release" (aria-live="polite"). Set
  data-look-active on the scene section.
- While active: BenchCameraControls samples cursor NDC from a window
  pointermove listener, feeds computeEdgePanInput/stepLook each frame,
  chains invalidate() until isSettled. Release on Escape, click outside the
  canvas frame, or window blur.
- Scroll containment: wheel + touchmove listeners with {passive:false} +
  preventDefault ON THE CANVAS FRAME ONLY while active; touch-action:none on
  the frame. Never lock body overflow.
- Keyboard: canvas frame tabIndex=0, role="application" with aria-label;
  arrow keys apply discrete yaw/pitch steps. Add a "Recenter view" HTML
  button. Reduced motion: no momentum, no continuous pan — step-look only.
AC (new e2e): click activates (data-look-active="true"); Escape releases;
window.scrollY unchanged wheeling over active canvas, page scrolls outside
it; arrow-key look works; reduced motion via page.emulateMedia; zero console
errors. Existing specs untouched and green.

--- T0110 — Interactable wrapper + hover labels + equipment extension (M)
    — deps T0102 ---
Files: src/components/lab/titration/equipment.ts, new
src/components/lab/three/Interactable.tsx, LabScene.tsx,
tests/components/equipment.test.ts (extend, don't rewrite).
- equipment.ts: EquipmentId gains "indicatorShelf" (controlGroups
  ["indicator"], name "Indicator shelf") and "washStation" (controlGroups
  ["prepare"], name "Wash station"). Existing three entries unchanged.
  EQUIPMENT_IDS grows to 5; getVisibleControlGroups logic unchanged.
- Interactable.tsx generalizes equipmentHandlers from LabScene.tsx:63-73:
  props {id, label, highlightShape, children}; pointer handlers with
  stopPropagation; hover = scale pulse (1.0→1.04) + emissive tint on the
  existing highlight-shell pattern; hover label as drei <Html> chip with
  aria-hidden. No postprocessing/outline dependencies.
AC: 5 buttons in the equipment bar (3 old names unchanged); hover shows chip
+ highlight; equipment.test.ts extended and green.

--- T0111 — Selection state → labUiStore (S) — deps T0103 ---
Files: TitrationWorkspace.tsx, labUiStore.ts.
Move selected/hovered from TitrationWorkspace useState into labUiStore
(focused/hovered). data-selected-equipment reads from focused — name and
semantics identical. Escape precedence: release look first, then clear focus.
AC: titration-equipment.spec.ts passes unmodified.

--- T0112 — Indicator shelf + wash station + physical indicator pick (L)
    — deps T0110, T0111 ---
Files: new src/components/lab/three/IndicatorShelf.tsx and WashStation.tsx,
benchLayout.ts, new src/components/lab/titration/useTitrationIntents.ts,
LabScene.tsx, TitrationScene.tsx.
- benchLayout.ts: add SHELF block (riser at back of island, x≈−0.55, z≈0.05)
  and WASH block (beside the burette stand); add CAMERA_POSES.indicatorShelf
  and CAMERA_POSES.washStation.
- IndicatorShelf.tsx: three stylized dropper bottles (cylinder + cone cap),
  color-capped for phenolphthalein / bromothymol_blue / methyl_orange.
  In shelf focus, each bottle is a child hotspot; the selected indicator's
  bottle renders pulled-forward.
- WashStation.tsx: squeeze wash bottle with "Distilled water" CanvasTexture
  label, titrant reagent bottle, small funnel. Existing SinkAndFaucet stays.
- useTitrationIntents.ts (in titration/, the ONLY new dispatcher): receives
  gesture facts from the scene via callbacks ("bottle X clicked") and
  dispatches select_indicator / rinse_burette / fill_burette. Unit-test the
  mapping without WebGL.
- Bottle clicks in shelf focus → select_indicator; titrant-bottle click in
  wash focus → rinse_burette {solvent:"titrant"}; wash-bottle click →
  rinse_burette {solvent:"water"}; funnel click → fill_burette. The HTML
  <select> and prepare buttons keep working unchanged.
AC: e2e — focus shelf, click a bottle, complete a titration, assert
data-flask-color changes past endpoint; scene files import no dispatch.

--- T0120 — Burette stopcock junction rebuild (M) — deps T0101 ---
Files: benchLayout.ts, src/components/lab/three/Burette.tsx,
tests/components/benchLayout.test.ts.
Fix the floating parts: benchLayout reserves stopcockHeight 0.042 between
tipTopY and tubeBottomY but the mesh only spans ±0.011 around center
(~0.010 m air gaps above and below), and the tip cone top (r 0.0075) doesn't
meet the tube (r 0.017).
- Re-derive the junction in benchLayout.ts so adjacent segments share
  boundaries exactly: tube bottom → tapering junction → stopcock housing
  (glass block around the horizontal barrel) → tip cone, with tip clearance
  over the flask and the graduation span UNCHANGED (getBuretteLiquidTopY and
  its tests must not change).
- Rebuild the lower assembly meshes in Burette.tsx accordingly; keep the
  horizontal PTFE handle as a distinct mesh (it becomes the T0131 drag
  target).
AC: new invariant tests — adjacent segment boundaries share Y and radius (no
gaps, no radius jumps); existing benchLayout tests green.

--- T0121 — Flask refinement + graduations (S) ---
Files: src/components/lab/three/ErlenmeyerFlask.tsx, minor Burette.tsx.
The lathe profile is fundamentally sound — do NOT rebuild it. Add 2–3
interpolation points at the shoulder for a smoother blend, apply a
graduation CanvasTexture decal (25/50/75/100 mL, reuse the Burette.tsx
getGraduationTexture pattern), and a light stylized-proportion pass.
AC: graduations legible at the flask focus pose; no radius discontinuities;
low-quality path unaffected.

--- T0130 — Dispense gesture reducer + Hold-to-dispense control (L)
    — deps T0111 ---
Files: new src/components/lab/titration/useDispenseGesture.ts,
TitrationControls.tsx, new tests/components/dispenseGesture.test.ts.
- Pure reducer + thin hook. Flow-rate detents: closed 0, dropwise 0.05,
  slow 0.2, open 1.0 mL/s (open is deliberately above the engine's 0.5 mL/s
  near-endpoint flag threshold).
- While held: pendingML += rate × dt using performance.now() deltas.
- Commit add_titrant {volumeML: pendingML, durationS: elapsedS} when
  (a) pendingML ≥ 0.5, (b) detent changes (debounce rapid flapping ~100 ms),
  or (c) gesture ends. EVERY termination path closes the valve and commits:
  pointer-up, Escape, blur, pointercancel, visibilitychange.
- Guards before dispatch: clamp to buretteAvailableML (auto-close at empty),
  drop residues < 0.005 mL, never dispatch durationS ≤ 0. Single click at
  dropwise = one drop {volumeML: 0.05, durationS: 1}.
- TitrationControls.tsx deliver group gains a detent selector + a
  "Hold to dispense" press-and-hold button (pointer hold and Space-key hold;
  guard against key auto-repeat) driven by this same hook. The existing
  volume/duration form stays.
AC: reducer tests — volume conservation, per-segment rate equals detent,
clamping, closure on every end path; an integration test feeds a synthetic
fast-near-endpoint timeline through the reducer into the real titration.step
and asserts flow_rate_high_near_endpoint appears (import the engine in the
test only — engine files unchanged). e2e: hold 3 s at slow →
data-burette-fill decreases and add_titrant events appear.

--- T0131 — 3D stopcock drag + stream/drip animation (L) — deps T0120, T0130 ---
Files: Burette.tsx, TitrationScene.tsx (data-dispensing attribute,
pending-mL readout).
Drag the stopcock handle (setPointerCapture) to rotate across the detents of
the same reducer; render a falling titrant stream (thin cylinder) and drip,
plus a flask ripple while dispensing. Animation invalidates each frame only
while dispensing, then goes cold.
AC: pointercancel/blur closes and commits; demand loop idle when closed.
Do NOT e2e the canvas drag (flaky under swiftshader) — the reducer + HTML
hold path covers logic; record manual verification in the report.

--- T0132 — Contextual prompts + wide burette pose (M) ---
Files: benchLayout.ts, TitrationScene.tsx, benchLayout.test.ts.
- Re-author CAMERA_POSES.burette (≈ position [BURETTE.x+0.55, 1.32,
  BURETTE.z+1.05]) so tube top (≈1.72) AND flask base (≈0.93) fit in the 42°
  FOV simultaneously — add a frustum-height invariant test.
- Add a slim aria-live prompt strip over the canvas driven by
  getProcedureStage (procedureStage.ts, unchanged) suggesting the next
  physical step; near-endpoint (use curve/available data already in state,
  no new chemistry) suggest switching to dropwise.
AC: pose invariant test green; prompts follow the stage machine.

--- T0140 — Design-system spec (M, doc only) ---
New docs/design-system.md: palette (near-black bench, warm wood, 3 saturated
indicator accents, pastel sky), low-poly material rules (roughness ~0.8,
metalness only on fixtures), lighting plan (evaluate ONE shadow-casting key
light with castShadow limited to glassware — record the perf measurement and
decision), hover/selection spec, animation timing table (0.65 s focus,
~120 ms hover, momentum half-life), typography + UI tokens, synthesized
sound list, measurement-legibility rules (graduation contrast, meniscus
ring). Audience: middle/high-school students; playful but scientifically
legible. No code changes.

--- T0141 — Apply palette + materials + lighting (L) — deps T0140, all prior ---
Files: new src/components/lab/three/labPalette.ts (the ONLY place 3D hex
colors live), ClassroomEnvironment.tsx, glassMaterials.tsx, Burette.tsx,
ErlenmeyerFlask.tsx, SkyDome.tsx, CSS modules. Include a palette unit test
with a luminance-ratio helper asserting graduation-vs-liquid legibility.
AC: both quality tiers conform; full e2e suite green.

--- T0142 — Procedural sound (optional, M) — deps T0131 ---
New src/components/lab/three/labSounds.ts: WebAudio synthesis only (drip =
filtered noise burst, valve click, endpoint two-note chime), gesture-gated
(no autoplay violations), with a mute toggle. Skip if time-constrained.

═══════════════ AFTER EACH TICKET ═══════════════
Provide: summary of changes, files changed, commands run, build/test
results, manual verification performed, docs updated, risks / follow-up
tickets. Then update docs/Repo_Current_State.md and add the completion
report before starting the next ticket.
```
