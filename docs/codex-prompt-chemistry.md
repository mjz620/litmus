# Codex task: weak-acid/base titration, Ksp precipitation, solids and mass, calorimetry enthalpy

Four work items. **Item 3 (solids and the balance) is a prerequisite for item 4
(dissolution enthalpy) and for the gravimetric part of item 2** — a lab that
reports a mass the student never weighed is not a measurement. If you cannot
complete all four, finish items 3 and 4 together rather than leaving enthalpy
resting on declared moles.

## Context

`litmus-lab` is a virtual chemistry lab for high-school students. A deterministic
engine owns all chemistry; the interface only projects engine state and never
computes or decorates over it. Read `CLAUDE.md`, `AGENTS.md`, and
`docs/lab/lab-interfaces-and-mechanisms.md` before starting.

Three non-negotiable invariants:

1. **Determinism.** Replay must be bit-identical. No `Date.now()`, no
   `Math.random()`, no wall-clock, no network in any chemistry model. Iterative
   solvers must use a **fixed iteration count**, not a convergence tolerance.
   Concentrations and heat are stored as scaled integers (`CONCENTRATION_SCALE`,
   `HEAT_MICRO_SCALE`) precisely so replay reproduces exactly.
2. **The engine owns chemistry.** Nothing in `src/components/` or `src/app/` may
   compute pH, solubility, or enthalpy. There must be zero `Math.log`,
   `Math.pow(10`, `pKa`, `Kw`, or `Ksp` in the UI layer. Values reach the UI as
   registered observables or component state fields.
3. **Conservation.** `chemistry-models/material-ledger/ledger.ts` enforces
   integer-unit mass conservation with a hard `conservationViolation` failure.
   Do not weaken it. Every new path must conserve mass and volume.

**Reference implementation to follow.** `computePH` in
`src/lab-workflows/chemistry-models/acid-base/model.ts` was recently rewritten
and is the pattern for all work here. It solves the full charge balance
including water autoionization, via a closed form for the strong-acid case and
a fixed-step bisection for the weak-acid case, in a single continuous function
with no piecewise seams. Read it first. The bug it replaced — piecewise branches
that diverged near the equivalence point and recorded pH −2.28 into the parity
oracle — is exactly the failure mode to avoid.

## Grounding requirement

Every constant you introduce must be a real published value at 25 °C with the
source named in a code comment. Use NIST, the CRC Handbook, or a standard
general-chemistry/AP reference. **Do not invent constants, and do not round a
literature value to something "nicer."** If a value is genuinely uncertain,
say so in the comment rather than picking one silently.

Ground each workflow in a real high-school lab procedure and cite it in the
workflow definition's metadata, so the simulated procedure matches what a
student would actually do at a physical bench.

---

## Work item 1 — Weak acid and weak base titrations

### Current state

- `AnalyteType` (`acid-base/model.ts:63`) is `"strong_acid" | "weak_acid"`.
  **There is no weak base.**
- The titrant is strong-base-only by construction (`config.titrant` carries only
  `concentrationM`).
- `computePH`'s weak branch already solves the correct charge balance by
  bisection — reuse that machinery rather than adding new piecewise formulas.
- **The blocker:** the native capability model hard-wires the analyte to
  `strong_acid` (around `acid-base/model.ts:449`) because registered reagent
  material profiles carry no acid/base dissociation metadata. So the weak-acid
  path is currently reachable only through the legacy engine
  (`src/experiments/titration/titration.ts:582`, `EXAMPLE_WEAK`) and no shipped
  lab can use it.

### What to build

1. **Extend the material profile registry** so a reagent can declare its acid or
   base character: type (`strong_acid` / `weak_acid` / `strong_base` /
   `weak_base`), and `pKa` or `pKb` where applicable. This is the change that
   unblocks everything else. Registry IDs are versioned — follow the existing
   `.v1` conventions and do not mutate published entries in place.
2. **Extend `AnalyteType`** to include `weak_base`, and let the titrant be a
   strong or weak acid as well as a base, so the four combinations work:
   - strong acid × strong base (already correct — must not regress)
   - weak acid × strong base
   - weak base × strong acid
   - weak acid × weak base (see note below)
