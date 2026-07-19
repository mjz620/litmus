# Strict Product Judge Report

> **Remediation status (2026-07-18):** The judging verdict below is the
> point-in-time assessment. Since then, tickets `LC2-410`–`LC2-414` have landed,
> resolving the S1/S2 release blockers: draft persistence + unsaved-change guard
> (TEACHER-002), reagent↔container pairing (TEACHER-005), blank-lab start
> (TEACHER-001), silent-failure elimination (TEACHER-003/004), and plausibility
> validation for ranges/points/duration (SYSTEM-002/TEACHER-007). Still open:
> `LC2-415` (teacher-language & raw-error containment, TEACHER-008/006) and
> `LC2-416` (ordering attribution, WebGL fallback, preview-error detail;
> WORKFLOW-001/SETUP-001/PREVIEW-002). See
> `docs/lab-composer/tickets/phase-4-human-composer.md`.

Scope for this pass: the **teacher-facing Lab Composer** (`/teacher/lab-composer`) and its Preview
round-trip. The natural-language "composer agent," AI generation, AI teaching Judge, assignment,
and student-results surfaces are **not implemented yet** and were treated as out-of-scope per the
review request. Where those hooks are visible in the UI (e.g. the disabled **Assign** button, the
"AI teaching review · optional" panel) they are judged only as *dead controls a teacher can see*.

## 1. Executive verdict

**Prototype-only.** A chemistry teacher cannot currently create, trust, or hand off a lab without
help.

Three facts decide this:

1. **Every lab is a titration clone.** The Composer always boots from one hard-coded titration draft
   (`NATIVE_TITRATION_V2_DRAFT`). There is no "New lab" / "Start blank" control anywhere. To make a
   different lab a teacher must manually delete every pre-built objective, rule, grading item, and
   piece of equipment first.
2. **Work vanishes on refresh, silently.** The working lab lives only in React state. A page refresh,
   Back button, or accidental navigation throws away all unsaved edits and resets the editor to the
   default titration, with no autosave and no "unsaved changes" warning.
3. **The checker green-lights chemically impossible labs.** The "Check lab" step reports
   *"All required checks passed. Preview is ready."* for setups that are physically nonsense — acid
   bound into the burette that already holds the base, and an "accepted result" range of −5 mL to
   −1 mL for a burette reading.

On top of these, the primary flows leak engineering language ("Workflow," "Rules," "instance,"
"validator," "dependency graph," "supported simulation," "Bound materials") that a non-technical
teacher will not understand, and several Add/Save buttons fail silently on blank input.

The build is internally sophisticated and the *preview simulation itself* (the mature titration
scene) is good. But as a **tool a teacher uses unassisted**, it is not classroom-ready.

## 2. Test environment

| Field | Value |
| --- | --- |
| Commit | `dc04d7f` (HEAD) |
| Branch | `main` (working tree dirty; Composer files are staged/untracked local work) |
| App | Next.js 16.2.10 (Turbopack), `npm run dev`, http://localhost:3000 |
| Routes exercised | `/teacher/lab-composer`, `/teacher/lab-composer/preview` |
| Browser | Chromium 1208 via Playwright 1.58.2 (headless) |
| Viewports | 1440×900, 1280×720, 1024×768, 768×1024 |
| Accounts / flags | None required; Composer is unauthenticated in dev. No feature flags. |
| Seed | Composer self-seeds `NATIVE_TITRATION_V2_DRAFT` on every load |

Undocumented-setup defects: none blocking — `npm run dev` starts cleanly. Note that the review
request's documented "AI generation" and "assign/results" workflows have no implementation behind
them yet; a teacher following that documentation would hit dead ends.

## 3. Core workflow scorecard

Scale: 0 impossible · 1 fundamentally broken · 2 major workarounds · 3 functional but confusing/
unreliable · 4 mostly clear/reliable · 5 classroom-ready.

