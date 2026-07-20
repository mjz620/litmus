# Lab Interfaces and Mechanisms

A working map of how a lab is defined, validated, executed, and rendered — and
which seams silently misbehave if you wire them wrong.

This is a **mechanism map**, not a spec. Normative contracts live in
[`docs/experiments/lab-workflow-schema.md`](../experiments/lab-workflow-schema.md),
[`docs/experiments/component-registry.md`](../experiments/component-registry.md),
and [`docs/lab/equipment-visual-contract.md`](equipment-visual-contract.md).

---

## 1. Two generations of lab

| | Legacy experiments | Setup-driven v2 workflows |
|---|---|---|
| Lives in | `src/experiments/**` | `src/lab-workflows/**` |
| A lab is | a hand-written TypeScript `ExperimentDefinition` | a JSON document interpreted by a generic runtime |
| Chemistry | inside the experiment file | a registered chemistry model |
| Authorable in Composer | no | yes |
| Examples | `titration`, `precipitation` | calorimetry, solution preparation, precipitation |

The v2 system is the destination. `src/experiments/` is being retired: it is
why solubility truth now lives in
`src/lab-workflows/chemistry-models/precipitation/solubility.ts` and the legacy
`precipitation.ts` merely re-exports it. **Relocate, never copy** — two copies
of chemistry truth is precisely what invariant 1 exists to prevent.

Titration still runs through a legacy adapter (a *strangler seam*,
`src/lab-workflows/runtime/legacy/titration.ts`): the generic runtime wraps the
old engine rather than replacing it. That is a bridge, not a destination.

---

## 2. The layers

```
registries/          closed vocabularies — what exists at all
      ↓
validation/v2.ts     is this authored workflow legal against those registries?
      ↓
runtime/generic/     compile → a program the runtime can execute
compile.ts
      ↓
runtime/generic/     step(): mechanics → chemistry → rules → events
definition.ts
      ↓
stores/              session, projection for the UI
      ↓
components/lab/      the 3D bench and panels
```

Each layer only trusts the layer above it. Validation cannot be bypassed;
the runtime re-parses anything a legacy adapter hands back.

---

## 3. Registries — the closed vocabularies

Ten registries under `src/lab-workflows/registries/`:

`actions`, `chemistry-models`, `components`, `configurations`, `engines`,
`event-flags`, `reagents`, `safety`, `scene-placements`, `skills`.

Two rules govern all of them, from `AGENTS.md`:

> Never invent registry IDs. Registry IDs must resolve exactly; do not
> fuzzy-match or silently substitute.

This is enforced *structurally*: every ID is a closed TypeScript union, so a
made-up ID is a compile error rather than a runtime surprise.

### Snapshots are tamper-evidence, not decoration

Each registry publishes a `snapshotId` (e.g. `components.3.4.0`) and a list of
legacy IDs. A validated workflow records the snapshot IDs it was checked
against.

**Adding an entry means bumping the snapshot.** Skip the bump and stale
validation artifacts silently pass the eligibility gate. Bump it and pinned
definitions correctly fail until revalidated — that is the mechanism working,
not a regression.

---

## 4. The four ownership seams

From `AGENTS.md`, and the single most important thing to internalise:

> Equipment owns reusable mechanics, actions own typed contracts, chemistry
> modules own deterministic scientific truth, and workflow rules own
> procedural/assessment constraints. Do not mix these responsibilities.

| Seam | Owns | Does **not** own |
|---|---|---|
| **Mechanics** (`mechanics/`) | apparatus state: volumes, lids, probes | any chemistry |
| **Chemistry models** (`chemistry-models/`) | scientific truth from ledger deltas | apparatus state, volumes |
| **Actions** (`registries/actions/`) | typed parameters, events, preconditions | outcomes |
| **Rules** (in the workflow JSON) | procedure and assessment | truth |

### How mechanics and chemistry actually connect

**They never call each other.** The coupling is the material ledger:

```
adapter.apply(context) → { equipment, materialAction, events }
                                    │
                          ExecutedMaterialAction (transfers)
                                    ↓
     ports.models.transition(...) → each model's applyMaterialAction
```

