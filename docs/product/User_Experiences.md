# User Experiences

## 1. Student experience

### Student persona

**Who:** High-school chemistry student preparing for a physical laboratory. The student may be curious and self-directed, anxious about lab procedures, new to hands-on chemistry, or attending a school with limited laboratory resources. They may be using a low-spec school Chromebook, sharing devices, or relying on virtual preparation because their school has limited access to chemicals, glassware, lab time, or individualized teacher support.

### Student jobs

- Understand the purpose of each lab step.
- Practice equipment handling without wasting materials or making unsafe mistakes.
- Ask questions while actively working through a procedure.
- Learn through guided hints rather than direct answer dumps.
- Connect procedural choices to chemistry concepts.
- Know whether they are ready for the real lab.

### Student journey

```text
Home / experiment select
  ↓
Pre-lab briefing
  ↓
3D laboratory workspace
  ↓
AI coach + text/voice questions
  ↓
Report submission
  ↓
Rubric feedback
  ↓
Adaptive Retry if needed
  ↓
Completion / history
```

### Student screen: experiment select

Cards show available experiments:

- Acid-Base Titration — P0 hero.
- Precipitation / Solubility — P1 plugin proof.
- Calorimetry — P2 stretch.

Guest access is allowed. Authentication is offered only to save progress or attach to a teacher class.

### Student screen: pre-lab briefing

Must include:

- goal of the lab,
- equipment list,
- safety note,
- procedure checklist,
- key concepts,
- what the AI coach can and cannot do.

Tone should be calm and confidence-building.

### Student screen: 3D lab workspace

Chromebook layout:

```text
┌────────────────────────────────────────────────────────────┐
│ Session bar: experiment, save status, report button         │
├──────────────────────────────┬─────────────────────────────┤
│ 3D canvas                    │ AI Lab Coach                │
│ low-poly bench               │ hints, questions, transcript│
│ burette/flask/tools          │                             │
├──────────────────────────────┴─────────────────────────────┤
│ Focused controls: stopcock, volume, meniscus, graph         │
└────────────────────────────────────────────────────────────┘
```

3D is for spatial context. Precision actions use explicit 2D controls so students can perform accurate operations on trackpads.

### Student interactions for titration

- Fill burette.
- Rinse burette with titrant or water.
- Choose indicator.
- Set stopcock flow rate.
- Add titrant in controlled increments.
- Read meniscus.
- Observe flask color.
- Inspect pH curve.
- Record endpoint volume.
- Submit report.

### AI coach behavior

The coach should:

- stay quiet during routine successful actions,
- ask reflective questions after meaningful mistakes,
- escalate hints only when the student remains stuck,
- answer direct student questions using current state,
- avoid solving calculations immediately unless the student asks for checking.

### Hold to Ask

Student holds a microphone button, asks a question, sees transcript, and receives a context-aware response. If voice fails, the text box remains the canonical fallback.

Raw audio is not stored by default.

### Report feedback

Rubric dimensions:

- concept understanding,
- procedure,
- data analysis,
- significant figures.

Feedback must reference evidence from the session.

### Adaptive Retry

If a meaningful gap is detected, the system offers a compact retry scenario. Example: after endpoint overshoot, start near 22.00 mL and practice dropwise endpoint control.

## 2. Teacher experience

### Teacher persona

High-school chemistry teacher assigning pre-lab practice to one or more classes.

### Teacher jobs

- Assign/share rehearsal quickly.
- See who completed it.
- Identify class-wide misconceptions before the physical lab.
- Drill into evidence for students who need support.
- Decide what to reteach in a five-minute pre-lab briefing.

### Teacher journey

```text
Teacher home
  ↓
Create/select class
  ↓
View assignment/class overview
  ↓
Inspect readiness and misconceptions
  ↓
Open student detail if needed
  ↓
Use before-class briefing
```

### Teacher home

Shows classes, recent assignments, completion status, and a CTA to create a class.

### Class overview

Cards:

- completion rate,
- average readiness,
- most common misconception,
- number needing attention.

Main visualization:

- skill readiness by class,
- breakdown by skill,
- completion states,
- common misconception table.

### Student roster

Columns:

- student name,
- completion status,
- readiness score,
- report score,
- strongest skill,
- skill needing review,
- last activity.

### Student detail

Shows:

- overall readiness,
- skill cards,
- evidence timeline,
- coach interventions,
- report and rubric feedback.

Teachers see educationally relevant evidence only. Do not expose model chain-of-thought or raw hidden reasoning.

### Deterministic readiness metric

For titration:

```text
burette_conditioning  0.25
endpoint_control      0.30
volumetric_reading    0.20
stoichiometry         0.25

student_readiness = 100 × Σ(weight_i × mastery_i)
```

Metrics are deterministic aggregates over `skill_estimates`, `events`, and `reports`.

## 3. Judge experience

The judge gets a dedicated `/demo` environment with no auth and persistent role switcher:

```text
DEMO MODE   [Student] [Teacher] [Technical]   [Reset demo]
```

The judge should see the full student-to-teacher loop without setup.
