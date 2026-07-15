# 10. AI tutor and agentic workflows
## 10.1 Agent role

The tutoring agent is a constrained pedagogical decision-maker. It may:

- interpret structured events,
- diagnose likely misconceptions,
- select a pedagogical goal,
- choose whether to stay silent,
- ask a Socratic question,
- provide a graduated hint,
- answer a direct student question using current lab context,
- record a diagnosis through a validated tool,
- select a validated adaptive-retry template,
- resolve or defer an active flag.

It may not:

- compute chemistry ground truth,
- mutate experiment state,
- create arbitrary seed state,
- invent measurements,
- directly write SQL,
- reveal hidden expected values before pedagogically appropriate,
- give unsafe real-world laboratory advice beyond the approved protocol,
- answer unrelated questions indefinitely.

## 10.2 Context package

Every coach call receives a compact bounded payload:

```ts
interface CoachRequest {
  sessionId: string;
  experimentId: string;
  trigger: "semantic_event" | "student_question" | "inactivity" | "stage_transition";
  stateSummary: Record<string, unknown>;
  latestEvent?: SemanticEvent;
  recentEvents: SemanticEvent[]; // max 8
  studentModel: StudentModel;
  currentStage: string;
  previousInterventions: CoachInterventionSummary[]; // max 4
  studentQuestion?: string;
  protocolContext?: string;
}
```

Never send the full raw 3D state if a concise summary is sufficient.

## 10.3 Agent tools

Recommended server-side tools:

### `get_protocol_fragment`

```json
{
  "experimentId": "acid_base_titration",
  "concept": "burette_conditioning",
  "hintLevel": 1
}
```

Returns approved, age-appropriate protocol/pedagogy context.

### `record_diagnosis`

```json
{
  "skillId": "endpoint_control",
  "reason": "endpoint_overshoot",
  "confidence": 0.94,
  "evidenceEventIds": ["event_123"]
}
```

The server validates skill/reason names and persists a structured diagnosis if desired.

### `resolve_active_flag`

```json
{
  "flag": "flow_rate_high_near_endpoint",
  "resolution": "student_demonstrated_controlled_retry"
}
```

### `create_targeted_retry`

```json
{
  "templateId": "titration_endpoint_control_v1",
  "targetSkill": "endpoint_control",
  "difficulty": "standard"
}
```

The server maps the template to a validated seed and success criteria.

### `set_learning_goal`

```json
{
  "skillId": "endpoint_control",
  "goal": "student explains why addition rate should decrease near endpoint"
}
```

## 10.4 Structured coach response

```ts
interface CoachResponse {
  decision: "silent" | "message" | "offer_retry";
  mode?: "socratic_question" | "hint" | "explanation" | "warning" | "encouragement";
  message?: string;
  hintLevel?: 0 | 1 | 2 | 3;
  addressedSkills: string[];
  addressedFlags: string[];
  followUpExpected?: boolean;
  retryTemplateId?: string;
  reasonCode: string; // inspectable, not shown to student
}
```

The server validates the response with Zod/JSON Schema.

## 10.5 Hint escalation policy

- **Level 0 — Reflection:** ask the student to interpret what they observe.
- **Level 1 — Direction:** point to the relevant variable or procedure step.
- **Level 2 — Principle:** explain the scientific or procedural relationship.
- **Level 3 — Explicit guidance:** state the next appropriate action and why.

Example for endpoint overshoot:

- L0: “What changed about the solution after that last addition?”
- L1: “Compare your addition rate near the endpoint with the rate you used earlier.”
- L2: “The pH changes sharply near equivalence, so each drop has a much larger effect.”
- L3: “Close the stopcock, then reopen it to add titrant dropwise while swirling.”

## 10.6 Multi-turn memory

The canonical learning memory is the in-memory `StudentModel`, not an opaque chat transcript.

```ts
interface StudentModel {
  sessionId: string;
  experimentId: string;
  skills: Record<string, SkillEstimate>;
  activeFlags: string[];
}
```

Maintain a short intervention summary rather than an unbounded transcript:

```ts
interface CoachInterventionSummary {
  eventType: string;
  addressedSkill: string;
  hintLevel: number;
  messageSummary: string;
  studentOutcome?: "resolved" | "unresolved" | "unknown";
}
```

Flush the StudentModel to persistence only at checkpoints; do not block simulation actions on network writes.

## 10.7 Report evaluator

### Inputs

- experiment ID,
- rubric definitions,
- final report fields,
- deterministic ground truth,
- selected event evidence,
- final StudentModel.

### Output

```ts
interface RubricEvaluation {
  criteria: Array<{
    id: string;
    score: 0 | 1 | 2 | 3 | 4;
    strength: string;
    improvement: string;
    evidence: Array<{
      source: "report" | "event" | "measurement";
      reference: string;
    }>;
  }>;
  overallSummary: string;
  recommendedSkill?: string;
  retryTemplateId?: string;
}
```

### Guardrails

- Ground truth is supplied by the engine.
- Every score must cite at least one input evidence item.
- The model cannot alter persisted mastery directly; report evidence is converted through a validated evidence mapper.
- Teacher-facing numeric class metrics are never generated by the model.

---
