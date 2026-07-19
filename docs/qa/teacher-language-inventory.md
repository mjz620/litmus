# Teacher Language Inventory — Lab Composer

Complete inventory of questionable teacher-facing wording, organized by route/feature. Companion to
`strict-product-judge-report.md` (finding TEACHER-008).

**Principle:** a chemistry teacher with no software background should never have to understand
registries, schemas, nodes, edges, validators, instances, workflows, or state machines. The codebase
already has good translation helpers (`teacherCommandError`, `teacherEquipmentPurpose`,
`teacherObjectiveDescription`, `titleCaseIdentifier`) — the strings below are the ones that bypass
them. "Keep" rows are recorded so a fixer knows they were reviewed and judged acceptable.

## Always-visible chrome (highest priority — on screen at all times)

| Current wording | Location | Why confusing | Teacher's goal | Recommended |
| --- | --- | --- | --- | --- |
| `Workflow` (stage tab) | composerStages.ts:43 | BPM/engineering term | Order the lab's steps | "Steps" / "Procedure" |
| `Rules` (stage subtitle "shortPurpose") | composerStages.ts:44 | Internal rule model | The checks the lab runs | "Checks" |
| `Authoring task` | ComposerStageChrome.tsx:43 | "authoring" = CMS/dev | Which build step you're on | "Build step" |
| `Lab authoring stages` (aria-label) | ComposerStageNavigation.tsx:22 | same | Step navigation | "Lab building steps" |
| `Composer navigation` (aria-label) | ComposerStageChrome.tsx:70 | "Composer" is the internal name; the title says "Lab builder" | footer nav | "Lab builder navigation" |
| `Open isolated preview` (button title) | LabComposer.tsx:898 | "isolated" = sandbox term | open a student preview | "Open a student preview" |
| `Validation is required first` (title) | LabComposer.tsx:899 | "validation" = form/engine gate | check the lab before preview | "Check the lab first" |
| `Validation is already running` (title) | LabComposer.tsx:887 | "validation" | the check is in progress | "The lab check is already running" |
| `Draft status` (aria-label) | LabComposer.tsx:840 | "Draft" mild versioning term | status of the lab | "Lab status" |
| `Needs checking` / `Ready to preview` | LabComposer.tsx:852 | acceptable | — | keep |

## Set up stage

| Current wording | Location | Why confusing | Recommended |
| --- | --- | --- | --- |
| `Select an equipment instance.` | ComposerSetupWorkspace.tsx:879 | "instance" is code (`instanceId`) | "Select a piece of equipment to edit." |
| `Bound materials` (aria-label) | ComposerSetupWorkspace.tsx:603 | "bound" = data-binding | "Materials in this lab" |
| `Registered container` (fallback) | ComposerSetupWorkspace.tsx:616 | "registered" = registry | "its container" |
| `This equipment cannot run in this position in the current simulation.` | ComposerSetupWorkspace.tsx:234 | "run," "simulation" = executor | "This equipment can't go in this spot for this lab type." |
| `Best available container` (option) | ComposerSetupWorkspace.tsx:579 | hides a real chemistry choice (see TEACHER-005) | replace with explicit container pairing; if kept, "Choose a container" (no silent auto-pick) |
| `Drag {x} to a compatible slot` / `…compatible container` (aria) | ComposerSetupWorkspace.tsx:154,186 | "compatible," "slot" | "Drag {x} to a bench spot" / "…into a container that can hold it" |
| `Slot for {x}` (aria) | ComposerSetupWorkspace.tsx:492 | "Slot" inconsistent with "position" used elsewhere | "Bench position for {x}" |
| `Equipment setup` (config select) | ComposerSetupWorkspace.tsx:761 | vague "setup"; options come from catalog `description` (see catalog leaks) | keep label, fix option text |
| `Uses {source ?? "the current setup"}` | ComposerSetupWorkspace.tsx:814 | "the current setup" as an equipment name | fallback "this equipment" |
| `Enable` (action button) | ComposerSetupWorkspace.tsx:849 | borderline | keep or "Allow" |
| `Student workspace` / `Student bench` / drag hints | ComposerSetupWorkspace.tsx:638-644,892-896 | clear | keep |

