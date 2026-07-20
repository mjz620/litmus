# Product

## Register

product

## Platform

web

## Users

High-school chemistry students are the primary audience, and they arrive at this
product in a specific state: about to do a real lab, unsure what the procedure
actually asks of them, and often anxious about wasting materials or breaking
something. Many are on shared, low-spec school Chromebooks. Many attend schools
where glassware, reagents, and lab time are scarce enough that repeated hands-on
practice simply isn't available. Their job is to rehearse technique until they
know what to do next and why it matters.

Teachers are the secondary audience. They author and validate lab workflows in
the Composer, assign them, and read back readiness evidence for a class. Their
surfaces serve the student's session rather than competing with it.

## Product Purpose

An AI-native virtual chemistry lab that prepares students for physical
laboratory work by observing their simulated actions, diagnosing misconceptions,
and giving teachers readiness evidence.

Success is a student who reaches the physical bench ready: able to say what they
do next, why that action matters, and whether they are prepared. Everything
else — the Composer, the class dashboards, the coach — exists to produce that
outcome or to prove it happened.

## Positioning

Deterministic chemistry, observed. The engine owns what is true; the AI observes
what the student did and explains it. That is what separates this from a video,
a quiz, or a chatbot that will confidently invent a pH.

## Brand Personality

Tactile, warm, credible. Playful enough that a nervous student leans in rather
than freezes; serious enough that a burette reading looks like a measurement and
not a score. The interface should feel like equipment a student is allowed to
touch — colorful and dimensional, with real graduations, real menisci, and
consequences that follow from what they did.

Voice is plain and specific. It names the next action, the reason it matters,
and what the student is looking at. It never congratulates without evidence and
never hedges about chemistry.

## Anti-references

**Sterile enterprise LMS.** Grey tables, dense forms, Blackboard/Canvas energy —
the software students have already learned to disengage from.

**Generic AI-SaaS.** The cream-and-sans landing aesthetic, hero metrics, gradient
headings. Reads as a product demo rather than a teaching instrument, and quietly
undercuts the claim that the chemistry underneath is real.

## Design Principles

**Deterministic truth stays visible.** Chemistry, measurement, and grading are
engine-owned. The interface projects that state; it never computes, rounds away,
or decorates over it. A number on screen is one a student could defend.

**Rehearsal, not simulation theatre.** Every surface should answer the three
questions the product promises: what do I do next, why does this matter, am I
ready. Detail that serves none of those is decoration.

**Approachable without being toy.** The tension is the point. Lower the
intimidation barrier through warmth, tactility, and clear affordances — not by
making the chemistry look less real.

**Runs on the worst device in the room.** Chromebook-class performance is a
design constraint, not an optimization pass. Under-resourced schools are the
audience, not the edge case.

**Evidence over assertion.** Teacher-facing surfaces show what a student
actually did, grounded in recorded actions. Nothing shown as evidence may be
model-generated.

## Accessibility & Inclusion

WCAG 2.1 AA. Every lab action has a keyboard path, since 3D pointer gestures
cannot be the only way to run a procedure. Scientific state is never carried by
color alone — precipitate colour, indicator colour, and endpoint signals must
also be available as text. Motion respects `prefers-reduced-motion`, and a
reduced-graphics mode exists for low-spec hardware, which is an accessibility
concern here as much as a performance one.
