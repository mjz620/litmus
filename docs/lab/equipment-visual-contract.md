# Equipment visual contract

Status: **normative** for any new or edited 3D lab apparatus.  
Audience: agents and humans adding meshes, hit targets, hover shells, or
interaction animations.

This document is the design contract for *how equipment looks and behaves in
the immersive bench*. Registry chemistry, validation, and workflow authoring
remain owned by the Lab Composer contracts. Visuals never compute scientific
truth.

## Authority

When instructions conflict, use this order:

1. [`AGENTS.md`](../AGENTS.md) — chemistry stays local; UI never reimplements it.
2. This contract — hover, hitboxes, seating, shared meshes, and gestures.
3. [`docs/design-system.md`](../design-system.md) — palette, motion timing, HUD.
4. [`docs/experiments/component-registry.md`](../experiments/component-registry.md)
   — apparatus IDs, state, and allowed actions.
5. Ticket acceptance criteria for the current run.

A registry entry is not “done” until its visual path satisfies this contract.

## Separation of concerns

| Layer | Owns | Must not |
| --- | --- | --- |
| Component / action registries | IDs, state fields, allowed actions | Meshes, hover shells, Three.js |
| Scene placements | Verified slots, footprints, yaw | Ad-hoc world offsets inside meshes |
| Mesh component | Local-origin silhouette + fill projection | Pointer dispatch, chemistry |
| `Interactable` | Hover/selection glow, hit volume, label chip | Experiment actions |
| Scene shell (`LabScene` / benches) | Pose seating, focus camera, gesture mount | Chemistry formulas |
| Visual gestures | Travel / pour / mix / lid / probe clips | Mutating engine state |
| Runtime / adapters | Deterministic science on `step()` | Waiting on animation completion |

Chemistry dispatches first (or on explicit confirm). Gestures are a
**projection** of an already-accepted action, matching the titration indicator
addition pattern.

## Required checklist for every new selectable piece

A new equipment visual is incomplete until all of the following are true.

### 1. Registry + placement

- [ ] Exact `component.*.v1` and `visual-adapter.*.v1` IDs exist in code.
- [ ] At least one verified `placement.*.v1` with `footprintCenterXZ` and
      half-extents is registered.
- [ ] `LAB_VISUAL_ADAPTERS` maps the adapter to one or more `EquipmentId`s.
- [ ] No invented or fuzzy-matched IDs.

### 2. Local-origin mesh

- [ ] The mesh sits at a **local origin** (bench contact under the object).
- [ ] It does **not** bake `ISLAND.topY` or footprint XZ into child positions.
- [ ] World seating uses `worldPositionForEquipmentPose(pose)` →
      `[footprintX, ISLAND.topY, footprintZ]` for native adapters listed in
      `src/components/lab/three/equipmentPose.ts`.
- [ ] Titration legacy pieces that still bake absolute anchors
      (`Burette`, `ErlenmeyerFlask`, `WashStation` tray) keep their existing
      recenter pattern; do not invent a third seating style.

### 3. Shared silhouette when the apparatus is the same

- [ ] If two workflows use the same physical object, they share one mesh
      component (example: distilled-water squeeze bottle → `WashSqueezeBottle`
      for both titration wash station and native wash-bottle placements).
- [ ] Do not ship a second “similar” bottle/cup with different proportions
      unless the registry entry is intentionally a different component.

### 4. Hover and selection highlight (non-negotiable)

Every selectable piece **must** mount through `Interactable`:

```tsx
<Interactable
  id="calorimeter" // EquipmentId
  enabled
  label={EQUIPMENT.calorimeter.name}
  highlightShape={{
    geometry: <cylinderGeometry args={[radius, radius, height, …, true]} />,
    position: [0, centerY, 0],
    labelPosition: [0, labelY, 0]
  }}
  hovered={hovered === "calorimeter"}
  selected={selected === "calorimeter"}
  onHover={onHover}
  onSelect={onSelect}
>
  <Calorimeter … />
</Interactable>
```

Contract rules:

