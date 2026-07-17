# LabBench product and in-lab design system

Status: implementation specification for the application shell, student lab
workspace, and 3D bench. The T0141 and T0142 scientific-display requirements
remain normative within this broader product system.

## Application-wide foundation

Every product route uses the same visual foundation from `src/app/globals.css`.
The `--color-*`, `--font-*`, `--text-*`, `--space-*`, `--radius-*`,
`--shadow-*`, and `--motion-*` variables are the canonical application tokens.
Lab routes alias those values to `--lab-*` variables so scene-specific
components preserve their established contract without creating a second
palette.

Use `ProductShell`, `ProductHeader`, and `PageHeader` for application pages.
Forms and content screens use the lightweight `.ui-card`, `.ui-form`,
`.ui-field`, `.ui-input`, `.ui-button*`, `.ui-notice`, and `.ui-empty`
primitives. Purpose-built lab, analytics, and report components may retain
their own layout CSS, but their colors, type, controls, focus states, radii,
and elevation must resolve to the global tokens.

The hierarchy is intentional:

1. Page title or current lab objective.
2. Primary action or next required procedure.
3. Live measurements and manipulated equipment state.
4. Safety and validation warnings.
5. AI coaching, clearly identified with the coach color family.
6. Optional context, history, and secondary navigation.

Application surfaces are opaque or nearly opaque by default. Transparency is
reserved for compact overlays inside the 3D viewport where it preserves scene
context without reducing contrast. Avoid decorative glass blur, glow, and
large ornamental gradients.

## Product character

LabBench should feel like a compact educational game built around real lab
technique: colorful, tactile, and inviting, but never toy-like. The primary
audience is middle- and high-school students. A student should understand what
can be touched, what changed, and where to read a measurement without needing
to decode decoration.

Use these priorities in order:

1. Scientific state and measurement marks remain legible.
2. Interactive equipment is recognizable and discoverable.
3. The scene feels warm, dimensional, and playful.
4. Decorative detail earns its rendering and attention cost.

Do not add mascots, cartoon faces, novelty handwriting, photorealistic grime,
or ornamental motion. Indicator colors communicate chemistry identity; they
must not become generic success, warning, or button colors.

## Color system

### 3D palette

T0141 must define these values in `labPalette.ts`. That module is the only
place where 3D hexadecimal colors may live. Scene components, CanvasTexture
painters, and sky uniforms must import named values from it. Shader source must
receive sky colors as uniforms rather than contain numeric color literals.

| Token | Hex | Required use |
| --- | --- | --- |
| `benchTop` | `#181C22` | Near-black phenolic worktop |
| `benchEdge` | `#2B333B` | Kick plates, dark structural accents |
| `wood` | `#B97842` | Cabinet bodies and indicator shelf |
| `woodDark` | `#80502F` | Cabinet doors, recesses, reagent-bottle brown |
| `wall` | `#E8EEE9` | Diorama walls |
| `ceiling` | `#F3F5F0` | Sealed classroom ceiling |
| `floor` | `#CBD4CF` | Classroom floor |
| `wallTrim` | `#47736D` | Wall-top trim and restrained environmental accent |
| `safetyRed` | `#B94A4A` | Safety-sign cross and danger identity |
| `safetyGreen` | `#397B64` | Safety station and storage identity |
| `safetyPaper` | `#FFF6D8` | Printed safety-sign substrate |
| `ceramic` | `#F7F3E9` | Drip tile and clean white fixtures |
| `fixtureDark` | `#394348` | Stand base, clamps, sink basin |
| `fixtureMetal` | `#AAB5B8` | Rods, faucet, handles, funnel |
| `stopcockHandle` | `#168FC7` | High-visibility burette valve handle |
| `glass` | `#E8F7F4` | High-tier glass tint |
| `glassAttenuation` | `#D5ECE6` | High-tier transmitted-glass attenuation |
| `glassFallback` | `#D8EAE6` | Reduced-tier transparent glass |
| `buretteLiquid` | `#BCE8F1` | Titrant column, stream, and drops |
| `graduationInk` | `#102A34` | Every graduation, numeral, unit, and reading ring |
| `hoverMint` | `#56D6C1` | Hover shell and active 3D affordance |
| `selectionTeal` | `#0F766E` | Selected shell/ring and equipment identity state |
| `phenolphthalein` | `#EAA2BA` | Phenolphthalein bottle cap and full-pink observation |
| `bromothymolBlue` | `#4D86D8` | Bromothymol-blue bottle cap and blue observation |
| `methylOrange` | `#EC8B32` | Methyl-orange bottle cap and orange observation |
| `colorlessLiquid` | `#E6F5F1` | Colorless flask observation |
| `faintPinkLiquid` | `#F9D5E0` | Faint-pink flask observation |
| `yellowLiquid` | `#F0CF4A` | Yellow flask observation |
| `greenLiquid` | `#53AC75` | Green flask observation |
| `redLiquid` | `#DF5B5B` | Red flask observation |
| `skyHorizon` | `#F5C5A9` | Warm fallback environment outside the sealed shell |
| `skyMiddle` | `#BEDDE6` | Soft blue transition |
| `skyZenith` | `#A8DEC8` | Mint-blue zenith |
| `sceneFallback` | `#D5E3DF` | Solid reduced-tier Canvas background |

