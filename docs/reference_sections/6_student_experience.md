# 6. Student experience
![Student experience flow](assets/student_flow.png)

## 6.1 Student journey overview

1. Enter as a guest or join a teacher’s class.
2. Select an experiment or open an assignment.
3. Review objectives, controls, and a concise safety/preparation note.
4. Enter the 3D bench.
5. Perform the procedure through direct object interactions.
6. Receive contextual questions or graduated hints only when useful.
7. Ask the tutor questions by text or voice while working.
8. Submit measurements, calculations, and a short explanation.
9. Receive rubric feedback grounded in the action trace and deterministic ground truth.
10. Complete a targeted retry if the system identifies a high-value gap.
11. See completion and readiness results.

## 6.2 Student screen 1 — home / experiment selection

### Purpose
Let the student start quickly while establishing learning objectives.

### Layout

- Top navigation: logo, Experiments, My History, Teacher, Sign In/Profile.
- Hero: “Practice the lab before you enter it.”
- Experiment cards:
  - title,
  - 3D preview image,
  - estimated time,
  - difficulty,
  - skills practiced,
  - status: Available / Assigned / Coming Soon.
- Class join box: six-character code.

### Titration card

- **Title:** Acid–Base Titration
- **Estimated time:** 8–12 minutes
- **Skills:** burette conditioning, endpoint control, volumetric reading, stoichiometry
- **Primary CTA:** Start practice
- **Secondary CTA:** View objectives

### Acceptance criteria

- Guest can begin in one click.
- Assigned students can see the teacher/class context.
- No account creation blocks the demo-critical flow.

## 6.3 Student screen 2 — pre-lab briefing

### Purpose
Teach controls and clarify the experiment’s objective without giving away the result.

### Content

- Objective: determine the unknown acid concentration using a standardized base.
- Equipment list with selectable visual thumbnails.
- Three concise interaction instructions:
  1. Drag the view or use arrow keys to look around.
  2. Click an object to focus it.
  3. Use the object control panel for precise laboratory actions.
- Safety note: simulation only; follow the teacher’s real laboratory safety instructions in the physical lab.
- Optional “Procedure outline” that names stages but does not reveal exact answers.
- “Enter lab” CTA.

### Interaction philosophy

The experience looks first-person, but it is not a freeform physics sandbox. The student focuses an object and uses realistic constrained controls. This produces reliable, accessible, testable actions.

Examples:

- Click burette → focused view → rinse/fill controls.
- Drag stopcock control → changes modeled flow rate.
- Click flask → swirl action.
- Click meniscus → eye-level zoom and reading input.

## 6.4 Student screen 3 — 3D laboratory workspace