3. **Generalize the solver.** Extend the charge balance to carry both a weak
   acid and a weak base simultaneously:

   ```
   [H+] + Σ(protonated bases) = [OH-] + Σ(deprotonated acids)
   ```

   For a monoprotic weak acid `Ca`/`Ka` titrated with a weak base `Cb`/`Kb`:

   ```
   [H+] + Cb·[H+]/([H+] + Ka_BH+) = Kw/[H+] + Ca·Ka/(Ka + [H+])
   ```

   where `Ka_BH+ = Kw/Kb`. Left-minus-right is strictly increasing in `[H+]`, so
   the existing bisection converges on the unique root. Keep the fixed iteration
   count. **One continuous function across the whole titration** — no branching
   on region, which is what caused the previous defect.
4. **Wire the native path** so a workflow can author a weak-acid or weak-base
   titration end to end, and add at least one shipped workflow definition that
   uses it (weak acid × strong base is the standard school lab: acetic acid in
   vinegar titrated with NaOH to a phenolphthalein endpoint).
5. **Indicator selection must matter.** With a weak analyte the equivalence pH
   is no longer 7, so indicator choice becomes pedagogically real: phenolphthalein
   (8.2–10.0) suits a weak acid × strong base equivalence near pH 8.7, methyl
   orange (3.1–4.4) suits a weak base × strong acid. Existing indicator ranges in
   `model.ts:165-189` are already correct — do not change them. Ensure the
   engine's endpoint/diagnosis logic reflects a genuinely wrong indicator choice.

### Note on weak × weak

A weak-acid/weak-base titration has no sharp inflection and no indicator gives a
usable endpoint. Support it in the solver for correctness, but if you expose it
as a student workflow, the lesson must be *why the endpoint is unusable* — do not
present it as a normal titration with a detectable endpoint.

### Tests required

- pH monotonically increases across accumulated 0.1 mL additions for all four
  combinations — **walk the accumulation path (`acc = acc + 0.1`), not a grid of
  direct volumes.** The previous bug survived because the test used direct
  volumes while the runtime accumulates floats. See the accumulation tests in
  `tests/lab-workflows/chemistry-models/acidBaseModel.test.ts`.
- pH stays strictly within (0, 14) at every step for every combination.
- Half-equivalence pH equals pKa for a weak acid, and pOH equals pKb for a weak
  base, to 2 decimal places.
- Weak acid × strong base equivalence pH > 7; weak base × strong acid < 7.
- Initial pH matches the closed-form quadratic for a weak monoprotic species.
- Solver output is unchanged under repeated identical runs (determinism).

---

## Work item 2 — Real Ksp in precipitation

### Current state

**There is no solubility product anywhere in the codebase** — grep for `Ksp`,
`solubility product`, and `saturation` returns nothing.
`chemistry-models/precipitation/solubility.ts` is a hard-coded lookup over four
`INSOLUBLE_RULES` keyed on ion identity alone. `predictPrecipitation(a, b)`
takes two solution IDs and **no concentrations, volumes, or amounts**;
`precipitation/model.ts:153-158` explicitly discards `transfer.amount`, and
contents are stored in a `Set` so the state is monotonic — adding more reagent
or diluting can never change the outcome.

Consequences: mixing 10⁻⁹ M AgNO₃ with 10⁻⁹ M NaCl reports a white precipitate,
when Q = 10⁻¹⁸ is six orders of magnitude below Ksp(AgCl) = 1.77×10⁻¹⁰ and
nothing forms. There is no common-ion effect — which is the entire pedagogical
payoff of an AgCl lab.

### What to build

1. **Add a Ksp registry** with real published 25 °C values and cited sources.
   At minimum cover the salts the existing rules produce: AgCl (1.77×10⁻¹⁰),
   BaSO₄ (1.08×10⁻¹⁰), Cu(OH)₂ (2.2×10⁻²⁰), Fe(OH)₃ (2.79×10⁻³⁹). Confirm each
   against your reference before committing it.
2. **Track ion concentrations, not just identities.** Replace the `Set` of
   contents with concentrations derived from the material ledger — amounts and
   volumes are already conserved there, so use them rather than a parallel model.
   Dilution on mixing must be handled.
3. **Test Q against Ksp.** Compute the reaction quotient from actual
   concentrations and precipitate only when Q > Ksp. Report the comparison as a
   registered observable so the interface can show the student *why* something
   did or did not form.
4. **Solve the post-precipitation equilibrium.** After precipitation, remaining
   ion concentrations must satisfy the solubility product, with the excess
   reagent left in solution. This is what produces the common-ion effect for
   free: adding NaCl to a saturated AgCl solution must measurably suppress
   [Ag⁺]. Use a fixed-iteration solver, consistent with the pH solver.