| Workflow | Score | One-line evidence |
| --- | --- | --- |
| Discovering the Lab Composer | 3 | Reachable at `/teacher/lab-composer`; the page's only back-link is "← Classes," and it is unverified that the Classes dashboard links *to* the builder. |
| Manually creating a lab | 2 | Possible only by editing the pre-seeded titration; no way to start a blank lab (TEACHER-001). |
| Generating a lab with AI | 0 | Not implemented; the "AI teaching review" panel is a dead, always-"Not run" control. |
| Editing a generated lab | 2 | You can edit the seed draft, but Save/Add on several stages fail silently (TEACHER-003/004) and nothing survives a refresh (TEACHER-002). |
| Previewing the student experience | 3 | Preview is correctly gated and the round-trip preserves the draft, but the checker must be re-run after *every* edit and Preview always launches the hard-coded `acid_base_titration` scene regardless of what was authored. |
| Assigning a lab | 0 | The **Assign** button is permanently disabled ("Assignment is not available yet"). |
| Interpreting student results | 0 | No results view exists in the Composer scope. |
| Recovering from errors | 2 | The removal-impact dialog is genuinely good, but blank-field clicks and rejected commands fail with no message, and refresh loses everything. |
| Student completion experience (via Preview) | 3 | The titration sim is mature; but the 3D bench renders a blank box with no message when WebGL is unavailable (common on school Chromebooks). |

## 4. Highest-risk findings (ranked)

1. **TEACHER-002 · No persistence; refresh silently destroys the lab** — S1.
2. **TEACHER-001 · No way to start a new/blank lab; every lab is a titration clone** — S1.
3. **TEACHER-005 · Reagent↔container pairing is unconstrained** (acid into the base's burette; one
   reagent in two containers; "Best available container" auto-picks silently) — S2.
4. **SYSTEM-002 · Checker approves chemically impossible measurement ranges** (negative / reversed
   burette volumes) — S2.
5. **TEACHER-003 · Command failures written to un-rendered error keys → silent rejects** on Define,
   Assess, removal, instructions — S2.
6. **TEACHER-004 · Add/Save buttons are silent no-ops on blank required fields** — S2.
7. **TEACHER-007 · Zero-point grading items are creatable; scoring guide reads "0 = full credit"** — S2.
8. **TEACHER-008 · Pervasive engineering jargon in always-visible chrome** ("Workflow," "Rules,"
   "instance," "validator," "dependency graph," "supported simulation") — S2 (aggregate).
9. **SETUP-001 · 3D bench (default view) is a blank box with no message when WebGL fails** — S2 (suspected, environment-dependent).
10. **TEACHER-006 · Raw internal exception text can reach the teacher's error banner** ("Local draft
    storage is available in the browser only," "The selected local draft is missing") — S3.

## 5. Teacher interpretability audit

Consolidated worst offenders. Full inventory in `docs/qa/teacher-language-inventory.md`.

| Current wording | Location | Why it is confusing | Teacher's actual goal | Recommended wording |
| --- | --- | --- | --- | --- |
| `Select an equipment instance.` | ComposerSetupWorkspace.tsx:879 | "instance" is code (`instanceId`); a teacher has no such concept | Pick a piece of equipment to edit | "Select a piece of equipment to edit." |
| `Workflow` (stage tab + `Workflow view`) | composerStages.ts:43; ComposerWorkflowGraph.tsx:309 | BPM/engineering term shown on every screen | Order the lab's steps | "Steps" / "Procedure" |
| `Rules` (stage subtitle) | composerStages.ts:44 | Exposes the internal rule model; UI elsewhere calls these "cards" | The checks the lab watches for | "Checks" |
| `Workflow dependency graph` (aria-label) | ComposerWorkflowGraph.tsx:385 | "dependency graph / node / edge" is textbook CS | See which steps must come first | "Diagram of which steps come first" |
| `Selected rule inspector` · `Save rule` · `Remove rule` | ComposerWorkflowGraph.tsx:607,721,733 | "rule / inspector" breaks the "cards" metaphor used everywhere else | Edit the selected card | "Selected card details" / "Save card" / "Remove card" |
| `Assessment validator findings` | ComposerAssessWorkspace.tsx:100 | "validator" is pure engineering | See grading problems to fix | "Grading issues to review" |
| `…cannot work together in the current supported simulation.` | LabComposer.tsx:99–100 | "supported simulation" = engine-compatibility framing | Understand why two choices conflict | "…can't be used together in this lab type." |
| `This equipment cannot run in this position in the current simulation.` | ComposerSetupWorkspace.tsx:234 | Equipment doesn't "run"; "simulation" is the engine | Understand why a spot is blocked | "This equipment can't go in this spot for this lab type." |
| `Bound materials` · `Registered container` | ComposerSetupWorkspace.tsx:603,616 | "bound"=data-binding, "registered"=registry | See the reagents they've placed | "Materials in this lab" / "its container" |
| `Authoring task` · `Lab authoring stages` · `Composer navigation` | ComposerStageChrome.tsx:43,70; ComposerStageNavigation.tsx:22 | "authoring"=CMS/dev; "Composer" contradicts the "Lab builder" title | Know which build step they're on | "Build step" / "Lab building steps" / "Lab builder navigation" |
| `This lab has a structural problem and cannot be previewed.` | LabComposer.tsx:1032 | "structural problem" (schema-invalid) is not actionable | Learn what to fix | "Something in this lab is incomplete, so it can't be previewed yet — run Check lab to see what to fix." |
| `Open isolated preview` / `Validation is required first` (button titles) | LabComposer.tsx:898–899 | "isolated," "validation" are systems terms | Open a student preview | "Open a student preview" / "Check the lab first" |