### Desktop/Chromebook layout

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Acid–Base Titration   Stage 3 of 5   07:24   Save ✓   Reset   Help │
├─────────────────────────────────────────────┬────────────────────────┤
│                                             │ AI Lab Coach           │
│                                             │ ─────────────────────  │
│           FIRST-PERSON 3D BENCH             │ [context messages]     │
│                                             │                        │
│  burette      flask      indicator          │ Ask a question…        │
│                                             │ [Hold to Ask 🎙]        │
│                                             │                        │
├─────────────────────────────────────────────┼────────────────────────┤
│ Focused tool controls / measurements        │ Lab notebook / curve   │
└─────────────────────────────────────────────┴────────────────────────┘
```

### Core regions

#### A. Top session bar

- Experiment title.
- Current stage label; not a rigid step lock.
- Session timer.
- Persistence state: Saved / Saving / Offline—will sync.
- Reset with confirmation.
- Help/accessibility controls.

#### B. 3D canvas

- Fixed standing location at a low-poly laboratory bench.
- Drag-look or pointer-lock optional; default must not trap the cursor.
- Clickable equipment uses a subtle outline or emissive highlight on hover.
- Camera transitions to focused equipment views; avoid nausea-inducing movement.
- No post-processing dependency.
- State visuals derive only from experiment state:
  - burette fluid level from `titrantAddedML`,
  - flask indicator color from deterministic `observedColor(...)`,
  - live curve from `state.curve`,
  - labels and measurements from display-format functions.

#### C. Focused tool controls

When an object is selected, show precise controls in a 2D panel. Examples:

**Burette controls**

- Rinse with: water / titrant.
- Fill with standardized NaOH.
- Stopcock control with discrete flow bands:
  - Closed,
  - Fast stream,
  - Slow stream,
  - Dropwise.
- Current displayed reading: rounded to burette tolerance.
- “Read meniscus” opens eye-level zoom and student input.

**Flask controls**

- Add indicator.
- Swirl.
- Inspect color.

**Lab notebook**

- Objective.
- Current recorded measurements.
- Optional procedure outline.
- Live pH curve when enabled for the activity.

#### D. AI Lab Coach panel

The panel has four message types with distinct labels:

- **Question:** Socratic prompt.
- **Hint 1/2/3:** graduated support.
- **Explanation:** response to direct student question or after retry.
- **Observation:** neutral consequence statement.

The coach should not use a chatty persona or comment on every action.

### Coach trigger rules

An unsolicited coaching request may occur only when one of these is true:

1. The latest event contains a new high-priority flag.
2. The same negative skill evidence repeats.
3. The student is inactive for a configured duration at a meaningful stage.
4. The student requests help.
5. A stage transition invites reflection.

Additional constraints:

- Maximum one unsolicited message per semantic event.
- Never send a coach request for raw mouse movement or continuous animation.
- Routine successful actions should generally remain silent.
- Do not repeat the same hint at the same level.
- Escalate only after evidence that the previous hint was insufficient.

### Voice: “Hold to Ask”

- Button sits beside the text input.
- Press and hold to record; release to submit.
- Show microphone state, live transcript, cancel gesture, and clear fallback to text.
- The transcript is sent with current experiment state, recent semantic events, and StudentModel.
- The tutor answers in text for P0. Spoken response is optional.
- Voice is an input modality, not a separate tutor with separate memory.

Example:

Student asks: “Why does going past the endpoint matter?”

Context passed to tutor:

- current volume: 26.0 mL,
- modeled equivalence: 25.0 mL,
- event flag: `endpoint_overshoot`,
- student skill estimate: endpoint control 0.37,
- last coach message and hint level.

Expected response:

> “You added more base than was needed to neutralize the acid. In the calculation, that larger recorded volume makes it look as though more acid was present than actually was. Which quantity in your molarity equation changes when the endpoint volume is too large?”

### Student interaction event examples

```json
{
  "type": "add_titrant",
  "tSim": 184.5,
  "observation": {
    "addedML": 2.0,
    "totalML": 26.0,
    "rateMlPerS": 2.0,
    "pH": 11.96,
    "observedColor": "pink",
    "equivalenceML": 25.0
  },
  "flags": [
    "flow_rate_high_near_endpoint",
    "endpoint_overshoot"
  ],
  "evidence": [
    {
      "skillId": "endpoint_control",
      "delta": -0.7,
      "reason": "flow_rate_high_near_endpoint"
    },
    {
      "skillId": "endpoint_control",
      "delta": -0.9,
      "reason": "endpoint_overshoot"
    }
  ]
}
```

## 6.5 Student screen 4 — report submission

### Purpose
Assess whether the student can connect procedure, data, calculation, and interpretation.

### Form structure

1. **Recorded measurements**
   - initial burette reading,
   - final burette reading,
   - volume delivered.
2. **Calculation**
   - known titrant molarity,
   - mole ratio,
   - calculated analyte molarity,
   - optional work/explanation field.
3. **Concept explanation**
   - “How did you decide the endpoint had been reached?”
   - “Describe one procedural choice that could bias the calculated concentration and why.”
4. **Confidence**
   - 1–5 self-rating.

### Submission behavior

- Client validates required fields and units.
- The deterministic engine supplies hidden ground truth.
- The evaluator receives the report, summarized action evidence, rubric, and ground truth.
- The report submission must not be blocked by a model timeout. Show “Report saved; feedback is loading” and stream or poll the result.

## 6.6 Student screen 5 — rubric feedback

### Rubric dimensions

- Concept understanding.
- Procedure.
- Data analysis/calculation.
- Significant figures.

### Each criterion displays

- score on a 0–4 scale,
- one-sentence strength,
- one specific improvement,
- evidence source:
  - report statement,
  - measurement,
  - or semantic event.

### Required design behavior

- Separate “scientific result” from “learning evidence.” A student may obtain the wrong final answer but show correct reasoning in part of the process.
- Do not shame mistakes.
- Do not claim certainty when evidence is ambiguous.
- Show a “Practice this skill” CTA when adaptive retry is available.

## 6.7 Student screen 6 — Adaptive Retry

### Purpose
Turn diagnosis into action.

### Retry design

A retry is a short, seeded micro-lab lasting 60–90 seconds. It reuses the same experiment plugin and shell.

Example: endpoint-control retry

```json
{
  "experimentId": "acid_base_titration",
  "targetSkill": "endpoint_control",
  "reason": "endpoint_overshoot",
  "seed": {
    "titrantAddedML": 22.0,
    "buretteConditioned": true,
    "titrantDilutionFactor": 1.0
  },
  "successCriteria": {
    "maxRateNearEndpointMlPerS": 0.5,
    "maxOvershootML": 0.3
  },
  "maxDurationS": 90
}
```

### Student experience

1. “Let’s retry only the final few milliliters.”
2. The lab opens at 22.00 mL with a valid backfilled curve.
3. The coach provides a concise goal, then remains quiet.
4. The student practices slowing to dropwise addition.
5. A deterministic success check evaluates performance.
6. The student sees a before/after skill result.

### Retry constraints

- The LLM selects from validated retry templates and supplies bounded parameters.
- The LLM never constructs arbitrary chemistry state.
- The server validates seed values against the experiment plugin’s retry schema.
- A retry session is persisted with `parent_session_id` and `mode = 'adaptive_retry'`.

## 6.8 Student screen 7 — completion and history

Display:

- completion status,
- readiness score for this experiment,
- skill cards,
- report score,
- completed retry skills,
- “Review feedback” and “Practice again.”

History is secondary to the teacher loop but should exist for authenticated students.

---