The three indicator accent tokens are intentionally saturated. Use each accent
only for its matching bottle, observed liquid family, and an adjacent text or
shape cue. Never communicate an indicator or endpoint by color alone.

### UI palette

CSS must expose these custom properties at the lab route boundary. Components
must use the custom properties rather than repeating values.

| CSS token | Hex | Use |
| --- | --- | --- |
| `--lab-page` | `#F3EFE7` | Warm page background |
| `--lab-surface` | `#FFFDF8` | Main cards and controls |
| `--lab-surface-muted` | `#F4F7F3` | Nested control groups |
| `--lab-ink` | `#17212B` | Headings and primary copy |
| `--lab-ink-muted` | `#53636B` | Supporting copy |
| `--lab-primary` | `#0F766E` | Primary actions and selected equipment |
| `--lab-primary-soft` | `#D7EBE7` | Status chips and quiet active states |
| `--lab-border` | `#CBD8D3` | Default borders and dividers |
| `--lab-focus` | `#0F766E` | Keyboard focus ring |
| `--lab-warning` | `#F8D47A` | Technique warning background |
| `--lab-danger` | `#B4232F` | Error text and destructive affordances |
| `--lab-danger-soft` | `#FDECEE` | Error background |

The measured text contrast ratios for the implementation colors are:

| Pair | Ratio | Requirement |
| --- | ---: | --- |
| `lab-ink` / `lab-page` | 14.21:1 | Pass 4.5:1 |
| `lab-ink` / `lab-surface` | 16.03:1 | Pass 4.5:1 |
| `lab-ink-muted` / `lab-surface` | 6.14:1 | Pass 4.5:1 |
| `lab-surface` / `lab-primary` | 5.38:1 | Pass 4.5:1 |
| `lab-focus` / `lab-surface` | 5.38:1 | Pass 3:1 |
| `lab-danger` / `lab-danger-soft` | 5.71:1 | Pass 4.5:1 |

## Shape language and low-poly modeling

- Build equipment from readable primitives: cylinders for vessels, cones for
  tapered necks and funnels, boxes for trays and furniture, and lathed profiles
  for measurement glassware.
- Use 8–12 radial segments for small props, 12–16 for hand-sized equipment,
  and 24–28 only where a glass silhouette or graduation decal must read in a
  focus pose. The 16 × 12 sky sphere is exempt because it is a backdrop.
- Keep broad furniture faces planar. Smooth only round vessel, liquid, faucet,
  and handle surfaces where faceting would confuse shape or measurement.