| Rule | Requirement |
| --- | --- |
| Wrapper | Use `Interactable`. Do not hand-roll emissive shells. |
| Hover | `hovered={hovered === id}` — mint shell (`LAB_PALETTE.hoverMint`), ~24% opacity, scale ≈ 1.04. |
| Selected | `selected={selected === id}` — teal shell (`selectionTeal`), stronger opacity; **do not** suppress hover glow when selected. |
| Hit volume | Invisible hit mesh from `highlightShape` must enclose the visible silhouette (thin glass needs an oversized hit cylinder/box). |
| Alignment | Highlight `position` / radius / height must match the **local** mesh bounds. If the mesh moves, update the hit constants in the same PR. |
| Label | Short equipment name chip only; `pointerEvents: none`. |
| Disabled | `enabled={false}` — no hover shell, no select. |
| Demand frames | Respect `frameloop="demand"`; call `invalidate()` while animating. |
| Actions | `Interactable` never calls `session.dispatch` / chemistry. |

Export hit constants next to the mesh (see `CALORIMETER_HIT`,
`DISTILLED_WASH_BOTTLE_HIT`, …) so `LabScene` cannot drift from the model.

### 5. In-scene action panel (native / setup-driven labs)

When equipment is focused, the immersive shell must show a titration-style
overlay of actions that involve that instance
(`projectionActionsForEquipmentFocus` + `FocusedEquipmentActionPanel`).

- Filter by **equipment instance** via visual-adapter mapping, not by coarse
  control-group guesses that mis-route pours.
- Lab steps drawer should filter the same way when something is focused.
- Unavailable / completed actions stay visible but disabled with plain-language
  copy.

### 6. Interaction animation (when A acts on B)

If an action moves material or relocates apparatus relative to another piece,
it **must** enqueue a reusable visual gesture. Static fill-fraction updates
alone are not enough for pour, mix, lid, or probe placement.

| Action family | Gesture kind | Module |
| --- | --- | --- |
| Pour / transfer / rinse / fill-to-mark | `pour` | `gestures/LabVisualGestures.tsx` |
| Mix solution / mix calorimeter | `mix` | same |
| Set calorimeter lid | `lid` | same |
| Place thermometer | `place_probe` | same |
| Indicator addition (titration) | existing `IndicatorAddition` | keep; do not fork |

Contract rules:

1. Map `actionId` → gesture in `gestures/nativeActionGestures.ts` (or extend
   that map). Do not bury One-off `useFrame` clips inside mesh files.
2. Gestures are **gesture-only**. They receive world poses derived from
   verified placements; they never write registries or call chemistry.
3. Prefer dispatching the typed action, then playing the clip as projection
   (or confirm-dialog → dispatch + clip, like indicator). Do not block
   `ExperimentDefinition.step()` on animation completion.
4. Hide or suppress the static mesh part being animated (lid / probe) while the
   clip runs so students do not see double geometry.
5. Honor `prefers-reduced-motion: reduce` by shortening or skipping travel.
6. Optional sound via `getLabSounds().playFromGesture(...)` only after unlock;
   never invent chemistry-coupled audio.
7. Chromebook: keep clips short (~0.8–2.1 s), low segment counts, demand-frame
   invalidation only while in flight.

Adding a **new** gesture kind requires:

- a reusable component under `src/components/lab/three/gestures/`;
- a `LabVisualGesture` discriminant;
- wiring in `LabVisualGestureLayer`;
- an `actionId` mapping;
- at least one unit test that the mapping returns the expected `kind` for a
  seed workflow.

### 7. State projection

Meshes may read **already-computed** projection fields only:

- fill fractions / liquid color from the scene configuration;
- lid closed / probe placed boolean flags from equipment state fields;
- titration dispense provider for stream/ripple.

They must not recompute concentration, temperature, heat, or endpoint.

### 8. Performance and accessibility

- Stay within the design-system low-poly budgets; reduced-graphics must keep
  silhouette + measurement marks.
- Equipment-bar buttons and 3D hit targets stay in sync (same `EquipmentId`).
- Keyboard: Esc clears focus / look-around; precision controls remain available
  when WebGL fails.