**Naming inconsistency:** the product is titled **"Lab builder"** (page eyebrow) but the code calls
it **"Composer"** in multiple aria-labels and the Preview links. Standardize on one visible name.

**Metaphor conflict:** checks are shown as **"cards"** in the graph but as **"rules"** in the
inspector and stage subtitle. Pick one.

## 6. Confirmed bugs

---
**ID:** TEACHER-001
**Title:** No way to start a new or blank lab — the builder is permanently seeded with the titration lab
**Severity:** S1 **Status:** Confirmed **Persona:** Teacher
**Location:** `LabComposer.tsx:180-182`; status bar `:855-911`
**Evidence:** `useState<...>(NATIVE_TITRATION_V2_DRAFT)`. The status bar offers only
Undo/Redo/Save/Check/Preview/Assign — no "New." "Load selected" only restores a previously *saved*
draft over the current one.
**Preconditions:** Fresh load.
**Reproduction:** 1) Open `/teacher/lab-composer`. 2) Look for any "new / blank / start over"
control. 3) None exists — the Define stage is already filled with titration objectives, the Set up
stage already has a burette/flask/indicator, and Assess already has 2 grading items.
**Expected:** A teacher can start an empty lab (or pick "titration" as an explicit template).
**Actual:** Every lab begins as a fully-built acid–base titration that must be dismantled by hand.
**User impact:** Teachers cannot author anything except a variant of the shipped titration. A teacher
who wants, say, a "measure and record" lab has to delete ~a dozen pre-built pieces first.
**Interpretability problem:** The builder implies it is general-purpose ("Build a student lab") but is
effectively a single-lab editor.
**Likely source area:** `LabComposer.tsx` initial draft; needs a blank-draft factory + template picker.
**Recommended correction:** Add a "New lab" entry that seeds a minimal valid empty draft, and present
titration as one selectable template rather than the forced default.
**Regression test:** Given a blank-draft factory, a new draft has 0 equipment / 0 rules / 0 criteria
and still validates its own emptiness with teacher-friendly "add at least one objective" guidance.

---
**ID:** TEACHER-002
**Title:** The lab is not saved anywhere by default; refresh / Back destroys all unsaved work with no warning
**Severity:** S1 **Status:** Confirmed **Persona:** Teacher
**Location:** `LabComposer.tsx:180` (state), `:240-264` (mount effect), `:495-509` (manual Save)
**Evidence:** The draft lives only in React state; there is no `beforeunload` handler and no autosave.
On reload the mount effect only restores a one-shot `sessionStorage` *preview-return* draft, then
deletes it. Driven test: after editing and reloading, the editor showed the default "Endpoint
practice" titration again — the edit was gone.
**Preconditions:** Any unsaved edit.
**Reproduction:** 1) Change anything (e.g. add a direction). 2) Press F5 / browser Back. 3) The
editor is back to the default titration; the change is lost, no prompt appeared.
**Expected:** Edits autosave (or at minimum a "You have unsaved changes" prompt blocks navigation).
**Actual:** Silent, total loss of unsaved work.
**User impact:** A teacher who spends 20 minutes building a rubric and bumps refresh loses everything.
This alone will erode trust in the tool on first use.
**Interpretability problem:** Nothing on screen tells the teacher their work is *only* in memory; the
"Save" button implies work is otherwise safe.
**Likely source area:** `LabComposer.tsx`; add localStorage autosave keyed per-draft + `beforeunload`.
**Regression test:** Persisting a draft to storage and re-mounting the component restores that draft
rather than `NATIVE_TITRATION_V2_DRAFT`.