- Stylization may exaggerate a non-measuring handle, cap, rim, or label by at
  most 10% for readability. Never alter vessel capacity, liquid height,
  graduation spacing, meniscus position, or equipment clearance for style.
- Use one dominant silhouette and no more than two supporting detail scales per
  prop. Tiny modeled screws, text embossing, and invisible back-face detail are
  prohibited.
- Labels and graduations remain procedural CanvasTextures. Do not add external
  image assets, model loaders, post-processing, or outline dependencies.
- Keep all spatial dimensions in `benchLayout.ts`; palette and material work
  must not create new local geometry coordinates.

## Materials

Most surfaces should read as soft, matte, molded low-poly objects. `metalness`
must be zero except on fixtures that would be metal in a real lab.

| Surface | Roughness | Metalness | Additional rules |
| --- | ---: | ---: | --- |
| Phenolic bench | 0.80 | 0 | Near-black, never mirror-like |
| Warm wood | 0.78 | 0 | Color blocking only; no wood-grain texture |
| Painted wall/floor | 0.90 | 0 | Broad diffuse fields |
| Plastic/caps/trays | 0.76 | 0 | Saturation carries identity, not gloss |
| Ceramic tile | 0.72 | 0 | Light but not pure white |
| Dark stand/clamp coating | 0.68 | 0 | Separate from metallic rods by response |
| Steel rods/faucet/funnel/handles | 0.42 | 0.68 | The only nonzero-metalness family |
| High-tier glass | 0.08 | 0 | Transmission 0.96, IOR 1.5, clearcoat 0.45 |
| Reduced-tier glass | 0.16 | 0 | Opacity 0.34, no transmission/environment map |
| Liquid | 0.20 | 0 | Clearcoat 0.30 high tier; color comes from engine projection |

Use existing real wall-thickness hints for transmitted glass. Reduced graphics
must keep identical geometry, liquid height, markings, and semantic color; it
changes rendering cost only. Graduation and label materials must be unlit,
`toneMapped={false}`, and ordered after glass/liquid so lighting cannot erase
measurement information.

## Room containment and composition

`benchLayout.ts` owns the room shell just as it owns equipment placement. The
shell is six explicit, overlapping boundary surfaces: floor, ceiling, front,
back, left, and right walls. Four cap trims and four continuous baseboards hide
edge seams. The right wall must always be real geometry; camera limits and DOM
overlays are not acceptable substitutes for a complete room.

The authored camera remains inside the shell and its reachable yaw/pitch rays
must terminate on a room surface. The Canvas uses near/far planes of 0.03/60
to retain close equipment detail without clipping the room. The sky dome and
solid reduced-tier background remain fallback world treatments only and must
not be visible from a valid camera direction.

Environmental detail stays secondary to the active island. The rear service
counter, side storage, safety panel, ceiling fixtures, sink, mural, trim, and
cabinet faces provide scale and a functioning-classroom context without adding
unrelated interactive objects. These fixtures use centralized palette and
layout values and do not participate in chemistry or experiment state.

## Lighting and shadows

### Required rig

The sealed classroom uses three real lights and the existing high-tier room
environment:

| Light | Position | High quality | Reduced graphics | Shadow |
| --- | --- | ---: | ---: | --- |
| Ambient | global | 0.70 | 0.88 | Never |
| Warm-neutral key | `[2.6, 3.0, 2.2]` | 1.55 | 1.60 | High tier only |
| Cool fill | `[-2.2, 2.4, -1.4]` | 0.45 | 0.55 | Never |

Keep the room environment in the high tier and omit it in reduced graphics as
today. Ceiling fixture meshes may use a low-intensity emissive material to read
as practical fittings, but they are not light sources. Do not add point lights,
contact-shadow components, ambient occlusion, or post-processing.

The one permitted shadow uses explicit `PCFShadowMap`, a 512 × 512 map, camera
bounds left/right `-1.8/1.8`, top/bottom `2.2/-0.4`, near/far `0.1/8`, and
`normalBias=0.015`. Only these six outer glass meshes cast: burette tube,
junction, housing, tip, horizontal barrel, and flask lathe body. Only the main
phenolic island top and white flask tile receive. Liquids, markings, furniture,
props, highlights, and the sky never cast or receive.