5. **Conserve mass.** Precipitated solid plus dissolved ions must equal what was
   added. Route this through the existing material ledger so the conservation
   check applies.
6. **Report the precipitate mass or amount** as an observable, so a gravimetric
   lab becomes possible. This depends on the mass support built in work item 3 —
   a gravimetric lab is only real if the student can actually weigh the dried
   precipitate on a balance rather than being told its mass.

### Note

The precipitate colours currently in `solubility.ts` are correct (AgCl white,
BaSO₄ white, Cu(OH)₂ blue, Fe(OH)₃ rust brown) — keep them. The rendered colours
now live in `LAB_LIQUID_COLORS` in `src/components/lab/three/labPalette.ts`; any
new precipitate label you introduce **must** be added there, or it silently falls
back to colourless and the student sees nothing. `tests/components/precipitationVisuals.test.ts`
guards this — extend it for new salts.

### Tests required

- A mixture below Ksp produces **no** precipitate (the 10⁻⁹ M case above).
- A mixture above Ksp does precipitate, with the correct salt and colour.
- Common-ion effect: adding a soluble chloride to saturated AgCl measurably
  lowers [Ag⁺], and the product [Ag⁺][Cl⁻] still equals Ksp.
- Mass conservation across precipitation.
- Dilution can move a system from precipitating to not precipitating.

---

## Work item 3 — Solids, mass, and a laboratory balance

**Build this before work item 4.** Dissolution enthalpy is measured by massing a
solid, and right now there is no solid, no mass, and no balance — so a
dissolution lab cannot be performed at all, only asserted. The same applies to
the gravimetric precipitate mass in work item 2.

### Current state — the exact blocker

```ts
// src/lab-workflows/chemistry-models/material-ledger/types.ts:3
export type MaterialQuantityUnitId = "unit.drop.v1" | "unit.ml.v1";
```

A closed union with **no mass unit**. Consequences to fix:

- `quantity.ts:21` applies `VOLUME_UNITS_PER_ML = 1_000_000` only to
  `unit.ml.v1`; every other unit gets `scale = 1`, so a gram quantity would be
  representable only as a whole gram. A mass unit needs its own scale factor.
- The registered unit set is `unit.celsius.v1`, `unit.drop.v1`, `unit.joule.v1`,
  `unit.ml.v1`, `unit.mol_per_l.v1`. No mass unit exists anywhere.
- Every registered component is glassware plus the calorimeter and thermometer
  (`component.burette.v1` … `component.beaker.v1`). **There is no balance.**
- Material profiles carry no molar mass and no phase, so there is no way to
  convert a mass to moles.

One thing already works in your favour: `volumeAt` (`quantity.ts:62-75`) filters
on `unit.ml.v1`, so a solid sitting in a vessel contributes nothing to volume and
cannot corrupt the existing volume-conservation checks.

### What to build

1. **Register a mass unit** (`unit.g.v1`) and add it to `MaterialQuantityUnitId`.
   Give it an explicit integer scale in `quantity.ts` — micrograms
   (`1_000_000` units per gram) matches the volume scale's precision and leaves
   headroom well below any balance resolution you expose. Mass must be a
   first-class ledger quantity so **existing conservation applies to solids
   automatically** — do not build a parallel mass tracker outside the ledger.
2. **Add solid material profiles** with `phase` (solid/liquid/aqueous) and
   **molar mass** in g/mol, with cited values. At minimum the solids your
   workflows need: NH₄NO₃ (80.04 g/mol), CaCl₂ (110.98 g/mol), NaOH
   (40.00 g/mol), NaCl (58.44 g/mol). Molar mass is what makes
   `moles = mass / molar_mass` an engine computation rather than a number handed
   to the student.
3. **Add `component.balance.v1`.** Follow the full registry chain used by every
   other instrument — component entry with a state schema, visual adapter
   (`visual-adapter.balance.v1`), scene placement, and a 3D renderable. Model it
   on `component.thermometer.v1` and `component.calorimeter.v1`, which are the
   closest existing instruments.

   Engine-owned state should cover at least: current reading in grams, tare
   offset, whether something is on the pan, and the balance's resolution.

