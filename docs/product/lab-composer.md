# Lab Composer

## Product definition

Lab Composer lets a teacher describe a learning objective in ordinary language and receive a structured lab workflow assembled from verified LabBench components. A request can feel open-ended, but the result is runnable only when every component, action, reagent, engine, safety rule, and event flag resolves through a tested registry.

The product thesis is:

> AI-authored lab workflows over verified deterministic lab primitives.

Lab Composer is not an arbitrary chemistry simulator. The LLM does pedagogy and authoring; deterministic engines do chemistry.

## Teacher problem

Teachers often know the skill their students need to rehearse but do not have time to find, adapt, configure, and grade a matching virtual lab. A teacher should be able to ask for “a 7-minute lab that tests endpoint control and meniscus reading” instead of manually wiring a scene, procedure, rubric, hints, and retry.

The current static-experiment model makes each new variation an implementation project. Lab Composer makes supported variations composable while preserving the verified behavior of existing engines.

## Student value

Students receive a focused rehearsal rather than a generic simulation:

- the procedure, observations, rubric, and coaching all target named skills;
- every meaningful action still passes through a deterministic experiment engine;
- action-aware coaching cites semantic event evidence instead of guessing;
- reports are evaluated against the assigned workflow rubric and actual event log;
- adaptive retries use validated templates and seeds, never invented simulation state.

LabBench remains preparation for hands-on work, not a replacement for physical laboratories, safety instruction, or teacher judgment.

## Relevance to under-resourced schools

Schools with limited glassware, reagents, lab periods, or individual support need repeatable practice that does not consume materials. A bounded component library lets LabBench reuse one Chromebook-friendly runtime across many learning goals. Workflows must declare estimated time, required components, accessibility considerations, and performance tier so teachers can choose an activity that fits their devices and class period.

The MVP must continue to use low-poly assets, explicit measurement controls, demand-driven rendering, local deterministic simulation, and non-blocking network calls. Lab generation may require a server call; running the assigned lab must not.

## Why open-ended authoring matters

Teachers plan around objectives, misconceptions, time, and student readiness—not internal experiment IDs. Natural-language authoring can translate requests such as these into supported skills and lab families:

- “Create a 7-minute lab that tests endpoint control and meniscus reading.”
- “Create a lab that helps students practice net ionic equations.”
- “Create a calorimetry workflow focused on heat transfer sign conventions.”

The open prompt also exposes gaps honestly. If the requested objective does not map to a supported family, Lab Composer can explain what is missing and propose a nearby supported exercise.

## Why validation matters

An articulate workflow can still be impossible, unsafe, or scientifically unsupported. Before any preview or assignment, deterministic validation checks:

- schema and version compatibility;
- registry ID resolution;
- component/action and component/component compatibility;
- reagent/container and reagent/engine compatibility;
- engine capabilities and seed support;
- event flags required by coach triggers and rubrics;
- safety constraints and restricted equipment;
- step reachability and end-to-end runnability.

Validator decisions are authoritative. Judge-agent approval, teacher edits, or a high-quality explanation cannot turn a failed workflow into a runnable one.

## Open-ended but bounded

“Open-ended but bounded” is the central product principle:

- **Open-ended input:** the teacher may describe a skill, misconception, duration, class context, or desired evidence in natural language.
- **Bounded output:** the authoring agent emits only a typed `LabWorkflowSpec` referencing verified registry IDs.
- **Deterministic execution:** the selected engine owns chemistry, measurement consequences, observations, and state transitions.
- **Visible limits:** unsupported capabilities are reported, not filled in with plausible fiction.
- **Human approval:** the teacher previews and explicitly approves a validated workflow before assignment.

Teacher-editable prose, sequencing, rubric emphasis, and time estimates can remain flexible. Registry IDs, chemistry parameters, safety eligibility, and engine behavior cannot be freely invented.

## Supported and unsupported workflows

Final validation assigns one support status:

