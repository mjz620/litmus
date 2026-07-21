---
target: /experiments
total_score: 22
p0_count: 1
p1_count: 2
timestamp: 2026-07-20T01-18-57Z
slug: src-app-experiments-page-tsx
---
Method: dual-agent (A: design review · B: detector + browser evidence), run in isolation.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No `aria-current` on any nav link; "Start practice" loads a 3D bench with no pending feedback |
| 2 | Match System / Real World | 2 | "setup-driven", "v1.0.0", "Skills practiced: 4" are engineering vocabulary shown to a 16-year-old |
| 3 | User Control and Freedom | 3 | Clear back link, no modals, no destructive actions; but "Start practice" is a one-way door with no preview |
| 4 | Consistency and Standards | 1 | Two primary-button implementations, two card code paths, two version vocabularies, three title conventions |
| 5 | Error Prevention | 3 | Little to get wrong, but a beginner's first card is the 20-minute Intermediate titration |
| 6 | Recognition Rather Than Recall | 2 | Comparing four labs means reading four prose blocks; nothing is scannable side-by-side |
| 7 | Flexibility and Efficiency | 2 | No filter, sort, or grouping; card isn't clickable (380×630px object, 167×50px target) |
| 8 | Aesthetic and Minimalist Design | 2 | Fold ~70% empty at 1280; every card carries an orphaned stat tile; "AVAILABLE"×4 is noise |
| 9 | Error Recovery | 3 | No error states on this route to fault, but no empty state either |
| 10 | Help and Documentation | 2 | Nothing explains "setup-driven", "skills practiced", or Intro vs Intermediate |
| **Total** | | **22/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**The design system does not read as AI-generated. The page assembly does.**

**LLM assessment.** Tells genuinely absent: no gradient headings, no glassmorphism, no glow, no icon triptych, no purple-blue palette, no decorative motion. The palette is specific and applied with discipline. Semantic markup (`<article>`, `<dl>/<dt>/<dd>`, `<section aria-label>`) is better than most generated UI.

Tells present, all at the assembly layer: an **identical card grid** with no hierarchy or recommended path (an explicit product-register ban); metadata surfaced because it exists rather than because anyone needs it (`v1.0.0`, `setup-driven`, `Skills practiced: 4`); a **padded hero** occupying the first 507px and pushing every card below the fold at 1280 — the AI-SaaS pattern this project names as an anti-reference; and near-verbatim repetition, with three of four descriptions ending on "the shared immersive 3D bench."

The hand-inlining is visible without reading code: card 1 renders `v1.0.0` where cards 2–4 render `setup-driven` in the identical slot; three naming conventions across four items; the "3D bench" tic appears only on inlined cards.

**Deterministic scan.** CLI detector over the three markup files: **clean, exit 0, zero findings.** In-page detector: **1 finding — `cream-palette`** on `rgb(243, 240, 232)`.

Adjudication: the cream flag is a **false positive on the token, but a true positive on the page**. `#f3f0e8` is committed, tokenised brand, and every one of nine measured pairs clears AA against it. The rule targets accidental beige defaults; this isn't one. But `DESIGN.md` states the actual risk — cream *as scaffolding for the teal* is fine, cream *plus sans-serif alone* is the AI-SaaS look — and the independent design review found exactly that drift: a 70%-empty fold where the warm ground is doing the work unaided. The detector pointed at the right pixel for the wrong reason.

Note on method: the CLI scan reads markup only (CSS files are excluded by instruction), which is why the body background surfaced in the browser run and not the CLI run. The two are complementary, not redundant.

**What the detector could not see.** Everything above the pixel level: card-grid sameness, the version-slot contradiction, the orphaned stat tile, two button implementations 40px apart, and every emotional gap. Deterministic scanning cannot assess composition.

## Overall Impression

The components were designed; the page was populated. Colour, contrast, focus handling, and semantics are genuinely well made — the lowest contrast pair on the route is 4.81:1, which is better than most shipping product UI. Then four cards were laid in a uniform grid, three of them bypassing the shared component, and the result reads as assembled rather than composed.

The single biggest opportunity is subtraction. Remove the version slot, the availability pill, and the skills integer, and the remaining signal — **time and difficulty** — is exactly what an anxious student needs. That content is already there and already right.

