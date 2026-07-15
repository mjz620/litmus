# Hero Experiment — Acid-Base Titration

## Scientific scope

Build Week version supports AP/high-school-appropriate titration scenarios:

- strong acid / strong base,
- optional weak acid / strong base if already implemented and tested,
- 50.00 mL burette readable to ±0.05 mL,
- pH curve generated from deterministic engine,
- indicator selection,
- endpoint/equivalence distinction,
- sig fig handling in report feedback.

## Required actions

- `rinse_burette` with water or titrant.
- `fill_burette`.
- `set_indicator`.
- `add_titrant` with volume and duration.
- `read_meniscus`.
- `record_endpoint`.
- `submit_observation`.
- `reset` or `seed_retry` through controlled route.

## Required skills

- `burette_conditioning`
- `endpoint_control`
- `volumetric_reading`
- `stoichiometry`
- `sig_figs`

## Core mistake scenarios

- Rinses burette with water instead of titrant.
- Adds titrant too quickly near endpoint.
- Overshoots endpoint.
- Misreads meniscus outside ±0.05 mL.
- Chooses incompatible indicator.
- Treats endpoint and equivalence point as identical.
- Calculates concentration with wrong stoichiometric ratio.
- Reports excessive significant figures.

## Required visual behavior

- Burette volume level reflects engine state.
- Flask color reflects indicator and pH.
- pH graph updates from engine curve.
- Stopcock control supports coarse/fine additions.
- Meniscus reading UI is precise and accessible.

## Required tests

- Strong/strong equivalence volume correct.
- pH monotonic during titrant addition.
- Equivalence pH behavior matches configured chemistry scope.
- Fast near-endpoint addition emits flag.
- Controlled dropwise addition stays silent.
- Water rinse impacts downstream result when modeled.
- Seed at 22.00 mL creates consistent state and curve.
- Invalid seed rejected.