---
**ID:** TEACHER-005
**Title:** Reagents are not paired with containers — acid can be dropped into the base's burette; "Best available container" picks silently
**Severity:** S2 **Status:** Confirmed **Persona:** Teacher (chemistry-correctness)
**Location:** `ComposerSetupWorkspace.tsx:557-597` (Material / "Put it in" / Add material);
`LabComposer.tsx:714-732` (`bindMaterialToContainer`); guard is capability-only in
`catalog.ts:50-67` (`compatibleContainers`).
**Evidence:** The "Put it in" select defaults to **"Best available container"** (empty value); Add
material then binds to `containerId || containerChoices[0]`. Driven test bound **0.100 M hydrochloric
acid** while the burette already held **0.100 M sodium hydroxide** — the acid landed in the *titrant
burette*. Reproduced at the command layer (`qaReproductions.test.ts`): binding the acid into the
burette returns `ok:true`, leaving the acid in two containers and two reagents in the burette. The
only check is material↔container *capability* compatibility; there is no "one reagent per container"
and no "already placed" rule.
**Preconditions:** Set up stage.
**Reproduction:** 1) Set up → Material = "0.100 M hydrochloric acid," leave "Put it in" on "Best
available container." 2) Click **Add material**. 3) The bound list now shows HCl in **Analyte flask**
*and* **Titrant burette** (which already contains NaOH). No warning.
**Expected:** A reagent is paired with a specific container *before* it enters the setup; a container
holds one reagent; the same reagent cannot occupy two containers; "Best available" should never
silently choose.
**Actual:** Chemically contradictory setups are built silently, and the checker later passes them.
**User impact:** Teachers (the domain experts) get a lab that is chemically wrong with no signal —
directly undermining the product's credibility as a chemistry tool. This is the reported priority.
**Interpretability problem:** "Best available container" hides a real chemistry decision behind an
auto-pick; "Bound materials" obscures what actually happened.
**Likely source area:** authoring `bind_material` command validation + Set up UI. Requires a
reagent+container pairing model (and, per the product direction, more glassware so each reagent has a
correct home) and one-reagent-per-container enforcement.
**Regression test:** `qaReproductions.test.ts` → *"acid can be bound into the burette that already
holds base"* documents the current behavior; the accompanying `it.fails` encodes the desired
"two reagents in one container should not be runnable."

---
**ID:** SYSTEM-002
**Title:** The checker approves chemically impossible measurement ranges (negative / reversed volumes)
**Severity:** S2 **Status:** Confirmed **Persona:** Teacher
**Location:** `LabComposer.tsx:782-813` (`addToleranceRule`); validation `validateLabWorkflowSpecV2`.
**Evidence:** Adding a "measured result" range of **−5 to −1** (an impossible burette reading) was
accepted, and re-running Check lab reported *"All required checks passed. Preview is ready."*
Reproduced in `qaReproductions.test.ts` (`it.fails` shows the validator marks it runnable). A
**reversed** range (min 25.05 > max 24.95) was silently rejected with no message (see TEACHER-004).
**Preconditions:** Workflow stage → "A measured result."
**Reproduction:** 1) Workflow → What should the lab check? = "A measured result." 2) Lowest = −5,
Highest = −1. 3) Add result range → added. 4) Check & preview → Check lab → "Preview is ready."
**Expected:** Negative volumes are rejected with a chemistry-oriented message; reversed ranges are
rejected *with feedback*.
**Actual:** Negative range accepted and marked runnable; reversed range silently ignored.
**User impact:** A teacher can ship a lab whose "correct answer" range is physically impossible, so no
student can ever satisfy it — discovered only when students fail.
**Interpretability problem:** The success banner actively misleads ("all checks passed").
**Likely source area:** tolerance-rule validation; add unit-aware plausibility bounds per observable.
**Regression test:** `qaReproductions.test.ts` → SYSTEM-002 block.

