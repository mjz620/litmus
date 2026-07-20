---
name: LabBench AI
description: A virtual chemistry bench students are allowed to touch before the real one.
colors:
  canvas: "#f3f0e8"
  surface: "#fffdf8"
  surface-muted: "#edf3ef"
  surface-strong: "#e1ebe6"
  ink: "#172925"
  ink-muted: "#566762"
  primary: "#0f766e"
  primary-hover: "#0b5f58"
  primary-soft: "#d8ebe6"
  accent: "#d98963"
  accent-ink: "#a35128"
  instrument: "#202b2d"
  instrument-ink: "#eff6f2"
  instrument-ink-muted: "#aebfba"
  instrument-border: "#344542"
  instrument-accent: "#9de1c2"
  instrument-primary: "#79c9bb"
  coach: "#684f70"
  coach-soft: "#f1e8f3"
  border: "#cbd8d3"
  border-strong: "#aebfb9"
  success: "#176b4d"
  success-soft: "#e0f0e8"
  warning: "#845613"
  warning-soft: "#fff2d5"
  danger: "#a72f3b"
  danger-soft: "#fbe9ec"
typography:
  display:
    fontFamily: "tomarik-display, Trebuchet MS, ui-rounded, sans-serif"
    fontSize: "clamp(2.35rem, 6vw, 4.5rem)"
    fontWeight: 400
    lineHeight: 1.05
  headline:
    fontFamily: "tomarik-display, Trebuchet MS, ui-rounded, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 400
  title:
    fontFamily: "neulis-sans, Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 600
  body:
    fontFamily: "neulis-sans, Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "neulis-sans, Avenir Next, Avenir, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
  instrument:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
rounded:
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  pill: "999px"
spacing:
  1: "0.25rem"
  2: "0.5rem"
  3: "0.75rem"
  4: "1rem"
  6: "1.5rem"
  8: "2rem"
  12: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0.65rem 0.95rem"
    height: "2.75rem"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    height: "2.75rem"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "2.75rem"
    padding: "0.7rem 0.8rem"
  identity-mark:
    backgroundColor: "{colors.accent}"
    rounded: "{rounded.sm}"
---

# Design System: LabBench AI

## 1. Overview

**Creative North Star: "The Lab You're Allowed to Touch"**

This is real apparatus with no velvet rope around it. A student arrives nervous
about a physical lab they haven't done yet, often on a shared Chromebook, and
the interface has one job: make the equipment look touchable without making the
chemistry look fake. Warmth lowers the barrier; the instrument darks and the
monospace readouts keep the measurements honest.

The instrument surface is the one place the product inverts, so it carries its
own foreground ramp (`instrument-ink`, `instrument-ink-muted`, `instrument-accent`,
`instrument-primary`, `instrument-border`). Those contrast against
`instrument`, not against the canvas — reaching for a canvas-surface ink on a
dark console is how that panel accumulated nine one-off hex values.

The organising idea is **warm ground, cool instruments**. The cream canvas is
classroom light — the room the bench sits in. Teal, instrument-near-black, and
the 3D glassware are the equipment sitting in that light. Colour separates room
from apparatus, which is why the page is allowed to be warm while a burette
reading is not.

This system explicitly rejects two things. It is not a **sterile enterprise
LMS** — no grey tables, no dense forms, none of the software students have
already learned to ignore. And it is not **generic AI-SaaS** — no hero metrics,
no gradient headings, no cream-and-sans landing aesthetic, because that look
quietly undercuts the claim that the chemistry underneath is deterministic and
real.

**Key Characteristics:**

- Warm neutral ground, cool teal identity, terracotta as the invitation
- Saturated colour is reserved for scientific state, never for decoration
- Near-flat: depth comes from tonal layering and borders, not shadow
- Generous, unambiguous controls that stay precise rather than playful
- Monospace exclusively for instrument readouts, never for prose

## 2. Colors

A teal-led palette on warm neutral ground, with terracotta carrying the warmth
that the background alone cannot.

### Primary

- **Bench Teal** (`#0f766e`): The identity and every primary action. Solid fills
  on buttons, the focus ring, active equipment selection, and the `--lab-primary`
  alias throughout the 3D bench HUD. It is the one colour allowed to be both
  chrome and emphasis.
- **Teal Deep** (`#0b5f58`): Hover and pressed states only. Never a resting fill.
- **Teal Wash** (`#d8ebe6`): Tinted surfaces that need to read as *selected* or
  *belonging to the lab* without competing with scientific colour.

### Secondary

- **Terracotta** (`#d98963`): The warmth in a cool system. It is the identity
  mark on every shell — product header, lab session bar, demo bar, retry banner.
  At 2.39:1 on canvas it is **decorative only**: a surface to put dark ink on,
  never a text colour, never a state indicator.
- **Terracotta Ink** (`#a35128`): The text-safe sibling at 4.9:1 on canvas. Use
  when warmth genuinely has to carry a word. Sparingly — it sits close enough to
  the warning ochre that overuse would blur a semantic boundary.

### Neutral

- **Classroom Canvas** (`#f3f0e8`): The page ground. Warm, but never left bare —
  it is scaffolding for the teal and the instrument darks, not the design itself.
- **Paper Surface** (`#fffdf8`): Cards, inputs, panels. The layer that holds
  content.
- **Mint Muted / Mint Strong** (`#edf3ef` / `#e1ebe6`): Tonal steps for nested
  surfaces and stat tiles. These do the work shadows would do elsewhere.
