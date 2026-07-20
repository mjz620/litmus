# CLAUDE.md

## Design Context

Strategic context lives in [`PRODUCT.md`](PRODUCT.md); the visual system lives in
[`DESIGN.md`](DESIGN.md). Read both before designing or changing any surface.

Register is **product** — design serves the lab bench, Composer, and teacher
tools rather than selling them. Platform is **web**, on Chromebook-class
hardware. The primary user is a high-school student rehearsing technique before
a physical lab; teachers are secondary, authoring and reviewing.

The five design principles:

1. **Deterministic truth stays visible.** The engine owns chemistry and
   measurement; the interface projects that state and never computes or
   decorates over it.
2. **Rehearsal, not simulation theatre.** Every surface answers: what do I do
   next, why does it matter, am I ready.
3. **Approachable without being toy.** Lower the intimidation barrier through
   warmth and clear affordances, not by making the chemistry look less real.
4. **Runs on the worst device in the room.** Chromebook-class performance is a
   design constraint, not an optimisation pass.
5. **Evidence over assertion.** Teacher-facing surfaces show recorded actions;
   nothing shown as evidence may be model-generated.

Accessibility bar is WCAG 2.1 AA: keyboard path for every lab action, scientific
state never carried by colour alone, `prefers-reduced-motion` respected.

Engineering rules — chemistry determinism, registry IDs, ownership boundaries —
are in [`AGENTS.md`](AGENTS.md), and the mechanism map is in
[`docs/lab/lab-interfaces-and-mechanisms.md`](docs/lab/lab-interfaces-and-mechanisms.md).