4. **Add the actions a real weighing requires.** Weighing is a *technique*, and
   the product's whole premise is rehearsing technique — so model the steps a
   student actually performs and can get wrong:
   - `action.tare_balance.v1` — zero the balance with the weighing vessel on it
   - `action.place_on_balance.v1` / remove
   - `action.transfer_solid.v1` — move a mass of solid from a stock container to
     a vessel, in grams
   - `action.read_balance.v1` — the student reads and reports the mass, mirroring
     how `action.read_volume.v1` already works for the burette

   **Forgetting to tare must produce a wrong result**, not a blocked action. That
   is the pedagogical point: the error is recoverable, visible, and explains
   itself. Untared mass should propagate into the computed moles and therefore
   into a measurably wrong molar enthalpy.

5. **Model balance resolution honestly.** A school centigram balance reads to
   ±0.01 g; an analytical balance to ±0.0001 g. Put the resolution on the
   component so a workflow can specify which balance is on the bench, and
   **round the displayed reading to that resolution** — the student should see
   `2.05 g`, not `2.0487213 g`. The underlying ledger quantity stays exact; only
   the reading is quantized.

   **Do not add random noise or drift.** Replay must stay bit-identical, and a
   deterministic quantized reading is both honest and reproducible. If you want
   to teach measurement uncertainty later, it must derive from seeded session
   state, not `Math.random()`.

6. **Expose mass as a registered observable** so the interface can project it.
   Follow `observable.burette_reading_ml.v1` and the equipment-owned observable
   mechanism in `runtime/generic/equipmentObservables.ts` — the balance reading
   is apparatus-owned measurement truth, exactly like the meniscus reading, so it
   belongs in `EQUIPMENT_OBSERVABLE_SOURCES` rather than in a chemistry model.

7. **Accessibility is not optional here.** The burette reading previously existed
   only as rendered pixels, which was a WCAG 1.1.1 failure on the product's
   central measurement; it now reports as text through `equipmentSummary` in
   `src/components/lab/setup-driven/NativeSetupDrivenWorkspace.tsx`. Add a
   `component.balance.v1` case there in the same commit — a new instrument whose
   reading is only visual repeats a defect that was just fixed. Give the action
   a plain-language student label in `actionLabel` too; do not let it fall
   through to the action registry's authoring prose.

### Grounding

Base the weighing procedure on a real school protocol — weighing by difference
using a weighing boat or paper, taring, and transferring to the calorimeter. Cite
the reference in the workflow metadata. The sequence a student rehearses should
match what they will do at a physical bench.

### Tests required

- Mass round-trips exactly through `quantityToIntegerUnits` /
  `integerUnitsToQuantity` at the chosen scale, including awkward values like
  `2.47 g` and accumulated additions.
- Mass is conserved by the ledger: transferring solid out of stock and into a
  vessel preserves the total, and a non-conserving transfer is rejected.
- Adding a solid does **not** change the vessel's liquid volume
  (`volumeAt` still filters correctly).
- Taring then weighing reports the sample mass; **weighing without taring
  reports the vessel-plus-sample mass** and therefore yields a wrong molar
  enthalpy downstream. Assert both.
- The reading is quantized to the component's stated resolution.
- `moles = mass / molar_mass` for each registered solid, to a stated tolerance.
- Determinism: identical action sequences produce identical readings.

---

## Work item 4 — Calorimetry enthalpy

### Current state

`chemistry-models/thermal-energy/model.ts` is a thermal **mixing** model only.
Grep for `enthalpy`, `delta_h`, `exotherm`, `endotherm`, `heat_of`, and `kJ`
returns **nothing**. There is no reaction enthalpy, no ΔH sign convention, and
no `q_rxn = −q_soln` — so the central move of every calorimetry lab is absent.

What exists is dimensionally sound and should be preserved:
`WATER_SPECIFIC_HEAT_J_PER_G_C = 4.184` is correct, and mixing
`T_final = Σ(mᵢTᵢ)/Σmᵢ` is offset-invariant and right.

**There is a latent bug to fix.** `CALORIMETER_CONSTANT_J_PER_C` is currently 0,
which masks an inconsistency: `temperatureFromState` (~`model.ts:205-207`)
divides by a heat capacity that **includes** the calorimeter constant, while
`heatMicroJFor` (~`model.ts:178-198`) and the initializer (~`model.ts:319`)
compute stored heat as `m·c·T` **without** it. Set the constant to 20 J/°C with
100 mL at 25 °C and the calorimeter reads 23.86 °C before the student touches
anything. `heatContentJoules` (~`model.ts:216-227`) omits it too. Make the
stored-heat and reported-temperature definitions consistent, and add a test that
fails with a non-zero constant under the old definition.