---
**ID:** TEACHER-003
**Title:** Rejected edits on Define, Assess, removal, and instructions produce no visible feedback
**Severity:** S2 **Status:** Confirmed **Persona:** Teacher
**Location:** `itemErrors` is rendered only for Setup (`LabComposer.tsx:1056`) and the graph
(`:1240`). Failures under keys `metadata` (`:1092`), `objective:*` (`:1097`), `criterion:*`
(`:1342-1357`), `removal` (`:332-336`), and the default `command` key for instructions (`:823`) are
never displayed. The dead `errorPath` state (`:196`) is set six places and rendered nowhere.
**Evidence:** Code paths above; `ComposerDefineStage`'s "Save definition" ignores the returned
boolean.
**Reproduction:** Trigger any rejectable edit on Define/Assess (e.g. a duplicate/invalid save) — the
command fails and the UI shows nothing.
**Expected:** Every rejected command explains itself next to the control.
**Actual:** Silent rejection; the teacher believes the edit worked.
**User impact:** Teachers cannot tell a saved change from a dropped one.
**Likely source area:** wire `itemErrors[...]` (and a real error path) into Define/Assess/removal.
**Regression test:** A rejected `update_metadata` renders a visible, teacher-friendly message on the
Define stage.

---
**ID:** TEACHER-004
**Title:** Add/Save buttons silently do nothing when required fields are blank
**Severity:** S2 **Status:** Confirmed **Persona:** Teacher
**Location:** `addInstruction` (`:815-836`), `addActionRule` (`:756-780`), `addToleranceRule`
(`:782-813`) each early-`return` on missing input; the buttons (`:1200`, `:1230`, `:1311`) are not
disabled and the Title/Guidance fields carry no "required" marker.
**Evidence:** Driven test — clicking **Add direction** with empty Title/Guidance left the direction
list unchanged (7 → 7) and produced no alert.
**Reproduction:** 1) Workflow → Student directions. 2) Leave Title and Guidance blank. 3) Click **Add
direction** → nothing happens, no message.
**Expected:** The button is disabled until required fields are filled, or clicking explains what is
missing; required fields are marked.
**Actual:** The click is silently ignored.
**User impact:** The control looks broken; teachers can't tell what is required.
**Likely source area:** disable-when-invalid + required markers on the three inline forms.
**Regression test:** The "Add direction" button is disabled while Title or Guidance is empty.

---
**ID:** TEACHER-007
**Title:** Zero-point grading items are creatable; the auto scoring guide then reads "0 = full credit"
**Severity:** S2 **Status:** Confirmed **Persona:** Teacher
**Location:** `ComposerAssessWorkspace.tsx:236-275` (`CriterionInspector.save`, `Number.isFinite(0)`
passes; input `min="0"` at `:301`); scoring guide built at `:265-269`. Same hole for scoring rules:
`ComposerWorkflowGraph.tsx:600,668-673`.
**Evidence:** A criterion worth 0 points saves; the generated guide becomes `"0: evidence absent"`
and `"0: evidence demonstrated"` — full credit equals zero.
**Reproduction:** Assess → New grading item → set Maximum points = 0 → Save → accepted.
**Expected:** Grading items require ≥ 1 point.
**Actual:** 0-point items pass and corrupt the rubric total.
**User impact:** Silent mis-grading; a rubric row that can never award credit.
**Likely source area:** criterion + scoring-rule point validation (require > 0).
**Regression test:** Saving a criterion with `points = 0` is rejected with a visible message.

---
**ID:** TEACHER-006
**Title:** Raw internal exception text can surface in the teacher's error banner
**Severity:** S3 **Status:** Confirmed **Persona:** Teacher
**Location:** `LabComposer.tsx:62-64,70-73` (thrown `TypeError`s), surfaced via `setError(err.message)`
in `saveDraft` (`:506`), `loadDraft` (`:529`), undo/redo (`:460-464,486-490`), and the preview-return
path (`:256`).
**Evidence:** Messages like *"Local draft storage is available in the browser only."* and *"The
selected local draft is missing."* render directly in the `role="alert"` banner.
**Reproduction:** Force a storage/load failure (e.g. Load with a missing saved draft) → the raw
message appears.
**Expected:** All errors pass through a teacher-copy map like the existing `teacherCommandError()`.
**Actual:** Engineering phrasing reaches the teacher.
**User impact:** Confusing, non-actionable errors; leaks implementation vocabulary.
**Likely source area:** funnel `.message`/`.reason`/`issue.message` through one friendly mapper.
**Regression test:** A failed Load renders "That saved lab could not be found," never the raw
`TypeError` text.