## What's Working

**Colour and contrast discipline is real, not decorative.** All nine measured pairs pass AA, including 11.5px stat-tile labels at 5.32:1 and the eyebrow at 4.81:1. Saturation appears once. Terracotta never carries a word. On a washed-out shared Chromebook under fluorescent light, this is the property that will actually hold — and the hardest thing here to have got right by accident.

**"Estimated time" and "Difficulty" as first-class tiles.** Most ed-tech choosers lead with outcomes marketing. This leads with the two facts an anxious student needs: can I fit this in a free period, and am I in over my head. That is design serving the task rather than selling it, and it is why the cards survive their own problems.

**Component-level restraint.** No modal, no carousel, no gradient, no decorative motion. One global focus ring (`3px` at `2px` offset) defined once with `:where()`. The anti-references were resisted wherever components were authored; the slippage is all at page assembly.

## Priority Issues

### [P0] Mobile header overflows and two nav destinations are unreachable
`documentElement.scrollWidth` is **500px at a 390px viewport** — the page scrolls sideways. `.brand` computes to **zero width**, so "LabBench" paints over "Experiments". "Teacher" (x: 390) and "Sign in" (x: 457) render entirely off-screen. Both assessments found this independently; B measured the 110px overflow and attributed it to `nav.primaryNav` at 484px, A found the collapse mechanism and the unreachable links.

**Why it matters:** the primary audience is on small and shared screens, and the first impression is an app that looks broken — before a single word of content. This is in `ProductShell`, so it affects **every route**, not just this one.

**Fix:** `.brand` sets `min-width: 0`, which is what permits the collapse; change to `flex-shrink: 0`. Make the nav give instead: below `48rem` either collapse Composer/Teacher/Sign in into a disclosure, or `overflow-x: auto` with `flex: 0 0 auto` on links. The existing `@media (max-width: 38rem)` block only shrinks padding and font; it does not address a 7-item overflow.

**Suggested command:** `/impeccable adapt`

### [P1] Hand-inlined cards leak implementation into the interface
Three of four cards bypass `ExperimentCard` and pass the literal `"setup-driven"` into the `.version` slot the shared component fills with `v{version}`. Naming registers diverge across the same four items.

**Why it matters:** the product's credibility rests on "deterministic, real". A grid whose four members disagree about what they call themselves undercuts that before a word is read.

**Fix:** move the three seeded labs into the registry and render all four through `ExperimentCard`. Then **delete the `.version` slot** — neither `v1.0.0` nor `setup-driven` belongs in front of a student. Deleting it removes the inconsistency by construction rather than by discipline.

**Suggested command:** `/impeccable distill`

### [P1] Every card renders an orphaned stat tile
`.details` is `repeat(auto-fit, minmax(min(100%, 7rem), 1fr))`. At the ~324px inner card width only two 112px tracks fit, so three items always lay out 2 + 1 with a visible hole — all four cards, all three widths.

**Why it matters:** every unit in the chooser looks unfinished. The file already carries a comment about a `minmax` sizing bug in this exact rule, so this is a second failure of the same class.

**Fix:** drop "Skills practiced" and it becomes a clean 2-up. If it stays, `repeat(2, 1fr)` with the third tile spanning `1 / -1`.

**Suggested command:** `/impeccable layout`

### [P2] "Skills practiced: 4" is a number with no referent
`Object.keys(metadata.readinessWeights).length`, surfaced because it was available. It answers none of the product's three stated questions, and beside "Difficulty: Intermediate" a bare integer reads as a score to a student already primed to feel judged.

**Fix:** remove it. If the information is wanted, show skill names as words a student can act on.

**Suggested command:** `/impeccable distill`

### [P2] Two primary-button implementations, 40px apart
`.cta` reimplements a button from scratch — hardcoded padding, weight 700, no `min-height`, no `transition`. `globals.css .ui-button` already exists with the control-height and motion tokens. "Start practice" (50px, 16px/700) and "Open Lab Composer" (44px, 14px/600) sit in one column looking like different design systems; one eases on hover, the other snaps.