Also: `model.ts:189-190` and `model.ts:413` reject `heat < 0`, making any
sub-zero-Celsius state unrepresentable rather than a validation error with a
useful message. Fix or document deliberately.

### What to build

1. **A reaction enthalpy registry** with real published ΔH values and cited
   sources — neutralization (HCl + NaOH, −57.1 kJ/mol is the standard value for
   strong acid/strong base), dissolution (NH₄NO₃ endothermic at roughly
   +25.7 kJ/mol, CaCl₂ exothermic at roughly −82.8 kJ/mol — verify both), and any
   reaction your workflows need. Verify each against your reference.

   **Dissolution enthalpy depends on work item 3.** Moles of solute must come
   from the mass the student actually weighed out, via the molar mass on the
   material profile. Do not let a workflow declare moles directly — if the
   student never weighed anything, the lab is a cutscene, and the measured
   enthalpy is not evidence of anything they did.
2. **Implement `q_rxn = −q_soln`** with `q_soln = m·c·ΔT` and an explicit,
   tested sign convention: exothermic ΔH is negative and raises the measured
   temperature. Getting this backwards is the single most common error in this
   domain — test it directly.
3. **Support a real calorimeter constant** (`C_cal`), used consistently in both
   stored heat and reported temperature, so `q_total = (m·c + C_cal)·ΔT`.
4. **Compute molar enthalpy** — ΔH per mole of limiting reagent — as an
   observable, so a student can compare their measured value against the
   literature value. That comparison is the point of the lab.
5. **Couple to the limiting reagent** via the material ledger, so pouring
   different amounts changes the temperature rise correctly.
6. **Ship a dissolution workflow end to end** — tare the balance, weigh out the
   solid, add it to a known mass of water in the calorimeter, record the
   temperature change, and compute molar ΔH. This is the workflow that proves
   items 3 and 4 actually connect, and it is a standard school lab.

### Note on temperature coupling

The thermal model tracks temperature and the acid-base model assumes 25 °C, and
the two never talk. Full temperature-dependent Kw/Ka is **out of scope** — do not
attempt it. But do not introduce anything that makes it harder later, and leave a
comment where the assumption lives.

### Tests required

- Exothermic neutralization raises the temperature; endothermic dissolution
  lowers it. Assert the sign explicitly.
- Measured molar ΔH for a standard strong acid/strong base neutralization lands
  within a stated tolerance of −57.1 kJ/mol.
- Energy conservation: `q_rxn + q_soln + q_calorimeter = 0`.
- A non-zero calorimeter constant produces a consistent temperature — this test
  must fail against the current inconsistent definitions.
- Limiting reagent governs the temperature change.
- **End-to-end dissolution:** weighing a real mass of NH₄NO₃ into water lowers
  the temperature, and the molar ΔH computed from that weighed mass lands within
  a stated tolerance of the literature value. Weighing a different mass changes
  ΔT but leaves molar ΔH unchanged — that invariant is the whole point of the
  lab, and it only holds if mass, moles, and heat are genuinely coupled.
- Skipping the tare step yields a measurably wrong molar ΔH, confirming the
  student's technique error propagates rather than being silently corrected.

---

## Verification — all of these must pass before you are done

```bash
npx tsc --noEmit          # must be clean
npx vitest run            # all tests pass (866 passing at the time of writing)
npx next build            # must succeed
```

**If you change titration behaviour, the parity oracle will fail.** It pins
legacy-vs-native equivalence. Confirm the diff is *only* what you intended, then
regenerate:

```bash
UPDATE_TITRATION_PARITY_ORACLE=1 npx vitest run tests/lab-workflows/definitions/titrationParityOracle.test.ts
```

Then re-run the full suite so `nativeTitrationParity.test.ts` is checked against
the regenerated fixture. **Never regenerate to make a failure disappear without
understanding it** — that oracle previously pinned pH −2.28 as correct precisely
because someone did.

Add a guard asserting no observable pH value falls outside [0, 14] anywhere in
the regenerated oracle.

## Style

Match the surrounding code: named constants over magic numbers, comments that
explain *why* rather than restate the code, versioned registry IDs, no new
dependencies. Where you make a pedagogical simplification, say so in a comment
and state where it breaks down — the existing note that activity coefficients
are ignored (~0.1 pH units at bench concentrations, standard for AP chemistry)
is the model to follow.

## Deliverable

A summary of: each constant added with its source, each solver and its
convergence argument, what is now possible that was not before, and any
simplification you made with its breaking point stated honestly.