---
**ID:** TEACHER-008
**Title:** Engineering jargon throughout the always-visible builder chrome
**Severity:** S2 (aggregate) **Status:** Confirmed **Persona:** Teacher
**Location:** See `docs/qa/teacher-language-inventory.md`. Headline leaks: "Workflow," "Rules,"
"Authoring task," "instance," "validator," "dependency graph," "rule inspector," "supported
simulation," "Bound materials," "Registered container," "isolated preview."
**Evidence:** Full string sweep of every teacher-facing file.
**User impact:** The product principle ("feel like a chemistry teaching tool, not a developer tool")
is violated on the stage nav and status bar that are on screen at all times.
**Recommended correction:** Apply the inventory's replacements; standardize "Lab builder" and the
"cards" metaphor.
**Regression test:** A rendered-DOM test asserts none of the banned terms appear in the Composer's
visible text or aria-labels on the happy path.

---
**ID:** WORKFLOW-001
**Title:** Ordering connections auto-attach to an arbitrary objective and offer only generic errors
**Severity:** S3 **Status:** Confirmed **Persona:** Teacher
**Location:** `LabComposer.tsx:1250-1253` (`objectiveIds:[draft.objectiveIds[0] ?? ""]`);
`ComposerWorkflowGraph.tsx:167-170,284-296` (self-loop attemptable; one generic error).
**Evidence:** New ordering dependencies hardcode the first objective (or `""` if none). Connecting a
single card to itself is possible; the only feedback is "That order cannot be added. Check for a loop
or an existing connection," which never distinguishes loop / duplicate / self.
**User impact:** Ordering relationships get misattributed; teachers can't tell why a connection failed.
**Regression test:** Connecting two cards prompts for (or clearly inherits an explained) objective;
distinct errors for cycle vs duplicate vs self.

---
**ID:** DEFINE-001
**Title:** Estimated duration can silently become 0 minutes
**Severity:** S3 **Status:** Confirmed **Persona:** Teacher
**Location:** `ComposerDefineStage.tsx:93-107` — `Number(event.currentTarget.value)`; clearing the
field yields `Number("") === 0`, and `min="1"` is not enforced on the typed value.
**User impact:** A lab can be saved as "0 minutes."
**Regression test:** Clearing the duration field is treated as invalid / falls back to ≥ 1.

## 7. Suspected or intermittent bugs

- **SETUP-001 (S2, suspected):** The Set up stage defaults to the **3D bench**, which hard-depends on
  WebGL. In a no-WebGL context (`THREE.WebGLRenderer: Error creating WebGL context`) the bench
  rendered as a **blank box with no message** — the "3D is unavailable. Use the Accessible list
  above." fallback (`Composer3DSetupEditor.tsx:445`) apparently only shows once the canvas mounts,
  not on context-creation failure. Many school Chromebooks have weak/blocked WebGL. Needs testing on
  real low-GPU hardware; if confirmed there, this is S2. Mitigations: catch the WebGL failure and
  show the fallback, and/or default to the Accessible list when WebGL is unavailable.
- **PREVIEW-001 (S3, suspected):** Preview always launches the hard-coded `acid_base_titration`
  experiment (`ComposerPreview.tsx:90-96`) regardless of the authored draft. Consistent *today*
  because every draft is a titration (TEACHER-001), but it means the student preview is not derived
  from the draft's equipment/layout — it will diverge the moment non-titration authoring is possible.
- **PREVIEW-002 (S3, suspected):** All preview failure causes collapse into one generic "This preview
  is no longer available" message; the specific `eligibility.failureCodes` are discarded
  (`ComposerPreview.tsx:24-53`). A teacher whose preview breaks gets no actionable reason.
