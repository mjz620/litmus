# Codex task: fix the Lab Composer capability authoring agent (never reaches the model)

## Symptom

The capability authoring / "agent builder" flow never produces a usable plan.
It looks like the model returns invalid output.

## Actual root cause (verified by execution, not inference)

**The model is never called at all.** The JSON Schema sent to OpenAI is
`strict: true` but contains keywords that strict mode forbids, so the API
rejects the request with HTTP 400 `invalid_json_schema` before any inference
happens.

Verified by running the SDK's own conversion against the real schema:

```
strict=true  type=json_schema
FORBIDDEN "minLength": 11
FORBIDDEN "maxLength": 13
FORBIDDEN "maxItems":   7
FORBIDDEN "$schema":    1
```

- Request construction: `src/lib/agent/lab-authoring/capabilityOpenAi.server.ts:97-116`,
  which calls `client.responses.parse({ ..., text: { format: zodTextFormat(capabilityAuthorPlanSchema, "capability_author_plan") } })`.
- Source of the constraints: `capabilityAuthorSchemas.ts:26`
  (`const boundedText = (maximum = 800) => z.string().trim().min(1).max(maximum)`),
  `.max(...)` on the arrays at lines 60-83, and `idSchema` bounds inherited via
  `normalizedLabActionSchema` (`src/lab-workflows/runtime/generic/schemas.ts:49-76`).
  `zodTextFormat` emits these as `minLength`/`maxLength`/`maxItems` verbatim and
  sets `strict: true`. OpenAI rejects the whole schema.

**Why it presents as a validation failure rather than an API error.** The 400 is
an `OpenAI.APIError`, not a `CapabilityAuthoringError`, so `capabilityAuthor.ts:1002-1019`
catches it and rewrites it as `authoring.model_unavailable.v2`. That code is in
`DETERMINISTIC_FALLBACK_ERROR_CODES` (`capabilityAuthor.ts:161-166`), so the
handler at `capabilityAuthor.ts:249-264` silently substitutes the deterministic
fallback authoring path. The real error only ever reaches a `console.error` in
`capabilityOpenAi.server.ts:117-123`. **The LLM path has almost certainly never
worked in production.**

Two things that are **not** the cause, already ruled out — do not spend time on them:

- The model ID `gpt-5.4-mini` is valid and currently served.
- The schema sent and the schema validated against are the same object; there is
  no divergence. The structural requirements strict mode *does* enforce
  (`additionalProperties: false`, complete `required` arrays, object at root) are
  all already satisfied.

## Required fixes

### 1. Send a strict-compatible schema; keep the bounds for validation

Constraints like length and item limits are legitimate **validation** rules — they
just cannot be transmitted in strict mode. Derive an unbounded schema for
transmission and keep the full bounded Zod schema for validating the response.

Bypass `zodTextFormat` and strip the forbidden keywords:

```ts
const STRIP = new Set([
  "minLength", "maxLength", "minItems", "maxItems", "pattern", "format",
  "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum",
  "multipleOf", "$schema", "default"
]);

const strictify = (node: unknown): unknown =>
  Array.isArray(node)
    ? node.map(strictify)
    : node && typeof node === "object"
      ? Object.fromEntries(
          Object.entries(node)
            .filter(([key]) => !STRIP.has(key))
            .map(([key, value]) => [key, strictify(value)])
        )
      : node;
```

Send `text: { format: { type: "json_schema", name: "capability_author_plan", strict: true, schema: strictify(z.toJSONSchema(capabilityAuthorPlanSchema)) } }`,
then validate the returned object with `capabilityAuthorPlanSchema.parse(...)`
yourself. Bounds then live only where they can actually be enforced — and a
bounds violation becomes a recoverable re-prompt rather than a hard failure.

### 2. Stop masking provider errors

At `capabilityAuthor.ts:1002`, branch on `error instanceof OpenAI.APIError`.
Map non-retryable configuration faults (400, 401, 404) to a **distinct,
non-retryable** error code that is *not* in `DETERMINISTIC_FALLBACK_ERROR_CODES`,
and keep only 429 and 5xx in the fallback set. Without this, fix #1 can regress
invisibly exactly as it did here — a silent fallback is why this went unnoticed.

Surface the provider's message in server logs with enough detail to diagnose.

### 3. Handle the dropped `.superRefine` — this will bite immediately after #1

`capabilityAuthorSchemas.ts:85-108` uses `.superRefine` to require that a plan
carry exactly one of all five trace kinds. Refinements **cannot** be expressed in
JSON Schema, so the model never sees this rule — it exists only as prose in
`capabilityPrompt.ts:14`. Any deviation makes `responses.parse` throw a `ZodError`
that lands in the same masking catch.

Catch `ZodError` explicitly and **re-prompt once** with the specific issue list
appended, rather than falling through to `model_unavailable`. Bounded retry —
do not loop indefinitely.

### 4. Detect truncation

`maxOutputTokensPerCall: 6_000` (`capabilityAuthorSchemas.ts:14`) against 5 trace
cases × up to 32 actions can hit the cap. An incomplete response yields
`output_parsed == null` → `authoring.output_invalid.v2`
(`capabilityOpenAi.server.ts:140-147`), which is indistinguishable from a
malformed response. Check `response.status === "incomplete"` and report it as its
own condition. Consider whether the cap is high enough for the worst-case plan.

## Tests required

The reason this shipped broken: **every existing test injects a hand-written
planner stub** (`mode: "mock"` throughout
`tests/ai/lab-composer/authoring/capabilityAuthor.test.ts`). Nothing calls
`zodTextFormat` or `responses.parse`, so the schema is never checked against
strict-mode rules. `capabilityRoute.test.ts:181` asserts on *source text*
(`expect(liveSource).toContain("process.env.OPENAI_API_KEY")`) — a string grep,
not an execution. A CI-visible failure was structurally impossible.

Add, without requiring network access:

1. **A schema conversion test** asserting the transmitted schema contains none of
   the forbidden keywords. Three lines, catches this class of bug permanently,
   and keeps catching it as the Zod schemas evolve. This is the highest-value
   test in the task.
2. **A test that the transmitted schema still satisfies what strict mode
   requires** — `additionalProperties: false` and complete `required` arrays on
   every object — so stripping does not break the parts that must stay.
3. **An error-mapping test** proving a simulated 400 `APIError` surfaces as a
   non-retryable error and does **not** silently trigger the deterministic
   fallback.
4. **A `ZodError` re-prompt test** using a stubbed client returning a plan that
   violates the `.superRefine` rule.
5. **A truncation test** for `status: "incomplete"`.

Stub at the OpenAI client boundary rather than at the planner, so the request
construction path is actually exercised.

## Verification

```bash
npx tsc --noEmit
npx vitest run
npx next build
```

If you have an API key available, run one real end-to-end authoring request and
report the outcome verbatim — including whether the returned plan passes
`capabilityAuthorPlanSchema.parse`. If you do not have a key, say so plainly
rather than implying the live path was verified.

## Deliverable

State what the request now sends, what the response validation now enforces, how
each failure mode is now surfaced, and — explicitly — whether the live model path
was executed or only stubbed.