- **Deep Green Ink** (`#172925`) and **Muted Ink** (`#566762`): Body and
  secondary text. The ink is green-black rather than neutral black, which keeps
  it in the same family as the teal.
- **Instrument** (`#202b2d`): Near-black reserved for apparatus chrome and HUD
  bars inside the 3D viewport. Signals *equipment*, not *UI*.

### Tertiary

- **Coach Plum** (`#684f70`) with **Coach Wash** (`#f1e8f3`): The AI coach has
  its own colour family so a student can always tell guidance apart from
  measurement. This separation is a product requirement, not a stylistic one.
- **State colours** — success `#176b4d`, warning `#845613`, danger `#a72f3b`,
  each with a soft tint. These are the only saturated colours allowed to appear
  beside a scientific reading, and they must never be the sole carrier of
  meaning; text accompanies every one.

## 3. Typography

Three families on a contrast axis, each with one job.

**tomarik-display** carries page titles and headings. It is the personality
voice — used at `clamp(2.35rem, 6vw, 4.5rem)` for page titles and `1.75rem` for
section headings, at weight 400. It never appears below `1.375rem`; small
display type reads as decoration.

**neulis-sans** is everything a student reads or operates: body copy, labels,
buttons, form fields. Weights 400 through 700, sizes `0.75rem` to `1.375rem`.
Labels and buttons sit at 600 so controls stay findable on a low-contrast
classroom screen.

**Monospace** is reserved, strictly, for instrument readouts — burette volumes,
temperatures, concentrations, canonical hashes. Monospace in this system means
*this is a measurement*. Using it for prose would spend that signal.

Body copy caps at 65–75ch. Headings use `text-wrap: balance`; long prose uses
`text-wrap: pretty`.

## 4. Elevation

**Near-flat, with tonal layering doing the work.** Depth is expressed by moving
through the surface ramp — canvas → surface → surface-muted → surface-strong —
and by 1px borders, not by stacking shadows. This is a deliberate rejection of
both anti-references: LMS density and SaaS card-shadow soup both read as busy.

There are exactly two shadows, and they are structural rather than ambient:

- `--shadow-card` (`0 0.75rem 2rem rgb(23 41 37 / 8%)`): this is a panel.
- `--shadow-floating` (`0 0.4rem 1.2rem rgb(23 41 37 / 14%)`): this is above the
  3D bench.

If a new surface needs a third shadow, the answer is almost always a tonal step
or a border instead. Note that both shadows are tinted with the ink hue rather
than neutral black, which keeps them from muddying the warm ground.

Transparency is reserved for compact overlays inside the 3D viewport, where it
preserves scene context. Decorative glass blur and glow are not part of this
system.

## 5. Components

The register is **generous but precise**. Controls are large enough for a shared
Chromebook and a nervous first-timer — `2.75rem` minimum height, `3px` focus
outline at `2px` offset — while the finish stays flat and exact. Size delivers
the accessibility; restraint keeps it from reading as a toy. Bounce, elastic
easing, heavy radii, and thick coloured outlines are what would tip this into
cartoon, so the system avoids all four.

- **Buttons** (`.ui-button`, `-secondary`, `-quiet`): `2.75rem` tall,
  `--radius-md`, `0.65rem 0.95rem` padding, label type at weight 600. Primary is
  a solid teal fill; secondary is surface with a teal border; quiet is bare.
  Hover deepens the fill rather than lifting it.
- **Cards** (`.ui-card`): surface fill, 1px border, `--radius-lg`, card shadow.
  Never nested — a card inside a card is always a tonal step instead.
- **Inputs** (`.ui-input`): `2.75rem` tall, `--radius-md`, `border-strong` at
  rest so fields read as operable, teal border on hover and focus.
- **Identity mark**: terracotta square at `--radius-sm` with dark ink glyph.
  Appears once per shell, top-left. It is the only place terracotta is a fill.
- **3D bench HUD**: floating panels over the canvas use `--lab-*` aliases, which
  resolve to the same tokens. Equipment labels, prompts, and the instruction bar
  sit in the bottom margin so they never occlude the flask a student is watching.

Motion is `120ms` and `180ms`, ease-out, and nothing else. Every animation has a
`prefers-reduced-motion` alternative; a reduced-graphics mode also exists,
because on this hardware performance is an accessibility concern.

## 6. Do's and Don'ts

**Do** let the warm canvas be scaffolding for the teal and the instrument darks.
A page that is only cream and sans-serif is the AI-SaaS look the product
explicitly rejects.

**Do** reserve saturation for scientific state. Indicator colour, precipitate
colour, and warnings should be the most saturated things on any screen.

**Do** pair every colour-carried meaning with text. A precipitate is "white", a
valve is "closed" — in words, not only in pixels.

**Do** use monospace only for measurements. It is the signal that a number is
engine-owned and defensible.

**Do** keep the terracotta decorative. `--color-accent` for surfaces,
`--color-accent-ink` when it must be legible.

**Don't** add a third shadow. Reach for a tonal step or a border.

**Don't** nest cards, or reach for a card when a list or a tonal panel is the
honest affordance.

**Don't** shrink controls below `2.75rem` or soften the focus ring. Those numbers
are load-bearing for a shared classroom device.

**Don't** use display type below `1.375rem`, or monospace for prose.

**Don't** introduce glassmorphism, gradient text, decorative glow, or side-stripe
accent borders. All four are already banned in `docs/design-system.md` and all
four read as decoration in a system whose credibility rests on looking real.
