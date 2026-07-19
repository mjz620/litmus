# Reproduction Checklist — S0–S2 Lab Composer Issues

Compact steps to reproduce every S0–S2 finding from `strict-product-judge-report.md`. Run against
`npm run dev` at http://localhost:3000, commit `dc04d7f`. No login or flags required.

Automated reproductions of the two logic-layer bugs live in
`tests/lab-workflows/authoring/qaReproductions.test.ts` (run: `npx vitest run
tests/lab-workflows/authoring/qaReproductions.test.ts`).

---

## S1 — TEACHER-001 · No new/blank lab
1. Open `/teacher/lab-composer`.
2. Scan the status bar and stage nav for any "New / Blank / Start over" control.
3. **Observe:** none exists. Define already lists titration objectives; Set up already has
   burette + flask + indicator; Assess already has 2 grading items. Every lab is a titration variant.

## S1 — TEACHER-002 · No persistence; refresh destroys work
1. Open `/teacher/lab-composer` → **Workflow** → Student directions.
2. Type a Title and Guidance, click **Add direction** (it is added).
3. Press **F5** (or browser Back then Forward).
4. **Observe:** the editor is back to the default "Endpoint practice" titration; the added direction
   is gone; no "unsaved changes" prompt appeared.

## S2 — TEACHER-005 · Reagent↔container pairing unconstrained
1. **Set up** → in the left panel set **Material** = `0.100 M hydrochloric acid`.
2. Leave **Put it in** on `Best available container`.
3. Click **Add material**.
4. **Observe:** the "Bound materials" list now shows `0.100 M hydrochloric acid — Analyte flask`
   *and* `0.100 M hydrochloric acid — Titrant burette`. The burette already holds
   `0.100 M sodium hydroxide`, so it now contains acid **and** base. No warning.
5. (Optional) **Check & preview** → **Check lab** → still reports "Preview is ready."
- Automated: `qaReproductions.test.ts` → *"acid can be bound into the burette that already holds base."*

## S2 — SYSTEM-002 · Checker approves impossible measurement ranges
1. **Workflow** → **What should the lab check?** = `A measured result`.
2. Set **Lowest value** = `-5`, **Highest value** = `-1`.
3. Click **Add result range** (it is added — the Workflow tab count increments).
4. **Check & preview** → **Check lab**.
5. **Observe:** "All required checks passed. Preview is ready." for an impossible negative burette range.
6. Reversed variant: set Lowest = `25.05`, Highest = `24.95`, click **Add result range** →
   **Observe:** nothing is added and no message explains why (silent — see TEACHER-004).
- Automated: `qaReproductions.test.ts` → SYSTEM-002 block.

## S2 — TEACHER-003 · Rejected edits give no feedback (Define/Assess/removal/instructions)
1. **Assess** → **New grading item**; or **Define** → edit and **Save definition**.
2. Trigger a rejectable edit (e.g. a duplicate/invalid save).
3. **Observe:** the command fails but the UI shows nothing — `itemErrors` for these stages is never
   rendered (`metadata`, `objective:*`, `criterion:*`, `removal`, and the instruction default key).

## S2 — TEACHER-004 · Silent no-op Add/Save buttons on blank fields
1. **Workflow** → Student directions. Leave **Title** and **Guidance** blank.
2. Click **Add direction**.
3. **Observe:** nothing is added, no message, no required-field marker. (Same for "Add student
   action" and "Add result range" with missing input.)

## S2 — TEACHER-007 · Zero-point grading items
1. **Assess** → **New grading item** (or edit one).
2. Set **Maximum points** = `0`, fill description/objective/evidence, **Save**.
3. **Observe:** accepted. The generated scoring guide reads `0: evidence absent` /
   `0: evidence demonstrated` — full credit equals zero. (Same hole for scoring rules in the Workflow
   card inspector.)

## S2 — TEACHER-008 · Engineering jargon in teacher chrome
1. Open `/teacher/lab-composer`; read the stage nav, status-bar button tooltips, and each stage.
2. **Observe** terms a teacher won't understand: "Workflow," "Rules," "Authoring task," "instance"
   ("Select an equipment instance."), "validator" ("Assessment validator findings"), "dependency
   graph," "rule inspector," "supported simulation," "Bound materials," "Registered container,"
   "isolated preview." Full list in `docs/qa/teacher-language-inventory.md`.

## S2 (suspected) — SETUP-001 · 3D bench blank on WebGL failure
1. Open the Set up stage in an environment without WebGL (headless Chromium, or a browser with
   hardware acceleration / WebGL disabled — as on some school Chromebooks).
2. **Observe:** the default **3D bench** area renders as an empty box; the console logs
   `THREE.WebGLRenderer: Error creating WebGL context`; the "3D is unavailable. Use the Accessible
   list above." fallback does **not** appear. Workaround: click **Accessible list**.
- Note: on hardware with working WebGL the 3D bench renders normally — this is environment-dependent.

---

### Regressions to keep green after fixes
- Draft survives refresh / Back / reopen (TEACHER-002).
- Reagent pairing: one reagent per container, no duplicate placement, no silent auto-pick (TEACHER-005).
- Blank Add/Save is blocked with a visible reason (TEACHER-004); all rejections render (TEACHER-003).
- Checker fails negative/reversed ranges, 0-point grading, 0-minute duration (SYSTEM-002/TEACHER-007).
- No banned engineering terms in the Composer's visible text/aria on the happy path (TEACHER-008).
