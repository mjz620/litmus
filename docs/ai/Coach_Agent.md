# Student Coach

## Authority

The Coach is an optional, asynchronous pedagogical consumer. Deterministic code decides whether unsolicited coaching is warranted. The Coach cannot mutate simulation state, reset or rewind a checkpoint, add or remove workflow rules, calculate chemistry, determine grading truth, or block a student action.

Routine successful work stays silent. A student can always ask a direct lab question.

## Contracts

Two adapters intentionally coexist:

- The legacy request/response accepts experiment state, recent legacy semantic events, `StudentModel`, and the existing trigger policy. Historical sessions and production-default legacy labs keep this behavior.
- The strict `2.0.0` authored contract is used by setup-driven sessions. Its Coach-only context contains the exact current Preview-eligible definition and hash, runtime provenance, active objective IDs, exact instructions and rules, deterministic diagnoses, semantic-event envelopes, permission attempts, workflow status, and currently available registered actions.

The authored context is built live from the generic runtime. It is not a second Lab IR and is not written into the existing checkpoint consumer envelope.

Before invoking a provider, core code rechecks:

- current definition eligibility, canonical hash, validator, registry, adapter, model, and compatibility provenance;
- exact definition/objective/instruction/rule projections;
- one diagnosis per active rule with matching severity, recovery, objectives, and evidence IDs;
- registered event types, permissions, actions, and rule evidence;
- deterministically recomputed currently available actions;
- explicit question/retry reasons or event reasons grounded in a current violation/evidence trigger.

Unknown or stale context fails closed.

## Trigger and silence policy

Questions and requested retries are explicit. Unsolicited calls originate only from the local trigger policy using meaningful flags, repeated negative evidence, or violated workflow diagnoses. The store deduplicates ongoing reasons so the same active mistake does not repeatedly call the Coach; a reason may trigger again only after clearing and recurring.

For v2 output:

- a current violated diagnosis is preferred and linked to its exact rule, objectives, instruction, and evidence;
- a compatibility event flag may use an exact authored `coachPolicy` trigger and its matching evidence;
- an alternate valid path or routine success returns silence without calling a model;
- a direct question may use exact authored instruction/objective context even without a violation.

Hint level can never exceed the deterministic request limit.

## Student-facing guidance categories

Every authored response labels its role in plain language:

| Structured kind | Student label | Meaning |
| --- | --- | --- |
| `mandatory_procedure` | Required procedure | A required procedural rule or recovery |
| `safety` | Safety | A safety-severity rule; presented as a warning |
| `optional_context` | Optional context | Helpful best practice that is not mandatory |
| `ai_guidance` | AI guidance | Advisory explanation for a concept or direct question |

Messages show no workflow hashes, raw paths, rule IDs, or implementation references.

## Model boundary and fallback

The live provider is server-only, structured-output-only, capped at 1,200 output tokens, and aborted before the route deadline. Its prompt receives reviewed instructional/evidence projections rather than hidden chemistry ground truth.

Model output is rejected if it:

- invents an objective, rule, instruction, evidence event, or recovery action;
- suggests an action that is not currently available;
- exceeds the hint limit or mislabels safety;
- makes a numeric chemistry claim;
- requests simulation/checkpoint reset or workflow-rule mutation;
- ignores an authorized intervention or escapes the strict schema.

Configured mock mode, provider failure/timeout, and invalid model output use deterministic authored guidance with an explicit fallback reason. The simulation remains interactive if the entire Coach request fails.

## Evidence

Focused coverage lives in:

- `tests/coach/authoredCoach.test.ts`
- `tests/coach/authoredCoachRoute.test.ts`
- `tests/coach/triggerPolicy.test.ts`
- `tests/stores/labStore.test.ts`
- `tests/components/coachPanelPresentation.test.ts`
- the setup-driven Coach case in `tests/e2e/setup-driven-session.spec.ts`

The legacy Coach and eval-harness suites remain unchanged and green.
