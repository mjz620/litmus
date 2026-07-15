# Experiment 2 — Precipitation / Solubility

## Purpose

Prove the plugin architecture generalizes beyond titration without duplicating the shell, coach, evaluator, or persistence stack.

## Core interactions

- Select two ionic solutions.
- Mix solutions.
- Observe precipitate formation/color.
- Identify spectator ions.
- Write complete ionic and net ionic equations.

## Deterministic engine

- Solubility-rules lookup table.
- Ion decomposition.
- Product candidate generation.
- Precipitate identity and color.
- Net ionic equation generator.

## Example skills

- `ion_dissociation`
- `solubility_rules`
- `net_ionic_equation`
- `spectator_ions`

## Useful misconception events

- Predicts precipitate for always-soluble nitrate/sodium salt.
- Includes spectator ions in net ionic equation.
- Fails to balance charge/equation.
- Chooses two soluble products but expects visible precipitate.

## P1 acceptance

- Registers via common experiment registry.
- Uses shared lab shell and coach panel.
- Emits semantic events.
- Persists session data through same checkpoint route.
- Has at least five truth tests.