A mechanic that moves no liquid returns `materialAction: null` and is
**invisible to chemistry**. This has a real design consequence: an action like
"mix these two solutions" that carries no volume change produces no ledger
delta, so a chemistry model cannot observe it. Model such steps as real pours
into a shared vessel — more physically honest, and it gives the 3D scene
something to animate.

---

## 5. Chemistry model interface

`ChemistryModelModule` (`registries/chemistry-models/types.ts`), in practice
always the pre-bound `GenericChemistryModule`:

```ts
initialize(context)                → GenericStateField[]
applyMaterialAction(action, state) → { state: GenericStateField[] }
deriveObservables(state)           → GenericObservable[]
```

**State is flat scalars only** — `boolean | null | number | string | readonly
string[]`. No nested objects. Models encode structure as sorted delimited
strings (thermal energy uses `"id=value"`; precipitation uses
`"container=solution"`).

Determinism is preserved by keeping numeric state as **scaled integers**
(milli-Celsius, micro-Joules), never accumulated floats.

Registration is two places that must agree exactly:

1. **Metadata** — `registries/chemistry-models/entries.ts` (serialisable)
2. **Implementation** — `PRODUCTION_GENERIC_CHEMISTRY_MODEL_REGISTRATIONS` in
   `chemistry-models/concentration-dilution/model.ts` (that file hosts the
   production list; a historical quirk, but load-bearing)

The coordinator hard-fails on any mismatch in version, ID, or capability sets.

---

## 6. Capability gating — how glassware stays swappable

Actions declare both a capability requirement and a component allowlist:

```ts
requiredTargetCapabilityIds: ["capability.contain_liquid.v1",
                              "capability.receive_liquid.v1"]  // the real gate
targetComponentIds: []                                          // no restriction
```

**An empty allowlist means "capability-gated", not "nothing permitted."**
A non-empty allowlist is still honoured exactly, for actions genuinely bound to
one apparatus (`set_calorimeter_lid` stays locked to the calorimeter).

This rule is implemented in **three** places, and they must agree:

- `validation/v2.ts` — source and target checks
- `authoring/service.ts` — the same rule, duplicated for the command layer
- the mechanical-adapter availability check

If validation and authoring ever disagree, a teacher can build a draft in
Composer that fails validation, or vice versa.

### Adapter resolution