**Fix:** use `className="ui-button"` and delete `.cta`. Replace off-token `font-weight: 650` and `font-size: 0.72rem` with `--type-ui-semibold` and `--text-xs`.

**Suggested command:** `/impeccable polish`

### [P3] No reassurance, no wayfinding for a first-timer
Nothing on the route states the simulation is consequence-free. Nothing recommends where to begin. Three of four cards say "Intermediate".

**Why it matters:** `PRODUCT.md` defines the primary user by fear of "wasting materials or breaking something". The one sentence that would dissolve that fear appears nowhere.

**Fix:** sort intro-first and add one line under the h1: *"Nothing here can break or be wasted. Restart any experiment as many times as you want."*

**Suggested command:** `/impeccable clarify`

## Persona Red Flags

**Casey (Distracted Mobile User).** The header is visibly broken on arrival — brand text overprints the first nav link and the page scrolls sideways. "Teacher" and "Sign in" are off-screen entirely. Nav links are 40px tall against a 44px minimum; `← Home` is **21px**, less than half. Cards are 500–578px apart, so no two are ever co-visible and comparison requires scroll-and-remember. Casey's read at second zero is "this app is broken."

**Jordan (Confused First-Timer).** The first interactive element after the header is **"Open Lab Composer"** — a teacher's tool. The page description answers "is this for me?" worse than not reading it: *no account required* is buried mid-paragraph behind "deterministic science and learning evidence" and ahead of two sentences about teachers and cloud drafts. Nothing defines "setup-driven", "Skills practiced", or Intro vs Intermediate. Jordan's eye lands on "Intermediate" first, three times out of four.

**Sam (Accessibility-Dependent).** Contrast is genuinely good — all nine pairs pass, heading order is clean `h1 → h2×4`, focus ring is global and visible. But **no `aria-current="page"` on any nav link**, so screen-reader users get no location signal. Four links all read "Start practice" with no `aria-label`, so pulling a link list yields four identical entries. Nav targets are 40px, under the `2.75rem` floor `DESIGN.md` itself calls "load-bearing for a shared classroom device."

**Maya (Nervous Pre-Lab Student — project-specific).** Sixteen, shared Chromebook, real titration tomorrow, worried about breaking glassware in front of people. She needs to know this is safe to fail at, how long it takes, and where a beginner starts. The page tells her the version number and how many skills are practiced. It never tells her she can restart, never recommends a starting point, and opens with a button for her teacher. She gets the two facts she needs — time and difficulty — but has to find them past everything else.

## Minor Observations

- `.card h2` uses `clamp(1.5rem, 4vw, 2rem)` — **viewport units sizing type inside a grid cell that doesn't track the viewport**. At 1280 it pins to the 2rem max inside a 380px column, which is why the calorimetry title runs to three lines and forces a 630px card. Use `cqi` with `container-type: inline-size`, or a flat 1.375–1.5rem.
- The "AVAILABLE" pill is true on 4 of 4 cards — zero information — and spends `--color-success` on decoration in a system that reserves saturation for scientific state.
- `.card` has no hover, no `:focus-within`, and isn't clickable: a 380×630px object with a 167×50px target.
- `.cta:hover` and `.cta:focus-visible` share one rule, so keyboard focus is styled identically to mouse hover.
- At 1280, four cards in three columns leave a full two-thirds row of empty canvas.
- The `⚗` glyph in `.brandMark` renders as an unrecognisable blob at `1.15rem` in the fallback stack.

## Questions to Consider

1. If "AVAILABLE" is true on every card, what is the badge for — and what does the design do on the day one isn't?
2. Why does a student's chooser open with a teacher's button? "Composer" is already in the nav. What breaks if this page carries exactly one call to action?
3. "Deterministic science and learning evidence" — who is that sentence written for? A 16-year-old asks "how long is this" and "will I look stupid". The card stats answer both; the hero answers neither.
4. Is a card grid the right vocabulary for four items? A list with time and difficulty in a scannable column would let a student compare all four in one fixation instead of four separate reads.
5. `PRODUCT.md` says success is a student who arrives at the bench *ready*. Nothing here knows what the student has already done. If this is the front door, why is it identical on visit one and visit ten?
