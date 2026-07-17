# Lab Workflow Judge Agent

## Purpose

The Lab Workflow Judge Agent is a second LLM that critiques whether a proposed, validator-eligible workflow is a good lesson for the teacher's request. It reviews pedagogy and usability; it does not establish scientific support or runtime eligibility.

## Why it is separate

An author tends to defend its own framing and may miss misalignment introduced while satisfying constraints. A separate critic receives the teacher request, the exact spec, registry capability summary, and hard validation result. Separation creates a visible review step, allows independent evals/prompts/model versions, and reduces false confidence.

The Judge Agent is not the product demo judge. “Judge Agent” here means the LLM critic; a Build Week judge is a human user who can inspect its output.

## Inputs

```ts
interface JudgeRequest {
  teacherRequest: string;
  workflow: LabWorkflowSpec;
  validation: ValidationResult;
  capabilitySummary: {
    targetSkillIds: string[];
    familyId: string;
    availableEventTypeIds: string[];
    availableFlagIds: string[];
    deviceProfileId: string;
  };
}
```

The server verifies that `validation.canonicalSpecHash` matches the workflow before critique. A safety-rejected or schema-invalid draft does not need pedagogical approval; it may receive a limited explanation, but the UI must not confuse it with runtime eligibility.

## What it judges

- Does the workflow actually teach or test the requested skills?
- Do steps build a coherent high-school learning sequence?
- Are student instructions unambiguous and appropriately concise?
- Does the rubric measure the stated objective using available evidence?
- Do coach triggers address meaningful moments without over-intervening?
- Do hints scaffold thinking without giving away answers?
- Can a teacher understand, preview, edit, and assign the workflow efficiently?
- Is the workflow practical for under-resourced schools and Chromebook-class devices?
- Are safety messaging and age appropriateness pedagogically sound, while deferring hard eligibility to the validator?

## What it must not judge

The Judge Agent must not:

- recompute pH, equivalence point, precipitate identity, solubility, heat flow, measurement tolerance, or grading ground truth;
- declare a component, reagent, action, engine, event flag, or seed supported;
- override, reinterpret, or waive validator errors;
- invent registry IDs or propose new runtime behavior inside a revision;
- directly mutate a workflow or simulation state;
- expose hidden chain-of-thought;
- claim that real-world procedures are safe because the virtual workflow runs.

If it sees a possible scientific/runnability concern, it should request deterministic revalidation using a concise issue rather than pronounce a new truth.

## Structured output schema

```ts
type JudgeRecommendation =
  | "approve"
  | "revise"
  | "mark_partially_supported"
  | "reject";

type JudgeIssueSeverity = "blocker" | "medium" | "low";

type JudgeDimension =
  | "skill_alignment"
  | "pedagogical_quality"
  | "student_clarity"
  | "rubric_alignment"
  | "coach_trigger_relevance"
  | "safety_appropriateness"
  | "teacher_usability"
  | "under_resourced_school_suitability";

interface JudgeCritique {
  critiqueVersion: string;
  specHash: string;
  scores: Record<
    JudgeDimension,
    { score: 1 | 2 | 3 | 4 | 5; rationale: string }
  >;
  issues: Array<{
    severity: JudgeIssueSeverity;
    dimension: JudgeDimension;
    path: string;
    critique: string;
    suggestedRevision: string;
  }>;
  strengths: string[];
  summary: string;
  recommendation: JudgeRecommendation;
}
```

The route validates this output structurally. Rationales must cite spec paths or teacher-request phrases, not hidden reasoning.

## Scoring dimensions

Scores use a five-point anchored scale: 1 = materially fails the dimension, 3 = usable but has meaningful gaps, 5 = clear and well aligned. Scores are advisory and never collapse into a runtime pass/fail score.

### Skill alignment

Checks that each primary requested skill is explicitly targeted by steps and assessment evidence, and that no unrelated activity dominates limited time.

### Pedagogical quality

Checks sequencing, cognitive load, observation-before-explanation choices, age appropriateness, useful reflection, and whether the activity can produce learning rather than clicks alone.

### Student clarity

Checks vocabulary, action specificity, step length, prerequisite explanation, accessibility wording, and whether a student knows what to record.

### Rubric alignment

