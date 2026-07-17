# T0140 — In-lab design-system specification

## Completion Report

### Summary

- Authored an implementation-ready design system for the student lab and 3D
  bench, aimed at middle- and high-school students without childish styling.
- Defined exact 3D palette tokens for the near-black bench, warm wood,
  scientific liquids, three saturated indicator identities, fixtures, glass,
  graduations, interaction states, and pastel sky.
- Defined exact route-level UI colors, contrast measurements, spacing,
  typography, radii, shadows, controls, cards, chips, tooltips, prompts, and
  contextual-menu behavior.
- Specified low-poly segment budgets, silhouette rules, material parameters,
  quality-tier parity, and the restriction of nonzero metalness to real
  fixtures.
- Recorded hover, selection, focus, disabled, and active-action treatments plus
  an animation table covering the 650 ms camera tween, 120 ms hover response,
  and 116 ms look-momentum half-life.
- Specified graduation, meniscus, units, focus-pose, and text-redundancy rules.
  The chosen graduation ink has at least 4.0:1 direct contrast against every
  flask and burette liquid color.
- Defined gesture-gated WebAudio opportunities for T0142 without implementing
  sound or changing application code.
- Benchmarked one 512² shadow-casting key with six glass casters and two
  receivers. The candidate added six draw calls and 2.1% to the constrained
  median frame interval, so the spec approves it for high quality only and
  keeps reduced graphics shadow-free.
- Added a concrete T0141 conformance checklist, including palette ownership,
  contrast tests, shadow limits, quality-tier checks, and behavior invariants.
- Added an explicit project-owner review record that separates objective
  conformance evidence from the subjective approval decision.
- Recorded project-owner approval on 2026-07-17 with no requested revisions.

### Files changed

- `docs/design-system.md`
- `docs/Repo_Current_State.md`
- `docs/completion-reports/T0140_In_Lab_Design_System_Specification.md`

No application or test code remains changed by T0140. The temporary local
shadow candidate used for measurement was fully reverted before verification.

### Commands run

- Repository and UX-contract inspection with `sed`, `rg`, and `git status`
- `uname -m`
- `sw_vers -productVersion`
- `npx playwright --version`
- One-off Node luminance-ratio calculations for the specified UI and
  measurement palette
- Local `npm run dev -- --hostname 127.0.0.1`
- Three-run headless Chromium/SwiftShader baseline and one-key shadow benchmark
  using a temporary script outside the repository
- Headless Chromium visual capture of the temporary shadow candidate
- `npx prettier --check docs/design-system.md`
- `npm run typecheck`
- `npm run lint`
- `npm run format:check`
- `npm test`
- `npm run build`
- `npm run test:e2e`
- `git diff --check`

### Build/test results

- Production build passed.
- Strict TypeScript passed.
- ESLint passed.
- Prettier and diff-whitespace checks passed.
- Full unit/component suite passed: 18 files, 127 tests.
- Full unchanged Playwright suite passed in Chromium: 17 tests.
- No application code, chemistry code, action semantics, or tests changed.

### Manual verification performed

- Read the specification against the current overview, burette, flask,
  meniscus, indicator-shelf, and wash-station implementations and their current
  CSS/component states.
- Checked every T0140 requirement against a named section or table in the
  document, including all UI component categories and reduced-motion behavior.
- Calculated the documented WCAG luminance ratios from the exact hex tokens;
  the narrowest graduation/liquid pair is blue at 4.08:1.
- Compared the current no-shadow scene with a temporary one-key candidate at
  1366 × 768. The candidate grounded the flask and burette without obscuring
  graduations.
- Verified that all temporary `castShadow`, `receiveShadow`, Canvas-shadow, and
  shadow-light changes were removed from source before the final test gate.
- No external reference image was supplied or committed; the visual read-through
  used the ticket's written art direction, UX handoff, and current rendered
  scene.
- Project-owner approval was received and recorded after the complete
  pre–Lab Composer implementation and conformance audit.

### Risks / limitations

- The recorded shadow benchmark is a relative SwiftShader stress comparison,
  not a claim that software WebGL sustains 30 FPS. T0141 must run the specified
  rollback check on Chromebook-class hardware if available.
- The p95 frame samples were noisy, so the decision uses median interval and
  exact draw-call deltas. The spec records this limitation explicitly.
- Physical-device aesthetic and accessibility validation can still reveal
  deployment-specific refinements, but the T0140 owner-review acceptance gate
  is complete.
- T0141 must preserve the chemistry-owned observed-color meanings while moving
  their render colors into the centralized 3D palette.

### Follow-up tickets suggested

- `T0141 — Apply palette, materials, and lighting`
- `T0142 — Procedural sound` after the visual pass, if desired

### Docs needing update

- None after updating `docs/Repo_Current_State.md` and adding this completion
  report.