An action nominates one adapter (`pour_liquid` names the *calorimeter's*), which
would pin every pour to that one vessel. So `adapterFor()` in
`runtime/generic/definition.ts` prefers an adapter belonging to a
**participating equipment instance** that supports both the equipment and the
action, falling back to the action's nominee.

Equipment still opts in via its own `allowedActionIds`; this does not open every
action to everything.

---

## 7. One student action, end to end

```
UI dispatches NormalizedLabAction
      ↓
runtime resolves permission → CompiledActionBinding
      ↓
safety port check
      ↓
adapterFor(...)  → mechanical adapter
      ↓
adapter.checkPreconditions()
      ↓
adapter.apply()  → { equipment, materialAction, events }
      ↓
ledger applies transfers (volume conservation enforced)
      ↓
models.transition() → each chemistry model reacts to the delta
      ↓
evaluator.evaluate() → WorkflowDiagnosis[] (satisfied | violated | pending)
      ↓
deriveWorkflowStatus() → in_progress | completed | failed
      ↓
semantic events appended → coaching, persistence, replay, analytics
```

Diagnoses are the shared read-model. The read-only **procedure guide**
(`components/lab/ProcedureGuide.tsx`) is a pure projection: it joins
`workflow.instructions[].relatedRuleIds` against `state.diagnoses` and computes
nothing.

---

## 8. Rendering — three hops, two silent failures

Registry data becomes pixels through three hops:

1. **Pose** — `resolveEquipmentPose()` cross-checks placement against equipment.
   Mismatch **throws**.
2. **Scene registration** — `LAB_VISUAL_ADAPTERS` in
   `components/lab/titration/setupDrivenScene.ts` maps adapter ID → kind and
   selectable equipment IDs. Missing entry **throws**
   (`setup-scene.visual_adapter_unknown.v1`).
3. **Render block** — `LabScene.tsx` looks the pose up and renders a literal JSX
   block per adapter.

**Hop 3 has no exhaustiveness check.** Two ways to fail silently:

| Omission | Symptom |
|---|---|
| No `LabScene` render block | equipment simply does not appear |
| Not in `NATIVE_LOCAL_ORIGIN_ADAPTERS` | renders at world origin, mid-room |

`components/lab/three/renderableAdapters.ts` plus
`tests/components/visualAdapterWiring.test.ts` turn both into test failures.
Keep the renderable list in step with `LabScene`.

Titration-era adapters (burette, Erlenmeyer flask, indicator shelf)
*deliberately* seat from `pose.translation` because their meshes bake absolute
bench anchors. Everything native is local-origin.

### Hitboxes

`Interactable.tsx` owns hover/selection. The **hit volume is the only
interactive surface** — handlers sit on the collider mesh, not the wrapping
group, so the clickable region is the region the student is shown. Colliders are
`DoubleSide` because most are open-ended cylinders and a near-axial ray would
otherwise miss entirely.

Pass `hitShape` separately when the clickable shape should differ from the drawn
one (a meniscus ring is too thin to click).

---

## 9. Where the code runs

The lab is **not** purely client-side, and the split is load-bearing.

| Layer | Runs where |
|---|---|
| `app/lab/**/page.tsx` | Server — resolves runtime mode, validates the workflow |
| `LabRouteShell`, workspaces, stores | Client (`"use client"`) |
| `TitrationScene` | Client only — `dynamic(..., { ssr: false })` |
| `ImmersiveSetupDrivenBench` | Client component, but still server-rendered to HTML |

Build output:

```
○ /lab/calorimetry           static, prerendered at build
○ /lab/silver-chloride       static
○ /lab/solution-preparation  static
ƒ /lab/[experimentId]        dynamic (reads searchParams)
ƒ /assignments/[assignmentId] dynamic (workflow comes from the database)
```

### The engine initializes on the server

Sessions are created in a `useState(() => createSession(...))` initializer, which
runs during server render. **Chemistry and workflow runtime therefore execute at
build time on the static lab routes.**

That is a feature: a definition that validates but cannot initialize fails
`next build` rather than a student's browser. Two real cases were caught this
way — a chemistry model expecting apparatus the bench lacked, and a
ground-state titration whose titrant had no container to live in.

It also imposes two constraints:

- **Engine code is isomorphic.** No browser globals, no React, no Three.js, no
  Next, no Supabase under `src/experiments/**` or `src/lab-workflows/**`. This
  is enforced by `no-restricted-globals` / `no-restricted-imports` in
  `eslint.config.mjs`, not by convention.
- **Initialization is pure and deterministic.** It runs twice — once server-side,
  once on hydration. Adding analytics, sound, or a persistence write to session
  construction would fire it on the server too. Determinism is why validation
  takes a fixed `checkedAt` constant and sessions take an explicit
  `sessionSeed`; a clock read or RNG there is a hydration mismatch.

### Two validation-timing regimes

```ts
// Checked-in definitions — deterministic, so the route can be static
validateCalorimetryV2("2026-07-19T12:00:00.000Z")

// Authored definitions — clock read, so the route cannot be static
const checkedAt = this.options.now()   // labDefinitionRepository.ts
```

Today the static path is the norm and the dynamic path serves assignments. As
Composer authoring becomes the primary way labs are created, that inverts: most
workflows will arrive from the database and the static path becomes the
exception. Worth deciding deliberately whether checked-in definitions keep a
separate path or everything converges on the dynamic one, rather than
discovering the difference when an authored lab behaves unlike a shipped one.

## 10. Definition lifecycle

A shipped v2 definition is five artefacts:

```
definitions/<family>/
  <name>.v2.json     the spec
  authoring.ts       the Composer commands that reproduce it
  index.ts           draft + hash pin + validate<X>V2(checkedAt)
  tracePlan.ts       runtime conformance cases
  (route)            app/lab/<slug>/page.tsx
```

**`authoring.ts` is not optional.** A test asserts
`createAuthored…Draft()` deep-equals the parsed JSON, which proves the
definition contains nothing a teacher could not author through the shared
command layer.

**`checkedAt` is always a fixed constant**, never a clock read, so the
validation artifact stays deterministic.

**Hash pinning**: `EXPECTED_HASH` makes a definition tamper-evident — edit one
character and the loader throws at module load. Practical loop: set a
placeholder, run the test, paste the real hash from the failure.

### Trace plans catch what validation cannot

Static validation proves a spec is *legal*. A trace plan proves the rules
actually **separate a correct run from a wrong one**, by executing real actions
through the real runtime. In this repo it has caught a workflow that validated
cleanly and then rejected its first action at dispatch.

Case kinds have precise meanings — `recoverable_mistake` requires a diagnosis to
go violated then recover; `terminal_mistake` requires a `failed` end state. If a
workflow has no path that produces a violation, **say so and omit the case**
rather than inventing a rule to satisfy the convention.

### Validation status

`runnable` requires **zero** errors. Any error demotes it:

- all errors are "registry entry exists but unverified" → `partially_supported`
- any safety-flagged error → `rejected_for_safety`
- anything else → `unsupported`

Only a current, hash-matching `runnable` result may be previewed or assigned.

---

## 11. Checklists

### Add a vessel

1. `registries/components/types.ts` — five unions + snapshot bump
2. `registries/components/entries.ts` — the entry (all fields required)
3. `registries/configurations/` — config preset + equipment schema + snapshot bump
4. `registries/scene-placements/` — placement + anchor IDs, entries, config mirror
5. `mechanics/state.ts` — an initializer case (the `default:` hard-fails)
6. `mechanics/` — an adapter, registered in `mechanics/registry.ts`
7. `components/lab/three/<Name>.tsx` — mesh + `*_HIT` + mouth height
8. `components/lab/three/equipmentPose.ts` — local-origin set + `VESSEL_MOUTH_Y`
9. `components/lab/titration/setupDrivenScene.ts` — `LAB_VISUAL_ADAPTERS`
10. `components/lab/titration/equipment.ts` — `EquipmentId` + `EQUIPMENT`
11. `components/lab/three/LabScene.tsx` — the render block
12. `components/lab/three/renderableAdapters.ts` — add to the renderable list

Steps 11–12 are the silent ones. The wiring test covers them.

### Add an action

1. `actions/types.ts` — up to four unions
2. `actions/parameterSchemas.ts` — parameters + schema entry + snapshot bump
3. `actions/eventContracts.ts` — contract + snapshot bump
4. `actions/preconditions.ts` — any preconditions + snapshot bump
5. `actions/entries.ts` — the entry
6. `event-flags/entries.ts` — event type with `observationKeys`
7. `setupDrivenScene.ts` — `ACTION_CONTROL_GROUP` (**easy to miss**; a missing
   entry throws `setup-scene.action_adapter_unknown.v1` at runtime)
8. The component's `allowedActionIds`

### Add a lab

1. Chemistry model if the science is new — else reuse an existing capability
2. Reagents + quantity presets
3. The five definition artefacts above
4. Route page + `experimentRoutes.ts` constants
5. Catalog card on `/experiments`
6. Tests: reproduction, validation shape, trace suite

---

## 12. Gotchas worth remembering

- **Empty allowlist = unrestricted**, and the rule is duplicated in validation
  and authoring. Change both.
- **Registry snapshot bumps invalidate pinned definitions.** Expected. Fix the
  pin, do not skip the bump.
- **A model can reject initialization even when the workflow validates.**
  Requiring a capability pulls in its model, and that model may expect apparatus
  your bench lacks. Prerender/trace catches this; static validation does not.
- **Skill availability is derived, not declared.** A skill is `verified` only
  when its family is backed by a verified engine *and* every required component
  is registered. `supportedFamilyIds: []` means family-neutral — the same
  empty-means-unrestricted idiom.
- **Families are catalog metadata, never dispatch or compatibility authority.**
- **Legacy adapters cannot smuggle state in.** Every projection is re-parsed and
  cross-checked; divergence between generic and serialized legacy state throws.
- **`step()` is the only path** for a meaningful simulation action.
- **UI never computes chemistry.** Panels project engine output; they dispatch
  typed actions and nothing else.
