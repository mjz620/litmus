# Report Evaluator and Adaptive Retry

## Report evaluator purpose

The evaluator gives formative rubric feedback after a session. It uses deterministic ground truth, events, and StudentModel evidence. It may phrase feedback, but it must not invent measurements or calculate hidden chemistry.

## Rubric dimensions

- `concept_understanding`
- `procedure`
- `data_analysis`
- `sig_figs`

## Criterion shape

```ts
type RubricCriterion = {
  score: 0 | 1 | 2 | 3;
  feedback: string;
  evidenceEventTypes: string[];
};
```

## Evaluator guardrails

- Reference evidence event types.
- Use finalState values supplied by engine.
- Do not fabricate event counts.
- Distinguish procedural mistakes from conceptual mistakes.
- Recommend retry only when a valid template exists.

## Adaptive Retry purpose

Adaptive Retry creates a short seeded practice scenario targeting one skill, not a full restart.

## Retry flow

```text
Evaluator or coach identifies skill gap
  ↓
Select allowed retry template
  ↓
Validate seed through experiment plugin
  ↓
Start child session with parent_session_id
  ↓
Student practices one skill
  ↓
New evidence updates StudentModel
  ↓
Teacher sees retry improvement
```

## Titration retry templates

### Endpoint control retry

- Start at 22.00 mL titrant added.
- Correct endpoint around 25.00 mL.
- Coach goal: encourage dropwise addition and observation.
- Success: addition rate below threshold near endpoint and endpoint not overshot beyond tolerance.

### Burette conditioning retry

- Start before filling burette.
- Student chooses rinse liquid.
- Coach goal: connect residual water to concentration bias.
- Success: student conditions with titrant and explains why.

## Retry constraints

- No arbitrary LLM-generated state.
- Only plugin-validated seeds.
- Parent/child sessions linked.
- Retry evidence is labeled separately from original session evidence.