Checks criterion-to-objective mapping, evidence relevance, scoring-guide clarity, proportional weights, and whether criteria accidentally assess unsupported content.

### Coach trigger relevance

Checks that interventions correspond to meaningful flags/events, positive behavior stays silent, cooldowns avoid nagging, and hints do not disclose answers prematurely.

### Safety / appropriateness

Reviews clarity and age appropriateness of safety messaging. It may flag an apparent omission for deterministic review. The hard validator alone decides safety eligibility.

### Teacher usability

Checks whether the title, objective, duration, component list, workflow, validator context, and rubric are easy to preview and explain to a class.

### Under-resourced-school suitability

Checks declared Chromebook profile, duration, accessibility fallbacks, network independence during simulation, visual complexity, and whether the workflow offers useful practice without assuming abundant physical materials.

## Issue severities

- **`blocker`:** A pedagogical defect makes the workflow misleading or unable to meet the requested objective, such as a missing primary skill or a rubric that grades unrelated content. “Blocker” is advisory and cannot create or clear a validator blocker.
- **`medium`:** Meaningfully reduces learning or usability but has a localized revision, such as vague observation instructions or an overbroad coach trigger.
- **`low`:** Polish improvement with limited effect, such as a title or teacher-note refinement.

## Final recommendations

- **`approve`:** Pedagogically ready; only meaningful when hard validation is `runnable`.
- **`revise`:** The author should address one or more critique issues, then revalidate and request a fresh critique.
- **`mark_partially_supported`:** The stated goal is only partly represented even if the assembled subset is valid. This advises the author/application to preserve the validator's status or narrow the promise; it does not set hard status.
- **`reject`:** The concept is pedagogically inappropriate, incoherent, or irreparably misaligned within available capabilities. Hard safety/unsupported state remains validator-owned.

If hard validation is not `runnable`, `approve` must not enable preview or assignment and should generally be treated as an invalid judge output in route/eval policy.

## Good critique examples

> **Medium · student_clarity · `steps[1].studentInstruction`:** “Near the endpoint” is not operationally connected to an observable cue. Ask the student to watch the registered persistent indicator-color observation before switching to dropwise delivery; do not add a numeric endpoint value.

Why good: it points to a path, uses an available observation, improves clarity, and does not compute chemistry.

> **Blocker · rubric_alignment · `rubric.criteria[0]`:** The teacher requested meniscus reading, but the rubric scores only endpoint control. Add a criterion tied to `event.read_meniscus.v1` and the registered volume-reading observation.

Why good: it traces the objective to existing evidence and gives a bounded revision.

> **Medium · coach_trigger_relevance · `coachTriggers[0]`:** The trigger responds to every `add_titrant` event and would interrupt correct dropwise work. Restrict it to the registered high-flow/overshoot flags and preserve the controlled-addition stay-silent reason.

Why good: it prevents false interventions using explicit semantic contracts.

## Bad critique examples

> “Change the endpoint to 24.8 mL so the lab is harder.”

Bad because the judge invented chemistry/configuration truth.

> “I approve this Bunsen burner workflow, so ignore the restricted-component error.”

Bad because judge approval cannot override validation.

> “Add a reflux condenser component called `component.reflux.v1`.”

Bad because the judge invented a registry ID and runtime capability.

> “The lab could be more engaging.”

Bad because it is not path-specific, measurable, or actionable.

## How the authoring agent uses feedback

The Authoring Agent should map each accepted issue to a specific field revision, preserve exact registry IDs, and include a short revision summary. Validator errors are fixed first. After any change, previous validation and critique are stale; the server must recompute the hash, rerun hard validation, and request a new critique when eligible.

The author may decline feedback that conflicts with registry capability, hard validation, the teacher request, or the revision budget. It should state the constraint rather than inventing a workaround. The loop stops after two revisions following the initial draft.

## Advisory versus authoritative

The hard validator answers: **Can this exact workflow run safely within verified platform capabilities?**

The Judge Agent answers: **Is this validated proposal a clear, aligned, useful learning experience?**

Both matter, but authority is asymmetric:

- failed hard validation always disables runtime;
- passing hard validation is necessary but not sufficient for teacher approval;
- judge critique can request revision or rejection but cannot set `runnable`;
- a teacher owns final assignment approval only after validation passes.
