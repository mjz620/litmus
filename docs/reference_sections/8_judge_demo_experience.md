# 8. Judge demo experience
![Judge experience flow](assets/judge_flow.png)

## 8.1 Core principle

Judge Mode is a dedicated demo product surface, not a hidden query parameter in the normal application. It optimizes time-to-understanding while using the real engine, agent, persistence path, and dashboard.

## 8.2 `/demo` hub

### No authentication

The page opens directly and displays three large cards:

1. **Experience the Student Lab** — recommended first.
2. **View the Teacher Dashboard**.
3. **Inspect How It Works** — architecture, live event trace, tool calls, and eval results.

### Persistent demo bar

Visible on all `/demo/*` routes:

```text
DEMO MODE   [Student] [Teacher] [Technical]   [Reset demo]
```

Add a one-sentence guided instruction beneath the bar when useful. Do not create modal onboarding.

## 8.3 Student demo

### Initial state

- Experiment: strong-acid/strong-base titration.
- Burette conditioned correctly.
- Titrant added: 22.00 mL.
- Expected equivalence: approximately 25.00 mL.
- Curve backfilled consistently.
- Coach active.
- Session attached to an ephemeral judge identity within a dedicated demo class.

### Guided demo rail

A small optional panel says:

1. “Open the stopcock quickly and add about 2 mL.”
2. “Ask: Why does going past the endpoint matter?”
3. “Submit the short report.”
4. “Try the personalized retry.”
5. “Switch to Teacher to see your evidence appear.”

The judge may hide the guide.

### Required “aha” sequence

1. Judge adds titrant too quickly near endpoint.
2. Engine emits `flow_rate_high_near_endpoint` and `endpoint_overshoot`.
3. Coach asks a context-aware question rather than presenting a generic warning.
4. Judge asks a voice or text question.
5. Tutor references the actual action and measurement.
6. Judge submits a compact prefilled report with one intentionally flawed explanation.
7. Evaluator returns evidence-linked feedback.
8. Adaptive Retry starts at 22.00 mL.
9. Judge performs controlled addition and succeeds.
10. Teacher dashboard shows the judge session and updated skill evidence.

## 8.4 Teacher demo

### Seeded data

- Demo class: “AP Chemistry — Period 3.”
- 24 realistic student profiles.
- Sessions generated through the same engine/event schema or a validated seed generator.
- Mix of completion and common misconceptions.
- Seed data is clearly labeled “Demo class data.”

### Live judge session

The current browser’s demo student session appears as a highlighted row:

> “Your demo session — completed just now.”

Its metrics should be produced by the live persistence pipeline, not hardcoded into the dashboard.

## 8.5 Technical demo

This view is strongly recommended because it maps directly to technical implementation criteria.

### Panels

1. **Architecture diagram.**
2. **Live semantic event inspector.**
3. **Current StudentModel.**
4. **Latest agent input/output and tool calls.**
5. **Chemistry truth tests.**
6. **Coach eval table.**
7. **Performance budget.**
8. **Codex contribution summary.**

### Live trace example

```text
Action
add_titrant({ volumeML: 2.0, durationS: 1.0 })
        ↓
Engine event
flags: [flow_rate_high_near_endpoint, endpoint_overshoot]
        ↓
StudentModel
endpoint_control: 0.50 → 0.34
        ↓
Agent tool
record_diagnosis(endpoint_control, endpoint_overshoot)
        ↓
Coach response
“What change to the addition rate would give you more control?”
        ↓
Persistence
Event and skill checkpoint saved
```

## 8.6 Demo reset behavior

- Reset deletes or ignores only the current ephemeral judge session.
- Base seeded class data remains stable.
- Reset returns Student Demo to the 22.00 mL seed.
- No judge can corrupt the shared demo tenant.
- Prefer a browser-scoped demo run ID and server-enforced row ownership.

---
