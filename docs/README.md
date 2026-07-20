# LabBench AI Documentation Index

## Recommended reading order for coding agents

Read these sources in order before implementing a Lab Composer ticket:

1. [`AGENTS.md`](../AGENTS.md) — repository law, ownership boundaries, and completion-report requirements.
2. [`tickets.md`](../tickets.md) — exact one-ticket scope, dependencies, acceptance criteria, and manual verification.
3. [`docs/lab-composer-architecture.md`](lab-composer-architecture.md) — current-system audit, capability-driven target, compatibility strategy, risks, and phased migration tickets.
4. [`docs/lab-composer/README.md`](lab-composer/README.md) — authoritative downstream-agent execution pack, current source map, contract blueprint, migration/verification playbooks, and exact `LC2-*` ticket specs.
5. [`docs/product/lab-composer.md`](product/lab-composer.md) — original product promise, open-ended-but-bounded behavior, and teacher/student/judge flows.
6. [`docs/architecture/composable-lab-runtime.md`](architecture/composable-lab-runtime.md) — implemented fixed-family transitional architecture and its still-applicable trust constraints.
7. [`docs/experiments/lab-workflow-schema.md`](experiments/lab-workflow-schema.md) — TypeScript-oriented workflow, validation, and critique contracts with examples.
8. [`docs/experiments/component-registry.md`](experiments/component-registry.md) — verified apparatus primitive contracts and restrictions.
9. [`docs/lab/equipment-visual-contract.md`](lab/equipment-visual-contract.md) — normative 3D equipment contract: local-origin meshes, Interactable hover/selection glow, hitboxes, shared silhouettes, and reusable interaction gestures.
10. [`docs/lab/lab-interfaces-and-mechanisms.md`](lab/lab-interfaces-and-mechanisms.md) — working map of how a lab is defined, validated, executed, and rendered: the layer stack, the four ownership seams, capability gating, the ledger seam between mechanics and chemistry, the three-hop render path and its silent failures, definition lifecycle, and add-equipment/action/lab checklists.
11. [`docs/experiments/skill-registry.md`](experiments/skill-registry.md) — objective-to-family/evidence mapping and legacy skill aliases.
12. [`docs/ai/lab-authoring-agent.md`](ai/lab-authoring-agent.md) — authoring role, tool contracts, structured output, and revision policy.
13. [`docs/ai/lab-workflow-judge-agent.md`](ai/lab-workflow-judge-agent.md) — independent pedagogical critique contract and advisory authority.
14. [`docs/ai/agent-boundaries.md`](ai/agent-boundaries.md) — allowed/forbidden behavior across agents, engines, validators, teachers, and UI.
15. [`docs/project/implementation-roadmap-lab-composer.md`](project/implementation-roadmap-lab-composer.md) — historical fixed-family dependency plan and pre-deadline exclusions.
16. [`docs/demo/lab-composer-judge-demo.md`](demo/lab-composer-judge-demo.md) — Build Week hero flow and three-minute script.
17. [`docs/evaluation/lab-composer-evals.md`](evaluation/lab-composer-evals.md) — hard, authoring, judge, replay, safety, and unsupported-request evals.

Then inspect [`docs/project/Repo_Current_State.md`](project/Repo_Current_State.md) for the pivot note and [`docs/Repo_Current_State.md`](Repo_Current_State.md) for current implementation reality. Existing product, architecture, experiment, AI, demo, and evaluation docs remain useful constraints; the Lab Composer docs extend rather than delete them.

## Interpretation rule

The schema and registry documents describe target contracts. A documented ID or example is not automatically implemented or runnable. Only code-backed registry entries plus a passing, hash-matching hard validation result establish runtime support. The capability-driven architecture and LC2 execution pack supersede family/engine dispatch and the T0210–T0220 sequence as the target direction; the older architecture, tickets, and roadmap remain evidence of implemented v1 behavior and original constraints until compatibility tickets replace them.

The concise product thesis is:

> AI-authored lab workflows over verified deterministic lab primitives.

Do not shorten that to “AI-generated labs,” which incorrectly implies arbitrary chemistry support.
