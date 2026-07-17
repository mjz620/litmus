# LabBench AI Documentation Index

## Recommended reading order for coding agents

Read these sources in order before implementing a Lab Composer ticket:

1. [`AGENTS.md`](../AGENTS.md) — repository law, ownership boundaries, and completion-report requirements.
2. [`tickets.md`](../tickets.md) — exact one-ticket scope, dependencies, acceptance criteria, and manual verification.
3. [`docs/product/lab-composer.md`](product/lab-composer.md) — product promise, open-ended-but-bounded behavior, and teacher/student/judge flows.
4. [`docs/architecture/composable-lab-runtime.md`](architecture/composable-lab-runtime.md) — registries, validation, runtime assembly, plugin relationship, and migration boundary.
5. [`docs/experiments/lab-workflow-schema.md`](experiments/lab-workflow-schema.md) — TypeScript-oriented workflow, validation, and critique contracts with examples.
6. [`docs/experiments/component-registry.md`](experiments/component-registry.md) — verified apparatus primitive contracts and restrictions.
7. [`docs/experiments/skill-registry.md`](experiments/skill-registry.md) — objective-to-family/evidence mapping and legacy skill aliases.
8. [`docs/ai/lab-authoring-agent.md`](ai/lab-authoring-agent.md) — authoring role, tool contracts, structured output, and revision policy.
9. [`docs/ai/lab-workflow-judge-agent.md`](ai/lab-workflow-judge-agent.md) — independent pedagogical critique contract and advisory authority.
10. [`docs/ai/agent-boundaries.md`](ai/agent-boundaries.md) — allowed/forbidden behavior across agents, engines, validators, teachers, and UI.
11. [`docs/project/implementation-roadmap-lab-composer.md`](project/implementation-roadmap-lab-composer.md) — phased dependency plan and pre-deadline exclusions.
12. [`docs/demo/lab-composer-judge-demo.md`](demo/lab-composer-judge-demo.md) — Build Week hero flow and three-minute script.
13. [`docs/evaluation/lab-composer-evals.md`](evaluation/lab-composer-evals.md) — hard, authoring, judge, replay, safety, and unsupported-request evals.

Then inspect [`docs/project/Repo_Current_State.md`](project/Repo_Current_State.md) for the pivot note and [`docs/Repo_Current_State.md`](Repo_Current_State.md) for current implementation reality. Existing product, architecture, experiment, AI, demo, and evaluation docs remain useful constraints; the Lab Composer docs extend rather than delete them.

## Interpretation rule

The schema and registry documents describe target contracts. A documented ID or example is not automatically implemented or runnable. Only code-backed registry entries plus a passing, hash-matching hard validation result establish runtime support.

The concise product thesis is:

> AI-authored lab workflows over verified deterministic lab primitives.

Do not shorten that to “AI-generated labs,” which incorrectly implies arbitrary chemistry support.