**Catalog-sourced text that renders verbatim in Set up** (source file `catalog.ts` / registries, out
of the component scope but visible to teachers):
- Equipment configuration option e.g. **"Verified 50.00 mL burette presentation and…"** — "Verified"
  leaks (seen in the "Equipment setup" dropdown).
- Student-action purposes e.g. **"Add a bounded amount of verified titrant to the burette."** —
  "bounded," "verified titrant" leak. `teacherEquipmentPurpose()` scrubs some phrases but not these.
  Recommend extending the scrubber or cleaning the registry `purpose`/`description` text.

## Set up → status/error strings (LabComposer.tsx)

| Current wording | Location | Why confusing | Recommended |
| --- | --- | --- | --- |
| `…not available in the current supported simulation.` | :94 | "supported simulation" | "That option doesn't work with this lab type." |
| `Those choices cannot work together in the current supported simulation.` | :99-100 | same | "Those choices can't be used together in this lab type." |
| `That slot is occupied. Use Replace to review and resolve the existing equipment dependencies.` | :552-554 | "slot," "resolve…dependencies" | "Something is already in that spot. Use Replace to swap it and see what changes." |
| `This item is still used elsewhere. Use Remove to review what else will change.` | :102 | mild dependency-speak, actionable | acceptable; optional "used by other parts of the lab" |
| `That order would create a loop. Choose a different first or next card.` | :106 | "loop"/"card" understandable | keep |

## Workflow stage

| Current wording | Location | Why confusing | Recommended |
| --- | --- | --- | --- |
| `Workflow view` (aria) | ComposerWorkflowGraph.tsx:309 | "Workflow" | "Lab steps view" |
| `Workflow dependency graph` (aria) | ComposerWorkflowGraph.tsx:385 | "dependency graph / node / edge" | "Diagram of which steps come first" |
| `Selected rule inspector` (aria) | ComposerWorkflowGraph.tsx:607 | "rule," "inspector" | "Selected card details" |
| `Save rule` / `Remove rule` | ComposerWorkflowGraph.tsx:721,733 | "rule" breaks the "cards" metaphor | "Save card" / "Remove card" |
| `Add an activity check` / `Add something students should do or demonstrate` | LabComposer.tsx:1116,1115 | "activity check" vague | "Add a step or result to check" |
| `Show with` (instruction→check select) | LabComposer.tsx:1297 | vague | "Show during which step?" |
| `That order cannot be added. Check for a loop or an existing connection.` | ComposerWorkflowGraph.tsx:284-296 | borderline; doesn't distinguish loop/dup/self | split into specific messages |
| `Connect two cards` / `First` / `Next` / `must happen before` / `Earlier card` / `Next card` / `No prerequisite` | various | clear, classroom-friendly | keep |
| `Feedback type` + options (Information / Helpful practice / Procedure problem / Concept misunderstanding / Safety problem) | LabComposer.tsx:1162-1176 | good — hides severity enum | keep |

## Assess stage

| Current wording | Location | Why confusing | Recommended |
| --- | --- | --- | --- |
| `Assessment validator findings` (aria) | ComposerAssessWorkspace.tsx:100 | "validator" | "Grading issues to review" |
| `{issue.message}` (raw) | ComposerAssessWorkspace.tsx:104 | prints validation-engine text verbatim | route through teacher-copy map |
| `How learning is scored` / `Grading items` / `Evidence to look for` / `No evidence is connected yet.` | :89,139,184-186 | clear | keep |

## Define stage

| Current wording | Location | Why confusing | Recommended |
| --- | --- | --- | --- |
| `Save definition` | ComposerDefineStage.tsx:129 | "definition" vague | "Save details" |
| `supported reaction model` (via `teacherObjectiveDescription`) | ComposerDefineStage.tsx:22 | "supported" compatibility framing | "the lab's reaction model" |
| `Lab title` / `Student summary` / `Grade band` / `Duration in minutes` / `Difficulty` | :48-123 | clear | keep |

## Check & preview stage

