# Agent and Deterministic-System Boundaries

## Governing principle

> LLMs do pedagogy and authoring; deterministic engines do chemistry.

Lab Composer adds a new authoring role without weakening the current truth boundary. An AI-authored workflow is data that selects verified capabilities. It is not a plugin, formula, simulation engine, safety policy, or permission to run.

## Responsibility map

| Actor/system | Owns | Does not own |
|---|---|---|
| Lab Authoring Agent | Structured workflow drafts, family/component selection from tool results, step wording/sequence, coach-trigger selection, rubric wording, retry-template selection | Registry content, chemistry truth, runtime state, support status, assignment approval |
| Lab Workflow Judge Agent | Advisory critique of skill alignment, pedagogy, clarity, rubric, coach relevance, teacher/device usability | Runnability, safety eligibility, chemistry review, registry changes, simulation mutation |
| Student Coach Agent | Event-grounded hints, questions, reflection, active-flag teaching, validated retry suggestions | Chemistry calculation, grading truth, arbitrary chat, state mutation, workflow validation |
| Evaluator Agent | Evidence-linked formative scoring language against a supplied rubric, event log, submission, and deterministic ground truth | Invented measurements, formulas, event counts, unsupported rubric evidence, simulation mutation |
| Deterministic chemistry engines | pH curves, equivalence, solubility/precipitate identity, calorimetry math, measurement consequences, state transitions, ground truth, semantic events | Pedagogical prose, assignment approval, LLM orchestration |
| Hard Validator | Schema/ID/compatibility/safety/runnability decisions, support status, canonical hash, preview/assignment eligibility | Pedagogical taste, chemistry calculation outside registered engine capability contracts, teacher approval |
| Registries | Stable supported IDs, capabilities, compatibility, precision, availability, policies, aliases | Runtime invention from prompts, freeform LLM updates |
| Teacher | Prompt intent, edits to permitted fields, preview, accept/regenerate/reject, final assignment approval | Waiving hard validation or creating runtime capabilities through prose |
| Runtime Assembler/UI | Resolve a runnable spec, render state, dispatch typed actions, show results/status | Chemistry formulas, fuzzy ID fallback, self-validation, silent capability substitution |

## Non-negotiable gates

1. No AI-authored workflow runs without deterministic validation.
2. Every registry ID resolves exactly before runtime assembly.
3. The current spec hash must match its validation result.
4. Only `runnable` workflows may be previewed as a student or assigned.
5. Judge Agent approval cannot override validator failure.
6. Teacher approval cannot override validator failure.
7. Unsupported workflows are rejected, marked partial/unsupported, or retained only as clearly non-runnable drafts.
8. Every meaningful student action still flows through `ExperimentDefinition.step()`.
9. Simulation actions never wait for an LLM or persistence.
10. Semantic events remain the evidence contract for coaching, StudentModel, evaluator, replay, persistence, and analytics.

## Allowed behavior examples

### Lab Authoring Agent

Allowed:

- Select `endpoint_control` and `meniscus_reading` after registry search maps both to verified titration support.
- Use a registered near-endpoint seed template for a short practice workflow.
- Write “Record the bottom of the concave meniscus” as student instruction.
- Narrow a dispense action to a validator-approved maximum per step.
- Return a non-runnable aspirin-synthesis outline with missing capabilities and supported alternatives.

### Lab Workflow Judge Agent

Allowed:

- Flag that the rubric omits one requested skill.
- Recommend restricting a coach trigger to error flags so correct work stays silent.
- Suggest clearer high-school wording and a data-table alternative to a graph.
- Request deterministic revalidation when a capability reference appears inconsistent.

### Student Coach Agent

Allowed:

- After `flow_rate_high_near_endpoint`, ask what delivery mode would give finer control.
- Use current observable state supplied by the engine to contextualize a hint.
- Stay silent after `controlled_addition_near_endpoint`.
- Request a registered endpoint-control retry template.

### Evaluator Agent

Allowed:

- Score an explanation against rubric descriptors and cite `read_meniscus`/`add_titrant` evidence.
- Explain a significant-figure issue using apparatus precision supplied by deterministic configuration.

### UI/runtime

Allowed:

- Render the engine-projected flask color.
- Disable Preview and Assign when validation is not runnable.
- Dispatch a registry-adapted typed action to `ExperimentDefinition.step()`.

## Forbidden behavior examples

### Inventing truth or capability

Forbidden:

- Authoring a new `component.reflux_condenser.v1` because a teacher requested aspirin synthesis.
- Letting the Judge Agent claim a reagent pair forms a precipitate.
- Asking the Student Coach to calculate an equivalence point or calorimetry result.
- Generating a formula or lookup table inside a workflow, UI component, or prompt response and treating it as engine truth.
- Fuzzy-matching an unknown registry ID to the “closest” available component at runtime.

### Bypassing validation

Forbidden:

- Previewing a `draft_unvalidated`, `partially_supported`, `unsupported`, or `rejected_for_safety` workflow.
- Trusting validator fields returned by the LLM/client.
- Keeping an old passing validation after a teacher edit changes the spec hash.
- Turning Judge Agent `approve` into `supportStatus: "runnable"`.
- Hiding hard errors behind an overall AI quality score or optimistic wording.

### Mutating simulation outside the engine

Forbidden:

- Letting authored step prose directly change burette volume or flask color.
- Setting a retry to arbitrary serialized state that the plugin did not validate.
- Computing pH, precipitate identity, heat flow, measurement tolerance, or readiness metrics in React components.
- Allowing an LLM tool call to mutate live experiment state.

## Safety and unsupported behavior

The Hard Validator owns platform safety eligibility through versioned policies. Agents may explain constraints and propose registered alternatives. They may not interpret a virtual pass as a statement that a physical procedure is safe.

An unsupported request should expose:

- the requested objective;
- missing/restricted capabilities;
- the hard support status;
- any bounded portion that is available;
- clearly different supported alternatives;
- a non-runnable label for any retained outline.

Open-flame equipment remains restricted/future for the Chromebook MVP. Organic synthesis, reflux, filtration/recrystallization, gas collection, electroplating power supplies, and arbitrary equipment physics are not implied by the composer architecture.

## Change control

- Schema or validator changes require unit tests for success, rejection, and safety behavior.
- New registry IDs require entry tests, compatibility tests, and documentation.
- New event flags require engine, coach/eval, and positive stay-silent tests.
- Runtime assembler changes require at least one runnable seed workflow replay.
- Agent prompt/model changes require structured-output and behavior evals.
- Assignment and analytics versions must preserve historical replay/evidence meaning.
