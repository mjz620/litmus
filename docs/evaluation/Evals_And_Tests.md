# Evaluation and Tests

## Test pyramid

1. Chemistry truth tests.
2. Plugin contract tests.
3. Coach trigger/eval harness tests.
4. API route tests.
5. Teacher analytics tests.
6. Playwright smoke tests.
7. Manual demo verification.
8. Chromebook performance pass.

## Chemistry truth tests

Required for titration:

- equivalence volume correct,
- pH monotonic during titrant addition,
- display rounding separate from full precision,
- fast addition near endpoint emits mistake flags,
- controlled dropwise addition produces no intervention-worthy flag,
- seed at 22.00 mL is internally consistent,
- invalid seeds rejected.

## Coach eval harness

Seeded scenarios:

| Scenario | Expected behavior |
|---|---|
| Burette rinsed with water | Diagnose dilution risk |
| Endpoint overshot | Ask reflection / endpoint control hint |
| Meniscus misread | Give graduated hint |
| Wrong sig figs in report | Correct in report feedback only |
| Controlled dropwise addition | Stay silent |

Metrics:

- intervention recall,
- false intervention rate,
- structured output validity,
- evidence linkage rate,
- unsafe/off-topic refusal rate.

## Teacher analytics tests

- Completion count matches sessions.
- Readiness score matches weighted mastery formula.
- Common misconception threshold works.
- Needs-attention logic works.
- LLM summary cannot create numeric metrics.

## E2E smoke tests

- `/experiments` loads.
- `/lab/titration` can dispatch a sample action.
- `/demo/student` starts at 22.00 mL.
- `/demo/teacher` loads seeded class.
- `/demo/technical` shows event/eval panels.
- `/api/demo/reset` does not delete seed rows.

## Manual verification

See `docs/Manual_Verification_Guide.md`.
