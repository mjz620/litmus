# Phase 0 — Remaining Characterization

## LC2-001 — Targeted legacy behavior gap closure

**Status:** Optional. Run only if review identifies a concrete behavior required by the compatibility matrix that is not already asserted.

**Objective:** Add the smallest missing black-box characterization fixture before changing that behavior in a later ticket.

**Dependencies:** `LC2-000` complete.

**Allowed areas:** Existing relevant test folders, test fixtures, and documentation clarification. Production code only when exposing an already-existing read-only test seam is unavoidable and explicitly justified.

**Do not touch:** Runtime behavior, schemas, registries, chemistry formulas, UI design, persistence schema, agent routes.

**Procedure:**

1. Search existing tests listed in [`../current-system-map.md`](../current-system-map.md).
2. State the missing compatibility assertion exactly.
3. Add a black-box test against current public behavior.
4. Avoid snapshots when a semantic assertion is clearer.
5. Record the test as a migration anchor in the architecture compatibility table.

**Candidate gaps only if not already covered:** authored-workflow provenance reaching report evaluation; seeded demo checkpoint replay; UI-visible current-step rejection; fixed route reload behavior; current report fallback evidence; coach panel trigger/silence transition.

**Acceptance:** The new test passes against current behavior, changes no product semantics, and names the later LC2 ticket that will replace or preserve it.

**Stop:** If the test would require implementing the future abstraction, stop and defer it to that abstraction's ticket.