### Shadow performance evaluation and decision

Measured 2026-07-16 on arm64 macOS 15.7.7 with Playwright 1.58.2 Chromium and
`--enable-unsafe-swiftshader`, at 1366 × 768 and DPR 1. The demand loop was
forced for three 90-frame runs; each run discarded 20 warm-up frames. The
candidate used the exact 512² key and six-caster/two-receiver scope above.

| Metric | No shadows | One-key candidate | Change |
| --- | ---: | ---: | ---: |
| Median of run-median frame intervals | 132.8 ms | 135.6 ms | +2.8 ms / +2.1% |
| Draw calls per rendered frame | 153 | 159 | +6 / +3.9% |

This is a relative software-renderer stress measurement, not an absolute FPS
claim; forced transmission rendering under SwiftShader was already below the
30 FPS product target. The p95 samples were too noisy to use for a decision.

Decision: enable the single shadow key in the high-quality tier only. The
measured median regression is below the 10% budget and visual inspection showed
useful grounding around the flask and burette without covering graduations.
Reduced graphics remains entirely shadow-free because it is the safety path for
weak devices. During T0141 manual verification, disable the shadow again if a
Chromebook-class device shows either a greater than 10% median-frame regression
against its no-shadow baseline or cannot sustain 30 FPS during dispensing.
Never increase the map above 512² to rescue appearance.

## Interaction and affordance states

The 3D object, equipment-bar button, cursor, hover label, and focused controls
must represent one shared state.

| State | 3D treatment | DOM treatment | Motion |
| --- | --- | --- | --- |
| Rest | Natural material | White secondary button | None |
| Hover | `hoverMint` shell at 24% opacity; scale 1.04; short name chip | Primary border/text | 120 ms ease-out |
| Keyboard focus | Same preview as hover | 3 px `lab-focus` ring with 2 px offset | 120 ms, no pulse loop |
| Selected/focused | `selectionTeal` shell or reading ring at 32% opacity | Solid primary button with light text | Camera transition only |
| Physical action active | Relevant moving part plus live stream/ripple | Pressed control and live numeric status | Only while action is active |
| Disabled | No hover shell; keep object visible | 55% visual opacity and `not-allowed` cursor | None |

- Interactive meshes must use an invisible hit target at least 1.4 times their
  narrow visible dimension. HTML controls must be at least 44 × 44 CSS pixels.
- Hover labels are concise nouns, never instructions. They are `aria-hidden`
  because the keyboard-operable equipment bar supplies the accessible name.
- Hover shells do not change chemistry colors or cover graduation textures.
- A first equipment activation focuses it. A physical sub-action is enabled
  only in its focus view. The complete HTML path remains available beside the
  scene.
- Use `pointer` for equipment, `crosshair` only during look mode, and default
  cursor elsewhere. Never imply zoom or free orbit.
- Do not use color as the only state cue: pair color with a label, border,
  position, pressed state, or live text.

## Camera and motion

The camera keeps a 42° FOV, no roll, no zoom, and no orbit. Overview position
remains fixed; focus poses move position and target together. All continuous
animation must preserve `frameloop="demand"`, call `invalidate()` only while
active/settling, and go cold afterward.

