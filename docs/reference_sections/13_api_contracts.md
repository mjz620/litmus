# 13. API contracts
## 13.1 `POST /api/coach`

### Request

```json
{
  "sessionId": "uuid",
  "experimentId": "acid_base_titration",
  "trigger": "semantic_event",
  "stateSummary": {
    "totalTitrantML": 26.0,
    "displayedPH": 11.96,
    "observedColor": "pink",
    "currentStage": "approach_endpoint"
  },
  "latestEvent": {},
  "recentEvents": [],
  "studentModel": {},
  "previousInterventions": [],
  "studentQuestion": null
}
```

### Response

Validated `CoachResponse`.

### Server behavior

1. Authenticate or validate demo scope.
2. Rate-limit by session and IP.
3. Validate payload.
4. Apply deterministic trigger policy; return `silent` without model call if not eligible.
5. Call GPT-5.6 with system policy, compact context, and tools.
6. Validate structured output.
7. Execute only allowlisted tools.
8. Persist intervention asynchronously.
9. Return response.

## 13.2 `POST /api/evaluate`

### Request

```json
{
  "sessionId": "uuid",
  "experimentId": "acid_base_titration",
  "report": {},
  "rubric": [],
  "groundTruth": {},
  "evidenceSummary": [],
  "studentModel": {}
}
```

`groundTruth` should be computed on the trusted server or signed/validated. Do not trust arbitrary hidden values from the browser.

### Response

Validated `RubricEvaluation`.

## 13.3 `POST /api/sessions/checkpoint`

Accepts batches:

```ts
interface CheckpointRequest {
  session: SessionCheckpoint;
  events: Array<{ sequenceNo: number; payload: SemanticEvent }>;
  skillEstimates: Record<string, SkillEstimate>;
}
```

Behavior:

- upsert session,
- insert events idempotently,
- upsert skill estimates,
- return acknowledged highest sequence number.

## 13.4 `POST /api/realtime-token`

Returns a short-lived, session-scoped token for browser voice input. Apply origin checks, rate limits, session call caps, and safe model configuration.

## 13.5 `POST /api/demo/reset`

- Requires a valid browser-scoped demo run token.
- Clears only that run’s ephemeral data.
- Never deletes base demo class rows.

---
