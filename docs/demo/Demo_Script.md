# Three-Minute Demo Script

Target runtime: **2:55**. Word count: ~430 at ~155 wpm — comfortable, not rushed.

Rules this script satisfies (OpenAI Build Week):

- Under 3 minutes, public YouTube.
- Audio explicitly explains **how Codex and GPT-5.6 were used**.
- Project is shown working end to end.

Format below: **VO** = spoken aloud. `SCREEN` = what you do while saying it.

---

## 0:00–0:12 — hook

`SCREEN` `/demo` hub, cursor idle.

> **VO:** "Students walk into chemistry labs having memorized the procedure,
> but not understanding it. They get one attempt at the real bench, and one
> chance to ruin it. Litmus is the rehearsal that comes first."

## 0:12–0:50 — the mistake, and the coach that notices

`SCREEN` Open `/demo/student`. Burette at 22.00 mL, equivalence ~25.00 mL.
Open the stopcock fast, add ~2.0 mL.

> **VO:** "This is a strong acid–strong base titration, already in progress.
> I'm near the endpoint, and I'm going to make the mistake almost every student
> makes — open the stopcock too far, too close to the equivalence point."

`SCREEN` Colour and pH snap past the endpoint. Curve updates.

> **VO:** "The chemistry here isn't a language model guessing. It's a
> deterministic engine — the same equilibrium math that runs in our unit tests.
> The model never invents a number. What it does is notice. The engine emitted
> two semantic events: flow rate high near endpoint, and endpoint overshoot."

`SCREEN` Coach panel surfaces the contextual reflection question.

> **VO:** "And GPT-5.6 turns those events into a question instead of an answer."

## 0:50–1:15 — ask it anything, in context

`SCREEN` Ask by voice (or text): *"Why does going past the endpoint matter?"*

> **VO:** "I can just ask."

`SCREEN` Let the transcript and answer render. Don't talk over the first
sentence of the reply — let the judges read it.

> **VO:** "Notice it isn't reciting a textbook. It knows I'm at twenty-four
> point one millilitres, it knows I overshot, and it answers *my* run. That
> context comes from a live student model the engine keeps updated — GPT-5.6
> reads it through a tool call rather than us pasting state into a prompt."

## 1:15–1:45 — evidence-linked feedback, then a second chance

`SCREEN` Submit the short prefilled report (one explanation is deliberately wrong).

> **VO:** "Now the lab report — with one explanation I got wrong on purpose."

`SCREEN` Rubric feedback appears, each point linked to a recorded action.

> **VO:** "Every piece of feedback points at something I actually did. Nothing
> here is model-generated evidence."

`SCREEN` Launch the endpoint-control retry. Add dropwise. Hit it clean.

> **VO:** "And it doesn't just mark me wrong — it builds a retry targeting the
> exact skill I missed, seeded mid-experiment so I practise the hard part.
> Dropwise, this time."

## 1:45–2:10 — the teacher loop

`SCREEN` Demo bar → Teacher. Seeded class readiness. Highlight "Your demo
session." Open the endpoint-control misconception panel.

> **VO:** "Teachers get the other half. This is class readiness before anyone
> touches glassware — and that's your session, live, in the list. Six students
> share one misconception about endpoint control. That's tomorrow's five-minute
> lecture, decided by evidence instead of a hunch."

## 2:10–2:45 — how it was built

`SCREEN` Demo bar → Technical. Walk the trace: engine action → semantic event →
StudentModel → coach tool call → persistence. Then the tests/evals table.

> **VO:** "Under the hood: engine action, semantic event, student model update,
> tool call, persistence — every step inspectable. GPT-5.6 runs the coach, the
> evaluator, and the lab-authoring agent, all with structured outputs, so the
> product never parses free text. And Codex built it — I worked ticket by
> ticket, handing Codex a scoped contract and guardrails, and it wrote the
> chemistry engine against these unit tests, the event pipeline, and the
> Composer. The tests you're looking at are the ones that let me trust it."

## 2:45–2:55 — impact

`SCREEN` Back to `/demo` hub, or hold on the teacher dashboard.

> **VO:** "We're not replacing the physical lab. We're making sure every
> student arrives ready for it — and every teacher knows what to review before
> they do."

---

## Recording checklist

- [ ] **Record against prod, not local.** `.env` is pinned to `gpt-5.4-mini`;
      only `prod.env` sets `gpt-5.6`. The narration claims GPT-5.6 — make it
      true, or change the words.
- [ ] `/api/demo/reset` run immediately before the take.
- [ ] Audio recorded separately or in a quiet room — judges score what they can
      hear.
- [ ] Under 3:00 on the uploaded file, not just in the script.
- [ ] Uploaded public on YouTube (not unlisted).

## Demo acceptance checklist

- No auth required.
- Aha moment under 60 seconds.
- Judge can switch roles in one click.
- Teacher view includes live judge session.
- Technical view proves deterministic/event-driven architecture.
- Reset works.
- Audio names both Codex and GPT-5.6 with specifics.