| Motion | Duration/rate | Easing and behavior | Reduced motion |
| --- | --- | --- | --- |
| Equipment focus | 650 ms | `easeInOutCubic` | Snap |
| Hover enter/leave | 120 ms perceived response | Exponential/ease-out to 1.04/1.00 | Instant state, no pulse |
| Button/chip state | 120 ms | Ease-out color, border, transform | Instant color/border |
| Edge pan | Up to 1.2 rad/s | Smoothstep outside 0.25 NDC dead zone | Disabled |
| Look acceleration | 5 s⁻¹ | Accelerate toward edge input | Disabled |
| Look momentum | 116 ms half-life | Damping 6 s⁻¹; stop when settled | Disabled |
| Arrow look | 5° per key press | Discrete step | Same discrete step |
| Stopcock detent | Direct drag | 100 ms detent debounce; release returns closed | Same direct manipulation |
| Falling drip | Detent-scaled | Continuous only while dispensing | Keep functional motion |
| Flask ripple | 357 ms cycle | Expand and fade only while dispensing | One restrained cycle or static ring |
| Status/prompt entry | 160 ms | Opacity only; no slide over measurements | Instant |

Functional liquid motion remains under reduced motion when needed to show that
dispensing is active, but remove repetition that is merely decorative.

## Typography

- Typography is defined centrally in `src/app/globals.css`. Components must use
  the semantic `type-*` classes or the `--font-*` and `--type-*` tokens; do not
  declare a new font stack inside a component.
- The single Adobe Fonts Web Project contains `tomarik-display` (Tomarik
  Display, regular) and `neulis-sans` (Neulis Sans regular, medium, semibold,
  and bold). Load its generated `https://use.typekit.net/<kit>.css` URL by
  setting `NEXT_PUBLIC_ADOBE_FONTS_STYLESHEET` in the deployment environment.
  The root layout preconnects and loads that stylesheet only when it is a valid
  Adobe URL. Until the project owner provides the kit URL, the intentional
  Trebuchet/Avenir/Segoe fallbacks remain active. Never self-host or commit
  Adobe font files.
- `--font-display` / Tomarik is reserved for the product mark, experiment and
  page titles, major section headings, welcome screens, and completion states.
  Use its regular weight and compact spacing; never use it for instructions,
  controls, tables, safety information, coach messages, or measurements.
- `--font-ui` / Neulis Sans is the default for body copy, instructions,
  buttons, navigation, panels, forms, dialogs, tooltips, coach content, and
  teacher surfaces. Prefer regular, medium, and semibold weights; use bold
  only for a focused emphasis.
- `--font-instrument` is limited to live scientific readouts such as burette
  readings, pH, timers, temperatures, and concentrations. Pair it with
  tabular numerals. Ordinary UI text and procedural numbering stay in Neulis.
- Use sentence case. Tiny equipment labels, safety classifications, and
  instrument units may use uppercase at no more than `0.04em` tracking. Avoid
  all-caps page furniture and heavy/tracked headings.
- Root size is 16 px. Body copy is 0.9375 rem minimum; supporting copy is 0.8125
  rem minimum; interactive labels are 0.8125 rem minimum. Canvas-only labels
  may use 0.75 rem when their DOM equivalent is present.
- Always place a normal space between a value and unit in prose (`12.50 mL`).
  Preserve the experiment's required decimal precision and use the instrument
  token for live numeric displays.

## UI tokens and components

Use a 4 px base spacing unit. Allowed spacing steps are 4, 8, 12, 16, 24, 32,
and 48 px.

| Token | Value |
| --- | --- |
| Small radius | 10 px |
| Card radius | 16 px |
| Pill radius | 999 px |
| Control border | 1 px `lab-border` |
| Focus ring | 3 px `lab-focus`, 2 px offset |
| Card shadow | `0 16px 40px rgb(23 33 43 / 8%)` |
| Floating-chip shadow | `0 6px 18px rgb(23 33 43 / 16%)` |
| Control minimum height | 44 px |
| Main content maximum width | 90 rem |

### Buttons

- Primary: solid `lab-primary`, light text, 44 px minimum height, 10 px radius.
- Secondary: `lab-surface`, primary ink, `lab-border`; hover uses a primary
  border and `lab-primary-soft` background.
- Quiet/back: no filled default background; underline links on hover/focus.
- Destructive: use danger color only for destructive meaning. Disabled controls
  retain readable text and use 55% opacity.
