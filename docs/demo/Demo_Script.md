# Three-Minute Demo Script

Target runtime: **2:55**. The story leads with the access gap, then proves that
Litmus is a meaningful rehearsal—not a worksheet wearing a 3D skin.

## Research note (not read aloud)

Avoid quoting an unverified national percentage for high-school lab space. The
defensible claim is that access to laboratory facilities and resources is
uneven, and that practical laboratory participation is associated with stronger
motivation and perceived learning. Background: [NAEP science student
experiences](https://www.nationsreportcard.gov/science/student-experiences/)
and [a recent study of practical laboratory
work](https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2026.1726102/full).

Rules this script satisfies (OpenAI Build Week):

- Under 3 minutes, public YouTube.
- Audio explicitly explains **how Codex and GPT-5.6 were used**.
- Project is shown working end to end.

Format below: **VO** = spoken aloud. `SCREEN` = what you do while saying it.

---

## 0:00–0:28 — the access gap

`SCREEN` `/demo` hub, then open the Labs card. Pause on the four lab cards.

> **VO:** "Hands-on lab work builds confidence and understanding, but access
> is uneven. When space, equipment, or time are scarce, students get too few
> chances to practise before they reach the real bench."

> **VO:** "Many digital labs are still fixed animations or worksheets. Litmus
> is a browser rehearsal: students manipulate equipment, make a consequential
> mistake, ask for help in context, and arrive more ready for the physical lab."

## 0:28–1:03 — a real mistake, not a scripted click-through

`SCREEN` Open **Acid–base titration**, select **Start the lab**, then make an
endpoint-control mistake by opening the stopcock too far near the endpoint.

> **VO:** "This is an acid–base titration on the same Chromebook-class browser
> path a student uses. Near the endpoint, I open the stopcock too far. The
> color change, delivered volume, and endpoint miss are deterministic
> consequences of that action—not a scripted animation."

`SCREEN` Show the endpoint result and open the coach.

> **VO:** "The engine emits semantic evidence about the mistake. GPT-5.6 does
> not calculate chemistry or change the run; it turns that evidence into a
> concise question or hint that helps the student reason about what happened."

## 1:03–1:28 — feedback and a targeted retry

`SCREEN` Open the report, submit the prepared response, then show the retry or
the relevant coaching guidance.

> **VO:** "Feedback is tied to recorded actions and evidence, not invented
> after the fact. The goal is not to make the lab easier; it is to make the
> hard moment safe to repeat until the technique makes sense."

## 1:28–1:50 — teacher evidence before the real lab

`SCREEN` Demo navigation → **Teacher**. Highlight readiness and the shared
endpoint-control misconception.

> **VO:** "The same evidence gives the teacher a readiness view before the
> physical lab. Instead of guessing why a class struggled, they can see a
> shared endpoint-control misconception before reagents are on the table."

## 1:50–2:20 — adaptable lessons without inventing science

`SCREEN` Demo navigation → **Composer**. Show the verified equipment, actions,
and validation status; if live authoring is available, submit a short request.

> **VO:** "Teachers should not have to become simulation developers. In Lab
> Composer, GPT-5.6 can propose a workflow from a closed catalog of verified
> equipment and actions—typed commands, never arbitrary code or formulas."

> **VO:** "Litmus validates every reference, safety rule, and assessment
> mapping, then executes real runtime traces. A separate GPT-5.6 Judge can
> critique pedagogy, but only the teacher approves a runnable lesson."

## 2:20–2:43 — how GPT-5.6 and Codex were used

`SCREEN` Hold on Composer validation, then show the repository test output or
the README architecture diagram.

> **VO:** "GPT-5.6 handles bounded language tasks: coaching, evidence-linked
> feedback, authoring proposals, and advisory review. Deterministic TypeScript
> owns pH, concentrations, conservation, heat flow, replay, and scoring truth."

> **VO:** "Under my product direction, Codex implemented most of Litmus: Lab
> Composer; the shared runtime and deterministic models across four chemistry
> labs; 3D equipment; the Coach, Author, Judge, and Evaluator integrations;
> Supabase persistence and replay; accessibility; and the test suite. Scoped
> tickets and hard architecture rules kept that work reviewable."

## 2:43–2:55 — close on access, not replacement

`SCREEN` Return to `/demo/labs`.

> **VO:** "Litmus does not replace a physical chemistry lab. It makes serious
> rehearsal available before one—and gives students who have less lab access a
> more confident, evidence-backed way to arrive ready."

---

## Recording checklist

- [ ] **Record against production, not a local mock route.** Confirm the
      recording environment uses GPT-5.6 before saying it does.
- [ ] Run `/api/demo/reset` immediately before the take.
- [ ] Audio recorded separately or in a quiet room—judges score what they can
      hear.
- [ ] Under 3:00 on the uploaded file, not just in the script.
- [ ] Uploaded public on YouTube (not unlisted).

## Demo acceptance checklist

- No auth required.
- The access case and a working student lab appear in the first minute.
- A student mistake yields deterministic consequences and contextual coaching.
- Teacher view connects student evidence to a concrete reteaching decision.
- Composer shows AI assistance bounded by deterministic validation and teacher
      approval.
- Audio names both Codex and GPT-5.6 with specifics.
