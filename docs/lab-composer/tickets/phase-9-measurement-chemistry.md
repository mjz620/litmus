# Phase 9 — Measured Extensions to Deterministic Chemistry

## LC2-913 — Measured solids, balance mechanics, and dissolution calorimetry

**Objective:** Make solid mass a conserved ledger quantity, add a deterministic
school-balance technique path, and use the student-weighed solute mass to drive
the existing thermal model's dissolution enthalpy evidence.

**Dependencies:** `LC2-912`.

**Required changes:** register `unit.g.v1`, solid phase/molar-mass material
profiles, a balance component/pose/visual/mechanics/actions/observables, exact
mass transfers, tared versus untared deterministic readings, and a real
coffee-cup dissolution workflow. Thermal state must use a non-zero registered
calorimeter constant consistently in stored heat and reported temperature.
Reaction enthalpy, moles, limiting quantities, and all displayed observables
remain deterministic engine outputs. Literature constants and procedure sources
must be cited in code and workflow metadata.

**Acceptance:** A student can tare, weigh, transfer NH4NO3 into water, observe a
mass-derived endothermic temperature change, and receive a measured molar
enthalpy. Skipping tare produces a deterministically wrong measured value.

## LC2-914 — Generalized native weak-acid and weak-base titration

**Objective:** Extend registered material profiles and the native acid/base
model so all strong/weak monoprotic acid/base combinations use one fixed-step,
charge-balance solver with exact replay.

**Dependencies:** none beyond the current native titration path.

**Acceptance:** A shipped acetic-acid/NaOH workflow reaches a real
phenolphthalein-appropriate endpoint; unsuitable indicators produce the
deterministic diagnosis. Accumulated 0.1 mL paths are monotonic and bounded for
all four acid/base combinations.

## LC2-915 — Quantitative Ksp precipitation and measured gravimetry

**Status:** Complete.

**Objective:** Replace identity-only precipitation with ledger-derived ion
concentrations, cited 25 °C Ksp values, fixed-step post-precipitation
equilibrium, and a balance-measured precipitate mass.

**Dependencies:** `LC2-913` for gravimetric measurement.

**Acceptance:** Dilute mixtures below Ksp do not precipitate, saturated/common
ion AgCl obeys Ksp after the fixed equilibrium solve, and precipitated mass is
conserved and actually weighed through the balance path.

**Implemented:** The native precipitation model derives integer-scaled ion
inventories from conserved ledger volumes and registered concentrations, tests
Q against a cited 25 °C Ksp registry, and uses 200 fixed bisection steps for the
unique post-precipitation extent. It reports Q, Ksp, saturation ratio, free
silver/chloride, amount, and dry mass as registered observables. The shipped
silver-chloride workflow follows the RSC filter/wash/dry gravimetry procedure
and sends the engine-owned dry mass through the existing centigram-balance
measurement path.