| Current wording | Location | Why confusing | Recommended |
| --- | --- | --- | --- |
| `This lab has a structural problem and cannot be previewed.` | LabComposer.tsx:1032 | "structural problem" (schema-invalid) not actionable | "Something in this lab is incomplete, so it can't be previewed yet — run Check lab to see what to fix." |
| `Current simulation` / `Acid–base titration · supported` / `Supported lab simulation` | LabComposer.tsx:1022-1027 | "simulation," "supported" | "Lab type: Acid–base titration" |
| `Only the lab checker can approve Preview.` | LabComposer.tsx:1047 | "approve"/"checker" approval-engine feel | "Preview opens only after the lab passes its check." |
| `Check for missing or unsupported choices…` | composerStages.ts:60 | "unsupported" compatibility term | "Check for anything missing or that won't work in this lab, then try it as a student." |
| `{issue.message}` (raw) + `{issue.severity}` verbatim | ComposerValidationIssues.tsx:31,34 | raw engine text + raw enum | map codes + severities to friendly labels ("Must fix" / "Suggestion") |
| `?? "Validate"` fallback stage label | ComposerValidationIssues.tsx:25 | inconsistent with "Check & preview" | fall back to "Check & preview" |
| `Lab checker` / `The checker found items to review before Preview.` | LabComposer.tsx:998,438 | acceptable | keep |

## Removal dialog

| Current wording | Location | Why confusing | Recommended |
| --- | --- | --- | --- |
| `Current simulation setup` (impact label) | ComposerRemovalDialog.tsx:41 | "simulation" | "Lab type settings" |
| `Workflow step` (impact label) | ComposerRemovalDialog.tsx:53 | "Workflow" | "Procedure step" |
| `This equipment is needed by the current simulation… until a supported replacement is added…` | :189-192 | "simulation," "supported replacement" | "This equipment is required for this lab type. You can remove it, but Preview stays off until you add a replacement that works and the lab passes its check again." |
| `What should happen to related items?` + resolution options | :32-37,130 | mostly plain | keep |
| `Other parts of the lab that will change` / destructive-confirmation checkbox | :167,203 | good | keep |

## Preview page

| Current wording | Location | Why confusing | Recommended |
| --- | --- | --- | --- |
| `Lab Composer preview` / `Return to the Composer` / `← Return to Composer` | ComposerPreview.tsx:60,61,87 | "Composer" ≠ "Lab builder" title | "Lab builder preview" / "Return to the lab builder" |
| `This preview is no longer available…` | ComposerPreview.tsx:46-50 | good except "the Composer" | swap "Composer" → "lab builder" |
| `Teacher preview · student results are not saved` / `Loading teacher preview…` | :85,70 | clear | keep |

## Raw exception / engine text that can reach the UI

These bypass the friendly mappers and should all be funneled through a `teacherCommandError`-style
map:

| Text | Location | Reaches UI? |
| --- | --- | --- |
| `Local draft storage is available in the browser only.` | LabComposer.tsx:62-64 | Yes — via `saveDraft`/`loadDraft` `setError(err.message)` (:506/:529) |
| `Local preview storage is available in the browser only.` | LabComposer.tsx:70-73 | Possibly — `previewRepository()` in `launchPreview` |
| `The preview-return draft could not be restored safely.` | LabComposer.tsx:256 | Yes — rendered in the alert banner |
| `The selected local draft is missing.` | LabComposer.tsx:515 | Yes — via `loadDraft` catch (:529) |
| `historyError.message` (undo/redo) | LabComposer.tsx:460-464,486-490 | Yes — raw `restoreDraftSnapshot` message can render |
| `issue.message` (validation) | ComposerValidationIssues.tsx:31; ComposerAssessWorkspace.tsx:104 | Yes — printed verbatim |
| `plan.reason` (layout planner) | Composer3DSetupEditor.tsx:274; ComposerSetupWorkspace.tsx:591 | Yes — shown as inline status/error |
| `failureCodes.join(", ")` in a thrown message | ComposerPreview.tsx:39-41 | Contained *today* by the catch at :44; latent leak if that catch is loosened |

## Cross-cutting fixes

1. **Standardize the product name:** "Lab builder" everywhere (page title) — drop "Composer" from
   aria-labels and Preview links.
2. **Pick one metaphor for checks:** the graph says "cards," the inspector/subtitle say "rules."
   Choose "cards" (or "checks") and apply consistently.
3. **Purge the "supported simulation" / "current simulation" / "supported" framing** everywhere;
   replace with "lab type."
4. **One error mapper:** route every `.message` / `.reason` / `issue.message` / `failureCodes`
   through a single teacher-copy function; never render raw engine text.
5. **Four heaviest single-word leaks in always-visible chrome:** `Workflow`, `validator`, `instance`,
   `authoring`.
