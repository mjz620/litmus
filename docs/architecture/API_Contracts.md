# API Contracts

## `POST /api/coach`

### Request

```ts
type CoachRequest = {
  sessionId: string;
  experimentId: string;
  currentState: unknown;
  recentEvents: SemanticEvent[];
  studentModel: StudentModel;
  studentQuestion?: string;
  triggerPolicy: {
    source: 'event' | 'question' | 'retry';
    maxHintLevel: number;
  };
};
```

### Response

```ts
type CoachResponse = {
  shouldRespond: boolean;
  interventionType: 'none' | 'hint' | 'question' | 'warning' | 'encouragement';
  skillIds: string[];
  hintLevel: number;
  message: string;
  suggestedToolCall?: {
    name: 'create_targeted_retry' | 'record_diagnosis' | 'set_learning_goal';
    args: Record<string, unknown>;
  };
  evidenceEventTypes: string[];
  safety: {
    refused: boolean;
    reason?: string;
  };
};
```

### Requirements

- Validate with schema.
- Stream response if possible.
- Enforce per-session LLM call cap.
- Do not expose chain-of-thought.
- Refuse off-topic or unsafe requests.
- Return `shouldRespond: false` for routine successful events.

## `POST /api/evaluate`

### Request

```ts
type EvaluateRequest = {
  sessionId: string;
  experimentId: string;
  finalState: unknown;
  events: SemanticEvent[];
  studentModel: StudentModel;
  studentText: {
    procedureSummary: string;
    dataAnalysis: string;
    conceptExplanation: string;
    sourcesOfError: string;
  };
};
```

### Response

```ts
type Rubric = {
  concept_understanding: RubricCriterion;
  procedure: RubricCriterion;
  data_analysis: RubricCriterion;
  sig_figs: RubricCriterion;
  overall_summary: string;
  recommended_retry?: {
    skillId: string;
    reason: string;
  };
};

type RubricCriterion = {
  score: 0 | 1 | 2 | 3;
  feedback: string;
  evidenceEventTypes: string[];
};
```

## `POST /api/sessions/checkpoint`

Accepts batched event, skill, coach, report, and completion updates. Writes must be idempotent.

```ts
type CheckpointRequest = {
  sessionId: string;
  events?: Array<{ clientEventId: string; seq: number; payload: SemanticEvent }>;
  skillEstimates?: Array<{ skillId: string; mastery: number; confidence?: number; latestReason?: string; evidenceCount: number }>;
  finalState?: unknown;
  completedAt?: string;
};
```

## `POST /api/realtime-token`

Returns an ephemeral token or voice-session configuration for browser microphone capture. Must not expose long-lived API keys.

## `POST /api/demo/reset`

Resets current ephemeral judge session and leaves seeded demo data intact.
