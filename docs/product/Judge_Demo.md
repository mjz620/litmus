# Judge Demo Product Surface

## Principle

Judge Mode is a dedicated demo environment, not a hidden query parameter. It optimizes time-to-understanding while using the real engine, coach route, persistence path, and teacher dashboard.

## Routes

```text
/demo
/demo/student
/demo/teacher
/demo/technical
/api/demo/reset
```

No `/demo/*` route requires authentication.

## `/demo` hub

Three cards:

1. **Experience the Student Lab** — recommended first.
2. **View the Teacher Dashboard**.
3. **Inspect How It Works** — technical architecture, event trace, tool calls, evals.

## Persistent demo bar

Visible everywhere under `/demo`:

```text
DEMO MODE   [Student] [Teacher] [Technical]   [Reset demo]
```

## Student demo initial state

- Experiment: strong acid/strong base titration.
- Burette conditioned correctly.
- Titrant added: 22.00 mL.
- Expected equivalence: approximately 25.00 mL.
- Curve backfilled consistently.
- Coach active.
- Session attached to ephemeral judge identity in the demo class.

## Guided student rail

Optional side panel:

1. Open the stopcock quickly and add about 2 mL.
2. Ask: “Why does going past the endpoint matter?”
3. Submit the short report.
4. Try the personalized retry.
5. Switch to Teacher to see your evidence appear.

## Required aha sequence

1. Judge adds titrant too quickly near endpoint.
2. Engine emits `flow_rate_high_near_endpoint` and `endpoint_overshoot`.
3. Coach asks a contextual reflection question.
4. Judge asks a voice or text question.
5. Tutor references actual volume/state.
6. Judge submits compact prefilled report with one intentionally flawed explanation.
7. Evaluator returns evidence-linked feedback.
8. Adaptive Retry starts at a valid intermediate seed.
9. Judge performs controlled addition.
10. Teacher dashboard shows judge session and updated skill evidence.

## Teacher demo

Teacher dashboard shows seeded class data plus a highlighted row for the current judge session. Seeded data must be schema-valid and labeled as demo data.

## Technical demo

Panels:

- live engine state,
- semantic event stream,
- StudentModel update,
- coach request/response shape,
- checkpoint payload,
- teacher aggregate query,
- eval harness table.

## Reset behavior

`/api/demo/reset` clears only current ephemeral judge session data and restores seed data. It must not affect production data or global demo seed rows.