- **SETUP-002 (S3, suspected):** The 3D bench silently drops any equipment whose pose fails to
  resolve (`Composer3DSetupEditor.tsx:180-192` `catch { return []; }`) and hides the Rotate button on
  failure — a teacher can't distinguish "misconfigured" from "bug."

## 8. Console and network failures

| Signal | Where | Product connection |
| --- | --- | --- |
| `THREE.WebGLRenderer: A WebGL context could not be created` (error) + `pageerror: THREE.WebGLRenderer: Error creating WebGL context` | Set up → 3D bench | Drives SETUP-001 (blank bench, no fallback message) in no-WebGL environments. |
| `THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.` (warning) | 3D bench mount | Cosmetic; upstream three.js deprecation. |
| Preload-but-unused warning for `ProductShell_module_*.css` (warning) | All pages | Cosmetic; a preloaded stylesheet isn't used promptly. |

The Next.js dev overlay's "4 Issues" badge corresponds to the above (the WebGL errors + two
warnings), not to product logic errors. **No** failed network requests, React key warnings, or
hydration errors were observed on the Composer happy path. No horizontal overflow at 1440/1280/1024/768.

## 9. Broken-state matrix

| Action | Resulting state | Can user recover? | Explanation clear? | Data-loss risk |
| --- | --- | --- | --- | --- |
| Refresh / Back with unsaved edits | Editor resets to default titration | No (edits gone) | No (no warning) | **High** |
| "Add material" with "Best available container" | Reagent silently bound to first compatible container (possibly the wrong one, or a second container) | Yes (Remove) | No | Medium (chemically wrong) |
| Add negative measurement range | Accepted; checker still "passes" | Yes (edit/remove) | No (misleading success) | Medium |
| Add reversed range (min>max) | Silently not added | Yes (retry) | No (no feedback) | Low |
| Blank "Add direction"/"Add student action" | No-op | Yes | No | Low |
| Save a 0-point grading item | Accepted; rubric total corrupted | Yes (edit) | No | Medium |
| Load a missing saved draft | Raw `TypeError` text in banner | Yes | Partly (jargon) | Low |
| Deep-link `/preview` with no/bogus hash | Friendly "Preview unavailable" page | Yes | **Yes** (good) | None |
| Remove equipment required by the sim | Removal-impact dialog + "Preview will be unavailable" notice | Yes | **Yes** (good) | None |
| Delete an ordering edge on the canvas | Removed immediately, no confirm (unlike node removal) | Undo | Partly (inconsistent) | Low |

## 10. Missing safeguards

The Composer currently lets a teacher build labs that are incomplete, contradictory, or impossible:

- **Two reagents in one container / one reagent in two containers** (TEACHER-005) — no exclusivity.
- **Physically impossible measurement ranges** — negative or reversed accepted-value ranges
  (SYSTEM-002).
- **0-point grading** items and scoring rules (TEACHER-007).
- **0-minute** estimated duration (DEFINE-001).
- **Blank required fields** on directions/checks silently ignored rather than blocked (TEACHER-004).
- **Ordering relationships** attached to an arbitrary/empty objective (WORKFLOW-001).
- **No "one titrant / one analyte" chemistry sanity check** before the checker says "ready."

These are exactly the places where the domain expert (the teacher) expects the tool to catch a
mistake and instead is told everything passed.

## 11. Recommended remediation order

### Immediate blockers (fix before any further feature work)
1. **TEACHER-002** — autosave the working draft to localStorage; restore on load; add a
   `beforeunload` unsaved-changes guard.
2. **TEACHER-001** — add "New lab" (blank draft) and make titration an explicit template.
3. **TEACHER-005** — pair each reagent with a specific container *before* it enters the setup;
   enforce one reagent per container and block duplicate placement; remove the silent "Best available
   container" auto-pick. (This is the reported priority and the natural place to introduce the
   additional glassware.)

### Product-language cleanup
4. **TEACHER-008 / TEACHER-006** — apply `docs/qa/teacher-language-inventory.md`; route every
   `.message`/`.reason`/`issue.message` through one teacher-copy mapper; standardize "Lab builder"
   and the "cards" metaphor.

### Workflow simplification
5. **TEACHER-004 / TEACHER-003** — disable Add/Save until required fields are valid, mark required
   fields, and render every rejected command's message.