- Measurement results also appear as text with units (animation is never the
  only channel).

## File ownership map

| Concern | Path |
| --- | --- |
| Shared hover wrapper | `src/components/lab/three/Interactable.tsx` |
| Palette tokens | `src/components/lab/three/labPalette.ts` |
| Native seating helper | `src/components/lab/three/equipmentPose.ts` |
| Shared wash bottle | `src/components/lab/three/WashSqueezeBottle.tsx` |
| Native apparatus meshes | `src/components/lab/three/SolutionPreparationEquipment.tsx` |
| Scene composition | `src/components/lab/three/LabScene.tsx` |
| Reusable gestures | `src/components/lab/three/gestures/*` |
| Action → gesture map | `src/components/lab/three/gestures/nativeActionGestures.ts` |
| Focus action filter | `src/components/lab/titration/setupDrivenScene.ts` → `projectionActionsForEquipmentFocus` |
| Immersive native shell | `src/components/lab/setup-driven/ImmersiveSetupDrivenBench.tsx` |
| Dispatch + gesture enqueue | `src/components/lab/setup-driven/NativeSetupDrivenWorkspace.tsx` |
| Equipment metadata | `src/components/lab/titration/equipment.ts` |
| Placements | `src/lab-workflows/registries/scene-placements/` |

## Anti-patterns (reject in review)

- Baking footprint or `ISLAND.topY` into a mesh used inside a posed group.
- Hitboxes at the group origin while the visible mesh is translated away
  (the calorimetry hover bug).
- A second wash-bottle / stock-bottle mesh “just for this lab.”
- Custom hover glow per mesh instead of `Interactable`.
- Hiding the selection highlight so focused equipment looks inert.
- Playing a pour animation without a registered action, or awaiting the clip
  before calling `step()`.
- Putting chemistry formulas, pH, or heat math in React Three Fiber files.
- Fuzzy-matching visual adapter IDs or silently substituting meshes.
- Cards, pill clusters, or HUD chrome that bury the 3D affordance.

## Acceptance tests (minimum)

For each new selectable apparatus:

1. **Pose unit test** — `resolveEquipmentPose` exposes `footprintCenterXZ`;
   `worldPositionForEquipmentPose` matches bench seating.
2. **Hover contract** — Interactable receives both `hovered` and `selected`;
   hit constants cover the mesh AABB (manual or component test).
3. **Gesture mapping** — every interactive `actionId` that moves material or
   relocates parts returns a non-null gesture kind for the seed workflow
   (see `tests/components/nativeLabVisuals.test.ts`).
4. **Replay / catalog** — existing seed workflow still resolves scene
   configuration and selectable IDs.
5. **Manual** — hover shows mint shell on the *visible* object; select shows
   teal shell + in-scene actions; Apply plays the mapped clip without freezing
   the engine.

## Worked examples

| Apparatus | Mesh | Hit constants | Gestures |
| --- | --- | --- | --- |
| Distilled wash bottle | `WashSqueezeBottle` / `DistilledWaterWashBottle` | `DISTILLED_WASH_BOTTLE_HIT` | `pour` when source |
| Coffee-cup calorimeter | `Calorimeter` | `CALORIMETER_HIT` | `mix`, `lid`, pour target |
| Digital thermometer | `Thermometer` | `THERMOMETER_HIT` | `place_probe` |
| Titration indicator bottle | `IndicatorShelf` + `IndicatorAddition` | shelf Interactable | indicator travel clip |

## Related docs

- [`docs/design-system.md`](../design-system.md) — tokens, timing, HUD chrome.
- [`docs/experiments/component-registry.md`](../experiments/component-registry.md)
  — apparatus registry entries.
- [`docs/project/Chromebook_Performance.md`](../project/Chromebook_Performance.md)
  — frame budget and reduced graphics.
- Completion reports `T0110` (Interactable), `T0140`/`T0141` (palette), and
  native lab visual fixes under `docs/completion-reports/`.