| Status | Meaning | Teacher action |
|---|---|---|
| `runnable` | All references resolve, hard checks pass, and the runtime can assemble the workflow. | Preview, edit, or assign. |
| `partially_supported` | Part of the learning goal can use verified primitives, but one or more requested capabilities cannot run. | Review the bounded alternative or retain a non-runnable outline. |
| `unsupported` | Required components, reagents, engine capabilities, or event evidence do not exist. | Choose a suggested supported alternative or stop. |
| `rejected_for_safety` | The requested procedure violates a hard safety policy or uses prohibited equipment/reagents. | Do not run; review a safer alternative if one exists. |

Only `runnable` workflows may enter student preview or assignment. A partially supported or unsupported result may preserve explanatory text as a clearly labeled, non-runnable draft.

For example, “Create a lab where students synthesize aspirin” is not runnable in the current direction. It requires organic synthesis, controlled heating/reflux, filtration, recrystallization, yield/purity analysis, and safety models that are not verified. Lab Composer should say so and may suggest a titration, precipitation, or calorimetry objective only when that alternative's family is verified at request time.

## Teacher experience

1. **Enter prompt.** The teacher states an objective and may add duration, grade level, available time, or assessment emphasis.
2. **Review generated workflow.** Lab Composer shows the mapped skills, family, components, reagents, procedure, coach triggers, rubric, and retry plan—not just polished prose.
3. **View validator results.** A hard-check panel distinguishes passed checks, warnings, unsupported references, and safety blockers.
4. **View judge-agent critique.** A separate critic scores alignment, clarity, rubric quality, coach relevance, teacher usability, and suitability for high-school/Chromebook contexts.
5. **Revise or regenerate.** The authoring agent may revise from validator errors and judge critique up to the documented limit. The teacher can edit permitted fields or change the prompt. Every edit causes revalidation.
6. **Preview as student.** This control is enabled only for `runnable` specs. Preview uses the production runtime and coach path with assignment writes disabled or clearly scoped to preview.
7. **Assign to class.** The teacher explicitly approves a versioned, validated spec. The assignment pins workflow, registry, engine, rubric, and validation versions for replay.

The teacher can accept, edit, regenerate, or reject any proposal. The interface must never hide validator failures behind a single “AI quality” score.

## Student experience

1. The student opens an assigned generated lab with no need to understand how it was authored.
2. The runtime assembles verified components and initializes the deterministic engine from the pinned workflow version.
3. The student acts; typed actions flow through `ExperimentDefinition.step()` and emit semantic events.
4. The Student Coach observes relevant events and provides hints or reflection questions without computing chemistry truth.
5. The student records observations and submits a report against the workflow rubric.
6. The Evaluator uses the submission, deterministic ground truth, and event log to return evidence-linked feedback.
7. When useful, the student starts an adaptive retry from a registry-backed template and engine-validated seed.

The authored workflow may change the teaching sequence and evidence requested. It may not change the behavior of the burette, redefine pH, invent a precipitate, or bypass the engine.

## Judge experience

The Build Week judge flow shows the product loop rather than a static authoring mock:

1. Open `/demo` and choose **Generate a lab with Lab Composer**.
2. Watch the prefilled teacher request become a structured spec.
3. Inspect hard-validator results and the separate judge-agent critique.
4. See the authoring agent revise an identified pedagogy issue, if seeded for the demo.
5. Preview the validated workflow as a student.
6. Intentionally add titrant too quickly or overshoot the endpoint.
7. See the engine emit semantic evidence and the coach respond.
8. Switch to Teacher and see readiness evidence update.
9. Open Technical to inspect the workflow version, validation result, critique, event log, and StudentModel update.

This demonstrates the full teacher → authoring → validation → critique → student → coach → teacher loop while using the same runtime paths as production.

## Handling unsupported requests

Unsupported behavior must be explicit and useful:

- name the unsupported capabilities without pretending they exist;
- distinguish missing-platform support from an unsafe request;
- show which part of a mixed request is supported;
- offer nearest alternatives only when they genuinely map to registered skills and families;
- allow a non-runnable outline for teacher planning, clearly marked as such;
- never expose Preview or Assign for a non-runnable result;
- record the support status and validation issues with the draft.

An underspecified prompt such as “make any lab” should request a learning objective or return `unsupported`; it should not choose arbitrary chemistry and imply teacher intent.
