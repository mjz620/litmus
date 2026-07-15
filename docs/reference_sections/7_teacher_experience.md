# 7. Teacher experience
![Teacher experience flow](assets/teacher_flow.png)

## 7.1 Teacher journey overview

1. Sign in with Google.
2. Create a class or open an existing class.
3. Share a join code or link.
4. Assign a pre-lab experiment.
5. Open the readiness dashboard before the physical lab.
6. Inspect completion, class skill mastery, and misconceptions.
7. Drill into a student when needed.
8. Use the dashboard’s “Before class” briefing to decide what to reteach.

## 7.2 Teacher screen 1 — teacher home

### Layout

- Header: Teacher dashboard, profile, demo/help.
- Class cards:
  - class name,
  - student count,
  - active assignment,
  - completion percentage,
  - readiness status.
- “Create class” CTA.
- Recent activity feed.

### Create class

Minimum fields:

- class name,
- section/period optional,
- school year optional.

Output:

- six-character join code,
- shareable link.

## 7.3 Teacher screen 2 — class overview

### Header

- class name,
- join code with copy button,
- number of students,
- active assignment selector,
- “Assign experiment” CTA.

### Primary cards

1. **Completion**
   - completed / assigned.
2. **Class readiness**
   - 0–100 deterministic score.
3. **Needs attention**
   - number of students below threshold.
4. **Most common misconception**
   - reason tag plus plain-language label.

### Main visualization

**Skill readiness table/heatmap**

| Skill | Class mastery | Students ready | Needs review | Trend |
|---|---:|---:|---:|---:|
| Burette conditioning | 0.82 | 20 | 4 | — |
| Endpoint control | 0.67 | 15 | 9 | — |
| Volumetric reading | 0.74 | 18 | 6 | — |
| Stoichiometry | 0.58 | 12 | 12 | — |

P0 may omit trend if no historical assignment data exists.

### Common misconceptions panel

Examples:

- “Adds titrant too quickly near the endpoint” — 9 students.
- “Rinses the burette with water but not titrant” — 6 students.
- “Reads the meniscus outside ±0.05 mL” — 5 students.
- “Treats endpoint and equivalence point as identical observations” — 4 students.

Each row links to affected students and evidence.

### “Before class” briefing

A compact, optionally AI-written summary grounded in deterministic aggregates:

> “Review why addition rate should decrease near the endpoint. Nine of 24 students added titrant faster than the configured threshold, and six overshot by more than 0.3 mL. Consider demonstrating dropwise stopcock control before distributing reagents.”

The metric values must be supplied by SQL/API results. The model may phrase the recommendation but may not create numbers.

## 7.4 Teacher screen 3 — student roster

Columns:

- student name,
- completion status,
- readiness score,
- report score,
- strongest skill,
- skill needing review,
- last activity.

Filters:

- incomplete,
- needs attention,
- misconception reason,
- report score range.

## 7.5 Teacher screen 4 — student detail

### Summary

- student name,
- experiment,
- completion time,
- overall readiness,
- report score.

### Skill cards

For each skill:

- mastery estimate,
- evidence count,
- latest positive/negative reason,
- confidence note when evidence is sparse.

### Evidence timeline

Only pedagogically meaningful events, not every interaction:

```text
02:14  Rinsed burette with water
       Evidence: burette_conditioning −0.9
       Coach: asked student to predict effect of residual water

05:48  Added 2.0 mL in 1.0 s near endpoint
       Flags: high flow rate, endpoint overshoot
       Evidence: endpoint_control −0.7, −0.9

08:31  Completed adaptive retry successfully
       Evidence: endpoint_control +0.8
```

### Report

Show student response, rubric scores, and feedback.

### Privacy rule

Teachers see educationally relevant evidence. Raw voice audio is never stored. Voice transcript retention should be off by default or limited to the message needed for the session. Do not expose hidden chain-of-thought or internal model reasoning.

## 7.6 Deterministic teacher metrics

### Student readiness

For titration, default weights:

```text
burette_conditioning  0.25
endpoint_control      0.30
volumetric_reading    0.20
stoichiometry         0.25
```

```text
student_readiness = 100 × Σ(weight_i × mastery_i)
```

Weights live in experiment metadata so each plugin can define its own readiness function.

### Class skill mastery

```text
class_skill_mastery = average(latest mastery for completed students)
```

### Ready threshold

Default: mastery ≥ 0.70. Configurable later.

### Needs-attention rule

A student appears in “Needs attention” if any of the following is true:

- required skill mastery < 0.60,
- two or more strong negative evidence events occur for the same skill,
- report criterion score ≤ 1,
- assigned session is incomplete after due date.

### Common misconception rule

Show a reason when it affects at least:

- three students, or
- 20% of students with completed sessions,

whichever is smaller, with a floor of two students in very small classes.

---