6. **WORKFLOW-001** — let the teacher choose (or clearly see) the objective a connection belongs to;
   give distinct errors for cycle vs duplicate vs self; make edge deletion consistent with node removal.

### Reliability
7. **SYSTEM-002 / TEACHER-007 / DEFINE-001** — add plausibility validation: reject negative/reversed
   ranges, require > 0 points, require ≥ 1 minute; surface these in the checker.
8. **SETUP-001** — catch WebGL failure and show the accessible fallback (or default to the list when
   WebGL is unavailable).
9. **PREVIEW-001/002** — derive the preview scene from the draft (once non-titration authoring
   exists) and surface specific preview-failure reasons.

### Polish
10. Remove dead `errorPath` state; evict old preview hashes from localStorage; fix the three.js
    deprecation and CSS-preload warnings; add screen-reader access to the 3D bench.

## 12. Release gates

Before the Lab Composer may be described as "usable by teachers," all must hold:

- [ ] Zero S0 issues. *(Currently met — the app runs.)*
- [ ] Zero unresolved S1 issues. **(Currently failing: TEACHER-001, TEACHER-002.)**
- [ ] All core teacher workflows in §3 score ≥ 4. **(Currently failing.)**
- [ ] No raw implementation terminology in standard teacher flows. **(Currently failing: TEACHER-008.)**
- [ ] No silent save failures. **(Currently failing: TEACHER-003/004.)**
- [ ] Editor state survives refresh. **(Currently failing: TEACHER-002.)**
- [ ] Generated/authored labs can be manually edited and previewed. *(Editing works; generation N/A.)*
- [ ] Invalid agent output produces a teacher-friendly recovery path. *(N/A — agent not implemented.)*
- [ ] Teacher and student views remain consistent. **(At risk: PREVIEW-001 hard-codes the scene.)*
- [ ] Student mistakes produce chemistry-oriented feedback. *(Preview sim: yes; composer-authored
  feedback copy: to verify once non-titration authoring exists.)*
- [ ] No uncaught console errors during the primary happy paths. **(Currently failing on WebGL-less
  hardware: SETUP-001.)**

Additional chemistry-correctness gates recommended for this domain:
- [ ] The checker rejects two reagents in one container and duplicate reagent placement.
- [ ] The checker rejects physically impossible measurement ranges and 0-point/0-minute values.

---

## Final judgment

1. **Readiness classification:** **Prototype-only.** Not classroom-ready and not safely
   teacher-operable unassisted.
2. **Single largest barrier to teacher adoption:** A teacher cannot create a *new* lab and cannot
   *trust* the one in front of them — every lab is a forced titration clone, unsaved work disappears
   on refresh with no warning, and the checker reports "Preview is ready" for chemically impossible
   setups (acid in the base's burette, negative volumes).
3. **First five issues the implementation agent should fix, in order:**
   1. TEACHER-002 — persistence + unsaved-changes guard.
   2. TEACHER-005 — reagent↔container pairing (explicit pairing, one reagent per container, no silent
      auto-pick).
   3. TEACHER-001 — new/blank-lab start with titration as an explicit template.
   4. TEACHER-004 + TEACHER-003 — eliminate silent Add/Save failures (disable-when-invalid, required
      markers, render all rejection messages).
   5. SYSTEM-002 + TEACHER-007 — chemistry/plausibility validation (reject negative/reversed ranges,
      0-point grading, 0-minute duration).
4. **Workflows that must be retested after the fixes:**
   - Create a lab from a blank start; confirm titration is a choosable template, not forced.
   - Edit, then refresh / press Back / close-and-reopen — the lab must survive, or be warned about.
   - Reagent binding: confirm each reagent is paired to a container, a container holds one reagent,
     and no reagent can be placed twice; no "Best available" silent pick.
   - Add a direction / check / grading item with blank fields — must be blocked with a visible reason.
   - Enter negative, reversed, 0-point, and 0-minute values — the checker must fail them with a
     chemistry-oriented explanation, not "Preview is ready."
   - Full jargon sweep of the always-visible chrome (stage nav + status bar) after the language pass.
   - Preview round-trip on WebGL-less hardware (or with WebGL disabled) — the bench must not be a
     blank box.