- A press may translate by at most 1 px. Do not bounce, glow, or indefinitely
  pulse controls.

### Cards and control groups

- Main bench/notebook cards use `lab-surface`, card radius, one border, and the
  card shadow. Nested groups use `lab-surface-muted`, small radius, and no
  shadow.
- Application cards use the global 16 px radius. Pill radii are reserved for
  compact statuses and segmented controls, not large containers.
- Keep related label, current value, and action in one group. Do not place a
  shadow around every field.
- At narrow widths, stack controls before shrinking type or touch targets.

### Chips, tooltips, prompts, and contextual menus

- Status chips are pills with `lab-primary-soft` and primary ink. They report
  state, not actions.
- 3D hover tooltips use a 94% `lab-surface`, one primary-tinted border, the
  floating-chip shadow, and no pointer events.
- The contextual prompt is a slim single-message strip, max two lines, pinned
  inside the Canvas with 12 px inset. It must never cover the burette meniscus
  in a focus pose and must move below the look-mode chip when both are present.
- Contextual equipment menus remain ordinary DOM controls adjacent to the
  Canvas. Do not put precision inputs or required instructions only in Drei
  HTML overlays.
- Live regions announce a semantic state transition once. Animated values such
  as pending milliliters must not flood announcements every frame.

## Measurement legibility

Measurement graphics outrank glass realism and environmental lighting.

- Use `graduationInk` for every burette/flask graduation, number, unit, and
  selected meniscus ring. Never tint graduations with indicator accents.
- The unit-test luminance helper in T0141 must assert `graduationInk` against
  every liquid color below. The required direct-color ratio is at least 4.0:1.

| Liquid | Contrast against `graduationInk` |
| --- | ---: |
| Burette titrant | 11.37:1 |
| Colorless | 13.33:1 |
| Faint pink | 8.81:1 |
| Pink | 4.92:1 |
| Yellow | 9.79:1 |
| Green | 5.36:1 |
| Blue | 4.08:1 |
| Red | 4.12:1 |
| Orange | 5.92:1 |

- Final composited marks must remain at least 3:1 against the immediately
  adjacent rendered liquid/glass/background in both quality tiers.
- Major ticks and numerals must render at least 2 device pixels thick in their
  designated focus pose; minor ticks at least 1 device pixel. Keep labels
  upright, non-mirrored, and facing the focus camera.
- The burette's concave meniscus maps the measured value to its center-bottom.
  The selection ring is centered at that same Y, is no thicker than 2 device
  pixels in focus, and may not cover the curved bottom. Camera target and copy
  must reinforce “read the bottom of the concave meniscus.”
- Keep flask labels `25`, `50`, `75`, and `100 mL` visible in flask focus. Keep
  the burette's full measurement span visible in burette focus together with
  the flask color.
- Measurement state must also be present as text with unit and required
  precision. Color, surface height, animation, and sound are never the only
  source of a result.

## Synthesized sound opportunities

T0142 may add WebAudio synthesis only. Sound must be created after an explicit
student gesture, start muted if the browser cannot establish a gesture-gated
AudioContext, and expose a persistent-for-session mute toggle. No audio files,
autoplay, speech, or background music.

| Cue | Synthesis target | Trigger and limit |
| --- | --- | --- |
| Valve detent | 35 ms triangle click at 420 Hz plus 12 ms noise transient | One per settled detent; honor 100 ms debounce |
| Drop | 45–70 ms band-pass noise burst centered near 1.8 kHz | Dropwise only; no more than 5 cues/s |
| Slow/open stream | Quiet filtered-noise bed, 180 ms seamless envelope | While held; gain follows detent; stop immediately on close |
| Endpoint | Two sine notes, 660 then 880 Hz, 110 ms each | Once from existing endpoint evidence, never from UI chemistry |
| Rinse/fill | 180 ms low filtered-noise “squeeze/glug” | On accepted existing engine action only |
| Indicator bottle | 30 ms soft tap at 520 Hz | On accepted bottle selection |

Keep the master gain at or below 0.12 and the endpoint cue at or below 0.16.
Every cue duplicates a visible/textual state change. Muting sound must not stop
simulation actions, and reduced motion must not imply muted audio.

## Accessibility and performance invariants

- Preserve the full keyboard/HTML path through the experiment and the existing
  accessible names, live regions, data attributes, and Escape precedence.
- Meet WCAG AA text contrast and 3:1 focus/non-text contrast. Never remove an
  outline without an equal or stronger replacement.
- Honor `prefers-reduced-motion` and the manual reduced-graphics toggle as
  separate preferences.
- Keep `frameloop="demand"`; a closed valve and settled camera produce no
  chained invalidation.
- Cap DPR at the existing `[1, 1.5]`, keep the sky at 16 × 12 segments, and do
  not add post-processing, dynamic environment capture, or runtime texture
  downloads.
- High and reduced tiers use the same palette names and scientific projection.
  Reduced graphics disables transmission, room environment, and all shadows;
  it does not remove graduations, meniscus curvature, labels, hit targets, or
  feedback text.

## Student confirmation patterns

- Indicator bottles open the same in-simulation review dialog as the precision
  controls. The dialog shows the deterministic transition range and low,
  transition, and high-pH colors before the single allowed addition is sent to
  the experiment engine.
- Burette preparation is a visible two-part setup: a student selects either
  distilled water or titrant and separately selects the funnel. Rinsing or
  filling is unavailable until both selections are present.
- New coach comments open the lab-coach surface automatically. The persistent
  coach control remains available for reopening or dismissing it.
- A recommended checkpoint retry is never automatic. The report first explains
  that the completed session remains saved, then requires the student to choose
  whether to create a new child practice session from the verified checkpoint.

## T0141 implementation checklist

T0141 is conformant only when all items below are true:

- `labPalette.ts` owns every 3D hex value, including CanvasTexture and sky
  inputs; no other file in `src/components/lab/three` contains a hex color.
- Lab CSS uses the named route tokens above and does not repurpose indicator
  accents as generic UI status colors.
- Materials match the table, with nonzero metalness restricted to fixtures.
- The high tier uses exactly one 512² six-caster shadow key; reduced graphics
  uses none. The browser console contains no shadow-map deprecation warning.
- Graduation palette tests cover every liquid pair at 4.0:1 or better.
- Burette and flask graduations, the meniscus bottom/ring, and endpoint color
  pass visual checks in overview and their focus poses in both quality tiers.
- Hover, selected, keyboard focus, disabled, and active-action states match the
  state table without changing interaction semantics.
- Camera, demand-loop, reduced-motion, existing e2e selectors, and chemistry
  engine files remain unchanged in behavior.

## Project-owner review record

Status: accepted by the project owner on 2026-07-17. Agent conformance review
is complete, and the separately required owner approval has been recorded.

The owner review should answer these concrete questions:

1. Does the product character feel playful and inviting for middle/high-school
   students without reading as childish or toy-like?
2. Are the exact palette, typography, shape, material, lighting, shadow,
   interaction, motion, measurement, and sound rules acceptable as the
   normative direction for the lab?
3. Are scientific legibility, accessibility fallbacks, and the reduced-quality
   hardware path prioritized correctly?
4. Is the one-key high-tier shadow decision acceptable given the documented
   measured cost and rollback threshold?
5. May T0140 be marked accepted as written, or are specific revisions required?

Objective evidence available to the reviewer:

- T0141 implemented the centralized palette/material/lighting rules and its
  conformance tests pass.
- T0142 implemented the specified gesture-gated procedural sound rules and its
  policy/invocation tests pass.
- The complete pre–Lab Composer gate passes strict TypeScript, ESLint,
  formatting, 187 unit/component tests, 25 Chromium tests, and the constrained
  actual-render profile.

- Owner decision: **approved**
- Reviewer/date: **project owner / 2026-07-17**
- Requested revisions, if any: **none**
